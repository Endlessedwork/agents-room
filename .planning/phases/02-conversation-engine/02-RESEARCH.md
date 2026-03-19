# Phase 2: Conversation Engine - Research

**Researched:** 2026-03-20
**Domain:** Autonomous agent turn loop, AbortController for in-flight LLM cancellation, sliding-window context assembly, repetition/loop detection, message persistence with token counts
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGNT-04 | User can set a configurable turn limit per conversation session | `turnLimit` column on `rooms` table (new schema column); ConversationManager enforces counter against limit |
| AGNT-05 | User can configure speaker selection strategy per room (round-robin or LLM-selected) | `speakerStrategy` column on `rooms` table; SpeakerSelector service returns next `roomAgentId` |
| CONV-01 | Agents converse autonomously once a topic is given, taking sequential turns | ConversationManager async turn loop: fetch context → call `streamLLM` → persist → advance turn |
| CONV-02 | User can start, pause, and stop a conversation at any time; stop cancels in-flight LLM call | `rooms.status` enum already has `idle/running/paused`; `AbortController` per active turn; `controller.abort()` on Stop command |
| CONV-03 | Context window is managed via sliding window to prevent token cost explosion | ContextService slices last N messages; no native AI SDK equivalent for multi-agent conversation history |
| CONV-04 | System detects when agents are repeating themselves and auto-pauses with a warning | AI SDK exports `cosineSimilarity(vector1, vector2)`; cosine comparison on last 5 message embeddings (or simple string-jaccard) |
| CONV-05 | All messages are persisted with sender, timestamp, model used, and token count across server restarts | `messages` table already has `model`, `input_tokens`, `output_tokens`, `created_at`; `onFinish` callback provides `usage.inputTokens` / `usage.outputTokens` |
</phase_requirements>

---

## Summary

Phase 2 builds the autonomous conversation loop on top of the Phase 1 foundation. Three services do the work: (1) **ConversationManager** — owns the `while (turn < limit)` loop, the `running/paused/idle` state machine, and the `AbortController` lifecycle for in-flight LLM cancellation; (2) **ContextService** — assembles the sliding-window message list sent to each agent; (3) **SpeakerSelector** — decides which agent goes next (round-robin or LLM-selected). No new npm packages are required — everything is already in the installed stack.

The hardest engineering problem in this phase is the Stop command. Stopping must cancel an actively-streaming `streamLLM` call, not merely prevent the next one from starting. The solution is standard Web API: create an `AbortController` per active turn, store its reference in memory, and call `controller.abort()` when the user issues Stop. The AI SDK's `streamText` function already accepts `abortSignal` (confirmed in `gateway.ts` from Phase 1) and will throw an `AbortError` that the loop catches and handles cleanly. This was flagged as a concern in STATE.md but is fully resolved — no custom cancellation mechanism is needed.

The second major area is context assembly. A naive approach would append all messages to every LLM call — token cost grows O(n) with conversation length. The ContextService fixes this with a simple slice: keep the system prompt (always) plus the last N messages (sliding window, default 20). There is no AI SDK utility that does this for multi-agent scenarios — it must be written. The `cosineSimilarity` function from `ai` package is useful for repetition detection but requires text embeddings; a simpler fallback is Jaccard similarity on token sets, which requires no embeddings.

**Primary recommendation:** Build ConversationManager first with a hardwired CLI test script (`npx tsx scripts/test-conversation.ts`). Wire ContextService and SpeakerSelector as injected dependencies. All three services are pure TypeScript modules — no Next.js-specific patterns required. REST endpoints wrap them as thin controllers.

---

## Standard Stack

No new packages are needed. All required capabilities exist in the installed stack.

### Core (already installed)

| Library | Version | Purpose | Relevant API |
|---------|---------|---------|--------------|
| `ai` | 6.0.116 | `streamText` with `abortSignal` for cancellable LLM calls; `cosineSimilarity` for vector comparison; `LanguageModelUsage` type for token counts | `streamText({ abortSignal })`, `result.usage` (Promise), `result.onFinish`, `cosineSimilarity(v1, v2)` |
| `drizzle-orm` | 0.45.1 | Insert messages with token counts; update room status; query sliding window | `db.insert(messages)`, `db.update(rooms).set({ status })`, `db.select().from(messages).orderBy(desc).limit(N)` |
| `better-sqlite3` | 12.8.0 | Synchronous SQLite — messages persist immediately, survive server restart | Already configured with WAL + foreign_keys ON |
| `next` | 16.2.0 | Route Handlers for start/pause/stop REST endpoints; no SSE yet (Phase 3) | POST `/api/rooms/[roomId]/conversation/start`, `/pause`, `/stop` |
| `zod` | 4.3.6 | Validate request bodies for conversation control endpoints | New schemas for `startConversationSchema`, `turnLimitSchema` |
| `nanoid` | 5.x | Message IDs | Already used |

### Schema Changes Required

Two new columns on the `rooms` table (migration needed):

```typescript
// Additional columns for rooms table (schema.ts addition)
turnLimit: integer('turn_limit').notNull().default(20),
speakerStrategy: text('speaker_strategy', {
  enum: ['round-robin', 'llm-selected']
}).notNull().default('round-robin'),
```

No other schema changes. The `messages` table already has `model`, `inputTokens`, `outputTokens`, `roomAgentId`, `createdAt` — exactly what CONV-05 requires.

### Installation

```bash
# No new packages — all required libraries already installed
# Verify versions match package.json
npm ls ai drizzle-orm better-sqlite3
```

---

## Architecture Patterns

### Recommended Project Structure (additions for Phase 2)

```
src/
├── app/
│   └── api/
│       └── rooms/
│           └── [roomId]/
│               └── conversation/
│                   ├── start/route.ts     # POST — start turn loop
│                   ├── pause/route.ts     # POST — pause after current turn
│                   └── stop/route.ts      # POST — abort in-flight + stop
├── lib/
│   └── conversation/
│       ├── manager.ts          # ConversationManager — turn loop + state machine
│       ├── context-service.ts  # ContextService — sliding window assembly
│       └── speaker-selector.ts # SpeakerSelector — round-robin + LLM-selected
└── scripts/
    └── test-conversation.ts    # CLI smoke test — verifiable without UI
```

### Pattern 1: ConversationManager — Turn Loop with Abort

**What:** A class that owns the conversation lifecycle. Each `run()` call drives the turn loop. An `AbortController` is created per active turn so Stop can cancel mid-stream.

**When to use:** This is the central coordination point. All other services are injected as dependencies.

```typescript
// src/lib/conversation/manager.ts
// Source: Web API AbortController + AI SDK v6 abortSignal parameter (verified in gateway.ts)

import { db } from '@/db';
import { rooms, roomAgents, messages } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { streamLLM } from '@/lib/llm/gateway';
import { ContextService } from './context-service';
import { SpeakerSelector } from './speaker-selector';

// In-memory registry of active abort controllers (per room)
// Server restarts clear this, which is correct — a restart kills the stream
const activeControllers = new Map<string, AbortController>();

export class ConversationManager {
  static async start(roomId: string): Promise<void> {
    // Prevent double-start
    if (activeControllers.has(roomId)) return;

    // Load room config
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
    if (!room) throw new Error(`Room ${roomId} not found`);

    // Set status = running
    await db.update(rooms).set({ status: 'running' }).where(eq(rooms.id, roomId));

    // Load room agents ordered by position
    const agents = await db.query.roomAgents.findMany({
      where: eq(roomAgents.roomId, roomId),
      orderBy: (ra, { asc }) => [asc(ra.position)],
    });
    if (agents.length === 0) throw new Error('No agents in room');

    const selector = new SpeakerSelector(agents, room.speakerStrategy);
    let turnCount = 0;
    const turnLimit = room.turnLimit;

    // Run the loop (fire-and-forget — caller doesn't await the full loop)
    (async () => {
      while (turnCount < turnLimit) {
        // Check paused/stopped state
        const current = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
        if (!current || current.status !== 'running') break;

        const agent = await selector.next(roomId);
        const context = await ContextService.buildContext(roomId, agent);

        // Create abort controller for THIS turn
        const controller = new AbortController();
        activeControllers.set(roomId, controller);

        let fullText = '';
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        try {
          const result = streamLLM({
            provider: agent.provider as any,
            model: agent.model,
            config: await getProviderConfig(agent.provider),
            system: context.systemPrompt,
            messages: context.messages,
            temperature: agent.temperature,
            abortSignal: controller.signal,
          });

          // Consume stream (Phase 3 will also pipe this to SSE)
          for await (const chunk of result.textStream) {
            fullText += chunk;
          }

          // Token usage available after stream completes
          const usage = await result.usage;
          inputTokens = usage.inputTokens ?? undefined;
          outputTokens = usage.outputTokens ?? undefined;

        } catch (err: any) {
          if (err.name === 'AbortError') break;  // Stop command issued
          // Other errors: persist a system error message, then stop
          await persistSystemMessage(roomId, `[Error: ${err.message}]`);
          break;
        } finally {
          activeControllers.delete(roomId);
        }

        // Persist message
        await db.insert(messages).values({
          id: nanoid(),
          roomId,
          roomAgentId: agent.id,
          role: 'agent',
          content: fullText,
          model: agent.model,
          inputTokens: inputTokens ?? null,
          outputTokens: outputTokens ?? null,
        });

        // Update room activity
        await db.update(rooms)
          .set({ lastActivityAt: new Date() })
          .where(eq(rooms.id, roomId));

        // Check for repetition after persisting
        const isRepetitive = await ContextService.detectRepetition(roomId);
        if (isRepetitive) {
          await db.update(rooms).set({ status: 'paused' }).where(eq(rooms.id, roomId));
          await persistSystemMessage(roomId, '[Auto-paused: agents are repeating themselves]');
          break;
        }

        turnCount++;
      }

      // Loop ended — set status to idle if still running
      const final = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
      if (final?.status === 'running') {
        await db.update(rooms).set({ status: 'idle' }).where(eq(rooms.id, roomId));
      }
    })();
  }

  static async pause(roomId: string): Promise<void> {
    await db.update(rooms).set({ status: 'paused' }).where(eq(rooms.id, roomId));
    // Current turn completes naturally; loop checks status at next iteration
  }

  static async stop(roomId: string): Promise<void> {
    await db.update(rooms).set({ status: 'idle' }).where(eq(rooms.id, roomId));
    // Abort in-flight stream
    const controller = activeControllers.get(roomId);
    if (controller) {
      controller.abort();
      activeControllers.delete(roomId);
    }
  }
}
```

### Pattern 2: ContextService — Sliding Window Assembly

**What:** Builds the `{ systemPrompt, messages }` payload for each agent turn. Retrieves last N messages from the DB (sliding window). Constructs the agent's system prompt from structured columns.

**When to use:** Called at the start of every turn before `streamLLM`.

```typescript
// src/lib/conversation/context-service.ts
// Source: Project schema (messages table) + AI SDK LLMRequest interface

import { db } from '@/db';
import { messages, roomAgents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const WINDOW_SIZE = 20; // last N messages sent as context; tune in practice
const REPETITION_WINDOW = 5; // last N messages checked for repetition
const REPETITION_THRESHOLD = 0.85; // cosine similarity threshold

export class ContextService {
  static async buildContext(
    roomId: string,
    agent: { id: string; promptRole: string; promptPersonality?: string | null; promptRules?: string | null; promptConstraints?: string | null }
  ): Promise<{ systemPrompt: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }> {
    // Build system prompt from structured fields
    const systemParts = [agent.promptRole];
    if (agent.promptPersonality) systemParts.push(agent.promptPersonality);
    if (agent.promptRules) systemParts.push(agent.promptRules);
    if (agent.promptConstraints) systemParts.push(agent.promptConstraints);
    const systemPrompt = systemParts.join('\n\n');

    // Fetch sliding window
    const recent = await db
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(WINDOW_SIZE);

    // Reverse to chronological order
    const chronological = recent.reverse();

    // Map to AI SDK message format
    // Agent messages become 'assistant', all others become 'user'
    const llmMessages = chronological.map(m => ({
      role: (m.roomAgentId === agent.id ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }));

    return { systemPrompt, messages: llmMessages };
  }

  // Repetition detection — simple Jaccard similarity on last REPETITION_WINDOW messages
  // Does not require embeddings — token overlap is a reasonable proxy for semantic repetition
  static async detectRepetition(roomId: string): Promise<boolean> {
    const recent = await db
      .select({ content: messages.content })
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(REPETITION_WINDOW);

    if (recent.length < REPETITION_WINDOW) return false;

    const texts = recent.map(m => m.content);

    // Compare last message against each of the previous ones
    const last = tokenSet(texts[0]);
    for (let i = 1; i < texts.length; i++) {
      if (jaccardSimilarity(last, tokenSet(texts[i])) >= REPETITION_THRESHOLD) return true;
    }
    return false;
  }
}

function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\s+/).filter(Boolean));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
```

**Note on cosine similarity:** The AI SDK exports `cosineSimilarity(vector1: number[], vector2: number[])` but it requires pre-computed embedding vectors. Producing embeddings for each message would require an extra LLM call per message — cost and latency prohibitive for this phase. Jaccard on word tokens is a cheaper, good-enough proxy. If the project later requires semantic loop detection, switch to embed-then-cosine.

### Pattern 3: SpeakerSelector — Round-Robin and LLM-Selected

**What:** Returns the next agent for the current turn. Round-robin uses `position` modulo agent count. LLM-selected uses a lightweight `generateLLM` call that asks "who should speak next?".

```typescript
// src/lib/conversation/speaker-selector.ts

import { generateLLM } from '@/lib/llm/gateway';
import type { ProviderName } from '@/lib/llm/providers';

type RoomAgentRow = {
  id: string;
  name: string;
  position: number;
  provider: string;
  model: string;
  temperature: number;
  promptRole: string;
};

export class SpeakerSelector {
  private agents: RoomAgentRow[];
  private strategy: 'round-robin' | 'llm-selected';
  private turnIndex = 0;

  constructor(agents: RoomAgentRow[], strategy: 'round-robin' | 'llm-selected') {
    this.agents = agents;
    this.strategy = strategy;
  }

  async next(roomId: string): Promise<RoomAgentRow> {
    if (this.strategy === 'round-robin') {
      const agent = this.agents[this.turnIndex % this.agents.length];
      this.turnIndex++;
      return agent;
    }

    // LLM-selected: ask a cheap model to pick the next speaker
    return this.llmSelectNext(roomId);
  }

  private async llmSelectNext(roomId: string): Promise<RoomAgentRow> {
    // Use the first agent's provider/model as the selector model
    // (or could use a dedicated cheap model — configurable future improvement)
    const selectorAgent = this.agents[0];
    const agentList = this.agents.map((a, i) => `${i}: ${a.name} (${a.promptRole})`).join('\n');

    try {
      const response = await generateLLM({
        provider: selectorAgent.provider as ProviderName,
        model: selectorAgent.model,
        config: await getProviderConfig(selectorAgent.provider),
        messages: [{
          role: 'user',
          content: `Given this conversation, which agent should speak next?\n\nAgents:\n${agentList}\n\nRespond with ONLY the index number (0-${this.agents.length - 1}).`,
        }],
        temperature: 0.3, // Low temperature for determinism
      });

      const index = parseInt(response.trim(), 10);
      if (!Number.isNaN(index) && index >= 0 && index < this.agents.length) {
        return this.agents[index];
      }
    } catch {
      // Fallback to round-robin on LLM selection failure
    }

    const fallback = this.agents[this.turnIndex % this.agents.length];
    this.turnIndex++;
    return fallback;
  }
}
```

### Pattern 4: REST Endpoints for Conversation Control

**What:** Three thin Route Handler endpoints that delegate to `ConversationManager`. The `start` endpoint fires the turn loop in the background (does not await the loop completion).

```typescript
// src/app/api/rooms/[roomId]/conversation/start/route.ts
// Source: Next.js Route Handlers docs (node_modules/next/dist/docs/...)

import { NextResponse } from 'next/server';
import { ConversationManager } from '@/lib/conversation/manager';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    // Does NOT await — loop runs in background
    ConversationManager.start(roomId);
    return NextResponse.json({ ok: true, status: 'running' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

```typescript
// src/app/api/rooms/[roomId]/conversation/stop/route.ts
import { NextResponse } from 'next/server';
import { ConversationManager } from '@/lib/conversation/manager';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  await ConversationManager.stop(roomId);
  return NextResponse.json({ ok: true, status: 'idle' });
}
```

### Pattern 5: CLI Smoke Test Script

**What:** A TypeScript script that starts a conversation, lets it run 2 turns, then stops it — all verifiable without UI.

```typescript
// scripts/test-conversation.ts
// Run with: npx tsx scripts/test-conversation.ts

import { ConversationManager } from '../src/lib/conversation/manager';
import { db } from '../src/db';
import { rooms, messages } from '../src/db/schema';
import { eq, count } from 'drizzle-orm';

async function main() {
  const roomId = process.argv[2];
  if (!roomId) { console.error('Usage: npx tsx scripts/test-conversation.ts <roomId>'); process.exit(1); }

  console.log(`Starting conversation in room ${roomId}...`);
  ConversationManager.start(roomId);

  // Wait for 2 messages
  await waitForMessages(roomId, 2);

  console.log('Stopping...');
  await ConversationManager.stop(roomId);

  const [{ value: msgCount }] = await db.select({ value: count(messages.id) })
    .from(messages).where(eq(messages.roomId, roomId));

  console.log(`Done. Messages persisted: ${msgCount}`);
  process.exit(0);
}

async function waitForMessages(roomId: string, target: number, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [{ value: c }] = await db.select({ value: count(messages.id) })
      .from(messages).where(eq(messages.roomId, roomId));
    if (c >= target) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Timed out waiting for messages');
}

main();
```

### Anti-Patterns to Avoid

- **Awaiting the turn loop in the route handler:** `ConversationManager.start()` must fire-and-forget — the HTTP response returns immediately with `{ status: 'running' }`. If awaited, the route handler hangs until the entire conversation finishes (possibly hours).
- **Checking abort with a flag variable:** Do not use `let stopped = false` checked in the loop. Use `AbortController`/`AbortSignal` — it propagates correctly into the `streamLLM` call and cancels the in-flight HTTP request to the LLM provider. A flag only prevents the NEXT turn; it cannot cancel an active streaming call.
- **Building full history for every turn:** Do not send all N messages to every LLM call. Always slice to `WINDOW_SIZE`. The cost of a 100-turn conversation without a window is O(100²) = 10,000 token-messages; with window=20 it is O(100×20) = 2,000 token-messages.
- **Storing AbortController in the database:** The controller is in-memory only. A server restart kills the stream naturally. Store only the room status in the database.
- **Embedding-based similarity in Phase 2:** Generating embeddings per message for cosine similarity is expensive and requires an embedding model API call. Use Jaccard similarity on word tokens for Phase 2. Flag for upgrade in Phase 4 if quality is insufficient.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-flight LLM cancellation | Custom "cancel token" passed through layers | `AbortController` + `abortSignal` in `streamLLM` | AI SDK wires the signal to the underlying HTTP fetch — it actually cancels the network request, not just the next iteration |
| Provider token counts | Parse provider-specific response headers | `result.usage` (PromiseLike) from `StreamTextResult` | SDK normalizes `inputTokens` / `outputTokens` across all providers; some return counts mid-stream, some after finish |
| Streaming normalization | Per-provider chunk parsing | `streamText` from `ai@6.x` (already in gateway.ts) | Same as Phase 1 — do not re-implement |
| Multi-agent message history format | Custom serialization | Drizzle `messages` table + select + slice | Messages table is already designed for this; sliding window is a 4-line Drizzle query |
| Speaker selection fallback | Complex retry/error logic | Round-robin fallback in SpeakerSelector | LLM-based selection can fail (API error, parse error, bad index) — always fall back to round-robin |

**Key insight:** The biggest "don't hand-roll" is the abort mechanism. Developers often implement a checked boolean flag `let shouldStop = false` and poll it between turns. This feels correct but silently fails: if the LLM call takes 30 seconds and the user hits Stop at second 5, the boolean approach waits 25 more seconds before honoring Stop. `AbortController` cancels the HTTP request immediately.

---

## Common Pitfalls

### Pitfall 1: Fire-and-Forget Loses Errors Silently

**What goes wrong:** The turn loop runs in a detached async IIFE. Unhandled promise rejections inside it are not reported to the HTTP response — they silently disappear.

**Why it happens:** `(async () => { ... })()` without `.catch()` swallows errors in Node.js environments where unhandledRejection warnings go to stderr only.

**How to avoid:** Always attach `.catch(err => console.error('[ConversationManager]', err))` to the detached IIFE. Persist a system-role error message to the room before exiting the loop on unexpected errors. Set room status to `idle` in a `finally` block.

**Warning signs:** Room stays in `running` status forever; no messages appear after starting.

### Pitfall 2: AbortError Not Caught — Loop Crashes Instead of Stops Cleanly

**What goes wrong:** When `controller.abort()` is called, `streamLLM` throws an `AbortError`. If the catch block does not check `err.name === 'AbortError'`, the error is treated as a fatal error and the room may not transition to `idle`.

**Why it happens:** Abort is implemented as a thrown error in the Web Streams API — it looks like any other error.

**How to avoid:** Always check `if (err.name === 'AbortError') { break; }` first in the catch block. Do not log abort as an error — it is an expected control flow event.

**Warning signs:** Room stays in `running` after Stop; error messages logged on every Stop command.

### Pitfall 3: Messages Table Has No `turnNumber` — Turn Limit Counted Wrong

**What goes wrong:** Counting turns by querying `messages` with `role = 'agent'` is fragile if system messages, user messages, or partial messages are also inserted.

**Why it happens:** The messages table stores all roles (`user`, `agent`, `system`). Counting all rows does not equal turns.

**How to avoid:** Maintain an explicit `turnCount` variable in the ConversationManager loop. Do NOT count from the database on each iteration — this creates an N+1 query per turn. The counter lives in the loop's local scope.

**Warning signs:** Conversation runs more or fewer turns than the configured limit.

### Pitfall 4: Context Messages Role Mapping Causes LLM Refusal

**What goes wrong:** Multi-agent conversation messages from OTHER agents are mapped to the `assistant` role when sent to the current agent's context. Some models refuse to generate if `assistant` turns don't alternate with `user` turns correctly, or if the conversation starts with `assistant`.

**Why it happens:** LLM providers enforce alternating user/assistant turn structure. In a multi-agent conversation, consecutive agent turns appear as consecutive `assistant` messages — which many models reject.

**How to avoid:** Map all other agents' messages as `user` role. Map the current agent's own previous messages as `assistant`. This ensures the current agent sees a syntactically valid history. Add a `user` "seed message" with the room topic if the conversation history starts with no user messages.

**Warning signs:** First LLM call fails with "Invalid messages" or similar role-validation error.

### Pitfall 5: SpeakerSelector State Resets on Server Restart

**What goes wrong:** `SpeakerSelector` is instantiated per `start()` call and holds `turnIndex` in memory. If the server restarts mid-conversation, a new `start()` call creates a fresh selector with `turnIndex = 0`, resetting round-robin order.

**Why it happens:** The turn index is not persisted to the database.

**How to avoid:** For Phase 2 this is acceptable — server restart means conversation restart. Document this as a known limitation. To fix in a future phase: persist `currentTurnIndex` on the `rooms` table or compute it by counting existing agent messages.

**Warning signs:** After server restart and resume, first speaker is always Agent 0 regardless of where the conversation left off.

### Pitfall 6: Token Count is `undefined` for Some Providers

**What goes wrong:** `result.usage.inputTokens` and `outputTokens` are typed as `number | undefined`. Some providers (especially Ollama, some OpenRouter models) do not return token counts. Inserting `undefined` into `integer` columns without null handling throws a Drizzle constraint error.

**Why it happens:** The AI SDK normalizes usage shape but cannot manufacture counts providers don't report.

**How to avoid:** Always coerce to `null` before inserting: `inputTokens: usage.inputTokens ?? null`. The `messages` schema already allows nulls for these columns.

**Warning signs:** Message insertion fails with type error on Ollama or certain OpenRouter models.

---

## Code Examples

Verified patterns from installed libraries:

### AbortController Usage with streamLLM
```typescript
// Source: gateway.ts (Phase 1) + AI SDK v6 index.d.ts (abortSignal parameter verified)
const controller = new AbortController();

const result = streamLLM({
  provider: 'anthropic',
  model: 'claude-3-haiku-20240307',
  config: { apiKey: 'sk-...' },
  system: 'You are a Devil\'s Advocate.',
  messages: [{ role: 'user', content: 'Discuss AI safety.' }],
  temperature: 0.8,
  abortSignal: controller.signal,
});

try {
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  const usage = await result.usage;
  console.log('tokens:', usage.inputTokens, usage.outputTokens);
} catch (err: any) {
  if (err.name === 'AbortError') {
    console.log('Stream aborted — Stop command honored');
  } else {
    throw err;
  }
}

// Cancels in-flight HTTP request to Anthropic API immediately
controller.abort();
```

### Sliding Window Query
```typescript
// Source: Drizzle ORM docs + project schema (messages table)
import { db } from '@/db';
import { messages } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const WINDOW_SIZE = 20;

const recent = await db
  .select()
  .from(messages)
  .where(eq(messages.roomId, roomId))
  .orderBy(desc(messages.createdAt))
  .limit(WINDOW_SIZE);

const chronological = recent.reverse(); // restore chronological order for LLM
```

### Persist Message with Token Counts
```typescript
// Source: Project schema (messages table — inputTokens, outputTokens are nullable integers)
import { db } from '@/db';
import { messages } from '@/db/schema';
import { nanoid } from 'nanoid';

const usage = await result.usage; // LanguageModelUsage from AI SDK

await db.insert(messages).values({
  id: nanoid(),
  roomId,
  roomAgentId: agent.id,
  role: 'agent',
  content: fullText,
  model: agent.model,
  inputTokens: usage.inputTokens ?? null,   // null if provider doesn't report
  outputTokens: usage.outputTokens ?? null,
});
```

### Update Room Status
```typescript
// Source: Drizzle ORM + project schema (rooms.status enum: idle|running|paused)
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Transition: idle → running
await db.update(rooms).set({ status: 'running' }).where(eq(rooms.id, roomId));

// Transition: running → paused (after current turn finishes)
await db.update(rooms).set({ status: 'paused' }).where(eq(rooms.id, roomId));

// Transition: any → idle (stop or turn limit reached)
await db.update(rooms).set({ status: 'idle' }).where(eq(rooms.id, roomId));
```

### Schema Migration — Add Columns to rooms
```typescript
// src/db/schema.ts additions
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  // ... existing columns ...
  turnLimit: integer('turn_limit').notNull().default(20),
  speakerStrategy: text('speaker_strategy', {
    enum: ['round-robin', 'llm-selected'],
  }).notNull().default('round-robin'),
});
```

```bash
# Apply schema change
npx drizzle-kit push   # dev environment (no migration file)
# OR for explicit migration file:
npx drizzle-kit generate && npx drizzle-kit migrate
```

### Jaccard Similarity for Repetition Detection
```typescript
// Source: Project-specific implementation (no library needed)
// AI SDK's cosineSimilarity requires embedding vectors — not used here
function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\s+/).filter(t => t.length > 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// Usage: compare last 5 messages pairwise
const THRESHOLD = 0.85;
const isRepetitive = jaccardSimilarity(tokenSet(msg1), tokenSet(msg2)) >= THRESHOLD;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom cancellation token boolean | `AbortController` + `abortSignal` | Web API standard (always existed); AI SDK v6 exposes `abortSignal` in `streamText` | Cancellation propagates into the HTTP layer — stops actual network transfer |
| Token counting from response headers | `result.usage.inputTokens/outputTokens` (LanguageModelUsage) | AI SDK v6 normalization | Single interface across all providers; some providers return streaming counts, SDK buffers them |
| Cosine similarity on embeddings for repetition | Jaccard similarity on word tokens | Tradeoff: simpler, no extra API calls, good enough for Phase 2 | Avoids embedding cost; upgrade path available |
| Full conversation history per turn | Sliding window (last N messages) | Standard practice in any multi-turn chatbot | O(n) token cost instead of O(n²); critical for cost control in long conversations |

**Deprecated/outdated for this project:**
- Polling-based stop: Checking a flag at turn boundaries cannot cancel in-flight streams.
- `result.text` (awaited Promise) only: For token counts you need `result.usage`, which also resolves after stream completion. Both are on the same `StreamTextResult`.

---

## Open Questions

1. **AbortError name across Node.js versions**
   - What we know: In modern Node.js (18+) and the Web API, aborted fetches throw `DOMException` with `name === 'AbortError'`. The AI SDK wraps this consistently.
   - What's unclear: Whether older Node.js (< 18) or certain providers throw a different error shape.
   - Recommendation: Check `err.name === 'AbortError'` as primary, also check `err.code === 'ERR_ABORTED'` as fallback. This project targets Node.js 18+ (Next.js 16 requires it) — HIGH confidence `AbortError` is correct.

2. **LLM-selected speaker: which provider/model to use**
   - What we know: SpeakerSelector needs a quick `generateLLM` call to pick the next speaker. Using the room's first agent is a default but ties speaker selection to that agent's provider.
   - What's unclear: Should there be a dedicated cheap model configured for orchestration (e.g., `gpt-4o-mini` always), or reuse the first room agent?
   - Recommendation: Reuse the first room agent's provider/model for Phase 2 — this avoids new configuration. Flag as improvement: add a `selectorModel` per room in Phase 4.

3. **Conversation resume after pause**
   - What we know: Pause sets `rooms.status = 'paused'`. The loop exits on seeing non-running status.
   - What's unclear: When the user resumes, should the turn count continue from where it left off, or reset?
   - Recommendation: Resume should continue the existing turn count. The ConversationManager needs a `resume(roomId)` method that queries the existing message count to calculate remaining turns. Design the loop to accept an initial `turnCount` offset.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` — exists (Phase 1 created it) |
| Quick run command | `npx vitest run tests/conversation/ --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGNT-04 | Turn loop stops at configured limit | unit | `npx vitest run tests/conversation/manager.test.ts -t "respects turn limit"` | Wave 0 |
| AGNT-05 | Round-robin speaker selection cycles through agents by position | unit | `npx vitest run tests/conversation/speaker-selector.test.ts` | Wave 0 |
| CONV-01 | Turn loop produces messages for each agent in sequence | unit | `npx vitest run tests/conversation/manager.test.ts -t "sequential turns"` | Wave 0 |
| CONV-02 (pause) | Pause sets status=paused; current turn completes | unit | `npx vitest run tests/conversation/manager.test.ts -t "pause"` | Wave 0 |
| CONV-02 (stop) | Stop aborts in-flight stream via AbortController | unit | `npx vitest run tests/conversation/manager.test.ts -t "stop cancels"` | Wave 0 |
| CONV-03 | Context assembly limits messages to WINDOW_SIZE | unit | `npx vitest run tests/conversation/context-service.test.ts -t "sliding window"` | Wave 0 |
| CONV-04 | Repetition detection fires auto-pause when Jaccard >= threshold | unit | `npx vitest run tests/conversation/context-service.test.ts -t "detect repetition"` | Wave 0 |
| CONV-05 | Messages persisted with sender, timestamp, model, token counts | unit (db) | `npx vitest run tests/db/messages.test.ts` | Wave 0 |

**Test strategy for ConversationManager:** Mock `streamLLM` and the database. The manager is pure orchestration — all its dependencies are injectable. Tests should not call real LLMs.

**Example mock pattern:**
```typescript
// tests/conversation/manager.test.ts
import { vi } from 'vitest';

vi.mock('@/lib/llm/gateway', () => ({
  streamLLM: vi.fn().mockReturnValue({
    textStream: (async function* () { yield 'mock response'; })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5, inputTokenDetails: {}, outputTokenDetails: {} }),
  }),
}));
```

### Sampling Rate

- **Per task commit:** `npx vitest run tests/conversation/ tests/db/messages.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + CLI smoke test (`npx tsx scripts/test-conversation.ts <roomId>`) with real providers before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/conversation/manager.test.ts` — covers AGNT-04, CONV-01, CONV-02
- [ ] `tests/conversation/context-service.test.ts` — covers CONV-03, CONV-04
- [ ] `tests/conversation/speaker-selector.test.ts` — covers AGNT-05
- [ ] `tests/db/messages.test.ts` — covers CONV-05 (message persistence with token counts)
- [ ] Schema migration: add `turnLimit` and `speakerStrategy` columns to rooms table
- [ ] `scripts/test-conversation.ts` — CLI smoke test for end-to-end verification

---

## Sources

### Primary (HIGH confidence)
- `/home/vsman/agents-room/node_modules/ai/dist/index.d.ts` — `StreamTextResult`, `LanguageModelUsage`, `abortSignal` parameter, `cosineSimilarity`, `onFinish` callback shape — all verified directly from installed package v6.0.116
- `/home/vsman/agents-room/src/lib/llm/gateway.ts` — Phase 1 confirmed `abortSignal` is wired through `streamLLM`; `LLMRequest` interface already has the field
- `/home/vsman/agents-room/src/db/schema.ts` — `messages` table has `model`, `inputTokens`, `outputTokens`, `roomAgentId`, `createdAt`; `rooms` table has `status` enum `idle|running|paused`
- `/home/vsman/agents-room/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — GET handlers not cached by default in Next.js 16; POST handlers never cached; `params` must be awaited
- `.planning/STATE.md` — confirmed blockers: abort mechanism, sliding window size (start at 20), loop detection threshold (0.85)

### Secondary (MEDIUM confidence)
- `.planning/phases/01-foundation/01-RESEARCH.md` — full Phase 1 architecture documentation; all patterns confirmed as built and tested
- Web platform standard: `AbortController`/`AbortSignal` — WHATWG standard, Node.js 18+ full support

### Tertiary (LOW confidence — validate during implementation)
- Jaccard similarity threshold of 0.85 for repetition detection — reasonable starting point but must be tuned empirically; identical threshold was noted in STATE.md blockers

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all capabilities verified directly in installed package type definitions
- Architecture (ConversationManager, ContextService): HIGH — patterns are direct translations of verified AI SDK APIs and existing schema
- Architecture (SpeakerSelector LLM-selected): MEDIUM — round-robin is HIGH confidence; LLM-selected fallback behavior needs empirical validation
- Pitfalls: HIGH — all pitfalls derived from TypeScript types and documented API behavior, not assumptions
- Repetition threshold (0.85 Jaccard): LOW — starting point from STATE.md; must be tuned

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days — stack is stable; ai package v6.x is active development but interfaces are stable)
