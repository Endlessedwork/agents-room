---
phase: 02-conversation-engine
plan: 03
subsystem: api
tags: [next.js, route-handlers, rest-api, conversation, drizzle, vitest]

requires:
  - phase: 02-conversation-engine/02-02
    provides: ConversationManager.start/pause/stop/resume with db parameter

provides:
  - POST /api/rooms/:roomId/conversation/start — fires ConversationManager.start fire-and-forget
  - POST /api/rooms/:roomId/conversation/pause — sets room status to paused
  - POST /api/rooms/:roomId/conversation/stop — aborts in-flight stream, sets idle
  - POST /api/rooms/:roomId/conversation/resume — continues from last turn count
  - scripts/test-conversation.ts — CLI smoke test for end-to-end verification
  - startConversationSchema — Zod schema for optional topic override on start

affects: [03-realtime-ui, frontend, phase-3]

tech-stack:
  added: []
  patterns:
    - "Conversation routes pass db singleton explicitly to ConversationManager (dependency injection pattern)"
    - "start/resume routes are fire-and-forget (no await on full loop); pause/stop routes await completion"
    - "All route handlers: export const dynamic = 'force-dynamic', await params (Next.js 16)"
    - "Route tests mock both ConversationManager and db to avoid SQLite dependency"

key-files:
  created:
    - src/app/api/rooms/[roomId]/conversation/start/route.ts
    - src/app/api/rooms/[roomId]/conversation/pause/route.ts
    - src/app/api/rooms/[roomId]/conversation/stop/route.ts
    - src/app/api/rooms/[roomId]/conversation/resume/route.ts
    - scripts/test-conversation.ts
    - tests/conversation/routes.test.ts
  modified:
    - src/lib/validations.ts

key-decisions:
  - "Routes pass db singleton explicitly to ConversationManager — plan omitted db arg but manager.ts requires it"
  - "start and resume are fire-and-forget at route level (no await) to return 200 immediately"
  - "pause and stop are awaited (synchronous state change needed before responding)"

patterns-established:
  - "Conversation route pattern: dynamic export + awaited params + delegate to ConversationManager + { ok, status } response"
  - "Route unit tests: mock both ConversationManager and db modules; test each endpoint independently"

requirements-completed: [AGNT-04, CONV-01, CONV-02, CONV-05]

duration: 10min
completed: 2026-03-19
---

# Phase 02 Plan 03: Conversation Control API Summary

**Four REST endpoints (start/pause/stop/resume) exposing ConversationManager over HTTP, plus CLI smoke test for end-to-end verification without UI**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-19T20:30:00Z
- **Completed:** 2026-03-19T20:40:00Z
- **Tasks:** 2 of 2
- **Files modified:** 7

## Accomplishments

- Four Next.js 16 dynamic route handlers delegate conversation lifecycle to ConversationManager
- CLI smoke test starts a real conversation, polls for messages, stops, and reports token usage
- 6 new route tests + all 91 existing tests passing; build succeeds with all 4 routes listed as dynamic

## Task Commits

Each task was committed atomically:

1. **Task 1: Conversation control REST endpoints** - `f3809b8` (feat)
2. **Task 2: CLI smoke test script** - `d392222` (feat)

## Files Created/Modified

- `src/app/api/rooms/[roomId]/conversation/start/route.ts` - POST endpoint that fires ConversationManager.start fire-and-forget
- `src/app/api/rooms/[roomId]/conversation/pause/route.ts` - POST endpoint that awaits ConversationManager.pause
- `src/app/api/rooms/[roomId]/conversation/stop/route.ts` - POST endpoint that awaits ConversationManager.stop
- `src/app/api/rooms/[roomId]/conversation/resume/route.ts` - POST endpoint that fires ConversationManager.resume fire-and-forget
- `scripts/test-conversation.ts` - CLI smoke test: verifies room/agents, starts, polls for 2 messages, stops, reports results
- `tests/conversation/routes.test.ts` - 6 unit tests covering all 4 route handlers with mocked ConversationManager
- `src/lib/validations.ts` - Added startConversationSchema (optional topic string, 1-1000 chars)

## Decisions Made

- Routes pass `db` singleton explicitly to ConversationManager — plan code omitted the `db` arg but the actual manager signature requires it (dependency injection pattern established in phase 02-02)
- `start` and `resume` endpoints do NOT await the turn loop (fire-and-forget at HTTP layer) — returns 200 immediately; loop runs in background
- `pause` and `stop` endpoints DO await (synchronous status change must complete before response)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ConversationManager calls to pass db parameter**
- **Found during:** Task 1 (Conversation control REST endpoints)
- **Issue:** Plan's route handler code called `ConversationManager.start(roomId)` without the required `db` argument. The actual manager signature is `start(roomId: string, db: DrizzleDB)` — established in phase 02-02.
- **Fix:** All 4 routes import `db` from `@/db` and pass it as second argument to ConversationManager methods
- **Files modified:** All 4 route files, scripts/test-conversation.ts
- **Verification:** TypeScript compilation passes (next build exits 0), all tests pass
- **Committed in:** f3809b8 (Task 1 commit), d392222 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Essential correctness fix. Without db, all routes would throw TypeScript errors and fail at runtime.

## Issues Encountered

None — TypeScript caught the db arg issue immediately during type-checking.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 4 conversation control endpoints are live and ready for Phase 3 UI to consume
- CLI smoke test (`npx tsx scripts/test-conversation.ts <roomId>`) validates full vertical slice before frontend work
- 91 tests passing, build clean — foundation solid for realtime UI phase

---
*Phase: 02-conversation-engine*
*Completed: 2026-03-19*
