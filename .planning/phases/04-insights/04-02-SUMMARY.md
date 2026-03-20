---
phase: 04-insights
plan: 02
subsystem: ui
tags: [zustand, chatStore, llm, summary, next-api, fetch]

# Dependency graph
requires:
  - phase: 04-insights
    provides: chatStore with messages/tokenTotals state, ChatHeader component, LLM gateway generateLLM
  - phase: 04-01
    provides: hasMessages pattern in ChatHeader, chatStore reset pattern

provides:
  - POST /api/rooms/:roomId/summary endpoint (LLM-powered summary using first room agent's provider)
  - summary/summaryLoading state in chatStore with setSummary, clearSummary, setSummaryLoading actions
  - Summarize button in ChatHeader (hidden when no messages, disabled while loading)
  - Inline "Generating summary..." loading banner in MessageFeed
  - Summary result banner at bottom of MessageFeed (blue-styled, transient, replaced on re-click)
affects: [04-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transient LLM result stored in Zustand store — not persisted as message, replaced on re-click"
    - "useChatStore.getState() pattern for imperative store access in async event handlers"
    - "API endpoint uses first room agent by position order for provider/model selection"

key-files:
  created:
    - src/app/api/rooms/[roomId]/summary/route.ts
  modified:
    - src/stores/chatStore.ts
    - src/components/rooms/ChatHeader.tsx
    - src/components/rooms/MessageFeed.tsx

key-decisions:
  - "Summary is transient (Zustand state only, not persisted to DB) — clicking Summarize again simply calls setSummary with new result, replacing old"
  - "First room agent determined by position column ASC — consistent with ConversationManager speaker ordering"
  - "handleSummarize uses useChatStore.getState() for setSummaryLoading/setSummary — avoids closure staleness in async function"

patterns-established:
  - "Transient LLM analysis results in store state: not messages, not DB rows — pure UI state"

requirements-completed: [INSI-02]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 4 Plan 02: On-Demand Conversation Summary Summary

**Summarize button in ChatHeader triggers POST /api/rooms/:roomId/summary which calls generateLLM using first room agent's provider, result shown as transient blue banner at bottom of MessageFeed**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-20T11:16:44Z
- **Completed:** 2026-03-20T11:19:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- POST /api/rooms/:roomId/summary endpoint builds message transcript and calls generateLLM with a conversation summarizer system prompt using first room agent's provider/model
- chatStore gains summary/summaryLoading state with setSummary, clearSummary, setSummaryLoading actions; reset() clears both
- Summarize button in ChatHeader is gated behind hasMessages (hidden when empty), disabled while summaryLoading, shows "Generating..." label during loading
- Animated "Generating summary..." banner and summary result banner rendered at bottom of MessageFeed using blue color scheme

## Task Commits

Each task was committed atomically:

1. **Task 1: Create summary API endpoint and add summary state to chatStore** - `66367d3` (feat)
2. **Task 2: Add Summarize button to ChatHeader and summary banner to MessageFeed** - `a9d979a` (feat)

## Files Created/Modified
- `src/app/api/rooms/[roomId]/summary/route.ts` - POST endpoint: loads messages, gets first room agent, fetches provider key, builds transcript, calls generateLLM at temperature 0.3
- `src/stores/chatStore.ts` - Added summary/summaryLoading state fields, setSummary/clearSummary/setSummaryLoading actions, reset clears both
- `src/components/rooms/ChatHeader.tsx` - Added summaryLoading selector, handleSummarize async function, Summarize button with hasMessages gate
- `src/components/rooms/MessageFeed.tsx` - Added summary/summaryLoading selectors, loading banner with animate-pulse, result banner with blue border

## Decisions Made
- Summary is transient (Zustand state only, not persisted to DB) — clicking Summarize again simply calls setSummary with new result, replacing old
- First room agent determined by position column ASC — consistent with ConversationManager speaker ordering
- handleSummarize uses useChatStore.getState() for setSummaryLoading/setSummary — avoids closure staleness in async function

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in test files (`tests/conversation/manager*.test.ts`) appeared in `tsc --noEmit` output — these are unrelated to this plan's changes and were present before execution. No `src/` errors.

## Next Phase Readiness
- Summary state (and formatTokenCount from Plan 01) available for Plan 03 export feature
- No blockers

---
*Phase: 04-insights*
*Completed: 2026-03-20*
