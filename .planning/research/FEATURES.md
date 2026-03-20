# Feature Research

**Domain:** Multi-agent AI chat room — v1.1 Conversation Quality & Polish milestone
**Researched:** 2026-03-20
**Confidence:** HIGH for cost estimation and parallel first round (well-documented patterns); MEDIUM for convergence detection (requires design decisions); MEDIUM for quality improvements (subjective, prompt-engineering dependent)

---

## Context: What Is Already Built (v1.0)

The following features are **complete** and are dependencies, not targets, for this milestone:

- Room & agent CRUD, 5 LLM providers, copy-on-assign agent binding
- Autonomous multi-agent conversation with turn limits, sliding window context (20 msgs)
- Repetition detection (Jaccard similarity) with auto-pause
- Real-time SSE streaming, thinking indicators, user message injection
- Token usage display, on-demand summaries, MD/JSON export
- Round-robin and LLM-selected speaker strategies
- Room configuration UI (turn limit slider, speaker strategy select), edit room settings

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the v1.1 user expects to see. Missing these makes the milestone feel incomplete.

| Feature | Why Expected | Complexity | Dependency on Existing |
|---------|--------------|------------|------------------------|
| Cost estimation per room | Token counts already displayed; showing "$0.003" next to "143 tokens" is the natural completion. Users running multiple agents × multiple turns need cost awareness to regulate behavior. | LOW-MEDIUM | Depends on per-message token counts (built). Requires a static pricing table keyed by provider+model. |
| Convergence auto-stop | Users start conversations to reach conclusions. Without auto-stop, they rely on turn limits alone. Users expect the system to recognize "they've agreed" without manual monitoring. | MEDIUM | Depends on autonomous conversation loop and pause/stop controls (built). Adds a check after each round. |
| Tech debt cleanup | Dead files, type errors, and over-fetching are visible to the developer. A "quality" milestone that ignores internal quality is incomplete. | LOW | Depends on knowing what debt exists: orphaned ConversationPanel.tsx, test type errors, room detail over-fetching. |

### Differentiators (Competitive Advantage)

Features that make the v1.1 milestone meaningfully better than v1.0 — the core reason for the milestone.

| Feature | Value Proposition | Complexity | Dependency on Existing |
|---------|-------------------|------------|------------------------|
| Independent parallel first round | Eliminates herding — agents anchor on the first response in sequential mode. Running round 1 blind (no peer visibility) produces genuine divergence before agents see each other. Research on Multi-Agent Debate (MAD) confirms this as the canonical technique for getting independent perspectives. | HIGH | Depends on autonomous conversation loop (built). Requires orchestrator to fan-out N parallel LLM calls, collect all responses, then inject them into the shared context before round 2. Conflicts with the current sequential orchestrator flow. |
| Conversation quality improvements via prompt engineering | Better system-prompt structure + role mandates produce substantive disagreement instead of agreement-by-default. LLMs default to sycophancy; explicit "challenge the previous point" instructions or role-encoded skepticism counteract this. | MEDIUM | Depends on per-agent structured prompt fields (built: role, personality, rules, constraints). Improvement is achieved by changing prompt composition in ConversationManager, not new data structures. |
| Cost estimation display (formatted, with provider pricing) | Showing actual dollar amounts (e.g., "$0.012 this session") gives the user immediate cost feedback for each room. This is purely additive to the existing token display — high value, low risk. | LOW-MEDIUM | Depends on token counts per message (built). Requires a pricing lookup: `{ provider, model } → { inputCostPerMTok, outputCostPerMTok }`. Static JSON table is sufficient; no external API call needed. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Dynamic pricing via external API | "Show real-time current pricing" | Provider pricing changes infrequently (weeks/months). An API call per room load adds latency, a new failure mode, and a dependency. The benefit over a manually updated static table is near zero. | Static pricing table, versioned in code, updated manually when providers change. Flag stale data with a "last updated" comment. |
| LLM-as-judge for convergence | "Use an LLM to decide if consensus is reached" | Adds a full extra LLM API call per round — doubles API cost just for convergence checking. Adds latency per turn. Introduces a new failure mode (judge call fails). | Semantic similarity between agent responses (cosine similarity on embeddings or TF-IDF) — cheaper, local, no extra API call. For a personal tool, 80% precision is acceptable. |
| Streaming parallel first round | "Show each agent's first-round response as it streams" | The UX value is unclear — agents are responding simultaneously, so showing partial responses from multiple agents simultaneously creates confusion. | Show all first-round responses when the last one completes. Brief "Agents forming independent views..." indicator during parallel phase. |
| Semantic embedding service for convergence | "Use a proper embedding model for similarity" | Requires either a local embedding model (setup complexity) or an additional API call per convergence check. | Jaccard similarity (already implemented for repetition detection) or cosine similarity on simple TF-IDF vectors. These are good enough for detecting agent agreement without external dependencies. |
| Per-agent cost breakdown | "Show cost per agent, not just per room" | Marginal value over per-room total; adds UI complexity. Users care about total session cost first. | Show room-level total; break down by agent only if user explicitly requests it (future). |

---

## Feature Dependencies

```
[Cost estimation display]
    └──requires──> [Token counts per message]     ← already built (v1.0)
    └──requires──> [Pricing table: provider+model → $/MTok]   ← NEW static data

[Independent parallel first round]
    └──requires──> [Autonomous conversation loop] ← already built (v1.0)
    └──requires──> [Orchestrator fan-out logic]   ← NEW: run N calls in parallel
    └──requires──> [Context merge after round 1]  ← NEW: inject all round-1 responses into shared context
    └──conflicts──> [Round-robin speaker selection for round 1]  ← round-robin is sequential; parallel bypasses it

[Convergence detection]
    └──requires──> [Autonomous conversation loop] ← already built (v1.0)
    └──requires──> [Pause/stop controls]          ← already built (v1.0)
    └──requires──> [Similarity scoring per round] ← NEW: compare agent responses after each round
    └──enhances──> [Turn limit]                   ← convergence is the soft stop; turn limit is the hard stop

[Conversation quality improvements]
    └──requires──> [Structured agent prompt fields (role, rules, constraints)] ← already built (v1.0)
    └──enhances──> [Independent parallel first round] ← parallel + good prompts = best independence
    └──enhances──> [Convergence detection]            ← quality conversations converge meaningfully, not vacuously

[Tech debt cleanup]
    └──requires──> [Identifying orphaned files]   ← ConversationPanel.tsx
    └──requires──> [Identifying type errors]      ← test files
    └──requires──> [Identifying over-fetching]    ← room detail endpoint
```

### Dependency Notes

- **Parallel first round requires orchestrator refactor:** The current orchestrator is sequential (select speaker → call LLM → broadcast → repeat). Parallel first round requires a new code path: fan-out all agents simultaneously, wait for all to complete, then merge into context. This is the highest-complexity item in the milestone.
- **Convergence detection does NOT require LLM-as-judge:** Jaccard similarity (already in the codebase for repetition detection) can be repurposed. Convergence = high similarity between different agents (they're saying the same thing). Repetition = high similarity between the same agent across turns. Same technique, different comparison axis.
- **Cost estimation is independent:** Can be built and shipped without any other milestone feature. Zero risk of breaking existing behavior. Build this first.
- **Quality improvements are prompt-only:** No new data structures, no new API routes. Changes are in the prompt composition layer (ConversationManager). Low risk.

---

## MVP Definition for v1.1

### Ship in v1.1 (this milestone)

- [x] **Cost estimation display** — high value, low risk, independent of other features. Token counts exist; add pricing table and display formatted cost.
- [x] **Conversation quality improvements** — prompt-engineering changes in ConversationManager. No schema changes, no new routes.
- [x] **Independent parallel first round** — core differentiator of this milestone. Requires orchestrator changes but builds on existing infrastructure.
- [x] **Convergence detection** — completes the "smart conversation" story. Soft-stop when agents agree; turn limit remains as hard stop.
- [x] **Tech debt cleanup** — remove orphaned ConversationPanel.tsx, fix test type errors, fix room detail over-fetching.

### Defer to v1.2+

- **Per-agent cost breakdown** — v1.1 ships room-level totals; per-agent detail is low priority
- **Asymmetric context injection** — useful but adds config surface area; validate quality improvements first
- **Agent long-term memory** — too complex; out of scope per PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Cost estimation display | HIGH | LOW | P1 |
| Tech debt cleanup | MEDIUM (developer) | LOW | P1 |
| Conversation quality improvements | HIGH | MEDIUM | P1 |
| Independent parallel first round | HIGH | HIGH | P1 |
| Convergence detection | MEDIUM | MEDIUM | P1 |
| Per-agent cost breakdown | LOW | LOW | P3 |
| Dynamic pricing via external API | LOW | MEDIUM | P3 |
| Agent long-term memory | LOW | HIGH | P3 — out of scope |

**Priority key:**
- P1: Ships in v1.1 milestone
- P2: Consider for v1.2 if v1.1 scope allows
- P3: Future consideration

---

## Implementation Notes Per Feature

### Cost Estimation

**Pattern:** Static pricing table keyed by `provider:model` string → `{ inputCostPerMTok: number, outputCostPerMTok: number }`. Apply at message storage time or compute on read. Display as formatted currency (e.g., `$0.0042`).

**Coverage needed:**
- Claude: claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus (Anthropic pricing)
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- Gemini: gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash
- OpenRouter: pass-through (use underlying model price where known, else show "unknown")
- Ollama: $0.00 (local, no cost)

**Staleness strategy:** Add a `// Pricing as of YYYY-MM-DD` comment. Display a small "estimated" disclaimer in the UI. This is a personal tool — approximate cost is fine.

**Confidence:** HIGH — this is a well-understood pattern. Token counts already stored per message.

### Independent Parallel First Round

**Pattern (from Multi-Agent Debate literature):** Round 1 = all agents called in parallel with no peer context. Round 2+ = each agent sees all round-1 responses. This is "simultaneous-talk" mode from ChatEval research.

**Orchestrator change:** Add a `parallelFirstRound: boolean` option per room. When true:
1. Round 1: `Promise.all(agents.map(agent => callLLM(agent, systemPrompt, topic)))` — no agent sees others' responses
2. Collect all round-1 responses
3. Inject all responses into shared context
4. Round 2+: proceed with existing sequential or LLM-selected speaker logic

**UX during parallel phase:** Show "Agents forming independent views..." with a multi-agent thinking indicator. When all complete, display responses in sequence.

**Conflict with round-robin:** For round 1 only, round-robin does not apply (all agents respond). For round 2+, resume selected strategy.

**Confidence:** HIGH — the pattern is well-documented in MAD research. Implementation complexity is in the orchestrator fan-out and SSE broadcasting for parallel responses.

### Convergence Detection

**Pattern:** After each round, compare agent responses pairwise using similarity scoring. If average pairwise similarity exceeds a threshold (e.g., 0.85 on Jaccard or TF-IDF cosine), trigger auto-stop.

**Algorithm choice — Jaccard (recommended):**
- Already implemented in the codebase for repetition detection
- Jaccard on word sets: `|A ∩ B| / |A ∪ B|`
- Cheaper than embedding-based cosine similarity (no model needed)
- Good enough for detecting semantic agreement in short agent messages
- Threshold: 0.75–0.85 for convergence (higher than repetition detection threshold)

**When to check:** After every complete round (all agents have responded once). Not after every single message — that would trigger too early.

**What to do on convergence:**
1. Auto-pause the conversation
2. Display a "Convergence detected" notification with the round number
3. Let user choose: stop here, or continue for more rounds
4. Show a brief synthesis prompt (existing summary feature)

**Edge cases:**
- Two agents agreeing, one dissenting: only trigger if ALL pairwise similarities exceed threshold
- Very short responses ("I agree") will score high on Jaccard — consider a minimum response-length guard (e.g., ignore responses under 20 words for convergence check)

**Confidence:** MEDIUM — the approach is sound but threshold calibration requires testing. Initial threshold is a starting guess; the user may need to tune it.

### Conversation Quality Improvements

**What degrades quality:** LLMs default to agreement and elaboration. Without explicit role mandates, agents drift toward consensus after 2-3 turns regardless of the topic. This produces "shallow consensus" — not genuine insight.

**Prompt engineering interventions (no schema changes needed):**

1. **Mandate-based roles:** Each agent's system prompt should include an explicit epistemic stance: "You are the skeptic. Your job is to find flaws in any proposed solution." The current structured prompt fields (role, personality, rules, constraints) already support this — the improvement is in how the orchestrator composes them into the final system message.

2. **Anti-agreement instruction injection:** Before round 2+, prepend a brief meta-instruction to each agent's user turn: "Review the other agents' responses critically. If you agree with them, state specifically WHY you agree and what evidence convinced you — do not simply echo agreement." This reduces vacuous agreement without requiring schema changes.

3. **Topic-lock injection:** After every N turns (e.g., every 5 turns), inject a reminder of the original topic to prevent drift. This is a system message injected into the conversation by the orchestrator, not typed by the user.

4. **Insight-surfacing prompt on summary:** The existing on-demand summary can be improved by changing the summary prompt to explicitly ask for "key insights, unresolved disagreements, and open questions" rather than a plain summary. Schema-free change.

**Confidence:** MEDIUM — prompt engineering improvements are directionally correct but their actual quality impact is hard to predict without running conversations. Mark as "needs validation" after implementation.

### Tech Debt Cleanup

**Known items (from PROJECT.md):**
- `ConversationPanel.tsx` — orphaned file, safe to delete if no imports found
- Test file type errors — likely TypeScript strict-mode violations or missing type imports; fix without changing test logic
- Room detail endpoint over-fetching — endpoint returns more data than the UI needs; refactor to project only required fields

**Approach:** Each item is an isolated fix. No user-visible changes for the orphaned file or type errors. The over-fetching fix may result in a minor response size reduction — validate that existing consumers still receive the fields they use.

---

## Sources

- [Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) — HIGH confidence, peer-reviewed, foundational MAD paper
- [Multi-LLM-Agents Debate: Performance, Efficiency, and Scaling Challenges (ICLR 2025)](https://d2jud02ci9yv69.cloudfront.net/2025-04-28-mad-159/blog/mad/) — MEDIUM confidence, 2025 analysis of MAD limitations
- [Agent Chat Rooms: Multi-Agent Debate for Better AI Outputs (MindStudio)](https://www.mindstudio.ai/blog/agent-chat-rooms-multi-agent-debate-claude-code) — MEDIUM confidence, practitioner implementation guide
- [Emergent Convergence in Multi-Agent LLM Annotation (ACL 2025)](https://aclanthology.org/2025.blackboxnlp-1.12.pdf) — HIGH confidence, peer-reviewed, convergence detection approach
- [Multi-Agent Consensus Seeking via Large Language Models](https://arxiv.org/pdf/2310.20151) — HIGH confidence, peer-reviewed
- [LLM API Pricing 2026: Compare 300+ AI Model Costs](https://pricepertoken.com/) — MEDIUM confidence, community-maintained pricing data
- [LLM API Pricing Comparison 2025 (IntuitionLabs)](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025) — MEDIUM confidence, verified against provider pages
- [Effective context engineering for AI agents (Anthropic)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — HIGH confidence, official Anthropic engineering blog
- [llm-cost npm package](https://github.com/rogeriochaves/llm-cost) — LOW confidence for adoption (last updated 2 years ago, limited provider coverage); noted as anti-pattern, not recommended

---
*Feature research for: Agents Room v1.1 — Conversation Quality & Polish milestone*
*Researched: 2026-03-20*
