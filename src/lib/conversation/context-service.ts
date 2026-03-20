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

export const TOPIC_LOCK_INTERVAL = 5;

const ANTI_SYCOPHANCY_PROMPT = `CONVERSATION INTEGRITY RULES:
You must maintain your stated position unless presented with a genuinely compelling argument backed by specific evidence. Do not capitulate to social pressure or mere repetition.

Forbidden agreement phrases (do not use unless you have genuinely changed position with stated reasons):
- "great point" / "that's a great point"
- "you're absolutely right" / "you're right"
- "I completely agree" / "I agree"
- "you've convinced me" (unless you actually have been)

When disagreeing: state your specific reasons, cite evidence, and steelman your own position before engaging counterarguments. Acknowledge the other viewpoint without abandoning your own. If you genuinely change your position, state explicitly what argument or evidence convinced you.`;

// --- ContextService ---

export class ContextService {
  static WINDOW_SIZE = 20;
  static REPETITION_WINDOW = 5;
  static REPETITION_THRESHOLD = 0.85;
  static CONVERGENCE_WINDOW = 8;
  static CONVERGENCE_THRESHOLD = 0.35;
  static CONVERGENCE_MIN_TURNS = 6;

  static readonly AGREEMENT_PHRASES = [
    'great point',
    "that's a great point",
    "you're absolutely right",
    "you're right",
    'i completely agree',
    'i agree',
    "you've convinced me",
    'exactly right',
    'precisely',
    "i think we're aligned",
    'we agree',
  ];

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
    },
    turnCount: number = 0
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

    // Build base system prompt
    let systemPrompt = promptParts.join('\n\n');

    // Inject anti-sycophancy directive from round 2 onward (turnCount >= 1)
    const addenda: string[] = [];

    if (turnCount >= 1) {
      addenda.push(ANTI_SYCOPHANCY_PROMPT);
    }

    // Inject topic-lock reminder every TOPIC_LOCK_INTERVAL turns
    if (turnCount > 0 && turnCount % TOPIC_LOCK_INTERVAL === 0) {
      const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
      const topic = room?.topic?.trim();
      if (topic) {
        addenda.push(
          `TOPIC REMINDER: The discussion topic is "${topic}". Relate your response directly back to this topic.`
        );
      }
    }

    if (addenda.length > 0) {
      systemPrompt = systemPrompt + '\n\n' + addenda.join('\n\n');
    }

    // Query last WINDOW_SIZE messages ordered by createdAt DESC, then reverse
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(ContextService.WINDOW_SIZE);

    // Reverse to chronological order
    rows.reverse();

    // Filter out empty messages (from previous failed turns) that poison context
    const validRows = rows.filter((row) => row.content.trim().length > 0);

    // Map roles: current agent -> assistant, everyone else -> user
    const mappedMessages = validRows.map((row) => ({
      role: row.roomAgentId === agent.id ? ('assistant' as const) : ('user' as const),
      content: row.content,
    }));

    // LLM APIs (especially Anthropic) require messages to start with user role.
    // Seed with room topic when history is empty OR starts with assistant role.
    if (mappedMessages.length === 0 || mappedMessages[0].role === 'assistant') {
      const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
      const topic = room?.topic?.trim();
      mappedMessages.unshift({
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

  /**
   * Detect if agents in a room have reached genuine consensus (convergence).
   * Returns true only when BOTH conditions are met:
   * 1. An agreement phrase appears in the last CONVERGENCE_WINDOW messages
   * 2. Cross-agent Jaccard similarity >= CONVERGENCE_THRESHOLD for at least one pair
   * Also requires turnCount >= CONVERGENCE_MIN_TURNS - 1 to avoid false positives.
   */
  static async detectConvergence(
    db: DrizzleDB,
    roomId: string,
    turnCount: number,
  ): Promise<boolean> {
    // Guard: never fire before minimum turns (turnCount is 0-based; turn 6 = index 5)
    if (turnCount < ContextService.CONVERGENCE_MIN_TURNS - 1) return false;

    const rows = await db
      .select({ content: messages.content, roomAgentId: messages.roomAgentId })
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(ContextService.CONVERGENCE_WINDOW);

    if (rows.length < 2) return false;

    // Need at least 2 distinct agents for cross-agent convergence
    const agentIds = new Set(rows.map((r) => r.roomAgentId).filter(Boolean));
    if (agentIds.size < 2) return false;

    // Check for agreement phrase in any message in window
    const anyPhraseMatch = rows.some((row) => {
      const lower = row.content.toLowerCase();
      return ContextService.AGREEMENT_PHRASES.some((phrase) => lower.includes(phrase));
    });
    if (!anyPhraseMatch) return false;

    // Check cross-agent Jaccard similarity
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[i].roomAgentId === rows[j].roomAgentId) continue;
        const sim = jaccardSimilarity(tokenSet(rows[i].content), tokenSet(rows[j].content));
        if (sim >= ContextService.CONVERGENCE_THRESHOLD) {
          return true;
        }
      }
    }

    return false;
  }
}
