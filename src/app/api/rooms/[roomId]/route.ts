import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { updateRoomSchema } from '@/lib/validations';

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const body = await req.json();
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    // Guard against editing while running
    const existing = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });
    if (!existing) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    if (existing.status === 'running' || existing.status === 'paused') {
      return NextResponse.json(
        { error: 'Cannot update room settings while conversation is running or paused' },
        { status: 409 },
      );
    }
    const updated = await db
      .update(rooms)
      .set(parsed.data)
      .where(eq(rooms.id, roomId))
      .returning();
    return NextResponse.json(updated[0]);
  } catch (err) {
    console.error('[PATCH /api/rooms/:roomId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
