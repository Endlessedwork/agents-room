# Stack Research

**Domain:** Multi-agent AI chat room (personal web app, real-time, multi-LLM provider)
**Researched:** 2026-03-20 (v1.1 update — new features only)
**Confidence:** HIGH (llm-info library), HIGH (parallel pattern), MEDIUM (convergence approach)

---

## v1.0 Baseline (DO NOT RE-RESEARCH)

Already installed and validated:

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | `^16.2.0` | Validated |
| Vercel AI SDK (`ai`) | `^6.0.116` | Validated |
| `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` | `^3.x` | Validated |
| `ollama-ai-provider-v2`, `@openrouter/ai-sdk-provider` | latest | Validated |
| Drizzle ORM + SQLite (`better-sqlite3` + `drizzle-kit`) | `^0.45.1` / `^0.31.10` | Validated |
| Zustand, Tailwind v4, shadcn/ui (Base UI), Biome, Vitest | — | Validated |
| `zod`, `nanoid`, `date-fns`, `lucide-react` | — | Validated |

The v1.0 stack document covers rationale for all of the above. This document covers **only what v1.1 needs**.

---

## New Dependencies Required for v1.1

### Only One New Production Dependency

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `llm-info` | `^1.0.69` | Static per-model pricing data for cost estimation | Zero runtime dependencies. Covers all three paid providers (Anthropic, OpenAI, Google). Provides `pricePerMillionInputTokens` and `pricePerMillionOutputTokens` on every `ModelInfo` entry. Has `ModelInfoMap` (keyed by model ID string) and `getModelInfoWithId()`. MIT license. 70 published versions as of March 2026 — actively maintained. No other npm package offers multi-provider static pricing with this coverage. |

### No New Libraries for the Other Three Features

**Parallel first round:** Pure application logic change to `ConversationManager`. Pattern is to fire N `streamLLM()` calls as non-awaited IIFEs (one per agent), then collect with `Promise.allSettled()`. The existing `emitSSE()` fan-out already handles concurrent `turn:start`/`token`/`turn:end` events keyed by `agentId`. No new library required.

**Convergence detection:** New `ContextService.detectConvergence()` method reusing the existing `jaccardSimilarity()` function already in-file, plus keyword phrase scanning. No external library required. Research confirms this 2-signal approach (keywords + content similarity) is used in production multi-agent NLP systems.

**Quality conversations / prompting improvements:** System prompt changes to `ContextService.buildContext()`. No new library required.

**Tech debt cleanup:** TypeScript compiler + Biome. Both already installed.

---

## Installation

```bash
# The only new install for v1.1
npm install llm-info
```

---

## Integration Points

### Cost Estimation — `llm-info`

`llm-info` exports `ModelInfoMap` as a plain object keyed by model ID strings (matching `ModelEnum` values like `"claude-sonnet-4-20250514"`). The app already stores `model` as a string per message in the `messages` table. Integration is a lookup utility — no new API calls, no async, pure computation:

```typescript
import { ModelInfoMap } from 'llm-info';

export function estimateCost(
  modelId: string,
  inputTokens: number | null,
  outputTokens: number | null
): number | null {
  if (!inputTokens || !outputTokens) return null;
  const info = ModelInfoMap[modelId as keyof typeof ModelInfoMap];
  if (!info?.pricePerMillionInputTokens || !info?.pricePerMillionOutputTokens) return null;
  return (inputTokens / 1_000_000) * info.pricePerMillionInputTokens
       + (outputTokens / 1_000_000) * info.pricePerMillionOutputTokens;
}
```

**Provider coverage by current app providers:**

| App Provider | llm-info Coverage | Display |
|-------------|------------------|---------|
| `anthropic` | YES — claude-sonnet-4, claude-opus-4, claude-haiku-4-5 family | USD cost |
| `openai` | YES — gpt-4o, gpt-4.1, gpt-5 family | USD cost |
| `google` | YES — gemini-2.5-pro, gemini-2.5-flash family | USD cost |
| `openrouter` | NO — OpenRouter is a passthrough; per-request routing determines actual model | Show "N/A" |
| `ollama` | NO — local inference, free | Show "local" |

**Pricing staleness (MEDIUM confidence):** `llm-info` is community-maintained and may lag official pricing by 2–4 weeks per model change. Verified sample: `claude-sonnet-4-20250514` shows $3/$15 per million tokens. This is within normal range for a personal cost-awareness tool — not billing software. Add a UI disclaimer: *"Cost estimates based on approximate published pricing."*

**Cost display approach:** Compute at read time from stored `inputTokens`/`outputTokens`. Do not store computed costs in DB — they are fully derivable and pricing data changes. Expose per-message cost via the existing room messages API response (add `estimatedCost` to the DTO), and aggregate room total in the room detail endpoint.

---

### Parallel First Round

**Schema change required:** Add `parallelFirstRound` boolean column to `rooms` table.

```typescript
// In schema.ts — rooms table addition
parallelFirstRound: integer('parallel_first_round', { mode: 'boolean' })
  .notNull()
  .default(false),
```

Apply via `npx drizzle-kit push` (no migration file needed for this personal local-only app — already the established pattern).

**ConversationManager change:** When `room.parallelFirstRound === true` and `turnCount === 0`, fire all agents simultaneously instead of sequentially:

```typescript
// Conceptual — round 1 parallel pattern
const results = await Promise.allSettled(
  agents.map(agent => runAgentTurn(agent, roomId, controller))
);
// Then continue with sequential turns for rounds 2+
```

The existing SSE infrastructure handles concurrent streaming correctly — each event carries `agentId` so the client routes tokens to the right message slot. No client-side changes needed for this feature beyond displaying that agents responded in parallel.

**UI addition:** Toggle in room config (EditRoomDialog) for "Parallel first round." Stored in DB, displayed in room settings.

---

### Convergence Detection

No schema change. Add `ContextService.detectConvergence()` as a static method.

**Algorithm (2-signal AND logic):**

1. Load the last `agentCount` agent messages (one full round)
2. **Signal 1 — Agreement phrases:** Scan each message for agreement keywords. If ≥ `floor(agentCount / 2) + 1` agents use agreement language in their most recent message, signal is true.
   - Phrase set (configurable constant): `["i agree", "we agree", "we've reached", "consensus", "in conclusion", "i think we all", "everyone agrees", "agreed", "i concur", "we concur"]`
3. **Signal 2 — Content convergence:** Compute pairwise Jaccard similarity between all last-round messages using the existing `jaccardSimilarity()` function. If average ≥ `CONVERGENCE_THRESHOLD` (0.35), signal is true. (Lower than `REPETITION_THRESHOLD` of 0.85 — convergence means agreement, not word-for-word copying.)
4. Return `converged: true` if **both** signals are true. AND logic reduces false positives.

**Integration in `ConversationManager`:** Call after the last agent in each round completes (after `turnCount % agentCount === agentCount - 1`). When converged: stop loop, set status to `idle`, insert system message `[Conversation converged: agents reached consensus]`, emit `status` SSE event.

**Why AND logic:** Agreement phrases alone fire on sycophantic responses ("I agree with everything you said" as hollow filler). Content similarity alone fires when agents are all being brief. Both together indicate genuine convergence.

---

## Schema Changes Summary

| Table | Column | Type | Default | Reason |
|-------|--------|------|---------|--------|
| `rooms` | `parallelFirstRound` | `integer` (boolean mode) | `false` | Parallel first round config toggle |

No other schema changes for v1.1. Cost estimation is runtime-computed from existing columns. Convergence detection changes only behavioral flow (uses existing `status` column).

---

## Alternatives Considered

| Feature | Recommended | Alternative | Why Not |
|---------|-------------|-------------|---------|
| Cost pricing data | `llm-info` static package | Fetch from provider pricing APIs at runtime | No public pricing APIs with programmatic access for Anthropic/OpenAI. Adds network calls, latency, and failure modes. |
| Cost pricing data | `llm-info` static package | Hard-coded pricing constants in codebase | `llm-info` has 70 version updates tracking model launches. Hand-coded requires manual updates per new model. |
| Cost pricing data | `llm-info` static package | `tokenlens@1.3.1` (alternative package) | `tokenlens` has 4 dependencies vs. `llm-info`'s zero. `llm-info` has cleaner TypeScript types (`pricePerMillionInputTokens` directly on `ModelInfo`). Both are viable; `llm-info` is leaner. |
| Convergence detection | Keyword + Jaccard in `ContextService` | LLM-as-judge (ask a model "did agents agree?") | Adds ~2s latency per check, costs real tokens on every round, introduces model-specific sycophancy. Deterministic keyword approach is instant and free. |
| Convergence detection | Keyword + Jaccard | Semantic embeddings (cosine similarity of vectors) | Embedding an API call per message check is overkill for 3–8 message windows. Jaccard on word tokens already captures topical overlap well at this scale. |
| Parallel first round | IIFE + `Promise.allSettled` | Worker threads, background jobs | Massively overcomplicated. LLM calls are I/O-bound — Node.js async handles true concurrency for I/O. No CPU-bound work here. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tiktoken` or tokenizer libraries | Token counts already come from provider API responses (stored as `inputTokens`/`outputTokens` in `messages`). Adding a tokenizer would re-count what providers already report. | Use existing DB columns |
| OpenRouter pricing lookup | OpenRouter routes to different underlying models per request; the model ID in the response is the routed model, not a fixed one. Static pricing is meaningless. | Show "N/A" for OpenRouter agents |
| Persist computed cost in DB | Cost = `f(tokens, price_per_million)`. Both inputs already stored or derivable. Persisting derived values creates drift when pricing data changes. | Compute in API response layer at read time |
| `langchain` / LangGraph | Importing LangChain for convergence detection would pull 100+ transitive deps for 20 lines of logic already cleanly owned in `ContextService`. | Extend `ContextService` directly |
| New SSE event types for parallel round | The existing `turn:start` + `token` + `turn:end` events already carry `agentId`. Client already handles concurrent streams. No new protocol needed. | Reuse existing event types |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `llm-info@1.0.69` | TypeScript `^5.9.3` | Zero runtime deps. Ships dual ESM + CJS build. Works with Next.js 16 App Router `import` statements. |
| `llm-info@1.0.69` | Node 18+ | No compatibility issues found. |
| `drizzle-kit@0.31.10` | `better-sqlite3@12.x` | `npx drizzle-kit push` for schema changes — established pattern in this project. No migration files needed. |

---

## Sources

- `https://www.npmjs.com/package/llm-info` — Package metadata: 70 versions, zero deps, MIT, last published 3 months ago. Package source inspected locally: `ModelInfoMap`, `ModelInfo` type with `pricePerMillionInputTokens`/`pricePerMillionOutputTokens` fields, provider coverage verified (anthropic, openai, google). **HIGH confidence.**
- Anthropic pricing page (`https://platform.claude.com/docs/en/about-claude/pricing`) — Cross-referenced Claude Sonnet 4 at $3/$15 per million tokens. `llm-info` data consistent with official pricing. **HIGH confidence.**
- [Multiple Parallel AI Streams with the Vercel AI SDK](https://mikecavaliere.com/posts/multiple-parallel-streams-vercel-ai-sdk) — IIFE pattern for parallel `streamText` calls without blocking. **MEDIUM confidence.**
- [ACL 2025 CONSENSAGENT](https://aclanthology.org/2025.findings-acl.1141/) — Keyword phrase + content similarity approach for multi-agent consensus detection is research-validated. **MEDIUM confidence.**
- [pricepertoken.com](https://pricepertoken.com/) — Cross-reference for current pricing ranges. **LOW confidence (aggregator, not official).**

---

*Stack research for: Agents Room v1.1 — conversation quality, cost estimation, parallel first round, convergence detection*
*Researched: 2026-03-20*
