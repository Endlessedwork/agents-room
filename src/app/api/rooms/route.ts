import { NextResponse } from 'next/server';
import { desc, count, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { rooms, roomAgents } from '@/db/schema';
import { createRoomSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const roomList = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        topic: rooms.topic,
        status: rooms.status,
        lastActivityAt: rooms.lastActivityAt,
        createdAt: rooms.createdAt,
        agentCount: count(roomAgents.id),
      })
      .from(rooms)
      .leftJoin(roomAgents, eq(roomAgents.roomId, rooms.id))
      .groupBy(rooms.id)
      .orderBy(desc(rooms.lastActivityAt), desc(rooms.createdAt));

    return NextResponse.json(roomList);
  } catch (err) {
    console.error('[GET /api/rooms]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const id = nanoid();
    const inserted = await db
      .insert(rooms)
      .values({
        id,
        name: parsed.data.name,
        topic: parsed.data.topic ?? null,
        turnLimit: parsed.data.turnLimit,
        speakerStrategy: parsed.data.speakerStrategy,
        parallelFirstRound: parsed.data.parallelFirstRound,
      })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (err) {
    console.error('[POST /api/rooms]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
