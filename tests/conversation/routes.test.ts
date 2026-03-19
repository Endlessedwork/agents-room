import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ConversationManager before importing routes
vi.mock('@/lib/conversation/manager', () => ({
  ConversationManager: {
    start: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the db module so routes don't need a real SQLite connection
vi.mock('@/db', () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    query: {
      rooms: {
        findFirst: vi.fn().mockResolvedValue({ id: 'room-1', topic: null }),
      },
    },
  },
}));

import { ConversationManager } from '@/lib/conversation/manager';
import { POST as startPOST } from '@/app/api/rooms/[roomId]/conversation/start/route';
import { POST as pausePOST } from '@/app/api/rooms/[roomId]/conversation/pause/route';
import { POST as stopPOST } from '@/app/api/rooms/[roomId]/conversation/stop/route';
import { POST as resumePOST } from '@/app/api/rooms/[roomId]/conversation/resume/route';

const mockStart = vi.mocked(ConversationManager.start);
const mockPause = vi.mocked(ConversationManager.pause);
const mockStop = vi.mocked(ConversationManager.stop);
const mockResume = vi.mocked(ConversationManager.resume);

function makeParams(roomId: string) {
  return { params: Promise.resolve({ roomId }) };
}

function makeRequest(body?: unknown): Request {
  if (body === undefined) {
    return new Request('http://localhost', { method: 'POST' });
  }
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Conversation control routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/rooms/:roomId/conversation/start', () => {
    it('calls ConversationManager.start with roomId', async () => {
      const res = await startPOST(makeRequest(), makeParams('room-abc'));
      const json = await res.json();

      expect(mockStart).toHaveBeenCalledWith('room-abc', expect.anything());
      expect(json).toEqual({ ok: true, status: 'running' });
      expect(res.status).toBe(200);
    });

    it('accepts optional topic in request body', async () => {
      const res = await startPOST(makeRequest({ topic: 'AI ethics' }), makeParams('room-xyz'));
      const json = await res.json();

      expect(mockStart).toHaveBeenCalledWith('room-xyz', expect.anything());
      expect(json).toEqual({ ok: true, status: 'running' });
    });

    it('returns running status even with empty body', async () => {
      const res = await startPOST(makeRequest(), makeParams('room-1'));
      const json = await res.json();

      expect(json.status).toBe('running');
      expect(json.ok).toBe(true);
    });
  });

  describe('POST /api/rooms/:roomId/conversation/pause', () => {
    it('calls ConversationManager.pause with roomId', async () => {
      const res = await pausePOST(makeRequest(), makeParams('room-abc'));
      const json = await res.json();

      expect(mockPause).toHaveBeenCalledWith('room-abc', expect.anything());
      expect(json).toEqual({ ok: true, status: 'paused' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/rooms/:roomId/conversation/stop', () => {
    it('calls ConversationManager.stop with roomId', async () => {
      const res = await stopPOST(makeRequest(), makeParams('room-abc'));
      const json = await res.json();

      expect(mockStop).toHaveBeenCalledWith('room-abc', expect.anything());
      expect(json).toEqual({ ok: true, status: 'idle' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/rooms/:roomId/conversation/resume', () => {
    it('calls ConversationManager.resume with roomId', async () => {
      const res = await resumePOST(makeRequest(), makeParams('room-abc'));
      const json = await res.json();

      expect(mockResume).toHaveBeenCalledWith('room-abc', expect.anything());
      expect(json).toEqual({ ok: true, status: 'running' });
      expect(res.status).toBe(200);
    });
  });
});
