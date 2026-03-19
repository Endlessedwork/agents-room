---
phase: 02-conversation-engine
plan: "02"
subsystem: conversation
tags: [conversation-manager, turn-loop, abort-controller, sqlite, drizzle, vitest]

requires:
  - phase: 02-conversation-engine/02-01
    provides: ContextService.buildContext, SpeakerSelector, schema fields turnLimit/speakerStrategy
provides:
  - ConversationManager with start/pause/stop/resume lifecycle
  - Sentinel AbortController pattern for preventing double-start
  - Per-turn stream abort via AbortController
  - Message persistence with token counts
  - Auto-pause on repetition detection
affects:
  - 02-03 (SSE transport consumes ConversationManager.start/pause/stop)
  - 02-04 (REST API routes call ConversationManager lifecycle methods)

tech-stack:
  added: []
  patterns:
    - "Sentinel controller: register AbortController in map BEFORE launching IIFE to block double-start"
    - "Fire-and-forget IIFE: async IIFE with .catch() prevents silent unhandled rejections"
    - "Dependency injection: db passed as parameter (defaultDb fallback) enables in-memory testing"
    - "Agent message count filter: count only role='agent' messages when calculating resume offset"

key-files:
  created:
    - src/lib/conversation/manager.ts
    - tests/conversation/manager.test.ts
  modified: []

key-decisions:
  - "Sentinel controller registered before IIFE launch — provides immediate double-start guard without race condition"
  - "Per-turn AbortController replaces sentinel mid-loop; finally block cleans up only if owned controller still present"
  - "Resume counts only role='agent' messages (not system/user) to accurately calculate remaining turns"
  - "Repetition detection checked after each message persistence — auto-pause loop exits with system warning message"

patterns-established:
  - "Sentinel Controller: ConversationManager.start sets Map entry immediately, before async work, to prevent concurrent invocations"
  - "TDD + poll helpers: fire-and-forget tests use waitForMessages/waitForStatus polling loops with 5s timeout"

requirements-completed: [AGNT-04, CONV-01, CONV-02, CONV-05]

duration: 5min
completed: 2026-03-19
---

# Phase 02 Plan 02: ConversationManager Summary

**ConversationManager driving sequential agent turns via fire-and-forget IIFE with AbortController abort, message persistence with token counts, and repetition-triggered auto-pause**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T20:28:28Z
- **Completed:** 2026-03-19T20:33:51Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Turn loop calling SpeakerSelector.next → ContextService.buildContext → streamLLM in sequence per turn
- AbortController-based abort: stop() calls controller.abort() on in-flight stream; AbortError handled cleanly
- Message persistence with roomAgentId, model, inputTokens, outputTokens per completed turn
- Auto-pause when ContextService.detectRepetition returns true, with system warning message persisted
- Resume calculates remaining turns from existing agent message count (role='agent' filter)
- 11 tests across all lifecycle paths; full test suite 85/85 passing

## Task Commits

1. **Task 1 (RED): ConversationManager failing tests** - `6e9bb74` (test)
2. **Task 1 (GREEN): ConversationManager implementation** - `9543b65` (feat)

## Files Created/Modified

- `src/lib/conversation/manager.ts` — ConversationManager with start/pause/stop/resume, sentinel controller, turn loop, persistence
- `tests/conversation/manager.test.ts` — 11 test cases using mocked streamLLM, createTestDb, polling helpers

## Decisions Made

- Sentinel controller registered at the top of `start()` before any async DB work — ensures double-start check works even across async gaps
- Per-turn controller replaces sentinel inside the loop; `finally` block uses identity check to avoid deleting a replacement
- Resume filters messages by `role='agent'` to count correctly — system messages and user messages don't count toward turn offset
- Test for repetition detection uses pre-seeded identical messages so real ContextService.detectRepetition triggers without mocking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed resume message count to filter by role='agent'**
- **Found during:** Task 1 (resume test timed out)
- **Issue:** Plan said "count existing agent messages" but initial implementation counted all messages — system/user messages inflated the count, causing too few turns to run
- **Fix:** Added `eq(messages.role, 'agent')` to the count query
- **Files modified:** `src/lib/conversation/manager.ts`
- **Verification:** Resume test passes, producing exactly `turnLimit - agentMessageCount` new turns
- **Committed in:** 9543b65 (implementation commit)

**2. [Rule 1 - Bug] Fixed sentinel controller not preventing double-start due to race**
- **Found during:** Task 1 (double-start test assertion failed)
- **Issue:** Original design stored the controller per-turn inside the loop; between `start()` returning and the loop's first iteration, there was no sentinel in the map
- **Fix:** Register a sentinel AbortController immediately at start of `start()`, before any DB work; per-turn controllers replace it inside the loop
- **Files modified:** `src/lib/conversation/manager.ts`
- **Verification:** Double-start test confirms only 3 messages produced (not 6)
- **Committed in:** 9543b65 (implementation commit)

**3. [Rule 1 - Bug] Fixed resume test repetition detection false positive**
- **Found during:** Task 1 (resume test timed out due to auto-pause)
- **Issue:** Test seeded 5 messages with similar content ("existing message 0"..."existing message 4") which all tokenize to {"existing", "message"} — Jaccard 1.0, triggering auto-pause after turn 2
- **Fix:** Changed seeded messages to use factually distinct content with no token overlap; also used distinct per-turn mock responses
- **Files modified:** `tests/conversation/manager.test.ts`
- **Verification:** Resume test passes, all 10 messages produced
- **Committed in:** 9543b65 (implementation commit)

---

**Total deviations:** 3 auto-fixed (2 bugs in implementation, 1 bug in test data)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered

- The sentinel controller pattern required careful identity tracking in the `finally` block — `stop()` may have already removed the controller; the cleanup check `if (activeControllers.get(roomId) === controller)` prevents a replaced sentinel from being wrongly deleted.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ConversationManager is complete and ready for Plan 02-03 (SSE transport layer)
- `ConversationManager.start(roomId, db?)` is the entry point for SSE to invoke
- `ConversationManager.stop(roomId, db?)` is the abort hook for SSE stop events
- All Phase 2 conversation services are now implemented (ContextService, SpeakerSelector, ConversationManager)

---
*Phase: 02-conversation-engine*
*Completed: 2026-03-19*
