---
phase: 01-foundation
plan: 03
subsystem: api
tags: [nextjs, drizzle, zod, sqlite, rest-api, vitest]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Drizzle schema (rooms, agents, roomAgents, messages, providerKeys tables), db singleton at src/db/index.ts"
  - phase: 01-02
    provides: "LLM gateway (generateLLM, streamLLM) and ProviderName type from src/lib/llm/gateway.ts"
provides:
  - "Complete REST API: 8 route handler files covering rooms, agents, room-agents, and providers"
  - "Zod validation schemas for all API request bodies (src/lib/validations.ts)"
  - "Copy-on-assign room-agent endpoint: copies all config columns from library agent at assignment time"
  - "Provider test endpoint using generateLLM from gateway with DEFAULT_TEST_MODELS map"
  - "Database seed script (src/db/seed.ts) for 5 default provider_keys rows"
  - "61 passing API and validation tests across tests/api/"
affects:
  - "01-04 (management UI): consumes all 8 route handlers via fetch"
  - "02-conversation-engine: may extend rooms/:roomId/agents and messages API"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "force-dynamic export on all GET route handlers that read from SQLite"
    - "Zod safeParse pattern: return 400 with issues array on validation failure"
    - "copy-on-assign: fetch library agent + INSERT roomAgents row with all config columns copied"
    - "Provider upsert: db.insert().onConflictDoUpdate() for idempotent key saving"
    - "API key masking: expose apiKey as boolean (!!row.apiKey) never raw string"

key-files:
  created:
    - src/lib/validations.ts
    - src/app/api/rooms/route.ts
    - src/app/api/rooms/[roomId]/route.ts
    - src/app/api/rooms/[roomId]/agents/route.ts
    - src/app/api/agents/route.ts
    - src/app/api/agents/[agentId]/route.ts
    - src/app/api/providers/route.ts
    - src/app/api/providers/[provider]/route.ts
    - src/app/api/providers/[provider]/test/route.ts
    - src/db/seed.ts
    - tests/api/rooms.test.ts
    - tests/api/agents.test.ts
  modified:
    - package.json

key-decisions:
  - "API key masking: GET /api/providers returns apiKey as boolean (true/false) not raw string — prevents key exposure via REST"
  - "Copy-on-assign position calculation: count existing roomAgents for the room and use count as position value"
  - "Provider test endpoint wraps generateLLM call in inner try/catch to distinguish provider errors (502) from system errors (500)"

patterns-established:
  - "All GET route handlers use export const dynamic = 'force-dynamic' to prevent Next.js caching stale DB reads"
  - "Validation pattern: safeParse body, return 400 with issues array if invalid, continue on success"
  - "Error handling pattern: outer try/catch returns 500; inner try/catch for provider-specific errors returns 502"

requirements-completed: [ROOM-01, ROOM-02, ROOM-03, ROOM-04, AGNT-01, AGNT-02, AGNT-03]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 01 Plan 03: REST API Routes Summary

**8 Next.js App Router route handlers implementing full CRUD for rooms, agents, providers, and room-agent assignment with Zod validation, copy-on-assign semantics, and LLM gateway integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T18:47:35Z
- **Completed:** 2026-03-19T18:50:34Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Implemented 8 REST API route handlers covering all CRUD operations for rooms, agents, room-agents, and providers
- Created Zod validation schemas for all 6 request body shapes with proper constraints (hex color, temperature range, enum providers)
- Implemented copy-on-assign room-agent endpoint copying all config columns from library agent at assignment time
- Provider test endpoint uses generateLLM from gateway with DEFAULT_TEST_MODELS map, updates status to 'verified' or 'failed'
- Seed script initializes 5 default provider_keys rows using onConflictDoNothing
- 61 tests pass across db, llm, and api test suites; npm run build exits 0 with all 8 routes listed as dynamic

## Task Commits

Each task was committed atomically:

1. **Task 1: Zod validation schemas and room/agent API routes** - `1c76a9c` (feat)
2. **Task 2: Provider API routes, seed script, and API tests** - `abcb510` (feat)

**Plan metadata:** (docs commit — created after this summary)

## Files Created/Modified

- `src/lib/validations.ts` - Zod schemas: createRoomSchema, createAgentSchema, updateAgentSchema, addAgentToRoomSchema, removeAgentFromRoomSchema, saveProviderKeySchema
- `src/app/api/rooms/route.ts` - GET (list with agentCount via leftJoin+groupBy) and POST (create room)
- `src/app/api/rooms/[roomId]/route.ts` - GET (detail with nested roomAgents+messages) and DELETE
- `src/app/api/rooms/[roomId]/agents/route.ts` - POST (copy-on-assign) and DELETE (remove by roomAgentId)
- `src/app/api/agents/route.ts` - GET (list all) and POST (create library agent)
- `src/app/api/agents/[agentId]/route.ts` - GET, PUT (partial update with updatedAt), DELETE
- `src/app/api/providers/route.ts` - GET returning all 5 providers with apiKey as boolean
- `src/app/api/providers/[provider]/route.ts` - PUT with onConflictDoUpdate upsert
- `src/app/api/providers/[provider]/test/route.ts` - POST using generateLLM + DEFAULT_TEST_MODELS + status update
- `src/db/seed.ts` - Seeds 5 default provider_keys rows (anthropic, openai, google, openrouter, ollama)
- `package.json` - Added db:seed script
- `tests/api/rooms.test.ts` - createRoomSchema validation + database layer pattern tests
- `tests/api/agents.test.ts` - createAgentSchema and updateAgentSchema validation tests

## Decisions Made

- **API key masking:** GET /api/providers returns `apiKey: boolean` (not the raw string). Prevents key exposure through the REST layer — the UI only needs to know if a key is configured, not what it is.
- **Position calculation:** copy-on-assign counts existing roomAgents for the room and uses that count as the position, giving the new agent the next slot in turn order.
- **Inner try/catch for provider test:** wraps only the generateLLM call to distinguish provider errors (updates status to 'failed', returns 502) from unexpected system errors (returns 500 without updating status).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Run `npm run db:seed` to initialize provider_keys rows in the database.

## Next Phase Readiness

- All 8 API route handlers are ready for consumption by the management UI (Plan 01-04)
- The `npx tsx src/db/seed.ts` command initializes the database before the UI is used
- All acceptance criteria from the plan are met: 61 tests pass, build succeeds, copy-on-assign verified

---
*Phase: 01-foundation*
*Completed: 2026-03-19*
