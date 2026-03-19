import { NextResponse } from 'next/server';
import { ConversationManager } from '@/lib/conversation/manager';
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { startConversationSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    // Optional body with topic
    let topic: string | undefined;
    try {
      const body = await req.json();
      const parsed = startConversationSchema.safeParse(body);
      if (parsed.success) topic = parsed.data.topic;
    } catch { /* empty body is OK */ }

    // If topic provided, update room topic
    if (topic) {
      await db.update(rooms).set({ topic }).where(eq(rooms.id, roomId));
    }

    // Fire-and-forget — does NOT await the full loop
    ConversationManager.start(roomId, db);
    return NextResponse.json({ ok: true, status: 'running' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
