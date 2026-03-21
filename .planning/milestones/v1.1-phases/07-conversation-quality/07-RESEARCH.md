# Phase 7: Conversation Quality - Research

**Researched:** 2026-03-21
**Domain:** Prompt engineering for LLM multi-agent conversation quality (anti-sycophancy, topic-lock injection)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Anti-sycophancy prompt design**
- Strong directive injected into agent context, not a gentle suggestion — LLMs ignore soft nudges under conversational pressure to agree
- Universal prompt applied to ALL agents equally — agent personas already provide stance differentiation via their structured prompt fields (role, personality, rules, constraints)
- Injected before round 2 and every subsequent round — first round is unmodified so agents form initial positions naturally
- Prompt should instruct agents to: maintain their position even under disagreement, cite specific reasons when disagreeing, acknowledge other viewpoints without capitulating, avoid phrases like "great point" / "I agree" / "you're absolutely right" unless genuinely changing position with stated reasons

**Topic-lock frequency and content**
- Topic-lock reminder injected every 5 turns (configurable constant in ContextService)
- Reminder references the original room topic from `rooms.topic` field
- Moderate tone — redirects drift without being disruptive: "Remember: the discussion topic is [X]. Relate your response back to this topic."
- First topic-lock fires at turn 5, then 10, 15, etc.

**Injection method**
- Both anti-sycophancy and topic-lock are invisible to users — injected only into LLM context, not persisted as messages, not shown in chat UI
- Injection point: `ContextService.buildContext()` — append to the system prompt (after the 4 structured prompt fields are joined)
- `turnCount` from `ConversationManager` passed to `buildContext()` so it can decide what to inject based on current turn number
- Anti-sycophancy appended every turn from round 2+; topic-lock appended every 5th turn

**Per-agent differentiation**
- NO per-agent stance seeding — the user's agent persona design (promptRole, promptPersonality, promptRules, promptConstraints) is the primary source of agent differentiation
- The anti-sycophancy prompt is universal and persona-agnostic — it tells agents to hold their ground, not what ground to hold
- This preserves the user's creative control over agent behavior while the system handles the meta-problem of sycophantic collapse

### Claude's Discretion
- Exact wording of the anti-sycophancy directive (strong, direct, tested to be effective)
- Exact wording of the topic-lock reminder
- Whether to vary the anti-sycophancy prompt slightly across turns to prevent LLM adaptation/fatigue
- Implementation details of passing turnCount through the call chain
- Whether to add the injections as system prompt addendum vs. synthetic user messages (system prompt addendum recommended — cleaner separation)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | Agents maintain distinct epistemic stances throughout conversation | Anti-sycophancy prompt wording patterns; concrete banned-phrase list; evidence that strong directives outperform soft nudges |
| QUAL-02 | System injects anti-agreement prompts before round 2+ | `buildContext()` signature change; `turnCount` threading from manager; system prompt addendum pattern |
| QUAL-03 | Topic-lock reminders injected every N turns to prevent drift | `TOPIC_LOCK_INTERVAL` constant; `rooms.topic` availability; conditional injection logic in `buildContext()` |
</phase_requirements>

---

## Summary

Phase 7 is a focused prompt-engineering and call-chain modification phase. No schema changes, no new dependencies, no UI work. The entire change set lives in two files: `src/lib/conversation/context-service.ts` (add injection logic) and `src/lib/conversation/manager.ts` (pass `turnCount` to `buildContext()`). Tests in `tests/conversation/context-service.test.ts` and `tests/conversation/manager.test.ts` need updating for the new signature and behavior.

The core research question is: what prompt wording is most effective at preventing sycophantic collapse in multi-agent LLM conversations? The answer from 2025 research is consistent: explicit, directive language with concrete examples of forbidden behavior outperforms vague encouragement. Listing specific banned phrases ("great point", "I completely agree", "you're absolutely right") works because LLMs respond well to negative constraints. Pairing the ban list with a positive mandate (cite specific reasons when disagreeing, steelman your own position first) closes the gap between "don't do X" and "do Y instead."

The topic-lock is simpler — a single sentence referencing the literal room topic text, fired every 5 turns. The existing `rooms.topic` field is already fetched inside `buildContext()` for the user-message seed, so no additional DB call is needed if the fetch is hoisted.

**Primary recommendation:** Extend `buildContext()` with a `turnCount: number` parameter, build the anti-sycophancy and topic-lock addenda as string constants in `context-service.ts`, and append them conditionally to `systemPrompt` before returning. No other files need changes except tests.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | (project-existing) | Unit tests for injection logic | Already the project test framework |

No new production dependencies. This phase is pure logic added to existing files.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| System prompt addendum | Synthetic user message injection | System prompt addendum is cleaner — avoids polluting message history role parity, won't show in sliding window, correct semantic layer for meta-instructions |
| Single static prompt | Per-turn varied phrasing | Variation adds complexity; benefit unproven for this use case; keep simple and revisit if LLM adaptation is observed in practice |

---

## Architecture Patterns

### Recommended Project Structure

No new files. All changes are modifications within existing files:

```
src/lib/conversation/
├── context-service.ts   # PRIMARY: add injection logic + TOPIC_LOCK_INTERVAL constant
└── manager.ts           # SECONDARY: thread turnCount into buildContext() call

tests/conversation/
├── context-service.test.ts  # UPDATE: new signature + injection behavior tests
└── manager.test.ts          # UPDATE: pass turnCount in mock call chain
```

### Pattern 1: buildContext Signature Extension

**What:** Add `turnCount: number` as a new parameter to `ContextService.buildContext()`. The parameter drives both injection decisions.

**When to use:** Applied to every `buildContext()` call in `ConversationManager.start()`.

**Current signature:**
```typescript
static async buildContext(
  db: DrizzleDB,
  roomId: string,
  agent: { id: string; promptRole: string; ... }
): Promise<{ systemPrompt: string; messages: ... }>
```

**New signature:**
```typescript
static async buildContext(
  db: DrizzleDB,
  roomId: string,
  agent: { id: string; promptRole: string; ... },
  turnCount: number = 0
): Promise<{ systemPrompt: string; messages: ... }>
```

Defaulting to `0` makes the parameter backward-compatible in tests that don't pass it, though all tests exercising injection behavior must pass it explicitly.

### Pattern 2: Conditional System Prompt Addenda

**What:** After building `systemPrompt` from the 4 prompt fields, append injection strings based on `turnCount`.

**When to use:** Inside `buildContext()`, after the `join('\n\n')` of prompt parts.

**Example:**
```typescript
// Source: locked decision in 07-CONTEXT.md
const TOPIC_LOCK_INTERVAL = 5;

// Anti-sycophancy: inject on every turn after the first (turnCount >= 1)
// Topic-lock: inject on turns that are multiples of TOPIC_LOCK_INTERVAL (turnCount > 0 && turnCount % TOPIC_LOCK_INTERVAL === 0)

const addenda: string[] = [];

if (turnCount >= 1) {
  addenda.push(ANTI_SYCOPHANCY_PROMPT);
}

if (turnCount > 0 && turnCount % TOPIC_LOCK_INTERVAL === 0) {
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  const topic = room?.topic?.trim();
  if (topic) {
    addenda.push(`Remember: the discussion topic is "${topic}". Relate your response back to this topic.`);
  }
}

const finalSystemPrompt = addenda.length > 0
  ? systemPrompt + '\n\n' + addenda.join('\n\n')
  : systemPrompt;
```

**Important note on DB fetch deduplication:** `buildContext()` already fetches the room for user-message seeding when `mappedMessages.length === 0 || mappedMessages[0].role === 'assistant'`. In long-running conversations this branch may not always fire. The topic-lock fetch should be its own targeted fetch only when the topic-lock condition is true, rather than assuming the earlier fetch ran.

### Pattern 3: turnCount Threading in Manager

**What:** `ConversationManager.start()` already tracks `turnCount` as a `let` variable in the fire-and-forget loop. Pass it to `buildContext()`.

**Current call:**
```typescript
const context = await ContextService.buildContext(db, roomId, agent);
```

**New call:**
```typescript
const context = await ContextService.buildContext(db, roomId, agent, turnCount);
```

`turnCount` is incremented at the bottom of the loop (`turnCount++`), AFTER the message is persisted. This means:
- Turn 0 (first ever turn): `turnCount = 0` → no injection (first round unmodified)
- Turn 1 (second turn): `turnCount = 1` → anti-sycophancy injected
- Turn 5 (sixth turn): `turnCount = 5` → anti-sycophancy + topic-lock injected

This matches the locked decisions exactly: "first round is unmodified so agents form initial positions naturally."

### Pattern 4: Anti-Sycophancy Prompt Wording

Research confirms that explicit, negative-constraint prompts with concrete banned examples are most effective. The following wording is recommended based on the CONTEXT.md specification and 2025 anti-sycophancy research:

```typescript
const ANTI_SYCOPHANCY_PROMPT = `CONVERSATION INTEGRITY RULES:
You must maintain your stated position unless presented with a genuinely compelling argument backed by specific evidence. Do not capitulate to social pressure or mere repetition.

Forbidden agreement phrases (do not use unless you have genuinely changed position with stated reasons):
- "great point"
- "you're absolutely right"
- "I completely agree"
- "that's a good point"
- "I see your point, you're right"

When you disagree: state your specific reasons, cite evidence, and steelman your own position before engaging counterarguments. Acknowledge the other viewpoint without abandoning your own. If you genuinely change your position, explicitly state WHY — what specific argument or evidence convinced you.`;
```

**Why this wording works (MEDIUM confidence, supported by multiple 2025 sources):**
- Explicit ban list gives the LLM concrete negative examples — more effective than vague "don't be agreeable"
- "CONVERSATION INTEGRITY RULES" framing elevates the instruction above conversational noise
- "steelman your own position first" counters the RLHF tendency to immediately find merit in whatever the counterpart says
- The escape clause ("unless you have genuinely changed position with stated reasons") prevents the prompt from creating false rigidity — agents can still evolve views when warranted
- All-caps header increases salience in the system prompt

### Anti-Patterns to Avoid

- **Gentle nudges without examples:** "Try to maintain your perspective" will be overridden by conversational pressure within 2-3 turns. Research confirms soft language is ineffective.
- **Injecting as a synthetic user message:** This pollutes the message history, can disrupt role parity (user/assistant alternation), and semantically misrepresents the instruction as coming from a conversation participant rather than the system.
- **Injecting before turn 0:** The first round must be unmodified so agents establish their initial positions. Injecting at turn 0 means agents never get to form organic positions to defend.
- **Persisting injection content to DB:** Injections are transient context — never insert them into the `messages` table or emit them via SSE.
- **Fetching room twice per turn unnecessarily:** The topic-lock condition fires only every 5 turns. Only fetch the room when that condition is true.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Topic-lock content | Dynamic topic extraction algorithm | `rooms.topic` field (already in DB) | Topic is already stored at room creation time; no analysis needed |
| Sycophancy detection | Similarity-based detection of agreement collapse | Anti-sycophancy system prompt | Phase 9 handles detection; Phase 7 is prevention via prompt |
| Injection visibility toggling | Feature flag / UI settings | None — always invisible to user | CONTEXT.md locks this: injections are always invisible |

**Key insight:** This phase adds approximately 30 lines of logic. Any approach that requires more than 50 lines in context-service.ts or more than 5 lines in manager.ts is over-engineered.

---

## Common Pitfalls

### Pitfall 1: Off-by-one in turnCount semantics

**What goes wrong:** The `turnCount` variable in `manager.ts` is incremented at the BOTTOM of the loop. If you pass `turnCount` before it increments, turn 0 = first turn (correct). But if the inject condition uses `> 0` vs `>= 1` inconsistently, the first injection fires on the wrong turn.

**Why it happens:** The increment position (`turnCount++` at end of loop) is easy to overlook when writing conditions.

**How to avoid:** Use `turnCount >= 1` for anti-sycophancy (fires from the second turn onward). For topic-lock, use `turnCount > 0 && turnCount % TOPIC_LOCK_INTERVAL === 0` (fires at turns 5, 10, 15...). Write explicit tests verifying which turn numbers trigger each condition.

**Warning signs:** Tests for "no injection on turn 0" pass, but "injection starts on turn 1" test fails, or vice versa.

### Pitfall 2: buildContext() called from resume() without turnCount

**What goes wrong:** `ConversationManager.resume()` calls `ConversationManager.start()` with a `_turnLimitOverride`. The turn loop inside `start()` always starts `turnCount` at 0. When a conversation resumes mid-stream, `turnCount` inside the resumed loop starts at 0 again, meaning the first resumed turn gets no anti-sycophancy injection.

**Why it happens:** `turnCount` is a local variable in the `start()` fire-and-forget closure; it does not reflect how many turns have already occurred globally.

**How to avoid:** For resume scenarios, this is acceptable behavior — the injections reset each session. The spec says "before round 2 and every subsequent round" — if the user resumes, turn 1 of the new session is effectively the first turn of that session. The anti-sycophancy injection returns on turn 2 of the resumed session. Document this behavior. Do NOT try to compute a global turn offset at resume time — that adds complexity beyond phase scope.

**Warning signs:** Test verifying injection behavior during resume fails because you assumed global turn continuity.

### Pitfall 3: Double room fetch

**What goes wrong:** `buildContext()` may end up fetching the room twice per turn when both the user-message seed logic AND the topic-lock fire on the same turn.

**Why it happens:** The user-message seed fetches the room to get `topic`. The topic-lock also needs the room for `topic`. If both paths execute independently, two identical DB queries run.

**How to avoid:** Hoist the room fetch to a single `let room` at the top of `buildContext()` when topic-lock logic fires, or restructure so the room object is passed down. However — this is a minor optimization, not a correctness issue. Given the topic-lock fires every 5 turns and SQLite queries are fast, deduplication can be deferred unless profiling reveals a problem.

**Warning signs:** Noticeably slower turns at multiples of 5. (Unlikely to be observable in practice.)

### Pitfall 4: Anti-sycophancy prompt breaking Anthropic's user-first message requirement

**What goes wrong:** The injection appends to the SYSTEM prompt, not the messages array. The user-first requirement applies to the `messages` array (the sliding window). As long as injection stays in `systemPrompt`, there is no conflict.

**Why it happens:** Confusion between system prompt (metadata sent as a separate field) and message history (the array of user/assistant turns).

**How to avoid:** Always append to `systemPrompt` (the string), never to `messages` (the array). This is explicitly what CONTEXT.md specifies.

### Pitfall 5: Existing tests break due to systemPrompt content change

**What goes wrong:** `context-service.test.ts` has a test that checks `result.systemPrompt` exactly: `expect(result.systemPrompt).toBe('You are a helpful assistant.')`. If this test calls `buildContext(db, roomId, agent)` without a `turnCount` argument, the default of `0` means no injection fires and the test still passes. But if turnCount defaults are changed or tests explicitly pass turnCount values, the exact system prompt assertion breaks.

**Why it happens:** The existing test checks exact system prompt string equality.

**How to avoid:** Keep default `turnCount = 0` so existing tests pass without modification. For new tests that verify injection, pass explicit `turnCount` values (1, 5, etc.) and assert that the system prompt CONTAINS the expected strings rather than using toBe equality.

---

## Code Examples

### Anti-sycophancy injection in buildContext()

```typescript
// Source: context-service.ts (new logic to add after systemPrompt assembly)

export const TOPIC_LOCK_INTERVAL = 5; // named constant — easy to tune

const ANTI_SYCOPHANCY_PROMPT = `CONVERSATION INTEGRITY RULES:
Maintain your stated position unless presented with a compelling argument backed by specific evidence. Do not capitulate to social pressure or mere repetition.

Do NOT use these phrases unless you have genuinely changed position (with stated reasons):
- "great point" / "that's a great point"
- "you're absolutely right" / "you're right"
- "I completely agree" / "I agree"
- "you've convinced me" (unless you actually have been)

When disagreeing: state your specific reasons, cite evidence, and acknowledge the other viewpoint without abandoning your own. If you genuinely change your position, state explicitly what argument or evidence convinced you.`;

// Inside buildContext(), after systemPrompt is assembled:
const addenda: string[] = [];

if (turnCount >= 1) {
  addenda.push(ANTI_SYCOPHANCY_PROMPT);
}

if (turnCount > 0 && turnCount % TOPIC_LOCK_INTERVAL === 0) {
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });
  const topic = room?.topic?.trim();
  if (topic) {
    addenda.push(
      `TOPIC REMINDER: The discussion topic is "${topic}". Relate your response directly back to this topic.`
    );
  }
}

const systemPrompt = addenda.length > 0
  ? promptParts.join('\n\n') + '\n\n' + addenda.join('\n\n')
  : promptParts.join('\n\n');
```

### turnCount threading in manager.ts

```typescript
// Source: manager.ts — replace existing buildContext call
const context = await ContextService.buildContext(db, roomId, agent, turnCount);
```

### Test pattern for injection behavior

```typescript
// Source: context-service.test.ts (new tests to add)

it('appends anti-sycophancy prompt when turnCount >= 1', async () => {
  const result = await ContextService.buildContext(db, roomId, baseAgent(), 1);
  expect(result.systemPrompt).toContain('CONVERSATION INTEGRITY RULES');
  expect(result.systemPrompt).toContain('great point');
});

it('does not append anti-sycophancy prompt on turnCount 0', async () => {
  const result = await ContextService.buildContext(db, roomId, baseAgent(), 0);
  expect(result.systemPrompt).not.toContain('CONVERSATION INTEGRITY RULES');
  expect(result.systemPrompt).toBe('You are a helpful assistant.'); // exact match preserved
});

it('appends topic-lock at TOPIC_LOCK_INTERVAL turns', async () => {
  await db.update(rooms).set({ topic: 'AI safety' }).where(eq(rooms.id, roomId));
  const result = await ContextService.buildContext(db, roomId, baseAgent(), 5);
  expect(result.systemPrompt).toContain('TOPIC REMINDER');
  expect(result.systemPrompt).toContain('AI safety');
});

it('does not append topic-lock on non-interval turns', async () => {
  await db.update(rooms).set({ topic: 'AI safety' }).where(eq(rooms.id, roomId));
  const result = await ContextService.buildContext(db, roomId, baseAgent(), 3);
  expect(result.systemPrompt).not.toContain('TOPIC REMINDER');
});

it('appends both anti-sycophancy and topic-lock at interval turns', async () => {
  await db.update(rooms).set({ topic: 'climate policy' }).where(eq(rooms.id, roomId));
  const result = await ContextService.buildContext(db, roomId, baseAgent(), 10);
  expect(result.systemPrompt).toContain('CONVERSATION INTEGRITY RULES');
  expect(result.systemPrompt).toContain('TOPIC REMINDER');
  expect(result.systemPrompt).toContain('climate policy');
});

it('skips topic-lock when room has no topic', async () => {
  // room has no topic set (null)
  const result = await ContextService.buildContext(db, roomId, baseAgent(), 5);
  expect(result.systemPrompt).not.toContain('TOPIC REMINDER');
  expect(result.systemPrompt).toContain('CONVERSATION INTEGRITY RULES'); // anti-syco still fires
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Relying solely on agent persona for differentiation | Persona + active anti-sycophancy injection | Phase 7 (this phase) | Prevents trained-in RLHF sycophancy overriding persona-based stances |
| No topic anchoring | Periodic topic-lock reminders | Phase 7 (this phase) | Prevents semantic drift over long conversations |

**Relevant research findings:**
- Soft language ("try to maintain your perspective") is routinely overridden by conversational pressure within 2-3 turns (MEDIUM confidence — multiple 2025 sources)
- Explicit ban lists with concrete examples are substantially more effective than abstract instructions (MEDIUM confidence — Sparkco 2025 research reports 69% improvement)
- System prompt injection for meta-instructions is semantically correct — the system prompt is the appropriate layer for behavioral guardrails that are invisible to participants

---

## Open Questions

1. **Anti-sycophancy prompt variation across turns**
   - What we know: CONTEXT.md marks this as "Claude's Discretion"
   - What's unclear: Whether repeated identical prompts cause LLM adaptation (the model learns to pattern-match and ignore the repeated block)
   - Recommendation: Start with a single static prompt. Variation adds implementation complexity and the benefit is unproven for this use case. If sycophantic collapse is still observed in practice after Phase 7, rotating 2-3 variants is a simple extension.

2. **Resume scenario turn count semantics**
   - What we know: `turnCount` resets to 0 on every `ConversationManager.start()` call, including resume
   - What's unclear: Whether users expect anti-sycophancy to be active from turn 1 of a resumed session
   - Recommendation: Accept the reset behavior — it's simpler and within spec. The first resumed turn is effectively a "new round 1" for the continuation session.

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/conversation/context-service.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | Anti-sycophancy prompt present in system prompt from turn 2 onward | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new test cases) |
| QUAL-01 | No injection on turn 0 (first round unmodified) | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new test cases) |
| QUAL-02 | Anti-agreement injection active on turn 1 (round 2) | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new test cases) |
| QUAL-02 | Manager passes correct turnCount to buildContext | unit | `npx vitest run tests/conversation/manager.test.ts` | ✅ (needs new test cases) |
| QUAL-03 | Topic-lock fires at turn 5, 10, 15 (TOPIC_LOCK_INTERVAL multiples) | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new test cases) |
| QUAL-03 | Topic-lock not injected when room has no topic | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new test cases) |
| QUAL-03 | Topic-lock not injected on non-interval turns (e.g. turn 3) | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new test cases) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/conversation/context-service.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases for injection behavior in `tests/conversation/context-service.test.ts` — covers QUAL-01, QUAL-02, QUAL-03
- [ ] Updated test cases in `tests/conversation/manager.test.ts` — verifies `turnCount` is threaded through to `buildContext()` (spy/capture approach)

*(Existing test infrastructure is present and working — only new test cases are needed, not new test files or framework setup)*

---

## Sources

### Primary (HIGH confidence)
- Direct source code analysis: `src/lib/conversation/context-service.ts` — current `buildContext()` signature, system prompt assembly, room fetch pattern
- Direct source code analysis: `src/lib/conversation/manager.ts` — `turnCount` tracking, `buildContext()` call site, fire-and-forget loop structure
- Direct source code analysis: `tests/conversation/context-service.test.ts` — existing test patterns, exact assertion style, `createTestDb()` setup
- `.planning/phases/07-conversation-quality/07-CONTEXT.md` — locked decisions, injection approach, turnCount semantics

### Secondary (MEDIUM confidence)
- [Sycophancy in Large Language Models: Causes and Mitigations](https://arxiv.org/html/2411.15287v1) — prompt engineering effectiveness, explicit ban lists
- [Reducing LLM Sycophancy: 69% Improvement Strategies](https://sparkco.ai/blog/reducing-llm-sycophancy-69-improvement-strategies) — measurable improvement with negative prompting
- [SYCOPHANCY.md — AI Agent Anti-Sycophancy Protocol](https://sycophancy.md/) — community protocol for detection patterns and permitted responses
- [Mitigating sycophantic bias in LLMs](https://www.paretosoftware.fi/en/blog/mitigating-sycophantic-bias-in-llms) — context engineering and explicit authorization to disagree

### Tertiary (LOW confidence)
- [I Created an LLM System Prompt to Ruthlessly Attack My Opinions](https://medium.com/@adrianbooth/i-created-an-llm-system-prompt-to-ruthlessly-attack-my-opinions-3b0d23088453) — practical examples of strong directive prompts; single-author, unverified methodology

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing files confirmed by direct source read
- Architecture: HIGH — exact signatures, call sites, and test patterns confirmed from source; injection logic is 30 lines of straightforward conditionals
- Pitfalls: HIGH — off-by-one and role-parity issues identified from direct code analysis; anti-sycophancy prompt effectiveness is MEDIUM (research-based, not in-app tested)
- Prompt wording: MEDIUM — supported by multiple 2025 sources but not empirically tested in this specific multi-agent setup

**Research date:** 2026-03-21
**Valid until:** 2026-06-21 (stable domain — prompt engineering patterns and internal codebase don't change frequently)
