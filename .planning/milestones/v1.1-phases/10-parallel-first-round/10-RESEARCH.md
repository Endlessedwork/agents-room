# Phase 10: Parallel First Round - Research

**Researched:** 2026-03-21
**Domain:** Conversation engine extension, DB schema migration, SSE event protocol, Zustand store state machine
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARA-01 | User can enable parallel first round per room (config toggle) | Requires new `parallelFirstRound` boolean column on `rooms` table; toggle surfaced in `RoomWizard` (creation) and `EditRoomDialog` (post-creation); persisted via existing PATCH `/api/rooms/:roomId` and POST `/api/rooms` endpoints after schema + validation update |
| PARA-02 | All agents respond independently in round 1 without seeing peers | Requires a new parallel-execution branch in `ConversationManager.start()` that fires all agent LLM calls concurrently (via `Promise.allSettled` on individual turn coroutines) before any message is persisted to DB; context for each agent is built before any sibling's message lands, so `ContextService.buildContext` naturally sees no peers |
| PARA-03 | Round 1 responses display in correct order after all complete | Buffer all completed parallel turns in memory, then persist to DB in agent `position` order and emit SSE events in the same order; client receives normal `turn:start` / `token` / `turn:end` sequence per agent, just delayed until the full parallel round finishes |
</phase_requirements>

---

## Summary

Phase 10 introduces a "parallel first round" mode where all agents independently generate their
opening response before any peer's message is committed to the database. This prevents anchoring —
agents seeing the first responder's framing and converging prematurely. The feature is toggled per
room and must persist across sessions.

The implementation spans three layers. The data layer needs one new boolean column
(`parallel_first_round`) on the `rooms` table with a corresponding `createTestDb` update in tests.
The server layer needs a new code path at the top of `ConversationManager.start()`: when
`room.parallelFirstRound` is true and `turnCount === 0`, all agents are called concurrently via
`Promise.allSettled`. Each agent's LLM call builds context before any sibling result is persisted,
ensuring true independence. Results are buffered in memory, then persisted and SSE-emitted in agent
position order after all complete. The UI layer needs: a checkbox toggle in `RoomWizard` and
`EditRoomDialog`; a distinct "Agents forming independent views..." indicator in `MessageFeed` during
the parallel round (replacing per-agent `ThinkingBubble`); and a new SSE event (`parallel:start` /
`parallel:end`) to drive this indicator in `chatStore`.

The REQUIREMENTS.md explicitly rules out streaming the parallel round — buffer-then-display is the
mandated approach. If the conversation is stopped mid-parallel-round, all buffered but un-persisted
results must be discarded; no orphaned messages appear in the DB.

**Primary recommendation:** Add `parallelFirstRound` boolean to `rooms` schema, add a
`runParallelRound()` private helper in `ConversationManager`, emit `parallel:start` / `parallel:end`
SSE events to drive a distinct UI indicator, then fall through to the existing sequential loop for
turns 2+.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm/better-sqlite3 | already installed | schema column addition | same as every other schema change in this project |
| nanoid | already installed | message ID generation for buffered results | same as rest of manager |
| vitest | already installed | unit + integration tests | project-standard test runner |

### No new production dependencies required

All needed primitives are `Promise.allSettled` (native) and the existing `streamLLM` / `emitSSE` /
`ContextService.buildContext` stack.

---

## Architecture Patterns

### Recommended Project Structure additions

```
src/
├── db/
│   └── schema.ts              # ADD: parallelFirstRound boolean column
├── lib/
│   └── conversation/
│       └── manager.ts         # ADD: runParallelRound() helper, branch in start()
├── lib/
│   └── validations.ts         # ADD: parallelFirstRound to create/updateRoomSchema
├── components/
│   └── rooms/
│       ├── EditRoomDialog.tsx  # ADD: checkbox toggle for parallelFirstRound
│       ├── RoomWizard.tsx      # ADD: checkbox toggle in step 1
│       └── MessageFeed.tsx     # ADD: ParallelThinkingBanner branch
├── stores/
│   └── chatStore.ts           # ADD: parallelRound state + actions
└── hooks/
    └── useRoomStream.ts        # ADD: parallel:start / parallel:end handlers
tests/
└── setup.ts                   # UPDATE: add parallel_first_round column to DDL
```

### Pattern 1: Schema column addition (no migration files)

**What:** This project has no migration files — `createTestDb()` in `tests/setup.ts` uses raw
`sqlite.exec()` DDL, and the production DB file is at `data/agents-room.db`. The `src/db/migrations/`
directory does not exist yet (drizzle-kit would create it on `drizzle-kit generate`).

**How schema changes work in this project:**

1. Add the column to `src/db/schema.ts`
2. Add the column to the raw DDL in `tests/setup.ts` (or tests break with "no such column")
3. For the production DB, run `ALTER TABLE rooms ADD COLUMN parallel_first_round INTEGER NOT NULL DEFAULT 0` once, or wipe and re-seed

**Schema addition:**
```typescript
// src/db/schema.ts — rooms table, add after speakerStrategy
parallelFirstRound: integer('parallel_first_round', { mode: 'boolean' })
  .notNull()
  .default(false),
```

**Test DDL addition (tests/setup.ts):**
```sql
-- Inside the CREATE TABLE rooms block in createTestDb()
parallel_first_round INTEGER NOT NULL DEFAULT 0
```

Both must be updated together or tests will fail with "no such column" errors.

### Pattern 2: Parallel round execution in ConversationManager

**What:** A separate async helper fires all agents concurrently. Each agent builds its own context
before any result is persisted, so isolation is guaranteed by the ordering of async operations, not
by any filtering logic.

**When to use:** When `room.parallelFirstRound === true` and `turnCount === 0`.

**Key structure:**
```typescript
// Conceptual pseudocode — exact implementation is a planner task
async function runParallelRound(roomId, agents, db, abortController) {
  // Step 1: announce start
  emitSSE(roomId, 'parallel:start', { agentCount: agents.length });

  // Step 2: build ALL contexts BEFORE any LLM call
  // (DB has no round-1 messages yet — true independence guaranteed)
  const contexts = await Promise.all(
    agents.map((agent) => ContextService.buildContext(db, roomId, agent, 0))
  );

  // Step 3: run all LLM calls concurrently, capture text in memory
  const settled = await Promise.allSettled(
    agents.map((agent, i) => callAgent(agent, contexts[i], abortController))
  );

  // Step 4: if aborted, discard everything — no DB writes
  if (abortController.signal.aborted) {
    emitSSE(roomId, 'parallel:cancel', {});
    return { succeeded: false };
  }

  // Step 5: persist in agent position order, emit turn SSE for each
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === 'fulfilled' && outcome.value.text.trim().length > 0) {
      // db.insert(messages, ...) then emitSSE turn:start, tokens, turn:end
    }
  }

  // Step 6: signal completion
  emitSSE(roomId, 'parallel:end', {});
  return { succeeded: true };
}
```

**Key invariant:** Contexts are built with a single `Promise.all` call BEFORE any `db.insert` for
round 1 messages. This is the structural guarantee of independence — no DB reads happen during the
LLM calls that would reveal a sibling's response.

### Pattern 3: New SSE events for parallel mode UI

**What:** Two new events bracket the parallel round. The client switches its indicator based on them.

| Event | Payload | Client action |
|-------|---------|---------------|
| `parallel:start` | `{ agentCount: number }` | Show "Agents forming independent views..." banner |
| `parallel:end` | `{}` | Clear banner; messages already in feed from turn:end events |
| `parallel:cancel` | `{}` | Clear banner; no messages added |

**Why not reuse `status`:** The existing `status` event drives coarse room state (running/paused/idle).
The parallel indicator is a transient intra-round UI state orthogonal to room status.

### Pattern 4: chatStore parallel state

**What:** Minimal new state in `chatStore` to drive the indicator.

```typescript
// New fields in ChatStore interface
parallelRound: { active: boolean; agentCount: number } | null;

// New actions
startParallelRound: (agentCount: number) => void;
endParallelRound: () => void;
```

`MessageFeed` reads `parallelRound` and renders a banner when it is non-null. After `parallel:end`,
the banner disappears and the normally-emitted `turn:start` / `token` / `turn:end` sequences
populate the feed.

### Pattern 5: UI toggle (mirrors existing controls)

**What:** A boolean checkbox in `RoomWizard` step 1 and `EditRoomDialog`, following the same pattern
as `speakerStrategy` — local state, sent in the POST/PATCH body, Zod validation.

```typescript
// RoomWizard local state addition
const [parallelFirstRound, setParallelFirstRound] = useState(false);

// JSX pattern consistent with other settings controls
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="parallel-first-round"
    checked={parallelFirstRound}
    onChange={(e) => setParallelFirstRound(e.target.checked)}
    className="w-4 h-4 rounded border-border"
  />
  <label htmlFor="parallel-first-round" className="text-sm font-medium">
    Parallel first round
  </label>
</div>
<p className="text-xs text-muted-foreground mt-1">
  All agents independently form their initial response before seeing each other.
</p>
```

### Anti-Patterns to Avoid

- **Filtering parallel messages from context during round 1:** Do not filter sibling messages out of
  context reads — instead, build all contexts before any message is persisted. Filtering is fragile
  and has race conditions.
- **Streaming each parallel agent's tokens live:** REQUIREMENTS.md explicitly rules this out. Buffer
  all parallel results in memory, emit only after all agents complete.
- **Using `Promise.all` (fail-fast) instead of `Promise.allSettled`:** One agent failing would abort
  the entire parallel round. Use `Promise.allSettled` so other agents' results are preserved.
- **Persisting partial results on abort:** If `stop()` is called mid-parallel-round, the abort
  signal fires. The handler must check `abortController.signal.aborted` after `Promise.allSettled`
  and return without persisting anything. This is the "no orphaned partial messages" guarantee.
- **Forgetting to update `tests/setup.ts`:** The in-memory test DB is built with raw DDL. Every new
  column in schema.ts must also be added to the `sqlite.exec` block in `createTestDb()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent LLM calls | Custom concurrency manager | `Promise.allSettled` (native) | Handles partial failures; no library needed |
| Abort propagation | Custom abort tracking | Existing `AbortController` pattern from manager | Already proven in stop() flow |
| UI toggle | Custom toggle component | `<input type="checkbox">` | Pattern matches how other room settings are done |

**Key insight:** The parallel round is an orchestration problem, not an infrastructure problem. The
existing `streamLLM`, `emitSSE`, `ContextService`, and `AbortController` primitives handle
everything; the only new code is the sequencing logic.

---

## Common Pitfalls

### Pitfall 1: Context isolation broken by eager persistence

**What goes wrong:** If context is built inside each agent's individual async call (after some agents
have already started executing), a fast-completing agent's message could be persisted to DB before a
slower agent's context is built — breaking independence.

**Why it happens:** Async execution is interleaved; without an explicit barrier, fast agents can
complete and be persisted before slow agents' `buildContext` runs.

**How to avoid:** Build ALL contexts with a single `Promise.all` call BEFORE launching any
`streamLLM` calls. This is the structural guarantee.

**Warning signs:** Tests where agents with mocked fast streams see each other's messages in round 1.

### Pitfall 2: Orphaned messages on mid-parallel-round stop

**What goes wrong:** User clicks Stop during the parallel round; some agents have finished streaming
but not all; partial results are committed to DB; the chat shows incomplete round 1.

**Why it happens:** `Promise.allSettled` resolves after ALL agents finish or are aborted. The caller
must check `abortController.signal.aborted` AFTER `allSettled` resolves and skip persistence.

**How to avoid:** After `Promise.allSettled`, check abort signal before any `db.insert` or
`emitSSE(turn:end)` calls.

**Warning signs:** Messages in DB with content but from a known-aborted run.

### Pitfall 3: Missing `tests/setup.ts` DDL sync

**What goes wrong:** `schema.ts` gains `parallelFirstRound` column; every test that creates a room
via `createTestDb()` fails with SQLite "no such column: parallel_first_round" at query time.

**Why it happens:** `createTestDb()` builds schema from raw SQL, not drizzle introspection.

**How to avoid:** Always update both `schema.ts` and `createTestDb()` in the same task.

**Warning signs:** Tests throw "no such column" errors unrelated to the test's focus area.

### Pitfall 4: `parallel:end` fires before turn SSE events are emitted

**What goes wrong:** UI clears the parallel banner before agent messages appear, creating a brief
flash of empty feed.

**Why it happens:** `parallel:end` emitted before the per-agent `turn:start` / `token` / `turn:end`
sequence is emitted for buffered results.

**How to avoid:** Emit all buffered turn SSE events for each agent BEFORE emitting `parallel:end`.
The ordering within a single synchronous loop guarantees this.

### Pitfall 5: ContextService double-injection concern (non-issue)

**What goes wrong (concern from STATE.md):** "ContextService double-injection edge cases" during
parallel round.

**Why it is not actually a problem:** When `buildContext` is called for each parallel agent with
`turnCount === 0`, each agent gets the user-first seed message injected (the "Begin the conversation."
sentinel or room topic). This is correct — each agent sees only the topic seed. Double-injection
would only occur if some agents saw both a seed AND another agent's message. The structural barrier
(build all contexts before persisting any) prevents this entirely.

---

## Code Examples

Verified patterns from existing codebase:

### AbortController pattern — how stop() interacts with in-flight streaming

```typescript
// Source: src/lib/conversation/manager.ts (stop method)
static async stop(roomId: string, db: DrizzleDB): Promise<void> {
  await db.update(rooms).set({ status: 'idle' }).where(eq(rooms.id, roomId));
  emitSSE(roomId, 'status', { status: 'idle' });
  const controller = activeControllers.get(roomId);
  if (controller) {
    controller.abort();
    activeControllers.delete(roomId);
  }
}
```

For the parallel round, a single controller covers all concurrent calls. When aborted, every
`streamLLM` call in the parallel batch receives the signal via `abortSignal: controller.signal`.

### emitSSE shape

```typescript
// Source: src/lib/sse/stream-registry.ts
emitSSE(roomId, 'eventName', { ...data });
// Produces: "event: eventName\ndata: {...}\n\n"
```

New events `parallel:start`, `parallel:end`, `parallel:cancel` follow this exact shape.

### chatStore streaming state — nullable pattern to follow for parallelRound

```typescript
// Source: src/stores/chatStore.ts lines 42, 83
streaming: StreamingState | null;
// null = no active turn; non-null = agent is streaming
// parallelRound follows identical nullable pattern:
parallelRound: { active: boolean; agentCount: number } | null;
```

### useRoomStream new event listener additions

```typescript
// Source pattern: src/hooks/useRoomStream.ts
es.addEventListener('parallel:start', (e) => {
  const { agentCount } = JSON.parse(e.data);
  startParallelRound(agentCount);
});
es.addEventListener('parallel:end', () => {
  endParallelRound();
});
es.addEventListener('parallel:cancel', () => {
  endParallelRound();
});
```

### MessageFeed parallel banner branch

```typescript
// Source pattern: src/components/rooms/MessageFeed.tsx — ThinkingBubble branch (lines 67-75)
// Replace ThinkingBubble with a group banner when parallelRound is active
{parallelRound && (
  <div className="w-full text-center py-3 px-4 bg-muted/50 text-muted-foreground text-sm rounded my-2 animate-pulse">
    Agents forming independent views...
  </div>
)}
```

### Validation schema additions

```typescript
// Source: src/lib/validations.ts — add parallelFirstRound to both schemas
export const createRoomSchema = z.object({
  name: z.string().min(1).max(60),
  topic: z.string().max(280).optional(),
  turnLimit: z.number().int().min(5).max(100).default(20),
  speakerStrategy: z.enum(['round-robin', 'llm-selected']).default('round-robin'),
  parallelFirstRound: z.boolean().default(false),  // NEW
});

export const updateRoomSchema = z.object({
  // ... existing fields ...
  parallelFirstRound: z.boolean().optional(),  // NEW
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential turn loop only | Sequential + optional parallel first round | Phase 10 | Round 1 responses are anchoring-free |
| Per-agent ThinkingBubble always | Group "forming views" banner during parallel | Phase 10 | UX communicates the distinct mode |
| Streaming parallel (ruled out) | Buffer-then-emit | REQUIREMENTS.md decision | Cleaner UX, no multiple simultaneous streams |

**Deprecated/outdated:**
- Streaming parallel round: explicitly rejected in REQUIREMENTS.md out-of-scope table

---

## Open Questions

1. **Should `parallelFirstRound` be editable while conversation is paused?**
   - What we know: The existing `EditRoomDialog` guard blocks editing when status is `running` OR
     `paused`. Users cannot toggle the feature mid-conversation.
   - What's unclear: Is this the desired UX?
   - Recommendation: Keep the existing guard as-is. Changing parallel mode mid-conversation would
     be confusing and is consistent with how `speakerStrategy` is handled.

2. **How does `resume()` interact with parallel mode when stopped mid-parallel-round?**
   - What we know: `ConversationManager.resume()` counts existing agent messages and calls `start()`
     with remaining turns. If stopped mid-parallel-round with 0 persisted messages (guaranteed by
     the abort-without-persist design), `turnCount` starts at 0 — which re-triggers the parallel
     round. This is correct behavior.
   - Recommendation: No special handling needed.

3. **Single-agent rooms with parallelFirstRound enabled**
   - What we know: With one agent, the "parallel" round is trivially sequential.
     `Promise.allSettled` on a single promise is fine.
   - Recommendation: No special casing — allow it. The behavior is correct and the indicator is
     harmless for single-agent rooms.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | none (vitest uses package.json scripts) |
| Quick run command | `npx vitest run tests/conversation/manager.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARA-01 | `parallelFirstRound` column persists via POST/PATCH rooms API | unit (API) | `npx vitest run tests/api/rooms.test.ts` | Partial — needs new cases |
| PARA-01 | Toggle present in schemas (createRoomSchema, updateRoomSchema) | unit | `npx vitest run tests/api/rooms.test.ts` | Wave 0 gap |
| PARA-02 | All agent contexts built before any message persisted | unit (manager) | `npx vitest run tests/conversation/manager.test.ts` | Wave 0 gap |
| PARA-02 | No sibling messages visible in any agent's round-1 context | unit (manager) | `npx vitest run tests/conversation/manager.test.ts` | Wave 0 gap |
| PARA-02 | Mid-parallel abort leaves 0 messages in DB | unit (manager) | `npx vitest run tests/conversation/manager.test.ts` | Wave 0 gap |
| PARA-03 | Messages persisted in agent position order after parallel round | unit (manager) | `npx vitest run tests/conversation/manager.test.ts` | Wave 0 gap |
| PARA-03 | `parallel:start`, `parallel:end` SSE events emitted correctly | unit (manager-sse) | `npx vitest run tests/conversation/manager-sse.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/conversation/manager.test.ts tests/conversation/manager-sse.test.ts tests/api/rooms.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/setup.ts` — add `parallel_first_round INTEGER NOT NULL DEFAULT 0` to rooms CREATE TABLE DDL
- [ ] New test cases in `tests/conversation/manager.test.ts` — covers PARA-02 context isolation, abort-without-persist, PARA-03 ordered persistence
- [ ] New test cases in `tests/conversation/manager-sse.test.ts` — covers PARA-03 SSE event sequence (parallel:start, parallel:end)
- [ ] New test cases in `tests/api/rooms.test.ts` — covers PARA-01 parallelFirstRound field in create/update

*(No new test infrastructure install needed — vitest and createTestDb already present)*

---

## Sources

### Primary (HIGH confidence)

- Direct codebase reading — `src/db/schema.ts` — full rooms table structure
- Direct codebase reading — `src/lib/conversation/manager.ts` — full turn loop, abort pattern, stop/resume
- Direct codebase reading — `src/lib/conversation/context-service.ts` — buildContext, detectRepetition, detectConvergence
- Direct codebase reading — `src/lib/sse/stream-registry.ts` — emitSSE shape and semantics
- Direct codebase reading — `src/stores/chatStore.ts` — streaming state machine, message dedup
- Direct codebase reading — `src/hooks/useRoomStream.ts` — SSE event listener pattern
- Direct codebase reading — `src/components/rooms/ChatHeader.tsx`, `EditRoomDialog.tsx`, `RoomWizard.tsx`, `MessageFeed.tsx`, `ThinkingBubble.tsx`
- Direct codebase reading — `tests/setup.ts` — createTestDb raw DDL pattern
- Direct codebase reading — `tests/conversation/manager.test.ts`, `manager-sse.test.ts` — test patterns
- Direct codebase reading — `src/lib/validations.ts` — Zod schema patterns
- Direct codebase reading — `.planning/REQUIREMENTS.md` — out-of-scope: streaming parallel, buffer-then-display mandate
- Direct codebase reading — `.planning/STATE.md` — buffer-then-emit decision, turnNumber column note, ContextService double-injection concern

### Secondary (MEDIUM confidence)

- `Promise.allSettled` semantics (standard ECMAScript 2020, no verification needed)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all primitives already in codebase
- Architecture: HIGH — derived entirely from reading existing code, not from assumptions
- Pitfalls: HIGH — two pitfalls (context isolation, orphan messages) explicitly called out in STATE.md; others derived from codebase patterns

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain, no fast-moving dependencies)
