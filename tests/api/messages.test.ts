import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { rooms, roomAgents, messages } from '@/db/schema';
import { _clearRegistry } from '@/lib/sse/stream-registry';

// Mock the SSE registry so emitSSE doesn't fail in tests
vi.mock('@/lib/sse/stream-registry', () => ({
  emitSSE: vi.fn(),
  registerController: vi.fn(),
  unregisterController: vi.fn(),
  _clearRegistry: vi.fn(),
}));

// Mock the db singleton used by the route
vi.mock('@/db', () => {
  // We'll replace this with actual test db in each test
  return { db: null };
});

import * as dbModule from '@/db';
import { GET, POST } from '@/app/api/rooms/[roomId]/messages/route';

type TestDb = ReturnType<typeof createTestDb>['db'];

let db: TestDb;
let roomId: string;
let agentId: string;

beforeEach(async () => {
  ({ db } = createTestDb());
  roomId = nanoid();
  agentId = nanoid();

  // Point the route module at our in-memory test DB
  (dbModule as { db: TestDb }).db = db;

  // Insert a room for FK constraints
  await db.insert(rooms).values({
    id: roomId,
    name: 'Test Room',
    status: 'idle',
    turnLimit: 10,
    speakerStrategy: 'round-robin',
  });

  // Insert a room agent for relation tests
  await db.insert(roomAgents).values({
    id: agentId,
    roomId,
    name: 'Agent A',
    avatarColor: '#000000',
    avatarIcon: 'robot',
    promptRole: 'You are helpful.',
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    temperature: 0.7,
    position: 0,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ roomId: id }) };
}

describe('GET /api/rooms/:roomId/messages', () => {
  it('returns empty array for room with no messages', async () => {
    const req = new Request(`http://localhost/api/rooms/${roomId}/messages`);
    const res = await GET(req, makeParams(roomId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('returns messages ordered by createdAt ascending', async () => {
    // Insert two messages with explicit timestamps (older first)
    const msg1Id = nanoid();
    const msg2Id = nanoid();
    await db.insert(messages).values({
      id: msg1Id,
      roomId,
      roomAgentId: null,
      role: 'user',
      content: 'first message',
      createdAt: new Date(Date.now() - 2000),
    });
    await db.insert(messages).values({
      id: msg2Id,
      roomId,
      roomAgentId: null,
      role: 'user',
      content: 'second message',
      createdAt: new Date(Date.now() - 1000),
    });

    const req = new Request(`http://localhost/api/rooms/${roomId}/messages`);
    const res = await GET(req, makeParams(roomId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].content).toBe('first message');
    expect(body[1].content).toBe('second message');
  });

  it('includes roomAgent relation for agent messages', async () => {
    await db.insert(messages).values({
      id: nanoid(),
      roomId,
      roomAgentId: agentId,
      role: 'agent',
      content: 'agent says hi',
    });

    const req = new Request(`http://localhost/api/rooms/${roomId}/messages`);
    const res = await GET(req, makeParams(roomId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].roomAgent).toBeDefined();
    expect(body[0].roomAgent.name).toBe('Agent A');
  });
});

describe('POST /api/rooms/:roomId/messages', () => {
  it('persists user message and returns 201 with id, role, content', async () => {
    const req = new Request(`http://localhost/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello world' }),
    });

    const res = await POST(req, makeParams(roomId));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe('user');
    expect(body.content).toBe('hello world');
    expect(body.id).toBeDefined();
    expect(body.roomId).toBe(roomId);
  });

  it('returns 400 for empty content', async () => {
    const req = new Request(`http://localhost/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });

    const res = await POST(req, makeParams(roomId));
    expect(res.status).toBe(400);
  });

  it('returns 400 for whitespace-only content', async () => {
    const req = new Request(`http://localhost/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '   ' }),
    });

    const res = await POST(req, makeParams(roomId));
    expect(res.status).toBe(400);
  });

  it('inserted user message appears in subsequent GET', async () => {
    const postReq = new Request(`http://localhost/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'new message' }),
    });

    await POST(postReq, makeParams(roomId));

    const getReq = new Request(`http://localhost/api/rooms/${roomId}/messages`);
    const res = await GET(getReq, makeParams(roomId));
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].content).toBe('new message');
    expect(body[0].role).toBe('user');
  });

  it('calls emitSSE after successful insert', async () => {
    const { emitSSE } = await import('@/lib/sse/stream-registry');

    const req = new Request(`http://localhost/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'test emit' }),
    });

    await POST(req, makeParams(roomId));

    expect(emitSSE).toHaveBeenCalledWith(
      roomId,
      'user-message',
      expect.objectContaining({ content: 'test emit' }),
    );
  });
});
