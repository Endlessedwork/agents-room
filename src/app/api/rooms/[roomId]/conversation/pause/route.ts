import { NextResponse } from 'next/server';
import { ConversationManager } from '@/lib/conversation/manager';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    await ConversationManager.pause(roomId, db);
    return NextResponse.json({ ok: true, status: 'paused' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
