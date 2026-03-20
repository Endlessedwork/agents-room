# Phase 9: Convergence Detection - Research

**Researched:** 2026-03-21
**Domain:** Conversation loop control, similarity detection, server-side auto-pause
**Confidence:** HIGH

---

## Summary

Phase 9 adds a second auto-pause trigger alongside the existing repetition detector. The current
system already pauses when Jaccard similarity >= 0.85 across a window of 5 messages — that catches
_verbatim repetition_. Convergence detection is a weaker, earlier signal: agents have reached genuine
agreement (not just copied each other). REQUIREMENTS.md explicitly rules out LLM-as-judge and
semantic embeddings. The chosen approach is AND logic: agreement phrases detected in recent messages
AND Jaccard similarity >= 0.35 across cross-agent pairs. The minimum turn guard (< 6 turns = never
fire) prevents false positives on early pleasantries.

The implementation is entirely server-side in `ContextService` (a new static method alongside
`detectRepetition`). `ConversationManager` calls it after each turn, exactly as it does for
repetition. The system message persisted and emitted via SSE uses a different, informative string —
"[Auto-paused: agents reached consensus]" — which already renders correctly in `MessageBubble`
because all system messages are handled generically. No schema changes, no new dependencies, no UI
component work required.

**Primary recommendation:** Add `ContextService.detectConvergence(db, roomId, turnCount)` modelled
directly on `detectRepetition`, call it from `ConversationManager` after the existing repetition
check, and use the locked parameter values from STATE.md.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | System detects consensus via cross-agent similarity + agreement phrases | New `detectConvergence` static method: Jaccard >= 0.35 AND phrase match across recent cross-agent pairs; both conditions required (AND logic) |
| CONV-02 | Auto-pause triggers only after minimum 6 turns | Guard `if (turnCount < 6) return false` as first check in `detectConvergence`; `turnCount` is already threaded from `ConversationManager` |
| CONV-03 | System message explains why conversation was paused | Persist `'[Auto-paused: agents reached consensus]'` + `emitSSE(roomId, 'system', ...)` — identical flow to repetition auto-pause, renders via existing `MessageBubble` system style |
</phase_requirements>

---

## Standard Stack

### Core (no additions needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm/better-sqlite3 | already installed | DB reads for convergence window | already used by `detectRepetition` |
| nanoid | already installed | message ID generation | already used in manager |

No new production dependencies. The `tokenSet` and `jaccardSimilarity` helpers already exist in
`context-service.ts` — they are private helpers, but since `detectConvergence` lives in the same
file they are directly callable without any refactoring.

### No New Dependencies

REQUIREMENTS.md out-of-scope table explicitly rules out:
- LLM-as-judge (doubles API cost)
- Semantic embeddings (requires extra model or API call)

The existing Jaccard implementation plus a hard-coded phrase list is the entire implementation
surface.

---

## Architecture Patterns

### Where the Logic Lives

```
src/lib/conversation/
├── context-service.ts    <-- ADD detectConvergence() here
├── manager.ts            <-- CALL detectConvergence() after existing detectRepetition check
├── speaker-selector.ts   (unchanged)
```

### Pattern: Extend ContextService, not ConversationManager

`ContextService` already owns the Jaccard and token-set helpers. `ConversationManager` is a thin
orchestrator that delegates similarity decisions to `ContextService`. Follow the same boundary for
convergence: manager calls, service decides.

### Algorithm Design (from STATE.md locked decisions)

**Trigger condition (AND):**
1. Agreement phrase found in at least one of the last N cross-agent message pairs
2. Jaccard similarity >= 0.35 between at least one recent cross-agent pair

**Parameters (locked in STATE.md):**
- Jaccard threshold: **0.35** (not 0.85 — convergence is softer than repetition)
- Minimum turns before firing: **6**
- Pause (not stop): `status = 'paused'`, loop exits on next iteration check

**Phrase list (to implement):**
Agreement phrases already enumerated in the `ANTI_SYCOPHANCY_PROMPT` constant make a natural seed
list:
```
"great point", "that's a great point"
"you're absolutely right", "you're right"
"i completely agree", "i agree"
"you've convinced me"
"exactly", "precisely"
"i think we're aligned", "we agree"
```
These should be checked case-insensitively against message content.

**Cross-agent pairing:**
Convergence only fires when different agents agree — not when an agent echoes itself. The check
should compare messages from different `roomAgentId` values. Fetch the last `CONVERGENCE_WINDOW`
messages with their `roomAgentId`, pair messages from distinct agents, evaluate Jaccard on each pair.

### Recommended Static Method Signature

```typescript
// Source: derived from existing detectRepetition pattern in context-service.ts
static async detectConvergence(
  db: DrizzleDB,
  roomId: string,
  turnCount: number
): Promise<boolean>
```

`turnCount` is already available in `ConversationManager` — the same value passed to
`buildContext`. No new state threading required.

### ConversationManager Call Site (after repetition check)

```typescript
// After existing detectRepetition block in manager.ts
const hasConverged = await ContextService.detectConvergence(db, roomId, turnCount);
if (hasConverged) {
  await db.update(rooms).set({ status: 'paused' }).where(eq(rooms.id, roomId));
  emitSSE(roomId, 'status', { status: 'paused' });
  await db.insert(messages).values({
    id: nanoid(),
    roomId,
    roomAgentId: null,
    role: 'system',
    content: '[Auto-paused: agents reached consensus]',
    model: null,
    inputTokens: null,
    outputTokens: null,
  });
  emitSSE(roomId, 'system', { content: '[Auto-paused: agents reached consensus]' });
  break;
}
```

This is a verbatim copy of the repetition block with two strings changed. No structural divergence.

### Anti-Patterns to Avoid

- **Sharing CONVERGENCE_THRESHOLD with REPETITION_THRESHOLD:** They are different constants (0.35
  vs 0.85). Export them separately, name them distinctly.
- **Checking convergence before turn 6 and returning early elsewhere:** Put the turnCount guard
  as the very first line of `detectConvergence`, not inside ConversationManager. Keeps the logic
  encapsulated and testable in isolation.
- **Using all messages instead of cross-agent pairs:** Must filter by distinct `roomAgentId`.
  Single-agent rooms should never trigger convergence (would need at least 2 agents to agree).
- **Running both repetition AND convergence on the same turn and pausing twice:** The existing code
  uses `break` after the repetition check, so convergence check only runs if repetition did not
  fire. Keep ordering: repetition first, convergence second.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token similarity | Custom NLP tokenizer | Existing `tokenSet` + `jaccardSimilarity` in context-service.ts | Already correct, tested, handles punctuation/stopwords via length filter |
| Phrase detection | Regex engine | Simple `content.toLowerCase().includes(phrase)` | Phrases are short fixed strings; no regex needed |
| Message window DB query | Custom cursor | Drizzle `.orderBy(desc).limit(N)` then reverse | Already the established pattern in `detectRepetition` |

**Key insight:** The implementation is a parametric variation of `detectRepetition` with a lower
threshold and an additional phrase guard. No new algorithmic surface.

---

## Common Pitfalls

### Pitfall 1: Wrong Window Size
**What goes wrong:** Using the same REPETITION_WINDOW (5) for convergence gives too narrow a view
of cross-agent agreement — especially with 3+ agents where turns interleave.
**Why it happens:** Copy-paste from `detectRepetition` without adapting for multi-agent turn order.
**How to avoid:** Use a dedicated `CONVERGENCE_WINDOW` constant. A window of 6 (matching the min
turn requirement) or up to 10 is reasonable for cross-agent pair detection.
**Warning signs:** Convergence never fires in tests even with clearly agreeing content.

### Pitfall 2: Single-Agent Room Fires Incorrectly
**What goes wrong:** If a room has one agent, all messages share the same `roomAgentId`, so
cross-agent pairing finds no valid pairs — but naive code may fall through and return `true`.
**Why it happens:** Forgetting to validate that at least 2 distinct `roomAgentId` values exist
in the window before running pair comparisons.
**How to avoid:** Return `false` early if `distinctAgentIds.size < 2`.

### Pitfall 3: Phrase Match With Case Sensitivity
**What goes wrong:** Agent writes "I Completely Agree" (title case from punctuation-aware models)
and the lowercase phrase check misses it.
**Why it happens:** Forgetting `.toLowerCase()` normalization before include check.
**How to avoid:** Always normalize both the message content and the phrase list to lowercase before
comparison. Already demonstrated in `tokenSet()` with `.toLowerCase()`.

### Pitfall 4: Convergence + Repetition Double-Pause
**What goes wrong:** Repetition fires first (Jaccard >= 0.85 is a superset of >= 0.35 when the
same content appears verbatim), and then the convergence check also fires, resulting in two system
messages.
**Why it happens:** Not ordering the checks with early-exit.
**How to avoid:** Check repetition first, use `continue` or `break` to skip convergence check.
The existing code already breaks on repetition — put convergence check in the `else` branch or
simply after the `if (isRepetitive) { ... break; }` block (which the flow already exits via `break`).

### Pitfall 5: turnCount Off-by-One
**What goes wrong:** Minimum 6 turns means "at least 6 agent messages have been produced", but
`turnCount` in `ConversationManager` starts at 0 and increments after the message is persisted.
**Why it happens:** Ambiguity in what "turn 6" means.
**How to avoid:** Check `turnCount < 6` in `detectConvergence`. At the point where the method is
called, `turnCount` reflects the 0-based index of the just-completed turn. So `turnCount === 5`
is the 6th turn — the first one where convergence is allowed. The guard `if (turnCount < 5) return false` would mean "don't fire until turn 6 (index 5) has completed". Verify with a test: convergence must not fire at turnCount=4, may fire at turnCount=5.

---

## Code Examples

### Verified Pattern: detectRepetition (existing, in context-service.ts)

```typescript
// Source: src/lib/conversation/context-service.ts
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

  const lastTokens = tokenSet(rows[0].content);
  for (let i = 1; i < rows.length; i++) {
    const prevTokens = tokenSet(rows[i].content);
    if (jaccardSimilarity(lastTokens, prevTokens) >= ContextService.REPETITION_THRESHOLD) {
      return true;
    }
  }

  return false;
}
```

### New Pattern: detectConvergence (to implement)

```typescript
// Source: derived from detectRepetition pattern; adapted for cross-agent pairs + phrase guard
static CONVERGENCE_WINDOW = 8;
static CONVERGENCE_THRESHOLD = 0.35;
static CONVERGENCE_MIN_TURNS = 6;

static readonly AGREEMENT_PHRASES = [
  "great point", "that's a great point",
  "you're absolutely right", "you're right",
  "i completely agree", "i agree",
  "you've convinced me",
  "exactly right", "precisely",
  "i think we're aligned", "we agree",
];

static async detectConvergence(
  db: DrizzleDB,
  roomId: string,
  turnCount: number
): Promise<boolean> {
  // Guard: never fire before minimum turns
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
      if (rows[i].roomAgentId === rows[j].roomAgentId) continue; // same agent
      const sim = jaccardSimilarity(tokenSet(rows[i].content), tokenSet(rows[j].content));
      if (sim >= ContextService.CONVERGENCE_THRESHOLD) {
        return true;
      }
    }
  }

  return false;
}
```

### ConversationManager integration point

```typescript
// Source: src/lib/conversation/manager.ts (after existing repetition block)
// Check for convergence (distinct from verbatim repetition)
const hasConverged = await ContextService.detectConvergence(db, roomId, turnCount);
if (hasConverged) {
  await db.update(rooms).set({ status: 'paused' }).where(eq(rooms.id, roomId));
  emitSSE(roomId, 'status', { status: 'paused' });
  await db.insert(messages).values({
    id: nanoid(),
    roomId,
    roomAgentId: null,
    role: 'system',
    content: '[Auto-paused: agents reached consensus]',
    model: null,
    inputTokens: null,
    outputTokens: null,
  });
  emitSSE(roomId, 'system', { content: '[Auto-paused: agents reached consensus]' });
  break;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No convergence detection | Jaccard + phrase AND gate | Phase 9 (this) | Stops redundant turns when consensus reached |
| Single repetition guard (Jaccard >= 0.85) | Two guards: repetition (0.85) + convergence (0.35 + phrases) | Phase 9 (this) | Catches softer convergence that is not verbatim repetition |

**Explicitly not in scope (REQUIREMENTS.md out-of-scope table):**
- LLM-as-judge for convergence: ruled out (doubles API cost)
- Semantic embeddings: ruled out (requires extra model)
- "stop" (irreversible): must be "pause" (user can resume)

---

## Open Questions

1. **Exact CONVERGENCE_MIN_TURNS guard boundary**
   - What we know: requirement says "after minimum 6 turns"; `turnCount` starts at 0
   - What's unclear: is "6 turns" 6 agent messages produced, or 6 loop iterations (which could include empty/cancelled turns)?
   - Recommendation: Guard by `turnCount` (loop iteration index). At the call site `turnCount` has not yet been incremented for the current turn — so `turnCount < 5` means "do not fire until the 6th turn (index 5) has been written". Write a test that asserts false at turnCount=4, true-eligible at turnCount=5.

2. **Window size for convergence**
   - What we know: REPETITION_WINDOW is 5; convergence needs cross-agent pairs
   - What's unclear: optimal window with 2 vs 3 vs 4 agents
   - Recommendation: Default `CONVERGENCE_WINDOW = 8`. With 2 agents this covers 4 pairs each; with 4 agents it covers 2 turns per agent. Adjust after observing test behaviour.

3. **Whether to also select `roomAgentId` in the `detectRepetition` query**
   - What we know: current `detectRepetition` only selects `content`
   - What's unclear: should convergence reuse the same query with an added column, or keep them separate?
   - Recommendation: Keep them separate. `detectRepetition` is a distinct concern; changing its query signature risks breaking existing tests.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (node environment) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/conversation/context-service.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONV-01 | `detectConvergence` returns true when phrase + Jaccard >= 0.35 across different agents | unit | `npx vitest run tests/conversation/context-service.test.ts` | ❌ Wave 0: add describe block to existing file |
| CONV-01 | `detectConvergence` returns false when phrase present but Jaccard < 0.35 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ❌ Wave 0 |
| CONV-01 | `detectConvergence` returns false when Jaccard >= 0.35 but no phrase match | unit | `npx vitest run tests/conversation/context-service.test.ts` | ❌ Wave 0 |
| CONV-01 | `detectConvergence` returns false for same-agent pairs only | unit | `npx vitest run tests/conversation/context-service.test.ts` | ❌ Wave 0 |
| CONV-02 | `detectConvergence` returns false when turnCount < 5 (before turn 6) | unit | `npx vitest run tests/conversation/context-service.test.ts` | ❌ Wave 0 |
| CONV-02 | ConversationManager auto-pauses only after turn 6 | integration | `npx vitest run tests/conversation/manager.test.ts` | ❌ Wave 0: add test to existing file |
| CONV-03 | System message content is `[Auto-paused: agents reached consensus]` on convergence | integration | `npx vitest run tests/conversation/manager.test.ts` | ❌ Wave 0 |
| CONV-03 | Existing resume control works after convergence pause | integration | `npx vitest run tests/conversation/manager.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/conversation/context-service.test.ts tests/conversation/manager.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/conversation/context-service.test.ts` — add `describe('ContextService.detectConvergence', ...)` block; file exists, add to it
- [ ] `tests/conversation/manager.test.ts` — add convergence auto-pause integration tests; file exists, add to it

*(No new test files needed — extend existing test files)*

---

## Sources

### Primary (HIGH confidence)

- `src/lib/conversation/context-service.ts` — existing `detectRepetition` algorithm, `tokenSet`, `jaccardSimilarity` helpers, and static constants
- `src/lib/conversation/manager.ts` — call site pattern for post-turn checks, system message persistence, `emitSSE` usage
- `.planning/STATE.md` — locked parameters: Jaccard >= 0.35, AND logic, minimum 6 turns, pause not stop
- `.planning/REQUIREMENTS.md` — CONV-01/02/03 and explicit out-of-scope rules (no LLM-as-judge, no embeddings)
- `src/stores/chatStore.ts` — confirms `addSystemMessage` is already wired; no UI changes needed for CONV-03
- `src/components/rooms/MessageBubble.tsx` — confirms system message renders with generic styled block; any string content works

### Secondary (MEDIUM confidence)

- `tests/conversation/manager.test.ts` — test pattern for mocking streams and asserting system message content (auto-pauses section)
- `tests/conversation/context-service.test.ts` — test pattern for `detectRepetition` that `detectConvergence` tests must mirror

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all building blocks verified in existing source
- Algorithm design: HIGH — parameters locked in STATE.md, pattern derived directly from existing code
- Architecture placement: HIGH — identical to repetition detection; no ambiguity about where code goes
- Edge cases (single-agent, off-by-one turn guard): MEDIUM — require test verification to confirm boundary values

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain; no external dependencies)
