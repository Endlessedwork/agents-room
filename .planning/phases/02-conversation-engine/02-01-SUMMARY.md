---
phase: 02-conversation-engine
plan: 01
subsystem: conversation
tags: [schema, context-service, speaker-selector, tdd, sliding-window, jaccard]
dependency_graph:
  requires: [01-foundation]
  provides: [context-service, speaker-selector]
  affects: [02-02-conversation-manager]
tech_stack:
  added: []
  patterns: [dependency-injection, tdd-red-green, jaccard-similarity]
key_files:
  created:
    - src/lib/conversation/context-service.ts
    - src/lib/conversation/speaker-selector.ts
    - tests/conversation/context-service.test.ts
    - tests/conversation/speaker-selector.test.ts
  modified:
    - src/db/schema.ts
    - tests/setup.ts
decisions:
  - "ContextService accepts db as parameter (dependency injection) — no singleton import — enables in-memory test DB"
  - "Jaccard similarity threshold 0.85 on last 5 messages for repetition detection — word tokens with length > 2"
  - "SpeakerSelector falls back to round-robin on ANY LLM error or invalid index — maintains conversation liveness"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-19"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
  tests_added: 13
  tests_total: 74
---

# Phase 02 Plan 01: Schema, ContextService, and SpeakerSelector Summary

**One-liner:** Schema migration for turnLimit/speakerStrategy columns, ContextService with Jaccard-based repetition detection, and SpeakerSelector with round-robin/LLM-selected strategies with automatic fallback.

## What Was Built

Three building blocks for the conversation engine:

1. **Schema migration** — Added `turnLimit` (integer, default 20) and `speakerStrategy` (enum: round-robin | llm-selected, default round-robin) columns to the rooms table. Updated `tests/setup.ts` createTestDb() raw SQL to match. Applied via drizzle-kit push.

2. **ContextService** (`src/lib/conversation/context-service.ts`) — Static service that:
   - `buildContext(db, roomId, agent)`: queries the last 20 messages DESC, reverses to chronological order, maps the current agent's messages as `assistant` and all others as `user`, builds system prompt from non-null prompt fields joined with `\n\n`
   - `detectRepetition(db, roomId)`: queries last 5 messages, computes Jaccard similarity on word token sets (words > 2 chars, lowercase), returns true if last message exceeds 0.85 similarity with any prior message

3. **SpeakerSelector** (`src/lib/conversation/speaker-selector.ts`) — Stateful class that:
   - Round-robin: cycles through agents by position using a `turnIndex` counter
   - LLM-selected: calls `generateLLM` with agent list, parses integer index from response; falls back to round-robin on any error or invalid response
   - `getProviderConfig` injected via constructor for testability

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Schema migration (turnLimit, speakerStrategy) | 59c171a |
| 2 RED | ContextService failing tests | 7926373 |
| 2 GREEN | ContextService implementation | 4f8469e |
| 3 RED | SpeakerSelector failing tests | 6d46968 |
| 3 GREEN | SpeakerSelector implementation | a44ff21 |

## Test Results

All 74 tests pass (zero failures):
- 13 new tests added (8 for ContextService, 5 for SpeakerSelector)
- 61 pre-existing tests — no regressions
- Full suite: `npx vitest run` exits 0

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Dependency injection for db parameter** — ContextService accepts `db` as a parameter rather than importing the singleton. This allows tests to pass an in-memory test database without mocking module imports.

2. **Jaccard on tokens with length > 2** — Token filter excludes short words (articles, prepositions) to focus similarity on meaningful content words.

3. **SpeakerSelector fallback is unconditional** — Any error or out-of-range index from LLM falls back to round-robin. This guarantees conversation liveness even if the LLM selection fails repeatedly.

## Self-Check: PASSED

All artifacts verified:
- src/lib/conversation/context-service.ts — FOUND
- src/lib/conversation/speaker-selector.ts — FOUND
- tests/conversation/context-service.test.ts — FOUND
- tests/conversation/speaker-selector.test.ts — FOUND
- Commit 59c171a (schema) — FOUND
- Commit a44ff21 (SpeakerSelector) — FOUND
