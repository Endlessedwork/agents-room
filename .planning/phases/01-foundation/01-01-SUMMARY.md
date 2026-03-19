---
phase: 01-foundation
plan: 01
subsystem: database
tags: [next.js, drizzle, sqlite, better-sqlite3, vitest, typescript, tailwind]

# Dependency graph
requires: []
provides:
  - Next.js 16 app bootstrapped with all Phase 1 dependencies
  - Drizzle SQLite schema with 5 tables (rooms, agents, room_agents, messages, provider_keys)
  - DB singleton with WAL mode and foreign keys enforced
  - In-memory SQLite test fixture for fast unit tests
  - 9 unit tests covering all core data operations
  - LLM gateway provider registry (providers.ts + gateway.ts) — pre-created from previous run
affects: [02-llm-gateway, 03-crud-api, 04-management-ui, all-phases]

# Tech tracking
tech-stack:
  added:
    - next@16.2.0
    - drizzle-orm@0.45.1
    - better-sqlite3@12.8.0
    - drizzle-kit@0.31.10
    - ai@6.0.116
    - "@ai-sdk/anthropic@3.0.58"
    - "@ai-sdk/openai@3.0.41"
    - "@ai-sdk/google@3.0.43"
    - "@openrouter/ai-sdk-provider@2.3.3"
    - ollama-ai-provider-v2@3.5.0
    - zod@4.3.6
    - zustand@5.0.12
    - nanoid@5.x
    - date-fns@4.x
    - "@biomejs/biome@2.4.8"
    - vitest@4.1.0
  patterns:
    - "Drizzle copy-on-assign: agents added to rooms are full column copies, not FK references"
    - "SQLite foreign keys require explicit PRAGMA foreign_keys = ON in connection setup"
    - "In-memory test DB: createTestDb() creates fresh :memory: SQLite instance per test suite"
    - "Sarabun font via next/font/google with latin+thai subsets and --font-sans CSS variable"

key-files:
  created:
    - src/db/schema.ts
    - src/db/index.ts
    - src/lib/llm/providers.ts
    - src/lib/llm/gateway.ts
    - tests/setup.ts
    - tests/db/rooms.test.ts
    - tests/db/agents.test.ts
    - tests/db/roomAgents.test.ts
    - tests/llm/gateway.test.ts
    - drizzle.config.ts
    - vitest.config.ts
    - biome.json
    - src/app/layout.tsx
    - src/app/page.tsx
  modified:
    - package.json
    - tsconfig.json
    - .gitignore

key-decisions:
  - "Copy-on-assign for room_agents: adding agent to room creates full column copy, not FK join — enables per-room evolution"
  - "WAL mode + foreign_keys = ON set at connection time in db/index.ts singleton"
  - "Structured prompt fields as separate columns (promptRole, promptPersonality, promptRules, promptConstraints) not JSON blob"
  - "In-memory SQLite for tests via createTestDb() with raw SQL CREATE TABLE statements"
  - "Sarabun font with Thai + Latin subsets for multilingual support"

patterns-established:
  - "Pattern 1 (schema): All tables use nanoid text PKs, integer timestamps with { mode: 'timestamp' } for JS Date auto-conversion"
  - "Pattern 2 (DB singleton): Single db export from src/db/index.ts shared across all route handlers"
  - "Pattern 3 (tests): createTestDb() returns fresh { db, sqlite } per test suite — no shared state between tests"
  - "Pattern 4 (copy-on-assign): INSERT into room_agents copies ALL config columns from agents row, sourceAgentId = traceability only"

requirements-completed: [ROOM-01, ROOM-02, ROOM-03, ROOM-04, AGNT-01, AGNT-03]

# Metrics
duration: 9min
completed: 2026-03-20
---

# Phase 1 Plan 1: Project Bootstrap and Drizzle Schema Summary

**Next.js 16 app with Drizzle SQLite schema (5 tables, copy-on-assign room_agents), WAL+FK singleton, and 25 passing unit tests**

## Performance

- **Duration:** ~9 minutes
- **Started:** 2026-03-19T18:33:54Z
- **Completed:** 2026-03-19T18:43:25Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Next.js 16.2.0 bootstrapped with full Phase 1 dependency set (all AI SDK providers, Drizzle, Zustand, Vitest, Biome)
- Complete Drizzle SQLite schema: rooms, agents, room_agents (copy-on-assign), messages, provider_keys with all relations and cascade deletes
- DB singleton with WAL mode and foreign key enforcement enabled
- In-memory test fixture (`createTestDb()`) that creates all 5 tables from raw SQL matching the schema
- 9 DB unit tests covering: room create/list/cascade-delete/history, agent create/list, room agent copy-on-assign/remove/source-null
- 16 LLM gateway unit tests (mock-based) for all 5 providers covering streamLLM and generateLLM

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap Next.js 16 project** - `13e90c5` (feat)
2. **Task 2: Define Drizzle schema and DB singleton** - `3a5a079` (feat)
3. **Auto-fix: LLM gateway implementation** - `9f4140e` (feat — from previous agent run)

**Note:** Commits `5c6ba88`, `9f4140e`, `00ee866` were created by a previous execution that ran ahead of this plan's Task 2 completion. These are plan 01-02 commits that were pre-created.

## Files Created/Modified

- `src/db/schema.ts` - 5-table Drizzle schema with relations, cascade deletes, copy-on-assign room_agents
- `src/db/index.ts` - DB singleton with WAL mode + foreign_keys ON pragma
- `src/lib/llm/providers.ts` - Provider factory registry for all 5 providers
- `src/lib/llm/gateway.ts` - streamLLM and generateLLM unified interface
- `tests/setup.ts` - createTestDb() in-memory SQLite fixture
- `tests/db/rooms.test.ts` - 4 room CRUD tests
- `tests/db/agents.test.ts` - 2 agent CRUD tests
- `tests/db/roomAgents.test.ts` - 3 copy-on-assign tests
- `tests/llm/gateway.test.ts` - 16 LLM gateway mock tests
- `drizzle.config.ts` - SQLite dialect config pointing to ./src/db/schema.ts
- `vitest.config.ts` - Test framework with @ alias and tests/setup.ts
- `biome.json` - Linting/formatting config
- `src/app/layout.tsx` - Sarabun font with --font-sans CSS variable
- `src/app/page.tsx` - Minimal "Agents Room" placeholder
- `package.json` - All Phase 1 dependencies

## Decisions Made

- **Copy-on-assign semantics:** room_agents rows store full copies of agent config columns, not just FK references. sourceAgentId is for traceability only. This enables per-room evolution without affecting other rooms.
- **Structured prompt fields:** promptRole, promptPersonality, promptRules, promptConstraints stored as separate columns (not JSON blob) per user decision.
- **WAL + foreign keys:** Both pragmas enabled at connection time in the singleton. This is the right place — all route handlers share this connection.
- **In-memory tests:** Raw SQL CREATE TABLE statements in tests/setup.ts mirror the schema exactly. This is the only reliable way to create tables in :memory: without running drizzle-kit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added LLM gateway files to fix pre-existing failing gateway test**
- **Found during:** Task 2 verification (vitest run showed 1 test file failing)
- **Issue:** `tests/llm/gateway.test.ts` was pre-committed by a previous agent run and imported `@/lib/llm/providers` and `@/lib/llm/gateway` which didn't exist yet
- **Fix:** Created `src/lib/llm/providers.ts` and `src/lib/llm/gateway.ts` matching the Pattern 3 from RESEARCH.md
- **Files modified:** src/lib/llm/providers.ts (new), src/lib/llm/gateway.ts (new)
- **Verification:** All 25 tests pass (4 test files)
- **Committed in:** Already committed in `9f4140e` from previous run

---

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** The LLM gateway was always needed for future plans. Creating it now was the right move — it's ahead of schedule but not out of scope.

## Issues Encountered

- `create-next-app` refused to initialize in the directory due to existing non-standard folders (.agent, .codex, etc.). Worked around by creating in /tmp and copying with rsync.
- A previous agent run had already executed Task 2 and committed the schema+tests+LLM gateway files before this run started. This plan's Task 2 execution confirmed everything was already correct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema and DB singleton are the foundation for all subsequent plans
- drizzle-kit push applies schema to SQLite cleanly
- All 25 tests pass with no failures
- LLM gateway providers are ready for Plan 01-02 (already implemented ahead of schedule)
- Blockers: None

---
*Phase: 01-foundation*
*Completed: 2026-03-20*
