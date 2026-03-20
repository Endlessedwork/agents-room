import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { emitSSE } from '@/lib/sse/stream-registry';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;

    const result = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
      with: { roomAgent: true },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/rooms/:roomId/messages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).content !== 'string' ||
      ((body as Record<string, unknown>).content as string).trim() === ''
    ) {
      return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 });
    }

    const content = ((body as Record<string, unknown>).content as string).trim();
    const id = nanoid();
    const createdAt = new Date();

    await db.insert(messages).values({
      id,
      roomId,
      roomAgentId: null,
      role: 'user',
      content,
      model: null,
      inputTokens: null,
      outputTokens: null,
      createdAt,
    });

    const inserted = { id, roomId, role: 'user' as const, content, createdAt };

    // Notify SSE clients of the new user message
    emitSSE(roomId, 'user-message', { id, content, createdAt });

    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    console.error('[POST /api/rooms/:roomId/messages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
