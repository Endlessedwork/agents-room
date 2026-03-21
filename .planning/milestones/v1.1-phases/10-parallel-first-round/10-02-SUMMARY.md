---
phase: 10-parallel-first-round
plan: "02"
subsystem: conversation-engine
tags: [parallel-round, manager, tdd, sse, abort-safety]
dependency_graph:
  requires: [parallelFirstRound-column]
  provides: [runParallelRound, parallel-SSE-events]
  affects: [plans/10-03]
tech_stack:
  added: []
  patterns: [promise-all-before-allsettled, buffer-then-emit, abort-after-allsettled]
key_files:
  created: []
  modified:
    - src/lib/conversation/manager.ts
    - tests/conversation/manager.test.ts
decisions:
  - "Module-level runParallelRound() function matches getProviderConfig pattern — not a class method"
  - "Promise.all for contexts before Promise.allSettled for LLM calls is the structural isolation guarantee"
  - "Abort check after allSettled ensures zero partial persistence when stop() called mid-parallel-round"
  - "Re-register sentinel AbortController after parallel round so sequential loop's double-start guard works"
  - "emitSSE mock added to test file via vi.mock('@/lib/sse/stream-registry') for SSE event order assertions"
  - "buildContext spy uses bind() pattern to wrap original without recursive call issues"
metrics:
  duration: "3min"
  completed: "2026-03-21"
---

# Phase 10 Plan 02: runParallelRound ConversationManager Summary

**One-liner:** Buffer-then-emit parallel first round in ConversationManager using Promise.all-then-allSettled pattern, with abort safety and position-ordered persistence.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add parallel round tests to manager.test.ts | 41e093f | tests/conversation/manager.test.ts |
| 2 (GREEN) | Implement runParallelRound in ConversationManager | 613556e | src/lib/conversation/manager.ts, tests/conversation/manager.test.ts |

## Verification

- `npx vitest run tests/conversation/manager.test.ts` passes all 20 tests including 5 new parallel round tests
- `npm test` passes full suite: 175 tests across 16 files, zero failures
- `grep -n 'runParallelRound' src/lib/conversation/manager.ts` shows function at line 39 and call site at line 212
- `grep -n 'parallel:start\|parallel:end\|parallel:cancel' src/lib/conversation/manager.ts` confirms all 3 SSE events

## Key Implementation Details

**runParallelRound() flow:**
1. Emit `parallel:start` with `agentCount`
2. `Promise.all` builds all agent contexts — this happens BEFORE any LLM call
3. `Promise.allSettled` runs all LLM calls concurrently, buffering full text in memory
4. Abort check: if `controller.signal.aborted`, emit `parallel:cancel`, return `{succeeded: false}`
5. Sequential persist loop: iterate agents in position order, emit `turn:start`, `token`, persist message, `turn:end`
6. Emit `parallel:end` after all turn events
7. Return `{succeeded: true, turnsCompleted: N}`

**Branch in start():**
```typescript
if (room.parallelFirstRound && turnCount === 0) {
  const parallelResult = await runParallelRound(...);
  if (!parallelResult.succeeded) return;
  turnCount = parallelResult.turnsCompleted;
  activeControllers.set(roomId, new AbortController()); // sentinel for sequential phase
}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fragile buildContext spy pattern in test**
- **Found during:** Task 1 RED verification
- **Issue:** Initial test implementation used `mockRestore()` inside `mockImplementation()` which caused recursive calls and the spy was only captured once
- **Fix:** Used `bind()` pattern to capture original function reference, then wrapped it in `mockImplementation()` without recursion
- **Files modified:** tests/conversation/manager.test.ts
- **Commit:** 613556e (fix applied as part of GREEN phase)

## Self-Check: PASSED

- `src/lib/conversation/manager.ts` contains `async function runParallelRound(` — FOUND
- `tests/conversation/manager.test.ts` contains `describe('parallel first round'` — FOUND
- Commit 41e093f exists (RED phase) — FOUND
- Commit 613556e exists (GREEN phase) — FOUND
- `npm test` exits 0 with 175 tests — CONFIRMED
