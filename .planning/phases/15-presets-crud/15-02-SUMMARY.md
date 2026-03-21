---
phase: 15-presets-crud
plan: "02"
subsystem: ui
tags: [presets, crud, react, zustand, next.js, sidebar, agent-form]

# Dependency graph
requires:
  - phase: 15-01
    provides: presetStore, Preset type, /api/presets endpoints, DB presets table with seeded system presets

provides:
  - /presets list page with PresetCard grid (system presets show System badge, no edit/delete)
  - PresetCard component mirroring AgentCard with isSystem-based conditional actions
  - PresetForm component (create and edit modes, plain Input for model field)
  - /presets/new route wrapping PresetForm
  - /presets/[presetId]/edit server component fetching from DB, redirecting system presets
  - Sidebar Presets nav link between Agents and Providers using Layers icon
  - Agents page preset templates section reading from presetStore (DB-driven)
  - Agents new page resolves ?preset=id from DB query (no more static lookup)
  - AgentForm Save as Preset button in edit mode, POSTs to /api/presets

affects: [agents-page, presets-page, sidebar, agent-form]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PresetCard mirrors AgentCard: same ICON_MAP, Dialog confirmation, Badge for status indicators
    - PresetForm mirrors AgentForm: plain Input for model (no ModelCombobox since presets are templates)
    - Server component edit page fetches from DB and passes cast object to client PresetForm
    - Agents new page uses DB query for preset resolution instead of static array lookup

key-files:
  created:
    - src/components/presets/PresetCard.tsx
    - src/components/presets/PresetForm.tsx
    - src/app/(dashboard)/presets/page.tsx
    - src/app/(dashboard)/presets/new/page.tsx
    - src/app/(dashboard)/presets/[presetId]/edit/page.tsx
  modified:
    - src/components/layout/Sidebar.tsx
    - src/app/(dashboard)/agents/page.tsx
    - src/app/(dashboard)/agents/new/page.tsx
    - src/components/agents/AgentForm.tsx

key-decisions:
  - "PresetForm uses plain Input for model field instead of ModelCombobox — presets are templates and model field is free text"
  - "presets/[presetId]/edit is a server component that fetches from DB and redirects if preset.isSystem; casts DB row as unknown as Preset for PresetForm"
  - "agents/new/page.tsx resolves ?preset=id via DB query, casts result as unknown as AgentPreset for backward compat"
  - "Save as Preset only visible in isEditMode on AgentForm, POSTs directly to /api/presets"
  - "Presets list page uses local state for delete (handleDelete) mirroring agents page pattern"

patterns-established:
  - "PresetCard: same ICON_MAP and Dialog confirmation pattern as AgentCard"
  - "Server edit page: fetch from DB → redirect if system → cast to client type → render client form"

requirements-completed:
  - PRST-01
  - PRST-02
  - PRST-03
  - PRST-04

# Metrics
duration: 3min
completed: "2026-03-21"
---

# Phase 15 Plan 02: Presets UI Summary

**Full presets CRUD UI: /presets page with system-preset-aware PresetCard, create/edit forms, sidebar link, Save as Preset in AgentForm, and agents page migrated from static array to DB-driven presetStore**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T17:26:53Z
- **Completed:** 2026-03-21T17:29:56Z
- **Tasks:** 2 of 3 complete (Task 3 is human verification checkpoint)
- **Files modified:** 9

## Accomplishments

- Presets list page shows system presets with System badge and no edit/delete controls, user presets with full CRUD
- PresetCard and PresetForm components following established AgentCard/AgentForm patterns
- Agents page preset templates section now reads from DB via presetStore (AGENT_PRESETS static import removed)
- Save as Preset button on AgentForm edit mode POSTs agent config to /api/presets and redirects to /presets
- Sidebar updated with Presets link between Agents and Providers

## Task Commits

Each task was committed atomically:

1. **Task 1: Presets page, PresetCard, PresetForm, create/edit routes, and sidebar link** - `4791642` (feat)
2. **Task 2: Migrate agents page from static presets to DB, add "Save as Preset" to AgentForm** - `3aab9b0` (feat)
3. **Task 3: Verify presets CRUD flow end-to-end** - PENDING (human-verify checkpoint)

## Files Created/Modified

- `src/components/presets/PresetCard.tsx` - Preset display card with System badge and conditional edit/delete
- `src/components/presets/PresetForm.tsx` - Create/edit form for presets (plain Input for model field)
- `src/app/(dashboard)/presets/page.tsx` - Presets list page with usePresetStore and grid layout
- `src/app/(dashboard)/presets/new/page.tsx` - Create preset page wrapping PresetForm
- `src/app/(dashboard)/presets/[presetId]/edit/page.tsx` - Server component edit page, redirects if isSystem
- `src/components/layout/Sidebar.tsx` - Added Presets link with Layers icon between Agents and Providers
- `src/app/(dashboard)/agents/page.tsx` - Replaced AGENT_PRESETS with usePresetStore
- `src/app/(dashboard)/agents/new/page.tsx` - Replaced static lookup with DB query for ?preset=id
- `src/components/agents/AgentForm.tsx` - Added savingPreset state, handleSaveAsPreset, Save as Preset button in edit mode

## Decisions Made

- PresetForm uses plain Input for model field instead of ModelCombobox — presets are templates that store a model string, no provider-specific combobox needed
- presets/[presetId]/edit is a server component that fetches from DB and redirects if preset.isSystem; uses `preset as unknown as Preset` cast since DB row has matching fields
- agents/new/page.tsx now queries DB for preset by ID, casts as `unknown as AgentPreset` for AgentForm backward compat
- Save as Preset only visible in isEditMode, silently fails on error (same pattern as similar forms in codebase)
- Presets list page uses local state for optimistic delete updates, synced from store via useEffect

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All presets CRUD UI is complete pending human verification (Task 3 checkpoint)
- /presets page accessible from sidebar showing system presets
- Create/edit/delete flows implemented, build passes

## Self-Check: PASSED

Files verified:
- src/app/(dashboard)/presets/page.tsx: FOUND
- src/components/presets/PresetCard.tsx: FOUND
- src/components/presets/PresetForm.tsx: FOUND
- src/app/(dashboard)/presets/new/page.tsx: FOUND
- src/app/(dashboard)/presets/[presetId]/edit/page.tsx: FOUND
- src/components/layout/Sidebar.tsx: modified, contains /presets link
- src/app/(dashboard)/agents/page.tsx: modified, uses presetStore
- src/components/agents/AgentForm.tsx: modified, contains Save as Preset

Commits verified:
- 4791642: Task 1 FOUND
- 3aab9b0: Task 2 FOUND

---
*Phase: 15-presets-crud*
*Completed: 2026-03-21*
