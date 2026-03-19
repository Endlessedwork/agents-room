# Phase 3: Real-Time UI - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Live token streaming, agent identity display, and user participation in a browser chat interface. Users watch agents think and respond token-by-token via SSE, see who is speaking with visual identity (name, role badge, model, color accent), and can type messages into the running conversation. No insights, cost tracking, summaries, or export — those are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Message Layout & Identity
- Chat bubble layout — rounded message containers with agent avatar on the left, name/badge above the bubble
- Color-coded accent — each agent's `avatarColor` tints the left border of their bubble; avatar icon in a colored circle to the left
- All metadata shown per message: agent name (bold) + role badge (from `promptRole`), model name in muted text, relative timestamp, input/output token count
- System messages (errors, auto-pause warnings) displayed as inline banners — full-width muted banners between message bubbles, like Slack's "user joined" notices
- User messages right-aligned with distinct neutral/blue bubble; agent messages left-aligned with their color accents

### Streaming Experience
- Instant append — each token chunk appends immediately to the message bubble as it arrives from SSE, no artificial delay
- Smart auto-scroll — auto-scroll to bottom during streaming, stop if user scrolls up manually, resume when user scrolls back to bottom
- Blinking cursor/caret at the end of streaming text while generation is in progress; disappears on message completion
- History loading: fetch all persisted messages on room open, render instantly, scroll to bottom

### Thinking & Status Indicators
- Animated dots in bubble (bouncing ··· ) — a placeholder bubble appears for the active agent with the thinking animation, transitions to real tokens when they arrive; uses the agent's color accent
- Sticky header bar at top of chat area with: room name, status badge (Running/Paused/Idle), turn progress ("Turn X of Y"), and control buttons (Start/Resume, Pause, Stop)
- When idle, header shows prominent "Start" button; when paused, shows "Resume" button; uses the room's existing topic automatically
- Turn count displayed in header next to status badge

### User Participation
- Fixed bottom input bar — always visible, pinned to bottom of chat area; text field + Send button
- Enter sends message, Shift+Enter for newline
- User messages queued for next turn — saved immediately and appear in chat, but don't interrupt current agent's generation; ContextService picks them up on the next turn
- User messages stored with role='user' in existing messages table (already supported by schema)

### Claude's Discretion
- Exact bubble border-radius and shadow styling
- Send button icon and hover state
- Thinking dots animation timing and easing
- Header bar exact layout and spacing
- Scroll-to-bottom button design when user is scrolled up
- SSE event naming and payload structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Conversation Engine (Phase 2 implementation)
- `src/lib/conversation/manager.ts` — ConversationManager: turn loop, streaming via `streamLLM`, AbortController lifecycle. **Critical:** currently consumes textStream internally (line 109) — Phase 3 must tap into this stream for SSE forwarding
- `src/lib/conversation/context-service.ts` — ContextService: builds agent context with sliding window, detects repetition. User messages (role='user') are already included in context building
- `src/lib/conversation/speaker-selector.ts` — SpeakerSelector: round-robin and LLM-selected modes

### LLM Gateway
- `src/lib/llm/gateway.ts` — `streamLLM()` returns AI SDK `streamText` result with `textStream` async iterable and `usage` promise

### Database Schema
- `src/db/schema.ts` — Messages table with role enum ('user'|'agent'|'system'), roomAgentId FK, token counts. Room status enum ('idle'|'running'|'paused'), turnLimit, speakerStrategy

### Existing UI
- `src/components/rooms/ConversationPanel.tsx` — Current placeholder panel, shows room info and agent avatars. Will be replaced with full chat view
- `src/app/(dashboard)/rooms/[roomId]/page.tsx` — Room page, fetches room data via REST. Needs SSE connection for live updates
- `src/components/layout/Sidebar.tsx` — Sidebar with room list, already shows room status
- `src/stores/roomStore.ts` — Zustand store for rooms state

### UI Components (shadcn/ui)
- `src/components/ui/avatar.tsx` — Avatar component for agent icons
- `src/components/ui/badge.tsx` — Badge component for role display
- `src/components/ui/card.tsx` — Card component (base for message bubbles)
- `src/components/ui/scroll-area.tsx` — ScrollArea for chat container

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, stack decisions
- `.planning/REQUIREMENTS.md` — RTUI-01 through RTUI-04 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Avatar` + `Badge` + `Card` shadcn components — base for message bubble layout
- `ScrollArea` component — for chat message container with smart scroll
- `ICON_MAP` in ConversationPanel — maps icon names to Lucide React components, reuse for agent avatars
- `useRoomStore` Zustand store — extends naturally to hold live messages and streaming state
- `streamLLM` gateway — already returns `textStream` async iterable that Phase 3 needs to forward via SSE

### Established Patterns
- Zustand for client state management — add message streaming state here
- REST API routes at `src/app/api/` — SSE endpoint follows same pattern
- shadcn/ui + Tailwind v4 for all UI components
- `(dashboard)` route group for sidebar layout — chat view lives inside this
- ConversationManager uses fire-and-forget IIFE for the turn loop — SSE bridge needs a callback/event emitter pattern to tap into the stream

### Integration Points
- ConversationManager.start() — needs modification to emit token events (callback, EventEmitter, or shared stream registry) so SSE endpoint can forward them
- Room page (`[roomId]/page.tsx`) — needs SSE connection alongside REST fetch
- Sidebar RoomListItem — already shows status indicator, could update in real-time via same SSE connection
- Messages API — may need a GET endpoint for fetching persisted history (currently messages are only written, not read via REST)

</code_context>

<specifics>
## Specific Ideas

- Message bubbles should have the agent's color as a left border accent — scannable at a glance to see who's speaking without reading names
- Thinking indicator transitions smoothly into real content — the dots bubble becomes the message bubble, no flicker or layout jump
- Header controls should feel immediate — clicking Pause/Stop should reflect in the UI instantly (optimistic update), not wait for API round-trip
- Smart scroll must be rock-solid: nothing more annoying than being yanked to the bottom while reading history

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-real-time-ui*
*Context gathered: 2026-03-20*
