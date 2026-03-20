---
phase: 04-insights
plan: 03
subsystem: ui
tags: [next-api, download, export, markdown, json, zustand, chatStore]

# Dependency graph
requires:
  - phase: 04-insights
    provides: chatStore with summary state, ChatHeader component, hasMessages pattern
  - phase: 04-01
    provides: tokenTotals state in chatStore
  - phase: 04-02
    provides: summary state in chatStore

provides:
  - GET /api/rooms/:roomId/export?format=md|json endpoint returning downloadable files
  - src/lib/export.ts with slugify, formatMarkdownExport, formatJsonExport pure functions
  - Export dropdown in ChatHeader (Markdown and JSON options, hidden when no messages)
  - Browser download triggered via hidden anchor element
  - Summary content included in exports when generated

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Browser download via dynamically created hidden anchor element — no library needed"
    - "Summary passed as URL query param to export endpoint (transient state, not persisted)"
    - "Click-outside dropdown handler uses setTimeout delay to avoid self-closing on trigger click"

key-files:
  created:
    - src/lib/export.ts
    - src/app/api/rooms/[roomId]/export/route.ts
  modified:
    - src/components/rooms/ChatHeader.tsx

key-decisions:
  - "Summary passed as ?summary= query param because it is transient Zustand state — not in DB, client reads chatStore.summary and URL-encodes it"
  - "Export file naming uses slugify(room.name) + YYYY-MM-DD date slice from ISO timestamp — no additional dependencies"
  - "formatMarkdownExport and formatJsonExport are pure functions in src/lib/export.ts — no side effects, no store access, testable in isolation"

patterns-established:
  - "Pure formatting functions in src/lib/ for testable output generation separate from HTTP concerns"

requirements-completed: [INSI-03]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 4 Plan 03: Conversation Export (Markdown and JSON) Summary

**Export dropdown in ChatHeader triggers GET /api/rooms/:roomId/export that returns Content-Disposition attachment files formatted by pure slugify/formatMarkdownExport/formatJsonExport utilities**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-20T11:21:21Z
- **Completed:** 2026-03-20T11:23:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- src/lib/export.ts provides slugify, formatMarkdownExport, and formatJsonExport as pure exported functions
- GET /api/rooms/:roomId/export endpoint loads room, agents, and messages from DB, builds ExportData, returns downloadable file
- Export dropdown in ChatHeader shows "Markdown (.md)" and "JSON (.json)" options; gated behind hasMessages so hidden on empty rooms
- Browser download triggered via hidden anchor — no library dependency; summary included in export when chatStore has a generated summary

## Task Commits

Each task was committed atomically:

1. **Task 1: Create export formatting utilities and API endpoint** - `cff15a1` (feat)
2. **Task 2: Add Export dropdown to ChatHeader** - `2b6195b` (feat)

## Files Created/Modified
- `src/lib/export.ts` - slugify, formatMarkdownExport (heading + agents + tokens + optional summary blockquote + transcript), formatJsonExport (JSON.stringify wrapper)
- `src/app/api/rooms/[roomId]/export/route.ts` - GET endpoint: validates format param, loads room/agents/messages, computes token totals, returns Response with Content-Disposition attachment header
- `src/components/rooms/ChatHeader.tsx` - Added useState/useEffect imports, summary selector, exportOpen state, handleExport function, Export button with dropdown, click-outside handler

## Decisions Made
- Summary passed as ?summary= query param because it is transient Zustand state (not in DB) — client reads chatStore.summary and URL-encodes it into the request
- Export file naming uses slugify(room.name) + YYYY-MM-DD date slice from ISO timestamp — no additional dependencies required
- formatMarkdownExport and formatJsonExport are pure functions in src/lib/export.ts — no side effects, no store access, easily testable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in test files (`tests/conversation/manager*.test.ts`) appeared in `tsc --noEmit` output — these are unrelated to this plan's changes and were present before execution. No `src/` errors.

## Next Phase Readiness
- All three INSI requirements complete (token display, on-demand summary, export)
- Phase 04 is now fully complete
- No blockers

## Self-Check: PASSED

All created files verified on disk. All task commits found in git history.

---
*Phase: 04-insights*
*Completed: 2026-03-20*
