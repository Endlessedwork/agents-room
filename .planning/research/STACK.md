# Stack Research

**Domain:** Multi-agent AI chat room (personal web app, real-time, multi-LLM provider)
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH (core stack HIGH, some supporting lib choices MEDIUM)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.0 | Full-stack React framework (frontend + API routes) | Latest stable (March 2026). App Router + Route Handlers handle SSE streaming natively. Unified frontend/backend in one project avoids cross-origin complexity for a personal tool. Built by Vercel, tight AI SDK integration. |
| TypeScript | 5.x | Language | Non-negotiable for an AI app with complex message schemas, agent configs, and provider types. The entire AI SDK ecosystem is TypeScript-first. |
| Vercel AI SDK (`ai`) | 6.0.116 | LLM abstraction layer — streaming, multi-provider, agent loops | The single most important library choice. Provides `streamText`, `generateText`, unified provider interface, and `ToolLoopAgent` for agentic loops. Switching models is a one-line change. v6 introduced stable `Agent` abstraction. Without this, you write separate streaming logic per provider. |
| `@ai-sdk/anthropic` | 3.0.58 | Claude provider adapter | Official Vercel AI SDK adapter for Anthropic. Unified interface, token streaming, tool calls. |
| `@ai-sdk/openai` | 3.0.41 | GPT provider adapter | Official Vercel AI SDK adapter for OpenAI. Same interface as Anthropic adapter — agent code is provider-agnostic. |
| `@ai-sdk/google` | 3.0.43 | Gemini provider adapter | Official Vercel AI SDK adapter for Google Gemini. Same interface. |
| Drizzle ORM | 0.45.1 | Database ORM | TypeScript-first, code-first schema definition, no code generation step needed (`prisma generate` friction eliminated). Bundle size ~90% smaller than Prisma. Instant TypeScript feedback during development. Ideal for a fast-moving personal project. |
| SQLite (via `better-sqlite3`) | — | Persistence (rooms, agents, messages, history) | Perfect for a single-user personal tool. Zero setup, single file on disk, no server process. Can handle the write volume of one user watching agents converse. Upgrade path to PostgreSQL via Drizzle if ever needed. |
| Tailwind CSS | v4.x | Styling | Now the de facto standard for TypeScript React projects. v4 ships with @theme directive. shadcn/ui components require it. No alternatives seriously compete for a personal app. |
| shadcn/ui | latest | Component library | Not a dependency — copies components into your project, fully customizable. Provides Scroll Area, Avatar, Badge, Input, Button, Card needed for chat UI. Built on Radix UI primitives (accessible). Tailwind v4 support confirmed. |
| Zustand | 5.x | Client-side state (rooms, active agent list, UI state) | Simpler than Redux, more structured than Context. Ideal for chat app state: current room, agent list, message buffer, connection status. Single store model fits this domain. Jotai is an alternative (atomic model) but Zustand's centralized store is easier to reason about for cross-cutting chat state. |

### Real-Time Transport

| Technology | Purpose | Why |
|------------|---------|-----|
| Server-Sent Events (SSE) via Next.js Route Handlers | Streaming LLM tokens to the UI, agent turn notifications | SSE is the right protocol for this use case: unidirectional (server → client), built-in browser reconnect, works over standard HTTP/2, no extra library needed. The AI SDK uses SSE internally for its `useChat` hook. Agent messages flow server → client, user messages go via POST — this is exactly SSE's sweet spot. |
| HTTP POST (fetch) | User messages → server, agent control commands | Standard REST for the write path. No WebSocket complexity needed for a single-user personal tool where the only bidirectional pattern is: user types → server processes → SSE stream. |

**Why not WebSocket / Socket.IO:** WebSockets are appropriate when you need true bidirectional real-time (gaming, collaborative editing, multiple users). For watching AI agents stream text, SSE is simpler, scales better under HTTP/2, and needs no extra library. Socket.IO adds ~8MB and reconnection complexity you don't need.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-kit` | latest | Drizzle migrations CLI | Required alongside drizzle-orm. Generates and runs migrations. |
| `better-sqlite3` | latest | SQLite driver for Node.js | Synchronous, fast, well-tested. Used by Drizzle for SQLite in Node.js. |
| `@types/better-sqlite3` | latest | TypeScript types | Always. |
| `zod` | 3.x | Runtime validation for API bodies, agent config schemas | The AI SDK uses Zod for structured output schemas. Use it throughout for consistency — validates incoming POST bodies, agent configuration objects, room settings. |
| `react-markdown` | 9.x | Render agent message content as Markdown | Agents produce Markdown. Rendering raw text loses formatting. Use with `remark-gfm` for tables and code blocks. |
| `remark-gfm` | 4.x | GitHub Flavored Markdown plugin for react-markdown | Enables tables, strikethrough, task lists in agent output. |
| `react-syntax-highlighter` | 15.x | Code block syntax highlighting in agent messages | Agents writing code need highlighted blocks for readability. Pair with react-markdown custom renderers. |
| `nanoid` | 5.x | Generate unique IDs for rooms, agents, messages | Tiny, fast, URL-safe. No UUID dependency needed. |
| `date-fns` | 3.x | Timestamp formatting in chat UI | Lightweight, tree-shakeable alternative to moment.js. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Biome | Linting + formatting (replaces ESLint + Prettier) | Single tool, zero-config, significantly faster than ESLint. Opinionated defaults that work well for TypeScript. Replaces the ESLint/Prettier dual-config headache. |
| Vitest | Unit tests | Fastest test runner for Vite-adjacent projects. Works natively with TypeScript, no separate transpile step. Test agent orchestration logic, message queue, provider abstraction. |
| Drizzle Studio | Database browser | Bundled with drizzle-kit. Visual browser for SQLite DB during development. Run via `npx drizzle-kit studio`. |

---

## Installation

```bash
# Create the Next.js app
npx create-next-app@latest agents-room --typescript --tailwind --app --src-dir

# Core AI SDK + providers
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google

# Database
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3

# Validation
npm install zod

# UI
npm install zustand nanoid date-fns
npm install react-markdown remark-gfm react-syntax-highlighter
npm install -D @types/react-syntax-highlighter

# shadcn/ui (interactive, installs components on demand)
npx shadcn@latest init
# Then add components as needed:
# npx shadcn@latest add button card scroll-area avatar badge input textarea

# Dev tools
npm install -D @biomejs/biome vitest
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vercel AI SDK | Raw provider SDKs (`@anthropic-ai/sdk`, `openai`) | Never for this project — raw SDKs require writing separate streaming logic per provider. Use raw SDKs only if you need provider-specific features not exposed by the AI SDK. |
| Vercel AI SDK | Mastra | Mastra is compelling for production multi-agent systems with built-in RAG, evals, memory, and AgentNetwork. For this personal tool starting from greenfield, Mastra's abstractions are heavier than needed. Revisit if conversation memory and agent evaluation become priorities. |
| Vercel AI SDK | LangGraph.js | Graph-based orchestration is powerful for complex branching agent workflows. Overhead is not justified for a chat room with sequential turn-taking. Consider if agent workflows need conditional routing or parallel tool execution trees. |
| SQLite | PostgreSQL | Use PostgreSQL if you want to deploy to a hosted server (Railway, Fly.io) or if you ever need concurrent write access from multiple processes. Drizzle makes migration trivial. |
| Drizzle ORM | Prisma | Prisma 7 eliminated the Rust engine (now pure TypeScript), closing the performance gap. Still requires `prisma generate` on schema change. Choose Prisma if you prefer its schema DSL and want maximum ecosystem maturity. |
| SSE | WebSocket / Socket.IO | Choose WebSocket only if you add multi-user collaboration or need sub-100ms latency for binary data. Neither applies here. |
| Next.js 16 | Hono + Vite (separate frontend/backend) | Hono is excellent for edge/serverless APIs and performs better at scale. For a personal tool where deploy simplicity matters and there's no traffic concern, Next.js bundled full-stack is faster to ship. Use Hono if you want a separate API server or plan to deploy the backend to Cloudflare Workers. |
| Zustand | Jotai | Jotai's atomic model gives finer-grained re-renders. For this app, the chat message list updates need coordinated state (room + agents + messages together), making Zustand's centralized store the better fit. |
| Biome | ESLint + Prettier | Use ESLint if your team has existing ESLint configs or uses plugins with no Biome equivalent. For a greenfield personal project, Biome is strictly faster and simpler. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Redux / Redux Toolkit | Massive boilerplate for a personal app with simple state needs. Designed for large team codebases with complex state interactions. | Zustand |
| Socket.IO | Adds unnecessary complexity and bundle weight (~300KB) for a unidirectional streaming use case. Reconnection logic it provides can be handled by SSE's native EventSource retry. | Native SSE via Next.js Route Handlers |
| LangChain.js | Abstraction layer that has historically lagged behind provider updates, introduced bugs when APIs changed, and the abstraction leaks when you need non-standard behavior. The AI SDK provides everything needed with a thinner, more stable interface. | Vercel AI SDK directly |
| Firebase / Supabase Realtime | Cloud-managed real-time adds external dependencies, costs, and privacy concerns for a personal tool. The SSE + SQLite pattern is self-contained with no third-party real-time service needed. | SSE via Next.js + SQLite |
| MongoDB / NoSQL | Chat messages and agent conversations are relational: rooms have agents, agents have messages, messages have parent messages. SQL models this cleanly. NoSQL requires denormalization that becomes painful when querying conversation history. | SQLite via Drizzle |
| OpenAI Assistants API | Locks conversation state into OpenAI's servers. You can't run the same conversation across providers (Claude for agent A, GPT for agent B). The core value prop of this app is multi-provider — avoid any provider-specific statefulness. | Custom conversation history in SQLite |
| Moment.js | Discontinued, large bundle size. | `date-fns` |

---

## Stack Patterns by Variant

**If you want agents to use tools (web search, code execution):**
- Use the AI SDK's built-in tool-calling with `experimental_toToolResultContent` for multi-modal tool results
- Define tools via Zod schemas passed to `streamText({ tools: {...} })`
- Tool results flow back into conversation automatically with the ToolLoopAgent

**If you want persistent agent memory across sessions:**
- Add a `memories` table to SQLite (agent_id, content, embedding, timestamp)
- Use the AI SDK's `experimental_prepareRequestBody` to inject relevant memories as system context
- Consider upgrading to Mastra at this point — its memory primitives are well-designed

**If you want to deploy to a server (not just run locally):**
- SQLite works fine on a single-server VPS (Railway, Fly.io, DigitalOcean)
- Use `better-sqlite3` in WAL mode for better concurrent read performance: `db.pragma('journal_mode = WAL')`
- If you need multi-process access, migrate to PostgreSQL via Drizzle (schema is compatible)

**If you add voice/audio in the future:**
- OpenAI Realtime API uses WebSockets — that would justify adding WebSocket support
- Keep SSE for text agents, add WebSocket specifically for voice agents

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `ai@6.x` | Next.js 16.x | Fully compatible. AI SDK 6 was released December 2025, Next.js 16 March 2026. |
| `@ai-sdk/anthropic@3.x` | `ai@6.x` | Major versions align — all provider packages on `3.x` work with core `ai@6.x`. |
| `@ai-sdk/openai@3.x` | `ai@6.x` | Same as above. |
| `@ai-sdk/google@3.x` | `ai@6.x` | Same as above. |
| `drizzle-orm@0.45.x` | `better-sqlite3` any recent | Stable pairing. Use `drizzle-kit` matching the `drizzle-orm` version. |
| `tailwindcss@4.x` | Next.js 16.x | Compatible. shadcn/ui components updated for Tailwind v4 + React 19. |
| `zod@3.x` | `ai@6.x` | AI SDK uses Zod 3.x internally for structured output schemas. Pin to 3.x to avoid conflicts. |
| `react-markdown@9.x` | React 19 (Next.js 16) | v9 supports React 19. Earlier versions have peer dep issues with React 19. |

---

## Agent Turn-Taking Architecture Note

The AI SDK does not provide a built-in "group chat" orchestrator (agents taking turns in sequence). You build this yourself with a simple loop:

```typescript
// Conceptual: agents take turns until stop condition
async function runConversationRound(room: Room, trigger: string) {
  for (const agent of room.agents) {
    const history = await getRecentMessages(room.id);
    const { textStream } = streamText({
      model: getProvider(agent.provider)(agent.model),
      system: agent.systemPrompt,
      messages: [...history, { role: 'user', content: trigger }],
    });
    // Stream tokens to UI via SSE, persist complete message to SQLite
    await persistAndStream(textStream, agent, room);
  }
}
```

This is intentional — the turn-taking logic is domain-specific and simple enough to own. Do not reach for Mastra or LangGraph just for turn management.

---

## Sources

- `https://ai-sdk.dev/docs/introduction` — AI SDK v6 current version (6.0.116), provider packages, streaming APIs (HIGH confidence)
- `https://vercel.com/blog/ai-sdk-6` — AI SDK 6 release notes, ToolLoopAgent, Agent abstraction (HIGH confidence)
- `https://github.com/vercel/next.js/releases` — Next.js 16.2.0 confirmed stable as of March 18, 2026 (HIGH confidence)
- `https://www.npmjs.com/package/@ai-sdk/anthropic` — version 3.0.58 (HIGH confidence)
- `https://www.npmjs.com/package/@ai-sdk/openai` — version 3.0.41 (HIGH confidence)
- `https://www.npmjs.com/package/@ai-sdk/google` — version 3.0.43 (HIGH confidence)
- `https://www.npmjs.com/package/drizzle-orm` — version 0.45.1 (HIGH confidence)
- `https://makerkit.dev/blog/tutorials/drizzle-vs-prisma` — Drizzle vs Prisma comparison (MEDIUM confidence — editorial)
- `https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events` — SSE vs WebSocket for Next.js (MEDIUM confidence)
- `https://ui.shadcn.com/docs/tailwind-v4` — shadcn/ui Tailwind v4 support confirmed (HIGH confidence)
- WebSearch results on Zustand vs Jotai, Mastra, LangGraph.js, Hono — (MEDIUM confidence — synthesized from multiple sources)

---

*Stack research for: Agents Room — multi-agent AI chat room*
*Researched: 2026-03-19*
