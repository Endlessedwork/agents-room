import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { messages, rooms } from '@/db/schema';

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// --- Private helpers ---

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// --- ContextService ---

export class ContextService {
  static WINDOW_SIZE = 20;
  static REPETITION_WINDOW = 5;
  static REPETITION_THRESHOLD = 0.85;

  /**
   * Build LLM context for an agent's next turn.
   * Returns the system prompt and the sliding window of recent messages
   * with roles mapped relative to the current agent (assistant = self, user = others).
   */
  static async buildContext(
    db: DrizzleDB,
    roomId: string,
    agent: {
      id: string;
      promptRole: string;
      promptPersonality?: string | null;
      promptRules?: string | null;
      promptConstraints?: string | null;
    }
  ): Promise<{
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }> {
    // Build system prompt from non-null fields joined with double newline
    const promptParts = [
      agent.promptRole,
      agent.promptPersonality,
      agent.promptRules,
      agent.promptConstraints,
    ].filter((p): p is string => p != null && p.length > 0);
    const systemPrompt = promptParts.join('\n\n');

    // Query last WINDOW_SIZE messages ordered by createdAt DESC, then reverse
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(ContextService.WINDOW_SIZE);

    // Reverse to chronological order
    rows.reverse();

    // Map roles: current agent -> assistant, everyone else -> user
    const mappedMessages = rows.map((row) => ({
      role: row.roomAgentId === agent.id ? ('assistant' as const) : ('user' as const),
      content: row.content,
    }));

    // LLM APIs require at least one user message. When conversation history is
    // empty, seed with the room topic so the first agent has something to respond to.
    if (mappedMessages.length === 0) {
      const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
      const topic = room?.topic?.trim();
      mappedMessages.push({
        role: 'user' as const,
        content: topic
          ? `Discussion topic: ${topic}`
          : 'Begin the conversation.',
      });
    }

    return { systemPrompt, messages: mappedMessages };
  }

  /**
   * Detect if the conversation has entered a repetitive loop.
   * Returns true if the last message has Jaccard similarity >= REPETITION_THRESHOLD
   * with any of the previous REPETITION_WINDOW - 1 messages.
   * Returns false if fewer than REPETITION_WINDOW messages exist.
   */
  static async detectRepetition(db: DrizzleDB, roomId: string): Promise<boolean> {
    const rows = await db
      .select({ content: messages.content })
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(ContextService.REPETITION_WINDOW);

    if (rows.length < ContextService.REPETITION_WINDOW) {
      return false;
    }

    // rows[0] is the latest message (DESC order), rows[1..4] are the previous ones
    const lastTokens = tokenSet(rows[0].content);
    for (let i = 1; i < rows.length; i++) {
      const prevTokens = tokenSet(rows[i].content);
      if (jaccardSimilarity(lastTokens, prevTokens) >= ContextService.REPETITION_THRESHOLD) {
        return true;
      }
    }

    return false;
  }
}
