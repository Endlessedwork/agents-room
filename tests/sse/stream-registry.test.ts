import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerController,
  unregisterController,
  emitSSE,
  _clearRegistry,
} from '@/lib/sse/stream-registry';

// Create a mock SSE controller
function mockController() {
  return {
    enqueue: vi.fn(),
  } as unknown as ReadableStreamDefaultController<string>;
}

beforeEach(() => {
  _clearRegistry();
  vi.clearAllMocks();
});

describe('StreamRegistry', () => {
  it('registerController adds controller; emitSSE calls enqueue on it', () => {
    const ctrl = mockController();
    registerController('room-1', ctrl);
    emitSSE('room-1', 'test', { hello: 'world' });
    expect(ctrl.enqueue).toHaveBeenCalledTimes(1);
    expect(ctrl.enqueue).toHaveBeenCalledWith(
      expect.stringContaining('event: test'),
    );
  });

  it('unregisterController removes controller; subsequent emitSSE does not call it', () => {
    const ctrl = mockController();
    registerController('room-2', ctrl);
    unregisterController('room-2', ctrl);
    emitSSE('room-2', 'test', {});
    expect(ctrl.enqueue).not.toHaveBeenCalled();
  });

  it('emitSSE with no registered controllers does nothing (no throw)', () => {
    expect(() => emitSSE('non-existent-room', 'test', {})).not.toThrow();
  });

  it('emitSSE catches and removes controllers that throw on enqueue', () => {
    const brokenCtrl = {
      enqueue: vi.fn().mockImplementation(() => {
        throw new Error('stream closed');
      }),
    } as unknown as ReadableStreamDefaultController<string>;

    const goodCtrl = mockController();

    registerController('room-3', brokenCtrl);
    registerController('room-3', goodCtrl);

    // Should not throw even though brokenCtrl throws
    expect(() => emitSSE('room-3', 'test', { data: 1 })).not.toThrow();

    // Good controller still received the event
    expect(goodCtrl.enqueue).toHaveBeenCalledTimes(1);

    // Subsequent emit should not call brokenCtrl again (it was removed)
    vi.clearAllMocks();
    emitSSE('room-3', 'test2', {});
    expect(brokenCtrl.enqueue).not.toHaveBeenCalled();
    expect(goodCtrl.enqueue).toHaveBeenCalledTimes(1);
  });

  it('multiple controllers for same roomId all receive the event', () => {
    const ctrl1 = mockController();
    const ctrl2 = mockController();
    const ctrl3 = mockController();

    registerController('room-4', ctrl1);
    registerController('room-4', ctrl2);
    registerController('room-4', ctrl3);

    emitSSE('room-4', 'broadcast', { msg: 'hello' });

    expect(ctrl1.enqueue).toHaveBeenCalledTimes(1);
    expect(ctrl2.enqueue).toHaveBeenCalledTimes(1);
    expect(ctrl3.enqueue).toHaveBeenCalledTimes(1);
  });

  it('different roomIds are isolated', () => {
    const ctrlA = mockController();
    const ctrlB = mockController();

    registerController('room-A', ctrlA);
    registerController('room-B', ctrlB);

    emitSSE('room-A', 'event', { for: 'A' });

    expect(ctrlA.enqueue).toHaveBeenCalledTimes(1);
    expect(ctrlB.enqueue).not.toHaveBeenCalled();
  });

  it('emitted payload has correct SSE format', () => {
    const ctrl = mockController();
    registerController('room-5', ctrl);
    emitSSE('room-5', 'token', { text: 'hello' });

    const payload = (ctrl.enqueue as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(payload).toBe(`event: token\ndata: ${JSON.stringify({ text: 'hello' })}\n\n`);
  });
});
