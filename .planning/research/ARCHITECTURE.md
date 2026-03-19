# Architecture Research

**Domain:** Multi-agent AI chat system (personal, single-user, real-time)
**Researched:** 2026-03-19
**Confidence:** HIGH (confirmed against Google ADK docs, AutoGen docs, multiple framework references)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Room List   │  │  Chat View   │  │  Agent Config Panel  │  │
│  │  (nav/mgmt)  │  │  (live feed) │  │  (persona/provider)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │ WebSocket / SSE       │             │
├─────────┼─────────────────┼───────────────────────┼─────────────┤
│                        API LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  Streaming Endpoint  │  │
│  │  (CRUD ops)  │  │  (room conn) │  │  (LLM token push)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │             │
├─────────┼─────────────────┼───────────────────────┼─────────────┤
│                     ORCHESTRATION LAYER                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Conversation Manager                    │  │
│  │  - Turn-taking loop (next-speaker selection)             │  │
│  │  - Message broadcast to all room participants            │  │
│  │  - Start / stop / redirect controls                      │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────┼───────────────────────────────┐  │
│  │                   Agent Instances                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │  │ Agent A  │  │ Agent B  │  │ Agent C  │               │  │
│  │  │ (Claude) │  │ (GPT-4o) │  │(Gemini)  │               │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘               │  │
│  └───────┼─────────────┼─────────────┼─────────────────────┘  │
│          │             │             │                         │
├──────────┼─────────────┼─────────────┼──────────────────────────┤
│                      SERVICE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  LLM Gateway │  │  Context Svc │  │  Room / Agent Config │  │
│  │ (multi-prov) │  │ (history/    │  │  Service             │  │
│  │              │  │  windowing)  │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │             │
├─────────┼─────────────────┼───────────────────────┼─────────────┤
│                       STORAGE LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  SQLite /    │  │  In-Memory   │  │  File / Env Config   │  │
│  │  Postgres    │  │  Cache       │  │  (API keys, prompts) │  │
│  │  (messages,  │  │  (active     │  │                      │  │
│  │   rooms,     │  │   sessions)  │  │                      │  │
│  │   agents)    │  │              │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                  │                   │
    Claude API         OpenAI API          Gemini API
    (external)         (external)          (external)
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Chat View (UI)** | Render live message feed, accept user input, stream tokens as they arrive | WebSocket server (receives), REST API (sends user messages) |
| **Room Manager (UI)** | List/create/select rooms, show agent roster per room | REST API |
| **Agent Config Panel (UI)** | Set agent persona, provider, model, system prompt | REST API |
| **REST API** | CRUD for rooms, agents, messages; start/stop conversation | Orchestration layer, storage |
| **WebSocket Server** | Push new messages and token streams to connected clients | Conversation Manager, frontend |
| **Conversation Manager** | Run the turn-taking loop; select next speaker; broadcast messages; enforce stop/pause | Agent instances, WebSocket server, Context Service |
| **Agent Instance** | Wrap a single agent identity (system prompt + provider config); call LLM with scoped context; return response | LLM Gateway, Context Service, Conversation Manager |
| **LLM Gateway** | Unified interface to Claude / GPT / Gemini APIs; handles auth, streaming, rate limits | External LLM APIs, Agent Instances |
| **Context Service** | Build per-agent context windows from room history; apply windowing/summarization to prevent token bloat | Storage, Agent Instances |
| **Room/Agent Config Service** | Persist and retrieve room config, agent definitions, system prompts | Storage |
| **Storage (DB)** | Durable persistence of messages, rooms, agent configurations | All services |
| **In-Memory Cache** | Sub-millisecond retrieval of recent conversation history for active rooms | Context Service, Conversation Manager |

## Recommended Project Structure

```
agents-room/
├── frontend/                    # React/Svelte/Vue single-page app
│   ├── src/
│   │   ├── components/
│   │   │   ├── RoomList/        # Sidebar navigation
│   │   │   ├── ChatView/        # Live conversation feed
│   │   │   ├── MessageBubble/   # Per-agent styled message
│   │   │   └── AgentConfig/     # Agent creation/editing
│   │   ├── stores/              # Client state (active room, messages)
│   │   ├── api/                 # HTTP + WebSocket client wrappers
│   │   └── App.tsx
│   └── package.json
│
└── backend/                     # Node.js / Python server
    ├── src/
    │   ├── api/                 # Route handlers (REST + WebSocket)
    │   │   ├── rooms.ts
    │   │   ├── agents.ts
    │   │   └── ws.ts
    │   ├── orchestration/       # Core multi-agent engine
    │   │   ├── ConversationManager.ts  # Turn loop, speaker selection
    │   │   ├── AgentInstance.ts        # Per-agent wrapper + prompt
    │   │   └── SpeakerSelector.ts      # Round-robin / LLM-driven
    │   ├── llm/                 # LLM provider abstraction
    │   │   ├── gateway.ts       # Unified call interface
    │   │   ├── providers/
    │   │   │   ├── anthropic.ts
    │   │   │   ├── openai.ts
    │   │   │   └── gemini.ts
    │   ├── context/             # Context window management
    │   │   ├── ContextService.ts       # Build agent-scoped history
    │   │   └── Summarizer.ts          # Condense old turns
    │   ├── storage/             # DB access layer
    │   │   ├── db.ts            # Connection + migrations
    │   │   ├── messages.ts
    │   │   └── rooms.ts
    │   └── config/              # API key loading, agent defaults
    └── package.json
```

### Structure Rationale

- **orchestration/:** Isolated from API and storage — the turn-taking loop can evolve independently. Most complex subsystem; deserves its own module boundary.
- **llm/providers/:** Each provider is a separate file; the gateway exposes one streaming interface. Adding a new provider means adding one file, not touching agent logic.
- **context/:** Separated from storage because context assembly is computation, not retrieval. Allows swapping summarization strategies without changing the DB schema.
- **api/:** Thin layer — routes delegate to orchestration services, never implement logic.

## Architectural Patterns

### Pattern 1: Conversation Manager with Centralized Turn Loop

**What:** A single Conversation Manager process owns the running conversation per room. It maintains the ordered message log, selects the next speaking agent, calls that agent, receives the response, writes it to storage, broadcasts it over WebSocket, then repeats.

**When to use:** Always for this project. The alternative (agents calling each other peer-to-peer) creates race conditions and makes user controls (stop/redirect) nearly impossible to implement.

**Trade-offs:**
- Pro: Single point of control, easy to pause/stop, easy to inject user messages
- Pro: Guaranteed message ordering
- Con: Sequential by design — agents cannot respond simultaneously (acceptable here; simultaneous speech would be confusing anyway)

**Example:**
```typescript
class ConversationManager {
  async runLoop(roomId: string) {
    while (this.isRunning(roomId)) {
      const context = await this.contextService.buildRoomContext(roomId);
      const nextAgent = await this.speakerSelector.selectNext(roomId, context);
      const response = await nextAgent.respond(context);
      await this.storage.saveMessage(roomId, nextAgent.id, response);
      this.websocket.broadcast(roomId, { agent: nextAgent.id, content: response });
      await this.applyTurnDelay(); // prevent runaway costs
    }
  }
}
```

### Pattern 2: Agent-Scoped Context Windows (not shared full history)

**What:** Each agent receives a context window assembled specifically for it, not the raw full message log. The Context Service computes what each agent sees: its own system prompt, a windowed slice of recent messages (e.g., last 20), optionally a running summary of older turns.

**When to use:** As soon as conversations get long. Without this, token costs grow quadratically (every new message re-sends all prior history to every agent). Research shows 60-80% token reduction with scoped context.

**Trade-offs:**
- Pro: Controls costs; prevents context-window overflow for long conversations
- Pro: Agents with narrow roles perform better without irrelevant noise
- Con: Adds complexity; requires a summarization step for very long rooms

**Example:**
```typescript
class ContextService {
  buildForAgent(agent: AgentConfig, messages: Message[]): ContextWindow {
    const recentMessages = messages.slice(-20);      // sliding window
    const summary = this.getSummary(messages, -20);  // summarized older turns
    return {
      systemPrompt: agent.systemPrompt,
      messages: [
        ...(summary ? [{ role: 'system', content: `Earlier: ${summary}` }] : []),
        ...recentMessages
      ]
    };
  }
}
```

### Pattern 3: LLM Gateway (Unified Provider Interface)

**What:** All LLM calls go through a single gateway module that translates a standard request object into provider-specific API calls and returns a standard streaming response. Providers are plug-in modules behind a common interface.

**When to use:** Any time multiple LLM providers must be supported. Prevents provider-specific code from leaking into agent logic.

**Trade-offs:**
- Pro: Swap providers without touching agent code; add providers incrementally
- Pro: One place to add logging, cost tracking, retry logic
- Con: Slight indirection; the gateway's streaming abstraction must handle different chunked formats per provider

**Example:**
```typescript
interface LLMProvider {
  stream(request: LLMRequest): AsyncIterable<string>;
}

class LLMGateway {
  private providers: Record<string, LLMProvider> = {
    anthropic: new AnthropicProvider(),
    openai: new OpenAIProvider(),
    gemini: new GeminiProvider(),
  };

  stream(providerName: string, request: LLMRequest): AsyncIterable<string> {
    return this.providers[providerName].stream(request);
  }
}
```

## Data Flow

### Agent Turn Flow (Core Loop)

```
[Conversation Manager: select next agent]
    ↓
[Context Service: build scoped window for that agent]
    ↓ (system prompt + recent messages + optional summary)
[Agent Instance: call LLM Gateway with context]
    ↓
[LLM Gateway: call provider API, receive token stream]
    ↓ (streaming tokens)
[Agent Instance: accumulate + yield tokens]
    ↓
[WebSocket Server: push tokens to UI in real-time]
    ↓ (message complete signal)
[Storage: write final message to DB]
    ↓
[In-Memory Cache: update recent history for room]
    ↓
[Conversation Manager: next iteration of loop]
```

### User Message Injection Flow

```
[User types message in Chat View]
    ↓
[REST POST /rooms/:id/messages]
    ↓
[API Layer: validate + write to DB immediately]
    ↓
[WebSocket broadcast: show user message to UI]
    ↓
[Conversation Manager: queue user message as next context item]
    ↓ (loop continues — next agent turn sees user message)
```

### User Control Flow (Stop / Redirect)

```
[User clicks Stop / sends redirect command]
    ↓
[REST POST /rooms/:id/control { action: "stop" | "redirect" }]
    ↓
[Conversation Manager: set isRunning = false | inject redirect prompt]
    ↓ (loop exits cleanly after current agent finishes its token stream)
```

### Key Data Flows

1. **Token streaming:** LLM provider → Agent Instance → WebSocket → Chat View UI. Tokens push as they arrive; the final assembled message is written to DB only once complete.

2. **Context assembly:** Each agent turn re-reads the last N messages from in-memory cache (microseconds), not the full DB (milliseconds). Cache is updated after each turn.

3. **Room history persistence:** Messages written to SQLite/Postgres after each completed turn. Cache holds last 30-50 messages per room for fast context assembly.

## Scaling Considerations

This is a personal single-user tool. Scaling is not a primary concern; the relevant considerations are cost and response latency.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user, 1-3 rooms active | Monolith is correct. No queue needed. In-process state is fine. |
| 1 user, many long-running rooms | Add per-room token budget + auto-pause. Context summarization becomes critical. |
| Multi-user (out of scope v1) | Would need: externalized conversation state (Redis), WebSocket pub/sub, horizontal scaling |

### Scaling Priorities

1. **First bottleneck:** LLM API cost. Multiple agents per turn × long history = quadratic token spend. Mitigate with sliding window context (Pattern 2 above).
2. **Second bottleneck:** Response latency. Agents respond sequentially; slow provider = stalled conversation. Mitigate with per-agent timeout + fallback message.

## Anti-Patterns

### Anti-Pattern 1: Full History Sent to Every Agent Every Turn

**What people do:** Pass the complete room message list as the context to every LLM call.

**Why it's wrong:** Token count grows with every message. In a 10-agent, 100-turn conversation, each new turn sends ~1000 past messages. Costs spiral, context windows overflow, agents lose focus on recent content.

**Do this instead:** Context Service builds a scoped window (last N turns + summary). Each agent sees only what it needs.

### Anti-Pattern 2: Agents Calling Each Other Directly (Peer-to-Peer)

**What people do:** Each agent has a reference to other agents and triggers them directly, forming a decentralized mesh.

**Why it's wrong:** No single point of control. User cannot reliably stop or redirect the conversation. Message ordering becomes non-deterministic. Difficult to persist the canonical message log.

**Do this instead:** Centralized Conversation Manager owns the loop and mediates all agent interactions.

### Anti-Pattern 3: Blocking the WebSocket Handler During LLM Calls

**What people do:** Await LLM completion inside the WebSocket message handler before responding.

**Why it's wrong:** LLM calls take 5-30+ seconds. A blocked handler stalls all other WebSocket events (stop commands, other room messages) during that window.

**Do this instead:** Conversation Manager runs in a background async loop. WebSocket handler only enqueues commands (stop, redirect, user message). The loop is non-blocking relative to the connection handler.

### Anti-Pattern 4: Storing API Keys in the Database

**What people do:** Save provider API keys in the same DB that stores conversation history.

**Why it's wrong:** Expands the attack surface. A DB read bug exposes credentials.

**Do this instead:** API keys in environment variables or a secrets file (`.env`), never in DB rows. Config service reads from env at startup.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic Claude API | Streaming HTTP (`/v1/messages` with `stream: true`) | SDK: `@anthropic-ai/sdk`. Native streaming via `AsyncIterable`. |
| OpenAI / GPT | Streaming HTTP (`/v1/chat/completions` with `stream: true`) | SDK: `openai`. Same SSE pattern. |
| Google Gemini API | Streaming gRPC or HTTP (`generateContentStream`) | SDK: `@google/genai`. Slightly different chunk format — normalize in gateway. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Backend API | HTTP REST + WebSocket | WebSocket for live messages; REST for all CRUD and controls |
| Conversation Manager ↔ Agent Instance | Direct function call (in-process) | No queue needed for single-user; keep it simple |
| Agent Instance ↔ LLM Gateway | Async generator / streaming iterator | Gateway yields token chunks; agent accumulates them |
| Conversation Manager ↔ WebSocket Server | Event emitter or callback | Manager emits `message:token` and `message:complete` events; WS handler broadcasts |
| Context Service ↔ Storage | Read-through cache | Check in-memory cache first; fall back to DB; write-through on new messages |

## Build Order Implications

The component dependency graph dictates this build sequence:

1. **Storage layer first** — DB schema, migrations, message/room CRUD. Everything reads and writes here.
2. **LLM Gateway second** — Can be tested independently against real APIs. Validates provider integrations before any agent logic.
3. **Agent Instance + Context Service third** — Depends on gateway (to call LLMs) and storage (to retrieve history). This is the core intelligence layer.
4. **Conversation Manager fourth** — Depends on agents and context service. The turn loop can be tested with mocked agents before UI exists.
5. **WebSocket Server fifth** — Connects manager events to client. Depends on manager being functional.
6. **REST API sixth** — Thin wrappers; depends on storage and manager.
7. **Frontend last** — All backend contracts must be stable. UI can be built against a running backend.

This order means phases can ship incrementally: a working CLI conversation (no UI) is testable after step 4.

## Sources

- [Google Cloud: Multi-agent AI System Architecture](https://docs.cloud.google.com/architecture/multiagent-ai-system) — Reference architecture, component roles, A2A and MCP protocols
- [Google Developers Blog: Architecting Efficient Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/) — Session/working context/processor separation, context scoping pattern
- [AutoGen 0.2: Multi-Agent Conversation Framework](https://microsoft.github.io/autogen/0.2/docs/Use-Cases/agent_chat/) — ConversableAgent, turn-taking mechanism, GroupChatManager pattern
- [AG2: Orchestration Patterns](https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/orchestration/group-chat/patterns/) — Speaker selection strategies: round-robin, random, LLM-driven
- [Microsoft Azure: AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) — Group chat orchestration, star topology
- [Render: Real-Time AI Chat WebSockets Infrastructure](https://render.com/articles/real-time-ai-chat-websockets-infrastructure) — Web service + background worker + cache pattern for streaming
- [ProxAI: The LLM Abstraction Layer](https://www.proxai.co/blog/archive/llm-abstraction-layer) — LLM gateway pattern rationale
- [Codebridge: Multi-Agent Orchestration Guide 2026](https://www.codebridge.tech/articles/mastering-multi-agent-orchestration-coordination-is-the-new-scale-frontier) — Context engineering, token bloat, pub/sub patterns
- [getmaxim.ai: Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) — Sliding window, summarization, agent scoping

---
*Architecture research for: Agents Room — multi-agent AI chat (personal, single-user)*
*Researched: 2026-03-19*
