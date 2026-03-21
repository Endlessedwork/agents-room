# Phase 8: Cost Estimation - Research

**Researched:** 2026-03-21
**Domain:** LLM token pricing, Zustand state management, React SSE-driven UI
**Confidence:** HIGH

## Summary

Phase 8 adds estimated cost display to rooms. The codebase already has all the plumbing needed: token counts (`inputTokens`, `outputTokens`) are persisted in the `messages` table, carried in `turn:end` SSE events, accumulated in `chatStore.tokenTotals`, and shown in `ChatHeader`. The missing layer is a pure pricing calculation function that converts (provider, model, inputTokens, outputTokens) → dollars.

The `llm-info@^1.0.69` package (already identified in STATE.md as the sole new production dependency for v1.1) provides `ModelInfoMap[modelId].pricePerMillionInputTokens` and `pricePerMillionOutputTokens`. Looking up an unknown model returns `undefined` — the calling code must handle this explicitly to produce "—" instead of "$0.00". Ollama is a local provider with no token cost; its models are always "local" regardless of whether `llm-info` has pricing data.

The implementation touches exactly three layers: (1) a new `src/lib/pricing.ts` utility module, (2) new computed state in `chatStore` that derives `estimatedCost` from existing `tokenTotals` and the agent model/provider information carried in messages, and (3) a display change in `ChatHeader` that replaces or supplements the current token count display with "est. $X.XX" or the sentinel strings "—" or "local".

**Primary recommendation:** Build a `calculateCost(provider, model, inputTokens, outputTokens)` function in `src/lib/pricing.ts` that returns `{ dollars: number } | { sentinel: '—' | 'local' }`. Derive cost in `chatStore` from the per-message `model` field already stored on `ChatMessage`. Display in `ChatHeader` next to (or replacing) the existing token count span.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COST-01 | User sees estimated cost per room based on model pricing | `llm-info` ModelInfoMap lookup; derived in chatStore; displayed in ChatHeader |
| COST-02 | Cost updates in real-time as tokens stream | `turn:end` already carries inputTokens/outputTokens; `updateTokenTotals` already fires; cost derived reactively from tokenTotals + model data |
| COST-03 | Unknown models display "—" instead of $0.00 | ModelInfoMap lookup returns `undefined` for unknown models; sentinel type returned from calculateCost |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| llm-info | ^1.0.69 | Model pricing table (pricePerMillionInputTokens, pricePerMillionOutputTokens) | Identified in STATE.md as the only new v1.1 production dep; covers 50+ models across all 5 providers used in this project |
| zustand | ^5.0.12 (existing) | Derived cost state in chatStore | Already the project's client state manager |

### Supporting
No additional libraries needed. Cost calculation is pure arithmetic over the existing `tokenTotals` state and the `model` field already present on `ChatMessage`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| llm-info | Hand-rolled static pricing table | llm-info is maintained and covers edge cases; hand-rolling requires ongoing maintenance as providers change prices |
| Derived cost in chatStore | Separate API endpoint returning cost | API roundtrip adds latency; all data already lives client-side in tokenTotals |

**Installation:**
```bash
npm install llm-info@^1.0.69
```

**Version verification:** npm registry confirms `1.0.69` is the current release as of research date.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── pricing.ts        # NEW: calculateCost() pure function
├── stores/
│   └── chatStore.ts      # MODIFIED: add estimatedCost derived state
└── components/
    └── rooms/
        └── ChatHeader.tsx  # MODIFIED: display cost with est. prefix
tests/
└── lib/
    └── pricing.test.ts   # NEW: unit tests for pricing logic
```

### Pattern 1: Pure Pricing Function

**What:** A side-effect-free function that maps (provider, model, inputTokens, outputTokens) to a typed result. Returns a discriminated union so callers cannot accidentally use a sentinel as a number.

**When to use:** Called from chatStore derived state and potentially from any future cost-per-message display.

**Example:**
```typescript
// src/lib/pricing.ts
import { ModelInfoMap } from 'llm-info';

export type CostResult =
  | { type: 'dollars'; value: number }
  | { type: 'sentinel'; display: '—' | 'local' };

export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): CostResult {
  if (provider === 'ollama') {
    return { type: 'sentinel', display: 'local' };
  }
  const info = (ModelInfoMap as Record<string, { pricePerMillionInputTokens?: number; pricePerMillionOutputTokens?: number } | undefined>)[model];
  if (!info || info.pricePerMillionInputTokens == null || info.pricePerMillionOutputTokens == null) {
    return { type: 'sentinel', display: '—' };
  }
  const dollars =
    (inputTokens / 1_000_000) * info.pricePerMillionInputTokens +
    (outputTokens / 1_000_000) * info.pricePerMillionOutputTokens;
  return { type: 'dollars', value: dollars };
}

export function formatCost(result: CostResult): string {
  if (result.type === 'sentinel') return result.display;
  return `est. $${result.value.toFixed(4)}`;
}
```

### Pattern 2: Cost Accumulation in chatStore

**What:** The chatStore already accumulates `tokenTotals` across turns. Cost must be tracked per-agent/model because a room can have agents on different providers and models. The cleanest approach is to accumulate cost as a running dollar total (or sentinel) alongside tokenTotals.

**Challenge:** A room can have agents on mixed models — some known, some unknown, some local. A mixed room should show "est. $X.XX" for the sum of known-model turns, with a note if any turns were local or unknown. The simplest approach per requirements: sum known costs, if any turn has sentinel `'—'` (unknown model), show "—" for the whole room; if any is `'local'` treat those turns as $0 toward the total unless the room is purely Ollama.

**Simpler interpretation from requirements:** Success Criteria 2 says "A room using an unrecognized model shows '—'". This implies if the room has an unrecognized model, the entire display is "—". Success Criteria 3 says Ollama shows "local". If a room is mixed (e.g., one Ollama + one OpenAI agent), the intent is unclear but the safest interpretation is: compute cost for known non-local agents and display it, with "local" shown only for pure-Ollama rooms.

**Pragmatic approach:** Track `estimatedCostState: { dollars: number; hasUnknown: boolean; hasLocal: boolean }` in chatStore. On each `turn:end`, call `calculateCost` with the turn's model and provider (both already in `StreamingState` and in `ChatMessage`), add to running total.

**What data is available at turn:end?**
- `turn:end` SSE payload: `{ agentId, messageId, inputTokens, outputTokens }` — no model/provider
- `streaming` state at `completeTurn` time: `{ model }` — model is known, but provider is not yet in streaming state
- `ChatMessage` after completion: has `model` field but no `provider` field

**Gap identified:** Provider is not carried through to the SSE `turn:end` event or stored in `ChatMessage`. To compute cost, we need both `model` and `provider`. Two options:
1. Add `provider` to the `turn:end` SSE payload (manager.ts emits it; it already has `agent.provider`)
2. Add `provider` to `StreamingState` (populated at `turn:start` which already has access to `agent.provider` via the `turn:start` SSE event)

**Recommended:** Add `provider` to the `turn:start` SSE event (manager.ts line 91-100) and to `StreamingState` in chatStore. This is a one-line change in manager.ts and a field addition in chatStore. Then at `completeTurn`, both `model` (from streaming) and `provider` (from streaming) are available.

### Pattern 3: ChatHeader Display

The current header shows:
```
Tokens: {n} in / {n} out
```

Replace with (or add alongside):
```
est. $0.0042   ← known model with cost
—              ← unknown model
local          ← Ollama-only room
```

The "est." prefix is an **explicit requirement** (Success Criteria 4). It must appear in the UI, never stripped.

### Anti-Patterns to Avoid

- **Fetching pricing from an external API:** Out of scope per REQUIREMENTS.md. Static table in `llm-info` is sufficient.
- **Computing cost in the server/manager:** Cost is a display concern; all token data is already client-side.
- **Showing $0.00 for unknown models:** Explicitly prohibited by COST-03 and Success Criteria 2.
- **Omitting "est." prefix:** Prohibited by Success Criteria 4. Never display bare dollar amounts.
- **Per-agent cost breakdown:** Explicitly out of scope in REQUIREMENTS.md. Room total only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model pricing table | Custom `const PRICES = { 'gpt-4o': ... }` | `llm-info` ModelInfoMap | Covers 50+ models; maintained externally; handles deprecation tracking |
| Unknown model detection | `if (model.startsWith('gpt'))` heuristics | `ModelInfoMap[model] === undefined` | llm-info returns undefined for any unrecognized model ID |

**Key insight:** The pricing table problem looks simple but has real maintenance cost — providers rename models, change pricing, and add new models constantly. llm-info is the project's chosen solution (already identified in STATE.md).

## Common Pitfalls

### Pitfall 1: Provider Not Available at Cost Calculation Time
**What goes wrong:** `calculateCost` requires `provider` to detect Ollama, but `turn:end` SSE does not currently include `provider`. Computing cost returns wrong results (e.g., llm-info might find an Ollama model by name and return a price).
**Why it happens:** The SSE event was designed to carry only completion data; provider is on the agent object, not in the event.
**How to avoid:** Add `provider` to `turn:start` SSE event payload in manager.ts and to `StreamingState` in chatStore. The provider is already in `agent.provider` at the emit site.
**Warning signs:** If you see `calculateCost` called without provider, it will default to non-Ollama path and may find a matching model name.

### Pitfall 2: Mixed-Model Rooms and Cost Aggregation
**What goes wrong:** A room has Agent A on `claude-3-5-haiku` (known) and Agent B on `ollama/llama3` (local). Naively summing costs gives a partial dollar figure without surfacing the local turns.
**Why it happens:** The cost accumulator runs per-turn without awareness of the overall room composition.
**How to avoid:** Track `hasLocal` and `hasUnknown` flags alongside the dollar accumulator. Display logic decides the final string based on all three values.

### Pitfall 3: llm-info Model ID Format Mismatch
**What goes wrong:** `ModelInfoMap['gpt-4o']` works but `ModelInfoMap['openai/gpt-4o']` or `ModelInfoMap['gpt-4o-mini-2024-07-18']` may not match.
**Why it happens:** The model string stored in `messages.model` comes directly from `agent.model` which is whatever the user typed when creating the agent. llm-info uses its own canonical model ID format.
**How to avoid:** Test lookup behavior during implementation. If the project uses Vercel AI SDK model IDs, verify they match llm-info's `AllModels` keys. If mismatch is found, add a normalization step (strip provider prefix) or accept that unrecognized model IDs show "—".

### Pitfall 4: loadHistory Cost Recalculation
**What goes wrong:** When `chatStore.loadHistory()` runs on page load, it rehydrates `tokenTotals` from persisted messages — but the new `estimatedCost` state is not rehydrated.
**Why it happens:** `loadHistory` only computes `tokenTotals`, not cost. If we add `estimatedCostState`, we need to compute it there too from the model field on each message.
**How to avoid:** Extend `loadHistory` to also iterate messages, call `calculateCost` per message with the stored `model` field, and accumulate into `estimatedCostState`. Note: `provider` is not stored in `messages` — this is the same gap as Pitfall 1 above, but here there is no SSE event to extend. **Solution:** Store `provider` on `ChatMessage` (sourced from `roomAgent.provider`) or look up `provider` from the agent list. The simpler path: the `messages` API endpoint already joins `roomAgent` for name/avatar — extend it to include `provider` as well.

### Pitfall 5: Floating Point Precision Display
**What goes wrong:** `(1234 / 1_000_000) * 3` produces `0.003702` — displayed as `$0.003702` which is ugly.
**Why it happens:** Raw floating point from division.
**How to avoid:** Use `toFixed(4)` consistently. For amounts under $0.01, `toFixed(4)` gives readable precision. For amounts over $1, reduce to `toFixed(2)`.

## Code Examples

### llm-info Lookup Pattern
```typescript
// Source: https://github.com/paradite/llm-info
import { ModelInfoMap } from 'llm-info';

const info = ModelInfoMap['claude-3-5-haiku-20241022'];
// info.pricePerMillionInputTokens → e.g. 0.80
// info.pricePerMillionOutputTokens → e.g. 4.00

const unknownInfo = ModelInfoMap['some-custom-model'];
// unknownInfo === undefined
```

### turn:start SSE Extension (manager.ts)
```typescript
// Current (line 91-100 of manager.ts)
emitSSE(roomId, 'turn:start', {
  agentId: agent.id,
  agentName: agent.name,
  avatarColor: agent.avatarColor,
  avatarIcon: agent.avatarIcon,
  promptRole: agent.promptRole,
  model: agent.model,
  turnNumber: turnCount + 1,
  totalTurns: turnLimit,
});

// Modified — add provider field:
emitSSE(roomId, 'turn:start', {
  agentId: agent.id,
  agentName: agent.name,
  avatarColor: agent.avatarColor,
  avatarIcon: agent.avatarIcon,
  promptRole: agent.promptRole,
  model: agent.model,
  provider: agent.provider,  // ← new field
  turnNumber: turnCount + 1,
  totalTurns: turnLimit,
});
```

### chatStore Cost Accumulation
```typescript
// In chatStore, new state:
estimatedCostState: { dollars: number; hasUnknown: boolean; hasLocal: boolean };

// In completeTurn action:
completeTurn: (data) => {
  const state = get();
  if (!state.streaming) return;
  // ... existing dedup logic ...
  const costResult = calculateCost(
    state.streaming.provider,   // new field on StreamingState
    state.streaming.model,
    data.inputTokens ?? 0,
    data.outputTokens ?? 0,
  );
  const prev = state.estimatedCostState;
  const newCostState = costResult.type === 'dollars'
    ? { dollars: prev.dollars + costResult.value, hasUnknown: prev.hasUnknown, hasLocal: prev.hasLocal }
    : costResult.display === 'local'
      ? { dollars: prev.dollars, hasUnknown: prev.hasUnknown, hasLocal: true }
      : { dollars: prev.dollars, hasUnknown: true, hasLocal: prev.hasLocal };
  // ... set state with newCostState ...
};
```

### ChatHeader Display Logic
```typescript
// Derive display string from estimatedCostState
function formatEstimatedCost(state: { dollars: number; hasUnknown: boolean; hasLocal: boolean }): string {
  if (state.hasUnknown) return '—';
  if (state.hasLocal && state.dollars === 0) return 'local';
  // Mixed rooms: show dollar figure (local turns contribute $0)
  return `est. $${state.dollars < 0.01 ? state.dollars.toFixed(4) : state.dollars.toFixed(2)}`;
}
```

### loadHistory Cost Rehydration Pattern
```typescript
// In loadHistory, messages have model and (after API extension) provider:
const costState = mapped.reduce(
  (acc, m) => {
    if (m.role !== 'agent' || m.inputTokens == null || m.outputTokens == null) return acc;
    const result = calculateCost(m.provider ?? '', m.model ?? '', m.inputTokens, m.outputTokens);
    if (result.type === 'dollars') return { ...acc, dollars: acc.dollars + result.value };
    if (result.display === 'local') return { ...acc, hasLocal: true };
    return { ...acc, hasUnknown: true };
  },
  { dollars: 0, hasUnknown: false, hasLocal: false }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Token count only display | Token count + estimated cost | Phase 8 | Users gain cost visibility |
| No provider in SSE turn:start | Provider included in turn:start | Phase 8 | Enables client-side cost calc |

**Deprecated/outdated:**
- None relevant to this phase.

## Open Questions

1. **Mixed-model room cost display**
   - What we know: Requirements say "Ollama shows 'local'", "unknown shows '—'". Nothing says what a mixed room shows.
   - What's unclear: If a room has Anthropic + Ollama agents, show "$0.004" (Anthropic cost only) or "local" or "—"?
   - Recommendation: Show the dollar total for known-pricing agents, ignore local turns (local = $0 contribution). Only show "—" if an agent has an unknown commercial model. This is the most useful behavior.

2. **Provider not stored in `messages` table**
   - What we know: `messages` has a `model` column but no `provider` column. Provider is in `roomAgents`.
   - What's unclear: `loadHistory` joins roomAgent for name/avatar but the API would need to also return provider for cost rehydration.
   - Recommendation: Extend `GET /api/rooms/:roomId/messages` response to include `roomAgent.provider`. This is a read-only API change with no schema migration.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/lib/pricing.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COST-01 | `calculateCost` returns dollar amount for known model | unit | `npx vitest run tests/lib/pricing.test.ts` | ❌ Wave 0 |
| COST-02 | `chatStore.completeTurn` accumulates cost incrementally | unit | `npx vitest run tests/stores/chatStore.test.ts` | ❌ Wave 0 |
| COST-03 | `calculateCost` returns sentinel "—" for unknown model | unit | `npx vitest run tests/lib/pricing.test.ts` | ❌ Wave 0 |
| COST-03 | `calculateCost` returns "local" for ollama provider | unit | `npx vitest run tests/lib/pricing.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/pricing.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/pricing.test.ts` — covers COST-01, COST-03 (pure function tests)
- [ ] `tests/stores/chatStore.test.ts` — covers COST-02 (completeTurn cost accumulation, loadHistory rehydration)

## Sources

### Primary (HIGH confidence)
- Context7 / official GitHub: https://github.com/paradite/llm-info — ModelInfoMap API, field names confirmed
- npm registry: `npm view llm-info version` → 1.0.69 confirmed current
- Project source: `src/stores/chatStore.ts` — existing tokenTotals accumulation pattern
- Project source: `src/components/rooms/ChatHeader.tsx` — existing header display pattern
- Project source: `src/lib/conversation/manager.ts` — turn:start emit site, agent.provider available

### Secondary (MEDIUM confidence)
- WebSearch cross-referenced with GitHub README: llm-info `ModelInfoMap[modelId]` returns undefined for unknown models

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — llm-info confirmed in STATE.md as chosen dep; version confirmed via npm registry
- Architecture: HIGH — all integration points are in readable source code; no speculation
- Pitfalls: HIGH — identified from direct source code analysis (missing provider field, loadHistory gap)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (llm-info pricing table updates frequently; verify model IDs still match before shipping)
