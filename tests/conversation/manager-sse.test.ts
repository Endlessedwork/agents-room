import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import { createTestDb } from '../setup';
import { rooms, roomAgents, providerKeys } from '@/db/schema';
import { ConversationManager } from '@/lib/conversation/manager';

// Mock stream-registry BEFORE manager import
vi.mock('@/lib/sse/stream-registry', () => ({
  emitSSE: vi.fn(),
  registerController: vi.fn(),
  unregisterController: vi.fn(),
}));

// Mock the LLM gateway
vi.mock('@/lib/llm/gateway', () => ({
  streamLLM: vi.fn().mockReturnValue({
    textStream: (async function* () {
      yield 'hello ';
      yield 'world';
    })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
  }),
}));

import { emitSSE } from '@/lib/sse/stream-registry';
import { streamLLM } from '@/lib/llm/gateway';
const mockEmitSSE = vi.mocked(emitSSE);
const mockStreamLLM = vi.mocked(streamLLM);

type TestDb = ReturnType<typeof createTestDb>['db'];

let db: TestDb;
let roomId: string;
let agentId: string;

function makeMockStream(chunks: string[] = ['hello ', 'world']) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
  } as unknown as ReturnType<typeof streamLLM>;
}

/**
 * Wait until emitSSE has been called with a specific roomId + event type at least once.
 */
function makeWaitForEvent(targetRoomId: () => string) {
  return async function waitForEvent(event: string, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = mockEmitSSE.mock.calls.some(
        (call) => call[0] === targetRoomId() && call[1] === event
      );
      if (found) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for emitSSE event: ${event} on room ${targetRoomId()}`);
  };
}

function makeWaitForEventWithData(targetRoomId: () => string) {
  return async function waitForEventWithData(
    event: string,
    dataMatcher: (data: unknown) => boolean,
    timeoutMs = 5000
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = mockEmitSSE.mock.calls.some(
        (call) => call[0] === targetRoomId() && call[1] === event && dataMatcher(call[2])
      );
      if (found) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for emitSSE event: ${event} with matching data`);
  };
}

beforeEach(async () => {
  ({ db } = createTestDb());
  roomId = nanoid();
  agentId = nanoid();

  await db.insert(rooms).values({
    id: roomId,
    name: 'SSE Test Room',
    status: 'idle',
    turnLimit: 2,
    speakerStrategy: 'round-robin',
  });

  await db.insert(roomAgents).values({
    id: agentId,
    roomId,
    name: 'Test Agent',
    avatarColor: '#FF0000',
    avatarIcon: 'robot',
    promptRole: 'You are a test agent.',
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    temperature: 0.7,
    position: 0,
  });

  await db.insert(providerKeys).values({
    provider: 'anthropic',
    apiKey: 'test-key',
    status: 'configured',
  });

  mockStreamLLM.mockImplementation(() => makeMockStream());
});

afterEach(() => {
  ConversationManager._clearControllers();
  vi.clearAllMocks();
});

describe('ConversationManager SSE emissions', () => {
  let waitForEvent: ReturnType<typeof makeWaitForEvent>;
  let waitForEventWithData: ReturnType<typeof makeWaitForEventWithData>;

  beforeEach(() => {
    waitForEvent = makeWaitForEvent(() => roomId);
    waitForEventWithData = makeWaitForEventWithData(() => roomId);
  });

  it('start emits status event with { status: running }', async () => {
    await ConversationManager.start(roomId, db);
    await waitForEventWithData('status', (d) => (d as { status: string }).status === 'running');

    const runningCalls = mockEmitSSE.mock.calls.filter(
      (c) => c[0] === roomId && c[1] === 'status' && (c[2] as { status: string }).status === 'running'
    );
    expect(runningCalls.length).toBeGreaterThanOrEqual(1);
    expect(runningCalls[0][0]).toBe(roomId);
  });

  it('emits turn:start with agentId, agentName, model, turnNumber, totalTurns', async () => {
    await ConversationManager.start(roomId, db);
    await waitForEvent('turn:start');

    // Filter to calls for our specific roomId to avoid cross-test contamination
    const turnStartCalls = mockEmitSSE.mock.calls.filter(
      (c) => c[0] === roomId && c[1] === 'turn:start'
    );
    expect(turnStartCalls.length).toBeGreaterThanOrEqual(1);

    const data = turnStartCalls[0][2] as Record<string, unknown>;
    expect(data.agentId).toBe(agentId);
    expect(data.agentName).toBe('Test Agent');
    expect(data.model).toBe('claude-3-haiku-20240307');
    expect(data.turnNumber).toBe(1);
    expect(data.totalTurns).toBe(2);
  });

  it('emits token events for each chunk from textStream', async () => {
    mockStreamLLM.mockImplementation(() => makeMockStream(['chunk1', 'chunk2', 'chunk3']));

    await ConversationManager.start(roomId, db);
    // Wait for at least first turn:end (means turn completed)
    await waitForEventWithData('turn:end', () => true);

    // Filter to calls for our specific roomId to avoid cross-test contamination
    const tokenCalls = mockEmitSSE.mock.calls.filter(
      (c) => c[0] === roomId && c[1] === 'token'
    );
    // Should have at least 3 token events from first turn (chunk1, chunk2, chunk3)
    expect(tokenCalls.length).toBeGreaterThanOrEqual(3);

    // Verify token payloads
    const texts = tokenCalls.slice(0, 3).map((c) => (c[2] as { text: string }).text);
    expect(texts).toContain('chunk1');
    expect(texts).toContain('chunk2');
    expect(texts).toContain('chunk3');
  });

  it('emits turn:end after message persist with messageId, inputTokens, outputTokens', async () => {
    await ConversationManager.start(roomId, db);
    await waitForEvent('turn:end');

    // Filter to calls for our specific roomId to avoid cross-test contamination
    const turnEndCalls = mockEmitSSE.mock.calls.filter(
      (c) => c[0] === roomId && c[1] === 'turn:end'
    );
    expect(turnEndCalls.length).toBeGreaterThanOrEqual(1);

    const data = turnEndCalls[0][2] as Record<string, unknown>;
    expect(data.agentId).toBe(agentId);
    expect(data.messageId).toBeDefined();
    expect(typeof data.messageId).toBe('string');
    expect(data.inputTokens).toBe(10);
    expect(data.outputTokens).toBe(5);
  });

  it('stop emits status { status: idle }', async () => {
    // Make stream long-running
    mockStreamLLM.mockImplementation(() => ({
      textStream: (async function* () {
        await new Promise((r) => setTimeout(r, 10000));
        yield 'never';
      })(),
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
    } as unknown as ReturnType<typeof streamLLM>));

    await ConversationManager.start(roomId, db);
    await new Promise((r) => setTimeout(r, 50));
    await ConversationManager.stop(roomId, db);

    const idleCalls = mockEmitSSE.mock.calls.filter(
      (c) => c[0] === roomId && c[1] === 'status' && (c[2] as { status: string }).status === 'idle'
    );
    expect(idleCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('pause emits status { status: paused }', async () => {
    await ConversationManager.pause(roomId, db);

    expect(mockEmitSSE).toHaveBeenCalledWith(roomId, 'status', { status: 'paused' });
  });

  it('system error triggers system event', async () => {
    mockStreamLLM.mockImplementation(() => ({
      textStream: (async function* () {
        throw new Error('provider down');
        yield 'never'; // unreachable
      })(),
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
    } as unknown as ReturnType<typeof streamLLM>));

    await ConversationManager.start(roomId, db);
    await waitForEvent('system');

    const systemCalls = mockEmitSSE.mock.calls.filter((c) => c[0] === roomId && c[1] === 'system');
    expect(systemCalls.length).toBeGreaterThanOrEqual(1);
    const data = systemCalls[0][2] as { content: string };
    expect(data.content).toContain('[Error:');
    expect(data.content).toContain('provider down');
  });
});
