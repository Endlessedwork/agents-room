---
phase: 08-cost-estimation
plan: 02
subsystem: ui
tags: [chatStore, sse, pricing, cost-estimation, zustand, react]

# Dependency graph
requires:
  - phase: 08-cost-estimation/08-01
    provides: calculateCost and formatCost pure functions from src/lib/pricing.ts
provides:
  - provider field in turn:start SSE event from conversation manager
  - estimatedCostState accumulation in chatStore (completeTurn + loadHistory rehydration)
  - ChatMessage interface with provider field for history rehydration
  - Cost display in ChatHeader: "est. $X.XX", em dash for unknown, "local" for Ollama
  - chatStore unit tests for cost accumulation and rehydration
affects:
  - Any future phase that reads estimatedCostState from chatStore
  - Any future phase that extends the turn:start SSE event payload

# Tech tracking
tech-stack:
  added: []
  patterns:
    - estimatedCostState accumulates cost per-turn in completeTurn, rehydrates from persisted messages in loadHistory
    - SSE turn:start event carries provider field so chatStore can call calculateCost without a DB lookup
    - formatEstimatedCostDisplay helper in ChatHeader derives display string from estimatedCostState flags (dollars/hasUnknown/hasLocal)

key-files:
  created:
    - tests/stores/chatStore.test.ts
  modified:
    - src/lib/conversation/manager.ts
    - src/stores/chatStore.ts
    - src/components/rooms/ChatHeader.tsx

key-decisions:
  - "Provider added to turn:start SSE payload (not fetched separately) — zero extra DB round-trips per turn"
  - "estimatedCostState lives in chatStore alongside tokenTotals — single source of truth for all per-room financial metrics"
  - "loadHistory rehydrates cost from roomAgent.provider already returned by the messages API — no schema changes needed"

patterns-established:
  - "Pattern: chatStore.completeTurn accumulates cost via calculateCost(streaming.provider, streaming.model, inputTokens, outputTokens)"
  - "Pattern: chatStore.loadHistory loops messages and calls calculateCost per agent turn to rehydrate estimatedCostState"
  - "Pattern: formatEstimatedCostDisplay(state) is a ChatHeader-local helper — components never call formatCost directly with raw numbers"

requirements-completed: [COST-01, COST-02, COST-03]

# Metrics
duration: 20min
completed: 2026-03-21
---

# Phase 08 Plan 02: Cost Display Integration Summary

**End-to-end cost estimation wired from SSE event through chatStore accumulation to ChatHeader display — known models show "est. $X.XXXX", unknown models show em dash, Ollama-only rooms show "local", cost rehydrates across page refresh.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-21T02:00:00Z
- **Completed:** 2026-03-21T02:20:00Z
- **Tasks:** 4 (0 RED, 1 GREEN, 1 feat, 1 checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments

- Added `provider` field to turn:start SSE event in manager.ts — zero extra DB queries per turn
- Extended chatStore with `estimatedCostState` (`{ dollars, hasUnknown, hasLocal }`) accumulated in `completeTurn` and rehydrated in `loadHistory`
- Added `provider: string | null` to `ChatMessage` interface so history rehydration can call `calculateCost` per-message
- Updated ChatHeader to show cost next to token counts using a middle-dot separator — all three display states covered
- Created chatStore test suite (6+ cases) covering multi-turn accumulation, unknown/ollama sentinel paths, rehydration, and reset

## Task Commits

Each task was committed atomically:

1. **Task 0: Create chatStore cost accumulation tests (RED)** - `e0f18f1` (test)
2. **Task 1: Wire provider through SSE and chatStore with cost accumulation (GREEN)** - `9efc2e7` (feat)
3. **Task 2: Display estimated cost in ChatHeader** - `3d2deb3` (feat)
4. **Task 3: Verify cost display in running room** - CHECKPOINT APPROVED (no commit)

## Files Created/Modified

- `tests/stores/chatStore.test.ts` — 6 unit tests covering completeTurn accumulation (known, unknown, ollama, multi-turn), loadHistory rehydration, and reset
- `src/lib/conversation/manager.ts` — `provider: agent.provider` added to turn:start SSE event payload
- `src/stores/chatStore.ts` — `StreamingState.provider`, `ChatMessage.provider`, `estimatedCostState` state field, cost logic in `completeTurn` and `loadHistory`, reset state
- `src/components/rooms/ChatHeader.tsx` — `estimatedCostState` selector, `formatEstimatedCostDisplay` helper, cost shown after token counts with middle-dot separator

## Decisions Made

- Provider is carried in the SSE event rather than fetched from the DB at display time — avoids any additional round-trips and keeps the display path fully client-side after stream starts.
- `estimatedCostState` sits alongside `tokenTotals` in chatStore rather than being computed on-the-fly in the component — this enables easy rehydration from `loadHistory` and consistent access from any future component.
- History rehydration uses `roomAgent.provider` already included in the messages API response — no schema or API changes required.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three cost display states (dollars, unknown, local) are implemented and tested
- `estimatedCostState` is available in chatStore for any future component that wants to display or act on cost
- No blockers for remaining phases in milestone v1.1

---
*Phase: 08-cost-estimation*
*Completed: 2026-03-21*
