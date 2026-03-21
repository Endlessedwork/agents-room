import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import { count, eq } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { rooms, roomAgents, messages, providerKeys } from '@/db/schema';
import { ConversationManager } from '@/lib/conversation/manager';
import { ContextService } from '@/lib/conversation/context-service';

// Mock the LLM gateway module
vi.mock('@/lib/llm/gateway', () => ({
  streamLLM: vi.fn().mockReturnValue({
    textStream: (async function* () {
      yield 'mock ';
      yield 'response';
    })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
  }),
}));

// Mock stream-registry to capture SSE events
vi.mock('@/lib/sse/stream-registry', () => ({
  emitSSE: vi.fn(),
}));

import { streamLLM } from '@/lib/llm/gateway';
import { emitSSE } from '@/lib/sse/stream-registry';
const mockStreamLLM = vi.mocked(streamLLM);

type TestDb = ReturnType<typeof createTestDb>['db'];

let db: TestDb;
let roomId: string;
let agentId: string;

/**
 * Poll until the expected number of agent messages appear in the DB,
 * or throw if the timeout is exceeded.
 */
async function waitForMessages(
  db: TestDb,
  roomId: string,
  target: number,
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    if (value >= target) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for ${target} messages`);
}

/**
 * Poll until the room status matches the expected value.
 */
async function waitForStatus(
  db: TestDb,
  roomId: string,
  status: 'idle' | 'running' | 'paused',
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    if (room?.status === status) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for room status '${status}'`);
}

function makeMockStream(yields: string[] = ['mock ', 'response']) {
  return {
    textStream: (async function* () {
      for (const chunk of yields) {
        yield chunk;
      }
    })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
  } as unknown as ReturnType<typeof streamLLM>;
}

beforeEach(async () => {
  ({ db } = createTestDb());
  roomId = nanoid();
  agentId = nanoid();

  // Create room with small turnLimit for testing
  await db.insert(rooms).values({
    id: roomId,
    name: 'Test Room',
    status: 'idle',
    turnLimit: 3,
    speakerStrategy: 'round-robin',
  });

  // Create room agent
  await db.insert(roomAgents).values({
    id: agentId,
    roomId,
    name: 'Agent A',
    avatarColor: '#000000',
    avatarIcon: 'robot',
    promptRole: 'You are a helpful assistant.',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    temperature: 0.7,
    position: 0,
  });

  // Create provider key
  await db.insert(providerKeys).values({
    provider: 'anthropic',
    apiKey: 'test-key',
    status: 'configured',
  });

  // Reset mock to fresh stream factory per test
  mockStreamLLM.mockImplementation(() => makeMockStream());
});

afterEach(() => {
  ConversationManager._clearControllers();
  vi.clearAllMocks();
});

describe('ConversationManager', () => {
  it('start fires turn loop and produces messages', async () => {
    await ConversationManager.start(roomId, db);
    await waitForMessages(db, roomId, 3);

    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    expect(value).toBe(3);
  });

  it('respects turn limit', async () => {
    // turnLimit=3 set in beforeEach
    await ConversationManager.start(roomId, db);
    await waitForMessages(db, roomId, 3);
    await waitForStatus(db, roomId, 'idle');

    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    expect(value).toBe(3);
  });

  it('pause stops loop after current turn', async () => {
    // Use a slow stream so we can pause mid-loop
    let streamStarted = false;
    mockStreamLLM.mockImplementation(() => {
      const first = !streamStarted;
      streamStarted = true;
      if (first) {
        // First call: slow stream
        return {
          textStream: (async function* () {
            yield 'slow ';
            await new Promise((r) => setTimeout(r, 200));
            yield 'response';
          })(),
          usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
        } as unknown as ReturnType<typeof streamLLM>;
      }
      return makeMockStream();
    });

    await ConversationManager.start(roomId, db);
    // Let first turn begin
    await new Promise((r) => setTimeout(r, 50));
    await ConversationManager.pause(roomId, db);

    // Wait for the in-flight turn to complete
    await waitForMessages(db, roomId, 1);
    await waitForStatus(db, roomId, 'paused');

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    expect(room?.status).toBe('paused');
  });

  it('stop aborts in-flight stream', async () => {
    let aborted = false;

    mockStreamLLM.mockImplementation(({ abortSignal }: { abortSignal?: AbortSignal }) => {
      abortSignal?.addEventListener('abort', () => {
        aborted = true;
      });
      return {
        textStream: (async function* () {
          // Long running stream
          await new Promise<void>((_, reject) => {
            abortSignal?.addEventListener('abort', () => reject(new DOMException('AbortError', 'AbortError')));
            setTimeout(() => { /* never resolves on its own */ }, 60000);
          });
          yield 'never reached';
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      } as unknown as ReturnType<typeof streamLLM>;
    });

    await ConversationManager.start(roomId, db);
    // Give loop a moment to enter stream
    await new Promise((r) => setTimeout(r, 50));
    await ConversationManager.stop(roomId, db);

    // Give abort signal time to propagate
    await new Promise((r) => setTimeout(r, 100));
    expect(aborted).toBe(true);
  });

  it('stop sets status to idle', async () => {
    await ConversationManager.start(roomId, db);
    await new Promise((r) => setTimeout(r, 50));
    await ConversationManager.stop(roomId, db);

    await waitForStatus(db, roomId, 'idle');
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    expect(room?.status).toBe('idle');
  });

  it('persists messages with token counts', async () => {
    await ConversationManager.start(roomId, db);
    await waitForMessages(db, roomId, 1);

    const msg = await db.query.messages.findFirst({
      where: eq(messages.roomId, roomId),
    });
    expect(msg).toBeDefined();
    expect(msg?.inputTokens).toBe(10);
    expect(msg?.outputTokens).toBe(5);
    expect(msg?.roomAgentId).toBe(agentId);
    expect(msg?.model).toBe('claude-3-5-haiku-20241022');
    expect(msg?.content).toBe('mock response');
  });

  it('handles AbortError cleanly without persisting error message', async () => {
    mockStreamLLM.mockImplementation(() => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError');
      return {
        textStream: (async function* () {
          throw abortErr;
          yield 'never'; // unreachable — satisfies generator type
        })(),
        usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
      } as unknown as ReturnType<typeof streamLLM>;
    });

    await ConversationManager.start(roomId, db);
    // Give loop time to hit error
    await new Promise((r) => setTimeout(r, 500));

    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
    });
    const systemErrors = allMessages.filter((m) => m.role === 'system');
    expect(systemErrors).toHaveLength(0);
  });

  it('persists system error on non-abort error', async () => {
    mockStreamLLM.mockImplementation(() => {
      return {
        textStream: (async function* () {
          throw new Error('provider down');
          yield 'never'; // unreachable
        })(),
        usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
      } as unknown as ReturnType<typeof streamLLM>;
    });

    await ConversationManager.start(roomId, db);
    await new Promise((r) => setTimeout(r, 500));

    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
    });
    const systemMsg = allMessages.find((m) => m.role === 'system');
    expect(systemMsg).toBeDefined();
    expect(systemMsg?.content).toContain('[Error:');
  });

  it('auto-pauses on repetition detection', async () => {
    // We need enough messages to trigger repetition.
    // Mock ContextService.detectRepetition to return true on the 3rd call.
    // We do this by inserting pre-existing messages that will trigger detection.
    // Since we use the real detectRepetition, we need to seed messages that
    // have high Jaccard similarity. Insert 4 identical messages so that
    // when the 5th comes in via the loop, REPETITION_WINDOW=5 messages exist
    // with high similarity.
    const base = 'the quick brown fox jumps over the lazy dog near the river bank';

    for (let i = 0; i < 4; i++) {
      await db.insert(messages).values({
        id: nanoid(),
        roomId,
        roomAgentId: agentId,
        role: 'agent',
        content: base,
        model: 'claude-3-5-haiku-20241022',
        createdAt: new Date(Date.now() - (4 - i) * 1000),
      });
    }

    // Mock stream to return identical content
    mockStreamLLM.mockImplementation(() => ({
      textStream: (async function* () {
        yield base;
      })(),
      usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
    } as unknown as ReturnType<typeof streamLLM>));

    await ConversationManager.start(roomId, db);

    // Wait for auto-pause
    await waitForStatus(db, roomId, 'paused');

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    expect(room?.status).toBe('paused');

    // Verify warning system message exists
    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
    });
    const warning = allMessages.find((m) => m.role === 'system' && m.content.includes('Auto-paused'));
    expect(warning).toBeDefined();
  });

  it('does not double-start when start called twice', async () => {
    // Both calls run; the second should be a no-op (controller already registered)
    await ConversationManager.start(roomId, db);
    await ConversationManager.start(roomId, db); // should be no-op

    // Wait for completion — should still produce exactly turnLimit=3 messages (not 6)
    await waitForMessages(db, roomId, 3);
    await waitForStatus(db, roomId, 'idle');

    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    expect(value).toBe(3);
  });

  it('passes turnCount to ContextService.buildContext', async () => {
    const buildContextSpy = vi.spyOn(ContextService, 'buildContext');

    await ConversationManager.start(roomId, db);
    await waitForMessages(db, roomId, 3); // turnLimit=3

    // buildContext should have been called 3 times with turnCount 0, 1, 2
    expect(buildContextSpy).toHaveBeenCalledTimes(3);
    expect(buildContextSpy.mock.calls[0][3]).toBe(0); // first turn
    expect(buildContextSpy.mock.calls[1][3]).toBe(1); // second turn
    expect(buildContextSpy.mock.calls[2][3]).toBe(2); // third turn

    buildContextSpy.mockRestore();
  });

  it('resume continues from existing message count', async () => {
    // Seed 5 existing agent messages with distinct content; turnLimit=10 → should produce 5 more
    await db
      .update(rooms)
      .set({ turnLimit: 10 })
      .where(eq(rooms.id, roomId));

    // Use very distinct content to avoid triggering repetition detection
    const distinctContents = [
      'The quick brown fox jumped over the fence yesterday morning',
      'Artificial intelligence transforms how modern software systems operate globally',
      'Ocean currents influence climate patterns across multiple continents worldwide',
      'Quantum computing promises exponential speedup for certain computational problems',
      'Renaissance artists pioneered techniques still studied in contemporary academies',
    ];

    for (let i = 0; i < 5; i++) {
      await db.insert(messages).values({
        id: nanoid(),
        roomId,
        roomAgentId: agentId,
        role: 'agent',
        content: distinctContents[i],
        model: 'claude-3-5-haiku-20241022',
        createdAt: new Date(Date.now() - (5 - i) * 1000),
      });
    }

    // Mock stream to return distinct content per turn to avoid repetition detection
    let resumeTurnCount = 0;
    const resumeContents = [
      'Alpine meadows display remarkable biodiversity during summer bloom seasons',
      'Semiconductor fabrication requires nanometer precision in cleanroom environments',
      'Ancient trade routes connected distant civilizations through exchange networks',
      'Genetic sequencing technologies accelerate drug discovery and personalized medicine',
      'Urban planning integrates transportation ecology and community design principles',
    ];
    mockStreamLLM.mockImplementation(() => {
      const content = resumeContents[resumeTurnCount % resumeContents.length];
      resumeTurnCount++;
      return {
        textStream: (async function* () {
          yield content;
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      } as unknown as ReturnType<typeof streamLLM>;
    });

    await ConversationManager.resume(roomId, db);
    // Should produce 5 more (10 total - 5 existing = 5 remaining turns)
    await waitForMessages(db, roomId, 10);
    await waitForStatus(db, roomId, 'idle');

    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    expect(value).toBe(10);
  });
});

describe('parallel first round', () => {
  let agentId2: string;
  let agentId3: string;

  beforeEach(async () => {
    agentId2 = nanoid();
    agentId3 = nanoid();

    // Insert second room agent (position 1)
    await db.insert(roomAgents).values({
      id: agentId2,
      roomId,
      name: 'Agent B',
      avatarColor: '#ffffff',
      avatarIcon: 'bot',
      promptRole: 'You are a second assistant.',
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      temperature: 0.7,
      position: 1,
    });

    vi.mocked(emitSSE).mockClear();
  });

  it('all contexts built before any LLM call', async () => {
    await db.update(rooms).set({ parallelFirstRound: true } as any).where(eq(rooms.id, roomId));

    const streamCallOrder: string[] = [];

    // Spy on buildContext using callThrough pattern — wraps original without recursion
    const originalBuildContext = ContextService.buildContext.bind(ContextService);
    const buildContextSpy = vi
      .spyOn(ContextService, 'buildContext')
      .mockImplementation(async (db, roomId, agent, turnCount) => {
        streamCallOrder.push(`buildContext:${(agent as any).name}`);
        return originalBuildContext(db, roomId, agent, turnCount);
      });

    mockStreamLLM.mockImplementation(() => {
      streamCallOrder.push('streamLLM');
      return makeMockStream();
    });

    await ConversationManager.start(roomId, db);
    await waitForMessages(db, roomId, 2);
    await waitForStatus(db, roomId, 'idle');

    buildContextSpy.mockRestore();

    // Both buildContext calls should appear before first streamLLM call
    const firstStreamIndex = streamCallOrder.indexOf('streamLLM');
    const buildContextIndices = streamCallOrder
      .map((entry, i) => (entry.startsWith('buildContext:') ? i : -1))
      .filter((i) => i >= 0);

    // At minimum 2 buildContext calls (one per agent in parallel round)
    expect(buildContextIndices.length).toBeGreaterThanOrEqual(2);
    // All buildContext calls come before the first streamLLM call
    expect(firstStreamIndex).toBeGreaterThan(-1);
    buildContextIndices.slice(0, 2).forEach((idx) => {
      expect(idx).toBeLessThan(firstStreamIndex);
    });
  });

  it('messages persisted in agent position order', async () => {
    // Add a third agent
    await db.insert(roomAgents).values({
      id: agentId3,
      roomId,
      name: 'Agent C',
      avatarColor: '#aabbcc',
      avatarIcon: 'star',
      promptRole: 'You are a third assistant.',
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      temperature: 0.7,
      position: 2,
    });

    await db.update(rooms).set({ parallelFirstRound: true, turnLimit: 3 } as any).where(eq(rooms.id, roomId));

    // Track call order via different responses per agent
    let callIdx = 0;
    mockStreamLLM.mockImplementation(({ system }: { system?: string }) => {
      const idx = callIdx++;
      return {
        textStream: (async function* () {
          // Add small varying delay to confirm ordering is by position, not arrival
          await new Promise((r) => setTimeout(r, (2 - idx) * 20));
          yield `response-from-agent-${idx}`;
        })(),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      } as unknown as ReturnType<typeof streamLLM>;
    });

    await ConversationManager.start(roomId, db);
    await waitForMessages(db, roomId, 3);
    await waitForStatus(db, roomId, 'idle');

    // Query messages ordered by createdAt
    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });

    const agentMessages = allMessages.filter((m) => m.role === 'agent');
    expect(agentMessages).toHaveLength(3);

    // Look up positions for each roomAgentId
    const agentPositions: Record<string, number> = {
      [agentId]: 0,
      [agentId2]: 1,
      [agentId3]: 2,
    };

    const persistedPositions = agentMessages.map((m) => agentPositions[m.roomAgentId ?? '']);
    expect(persistedPositions).toEqual([0, 1, 2]);
  });

  it('abort discards all parallel round results', async () => {
    await db.update(rooms).set({ parallelFirstRound: true } as any).where(eq(rooms.id, roomId));

    let abortSignalRef: AbortSignal | undefined;

    mockStreamLLM.mockImplementation(({ abortSignal }: { abortSignal?: AbortSignal }) => {
      abortSignalRef = abortSignal;
      return {
        textStream: (async function* () {
          // Hold until aborted
          await new Promise<void>((_, reject) => {
            abortSignal?.addEventListener('abort', () =>
              reject(new DOMException('AbortError', 'AbortError'))
            );
            setTimeout(() => {}, 60000);
          });
          yield 'never';
        })(),
        usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
      } as unknown as ReturnType<typeof streamLLM>;
    });

    // Start and abort quickly
    ConversationManager.start(roomId, db);
    await new Promise((r) => setTimeout(r, 80));
    await ConversationManager.stop(roomId, db);

    await waitForStatus(db, roomId, 'idle');
    await new Promise((r) => setTimeout(r, 200));

    // Zero agent messages should be persisted
    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    expect(value).toBe(0);
  });

  it('emits parallel:start and parallel:end SSE events', async () => {
    await db.update(rooms).set({ parallelFirstRound: true, turnLimit: 2 } as any).where(eq(rooms.id, roomId));

    mockStreamLLM.mockImplementation(() => makeMockStream());

    await ConversationManager.start(roomId, db);
    await waitForMessages(db, roomId, 2);
    await waitForStatus(db, roomId, 'idle');

    const calls = vi.mocked(emitSSE).mock.calls.filter((c) => c[0] === roomId);
    const eventNames = calls.map((c) => c[1]);

    // parallel:start should appear before any turn:start
    const parallelStartIdx = eventNames.indexOf('parallel:start');
    const firstTurnStartIdx = eventNames.indexOf('turn:start');
    expect(parallelStartIdx).toBeGreaterThanOrEqual(0);
    expect(parallelStartIdx).toBeLessThan(firstTurnStartIdx);

    // parallel:end should appear after all turn:end events
    const parallelEndIdx = eventNames.lastIndexOf('parallel:end');
    const lastTurnEndIdx = eventNames.lastIndexOf('turn:end');
    expect(parallelEndIdx).toBeGreaterThanOrEqual(0);
    expect(parallelEndIdx).toBeGreaterThan(lastTurnEndIdx);

    // parallel:start should carry agentCount
    const parallelStartCall = calls.find((c) => c[1] === 'parallel:start');
    expect(parallelStartCall?.[2]).toMatchObject({ agentCount: 2 });
  });

  it('sequential loop continues after parallel round', async () => {
    await db.update(rooms).set({ parallelFirstRound: true, turnLimit: 4 } as any).where(eq(rooms.id, roomId));

    vi.spyOn(ContextService, 'detectRepetition').mockResolvedValue(false);
    vi.spyOn(ContextService, 'detectConvergence').mockResolvedValue(false);

    mockStreamLLM.mockImplementation(() => makeMockStream());

    await ConversationManager.start(roomId, db);
    await waitForMessages(db, roomId, 4);
    await waitForStatus(db, roomId, 'idle');

    // Parallel round produces 2 messages, sequential loop produces 2 more = 4 total
    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    expect(value).toBe(4);
  });
});

describe('ConversationManager convergence auto-pause', () => {
  // These tests require TWO agents in the room for cross-agent convergence detection
  let agentId2: string;

  beforeEach(async () => {
    agentId2 = nanoid();

    // Insert second room agent
    await db.insert(roomAgents).values({
      id: agentId2,
      roomId,
      name: 'Agent B',
      avatarColor: '#ffffff',
      avatarIcon: 'bot',
      promptRole: 'You are a second assistant.',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      position: 1,
    });

    // Insert provider key for openai
    await db.insert(providerKeys).values({
      provider: 'openai',
      apiKey: 'test-openai-key',
      status: 'configured',
    });
  });

  it('auto-pauses on convergence detection', async () => {
    // Set high turn limit so convergence fires before turn limit.
    // Spy on detectConvergence to return true once turnCount reaches 5 (6th turn).
    // This isolates the manager wiring test from the convergence algorithm itself
    // (which is already tested in context-service.test.ts).
    await db.update(rooms).set({ turnLimit: 20 }).where(eq(rooms.id, roomId));

    const detectConvergenceSpy = vi.spyOn(ContextService, 'detectConvergence').mockImplementation(
      async (_db, _roomId, turnCount) => {
        return turnCount >= 5;
      },
    );

    // Also suppress repetition detection so it doesn't interfere
    vi.spyOn(ContextService, 'detectRepetition').mockResolvedValue(false);

    mockStreamLLM.mockImplementation(() => makeMockStream());

    await ConversationManager.start(roomId, db);

    // Wait for auto-pause triggered by convergence (fires on 6th turn when turnCount=5)
    await waitForStatus(db, roomId, 'paused', 10000);

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    expect(room?.status).toBe('paused');

    // Verify system message persisted
    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
    });
    const systemMsg = allMessages.find((m) => m.role === 'system' && m.content.includes('agents reached consensus'));
    expect(systemMsg).toBeDefined();
    expect(systemMsg?.role).toBe('system');
    expect(systemMsg?.roomAgentId).toBeNull();

    detectConvergenceSpy.mockRestore();
  });

  it('does not fire convergence before turn 6', async () => {
    // Set turnLimit=5: loop runs for 5 turns (turnCount 0,1,2,3,4).
    // detectConvergence guard: turnCount < 5 → always returns false for all 5 turns.
    // Even if we spy it to always return true, the guard prevents it — but here we
    // test the actual guard by using turnLimit=5 so the loop ends before turn 6.
    await db.update(rooms).set({ turnLimit: 5 }).where(eq(rooms.id, roomId));

    // Use the real detectConvergence but spy on detectRepetition to prevent it firing
    vi.spyOn(ContextService, 'detectRepetition').mockResolvedValue(false);

    // Use the real detectConvergence — with turnLimit=5, turnCount goes 0..4, guard blocks all
    mockStreamLLM.mockImplementation(() => makeMockStream());

    await ConversationManager.start(roomId, db);

    // Loop should complete normally (idle), NOT pause on convergence
    await waitForStatus(db, roomId, 'idle', 10000);

    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    expect(room?.status).toBe('idle');

    // No consensus system message should exist
    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
    });
    const consensusMsg = allMessages.find((m) => m.content.includes('consensus'));
    expect(consensusMsg).toBeUndefined();
  });

  it('system message content is exactly [Auto-paused: agents reached consensus]', async () => {
    // Same setup as Test 1 — spy to trigger convergence at turnCount=5 (6th turn)
    await db.update(rooms).set({ turnLimit: 20 }).where(eq(rooms.id, roomId));

    const detectConvergenceSpy = vi.spyOn(ContextService, 'detectConvergence').mockImplementation(
      async (_db, _roomId, turnCount) => {
        return turnCount >= 5;
      },
    );

    vi.spyOn(ContextService, 'detectRepetition').mockResolvedValue(false);

    mockStreamLLM.mockImplementation(() => makeMockStream());

    await ConversationManager.start(roomId, db);
    await waitForStatus(db, roomId, 'paused', 10000);

    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
    });
    const systemMsg = allMessages.find((m) => m.role === 'system' && m.content.includes('consensus'));
    expect(systemMsg).toBeDefined();
    expect(systemMsg?.content).toBe('[Auto-paused: agents reached consensus]');
    expect(systemMsg?.role).toBe('system');
    expect(systemMsg?.roomAgentId).toBeNull();

    detectConvergenceSpy.mockRestore();
  });
});
