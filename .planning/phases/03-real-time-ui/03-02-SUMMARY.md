---
phase: 03-real-time-ui
plan: 02
subsystem: ui
tags: [zustand, sse, react, streaming, chat, event-source, tailwind]

requires:
  - phase: 03-real-time-ui
    plan: 01
    provides: SSE backend (StreamRegistry, /api/rooms/[roomId]/stream, messages endpoints, ConversationManager emitting 7 event types)

provides:
  - Zustand chatStore managing messages, streaming state, room status, turn progress with messageIds deduplication
  - useRoomStream hook connecting EventSource SSE to chatStore for all 7 event types
  - MessageBubble component rendering agent/user/system messages with identity and streaming caret
  - ThinkingBubble component with three bouncing dots in agent color during pre-token thinking
  - MessageInput textarea with Enter-to-send, auto-resize, optimistic chatStore insert
  - MessageFeed with smart auto-scroll, streaming message display, scroll-to-bottom button
  - ChatHeader with room name, status badge, turn counter, Start/Pause/Resume/Stop controls
  - ChatView composing all components with SSE initialization and history loading
  - Room page fully replaced ConversationPanel with ChatView

affects: [03-real-time-ui-plan-03, end-to-end-chat, frontend]

tech-stack:
  added: [date-fns (formatDistanceToNow for timestamps)]
  patterns:
    - Zustand store with messageIds Set for SSE + POST response deduplication
    - EventSource cleanup via useEffect return () => es.close()
    - Streaming bubble: ThinkingBubble (text === '') -> MessageBubble isStreaming (text !== '') transition
    - Optimistic status updates in ChatHeader with fire-and-forget fetch
    - ChatView calls useChatStore.getState() directly (not hook) in useEffect to avoid stale closure

key-files:
  created:
    - src/stores/chatStore.ts
    - src/hooks/useRoomStream.ts
    - src/components/rooms/MessageBubble.tsx
    - src/components/rooms/ThinkingBubble.tsx
    - src/components/rooms/MessageInput.tsx
    - src/components/rooms/MessageFeed.tsx
    - src/components/rooms/ChatHeader.tsx
    - src/components/rooms/ChatView.tsx
  modified:
    - src/app/(dashboard)/rooms/[roomId]/page.tsx
    - src/app/globals.css
    - src/lib/conversation/speaker-selector.ts

key-decisions:
  - "chatStore uses messageIds Set<string> for deduplication — both SSE user-message and POST response call addUserMessage, dedup prevents doubles"
  - "MessageInput calls useChatStore.getState().addUserMessage() after POST (not hook) — avoids stale closure, dedup handles SSE duplicate"
  - "ThinkingBubble shown when streaming.text === empty string; transitions to streaming MessageBubble when text arrives — no flicker"
  - "ChatHeader uses optimistic setRoomStatus calls before fetch — UI responds instantly, SSE status event confirms actual state"
  - "RoomAgentRow type extended with optional avatarColor/avatarIcon to fix pre-existing build error from Plan 01 SSE emission code"

patterns-established:
  - "chatStore pattern: Set<string> for ID-based deduplication across async message sources"
  - "EventSource hook pattern: all listeners registered in single useEffect, cleanup via es.close()"
  - "Streaming indicator pattern: null streaming = idle; streaming.text = '' = thinking dots; streaming.text != '' = live streaming bubble"

requirements-completed: [RTUI-02, RTUI-04]

duration: 5min
completed: 2026-03-20
---

# Phase 03 Plan 02: Chat UI Summary

**Zustand chatStore + EventSource hook + full chat UI (MessageBubble, ThinkingBubble, MessageInput, MessageFeed, ChatHeader, ChatView) with streaming token display and smart auto-scroll**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T05:08:22Z
- **Completed:** 2026-03-20T05:14:06Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Zustand chatStore with complete message lifecycle: loadHistory, startTurn, appendToken, completeTurn, cancelTurn, addSystemMessage, addUserMessage, setRoomStatus, reset
- useRoomStream EventSource hook wiring all 7 SSE event types (turn:start, token, turn:end, turn:cancel, status, system, user-message) to chatStore
- Complete chat component tree: ChatView -> ChatHeader + MessageFeed + MessageInput -> MessageBubble/ThinkingBubble
- Smart auto-scroll: follows streaming but stops on user scroll, scroll-to-bottom button appears
- ConversationPanel placeholder fully replaced; production build and all 118 tests pass

## Task Commits

1. **Task 1: chatStore + useRoomStream + blink CSS** - `8ff19da` (feat)
2. **Task 2: MessageBubble, ThinkingBubble, MessageInput** - `84d4614` (feat)
3. **Task 3: MessageFeed, ChatHeader, ChatView + page** - `b7844dc` (feat)

## Files Created/Modified

- `src/stores/chatStore.ts` - Zustand store: ChatMessage/StreamingState types, 9 actions, messageIds deduplication
- `src/hooks/useRoomStream.ts` - EventSource hook: registers 7 SSE event listeners, cleans up on unmount
- `src/components/rooms/MessageBubble.tsx` - Agent (avatar, badge, token count, streaming caret), user (right-aligned), system (banner) modes
- `src/components/rooms/ThinkingBubble.tsx` - Three bouncing dots in agent color with staggered animation-delay
- `src/components/rooms/MessageInput.tsx` - Textarea with Enter-to-send, auto-resize, optimistic insert
- `src/components/rooms/MessageFeed.tsx` - Scrollable list, ThinkingBubble/streaming MessageBubble, auto-scroll, ChevronDown button
- `src/components/rooms/ChatHeader.tsx` - Status badge, turn counter, Start/Pause/Resume/Stop with optimistic updates
- `src/components/rooms/ChatView.tsx` - Root layout: initializes SSE, loads history, sets room status
- `src/app/(dashboard)/rooms/[roomId]/page.tsx` - Replaced ConversationPanel with ChatView, added turnLimit to RoomDetail
- `src/app/globals.css` - Added @keyframes blink + .animate-blink for streaming caret
- `src/lib/conversation/speaker-selector.ts` - Added avatarColor/avatarIcon to RoomAgentRow type (bug fix)

## Decisions Made

- chatStore uses `messageIds: Set<string>` — both the SSE `user-message` event and the MessageInput's POST response call `addUserMessage`; dedup via Set prevents double-rendering
- MessageInput calls `useChatStore.getState().addUserMessage()` directly (not the hook) inside an async send function to avoid stale closures; chatStore dedup handles SSE duplicate arrival
- ThinkingBubble shown when `streaming.text === ''` — transitions seamlessly to streaming MessageBubble when first token arrives; no flicker because streaming object persists with same agent identity
- ChatHeader does optimistic `setRoomStatus` before fire-and-forget fetch — UI responds instantly, actual SSE `status` event confirms the real state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing avatarColor/avatarIcon fields on RoomAgentRow type**
- **Found during:** Task 3 verification (npx next build)
- **Issue:** `src/lib/conversation/manager.ts` (Plan 01 code) references `agent.avatarColor` and `agent.avatarIcon` in the `turn:start` SSE emission, but `RoomAgentRow` type in `speaker-selector.ts` did not define these fields — causing TypeScript build failure
- **Fix:** Added `avatarColor?: string | null` and `avatarIcon?: string | null` to the `RoomAgentRow` type as optional fields
- **Files modified:** `src/lib/conversation/speaker-selector.ts`
- **Verification:** `npx next build` succeeds; all 118 tests pass
- **Committed in:** `b7844dc` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in pre-existing code from Plan 01)
**Impact on plan:** Required for production build to succeed. Single-line type fix. No scope creep.

## Issues Encountered

- Pre-existing TypeScript error in test files (`tests/conversation/manager-sse.test.ts`, `tests/conversation/manager.test.ts`) related to AI SDK type changes — these are out of scope for this plan, not blocking the build (only `tsc --noEmit` on source, not tests), and 118 tests all pass at runtime

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full chat UI is functional: SSE tokens stream live into the message feed, thinking indicator shows between turns, user can send messages
- Plan 03 (if any) can build on this complete chat interface
- All 7 SSE event types are handled by useRoomStream and dispatched to chatStore

---
*Phase: 03-real-time-ui*
*Completed: 2026-03-20*
