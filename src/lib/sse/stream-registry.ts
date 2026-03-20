type SSEController = ReadableStreamDefaultController<string>;

const registry = new Map<string, Set<SSEController>>();

export function registerController(roomId: string, ctrl: SSEController): void {
  if (!registry.has(roomId)) registry.set(roomId, new Set());
  registry.get(roomId)!.add(ctrl);
}

export function unregisterController(roomId: string, ctrl: SSEController): void {
  const controllers = registry.get(roomId);
  if (controllers) {
    controllers.delete(ctrl);
    if (controllers.size === 0) registry.delete(roomId);
  }
}

export function emitSSE(roomId: string, event: string, data: unknown): void {
  const controllers = registry.get(roomId);
  if (!controllers) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const ctrl of controllers) {
    try {
      ctrl.enqueue(payload);
    } catch {
      // Client disconnected — silently remove dead controller
      controllers.delete(ctrl);
    }
  }
}

// Test helper — clear all entries (used in test teardown)
export function _clearRegistry(): void {
  registry.clear();
}
