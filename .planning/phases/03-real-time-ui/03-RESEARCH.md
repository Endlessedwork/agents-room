# Phase 3: Real-Time UI - Research

**Researched:** 2026-03-20
**Domain:** SSE streaming, React client state, chat UI composition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Message Layout & Identity**
- Chat bubble layout — rounded message containers with agent avatar on the left, name/badge above the bubble
- Color-coded accent — each agent's `avatarColor` tints the left border of their bubble; avatar icon in a colored circle to the left
- All metadata shown per message: agent name (bold) + role badge (from `promptRole`), model name in muted text, relative timestamp, input/output token count
- System messages (errors, auto-pause warnings) displayed as inline banners — full-width muted banners between message bubbles, like Slack's "user joined" notices
- User messages right-aligned with distinct neutral/blue bubble; agent messages left-aligned with their color accents

**Streaming Experience**
- Instant append — each token chunk appends immediately to the message bubble as it arrives from SSE, no artificial delay
- Smart auto-scroll — auto-scroll to bottom during streaming, stop if user scrolls up manually, resume when user scrolls back to bottom
- Blinking cursor/caret at the end of streaming text while generation is in progress; disappears on message completion
- History loading: fetch all persisted messages on room open, render instantly, scroll to bottom

**Thinking & Status Indicators**
- Animated dots in bubble (bouncing ...) — a placeholder bubble appears for the active agent with the thinking animation, transitions to real tokens when they arrive; uses the agent's color accent
- Sticky header bar at top of chat area with: room name, status badge (Running/Paused/Idle), turn progress ("Turn X of Y"), and control buttons (Start/Resume, Pause, Stop)
- When idle, header shows prominent "Start" button; when paused, shows "Resume" button; uses the room's existing topic automatically
- Turn count displayed in header next to status badge

**User Participation**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RTUI-01 | Messages stream in real-time as agents generate tokens (SSE) | SSE endpoint bridges ConversationManager textStream to browser via ReadableStream; in-process StreamRegistry holds per-room controllers |
| RTUI-02 | Each agent shows a "thinking" indicator while generating a response | `turn:start` SSE event emitted before first token triggers placeholder bubble with animated dots; `token` events replace it; `turn:end` clears indicator |
| RTUI-03 | User can type and send messages into the conversation mid-flow | POST /api/rooms/[roomId]/messages endpoint persists role='user' message; ContextService already includes user messages in context build |
| RTUI-04 | Chat interface displays agent name, role badge, and model used per message | Message shape carries roomAgentId; client resolves agent metadata (name, promptRole, model, avatarColor, avatarIcon) from pre-fetched room agents list |
</phase_requirements>

---

## Summary

Phase 3 adds real-time token streaming and a full chat UI on top of the Phase 2 ConversationManager. The core architectural challenge is that the turn loop runs fire-and-forget inside the Next.js Node.js process, but SSE clients connect on a separate HTTP request. These two need to be bridged in-process. The correct pattern is a **module-level StreamRegistry** — a `Map<roomId, Set<ReadableStreamController>>` — that the ConversationManager writes into via callbacks, and the SSE GET handler reads from.

The SSE endpoint itself is a standard Next.js Route Handler returning a `ReadableStream` with `Content-Type: text/event-stream`. Token chunks are formatted as SSE data frames. The client uses the native browser `EventSource` API (or a custom `fetch`-based reader for richer control) and appends tokens into Zustand state, which drives a pure React render of the message list.

The UI is composed from existing shadcn/ui primitives (Avatar, Badge, Card, ScrollArea) with Tailwind v4 for layout and animation. No new UI libraries are needed. Scroll management is the only genuinely tricky client-side problem and has a well-defined solution using `IntersectionObserver` or a scroll anchor element.

**Primary recommendation:** Use a module-level `StreamRegistry` singleton (plain Map with Set of stream controllers per room) to bridge ConversationManager callbacks to SSE clients. Emit structured SSE events (`turn:start`, `token`, `turn:end`, `status`, `error`). Client uses `EventSource` with Zustand for state.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Route Handlers | 16.2.0 (installed) | SSE endpoint (`GET /api/rooms/[roomId]/stream`) | Already in stack; Web Streams API natively supported |
| AI SDK `streamText` | 6.0.116 (installed) | LLM token stream — `textStream` async iterable | Already wraps LLM call; `onChunk` callback available on `streamText` |
| Zustand | 5.0.12 (installed) | Client-side message list, streaming state, room status | Already used for roomStore; extend for chatStore |
| shadcn/ui (Avatar, Badge, Card, ScrollArea) | Installed | Message bubble composition | Already installed and used in ConversationPanel |
| Tailwind v4 | Installed | Styling, animations (animate-bounce for dots, animate-blink for caret) | Already in stack |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `EventSource` (browser built-in) | N/A | SSE client connection | Primary approach for SSE; widely supported |
| Node.js `events.EventEmitter` | Built-in | Alternative to StreamRegistry if callback chains get deep | If StreamRegistry becomes complex, EventEmitter is cleaner |
| `nanoid` | Installed | Message IDs for optimistic user message inserts | Already used across the codebase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| StreamRegistry (module-level Map) | WebSocket | WebSocket adds ws server complexity; SSE is sufficient for unidirectional token stream |
| `EventSource` (native) | `fetch` + `ReadableStream` reader | `fetch`-based gives more control (custom headers, reconnect logic) but EventSource is simpler and sufficient |
| Zustand chatStore | React Context + useReducer | Zustand already established; no reason to deviate |
| Tailwind `animate-bounce` for thinking dots | Framer Motion | Framer Motion is not in the stack; CSS animations sufficient for simple bouncing dots |

**Installation:** No new packages required — all libraries already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── sse/
│       └── stream-registry.ts      # Module-level Map<roomId, Set<Controller>>
├── app/api/rooms/[roomId]/
│   ├── stream/
│   │   └── route.ts                # SSE GET endpoint
│   └── messages/
│       └── route.ts                # POST user message
├── stores/
│   └── chatStore.ts                # Zustand: messages[], streamingState, roomStatus
└── components/
    └── rooms/
        ├── ChatView.tsx             # Replaces ConversationPanel — root chat layout
        ├── ChatHeader.tsx           # Room name, status badge, turn counter, controls
        ├── MessageFeed.tsx          # Scrollable message list with smart scroll
        ├── MessageBubble.tsx        # Single message — agent or user or system banner
        ├── ThinkingBubble.tsx       # Animated dots placeholder
        └── MessageInput.tsx         # Fixed bottom input bar
```

### Pattern 1: StreamRegistry — In-Process SSE Bridge

**What:** A module-level singleton `Map<string, Set<ReadableStreamDefaultController<string>>>` that ConversationManager pushes events into and SSE handlers listen on.

**When to use:** The turn loop (fire-and-forget IIFE) and the SSE HTTP handler are on separate call stacks in the same Node.js process. Module-level state is the idiomatic bridge.

**How it works:**
1. `stream-registry.ts` exports `register(roomId, controller)`, `unregister(roomId, controller)`, `emit(roomId, event)`.
2. ConversationManager calls `emit(roomId, {type, payload})` at key lifecycle points.
3. SSE route handler creates a `ReadableStream`, registers its controller on open, unregisters on client disconnect.

**Example:**
```typescript
// src/lib/sse/stream-registry.ts
type SSEController = ReadableStreamDefaultController<string>;

const registry = new Map<string, Set<SSEController>>();

export function registerController(roomId: string, ctrl: SSEController): void {
  if (!registry.has(roomId)) registry.set(roomId, new Set());
  registry.get(roomId)!.add(ctrl);
}

export function unregisterController(roomId: string, ctrl: SSEController): void {
  registry.get(roomId)?.delete(ctrl);
}

export function emitSSE(roomId: string, event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  registry.get(roomId)?.forEach((ctrl) => {
    try { ctrl.enqueue(payload); } catch { /* client disconnected */ }
  });
}
```

### Pattern 2: SSE Route Handler

**What:** Next.js GET route returning `ReadableStream` with `text/event-stream` content type.

**When to use:** Whenever SSE is needed. This is the standard Web Streams approach that Next.js 16 Route Handlers support natively.

**Critical headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

**Example:**
```typescript
// src/app/api/rooms/[roomId]/stream/route.ts
import { registerController, unregisterController } from '@/lib/sse/stream-registry';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const stream = new ReadableStream<string>({
    start(controller) {
      registerController(roomId, controller);
      // Send initial heartbeat so browser doesn't treat connection as failed
      controller.enqueue(': heartbeat\n\n');
    },
    cancel() {
      // Client disconnected — unregister to prevent enqueue on closed stream
      // NOTE: 'this' is not available; capture controller via closure
    },
  });

  // Use TransformStream pattern to capture cancel callback with controller ref
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering if behind proxy
    },
  });
}
```

**Note on cancel callback:** `ReadableStream`'s `cancel` method does not receive the controller. Use a closure to capture it:

```typescript
let savedController: ReadableStreamDefaultController<string>;
const stream = new ReadableStream<string>({
  start(controller) {
    savedController = controller;
    registerController(roomId, controller);
    controller.enqueue(': heartbeat\n\n');
  },
  cancel() {
    unregisterController(roomId, savedController);
  },
});
```

### Pattern 3: ConversationManager SSE Emission Points

**What:** Add `emitSSE` calls at four lifecycle points in the turn loop.

**Emission events:**

| Event | When emitted | Payload |
|-------|-------------|---------|
| `turn:start` | Before `for await (chunk of textStream)` | `{ agentId, agentName, model, turnNumber }` |
| `token` | Each chunk received | `{ agentId, text }` |
| `turn:end` | After message persisted to DB | `{ agentId, messageId, inputTokens, outputTokens }` |
| `status` | On room status change (pause/stop/idle) | `{ status: 'running' | 'paused' | 'idle' }` |
| `system` | On system message persisted | `{ content }` |

**Modified turn loop (key diff):**

```typescript
// Before: for await (const chunk of result.textStream) { fullText += chunk; }
// After:
emitSSE(roomId, 'turn:start', { agentId: agent.id, agentName: agent.name, model: agent.model });
for await (const chunk of result.textStream) {
  fullText += chunk;
  emitSSE(roomId, 'token', { agentId: agent.id, text: chunk });
}
// After persist:
emitSSE(roomId, 'turn:end', { agentId: agent.id, messageId: insertedId, inputTokens, outputTokens });
```

### Pattern 4: Client-Side Zustand chatStore

**What:** A Zustand store holding messages array, current streaming state, and room status for the chat view.

**State shape:**
```typescript
interface StreamingState {
  agentId: string;
  agentName: string;
  model: string;
  text: string; // accumulates as tokens arrive
}

interface ChatStore {
  messages: StoredMessage[];        // persisted messages (history + completed turns)
  streaming: StreamingState | null; // in-flight turn — null when idle
  roomStatus: 'idle' | 'running' | 'paused';
  turnProgress: { current: number; total: number };

  // Actions
  loadHistory: (roomId: string) => Promise<void>;
  appendToken: (agentId: string, text: string) => void;
  startTurn: (agent: { id: string; name: string; model: string }) => void;
  completeTurn: (msg: StoredMessage) => void;
  addSystemMessage: (content: string) => void;
  addUserMessage: (msg: StoredMessage) => void;
  setRoomStatus: (status: RoomStatus) => void;
}
```

### Pattern 5: EventSource Client Hook

**What:** A `useRoomStream` React hook that opens an `EventSource` connection to the SSE endpoint and dispatches into chatStore.

**Example:**
```typescript
// src/hooks/useRoomStream.ts
import { useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';

export function useRoomStream(roomId: string) {
  const { startTurn, appendToken, completeTurn, addSystemMessage, setRoomStatus } = useChatStore();

  useEffect(() => {
    const es = new EventSource(`/api/rooms/${roomId}/stream`);

    es.addEventListener('turn:start', (e) => {
      startTurn(JSON.parse(e.data));
    });
    es.addEventListener('token', (e) => {
      const { agentId, text } = JSON.parse(e.data);
      appendToken(agentId, text);
    });
    es.addEventListener('turn:end', (e) => {
      completeTurn(JSON.parse(e.data));
    });
    es.addEventListener('status', (e) => {
      setRoomStatus(JSON.parse(e.data).status);
    });
    es.addEventListener('system', (e) => {
      addSystemMessage(JSON.parse(e.data).content);
    });

    return () => es.close();
  }, [roomId]);
}
```

### Pattern 6: Smart Auto-Scroll

**What:** Auto-scroll to bottom when new tokens arrive, but stop if user has manually scrolled up.

**Implementation:** Track a boolean `isAtBottom` using a scroll event listener on the scroll container. When `isAtBottom === true`, imperatively call `scrollIntoView` or set `scrollTop` on each new token. A "scroll anchor" div at the bottom of the list is the cleanest approach.

```typescript
// Inside MessageFeed.tsx
const bottomRef = useRef<HTMLDivElement>(null);
const [isAtBottom, setIsAtBottom] = useState(true);

// On new token/message:
useEffect(() => {
  if (isAtBottom) bottomRef.current?.scrollIntoView({ behavior: 'instant' });
}, [messages, streaming?.text, isAtBottom]);

// Detect scroll position:
const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
  const el = e.currentTarget;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  setIsAtBottom(atBottom);
};
```

### Anti-Patterns to Avoid

- **Polling the DB for new messages:** Never. SSE delivers tokens in real-time; DB polling adds latency and load.
- **Storing controller references in React state:** StreamRegistry must be module-level (not React state/context) — it lives across renders and request lifecycles.
- **Awaiting the turn loop in the SSE endpoint:** The SSE handler must return immediately with the stream. It does not invoke ConversationManager — that's triggered by the Start/Resume control endpoints.
- **Rendering the streaming text with a keyed re-render per token:** Append to a string in Zustand, render that string. Do not create a new React element per token.
- **Using `text/event-stream` with `next export` (static):** SSE requires a live Node.js server — already the case since the project uses `dynamic = 'force-dynamic'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated thinking dots | Custom JS animation loop | Tailwind `animate-bounce` with staggered delay on three spans | CSS handles timing, no JS needed |
| Blinking text cursor | Canvas or JS interval | Tailwind `animate-blink` (or custom `@keyframes blink`) on a `|` span | Pure CSS, no layout impact |
| Token text rendering | Virtual list or DOM diffing | Plain string concat in Zustand state → single `<p>` render | Token stream is append-only; React re-render of one string node is trivially fast |
| Relative timestamps | Custom date formatting | `Intl.RelativeTimeFormat` or simple helper (no library needed for "X min ago") | No dependency needed for basic relative time |
| SSE reconnection | Custom retry loop | `EventSource` auto-reconnects natively after network interruption | Browser handles this for free |

**Key insight:** Token streaming is append-only. Virtual lists, complex diffing, or animation libraries are overkill for a chat UI with < 1000 messages.

---

## Common Pitfalls

### Pitfall 1: Nginx/Proxy Buffering Kills SSE

**What goes wrong:** If the app is run behind Nginx (dev docker setup, staging), SSE chunks are buffered until the response closes. The browser sees no tokens until the turn is complete — defeating the purpose.
**Why it happens:** Nginx buffers proxy responses by default.
**How to avoid:** Set `X-Accel-Buffering: no` header on the SSE response. Already shown in the SSE route example above.
**Warning signs:** Tokens arrive all at once after a delay; works in `localhost` but not behind proxy.

### Pitfall 2: StreamRegistry Controller Leak

**What goes wrong:** Client disconnects (navigate away, refresh) but the controller stays in the registry. Next `enqueue` call throws `TypeError: invalid state` (controller already closed), and subsequent SSE emissions for that room log errors forever.
**Why it happens:** The `cancel` callback in `ReadableStream` fires when the client disconnects, but only if the closure correctly captures the controller reference.
**How to avoid:** Always `try/catch` around `ctrl.enqueue()` in `emitSSE`. Use the closure pattern shown above to capture the controller for `cancel`. Log and silently swallow enqueue errors — they indicate a closed client.

### Pitfall 3: Thinking Indicator Not Clearing on Abort

**What goes wrong:** User clicks Stop. ConversationManager aborts the stream. The `turn:start` was already emitted but `turn:end` never fires. The thinking bubble stays on screen.
**Why it happens:** Abort path skips the `turn:end` emission point.
**How to avoid:** Emit a `turn:cancel` event in the `catch(AbortError)` branch of the turn loop. Client clears `streaming` state on `turn:cancel`. Also emit a `status` event with `'idle'` from `ConversationManager.stop()` after abort.

### Pitfall 4: History Load Race with SSE Events

**What goes wrong:** Client opens room, fetches history via REST, and SSE events start arriving concurrently. A `turn:end` event arrives before the history fetch completes, causing a duplicate message in the list (one from SSE, one from REST history).
**Why it happens:** No ordering guarantee between the initial REST fetch and SSE.
**How to avoid:** Track message IDs in chatStore. When `turn:end` delivers a persisted `messageId`, check if it already exists in the messages array before inserting. History fetch should similarly deduplicate. Use a `Set<string>` of known message IDs.

### Pitfall 5: User Message Appearing Twice

**What goes wrong:** User sends a message. Client shows it optimistically. Then history reload or a SSE system event causes it to appear again.
**Why it happens:** Optimistic insert + real insert from DB both rendered.
**How to avoid:** Insert user messages with their actual DB-assigned `id` (returned from the POST /api/rooms/[roomId]/messages endpoint), not a client-generated temp ID. Match by ID to deduplicate.

### Pitfall 6: `EventSource` Does Not Support Custom Headers

**What goes wrong:** Attempt to set auth headers on `EventSource` — browser API does not support this.
**Why it happens:** `EventSource` is a simple browser API with no header customization.
**How to avoid:** This app has no auth requirement (single-user local tool). No action needed. If auth is ever added, switch to `fetch` + `ReadableStreamDefaultReader` pattern.

### Pitfall 7: `params` is a Promise in Next.js 16

**What goes wrong:** Writing `{ params: { roomId: string } }` instead of `{ params: Promise<{ roomId: string }> }` in the route handler signature, then accessing `params.roomId` directly — TypeScript error or runtime undefined.
**Why it happens:** Next.js 16 changed `params` to be a Promise (already established in Phase 2, but easy to forget for new routes).
**How to avoid:** Always `const { roomId } = await params;` as done in existing routes. The codebase already has correct examples.

---

## Code Examples

Verified patterns from official sources and codebase:

### SSE Response (from Next.js 16 Route Handler docs)

```typescript
// Source: Next.js 16 local docs — node_modules/next/dist/docs/01-app/02-guides/streaming.md
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

Note: For this project, `controller.enqueue()` works with strings directly (no `TextEncoder` needed) since `ReadableStream<string>` is used.

### AI SDK streamText onChunk (verified from `node_modules/ai/dist/index.d.ts`)

`streamText` supports an `onChunk` callback that fires synchronously for each chunk. This is an alternative to the `for await` loop for emitting to SSE without modifying the existing loop structure:

```typescript
// Source: AI SDK v6 type definitions
const result = streamLLM({
  // ... existing args
  // Note: streamLLM() wraps streamText() — onChunk must be added to streamLLM or called on result.textStream
});

// Option A: Keep existing for-await loop, add emitSSE call inside
for await (const chunk of result.textStream) {
  fullText += chunk;
  emitSSE(roomId, 'token', { agentId: agent.id, text: chunk });
}

// Option B: Expose onChunk via streamLLM — add optional parameter to LLMRequest interface
```

Option A (adding `emitSSE` inside the existing loop) is simpler and requires no changes to the gateway interface.

### Zustand slice pattern (matching existing roomStore.ts)

```typescript
// Source: existing src/stores/roomStore.ts pattern
import { create } from 'zustand';

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  streaming: null,
  // ...
  appendToken: (agentId, text) =>
    set((s) => ({
      streaming: s.streaming ? { ...s.streaming, text: s.streaming.text + text } : null,
    })),
}));
```

### Thinking dots animation (Tailwind v4)

```tsx
// Bouncing dots — three spans with staggered animation delay
<span className="flex gap-1 items-center py-1">
  <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
  <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
  <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
</span>
```

### Blinking caret (Tailwind v4 custom animation)

```tsx
// In globals.css or Tailwind config:
// @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
// .animate-blink { animation: blink 1s step-end infinite }

<span className="animate-blink ml-px">|</span>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebSocket for streaming | SSE for unidirectional token stream | Standard for LLM apps | SSE is simpler, auto-reconnects, no ws server needed |
| Polling for live updates | SSE push | Standard | No wasted requests |
| `StreamingTextResponse` (AI SDK v3) | `result.toTextStreamResponse()` or `result.textStream` | AI SDK v4+ | `toTextStreamResponse()` still available in v6 but for raw text — not needed here since we build our own SSE protocol |

**Deprecated/outdated:**
- `StreamingTextResponse` from `ai` package: Removed in AI SDK v4+. Use `result.toTextStreamResponse()` or build custom Response.
- Polling `GET /api/rooms/[roomId]` for messages: Replaced by SSE + initial REST history load.

---

## Open Questions

1. **`turn:end` message ID availability**
   - What we know: ConversationManager inserts the message with a `nanoid()`-generated ID before emitting status events.
   - What's unclear: The inserted ID needs to be captured after `db.insert(messages)` and passed to `emitSSE`. Drizzle's `insert().values()` does not return the inserted row by default in SQLite.
   - Recommendation: Generate the ID with `nanoid()` before the insert (already done in manager.ts — line 149 assigns `id: nanoid()`). Capture it: `const msgId = nanoid(); await db.insert(messages).values({ id: msgId, ... }); emitSSE(roomId, 'turn:end', { messageId: msgId, ... })`.

2. **Turn counter in header**
   - What we know: ConversationManager tracks `turnCount` locally in the loop but does not expose it.
   - What's unclear: How to surface current turn number to the UI.
   - Recommendation: Emit `turnCount` as part of `turn:start` SSE payload. Client increments its local counter. Room's `turnLimit` is known from initial room fetch.

3. **SSE behavior on server restart (dev hot reload)**
   - What we know: Module-level registry is lost on hot reload. `EventSource` auto-reconnects.
   - What's unclear: Whether Next.js 16 HMR preserves module-level Maps.
   - Recommendation: This is a development concern only. `EventSource` reconnects in < 3s automatically. No special handling needed for production.

---

## Validation Architecture

nyquist_validation is enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (installed, `vitest.config.ts` present) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RTUI-01 | `emitSSE` broadcasts to registered controllers | unit | `npx vitest run tests/sse/stream-registry.test.ts` | ❌ Wave 0 |
| RTUI-01 | SSE route registers/unregisters controller | unit | `npx vitest run tests/api/stream.test.ts` | ❌ Wave 0 |
| RTUI-02 | `turn:start` SSE event emitted before first token | unit (manager mock) | `npx vitest run tests/conversation/manager.test.ts` | ✅ (extend existing) |
| RTUI-02 | `turn:end` emitted after persist, `turn:cancel` on abort | unit (manager mock) | `npx vitest run tests/conversation/manager.test.ts` | ✅ (extend existing) |
| RTUI-03 | POST /api/rooms/[roomId]/messages inserts user message | unit | `npx vitest run tests/api/messages.test.ts` | ❌ Wave 0 |
| RTUI-04 | Message shape includes agentId, model, promptRole | unit | `npx vitest run tests/sse/stream-registry.test.ts` | ❌ Wave 0 (payload shape) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/sse/ tests/api/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/sse/stream-registry.test.ts` — covers RTUI-01: register, unregister, emit, enqueue error resilience
- [ ] `tests/api/stream.test.ts` — covers RTUI-01: SSE route handler returns `text/event-stream` response
- [ ] `tests/api/messages.test.ts` — covers RTUI-03: POST /api/rooms/[roomId]/messages persists role='user' message

Existing `tests/conversation/manager.test.ts` must be extended to cover RTUI-02 emission points (mock `emitSSE`, assert it was called with correct event types and sequencing).

---

## Sources

### Primary (HIGH confidence)

- Next.js 16 local docs `node_modules/next/dist/docs/01-app/02-guides/streaming.md` — ReadableStream Route Handler pattern, SSE, proxy buffering
- Next.js 16 local docs `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler params as Promise, HTTP methods
- AI SDK v6 `node_modules/ai/dist/index.d.ts` — `streamText` signature, `textStream` as `AsyncIterableStream<string>`, `onChunk` callback, `toTextStreamResponse()`
- Existing codebase `src/lib/conversation/manager.ts` — turn loop structure, AbortController pattern, emission insertion points
- Existing codebase `src/stores/roomStore.ts` — Zustand store pattern to replicate in chatStore

### Secondary (MEDIUM confidence)

- MDN EventSource API — auto-reconnect behavior, lack of custom header support (well-established browser spec)
- SSE protocol spec — `event:`, `data:`, `\n\n` framing (stable RFC)

### Tertiary (LOW confidence)

- None — all critical claims verified against official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and verified against node_modules
- Architecture (StreamRegistry pattern): HIGH — verified against Next.js 16 ReadableStream docs and AI SDK types
- Pitfalls: HIGH — derived from direct codebase analysis and official Next.js docs
- Test map: HIGH — follows established vitest patterns from existing tests

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack — no fast-moving dependencies)
