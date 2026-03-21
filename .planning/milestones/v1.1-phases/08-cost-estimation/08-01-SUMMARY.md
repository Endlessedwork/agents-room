---
phase: 08-cost-estimation
plan: 01
subsystem: pricing
tags: [llm-info, pricing, pure-functions, tdd, typescript]

# Dependency graph
requires: []
provides:
  - calculateCost pure function mapping (provider, model, inputTokens, outputTokens) to typed CostResult
  - formatCost function for display-ready strings with est. prefix
  - CostResult discriminated union type for type-safe cost handling
  - llm-info@1.0.69 installed as production dependency
affects:
  - 08-cost-estimation/08-02 (chatStore cost accumulation will import calculateCost)

# Tech tracking
tech-stack:
  added: [llm-info@^1.0.69]
  patterns:
    - Discriminated union CostResult type prevents callers from using sentinel as number
    - ollama provider check short-circuits before ModelInfoMap lookup
    - toFixed(4) for sub-$0.01, toFixed(2) for $0.01+ (avoids ugly floating point)

key-files:
  created:
    - src/lib/pricing.ts
    - tests/lib/pricing.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use llm-info ModelInfoMap for pricing — covers 50+ models, externally maintained, returns undefined for unknown IDs"
  - "CostResult discriminated union prevents accidental numeric use of sentinels"
  - "Ollama check precedes ModelInfoMap lookup — provider always wins over model name"

patterns-established:
  - "Pattern: calculateCost returns { type: 'dollars', value: number } | { type: 'sentinel', display: '—' | 'local' }"
  - "Pattern: formatCost is the single formatting gateway — never format CostResult directly in components"

requirements-completed: [COST-01, COST-03]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 08 Plan 01: Pricing Module Summary

**Pure pricing calculation module using llm-info ModelInfoMap — calculateCost returns typed CostResult with dollar amounts for known models, '—' for unknown models, and 'local' for Ollama provider; formatCost produces 'est. $X.XX' prefixed display strings.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T01:52:03Z
- **Completed:** 2026-03-21T01:53:30Z
- **Tasks:** 1 (TDD: RED + GREEN + verified)
- **Files modified:** 4

## Accomplishments

- Installed llm-info@^1.0.69 as the sole new production dependency for v1.1
- Created `calculateCost` pure function covering all three pricing paths: known model (dollars), unknown model (sentinel '—'), Ollama provider (sentinel 'local')
- Created `formatCost` function that prepends 'est. $' to dollar amounts and passes through sentinels unchanged
- Wrote 10 unit tests via TDD covering all behavior paths; all pass in the full test suite (153/153)

## Task Commits

1. **RED - Failing tests** — `620e4a5` (test)
2. **GREEN - Implementation** — `3720085` (feat)

## Files Created/Modified

- `src/lib/pricing.ts` — calculateCost and formatCost pure functions; exports CostResult type
- `tests/lib/pricing.test.ts` — 10 unit tests covering all pricing paths
- `package.json` — llm-info@^1.0.69 added to dependencies
- `package-lock.json` — lockfile updated

## Decisions Made

- Used `CostResult` discriminated union (`type: 'dollars' | 'sentinel'`) so callers cannot misuse a sentinel value as a numeric dollar amount
- ollama provider check is the first condition in `calculateCost` — provider identity always overrides model name lookup
- Format thresholds: `toFixed(4)` for values below $0.01, `toFixed(2)` for $0.01 and above — matches RESEARCH.md guidance on floating-point display

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- biome.json config schema version (2.0.0) does not match biome CLI version (2.4.8) — pre-existing issue in the repo, not introduced by this plan. `npm run lint` fails project-wide for this reason. Out of scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `calculateCost` and `formatCost` are ready for import by chatStore (plan 08-02)
- Provider detection (ollama sentinel) is fully handled — plan 08-02 only needs to pass `agent.provider` to `calculateCost`
- No blockers for plan 08-02

---
*Phase: 08-cost-estimation*
*Completed: 2026-03-21*
