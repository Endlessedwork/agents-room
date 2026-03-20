import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { messages, roomAgents, providerKeys } from '@/db/schema';
import { generateLLM } from '@/lib/llm/gateway';
import type { ProviderName } from '@/lib/llm/providers';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;

    // 1. Load all messages for this room
    const allMessages = await db.query.messages.findMany({
      where: eq(messages.roomId, roomId),
      orderBy: [asc(messages.createdAt)],
      with: { roomAgent: true },
    });

    if (allMessages.length === 0) {
      return NextResponse.json({ error: 'No messages to summarize' }, { status: 400 });
    }

    // 2. Get first room agent for provider/model
    const firstAgent = await db.query.roomAgents.findFirst({
      where: eq(roomAgents.roomId, roomId),
      orderBy: [asc(roomAgents.position)],
    });

    if (!firstAgent) {
      return NextResponse.json({ error: 'No agents in room' }, { status: 400 });
    }

    // 3. Get provider API key
    const providerKey = await db.query.providerKeys.findFirst({
      where: eq(providerKeys.provider, firstAgent.provider),
    });

    // 4. Build transcript for summarization
    const transcript = allMessages.map(m => {
      const sender = m.role === 'user' ? 'User' : (m.roomAgent?.name ?? 'System');
      return `${sender}: ${m.content}`;
    }).join('\n\n');

    // 5. Call generateLLM with summary prompt
    const summary = await generateLLM({
      provider: firstAgent.provider as ProviderName,
      model: firstAgent.model,
      config: {
        apiKey: providerKey?.apiKey ?? undefined,
        baseUrl: providerKey?.baseUrl ?? undefined,
      },
      system: 'You are a conversation summarizer. Produce a clear, concise summary of the following multi-agent conversation. Highlight key points of agreement, disagreement, and any conclusions reached. Keep the summary under 300 words.',
      messages: [{ role: 'user', content: transcript }],
      temperature: 0.3,
    });

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[POST /api/rooms/:roomId/summary]', err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
