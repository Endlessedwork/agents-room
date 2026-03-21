---
phase: 13-agent-editing
plan: 01
subsystem: ui
tags: [react, zustand, next.js, agentform, agentcard]

# Dependency graph
requires:
  - phase: 12-agent-notes
    provides: AgentForm with notes field, AgentCard with notes display, updateAgent store action
provides:
  - Dual-mode AgentForm accepting initialData prop for edit mode
  - Edit page at /agents/[agentId]/edit that fetches agent and pre-populates form
  - Edit button on AgentCard linking to /agents/[id]/edit
  - Copy-on-assign disclosure banner in edit mode
affects: [14-model-picker, 15-presets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-mode form pattern: initialData prop overrides preset defaults for edit mode"
    - "Zustand store.getState() call from client component for imperative updates"
    - "as unknown as Agent cast for Drizzle string → union type mismatch"

key-files:
  created:
    - src/app/(dashboard)/agents/[agentId]/edit/page.tsx
  modified:
    - src/components/agents/AgentForm.tsx
    - src/components/agents/AgentCard.tsx

key-decisions:
  - "Used as unknown as Agent cast in edit page to resolve Drizzle text() → union type mismatch; avoids runtime overhead and keeps type safety at component boundary"
  - "Pre-existing biome.json schema version mismatch (2.0.0 vs CLI 2.4.8) makes npm run lint fail — out of scope, not caused by this plan"

patterns-established:
  - "AgentForm dual-mode: initialData ?? preset ?? default fallback chain for all useState initializers"
  - "isEditMode = Boolean(initialData?.id) gate for submit branch and banner render"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 13 Plan 01: Agent Editing Summary

**Dual-mode AgentForm with initialData prop, /agents/[id]/edit server page, Edit button on AgentCard, and copy-on-assign yellow banner**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-21T14:31:15Z
- **Completed:** 2026-03-21T14:34:20Z
- **Tasks:** 2 of 2 (Task 2 human-verify: approved)
- **Files modified:** 3

## Accomplishments

- AgentForm now accepts `initialData` prop, pre-populating all fields (name, avatar color/icon, role, personality, rules, constraints, notes, provider, model, temperature) from an existing agent
- Edit page at `/agents/[agentId]/edit` fetches agent via Drizzle and renders AgentForm in edit mode
- AgentCard shows an outline "Edit" button (using `buttonVariants`) to the left of the Delete button, linking to `/agents/[id]/edit`
- Yellow copy-on-assign disclosure banner shown in edit mode only: "Editing this agent won't affect rooms already using it."
- Save in edit mode calls `useAgentStore.getState().updateAgent()` which issues PUT and updates Zustand store — no page reload needed

## Task Commits

Each task was committed atomically:

1. **Task 1: AgentForm dual-mode + edit page + Edit button** - `0cfe989` (feat)
2. **Task 2: Verify edit flow end-to-end** - human-verify checkpoint (approved)

**Plan metadata:** `c43e125` (docs: complete plan)

## Files Created/Modified

- `src/app/(dashboard)/agents/[agentId]/edit/page.tsx` - Server component fetching agent by ID, passing to AgentForm as initialData
- `src/components/agents/AgentForm.tsx` - Added initialData prop, isEditMode flag, pre-populated state, edit submit path, banner, "Save Changes" button text
- `src/components/agents/AgentCard.tsx` - Added Link with buttonVariants Edit button before Delete

## Decisions Made

- Used `as unknown as Agent` cast in edit page to bridge Drizzle `text()` column returning `string` vs `Agent.provider` expecting union type. Avoids runtime overhead, keeps type safety at the AgentForm boundary.
- Pre-existing biome.json schema mismatch (schema 2.0.0 vs CLI 2.4.8) causes `npm run lint` to fail regardless of changes — deferred to out-of-scope, not introduced by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added type cast for Drizzle provider string → Agent union type**

- **Found during:** Task 1 (edit page creation)
- **Issue:** TypeScript error TS2322 — Drizzle `db.query.agents.findFirst()` returns `provider: string` but `AgentForm initialData` expects `Agent` type where `provider` is `'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama'`
- **Fix:** Cast `row as unknown as Agent` in the edit page before passing to AgentForm
- **Files modified:** `src/app/(dashboard)/agents/[agentId]/edit/page.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `0cfe989` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug)
**Impact on plan:** Required for TypeScript to compile. No scope creep.

## Issues Encountered

None beyond the type cast deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Agent editing flow is fully implemented and ready for user verification
- Phase 14 (model picker) can build on the updated AgentForm
- Phase 15 (presets) can extend AgentForm with the same dual-mode pattern

## Self-Check: PASSED

All files present and task commit 0cfe989 verified.

---
*Phase: 13-agent-editing*
*Completed: 2026-03-21*
