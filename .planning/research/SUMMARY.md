# Project Research Summary

**Project:** Agents Room v1.1 — Conversation Quality & Polish
**Domain:** Multi-agent AI chat room — adding conversation quality, cost estimation, parallel first round, and convergence detection to existing system
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

Agents Room v1.1 builds on a validated v1.0 foundation (Next.js 16, Vercel AI SDK v6, Drizzle + SQLite, Zustand, Tailwind v4) by adding four focused features: conversation quality improvements, cost estimation, parallel first round, and convergence detection. The research confirms that all four features integrate at the existing `ConversationManager` → `ContextService` → `Gateway` seam without new API routes or major schema changes (one boolean column excepted). The recommended build order is: quality prompts first (enables reliable convergence signals), then cost estimation (fully independent, zero risk), then convergence detection (depends on quality signals), then parallel first round (highest-complexity, touches the turn loop entry point). Only one new production dependency is required: `llm-info@^1.0.69` for static per-model pricing data.

The biggest architectural insight is that apparent complexity in these features is mostly illusory. Cost estimation is a pure client-side derivation from token data already in SSE events — no DB changes, no turn-loop changes, just a new `CostEstimator` module and chatStore additions. Convergence detection reuses the existing `jaccardSimilarity()` function and mirrors the already-working repetition detection pattern. Parallel first round requires the most care but is isolated to round 0 only (guarded by `messageCount === 0`) with all subsequent rounds unchanged. The existing SSE infrastructure, `status`/`system` event types, and chatStore streaming state are all reused without modification.

The critical risks are: (1) false-positive convergence detection firing on sycophantic agreement rather than genuine consensus — requiring minimum-turn guards and AND logic between phrase and similarity signals; (2) timestamp collisions in parallel round inserts breaking message ordering — requiring either a `turnNumber` column or millisecond-resolution timestamps; (3) stale pricing data — requiring an external config file with an "est." disclaimer rather than hardcoded source constants. All three risks have clear prevention strategies documented in the research with no ambiguity about the correct approach.

## Key Findings

### Recommended Stack

The v1.0 stack requires no substantive additions. `llm-info@^1.0.69` is the single new production dependency — zero runtime dependencies, MIT license, covers all three paid providers (Anthropic, OpenAI, Google) via `ModelInfoMap` keyed by model ID string. OpenRouter and Ollama agents show "N/A" and "local" respectively, not a dollar cost figure. All other features (parallel first round, convergence detection, quality improvements, tech debt cleanup) use existing installed packages.

**Core technologies (v1.0 baseline, validated and unchanged):**
- `Next.js 16` + Vercel AI SDK `^6.0.116`: streaming infrastructure, provider abstraction — validated
- `better-sqlite3` + Drizzle ORM `^0.45.1`: synchronous SQLite, schema-push workflow — validated
- `Zustand`: client state including streaming state, token totals — validated

**New dependency:**
- `llm-info@^1.0.69`: static per-model pricing for cost estimation — zero deps, MIT, actively maintained (70 published versions as of March 2026)

**Installation:** `npm install llm-info` — the only install command for the entire v1.1 milestone.

**What to avoid adding:** `tiktoken` or tokenizer libraries (token counts already come from provider API responses), OpenRouter pricing lookup (dynamic routing makes static pricing meaningless), `langchain`/LangGraph (100+ transitive deps for 20 lines of logic), persisting computed cost in DB (derives from existing columns, persisting creates drift).

### Expected Features

**Must have (table stakes for v1.1):**
- Cost estimation display — token counts already shown; dollar amounts are the natural completion; users running multiple agents across multiple turns need cost awareness
- Convergence auto-stop — users expect the system to recognize consensus without manual monitoring; turn limit alone is insufficient as a stopping condition
- Tech debt cleanup — orphaned `ConversationPanel.tsx`, test type errors, room detail over-fetching; a quality milestone that ignores internal quality is incomplete

**Should have (differentiators for v1.1):**
- Independent parallel first round — eliminates herding/anchoring on the first sequential response; Multi-Agent Debate research (MAD, ACL 2025) confirms this as the canonical technique for genuine independent perspectives
- Conversation quality improvements via prompt engineering — anti-agreement instructions, topic-lock injection, and quality-directing framing in `ContextService.buildContext()`; also enables reliable convergence detection downstream

**Defer to v1.2+:**
- Per-agent cost breakdown — room-level totals ship in v1.1; per-agent detail is low priority
- Asymmetric context injection — adds config surface area; validate quality improvements first
- Agent long-term memory — too complex; out of scope per PROJECT.md

### Architecture Approach

All four features land at the `ConversationManager` → `ContextService` seam following the "Augment, Don't Replace" pattern. Parallel first round adds a branch before the loop guarded by `messageCount === 0`. Convergence detection adds a check alongside the existing repetition check. Quality prompts extend `buildContext()` without changing its contract. Cost estimation is client-side derivation that never enters the turn loop. The existing SSE infrastructure (events keyed by `agentId`), streaming state machine, and `status`/`system` event types are all reused without modification.

**Components changed:**
1. `lib/conversation/manager.ts` (MODIFIED) — parallel first round branch, convergence check after each turn
2. `lib/conversation/context-service.ts` (MODIFIED) — quality framing in `buildContext()`, new `detectConvergence()` static method
3. `lib/conversation/cost-estimator.ts` (NEW) — static pricing table via `llm-info`, `computeCost()`, `estimateRoomCost()`
4. `stores/chatStore.ts` (MODIFIED) — per-message `estimatedCost` field, total cost accumulator, `loadHistory` uses `estimateRoomCost`
5. Cost display UI component (NEW) — renders cost per message and room total in header

**Unchanged:** `speaker-selector.ts`, `lib/llm/gateway.ts`, `lib/sse/stream-registry.ts`, `db/schema.ts` (except one boolean column), all API routes.

**Key data flow for cost:** SSE `turn:end` already carries `inputTokens`, `outputTokens`; `turn:start` already carries `model` and `provider`. `CostEstimator.computeCost()` runs in `chatStore.completeTurn()` — no extra API call, no DB change, no turn-loop modification.

**Key data flow for convergence:** After each `turn:end` persist, `ContextService.detectConvergence(db, roomId)` queries last N agent messages, applies 2-signal AND logic (keyword phrases + Jaccard similarity), and if both signals true: sets room status to 'paused', inserts a system message, emits existing `status` and `system` SSE event types.

**Parallel round SSE constraint:** `chatStore.streaming` holds a single `StreamingState` slot. Truly parallel token streaming would break the client state machine. Solution: run all LLM calls in parallel but buffer each agent's full response, then emit SSE sequentially per agent — preserving the latency benefit (slowest agent time vs. sum of all) without client-side changes.

### Critical Pitfalls

1. **False-positive convergence on sycophantic agreement** — LLMs are structurally predisposed to agreement in group settings (ACL 2025, CONSENSAGENT). Require both keyword AND Jaccard similarity signals (AND logic, threshold 0.35), minimum 6 turns before convergence can fire, and a minimum response-length guard (ignore responses under 20 words). Convergence auto-stop must pause (resumable), not stop permanently.

2. **Timestamp collision breaks parallel round message ordering** — SQLite `unixepoch()` is second-resolution; multiple inserts within the same second get identical `createdAt` values. Add a `turnNumber INTEGER` column with `DEFAULT 0` as a tiebreaker in `ORDER BY createdAt ASC, turnNumber ASC`. Migration via `drizzle-kit push` (established project pattern).

3. **Abort during parallel round leaves orphaned persisted messages** — allocate one `AbortController` per agent, stored as an array in `activeControllers`. Before persisting any parallel-round response, check if room status is still 'running'. Wrap all parallel-round DB inserts in an abort check.

4. **Stale hardcoded pricing** — never embed prices in TypeScript source constants. Use `llm-info` as the pricing source (community-maintained, 70 version updates tracking model launches). Display "est." prefix on all cost figures. Show "—" for unknown models, never "$0.00" which implies falsely that the model is free.

5. **ContextService topic double-injection after parallel round** — the existing seeding logic checks if history starts with a `user` role message. After a parallel round, history starts with multiple agent messages, which re-triggers topic injection on the first sequential turn. Fix: explicitly insert a `user`-role topic seed message to DB before firing the parallel round, making the first DB record always the user seed.

## Implications for Roadmap

Based on research, the dependency chain is clear: quality prompts enable reliable convergence signals; cost estimation is fully independent; parallel first round is highest-risk and should follow proven stable features.

### Phase 1: Conversation Quality Improvements

**Rationale:** Zero dependencies on other features; isolated to `ContextService.buildContext()`; making agents use explicit agreement language also improves convergence detection reliability downstream. Build this first so it is stable before adding the convergence check that depends on it.
**Delivers:** Anti-sycophancy instructions, topic-lock injection every N turns, anti-agreement meta-instruction prepended before round 2+, improved summary prompts explicitly requesting insights/unresolved disagreements/open questions.
**Addresses:** Conversation quality differentiator from FEATURES.md.
**Avoids:** Test-regression pitfall — read existing `context-service.test.ts` before touching `buildContext()`, update string assertions before adding new behavior. No `as any` casts to make tests pass.

### Phase 2: Cost Estimation

**Rationale:** Fully independent of all other features; zero risk of breaking existing behavior; ships immediate user value. Validates the chatStore modification pattern (adding fields to `completeTurn()`) at low risk before the more complex parallel round changes touch the same file.
**Delivers:** `lib/conversation/cost-estimator.ts` with `llm-info`-backed `computeCost()` and `estimateRoomCost()`; per-message "est. $X.XX" display; room total in header; "—" for unknown models; "local" for Ollama; "Pricing as of [date]" disclosure.
**Addresses:** Cost estimation table stakes from FEATURES.md.
**Avoids:** Stale-pricing pitfall (use `llm-info`, not hardcoded constants); cost-anxiety UX pitfall (update cost only after `turn:end`, not per-token); false precision (display "est." prefix throughout).

### Phase 3: Convergence Detection

**Rationale:** Depends on Phase 1 quality prompts for reliable phrase signals. Mirrors the existing `detectRepetition()` pattern — same DB query shape, new detection logic — so implementation risk is low once quality prompts are stable.
**Delivers:** `ContextService.detectConvergence()` with 2-signal AND logic (agreement keyword phrases + Jaccard similarity threshold 0.35); minimum 6-turn guard; auto-pause on convergence with system message explaining why; resume path preserved (same as repetition auto-pause).
**Addresses:** Convergence auto-stop table stakes from FEATURES.md.
**Avoids:** False-positive convergence pitfall via AND logic and minimum-turn guard; sycophancy-triggered false stop; permanent stop instead of pausable state.

### Phase 4: Parallel First Round

**Rationale:** Highest-complexity change — modifies the turn loop entry point, which is the highest-risk area of the codebase. Should be built after the other features are stable so the test suite provides a solid regression baseline. The `messageCount === 0` guard isolates the change to round 0 only.
**Delivers:** `parallelFirstRound: boolean` column in rooms table; `ConversationManager.start()` branch firing all agents via `Promise.all` when `messageCount === 0`; per-agent AbortController array; sequential SSE emission of buffered responses; "Agents forming independent views..." UI indicator during parallel phase; latency improvement (slowest agent time vs. sum of all).
**Addresses:** Independent parallel first round differentiator from FEATURES.md.
**Avoids:** Three parallel-specific pitfalls: abort during parallel round (per-agent AbortControllers + abort check before persist), timestamp collision (turnNumber column + drizzle-kit push migration), ContextService double-injection (explicit user-role topic seed inserted to DB before parallel round fires).

### Phase 5: Tech Debt Cleanup

**Rationale:** Interleaved throughout is ideal — type errors fixed alongside whichever feature touches the affected file, orphaned file removed early. If executed as a standalone phase, do it after parallel round is stable so the full regression baseline is in place.
**Delivers:** `ConversationPanel.tsx` removed (grep all imports first, run `npm run build` to verify), zero `tsc --noEmit` errors (no `as any` casts added), room detail endpoint over-fetching fixed (validate existing consumers still receive required fields).
**Addresses:** Tech debt cleanup table stakes from FEATURES.md.
**Avoids:** Dead code removal regression pitfall (grep + build before delete); type-cast pitfall (fix underlying types, not symptoms); over-fetching fix regression (validate field coverage before shipping).

### Phase Ordering Rationale

- **Quality before convergence:** Quality prompts produce explicit agreement language ("I concur", "we've established") that the phrase-based convergence detector relies on. Building convergence without quality prompts first means the detector operates on sycophantic filler rather than genuine signals.
- **Cost before parallel round:** Cost estimation validates the chatStore modification pattern at low risk. Parallel round touches the same `chatStore.ts` with more complex changes that benefit from a stable baseline.
- **Parallel round last among features:** The turn loop entry point is the highest-risk modification surface. A complete regression baseline (test suite with quality, cost, and convergence phases stable) provides the best safety net.
- **Tech debt interleaved:** Cleanup is easiest when the file being cleaned is already open for another feature change. The orphaned file removal is independent of all features and can happen any time.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Parallel First Round):** The abort-during-parallel-round scenario and the ContextService double-injection edge case are complex enough to warrant explicit acceptance test writing before implementation. The `turnNumber` schema migration needs to be planned before touching the turn loop. Recommend `/gsd:research-phase` for this phase.

Phases with standard patterns (skip research):
- **Phase 1 (Quality):** Prompt engineering improvements follow clear patterns; no external integration; validated by test suite.
- **Phase 2 (Cost):** `llm-info` integration is a straightforward static lookup; well-documented package.
- **Phase 3 (Convergence):** Mirrors existing `detectRepetition()` pattern; algorithm is research-documented.
- **Phase 5 (Tech Debt):** Grep + build + tsc workflow; no research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `llm-info` inspected locally — `ModelInfoMap`, `ModelInfo` types confirmed. Pricing cross-referenced with official Anthropic pricing page ($3/$15 per MTok for Claude Sonnet 4 matches). Parallel IIFE pattern validated via Vercel AI SDK documentation. |
| Features | HIGH | Cost estimation and parallel first round patterns confirmed by peer-reviewed MAD research (arXiv, ACL 2025). Convergence detection approach validated by ACL 2025 CONSENSAGENT paper. Quality improvements confirmed by Anthropic context engineering blog. |
| Architecture | HIGH | Direct codebase analysis of all relevant modules (`manager.ts`, `context-service.ts`, `speaker-selector.ts`, `gateway.ts`, `stream-registry.ts`, `chatStore.ts`, `db/schema.ts`). Integration points confirmed from source. No inference — component boundaries derived from actual file inspection. |
| Pitfalls | HIGH | Multiple peer-reviewed sources on sycophancy and convergence failure modes (ACL 2025, arXiv 2025). SQLite timestamp issue confirmed by schema inspection and known `unixepoch()` second-resolution behavior. Abort-during-parallel-round scenario derives from ConversationManager's existing abort model (inspected directly). |

**Overall confidence:** HIGH

### Gaps to Address

- **Convergence threshold calibration:** The Jaccard similarity threshold (0.35) and minimum-turn guard (6 turns) are research-informed starting points, not validated values. Plan for a post-ship tuning pass after Phase 3. The threshold is a configurable constant — adjusting it requires no structural changes.
- **Ollama concurrency in parallel round:** Ollama is single-threaded locally, meaning the parallel first round with an Ollama agent is effectively sequential even when `Promise.all` fires. Not a bug but a UX gap — the latency benefit disappears for local agents. Consider a per-provider concurrency note in the UI during the parallel phase.
- **Quality prompt effectiveness:** Prompt engineering improvements are directionally correct but actual quality impact is not predictable without running real conversations. Mark quality improvements as "needs validation" after Phase 1 ships; be prepared to iterate on wording.
- **OpenRouter cost display:** OpenRouter routing is dynamic — static pricing is not meaningful. Research confirms "N/A" is the correct display, but this means OpenRouter users get zero cost information. Acceptable for v1.1; revisit if OpenRouter usage is significant.

## Sources

### Primary (HIGH confidence)

- `npmjs.com/package/llm-info` — Package metadata, zero deps, `ModelInfoMap` and `ModelInfo` types inspected locally, provider coverage verified
- Anthropic pricing page (`platform.claude.com/docs/en/about-claude/pricing`) — Claude Sonnet 4 at $3/$15 per MTok cross-referenced with `llm-info` data
- [Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) — Foundational MAD paper; parallel first round pattern
- [CONSENSAGENT: Sycophancy Mitigation in Multi-Agent LLM Interactions — ACL 2025](https://aclanthology.org/2025.findings-acl.1141/) — Sycophancy structural property, convergence keyword+similarity approach
- [Emergent Convergence in Multi-Agent LLM Annotation (ACL 2025)](https://aclanthology.org/2025.blackboxnlp-1.12.pdf) — Convergence detection approach
- [Multi-Agent Consensus Seeking via Large Language Models](https://arxiv.org/pdf/2310.20151) — Convergence algorithm validation
- [Effective context engineering for AI agents (Anthropic)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Quality prompt design patterns
- Direct codebase analysis: `src/lib/conversation/manager.ts`, `context-service.ts`, `speaker-selector.ts`, `gateway.ts`, `sse/stream-registry.ts`, `stores/chatStore.ts`, `db/schema.ts`

### Secondary (MEDIUM confidence)

- [Multiple Parallel AI Streams with the Vercel AI SDK](https://mikecavaliere.com/posts/multiple-parallel-streams-vercel-ai-sdk) — IIFE pattern for parallel `streamText` calls
- [Multi-Agent Debate: Performance, Efficiency, and Scaling Challenges (ICLR 2025)](https://d2jud02ci9yv69.cloudfront.net/2025-04-28-mad-159/blog/mad/) — MAD limitations and parallel round design tradeoffs
- [Agent Chat Rooms: Multi-Agent Debate (MindStudio)](https://www.mindstudio.ai/blog/agent-chat-rooms-multi-agent-debate-claude-code) — Practitioner implementation guide
- LLM API Pricing (March 2026) — costgoat.com, tldl.io — cross-reference for pricing ranges
- [Peacemaker or Troublemaker: Sycophancy in Multi-Agent Debate — arXiv 2025](https://arxiv.org/pdf/2509.23055) — Sycophancy failure modes corroboration

### Tertiary (LOW confidence)

- `pricepertoken.com` — Community pricing aggregator; used only as cross-reference, not authoritative source

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
