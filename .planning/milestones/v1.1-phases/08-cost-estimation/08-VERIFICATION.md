---
phase: 08-cost-estimation
verified: 2026-03-21T03:48:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
human_verification:
  - test: "Start a conversation in a room using a known model (e.g., claude-3-5-haiku-20241022)"
    expected: "Room header shows 'est. $X.XXXX' that increases after each completed agent turn"
    why_human: "Real-time SSE streaming behavior and cost accumulation in a live room cannot be verified programmatically without running the dev server"
  - test: "Refresh the page mid-conversation"
    expected: "Cost figure rehydrates to the same value shown before refresh (matches accumulated per-message history)"
    why_human: "Page-reload rehydration via loadHistory requires a running app and persisted DB state"
  - test: "Create a room with an agent using a fake/unrecognized model name"
    expected: "Room header shows an em dash (—) instead of a dollar amount"
    why_human: "Requires a running app with a manually configured agent"
  - test: "Create a room using an Ollama agent"
    expected: "Room header shows 'local' in the cost field"
    why_human: "Requires Ollama to be locally configured; cannot be verified in CI"
---

# Phase 08: Cost Estimation Verification Report

**Phase Goal:** Per-turn cost estimation displayed in the room header, using llm-info pricing data
**Verified:** 2026-03-21T03:48:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `calculateCost` returns a dollar amount for a known model like `claude-3-5-haiku-20241022` | VERIFIED | `src/lib/pricing.ts` lines 7-34; test case in `tests/lib/pricing.test.ts` line 6; 17/17 tests pass |
| 2 | `calculateCost` returns sentinel `'—'` for an unrecognized model string | VERIFIED | `src/lib/pricing.ts` lines 23-29 (returns `{ type: 'sentinel', display: '—' }` when `!info`); test at line 22 |
| 3 | `calculateCost` returns sentinel `'local'` when provider is `'ollama'` regardless of model | VERIFIED | `src/lib/pricing.ts` lines 13-15 (ollama check before ModelInfoMap lookup); two test cases at lines 27-35 |
| 4 | `formatCost` prefixes dollar amounts with `'est. $'` and never shows bare dollar figures | VERIFIED | `src/lib/pricing.ts` lines 36-40; test cases at lines 44-51 |
| 5 | Room header displays running estimated cost that increases after each agent turn | VERIFIED | `src/components/rooms/ChatHeader.tsx` lines 131-137 renders `formatEstimatedCostDisplay(estimatedCostState)` inside `{hasMessages && ...}`; chatStore test at line 89 proves accumulation |
| 6 | Cost updates in real-time as turns complete via SSE | VERIFIED | `src/hooks/useRoomStream.ts` line 27-30 calls `completeTurn(data)` on `turn:end`; `completeTurn` in `chatStore.ts` lines 165-200 accumulates `estimatedCostState` |
| 7 | Room with unrecognized model shows dash in cost field | VERIFIED | `ChatHeader.tsx` line 26 returns `'\u2014'` when `state.hasUnknown`; chatStore test at line 37 confirms `hasUnknown=true` for unknown model |
| 8 | Ollama-only room shows `'local'` in cost field | VERIFIED | `ChatHeader.tsx` line 27 returns `'local'` when `state.hasLocal && state.dollars === 0`; chatStore test at line 63 confirms `hasLocal=true` for ollama provider |
| 9 | Cost figures carry `'est.'` prefix in the UI | VERIFIED | `formatCost` in `pricing.ts` line 38-39 always prepends `'est. $'` for dollar results; `formatEstimatedCostDisplay` in `ChatHeader.tsx` line 28 routes through `formatCost` |
| 10 | Cost rehydrates correctly from message history on page load | VERIFIED | `chatStore.ts` lines 118-128 compute `estimatedCostState` via `calculateCost` per agent message in `loadHistory`; chatStore test at lines 137-171 verifies rehydration with mocked fetch |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/pricing.ts` | calculateCost and formatCost pure functions | VERIFIED | Exists, 41 lines, exports `CostResult`, `calculateCost`, `formatCost`; imports `ModelInfoMap` from `llm-info` |
| `tests/lib/pricing.test.ts` | Unit tests for all pricing paths | VERIFIED | Exists, 63 lines, 10 test cases covering all paths (known model, unknown model, ollama, zero tokens, format variants) |
| `src/lib/conversation/manager.ts` | provider field in turn:start SSE event | VERIFIED | Line 98: `provider: agent.provider` inside `emitSSE(roomId, 'turn:start', {...})` |
| `src/stores/chatStore.ts` | estimatedCostState tracking and cost accumulation | VERIFIED | Lines 45, 87, 118-128, 165-200, 286: state field present in interface, initial state, completeTurn, loadHistory, and reset |
| `src/components/rooms/ChatHeader.tsx` | Cost display with est. prefix, dash, or local | VERIFIED | Lines 5, 21-29, 36, 131-137: imports `formatCost`, defines `formatEstimatedCostDisplay`, reads `estimatedCostState` from store, renders cost next to token counts |
| `tests/stores/chatStore.test.ts` | Unit tests for chatStore cost accumulation and rehydration | VERIFIED | Exists, 240 lines, 6 test cases covering completeTurn (known, unknown, ollama, multi-turn), loadHistory rehydration, and reset |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/pricing.ts` | `llm-info` | `import { ModelInfoMap } from 'llm-info'` | WIRED | `pricing.ts` line 1 imports `ModelInfoMap`; `package.json` contains `"llm-info": "^1.0.69"` |
| `src/lib/conversation/manager.ts` | `src/hooks/useRoomStream.ts` | turn:start SSE event includes `provider` field | WIRED | `manager.ts` line 98 emits `provider: agent.provider`; `useRoomStream.ts` line 20 passes full parsed event object to `startTurn(JSON.parse(e.data))` |
| `src/hooks/useRoomStream.ts` | `src/stores/chatStore.ts` | `startTurn` passes provider to `StreamingState` | WIRED | `useRoomStream.ts` line 20 calls `startTurn(JSON.parse(e.data))`; `chatStore.ts` line 139 sets `provider: data.provider` in `StreamingState` |
| `src/stores/chatStore.ts` | `src/lib/pricing.ts` | `import { calculateCost } from '@/lib/pricing'` | WIRED | `chatStore.ts` line 3 imports `calculateCost`; called at lines 121 (loadHistory) and 165 (completeTurn) |
| `src/components/rooms/ChatHeader.tsx` | `src/stores/chatStore.ts` | `useChatStore` selector for `estimatedCostState` | WIRED | `ChatHeader.tsx` line 36: `const estimatedCostState = useChatStore((s) => s.estimatedCostState)` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COST-01 | 08-01, 08-02 | User sees estimated cost per room based on model pricing | SATISFIED | ChatHeader renders cost using `formatEstimatedCostDisplay(estimatedCostState)` which derives from `calculateCost` via `completeTurn` accumulation and `loadHistory` rehydration |
| COST-02 | 08-02 | Cost updates in real-time as tokens stream | SATISFIED | SSE `turn:end` event triggers `completeTurn` in `useRoomStream.ts`; `completeTurn` immediately calls `calculateCost` and updates `estimatedCostState` in the Zustand store; ChatHeader re-renders reactively |
| COST-03 | 08-01, 08-02 | Unknown models display "—" instead of $0.00 | SATISFIED | `calculateCost` returns `{ type: 'sentinel', display: '—' }` for unknown models; `completeTurn` sets `hasUnknown: true`; `formatEstimatedCostDisplay` returns `'\u2014'` when `hasUnknown` is true |

All three requirements from REQUIREMENTS.md Phase 8 are satisfied. No orphaned requirements found.

---

### Anti-Patterns Found

None detected in phase 08 files (`src/lib/pricing.ts`, `src/stores/chatStore.ts`, `src/components/rooms/ChatHeader.tsx`, `src/lib/conversation/manager.ts`, `tests/lib/pricing.test.ts`, `tests/stores/chatStore.test.ts`).

---

### Pre-Existing Issues (Not Phase 08 Regressions)

The following TypeScript errors exist in the repo but pre-date phase 08 and are tracked under DEBT-02 (Phase 11):

- `tests/conversation/manager.test.ts` — 5 type errors related to mock `StreamTextResult` shape mismatch with updated Vercel AI SDK types
- `tests/conversation/manager-sse.test.ts` — 4 type errors, same root cause

These errors are in pre-existing test files that were not touched by phase 08. The SUMMARY (08-01) explicitly notes `npm run lint` fails project-wide due to a pre-existing biome.json schema version mismatch — also out of scope for this phase.

---

### Test Run Results

```
Tests:   17 passed (2 files)
  - tests/lib/pricing.test.ts    10 tests — all pass
  - tests/stores/chatStore.test.ts  7 tests — all pass
```

---

### Human Verification Required

The following items require a running dev environment to confirm end-to-end behavior. All automated checks have passed.

#### 1. Real-time cost accumulation in a live room

**Test:** Run `npm run dev`, open a room with agents using a known model (e.g., `claude-3-5-haiku-20241022` or `gpt-4o`), start a conversation, let 2-3 turns complete.
**Expected:** Room header shows "est. $X.XXXX" that increases numerically after each completed turn.
**Why human:** SSE streaming and live Zustand state updates require a running app with a real LLM API key configured.

#### 2. Cost persistence across page refresh

**Test:** After several turns complete and a cost is displayed, refresh the browser page.
**Expected:** The same cost value (or very close) reappears after the page reloads and history is fetched.
**Why human:** Requires an active DB with persisted message rows including `inputTokens`, `outputTokens`, and `roomAgent.provider`.

#### 3. Em dash display for unrecognized model

**Test:** Create an agent with a fake model name (e.g., `"my-custom-model-v9"`), assign to a room, run one turn.
**Expected:** Room header shows "—" (em dash) in place of a dollar amount.
**Why human:** Requires manual agent configuration in the running UI.

#### 4. "local" display for Ollama room

**Test:** Configure an Ollama provider key (base URL to local Ollama), create an agent using an Ollama model, run the room.
**Expected:** Room header shows "local" in the cost field.
**Why human:** Requires local Ollama installation and configuration.

---

### Gaps Summary

No gaps. All automated checks pass:
- All 10 pricing unit tests pass
- All 7 chatStore cost tests pass (6 described in plan + 1 additional loadHistory sentinel case)
- All key links are wired (provider flows from `manager.ts` SSE event through `useRoomStream.ts` into `chatStore.ts` and on to `ChatHeader.tsx`)
- All 3 requirements (COST-01, COST-02, COST-03) are satisfied
- `llm-info@^1.0.69` is installed as a production dependency
- No stub implementations, no placeholder returns, no TODO/FIXME comments in phase files

---

_Verified: 2026-03-21T03:48:00Z_
_Verifier: Claude (gsd-verifier)_
