---
phase: 14-providers-page-model-picker
plan: 03
subsystem: ui
tags: [nextjs, react, combobox, base-ui, model-picker, agent-form, provider-status]

# Dependency graph
requires:
  - phase: 14-providers-page-model-picker
    provides: GET /api/providers/[provider]/models endpoint returning ModelInfo[], ProviderStatus type from ProviderCard
provides:
  - ModelCombobox component with searchable combobox, loading, error, and fallback states
  - Provider status indicator (colored dot + label) in AgentForm next to provider selector
  - Integrated model selection UX: combobox when configured, free-text when unconfigured/failed
affects: [any future agent editing UI, agent creation flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@base-ui/react Combobox with items/filter/itemToStringLabel/itemToStringValue props for controlled searchable dropdown"
    - "Conditional rendering pattern: loading -> error/unconfigured fallback -> combobox"
    - "Inline getStatusConfig duplication from ProviderCard (acceptable for small helper)"

key-files:
  created:
    - src/components/agents/ModelCombobox.tsx
  modified:
    - src/components/agents/AgentForm.tsx

key-decisions:
  - "Used (m as unknown as ModelInfo) double-cast for @base-ui/react Combobox generic type compatibility — TypeScript requires unknown intermediary when casting string to ModelInfo"
  - "Inline IIFE pattern for statusCfg in JSX avoids extracting currentProviderStatus/isProviderConfigured as separate computed vars"
  - "providerConfigured computed at render time from providerStatuses map — avoids separate isProviderConfigured state"

patterns-established:
  - "ModelCombobox pattern: useEffect fetches on provider+configured change, renders loading/error/combobox states"
  - "Provider status fetch pattern: single useEffect on mount, builds Record<string, ProviderStatus> map from array response"

requirements-completed: [MODL-01, MODL-02, MODL-03, MODL-04, MODL-05]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 14 Plan 03: Model Combobox Summary

**Searchable model combobox with @base-ui/react replacing plain text input in AgentForm, plus colored provider status indicator (green/yellow/gray) next to provider selector**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T16:12:20Z
- **Completed:** 2026-03-21T16:14:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created ModelCombobox component with three states: loading (spinner), combobox (searchable dropdown), fallback (free-text Input)
- Client-side case-insensitive filtering works for large model lists (OpenRouter 400+) via @base-ui/react Combobox filter prop
- Provider status fetched on AgentForm mount; status dot shows green (Connected), yellow (Not tested), gray (Not configured)
- Capability tags rendered as small badges next to model names in the dropdown
- ModelCombobox skips fetch entirely when providerConfigured=false, shows free-text immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ModelCombobox component** - `eae47e4` (feat)
2. **Task 2: Integrate ModelCombobox and provider status into AgentForm** - `a462c57` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `src/components/agents/ModelCombobox.tsx` - Searchable combobox with loading/error/fallback states, capability tags
- `src/components/agents/AgentForm.tsx` - Added ModelCombobox, provider status fetch, getStatusConfig, colored dot indicator

## Decisions Made
- Double-cast `(m as unknown as ModelInfo)` required for @base-ui/react Combobox generic type callbacks — TypeScript rejects direct `(m as ModelInfo)` when base type is `string`
- `getStatusConfig` duplicated inline in AgentForm (12 lines) rather than extracted to shared util — acceptable for small helper, avoids creating a new file
- `providerConfigured` computed at render time from `providerStatuses[provider] !== 'unconfigured'` — no separate derived state needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type cast for @base-ui/react Combobox callbacks**
- **Found during:** Task 1 (Create ModelCombobox component) — build verification
- **Issue:** `(m as ModelInfo)` fails TypeScript check because Combobox generic infers `m` as `string`, and `string` does not overlap with `ModelInfo` sufficiently
- **Fix:** Changed to `(m as unknown as ModelInfo)` in `itemToStringLabel`, `itemToStringValue`, and `filter` callbacks
- **Files modified:** src/components/agents/ModelCombobox.tsx
- **Verification:** `npm run build` passes with no TypeScript errors
- **Committed in:** eae47e4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type error bug fix)
**Impact on plan:** Essential fix for TypeScript compatibility with @base-ui/react Combobox. No scope creep.

## Issues Encountered
- `npm run lint` reports pre-existing biome.json schema version mismatch (2.0.0 vs CLI 2.4.8) — known out-of-scope issue documented in STATE.md. Build (`npm run build`) succeeds cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Model combobox integrated and ready for browser testing
- Phase 14 (providers-page-model-picker) all 3 plans complete
- Phase 15 (presets) can begin — AgentForm now has full provider/model UX

## Self-Check: PASSED
- src/components/agents/ModelCombobox.tsx exists
- src/components/agents/AgentForm.tsx modified with ModelCombobox import and provider status
- Commit eae47e4 confirmed in git log
- Commit a462c57 confirmed in git log

---
*Phase: 14-providers-page-model-picker*
*Completed: 2026-03-21*
