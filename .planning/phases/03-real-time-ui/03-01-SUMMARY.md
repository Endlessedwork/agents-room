---
phase: 03-real-time-ui
plan: 01
subsystem: api
tags: [sse, server-sent-events, streaming, websockets-alternative, drizzle, nanoid]

requires:
  - phase: 02-conversation-engine
    provides: ConversationManager turn loop with streamLLM integration

provides:
  - StreamRegistry singleton bridging ConversationManager to browser SSE clients
  - SSE GET endpoint /api/rooms/[roomId]/stream returning text/event-stream
  - Messages GET endpoint with ordered history and roomAgent join
  - Messages POST endpoint persisting user messages with SSE notification
  - ConversationManager emitting 6 event types at all turn lifecycle points

affects: [03-real-time-ui-plan-02, chat-ui, frontend-components]

tech-stack:
  added: []
  patterns:
    - In-process SSE registry using Map<roomId, Set<Controller>> for fan-out
    - ReadableStream with start/cancel for SSE lifecycle management
    - emitSSE called at 6 ConversationManager lifecycle points for real-time updates

key-files:
  created:
    - src/lib/sse/stream-registry.ts
    - src/app/api/rooms/[roomId]/stream/route.ts
    - src/app/api/rooms/[roomId]/messages/route.ts
    - tests/sse/stream-registry.test.ts
    - tests/api/messages.test.ts
    - tests/api/stream.test.ts
    - tests/conversation/manager-sse.test.ts
  modified:
    - src/lib/conversation/manager.ts

key-decisions:
  - "SSE registry uses Set<Controller> per roomId for multi-client fan-out with silent cleanup of dead controllers"
  - "turn:cancel emitted on AbortError in catch block (not in finally) to distinguish abort from normal completion"
  - "manager-sse tests filter by roomId to prevent cross-test contamination from async turn loops"
  - "waitForEvent helpers scoped to roomId via closure factory pattern"

patterns-established:
  - "SSE route: ReadableStream start()/cancel() for register/unregister lifecycle"
  - "emitSSE: try/catch per controller silently removes disconnected clients"
  - "ConversationManager SSE tests: filter mockEmitSSE.mock.calls by roomId to isolate async loops"

requirements-completed: [RTUI-01, RTUI-03]

duration: 6min
completed: 2026-03-20
---

# Phase 03 Plan 01: SSE Backend Infrastructure Summary

**In-process SSE bridge with StreamRegistry, SSE route, messages endpoint, and ConversationManager emitting 6 event types (turn:start, token, turn:end, turn:cancel, status, system)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T04:58:50Z
- **Completed:** 2026-03-20T05:05:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- StreamRegistry singleton with register/unregister/emit pattern and silent dead-client cleanup
- SSE GET endpoint returning text/event-stream response with heartbeat comment
- Messages GET endpoint returning ordered history with roomAgent metadata join
- Messages POST endpoint persisting user messages (role='user') and emitting SSE event
- ConversationManager extended with 12 emitSSE calls across all turn lifecycle points
- 27 new tests, all passing; full 118-test suite green

## Task Commits

1. **Task 1: StreamRegistry + SSE route + user message endpoint** - `d346da9` (feat)
2. **Task 2: Add SSE emission points to ConversationManager** - `ac58be2` (feat)

## Files Created/Modified

- `src/lib/sse/stream-registry.ts` - SSE bridge: registerController, unregisterController, emitSSE, _clearRegistry
- `src/app/api/rooms/[roomId]/stream/route.ts` - SSE GET endpoint with ReadableStream lifecycle
- `src/app/api/rooms/[roomId]/messages/route.ts` - GET history with roomAgent join; POST user message with emitSSE
- `src/lib/conversation/manager.ts` - Added emitSSE import and 11 emission calls at all lifecycle points
- `tests/sse/stream-registry.test.ts` - 6 unit tests for registry behavior
- `tests/api/messages.test.ts` - 5 tests for GET/POST messages endpoint
- `tests/api/stream.test.ts` - 5 tests for SSE route handler
- `tests/conversation/manager-sse.test.ts` - 7 tests for ConversationManager SSE emissions

## Decisions Made

- SSE registry uses `Set<Controller>` per roomId for multi-client fan-out with silent cleanup of dead controllers (try/catch on enqueue)
- `turn:cancel` emitted in the AbortError catch block, not the finally block, to precisely mark mid-stream aborts
- manager-sse tests filter `mockEmitSSE.mock.calls` by `roomId` using closure factories to prevent cross-test contamination from async turn loops still running between tests
- `waitForEvent` helpers use roomId-scoped closure factory pattern (`makeWaitForEvent(() => roomId)`) to always reference the current test's roomId

## Deviations from Plan

None - plan executed exactly as written. The only fix needed was in the test helpers: scoping `waitForEvent`/`waitForEventWithData` to filter by `roomId` to prevent false positives from async loops of previous tests (deviation Rule 1 - test isolation bug fix).

## Issues Encountered

- Initial manager-sse tests failed because `mockEmitSSE.mock.calls` accumulated events from previous tests' async loops still running after `afterEach`. Fixed by filtering all assertions and wait helpers by the current test's `roomId`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SSE backend pipe is complete and tested
- Plan 02 (Chat UI) can connect to `/api/rooms/[roomId]/stream` for real-time events
- Messages endpoint ready for frontend message injection
- All 6 event types documented: turn:start, token, turn:end, turn:cancel, status, system, user-message

---
*Phase: 03-real-time-ui*
*Completed: 2026-03-20*
