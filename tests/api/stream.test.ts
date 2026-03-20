import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the SSE registry before importing the route
vi.mock('@/lib/sse/stream-registry', () => ({
  registerController: vi.fn(),
  unregisterController: vi.fn(),
  emitSSE: vi.fn(),
}));

import { GET } from '@/app/api/rooms/[roomId]/stream/route';
import { registerController } from '@/lib/sse/stream-registry';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/rooms/:roomId/stream', () => {
  it('returns a response with Content-Type: text/event-stream', async () => {
    const req = new Request('http://localhost/api/rooms/test-room/stream');
    const response = await GET(req, { params: Promise.resolve({ roomId: 'test-room' }) });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('calls registerController with the roomId', async () => {
    const req = new Request('http://localhost/api/rooms/test-room/stream');
    await GET(req, { params: Promise.resolve({ roomId: 'test-room' }) });

    expect(registerController).toHaveBeenCalledWith('test-room', expect.anything());
  });

  it('response body is not null (is a ReadableStream)', async () => {
    const req = new Request('http://localhost/api/rooms/test-room/stream');
    const response = await GET(req, { params: Promise.resolve({ roomId: 'test-room' }) });

    expect(response.body).not.toBeNull();
  });

  it('returns Cache-Control: no-cache header', async () => {
    const req = new Request('http://localhost/api/rooms/test-room/stream');
    const response = await GET(req, { params: Promise.resolve({ roomId: 'test-room' }) });

    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('uses different roomId from params', async () => {
    const req = new Request('http://localhost/api/rooms/another-room/stream');
    await GET(req, { params: Promise.resolve({ roomId: 'another-room' }) });

    expect(registerController).toHaveBeenCalledWith('another-room', expect.anything());
  });
});
