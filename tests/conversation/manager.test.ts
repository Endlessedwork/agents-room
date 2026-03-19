import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import { count, eq } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { rooms, roomAgents, messages, providerKeys } from '@/db/schema';
import { ConversationManager } from '@/lib/conversation/manager';

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

import { streamLLM } from '@/lib/llm/gateway';
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
  };
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
        };
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
      };
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
      };
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
      };
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
    }));

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
    await ConversationManager.start(roomId, db);
    await ConversationManager.start(roomId, db); // should be no-op

    // Only one controller should exist
    const controller = ConversationManager._getActiveController(roomId);
    expect(controller).toBeDefined();

    // Wait for completion
    await waitForMessages(db, roomId, 3);
    await waitForStatus(db, roomId, 'idle');
    // Still should have only 3 messages (not 6 from a double loop)
    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    expect(value).toBe(3);
  });

  it('resume continues from existing message count', async () => {
    // Seed 5 existing agent messages; turnLimit=10 → should produce 5 more
    await db
      .update(rooms)
      .set({ turnLimit: 10 })
      .where(eq(rooms.id, roomId));

    for (let i = 0; i < 5; i++) {
      await db.insert(messages).values({
        id: nanoid(),
        roomId,
        roomAgentId: agentId,
        role: 'agent',
        content: `existing message ${i}`,
        model: 'claude-3-5-haiku-20241022',
        createdAt: new Date(Date.now() - (5 - i) * 1000),
      });
    }

    await ConversationManager.resume(roomId, db);
    // Should produce 5 more (10 total - 5 existing)
    await waitForMessages(db, roomId, 10);
    await waitForStatus(db, roomId, 'idle');

    const [{ value }] = await db
      .select({ value: count(messages.id) })
      .from(messages)
      .where(eq(messages.roomId, roomId));
    expect(value).toBe(10);
  });
});
