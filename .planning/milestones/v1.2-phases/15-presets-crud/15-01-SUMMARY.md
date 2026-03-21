---
phase: 15-presets-crud
plan: 01
subsystem: database, api
tags: [drizzle, sqlite, zod, zustand, nextjs, presets]

# Dependency graph
requires: []
provides:
  - presets SQLite table with isSystem boolean, all agent config fields, timestamps
  - migration 0001_secret_diamondback.sql creating presets table
  - 3 system presets seeded (devils-advocate, code-reviewer, researcher)
  - createPresetSchema and updatePresetSchema Zod validators
  - GET/POST /api/presets with system-first ordering
  - GET/PUT/DELETE /api/presets/[presetId] with 403 guards on system presets
  - usePresetStore Zustand store with full CRUD actions
affects: [15-02-ui, future-preset-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - drizzle-kit generate + migrate workflow for schema changes
    - isSystem server-controlled field pattern (not in Zod schema, always set server-side)
    - System resource protection via 403 guard on PUT/DELETE

key-files:
  created:
    - src/app/api/presets/route.ts
    - src/app/api/presets/[presetId]/route.ts
    - src/stores/presetStore.ts
    - src/db/migrations/0001_secret_diamondback.sql
    - tests/db/presets.test.ts
    - tests/api/presets.test.ts
  modified:
    - src/db/schema.ts
    - src/db/seed.ts
    - src/lib/validations.ts
    - tests/setup.ts

key-decisions:
  - "isSystem field not in createPresetSchema/updatePresetSchema — server always sets it, clients cannot override"
  - "System preset IDs use stable slugs (devils-advocate, code-reviewer, researcher) not nanoid — enables idempotent seeding"
  - "GET uses select() not db.query (no relations needed) — simpler, avoids relation setup"
  - "PUT/DELETE check isSystem before mutation — returns 403 with descriptive error"

patterns-established:
  - "Server-controlled boolean pattern: isSystem absent from Zod schema, hardcoded in POST handler"
  - "Idempotent seeding with onConflictDoNothing() and stable IDs"
  - "System resource protection: query first, check flag, return 403 before any mutation"

requirements-completed: [PRST-01, PRST-03, PRST-04]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 15 Plan 01: Presets Data Layer and API Summary

**SQLite presets table with isSystem guard, 3 seeded system presets, full CRUD API at /api/presets, and Zustand presetStore ready for UI consumption**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-21T17:20:36Z
- **Completed:** 2026-03-21T17:24:02Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Presets DB table with all agent config fields + isSystem boolean + timestamps; migration generated and applied
- 3 system presets seeded from AgentPresets.ts with stable IDs and onConflictDoNothing (idempotent)
- Full CRUD API: GET/POST /api/presets + GET/PUT/DELETE /api/presets/[presetId] with 403 on system preset mutations
- Zustand presetStore with fetchPresets/createPreset/updatePreset/deletePreset
- 16 tests across 2 test files (DB operations + Zod schema validation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Presets DB schema, migration, seed, Zod schemas, and test scaffolds** - `ebba4da` (feat)
2. **Task 2: Presets API routes and Zustand presetStore** - `e38364e` (feat)

## Files Created/Modified

- `src/db/schema.ts` - Added presets table definition with isSystem boolean column
- `src/db/migrations/0001_secret_diamondback.sql` - Generated migration creating presets table
- `src/db/seed.ts` - Updated to seed 3 system presets from AGENT_PRESETS with stable IDs
- `src/lib/validations.ts` - Added createPresetSchema and updatePresetSchema (no isSystem field)
- `tests/setup.ts` - Added presets table to createTestDb() in-memory SQLite setup
- `tests/db/presets.test.ts` - 4 DB operation tests (insert system, insert user, delete, ordering)
- `tests/api/presets.test.ts` - 9 Zod schema validation tests
- `src/app/api/presets/route.ts` - GET (system-first ordering) and POST (isSystem: false hardcoded)
- `src/app/api/presets/[presetId]/route.ts` - GET/PUT/DELETE with isSystem guard returning 403
- `src/stores/presetStore.ts` - Zustand store with Preset interface and full CRUD actions

## Decisions Made

- isSystem field excluded from both Zod schemas — server always controls this value, no client override possible
- Stable IDs (devils-advocate, code-reviewer, researcher) used for system presets for idempotent seeding
- db.select() approach used in [presetId] route instead of db.query — avoids relation setup, simpler
- System preset 403 guard: query before mutation, check isSystem, return descriptive error

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing Biome config schema mismatch (biome.json references 2.0.0 schema, CLI is 2.4.8) prevented `npm run lint`. This is a pre-existing out-of-scope issue documented in STATE.md from Phase 13. Build passes cleanly.

## Next Phase Readiness

- API layer complete and ready for UI consumption by Phase 15-02
- presetStore exported and ready for component integration
- 3 system presets seeded and protected from deletion/editing

---
*Phase: 15-presets-crud*
*Completed: 2026-03-21*
