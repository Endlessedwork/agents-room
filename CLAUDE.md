# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # Biome check (lint + format check)
npm run format       # Biome format --write
npm test             # vitest run (all tests)
npm run test:watch   # vitest watch mode
npx vitest run tests/conversation/manager.test.ts  # Single test file
npm run db:seed      # Seed database with sample data
npm run test:providers     # Test LLM provider connectivity
npm run test:conversation  # Test conversation flow
```

## Architecture

Multi-agent conversation app: agents powered by LLMs talk to each other in rooms while user observes/participates.

### Conversation Engine (fire-and-forget loop)

```
POST /api/rooms/:roomId/conversation/start → returns immediately
  └→ ConversationManager.start() runs async turn loop in background
       ├→ runParallelRound() if parallelFirstRound enabled (round 1 only)
       │    └→ Promise.all contexts → Promise.allSettled LLM calls → buffer-then-emit
       ├→ SpeakerSelector.next() picks agent (round-robin or llm-selected)
       ├→ ContextService.buildContext() builds system prompt + sliding window (20 msgs)
       │    ├→ injects anti-sycophancy prompt from round 2+
       │    └→ injects topic-lock reminder every 5 turns
       ├→ gateway.streamLLM() streams tokens via Vercel AI SDK
       ├→ StreamRegistry.emitSSE() pushes events to all connected clients
       ├→ ContextService.detectRepetition() auto-pauses if Jaccard ≥ 0.85
       └→ ContextService.detectConvergence() auto-pauses if agents reach consensus
```

Key files: `src/lib/conversation/manager.ts`, `context-service.ts`, `speaker-selector.ts`, `src/lib/pricing.ts`

### SSE Streaming (server → client)

- Server: `StreamRegistry` (`src/lib/sse/stream-registry.ts`) — global Map of roomId → Set of SSE controllers
- Client: `useRoomStream` hook (`src/hooks/useRoomStream.ts`) → EventSource → dispatches to `chatStore`
- Events: `turn:start`, `token`, `turn:end`, `turn:cancel`, `status`, `system`, `user-message`, `parallel:start`, `parallel:end`, `parallel:cancel`

### Copy-on-Assign Agents

Global `agents` table = template library. When assigned to a room, all fields are copied to `roomAgents`. Editing a global agent does NOT affect existing room agents. Messages FK to `roomAgentId`, not global `agentId`.

### Client State (Zustand)

- `roomStore` — rooms list, active room selection
- `chatStore` — messages, streaming state, token totals, estimated cost, message dedup via `messageIds` Set
- `agentStore` — global agent library
- `presetStore` — preset configurations (room templates with pre-assigned agents)

### Routing

Next.js App Router. `(dashboard)` route group wraps the main UI pages. API routes under `src/app/api/`.

### Database

Drizzle ORM + SQLite (better-sqlite3, WAL mode). Schema in `src/db/schema.ts`.
Tables: `agents`, `rooms`, `roomAgents`, `messages`, `providerKeys`, `presets`.
Migrations: `src/db/migrations/`. Config: `drizzle.config.ts`.

### LLM Providers

5 providers via Vercel AI SDK: Anthropic, OpenAI, Google, OpenRouter, Ollama.
Each agent specifies its own provider + model. Provider configs fetched fresh per turn (no caching).
Gateway: `src/lib/llm/gateway.ts` wraps `streamText()` / `generateText()`.
Cost estimation: `src/lib/pricing.ts` uses `llm-info` for static model pricing. Ollama → "local", unknown → "---".

## Environment

- **No `.env` required** — provider API keys are stored in SQLite (`providerKeys` table), configured via the web UI
- All config is in-database, not environment variables
- SQLite DB auto-created at `data/agents-room.db` (relative to cwd). WAL mode + foreign keys enabled on init.
- Next.js uses `output: 'standalone'` — production builds produce a self-contained `server.js`

### Docker

```bash
docker build -t agents-room .       # Multi-stage build (node:22-alpine)
docker run -p 3000:3000 -v ./data:/app/data agents-room  # Mount data/ for persistent DB
```

## Code Style

- Biome: single quotes, trailing commas, semicolons always, 2-space indent, 100 char line width
- Path alias: `@/*` → `./src/*`
- Validation: Zod schemas in `src/lib/validations.ts` for all API request bodies
- Next.js 16 route params are async: `{ params }: { params: Promise<{ roomId: string }> }` — must `await params`

## Testing

- Vitest with node environment. Tests in `tests/` directory (not `src/`).
- `createTestDb()` in `tests/setup.ts` creates in-memory SQLite with full schema
- Mock patterns: `vi.mock()` for modules, `vi.mocked()` for type casting
- Helpers: `waitForMessages()`, `waitForStatus()`, `makeMockStream()` in test files

## Non-Obvious Patterns

- **Sentinel controller**: ConversationManager registers a sentinel AbortController before the loop to prevent double-start race conditions
- **User message seeding**: ContextService injects a user message if history is empty or starts with assistant (LLM APIs require user-first)
- **Empty message filtering**: Messages with empty content after trim are excluded from context
- **Room agent position**: Auto-calculated as count of existing roomAgents at insertion time
- **Anti-sycophancy injection**: From round 2+ (turnCount ≥ 1), ContextService injects a prompt forbidding reflexive agreement
- **Topic-lock reminder**: Every 5 turns, agents receive a reminder of the room topic to prevent drift (only when room.topic exists)
- **Convergence vs repetition**: `detectConvergence()` is distinct from `detectRepetition()` — convergence requires both agreement phrases AND cross-agent Jaccard ≥ 0.35, min 6 turns
- **Parallel first round isolation**: `runParallelRound()` uses Promise.all for contexts then Promise.allSettled for LLM calls — structural guarantee that agents never see each other's round 1 responses
