import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { agents } from '@/db/schema';
import { updateAgentSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (err) {
    console.error('[GET /api/agents/:agentId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    const body = await req.json();
    const parsed = updateAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const updated = await db
      .update(agents)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(agents.id, agentId))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (err) {
    console.error('[PUT /api/agents/:agentId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    await db.delete(agents).where(eq(agents.id, agentId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/agents/:agentId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
