# Phase 7: Conversation Quality - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Anti-sycophancy prompts and topic-lock injection so agents maintain genuinely distinct epistemic stances throughout multi-turn conversation. The system actively counters sycophantic drift by injecting anti-agreement directives into agent context before each turn (round 2+), and periodically reminding agents to stay on the original room topic. No convergence detection (Phase 9), no parallel first round (Phase 10), no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Anti-sycophancy prompt design
- **Strong directive** injected into agent context, not a gentle suggestion — LLMs ignore soft nudges under conversational pressure to agree
- Universal prompt applied to ALL agents equally — agent personas already provide stance differentiation via their structured prompt fields (role, personality, rules, constraints)
- Injected **before round 2 and every subsequent round** — first round is unmodified so agents form initial positions naturally
- Prompt should instruct agents to: maintain their position even under disagreement, cite specific reasons when disagreeing, acknowledge other viewpoints without capitulating, avoid phrases like "great point" / "I agree" / "you're absolutely right" unless genuinely changing position with stated reasons

### Topic-lock frequency & content
- Topic-lock reminder injected **every 5 turns** (configurable constant in ContextService)
- Reminder references the **original room topic** from `rooms.topic` field
- Moderate tone — redirects drift without being disruptive: "Remember: the discussion topic is [X]. Relate your response back to this topic."
- First topic-lock fires at turn 5, then 10, 15, etc.

### Injection method
- Both anti-sycophancy and topic-lock are **invisible to users** — injected only into LLM context, not persisted as messages, not shown in chat UI
- Injection point: `ContextService.buildContext()` — append to the system prompt (after the 4 structured prompt fields are joined)
- `turnCount` from `ConversationManager` passed to `buildContext()` so it can decide what to inject based on current turn number
- Anti-sycophancy appended every turn from round 2+; topic-lock appended every 5th turn

### Per-agent differentiation
- NO per-agent stance seeding — the user's agent persona design (promptRole, promptPersonality, promptRules, promptConstraints) is the primary source of agent differentiation
- The anti-sycophancy prompt is universal and persona-agnostic — it tells agents to hold their ground, not what ground to hold
- This preserves the user's creative control over agent behavior while the system handles the meta-problem of sycophantic collapse

### Claude's Discretion
- Exact wording of the anti-sycophancy directive (strong, direct, tested to be effective)
- Exact wording of the topic-lock reminder
- Whether to vary the anti-sycophancy prompt slightly across turns to prevent LLM adaptation/fatigue
- Implementation details of passing turnCount through the call chain
- Whether to add the injections as system prompt addendum vs. synthetic user messages (system prompt addendum recommended — cleaner separation)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Conversation engine (injection points)
- `src/lib/conversation/context-service.ts` — `buildContext()` method: builds system prompt from 4 structured fields + sliding window of 20 messages. THIS is where anti-sycophancy and topic-lock get injected. Also has `detectRepetition()` with Jaccard similarity
- `src/lib/conversation/manager.ts` — Turn loop with `turnCount` tracking, calls `buildContext()` per turn. Must pass turn number to context service for injection logic
- `src/lib/conversation/speaker-selector.ts` — Speaker selection (round-robin / LLM-selected), not directly modified but contextually relevant

### Database schema
- `src/db/schema.ts` — `rooms.topic` field used for topic-lock content; `messages` table with role enum; `roomAgents` with structured prompt fields

### Requirements
- `.planning/REQUIREMENTS.md` — QUAL-01 (distinct stances), QUAL-02 (anti-agreement injection round 2+), QUAL-03 (topic-lock every N turns)

### Project context
- `.planning/PROJECT.md` — Core value: agent collaboration must yield better outcomes than single agent
- `.planning/STATE.md` — Phase 7 before Phase 9: quality prompts produce agreement language that convergence detector relies on

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ContextService.buildContext()` — Already joins 4 prompt fields into system prompt and maps message roles. Direct extension point for injections
- `ConversationManager` turn loop — Already tracks `turnCount` locally. Needs to pass it to `buildContext()`
- `ContextService.detectRepetition()` — Jaccard similarity already implemented. Phase 9 convergence detection will build on this pattern
- Room `topic` field — Already stored in DB and fetched per turn (used for user message seeding). Available for topic-lock content

### Established Patterns
- System prompt = join of promptRole + promptPersonality + promptRules + promptConstraints (non-null, double-newline separated)
- User message seeding: `ContextService` already injects synthetic `{role: 'user', content: 'Discussion topic: X'}` when history is empty/starts with assistant
- System messages: persisted with `role: 'system'` and emitted via SSE — but Phase 7 injections are NOT system messages (invisible to user)
- Fire-and-forget turn loop with status checks each iteration

### Integration Points
- `ContextService.buildContext()` signature needs `turnCount` parameter added
- `ConversationManager.start()` turn loop passes `turnCount` when calling `buildContext()`
- No schema changes needed — injections are transient (context-only, not persisted)
- No SSE changes needed — injections are invisible to the client
- Existing tests in `tests/conversation/` will need updates for the new `buildContext()` signature

</code_context>

<specifics>
## Specific Ideas

- Anti-sycophancy prompt should explicitly list banned agreement phrases ("great point", "I completely agree", "you're absolutely right") — LLMs respond well to concrete examples of what NOT to do
- The prompt should encourage agents to steelman their own position before engaging with counterarguments
- Topic-lock should feel natural, not robotic — reference the topic content, not just "stay on topic"
- The 5-turn topic-lock interval should be a named constant (e.g., `TOPIC_LOCK_INTERVAL`) for easy tuning

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-conversation-quality*
*Context gathered: 2026-03-21*
