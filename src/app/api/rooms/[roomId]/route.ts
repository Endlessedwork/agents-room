import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { rooms } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        roomAgents: true,
        messages: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (err) {
    console.error('[GET /api/rooms/:roomId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    await db.delete(rooms).where(eq(rooms.id, roomId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/rooms/:roomId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
