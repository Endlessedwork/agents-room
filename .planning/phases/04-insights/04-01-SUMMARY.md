---
phase: 04-insights
plan: 01
subsystem: ui
tags: [zustand, chatStore, sse, token-count, real-time]

# Dependency graph
requires:
  - phase: 03-real-time-ui
    provides: chatStore, useRoomStream SSE hook, ChatHeader component, turn:end SSE event with inputTokens/outputTokens
provides:
  - tokenTotals state in chatStore (input/output running totals)
  - formatTokenCount helper (k-abbreviation for thousands)
  - updateTokenTotals action in chatStore
  - Token count display in ChatHeader ("Tokens: X in / X out")
  - loadHistory populates initial tokenTotals from persisted messages
affects: [04-02, 04-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token accumulation via updateTokenTotals called from SSE turn:end handler after completeTurn"
    - "Conditional header display: {hasMessages && ...} pattern for context-sensitive UI"

key-files:
  created: []
  modified:
    - src/stores/chatStore.ts
    - src/components/rooms/ChatHeader.tsx
    - src/hooks/useRoomStream.ts

key-decisions:
  - "formatTokenCount exported as pure function outside store — reusable without store access"
  - "loadHistory computes tokenTotals from persisted messages so history loads show correct totals"
  - "turn:end handler parses SSE data once and passes to both completeTurn and updateTokenTotals"

patterns-established:
  - "Running token totals accumulated in store state, not derived from messages array on each render"

requirements-completed: [INSI-01]

# Metrics
duration: 9min
completed: 2026-03-20
---

# Phase 4 Plan 01: Token Usage Display Summary

**Real-time token count display in ChatHeader using Zustand store accumulation, seeded from history and updated via SSE turn:end events**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-20T11:12:06Z
- **Completed:** 2026-03-20T11:14:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- chatStore now tracks cumulative input/output token totals as running state
- formatTokenCount helper formats raw numbers with "k" abbreviation (e.g., 12400 -> "12.4k")
- ChatHeader shows "Tokens: X in / X out" line, hidden when no messages exist
- useRoomStream turn:end handler wires token updates into the store after each agent turn

## Task Commits

Each task was committed atomically:

1. **Task 1: Add token totals state and formatting to chatStore** - `6494216` (feat)
2. **Task 2: Display token counts in ChatHeader and wire SSE updates** - `16dd0b5` (feat)

## Files Created/Modified
- `src/stores/chatStore.ts` - Added tokenTotals state, formatTokenCount export, updateTokenTotals action, loadHistory computes initial totals, reset clears totals
- `src/components/rooms/ChatHeader.tsx` - Imports formatTokenCount, reads tokenTotals and hasMessages from store, renders conditional token span
- `src/hooks/useRoomStream.ts` - Destructures updateTokenTotals, refactors turn:end to parse once and call both completeTurn + updateTokenTotals, adds updateTokenTotals to dependency array

## Decisions Made
- `formatTokenCount` is a pure exported function outside the store — keeps it reusable and testable without needing store access
- `loadHistory` computes tokenTotals at load time by reducing over mapped messages — ensures users see correct totals even for rooms with existing history
- The turn:end handler parses JSON once and passes the result to both `completeTurn` and `updateTokenTotals` — avoids double-parsing per turn

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in test files (`tests/conversation/manager*.test.ts`) appeared in `tsc --noEmit` output — these are unrelated to this plan's changes and were present before execution. No `src/` errors.

## Next Phase Readiness
- tokenTotals state available in chatStore for use by export metadata (Plan 03)
- formatTokenCount available for reuse in any summary or export view
- No blockers

---
*Phase: 04-insights*
*Completed: 2026-03-20*
