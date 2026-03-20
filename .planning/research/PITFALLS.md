# Pitfalls Research

**Domain:** Adding conversation quality improvements, cost estimation, parallel first round, and convergence detection to an existing multi-agent chat system
**Researched:** 2026-03-20
**Confidence:** HIGH (existing codebase inspected, academic research confirmed, multi-source verification)

---

## Critical Pitfalls

### Pitfall 1: Hardcoded Pricing Goes Stale Within Weeks

**What goes wrong:**
You embed a lookup table mapping model IDs to $/million-token rates. Three weeks later, Anthropic drops Claude Sonnet 4 pricing 40%, OpenRouter adds new models with different rate structures, and Gemini introduces separate rates for long-context vs. short-context calls. Your cost estimates are silently wrong. Users see "$0.03 per conversation" when the real cost is $0.01 or $0.08. Worse: when models you don't have in the table are used (e.g., a user configures a custom OpenRouter model), the cost display shows $0.00 or crashes.

**Why it happens:**
LLM pricing dropped roughly 80% between early 2025 and early 2026. Providers change pricing every 1-3 months. Any static data structure representing prices decays immediately. Developers build the table once at implementation time and it becomes archaeology.

**How to avoid:**
- Design the pricing layer with explicit coverage gaps: show "~$X.XX est." only when you have data; show "— (pricing unavailable)" when you don't. Never show $0.00 for a model where the true cost is unknown.
- Store pricing data in a config file (e.g., `pricing.json`) that is trivially editable, not compiled into source code. One-line updates without touching logic code.
- Scope the initial implementation to cover only the specific models configured in the seed data. Don't attempt to cover every possible model.
- Document the pricing date in the config file itself: `"last_updated": "2026-03-20"`.
- Accept that estimates will be imprecise — "~$0.04 (estimated)" is much more useful than false precision at stale rates.

**Warning signs:**
- A model ID appears in the room that has no corresponding entry in the pricing table and the UI shows $0.00.
- Cost totals don't change when switching between an expensive and cheap model.
- The pricing table was written more than 4 weeks ago without a review.

**Phase to address:** Cost estimation phase. Design the unknown-model fallback before building the happy path.

---

### Pitfall 2: Parallel First Round Creates a SQLite Write Contention Problem

**What goes wrong:**
The parallel first round fires multiple `streamLLM` calls concurrently via `Promise.all`. Each resolves with a full response, then tries to `db.insert(messages)` simultaneously. `better-sqlite3` is synchronous and single-writer — concurrent async inserts from different Node.js event loop ticks serialized through the same connection will not cause corruption, but a higher-level race exists: two agents finishing at nearly the same time both call `db.query.rooms.findFirst` to check status, see 'running', and proceed to write. If `stop()` is called mid-parallel-round, the abort signal only cancels in-flight LLM streams; the already-completed responses still write to DB after the stop.

**Why it happens:**
The existing `ConversationManager` is built around a sequential loop where one turn completes before the next begins. The abort/stop model assumes the currently-active controller is the one stream being aborted. Parallelism breaks this assumption: there is no single abort controller for "all parallel first-round calls."

**How to avoid:**
- Allocate one `AbortController` per agent in the parallel round, stored as an array. Register the array in the `activeControllers` map under a composite key or replace the scalar controller with an array.
- Before persisting any parallel-round response, check if the room status is still 'running' after the LLM call returns. Discard responses from rooms that were stopped mid-round.
- Wrap all parallel-round DB inserts in a check: `if (aborted) return` before calling `db.insert`.
- The sequential loop already exists and works. The parallel round is a single-round deviation at the start; after round 1, re-enter the existing sequential loop. Keep the parallel scope minimal.

**Warning signs:**
- `stop()` is called while the first round is in progress and messages still appear after the stop.
- Two messages from different agents have identical `createdAt` timestamps (SQLite `unixepoch()` is second-resolution — two inserts within the same second get the same timestamp, breaking ordering).
- Test: call `stop()` 200ms into a parallel round; verify zero messages persisted after the stop.

**Phase to address:** Parallel first round phase. Resolve the abort-during-parallel-round scenario before shipping.

---

### Pitfall 3: Convergence Detection Fires on Sycophantic Agreement, Not Genuine Consensus

**What goes wrong:**
LLMs are trained to be agreeable. Research (ACL 2025, CONSENSAGENT) shows agents hit their lowest sycophancy in round 1 and become progressively more agreeable over time. An agent saying "I completely agree with Agent B's point" does not mean the conversation has converged on insight — it often means the agent is capitulating to social pressure. A naive convergence detector that looks for agreement phrases or semantic similarity between responses will fire after 3-4 turns and stop the conversation before it has produced any useful output.

Additionally, agents agreeing on a wrong answer is a real failure mode: "coordinated incorrect convergence" is documented in multi-agent debate literature.

**Why it happens:**
Convergence is genuinely hard to define. Semantic similarity measures (cosine, Jaccard) detect topical overlap but cannot distinguish "Agent B is covering the same topic" from "Agent B has accepted Agent A's conclusion." Phrase-matching ("I agree", "you're right") conflates social lubrication with epistemic agreement.

**How to avoid:**
- Require at minimum N consecutive turns of agreement before declaring convergence (e.g., N=3), not just one turn. One "I agree" turn is not convergence.
- Extend the existing Jaccard-based repetition detector: convergence requires *both* semantic similarity across agents AND low novelty (i.e., agents are not introducing new points). Track novelty separately from agreement.
- Always gate convergence detection on a minimum number of turns (e.g., at least 6 total turns before convergence can fire). Premature convergence on short conversations is worse than no convergence detection.
- Emit a `system` message when auto-stopping for convergence so the user understands why the conversation ended. Do not silently stop.
- Allow the user to resume after convergence auto-stop, same as after repetition auto-pause.

**Warning signs:**
- Convergence detection fires after only 2-3 turns.
- The auto-stopped conversation ends with superficial agreement but no concrete insight or resolution in the final messages.
- Agents converge on an obviously wrong or generic answer ("Both agree this is complex and requires further study").

**Phase to address:** Convergence detection phase. Validate the threshold with actual conversations before treating it as production-ready.

---

### Pitfall 4: Timestamp Collision Breaks Message Ordering in Parallel Round

**What goes wrong:**
The `messages` schema uses `createdAt INTEGER` with `default(sql`(unixepoch())`)`. SQLite's `unixepoch()` returns a Unix timestamp in **seconds**. Two messages inserted within the same second get the same `createdAt` value. In the sequential loop this is fine because inserts happen seconds apart. In a parallel first round, all agents complete and insert within a tight window — potentially within the same second. The MessageFeed renders messages in `createdAt` order, so two messages with the same timestamp render in arbitrary (insert-order, not guaranteed) sequence.

**Why it happens:**
Second-resolution timestamps are invisible as a problem in sequential flows. The parallel case is new and the existing schema was never stress-tested for sub-second insert ordering.

**How to avoid:**
- Add a `turnNumber INTEGER` column to the `messages` schema, incremented per agent in the parallel round (agent at position 0 gets turn 0, position 1 gets turn 1, etc.). Use this as a tiebreaker in `ORDER BY createdAt ASC, turnNumber ASC`.
- Alternative: change the timestamp to millisecond resolution using `Date.now()` in application code instead of SQLite's `unixepoch()`. Both approaches work; the turn-number approach is more explicit.
- Migration required: add the column with `DEFAULT 0` so existing messages are unaffected.

**Warning signs:**
- On a page refresh after a parallel first round, the agent message order differs from the order they appeared during streaming.
- Two messages show exactly the same timestamp in the message details.

**Phase to address:** Parallel first round phase. Fix schema before implementing the parallel round logic.

---

### Pitfall 5: Cost Display Causes Anxiety Without Context

**What goes wrong:**
Raw dollar amounts for LLM costs look alarming without context. "$0.84 spent" on a conversation makes users feel like they're being charged significantly, even when the actual cost is trivially small relative to the value. Conversely, "$0.0003 per message" looks meaningless and users can't gauge whether they're spending a lot or a little. Neither framing helps the user understand their usage.

More concretely: displaying cost as a running real-time number that ticks up during streaming creates psychological discomfort that wasn't there before. The app currently shows token counts, which are abstract; cost is concrete and triggers loss aversion.

**Why it happens:**
Cost display is designed by engineers who know the costs are small, not by users experiencing the display for the first time. The information is technically correct but behaviorally counterproductive.

**How to avoid:**
- Display cost as a session total, not a per-message real-time update. Let it update after each turn completes, not during streaming.
- Show the cost in context: "$0.04 this conversation" rather than just "$0.04".
- For the personal-tool use case, display "est." prefix on all figures to set expectation that these are approximate.
- Do not make cost the most prominent element. It's a secondary metric. Token counts (already displayed) provide the abstract signal; cost is a gloss on top.

**Warning signs:**
- The cost figure updates every token during streaming (causes visual jitter and anxiety).
- The UI shows cost without the "est." qualifier, implying billing precision that a static pricing table cannot provide.
- First-time use: the user's reaction to the cost display is surprise or concern rather than "useful to know."

**Phase to address:** Cost estimation phase. Test the display with realistic conversation costs before shipping.

---

### Pitfall 6: Conversation Quality Improvements That Break Existing Tests

**What goes wrong:**
Improving the system prompts injected by `ContextService.buildContext` — adding conversational anchors, role reminders, or quality-directing instructions — changes the exact string passed to `streamLLM`. Any test that asserts on the exact system prompt string will fail. More subtle: if quality improvement changes how `ContextService` builds the message array (e.g., filtering messages differently, inserting a quality-reminder at a specific position), the 121 existing passing tests may break in ways that are correct behavior but require test updates.

**Why it happens:**
Tests for `ContextService` are written against the current implementation. When the implementation deliberately changes (improvement, not bug), tests fail as false negatives. The risk is: developer sees 10 failing tests and reverts the quality improvement thinking it broke something, when actually the tests just needed updating.

**How to avoid:**
- Before any changes to `ContextService`, read the existing test file (`tests/conversation/context-service.test.ts`) and identify which assertions are about *exact output strings* vs. *structural properties* (e.g., "starts with user role", "contains the topic").
- Structural assertions are valid and should be preserved. Exact string assertions should be updated to match the new quality-improved output.
- Run the test suite before and after each quality change. A diff of failing tests is the work list.
- If adding a new quality feature (e.g., "inject a quality directive every 5 turns"), test it in isolation before combining with other changes.

**Warning signs:**
- More than 5 tests fail after a prompt wording change — likely means test strings were copy-pasted from old output.
- The test failures are in `context-service.test.ts` and `manager.test.ts` simultaneously — means a shared behavior changed.
- Tests pass but the quality behavior is not verified (no new tests were added for the new behavior).

**Phase to address:** Conversation quality phase. Test-first: read existing tests before touching `ContextService`.

---

### Pitfall 7: Parallel First Round Changes the "First Message" Assumption in ContextService

**What goes wrong:**
`ContextService.buildContext` has special handling for the first message: if the message history is empty or starts with an assistant turn, it injects the room topic as a seeding `user` message. This works correctly for the sequential loop where the first agent goes first. In a parallel first round, all agents call `buildContext` with an empty room history simultaneously. Every agent gets the same topic-seeded context, which is correct. But after the parallel round, the message history has multiple agent messages at position 0-N. On the first turn of the sequential loop after the parallel round, `buildContext` reads history that starts with multiple `agent` role messages — the "starts with assistant" case triggers and re-injects the topic, creating a duplicate topic injection visible in the context.

**Why it happens:**
The existing seeding logic was designed for a single first message. When multiple messages exist from the start (all from the parallel round), the head-of-history check fires unexpectedly.

**How to avoid:**
- The seed injection condition should check whether the room topic has already appeared in the history, not just whether the first message has a `user` role.
- Simpler: in the parallel round, explicitly insert a `user`-role "Discussion topic" system message to the DB before firing the parallel round. This becomes the actual first message in history, and `buildContext`'s existing logic works correctly because the history always starts with that user seed message.
- The latter approach (explicit DB seed) is cleaner and requires no logic change to `ContextService`.

**Warning signs:**
- After a parallel first round, the first sequential turn's context has two consecutive "Discussion topic:" user messages.
- Unit test: run `buildContext` against a history that starts with 3 agent messages and verify the topic is injected exactly once.

**Phase to address:** Parallel first round phase. Add this edge case to the acceptance criteria before shipping.

---

### Pitfall 8: Tech Debt Cleanup Introduces Regressions via Incomplete Dead Code Removal

**What goes wrong:**
`ConversationPanel.tsx` is documented as orphaned. If it is deleted without checking all import paths, any file that still imports it will throw a module-not-found error at build time. More insidiously: if a file imports it with a dynamic `import()` or if it's referenced in a barrel export, the error only appears at runtime, not build time. Fixing type errors in test files can also unintentionally change behavior if a type assertion was hiding a real type mismatch that existed in production code.

**Why it happens:**
Dead code is rarely as dead as it appears. IDEs' "find usages" can miss dynamic imports, string-based requires, and indirect references through re-export files.

**How to avoid:**
- Before deleting `ConversationPanel.tsx`: run `grep -r "ConversationPanel" src/` and check all results. Verify there are no dynamic imports.
- Fix type errors in test files by fixing the actual type, not by casting with `as unknown as X`. Type casts in tests hide real problems.
- After any dead code deletion, run `npm run build` to confirm no build errors before running tests. Build errors are faster to find than runtime errors.
- Make type-error fixes and dead code removal separate commits from feature changes. This makes regressions attributable to specific changes.

**Warning signs:**
- Running `tsc --noEmit` shows errors in files other than the one you just edited.
- A test passes after changing it to use `as any` instead of fixing the underlying type.
- The over-fetching fix (room detail endpoint) accidentally removes a field that another component was relying on.

**Phase to address:** Tech debt cleanup phase. Always precede cleanup with a grep scan and a build run.

---

## Technical Debt Patterns

Shortcuts specific to v1.1 additions.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode prices in TypeScript source constants | No config file needed | Prices stale within weeks; requires code change to update | Never — move to JSON config immediately |
| Show $0.00 for unknown models instead of "—" | No fallback UI needed | Users think free models cost nothing; masks missing data | Never |
| Skip the minimum-turns guard in convergence detection | Simpler implementation | Fires after 2 turns of politeness, stops productive conversations | Never |
| Reuse the existing single AbortController for parallel round | No API change to ConversationManager | Cannot abort individual agents mid-parallel-round; stop() leaves orphaned responses | MVP only if parallel round is fire-and-forget with no stop path |
| Use second-resolution timestamps for ordering | No schema change needed | Message order is non-deterministic within parallel-round inserts | Only if parallel round is artificially serialized (defeats the purpose) |
| Overwrite PITFALLS.md from v1.0 with v1.1 content | Clean file | v1.0 pitfalls remain relevant as the foundation | Acceptable only if v1.0 pitfalls are preserved in a separate section |

---

## Integration Gotchas

Specific to the new features being added.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenRouter cost | Assuming all models have the same per-token rate; some charge per-request minimums | Check OpenRouter's pricing page; some models have floor prices per call regardless of token count |
| Ollama cost | Treating local models as "$0.00 cost" | Electricity and compute cost is real but unmeasurable; display "local model — no API cost" rather than $0.00 |
| Vercel AI SDK `usage` field | Assuming `result.usage` is always populated | Some providers/models return `null` usage; the existing gateway already handles this but the cost layer must also guard against null |
| Parallel `Promise.all` for LLM calls | Assuming all providers have equivalent concurrency limits | Anthropic allows high concurrency; Ollama is single-threaded locally; parallel round with a local Ollama agent is effectively sequential |
| Convergence detection + LLM-selected speaker | Checking convergence after every turn and using that result to influence the LLM speaker selector | Run convergence check after each turn independently; do not feed convergence signal into the speaker selector prompt (creates circular dependency) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Computing cost on every token event during streaming | Cost UI jitters; unnecessary recalculations per token | Compute cost after `turn:end` when final token counts are known | Every streaming message |
| Running Jaccard convergence check against all messages in room | Query time grows with conversation length | Apply convergence window (same as repetition window: last 5-6 messages) | After ~30 messages |
| Parallel first round with 4+ agents on slow providers | UI appears frozen for 15-20s while all agents are "thinking" simultaneously | Show individual per-agent thinking indicators during parallel round, not a single global spinner | 3+ agents with >5s generation time |
| Fetching pricing table from network on every cost calculation | Latency added to every turn, network dependency for local app | Bundle pricing config with the app; reload only on startup | Any network-dependent cost path |

---

## Security Mistakes

Personal tool — attack surface is narrow. Pitfalls are operational, not adversarial.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Pricing config file that can be edited by room topic input | Crafted topic causes path traversal to pricing file | Pricing data is read-only at startup; never written based on user input |
| Displaying exact cost to the cent | User over-optimizes to "free" models, degrading conversation quality | Display as "est." to communicate imprecision; cost is informational, not billing |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Convergence auto-stop with no explanation message | User confused why conversation stopped early | Emit a system message: "[Auto-stopped: agents appear to have reached consensus]" with a resume option |
| Cost figure updates during streaming (per-token) | Visual jitter; anxiety about cost growing in real time | Update cost only after `turn:end` event when final token count is known |
| Parallel first round looks the same as sequential to the user | Value of parallel round is invisible | Consider a subtle UI indicator during the first round: "Independent responses..." |
| Cost display with no pricing-date disclosure | User trusts stale estimate as accurate | Include a small "Pricing as of [date]" note near cost display |
| Convergence stopped a conversation that wasn't actually done | User has no way to continue without losing context | Convergence auto-stop should pause (like repetition does), not stop — preserves resume path |

---

## "Looks Done But Isn't" Checklist

- [ ] **Cost estimation:** Shows a number — verify unknown models display "—" not "$0.00", and that Ollama shows "local model" not a number.
- [ ] **Cost estimation:** Demo conversation looks right — verify the total accumulates correctly across all agents, including after a resume.
- [ ] **Parallel first round:** Agents respond independently — verify calling `stop()` mid-parallel-round results in zero persisted messages from that round.
- [ ] **Parallel first round:** Responses appear in UI — verify message ordering after the round is deterministic and matches agent positions.
- [ ] **Convergence detection:** Fires after 10 turns of genuine agreement — verify it does NOT fire after 2-3 turns of polite agreement phrases.
- [ ] **Convergence detection:** Stops conversation — verify it emits a system message explaining why and the room status is 'paused' (resumable), not 'idle'.
- [ ] **Tech debt cleanup:** ConversationPanel.tsx deleted — verify `npm run build` passes with no module-not-found errors.
- [ ] **Tech debt cleanup:** Type errors fixed — verify `tsc --noEmit` shows zero errors after fixes, and no `as any` casts were added.
- [ ] **Quality improvements:** System prompt changes made — verify existing tests updated to match new output, and new tests added for new behavior.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale pricing table discovered | LOW | Update the JSON config file with current prices; no code change required if config is external |
| Convergence fires too aggressively (too many false positives) | LOW | Increase minimum-turns threshold; users can resume, conversations aren't lost |
| Parallel round creates ordering bugs discovered in production | MEDIUM | Add `turnNumber` column via migration; reorder MessageFeed query |
| Quality prompt changes broke existing tests | LOW | Update test assertions to match new output; no behavior regression, only output format |
| Dead code deletion broke a build | LOW | Revert the deletion; add the missing file back; grep all imports before re-deleting |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stale hardcoded pricing | Cost estimation phase | Unknown model shows "—" in UI; pricing config file is separate from source code |
| Parallel round abort during stop() | Parallel first round phase | stop() called mid-round results in zero persisted messages |
| Timestamp collision in parallel round | Parallel first round phase | Message order after round is deterministic on page refresh |
| ContextService topic double-injection | Parallel first round phase | Context for first sequential turn after parallel round has exactly one topic message |
| False positive convergence on sycophancy | Convergence detection phase | Convergence requires minimum 6 turns before it can fire; test with polite-but-empty agreement |
| Convergence stops instead of pauses | Convergence detection phase | Room status after convergence auto-stop is 'paused'; resume works |
| Quality changes break existing tests | Conversation quality phase | Test suite passes after quality changes; no `as any` additions |
| Dead code cleanup regressions | Tech debt cleanup phase | `tsc --noEmit` and `npm run build` both pass after cleanup |
| Cost display anxiety | Cost estimation phase | Cost shows "est." prefix; updates only after turn:end, not per-token |

---

## Sources

- [CONSENSAGENT: Sycophancy Mitigation in Multi-Agent LLM Interactions — ACL 2025](https://aclanthology.org/2025.findings-acl.1141/)
- [Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate — arXiv 2025](https://arxiv.org/pdf/2509.23055)
- [Talk Isn't Always Cheap: Failure Modes in Multi-Agent Debate — arXiv 2025](https://arxiv.org/pdf/2509.05396)
- [LLM API Pricing Comparison (March 2026) — costgoat.com](https://costgoat.com/compare/llm-api)
- [LLM API Pricing (March 2026) — tldl.io](https://www.tldl.io/resources/llm-api-pricing-2026)
- [SQLite concurrency and why you should care — Hacker News discussion](https://news.ycombinator.com/item?id=45781298)
- [Understanding Better-SQLite3: The Fastest SQLite Library for Node.js — DEV Community](https://dev.to/lovestaco/understanding-better-sqlite3-the-fastest-sqlite-library-for-nodejs-4n8)
- [Concurrent vs. Parallel Execution in LLM API Calls — Towards AI](https://towardsai.net/p/machine-learning/concurrent-vs-parallel-execution-in-llm-api-calls-from-an-ai-engineers-perspective)
- [Selective agreement, not sycophancy: opinion dynamics in LLM interactions — Springer 2025](https://link.springer.com/article/10.1140/epjds/s13688-025-00579-1)
- [Context Rot: How Increasing Input Tokens Impacts LLM Performance — Chroma Research](https://research.trychroma.com/context-rot)
- Existing codebase inspection: `src/lib/conversation/manager.ts`, `context-service.ts`, `speaker-selector.ts`, `db/schema.ts`, `lib/sse/stream-registry.ts`

---
*Pitfalls research for: Agents Room v1.1 — adding cost estimation, parallel first round, convergence detection, and quality improvements to existing system*
*Researched: 2026-03-20*
