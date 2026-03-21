---
phase: 11-tech-debt-cleanup
plan: 02
subsystem: testing
tags: [typescript, vitest, ai-sdk, type-casting, mocks]

requires:
  - phase: 11-tech-debt-cleanup-01
    provides: Dead code cleanup that preceded this type-fix pass

provides:
  - Zero TypeScript errors across all test files (npx tsc --noEmit exits 0)
  - Type-correct LanguageModel mock assertions in gateway.test.ts
  - Type-correct StreamTextResult mocks via makeMockStream and inline casts in manager test files

affects: [all future test files, any code that imports from test helpers]

tech-stack:
  added: []
  patterns:
    - "(model as any).doGenerate pattern for LanguageModel union type in AI SDK v6 tests"
    - "as unknown as ReturnType<typeof streamLLM> pattern for StreamTextResult mock boundaries"

key-files:
  created: []
  modified:
    - tests/llm/gateway.test.ts
    - tests/conversation/manager.test.ts
    - tests/conversation/manager-sse.test.ts

key-decisions:
  - "Cast model.doGenerate with (model as any) — LanguageModel is now a union in AI SDK v6 including string branch that has no doGenerate"
  - "Use as unknown as ReturnType<typeof streamLLM> for mock returns — StreamTextResult has 27+ required fields; unknown intermediate needed for deep structural incompatibility"
  - "Cast agent.name with (agent as any).name — buildContext receives a narrowed type that omits name property"

patterns-established:
  - "AI SDK v6 LanguageModel union: access implementation-only props via (x as any).prop, never cast the variable itself"
  - "StreamTextResult mock boundary: return { textStream, usage } as unknown as ReturnType<typeof streamLLM> — never widen to any"

requirements-completed: [DEBT-02]

duration: 3min
completed: 2026-03-21
---

# Phase 11 Plan 02: TypeScript Error Fix in Test Files Summary

**Zero TypeScript errors achieved by applying `(model as any)` and `as unknown as ReturnType<typeof streamLLM>` casts at test mock boundaries for AI SDK v6 type drift**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T13:57:54Z
- **Completed:** 2026-03-21T14:01:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Fixed 5 `LanguageModel.doGenerate` assertions in gateway.test.ts where AI SDK v6 changed LanguageModel to a union type including a string branch
- Fixed all StreamTextResult type mismatches in manager.test.ts (9 casts: makeMockStream + 7 inline mockImplementation returns) and manager-sse.test.ts (3 casts: makeMockStream + 2 inline returns)
- Fixed `agent.name` access in manager.test.ts buildContext spy where the agent parameter type was narrowed to exclude `name`
- All 175 tests pass, zero production code modified

## Task Commits

1. **Task 1: Fix LanguageModel type errors in gateway.test.ts** - `97da971` (fix)
2. **Task 2: Fix StreamTextResult and agent.name type errors in manager.test.ts and manager-sse.test.ts** - `0edcf0c` (fix)

## Files Created/Modified

- `tests/llm/gateway.test.ts` - 5 `model.doGenerate` assertions cast to `(model as any).doGenerate`
- `tests/conversation/manager.test.ts` - makeMockStream return cast, 7 inline mockImplementation returns cast, agent.name cast
- `tests/conversation/manager-sse.test.ts` - makeMockStream return cast, 2 inline mockImplementation returns cast

## Decisions Made

- Used `(model as any).doGenerate` instead of asserting the full LanguageModel interface — narrowest possible cast that fixes the union type issue
- Used `as unknown as ReturnType<typeof streamLLM>` (double cast via unknown) rather than `as any` — preserves intent that the mock shape is intentionally incomplete
- No production code changes — all fixes confined to test mock boundaries only

## Deviations from Plan

None - plan executed exactly as written. The only minor discovery: the `import type { streamLLM }` approach conflicted with the existing value import in manager.test.ts; used the already-imported value directly for `ReturnType<typeof streamLLM>` instead.

## Issues Encountered

One small import conflict: manager.test.ts already imports `streamLLM` as a value, so adding `import type { streamLLM }` caused a duplicate identifier error. Resolved by using the existing value import directly — `ReturnType<typeof streamLLM>` works with value imports in TypeScript.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 11 complete: both plans executed, DEBT-01 (dead code) and DEBT-02 (TypeScript errors) resolved
- `npx tsc --noEmit` exits 0 across all files
- All 175 tests pass
- No blockers for future phases

---
*Phase: 11-tech-debt-cleanup*
*Completed: 2026-03-21*
