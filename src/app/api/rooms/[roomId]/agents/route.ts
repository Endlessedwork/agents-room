import { NextResponse } from 'next/server';
import { eq, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { agents, roomAgents } from '@/db/schema';
import { addAgentToRoomSchema, removeAgentFromRoomSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const body = await req.json();
    const parsed = addAgentToRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const source = await db.query.agents.findFirst({
      where: eq(agents.id, parsed.data.agentId),
    });

    if (!source) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Calculate position: count existing roomAgents for this room
    const [{ value: existingCount }] = await db
      .select({ value: count(roomAgents.id) })
      .from(roomAgents)
      .where(eq(roomAgents.roomId, roomId));

    const inserted = await db
      .insert(roomAgents)
      .values({
        id: nanoid(),
        roomId,
        sourceAgentId: source.id,
        // Copy all config columns from library agent
        name: source.name,
        avatarColor: source.avatarColor,
        avatarIcon: source.avatarIcon,
        promptRole: source.promptRole,
        promptPersonality: source.promptPersonality,
        promptRules: source.promptRules,
        promptConstraints: source.promptConstraints,
        provider: source.provider,
        model: source.model,
        temperature: source.temperature,
        position: existingCount,
      })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (err) {
    console.error('[POST /api/rooms/:roomId/agents]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params: _params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const body = await req.json();
    const parsed = removeAgentFromRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    await db.delete(roomAgents).where(eq(roomAgents.id, parsed.data.roomAgentId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/rooms/:roomId/agents]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
