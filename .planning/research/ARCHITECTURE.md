# Architecture Research

**Domain:** Multi-agent conversation app — v1.1 feature integration
**Researched:** 2026-03-20
**Confidence:** HIGH (direct codebase analysis of all relevant modules)

## Existing Architecture (v1.0 Baseline)

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (React)                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ChatPanel / ChatHeader / MessageList / ChatInput           │ │
│  │       Zustand chatStore (messages, streaming, status)       │ │
│  │       SSE events (token, turn:start, turn:end, status)      │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────┘
                              │ HTTP / SSE
┌─────────────────────────────┼────────────────────────────────────┐
│                   Next.js 16 API Layer                           │
│  POST /conversation/start  → ConversationManager.start()        │
│  POST /conversation/pause  → ConversationManager.pause()        │
│  POST /conversation/stop   → ConversationManager.stop()         │
│  POST /conversation/resume → ConversationManager.resume()       │
│  GET  /stream              → StreamRegistry (SSE endpoint)      │
│  POST /summary             → generateLLM (non-streaming)        │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                    Conversation Layer                            │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │                 ConversationManager                      │    │
│  │  Turn loop: while(turnCount < turnLimit)                 │    │
│  │    SpeakerSelector.next() → agent                        │    │
│  │    ContextService.buildContext() → {systemPrompt, msgs}  │    │
│  │    streamLLM() → token stream                            │    │
│  │    emitSSE(token) → StreamRegistry                       │    │
│  │    persist message → DB                                  │    │
│  │    ContextService.detectRepetition() → maybe pause       │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐   │
│  │   ContextService    │  │       SpeakerSelector            │   │
│  │  buildContext()     │  │  round-robin | llm-selected      │   │
│  │  detectRepetition() │  │                                  │   │
│  └─────────────────────┘  └──────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                      LLM Gateway                                 │
│  streamLLM() → Vercel AI SDK streamText()                        │
│  generateLLM() → Vercel AI SDK generateText()                    │
│  providers.ts → createAnthropic/OpenAI/Google/OpenRouter/Ollama  │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                   SQLite (WAL) via Drizzle                       │
│  agents | rooms | roomAgents | messages | providerKeys           │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (Existing)

| Component | Responsibility | File |
|-----------|----------------|------|
| ConversationManager | Turn loop orchestration, abort control, status transitions | `lib/conversation/manager.ts` |
| ContextService | Sliding window context assembly (20 msgs), repetition detection (Jaccard) | `lib/conversation/context-service.ts` |
| SpeakerSelector | Round-robin and LLM-selected speaker strategy | `lib/conversation/speaker-selector.ts` |
| streamLLM / generateLLM | Provider abstraction, Vercel AI SDK wrapper | `lib/llm/gateway.ts` |
| StreamRegistry | In-process SSE fan-out, per-room controller sets | `lib/sse/stream-registry.ts` |
| chatStore (Zustand) | Client message list, streaming buffer, token totals, status | `stores/chatStore.ts` |

---

## Integration Architecture for v1.1 Features

### How the Four Features Land

All four features integrate at the existing ConversationManager → ContextService → Gateway seam. No new API routes are needed. No schema migrations are required.

```
ConversationManager.start()
    │
    ├── [NEW] Round 0 branch: parallel first round
    │       Fire all agents simultaneously (Promise.all over streamLLM calls)
    │       Collect buffered responses → persist sequentially → emit SSE sequentially
    │       turnCount += agentCount → continue sequential loop
    │
    ├── Per-turn sequential loop (existing)
    │       ContextService.buildContext()  ← [MODIFIED] quality prompt additions
    │       streamLLM()
    │       persist message
    │       ContextService.detectRepetition()     (existing)
    │       [NEW] ContextService.detectConvergence()  ← new static method
    │
    └── Cost: derived client-side from token data already in SSE events
            [NEW] CostEstimator module (client-importable)
            chatStore.completeTurn() calls CostEstimator after each turn:end
```

---

## Feature-by-Feature Integration Points

### 1. Quality Conversations

**What changes:** `ContextService.buildContext()` — system prompt assembly.

The current system prompt is a naive join of four agent prompt fields. Quality improvements inject structural framing that anchors agents to the discussion topic and asks for substantive contributions.

The `roomTopic` is already available — `buildContext()` already queries the room when messages start with `assistant` role. The method signature gets a small extension to always pass `roomTopic` and use it in prompt framing.

Additionally, asking agents to explicitly signal agreement ("I agree with X's point that...") in their prompt rules makes convergence detection downstream more reliable without requiring an LLM call for detection.

**Component boundary:** Entirely within `ContextService.buildContext()`. The manager does not change.

**New vs Modified:** MODIFIED — `ContextService.buildContext()` signature and prompt assembly logic.

---

### 2. Cost Estimation

**What changes:** New `CostEstimator` module, extended `chatStore`, new cost display UI.

**Why client-side:** The client already receives `inputTokens`, `outputTokens`, and `model` via SSE `turn:end` and `turn:start` events respectively. The agent's `provider` is in `StreamingState` (set on `turn:start`). Computing cost client-side requires no extra API call, no DB change, and no turn-loop modification.

**New module: `lib/conversation/cost-estimator.ts`**

This module is importable by both server and client (pure computation, no DB or API dependencies).

```
CostEstimator
  ├── PRICING_TABLE: Record<provider, Record<model, {inputPerMTok, outputPerMTok}>>
  ├── computeCost(provider, model, inputTokens, outputTokens): number | null
  └── estimateRoomCost(messages[]): number | null   (for history load)
```

Returns `null` when the model is not in the pricing table (unknown/custom models via OpenRouter or Ollama). UI renders "—" for null costs.

**chatStore changes:** `completeTurn()` calls `CostEstimator.computeCost()` and stores cost per message. A derived `totalCost` accumulator is updated. `loadHistory()` calls `estimateRoomCost()` to populate cost on initial load.

**Data flow:**
```
SSE: turn:end { agentId, messageId, inputTokens, outputTokens }
    chatStore.completeTurn(data)
        → CostEstimator.computeCost(streaming.provider, streaming.model, ...)
        → message.estimatedCost = result
        → tokenTotals.estimatedCost += result
    UI: cost badge per message, cumulative in header
```

**Schema change:** None. Cost is derived from existing columns.

**New vs Modified:**
- NEW: `lib/conversation/cost-estimator.ts`
- MODIFIED: `stores/chatStore.ts` — per-message cost field, total cost accumulator, `loadHistory` uses `estimateRoomCost`
- NEW: cost display in UI (rendering only, no logic)

---

### 3. Parallel First Round

**What changes:** `ConversationManager.start()` — turn loop entry.

**What it means:** When no agent has spoken yet (round 0), all agents respond to the raw topic without seeing each other's output. Subsequent rounds proceed sequentially (existing behavior untouched).

**The SSE ordering constraint:** `chatStore.streaming` holds a single `StreamingState` slot. Truly parallel token streaming would interleave `turn:start` / `token` / `turn:end` events and break the client state machine. The solution: run all LLM calls in parallel but buffer each agent's full response text, then emit SSE sequentially per agent.

```
parallelFirstRound(roomId, agents, db):
    1. buildContext for each agent simultaneously (Promise.all)
    2. streamLLM for each agent simultaneously (Promise.all, consume full text into buffers)
    3. For each agent (sequential emission):
        emitSSE(turn:start, agentN)
        emitSSE(token × chunks, agentN)   ← replaying buffered text as chunks
        persist message to DB
        emitSSE(turn:end, agentN)
    4. return turnCount (= number of agents)
```

The latency benefit is real: parallel round 1 waits for the slowest agent, not the sum of all agents. With 3 agents each taking 5 seconds, parallel = 5s total vs sequential = 15s.

**Guard condition:** Check `messageCount === 0` before entering `parallelFirstRound`. This means the feature only activates at conversation start, not on resume.

**Abort signal:** Each parallel LLM call gets its own `AbortController`. If the room is stopped while parallel calls are in flight, all controllers are aborted. The `activeControllers` map can hold multiple entries during the parallel phase (keyed by `${roomId}-${agentId}`), then restored to the single per-room entry before the sequential loop.

**New vs Modified:**
- MODIFIED: `ConversationManager.start()` — parallel first round branch
- NEW (optional): `lib/conversation/parallel-round.ts` — extract logic for unit testability

---

### 4. Convergence Detection

**What changes:** `ContextService` (new method), `ConversationManager.start()` (call alongside repetition check).

**What convergence means:** Agents have reached semantic agreement. Distinct from repetition detection (Jaccard token overlap). Convergence is signaled by explicit linguistic markers in recent messages.

**Approach: heuristic phrase detection (no LLM call).**

`ContextService.detectConvergence(db, roomId)` method:
- Queries last N agent messages (default: 6, configurable as class constant)
- Counts messages containing agreement signal phrases: "I agree", "exactly right", "you're correct", "consensus", "we've established", "we all agree", "I concur", "well said"
- Counts messages containing disagreement signals: "I disagree", "however", "on the contrary", "but actually", "I would argue", "not necessarily"
- Returns `true` when: agreement signals present in majority of recent messages AND disagreement signals absent or minimal
- Returns `false` when fewer than N agent messages exist (cannot detect convergence too early)

Quality prompt changes (feature 1) ask agents to use explicit agreement language, which significantly improves signal reliability.

**Integration in turn loop:**
```typescript
// After turn:end persist, alongside existing repetition check
const isRepetitive = await ContextService.detectRepetition(db, roomId);
const hasConverged = await ContextService.detectConvergence(db, roomId);

if (isRepetitive) {
  // existing: pause with system message
}
if (hasConverged) {
  await db.update(rooms).set({ status: 'idle' }).where(eq(rooms.id, roomId));
  emitSSE(roomId, 'status', { status: 'idle' });
  await db.insert(messages).values({ /* system message */ content: '[Conversation complete: agents reached consensus]' });
  emitSSE(roomId, 'system', { content: '[Conversation complete: agents reached consensus]' });
  break;
}
```

Uses existing `status` and `system` SSE event types. No new event types needed.

**New vs Modified:**
- MODIFIED: `ContextService` — new `detectConvergence()` static method
- MODIFIED: `ConversationManager.start()` — call `detectConvergence()` after each turn

---

## Component Boundary Map

```
lib/conversation/
├── manager.ts          [MODIFIED] parallel first round branch + convergence check
├── context-service.ts  [MODIFIED] quality prompts in buildContext(), new detectConvergence()
├── speaker-selector.ts [UNCHANGED]
├── cost-estimator.ts   [NEW] pricing table + computeCost() + estimateRoomCost()
└── parallel-round.ts   [OPTIONAL NEW] extracted parallel logic for testability

stores/
└── chatStore.ts        [MODIFIED] per-message cost, total cost accumulator

src/app/ (UI)
└── [new component]     [NEW] cost display (badge per message + room total header)

db/schema.ts            [UNCHANGED] no migration needed
lib/llm/                [UNCHANGED]
lib/sse/                [UNCHANGED]
app/api/rooms/.../      [UNCHANGED] all behavior changes below the API layer
```

---

## Data Flow Changes

### Cost Estimation Flow (Client-Side)

```
Server: turn:start { agentId, agentName, model, provider, ... }
    → chatStore.startTurn() stores model + provider in StreamingState

Server: turn:end { agentId, messageId, inputTokens, outputTokens }
    → chatStore.completeTurn(data)
    → CostEstimator.computeCost(streaming.provider, streaming.model, inputTokens, outputTokens)
    → message.estimatedCost = cost (or null)
    → tokenTotals.estimatedCost += cost

Initial load: chatStore.loadHistory()
    → CostEstimator.estimateRoomCost(messages)
    → tokenTotals.estimatedCost = aggregate

UI renders "$0.002" per message, "~$0.018 total" in header
```

### Convergence Detection Flow

```
Server: after each turn:end persist
    → ContextService.detectConvergence(db, roomId)
    → true?
        → rooms.status = 'idle'
        → persist system message
        → emitSSE('status', { status: 'idle' })
        → emitSSE('system', { content: '[consensus]' })

Client: chatStore.setRoomStatus('idle')
    chatStore.addSystemMessage('[consensus message]')
    (same path as any other stop event — no new client handling needed)
```

### Parallel First Round Flow

```
Server: ConversationManager.start()
    → SELECT count(*) FROM messages WHERE roomId = ? → result = 0
    → parallelFirstRound():
        → Promise.all([buildContext(a1), buildContext(a2), buildContext(a3)])
        → Promise.all([streamLLM(a1, ctx1), streamLLM(a2, ctx2), streamLLM(a3, ctx3)])
           (each collects full text into a buffer, all in flight simultaneously)
        → Sequential SSE emission:
            emitSSE(turn:start, a1) → emitSSE(token × N, a1) → persist a1 → emitSSE(turn:end, a1)
            emitSSE(turn:start, a2) → emitSSE(token × N, a2) → persist a2 → emitSSE(turn:end, a2)
            emitSSE(turn:start, a3) → emitSSE(token × N, a3) → persist a3 → emitSSE(turn:end, a3)
        → return agentCount (3)
    → turnCount = 3, continue sequential loop for remaining turns
```

---

## Architectural Patterns

### Pattern: Augment, Don't Replace

**What:** Add new behavior alongside existing behavior, guarded by a condition or as a new parallel method.
**When to use:** When the new feature is a superset of existing behavior (parallel first round adds a branch before the loop; convergence detection adds a check alongside repetition detection).
**Trade-off:** Keeps existing code paths as the golden path. New branches are narrow and independently testable. Risk: method complexity grows. Acceptable given the tight scope.

### Pattern: Client-Side Derivation from In-Transit Data

**What:** Derive computed values on the client from data already present in SSE events, using a shared pure-computation module.
**When to use:** When the data for computation is already being sent (token counts, model, provider) and derivation requires no secrets or DB access.
**Trade-off:** Pricing table lives client-side (static, not sensitive). Avoids extra API round-trip and turn-loop complexity. Pricing updates require a deploy, but that is acceptable for a personal tool.

### Pattern: Buffer-Then-Emit for Parallelism

**What:** Run LLM calls concurrently for latency savings but buffer full responses and emit SSE sequentially to preserve the client state machine.
**When to use:** When the client state machine assumes a single active streaming slot (chatStore.streaming is one object, not an array).
**Trade-off:** Round 1 responses appear as a burst after all complete, not progressively per agent. The real-time streaming feel is deferred to rounds 2+. The latency benefit (slowest agent time vs. sum of all) is preserved.

---

## Anti-Patterns to Avoid

### Anti-Pattern: New SSE Event Type for Convergence

**What people do:** Create a `convergence` SSE event, add a new chatStore handler.
**Why it's wrong:** The existing `status: idle` plus `system` message pair already expresses "conversation stopped with explanation." Fragmenting the status state machine adds client complexity.
**Do this instead:** Reuse existing `status` and `system` event types. The consensus message in the system event explains why the room stopped.

### Anti-Pattern: Server-Side Cost Computation in the Turn Loop

**What people do:** Add pricing logic inside ConversationManager, persist cost to DB, include it in `turn:end` SSE payload.
**Why it's wrong:** Embeds pricing data in the core turn loop. Pricing changes require touching conversation logic. The client already has tokens and model — it can compute cost without a round-trip.
**Do this instead:** Client-side derivation via `CostEstimator` module in `chatStore.completeTurn()`.

### Anti-Pattern: Truly Parallel SSE Token Streaming

**What people do:** Extend chatStore to hold N concurrent StreamingState slots and pipe each agent's token stream directly to SSE as it arrives.
**Why it's wrong:** Requires chatStore rework, UI changes to render N simultaneous in-progress bubbles, and SSE multiplexing by agent ID. The scope is disproportionate to the benefit — the user sees agents thinking simultaneously but the UI complexity is significant.
**Do this instead:** Parallel LLM calls with buffered text, sequential SSE emission. The latency improvement is preserved.

### Anti-Pattern: LLM Call for Convergence Detection

**What people do:** After each turn, call `generateLLM()` asking "have the agents reached consensus?"
**Why it's wrong:** Doubles cost per turn for every conversation, adds latency to every turn, and is unnecessary when quality prompts produce explicit agreement signals.
**Do this instead:** Phrase-based heuristic in `ContextService.detectConvergence()`. Upgrade to LLM-powered detection in v1.2 if the heuristic proves insufficient.

---

## Suggested Build Order

Dependencies drive the sequence.

### Step 1: Quality Conversations

Build first. Zero dependencies on other features. Isolated to `ContextService.buildContext()`. This also makes convergence detection (step 3) more reliable — quality prompts produce explicit agreement signals that phrase matching can detect.

Validates: system prompt output via unit tests. No integration risk.

### Step 2: Cost Estimator

Build second. Fully independent. New module (`cost-estimator.ts`) plus additive chatStore changes. Can be done in parallel with step 1.

Validates: `computeCost()` unit tests against known models. UI rendering of cost fields.

### Step 3: Convergence Detection

Build third. Depends on step 1 for reliable signal phrases. `detectConvergence()` mirrors the existing `detectRepetition()` pattern — same DB query shape, new detection logic. The manager hook is a small addition alongside the existing repetition check.

Validates: unit tests with crafted message fixtures containing agreement/disagreement phrases. Integration test: conversation stops at idle with system message when convergence threshold met.

### Step 4: Parallel First Round

Build last. Most complex change — modifies the turn loop entry point which is the highest-risk area. Better to have quality prompts and convergence detection stable first. The `messageCount === 0` guard isolates the change to round 1 only; existing sequential behavior for all subsequent rounds is untouched.

Validates: integration test — fire 3 agents in a new room, verify all 3 messages persisted before sequential turns begin. Latency test: parallel round should complete in ~max(individual agent times).

### Step 5: Tech Debt Cleanup

Interleaved throughout. Orphaned `ConversationPanel.tsx` removal is independent of all features. Type error fixes should accompany whichever feature touches the affected file. Do not defer to end — debt becomes harder to clean after new features add surface area.

---

## New vs Modified: Complete Reference

| Component | Status | Change Summary |
|-----------|--------|----------------|
| `lib/conversation/manager.ts` | MODIFIED | Parallel first round branch (`messageCount === 0`), convergence check after each turn |
| `lib/conversation/context-service.ts` | MODIFIED | Quality framing in `buildContext()`, new `detectConvergence()` static method |
| `lib/conversation/cost-estimator.ts` | NEW | Static pricing table, `computeCost()`, `estimateRoomCost()` |
| `lib/conversation/parallel-round.ts` | OPTIONAL NEW | Extracted parallel logic for unit testability |
| `stores/chatStore.ts` | MODIFIED | Per-message `estimatedCost` field, total cost accumulator, `loadHistory` uses `estimateRoomCost` |
| Cost display UI component | NEW | Renders cost per message and room total |
| `lib/conversation/speaker-selector.ts` | UNCHANGED | — |
| `lib/llm/gateway.ts` | UNCHANGED | — |
| `lib/sse/stream-registry.ts` | UNCHANGED | — |
| `db/schema.ts` | UNCHANGED | No migration needed |
| API routes | UNCHANGED | All behavior changes are below the route layer |

---

## Sources

- Direct codebase analysis: `src/lib/conversation/manager.ts` (turn loop, abort control)
- Direct codebase analysis: `src/lib/conversation/context-service.ts` (buildContext, detectRepetition)
- Direct codebase analysis: `src/lib/conversation/speaker-selector.ts` (strategy patterns)
- Direct codebase analysis: `src/lib/llm/gateway.ts` (streamLLM, generateLLM signatures)
- Direct codebase analysis: `src/lib/sse/stream-registry.ts` (emitSSE, event types)
- Direct codebase analysis: `src/stores/chatStore.ts` (StreamingState, completeTurn, token totals)
- Direct codebase analysis: `src/db/schema.ts` (messages.inputTokens, messages.model columns)
- Project context: `.planning/PROJECT.md` (v1.1 milestone requirements)

---

*Architecture research for: Agents Room v1.1 — Conversation Quality & Polish*
*Researched: 2026-03-20*
