import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { rooms, messages, roomAgents } from '@/db/schema';
import { formatMarkdownExport, formatJsonExport, slugify } from '@/lib/export';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'md';
    const summaryParam = url.searchParams.get('summary') || null;

    if (format !== 'md' && format !== 'json') {
      return NextResponse.json({ error: 'format must be md or json' }, { status: 400 });
    }

    // Load room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Load agents
    const agentList = await db.query.roomAgents.findMany({
      where: eq(roomAgents.roomId, roomId),
      orderBy: [asc(roomAgents.position)],
    });

    // Load messages with agent info
    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
      orderBy: [asc(messages.createdAt)],
      with: { roomAgent: true },
    });

    // Calculate token totals
    let totalInput = 0;
    let totalOutput = 0;
    for (const m of allMessages) {
      totalInput += m.inputTokens ?? 0;
      totalOutput += m.outputTokens ?? 0;
    }

    const exportedAt = new Date().toISOString();
    const dateStr = exportedAt.slice(0, 10); // YYYY-MM-DD
    const slug = slugify(room.name);

    const data = {
      roomName: room.name,
      topic: room.topic,
      agents: agentList.map((a) => ({ name: a.name, promptRole: a.promptRole, model: a.model })),
      messages: allMessages.map((m) => ({
        role: m.role as 'user' | 'agent' | 'system',
        content: m.content,
        agentName: m.roomAgent?.name ?? null,
        promptRole: m.roomAgent?.promptRole ?? null,
        model: m.model,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        createdAt:
          m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
      })),
      tokenTotals: { input: totalInput, output: totalOutput },
      summary: summaryParam,
      exportedAt,
    };

    if (format === 'json') {
      const body = formatJsonExport(data);
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${slug}-${dateStr}.json"`,
        },
      });
    }

    const body = formatMarkdownExport(data);
    return new Response(body, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${slug}-${dateStr}.md"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/rooms/:roomId/export]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
