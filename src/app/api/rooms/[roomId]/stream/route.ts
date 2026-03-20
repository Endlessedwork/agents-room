import { registerController, unregisterController } from '@/lib/sse/stream-registry';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;

  let savedController: ReadableStreamDefaultController<string> | null = null;

  const stream = new ReadableStream<string>({
    start(controller) {
      savedController = controller;
      registerController(roomId, controller);
      // Initial heartbeat comment to establish connection
      controller.enqueue(': heartbeat\n\n');
    },
    cancel() {
      if (savedController) {
        unregisterController(roomId, savedController);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
