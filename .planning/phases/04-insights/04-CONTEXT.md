# Phase 4: Insights - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Token usage visibility, on-demand conversation summaries, and conversation export. Users can see token counts per room in the chat header, generate LLM-powered summaries displayed inline, and download conversations as Markdown or JSON. No cost estimation, no analytics dashboards, no per-agent breakdowns — this is lightweight observability and export for a personal tool.

</domain>

<decisions>
## Implementation Decisions

### Token Usage Display
- Token counts shown in the **chat header bar** (existing sticky header from Phase 3) — compact text line: "Tokens: 12.4k in / 8.2k out"
- **Room totals only** — no per-agent breakdown in the header; per-message tokens already visible on each message bubble (Phase 3)
- **No cost estimation** — raw token counts only, no price lookup tables or user-configurable rates
- Updates **after each turn completes** — triggered by `turn:end` SSE event, which already carries token data from the AI SDK usage promise
- Token count calculated from persisted messages on room open, then incrementally updated via SSE during active conversation

### Summary Generation
- Triggered by a **"Summarize" button in the chat header** alongside Pause/Stop/Export controls
- Summary appears as an **inline system message** at the bottom of the chat — full-width banner matching the existing system message pattern (error/auto-pause banners from Phase 3)
- Uses the **first room agent's provider/model** to generate the summary — no extra configuration needed, reuses already-configured provider credentials
- **Always re-generable** — Summarize button stays clickable; new summary replaces the previous one in the chat
- While generating, shows an **inline "Generating..." banner** with a loading animation at the bottom of chat (same position where summary will appear)
- Summary is NOT persisted as a regular message — it's a transient display (regeneration replaces it)

### Conversation Export
- **Export dropdown button in the chat header** — click reveals "Markdown" and "JSON" options
- **Full metadata included** in exports: each message has sender name, role, model used, timestamp, token counts; file header includes room name, topic, agents list, total tokens
- **File naming**: slugified room name + export date, e.g., `design-review-2026-03-20.md` / `.json`
- **Markdown export includes the summary** (if one was generated) at the top of the file as a highlighted section, before the full transcript
- JSON export includes the summary as a top-level `summary` field (null if none generated)

### UI Visibility Rules
- Summarize and Export buttons **hidden when conversation is empty** — only appear once at least one message exists
- Token count line in header also hidden when no messages exist

### Claude's Discretion
- Summary prompt design (system prompt for generating useful summaries)
- Summary length/style
- Exact Markdown export formatting (heading levels, separator style, metadata presentation)
- JSON export schema structure
- Export dropdown component implementation
- Loading animation design for summary generation banner

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Chat Header (Phase 3 implementation)
- `src/components/chat/ChatHeader.tsx` — Existing sticky header with room name, status badge, turn count, and control buttons (Pause/Stop). Token display and Summarize/Export buttons integrate here
- `src/stores/chatStore.ts` — Zustand store with message state including `inputTokens`/`outputTokens` per message. Token aggregation logic goes here

### SSE Infrastructure (Phase 3 implementation)
- `src/hooks/useRoomStream.ts` — EventSource hook that processes SSE events including `turn:end`. Token count updates triggered here
- `src/lib/sse/stream-registry.ts` — SSE fan-out registry for multi-client streaming

### Conversation Engine
- `src/lib/conversation/manager.ts` — ConversationManager: `turn:end` event already emits `inputTokens`/`outputTokens` from AI SDK usage promise
- `src/lib/llm/gateway.ts` — `generateLLM()` for non-streaming summary generation call

### Database Schema
- `src/db/schema.ts` — Messages table with `inputTokens`/`outputTokens` columns, `role` enum ('user'|'agent'|'system'), `model` field

### Existing UI Components
- `src/components/chat/MessageBubble.tsx` — Shows per-message token counts (already implemented in Phase 3)
- System message banner pattern — used for errors and auto-pause warnings, reuse for summary display

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, cost awareness concern
- `.planning/REQUIREMENTS.md` — INSI-01 through INSI-03 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatHeader` component — add token line + Summarize/Export buttons to existing header
- `chatStore` — already tracks `inputTokens`/`outputTokens` per message; add computed total aggregation
- `useRoomStream` hook — already processes `turn:end` events; extend to update token totals
- `generateLLM()` gateway function — use for non-streaming summary generation call
- System message banner pattern from Phase 3 — reuse for summary display and "Generating..." state
- Messages REST endpoint (`GET /api/rooms/[roomId]/messages`) — base for export API

### Established Patterns
- Zustand for client state — token totals computed in chatStore
- SSE events for real-time updates — `turn:end` already carries token data
- shadcn/ui + Tailwind v4 for all UI components
- Fire-and-forget API pattern (conversation controls) — summary generation follows same pattern
- System message inline banners for status/error feedback

### Integration Points
- ChatHeader — primary integration point for all Phase 4 UI (tokens, summarize, export)
- chatStore — aggregation logic for room token totals
- useRoomStream — extend `turn:end` handler to update token state
- New API routes needed: `POST /api/rooms/[roomId]/summary` (generate summary), `GET /api/rooms/[roomId]/export` (download export)

</code_context>

<specifics>
## Specific Ideas

- Token display uses "k" abbreviation for thousands (12.4k not 12,400) — compact and scannable
- Summary replaces previous summary rather than accumulating — keeps chat clean
- Markdown export with summary at top creates a "report-like" document that's immediately useful
- Export file naming with slugified room name + date makes files sortable in a download folder

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-insights*
*Context gathered: 2026-03-20*
