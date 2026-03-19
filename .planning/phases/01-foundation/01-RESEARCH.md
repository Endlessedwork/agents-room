# Phase 1: Foundation - Research

**Researched:** 2026-03-19
**Domain:** SQLite persistence (Drizzle ORM), LLM gateway (Vercel AI SDK v6, 5 providers), Next.js 16 App Router CRUD API, management UI (shadcn/ui, Zustand)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**API Key Management**
- In-app settings page with provider cards — one card per provider showing status (configured/not configured) and a "Test connection" button
- 5 providers supported from day one: Anthropic (Claude), OpenAI (GPT), Google (Gemini), OpenRouter, Ollama
- Keys stored in database (Claude's discretion on encryption approach for a single-user local tool)
- No env vars fallback needed — settings page is the single source

**Agent Persona Design**
- Agents are global — created once in a library, then assigned to rooms (as copies)
- Agent creation form fields: name + avatar (color/icon), system prompt (structured form), provider + model picker, temperature slider
- System prompt editor is a structured form with separate fields for role, personality traits, rules, and constraints (not a single textarea)
- Built-in preset templates available: e.g., "Devil's Advocate", "Code Reviewer", "Researcher" — one-click creation then customize

**Room List & Navigation**
- Sidebar + main area layout (Slack/Discord pattern) — room list on the left, conversation view on the right
- Room list items show: name + topic, last activity timestamp, status indicator (running/paused/idle)
- No agent avatars in the sidebar list (keep it clean)
- New room creation via full-page wizard: step-by-step flow — name → pick agents from library → set topic → done

**Data Relationships**
- Agents are global entities in a library
- Adding an agent to a room creates a copy — same starting config but evolves independently per room
- This means each room has its own room_agents table entries with potentially overridden settings
- Default agents on room creation: Claude's discretion (suggest from library during wizard)

### Claude's Discretion

- API key encryption strategy (plain text vs encrypted at rest for personal tool)
- Default agent suggestions during room creation wizard
- Exact avatar system (color palette, icon set, or generated avatars)
- Settings page layout details beyond the provider card pattern
- Database migration strategy

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROOM-01 | User can create a new room with a name and optional topic description | Drizzle `rooms` table schema + Next.js POST route handler + room creation wizard UI |
| ROOM-02 | User can view a list of all rooms with their status | Drizzle SELECT query + Next.js GET route handler + sidebar room list component |
| ROOM-03 | User can delete a room and its conversation history | Drizzle DELETE with cascade + Next.js DELETE route handler + confirmation UI |
| ROOM-04 | User can open a room and see its full conversation history | Drizzle `messages` table query + Next.js GET route handler + empty conversation panel UI |
| AGNT-01 | User can create an agent with a name, persona/role, and system prompt | Drizzle `agents` table schema + structured form with role/personality/rules/constraints fields |
| AGNT-02 | User can assign a specific LLM provider and model to each agent (Claude, GPT, Gemini) | LLM Gateway with createAnthropic/createOpenAI/createGoogleGenerativeAI/createOpenRouter/createOllama factories + provider+model picker UI |
| AGNT-03 | User can add/remove agents from a room | Drizzle `room_agents` join table + copy-on-assign semantics + Next.js POST/DELETE route handlers |
</phase_requirements>

---

## Summary

Phase 1 establishes the data layer, provider abstraction layer, and management UI that everything else builds on. There are three distinct build tracks: (1) database schema + migrations using Drizzle ORM with better-sqlite3, (2) LLM gateway providing a unified streaming interface over 5 providers, and (3) CRUD REST API + management UI for rooms and agents. All three are well-documented domains with no significant unknowns.

The most architecturally consequential decision in this phase is the room_agents schema. Agents are global library entities; adding one to a room creates a copy that evolves independently. This "copy-on-assign" design must be modeled correctly in the database — a simple foreign key join would be wrong. The room_agents table must store its own overrideable columns (system_prompt, temperature, model, provider) that start as copies of the library agent and diverge independently per room.

For the LLM gateway, the Vercel AI SDK v6 handles the hardest part: unified streaming across all five providers through provider-specific factory functions (createAnthropic, createOpenAI, createGoogleGenerativeAI, createOpenRouter, createOllama). API keys from the database are passed directly to these factories, bypassing env vars entirely. The settings page stores keys in the database and constructs providers at call time.

**Primary recommendation:** Build in dependency order — schema migrations first, then LLM gateway verification (CLI test confirming all 5 providers stream), then CRUD API and management UI.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.1 | TypeScript-first ORM — schema definition, queries, relations | Zero code-generation step, type-safe queries, identical schema can migrate to Postgres via Drizzle |
| `better-sqlite3` | 12.8.0 | SQLite driver for Node.js | Synchronous API, fast, zero-server, single file — perfect for single-user personal tool |
| `drizzle-kit` | 0.31.10 | Migration CLI — generate SQL migration files, apply them, Studio browser | Required companion to drizzle-orm |
| `@types/better-sqlite3` | latest | TypeScript types for better-sqlite3 | Always required with better-sqlite3 |
| `ai` | 6.0.116 | Vercel AI SDK core — streamText, generateText, unified provider interface | Single most consequential library: swap providers in one line, handles all streaming normalization |
| `@ai-sdk/anthropic` | 3.0.58 | Claude provider adapter | createAnthropic factory, identical interface to other providers |
| `@ai-sdk/openai` | 3.0.41 | GPT provider adapter | createOpenAI factory, identical interface |
| `@ai-sdk/google` | 3.0.43 | Gemini provider adapter | createGoogleGenerativeAI factory, identical interface |
| `@openrouter/ai-sdk-provider` | 2.3.3 | OpenRouter community provider | createOpenRouter factory, 300+ models through a single key |
| `ollama-ai-provider-v2` | 1.2.0 | Ollama community provider | createOllama factory, configurable baseURL for local model server |
| `zod` | 4.3.6 | Runtime validation for API request bodies, agent config, provider settings | AI SDK uses Zod internally; use it throughout for consistency |
| `next` | 16.2.0 | Full-stack React framework — App Router, Route Handlers, pages | Unified frontend + backend, no cross-origin complexity, native SSE support |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | 5.0.12 | Client-side state — room list, active room, agent library, UI state | Centralised store for cross-cutting chat state; simpler than Redux |
| `tailwindcss` | v4.x | Styling | Required by shadcn/ui |
| `shadcn/ui` | 4.0.8 (CLI) | Component library (Button, Card, Input, Select, Textarea, Avatar, Badge, ScrollArea) | Copies components into project — fully customizable, built on Radix UI |
| `nanoid` | 5.x | Generate unique IDs for rooms, agents, messages | Tiny, URL-safe, no UUID dependency |
| `date-fns` | 3.x | Timestamp formatting in room list (last activity) | Lightweight, tree-shakeable |
| `@biomejs/biome` | 2.4.8 | Linting + formatting (replaces ESLint + Prettier) | Zero-config, faster |
| `vitest` | 4.1.0 | Unit tests | TypeScript-native test runner, fast |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `better-sqlite3` | `libsql` (@libsql/client) | libsql is Turso's fork with async API and edge deployment; better-sqlite3 is simpler/synchronous, ideal for local-only; Drizzle supports both |
| `drizzle-kit generate` + `migrate` | `drizzle-kit push` | push is faster during development (no migration files), generate+migrate is safer for production; use push in dev, generate+migrate for any deployed instance |
| `@openrouter/ai-sdk-provider` | Raw OpenAI-compatible baseURL on createOpenAI | createOpenAI({ baseURL: 'https://openrouter.ai/api/v1' }) works but loses OpenRouter-specific features; use the official provider |
| `ollama-ai-provider-v2` | `createOpenAI({ baseURL: 'http://localhost:11434/v1' })` | OpenAI-compatible mode works but createOllama has native Ollama features (model listing, pull); use the community provider |

**Installation:**
```bash
# Next.js app (if not already initialized)
npx create-next-app@latest agents-room --typescript --tailwind --app --src-dir

# Database
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3

# AI SDK core + official providers
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google

# Community providers
npm install @openrouter/ai-sdk-provider ollama-ai-provider-v2

# Validation
npm install zod

# UI + State
npm install zustand nanoid date-fns
npx shadcn@latest init -t next
npx shadcn@latest add button card input select textarea avatar badge scroll-area separator dialog

# Dev tools
npm install -D @biomejs/biome vitest
```

**Version verification (confirmed 2026-03-19 against npm registry):**
| Package | Verified Version | Source |
|---------|-----------------|--------|
| `drizzle-orm` | 0.45.1 | npm registry |
| `better-sqlite3` | 12.8.0 | npm registry |
| `drizzle-kit` | 0.31.10 | npm registry |
| `ai` | 6.0.116 | npm registry |
| `@ai-sdk/anthropic` | 3.0.58 | npm registry |
| `@ai-sdk/openai` | 3.0.41 | npm registry |
| `@ai-sdk/google` | 3.0.43 | npm registry |
| `@openrouter/ai-sdk-provider` | 2.3.3 | npm registry |
| `ollama-ai-provider-v2` | 1.2.0 | npm registry |
| `next` | 16.2.0 | npm registry |
| `zod` | 4.3.6 | npm registry |
| `zustand` | 5.0.12 | npm registry |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Sidebar + main area shell
│   │   ├── page.tsx            # Room list / home
│   │   └── rooms/
│   │       ├── new/
│   │       │   └── page.tsx    # Multi-step room creation wizard
│   │       └── [roomId]/
│   │           └── page.tsx    # Room view (empty conversation panel)
│   ├── agents/
│   │   ├── page.tsx            # Agent library
│   │   └── new/
│   │       └── page.tsx        # Agent creation form
│   ├── settings/
│   │   └── page.tsx            # Provider cards + API key management
│   └── api/
│       ├── rooms/
│       │   ├── route.ts        # GET (list), POST (create)
│       │   └── [roomId]/
│       │       ├── route.ts    # GET (detail), DELETE (with cascade)
│       │       └── agents/
│       │           └── route.ts # POST (add agent), DELETE (remove agent)
│       ├── agents/
│       │   ├── route.ts        # GET (library), POST (create)
│       │   └── [agentId]/
│       │       └── route.ts    # GET, PUT (update), DELETE
│       ├── providers/
│       │   ├── route.ts        # GET (list with status), PUT (save key)
│       │   └── [provider]/
│       │       └── test/
│       │           └── route.ts # POST (test connection)
│       └── llm/
│           └── test/
│               └── route.ts    # POST (streaming test endpoint for CLI verification)
├── db/
│   ├── index.ts                # Database connection singleton
│   ├── schema.ts               # All table definitions + relations
│   └── migrations/             # Generated by drizzle-kit
├── lib/
│   ├── llm/
│   │   ├── gateway.ts          # LLM gateway — unified provider interface
│   │   └── providers.ts        # Provider factory registry (keyed by provider name)
│   └── utils.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Room list sidebar
│   │   └── RoomListItem.tsx    # Name + topic + timestamp + status
│   ├── rooms/
│   │   ├── RoomWizard.tsx      # Multi-step room creation
│   │   └── ConversationPanel.tsx # Empty conversation history panel
│   ├── agents/
│   │   ├── AgentCard.tsx       # Agent library card
│   │   ├── AgentForm.tsx       # Structured system prompt form
│   │   └── AgentPresets.ts     # Built-in persona templates
│   └── settings/
│       └── ProviderCard.tsx    # API key input + status + test button
└── stores/
    ├── roomStore.ts            # Room list + active room Zustand store
    └── agentStore.ts           # Agent library Zustand store
```

### Pattern 1: Drizzle Schema with Copy-on-Assign Room Agents

**What:** Agents exist in a global library (`agents` table). Adding an agent to a room inserts a row in `room_agents` that COPIES the agent's config columns — the room_agents row is the independent per-room instance, not a reference.

**When to use:** Required for this project. Using a simple FK join would mean all rooms share the same live agent config — changes to the library agent would affect all rooms using it, and per-room evolution is impossible.

**Schema:**
```typescript
// Source: Drizzle ORM official docs (orm.drizzle.team) + project decisions

import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// --- Global agent library ---
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),                        // nanoid
  name: text('name').notNull(),
  avatarColor: text('avatar_color').notNull(),        // hex color
  avatarIcon: text('avatar_icon').notNull(),          // icon name
  // Structured system prompt fields (separate columns, not one blob)
  promptRole: text('prompt_role').notNull(),
  promptPersonality: text('prompt_personality'),
  promptRules: text('prompt_rules'),
  promptConstraints: text('prompt_constraints'),
  provider: text('provider').notNull(),               // 'anthropic'|'openai'|'google'|'openrouter'|'ollama'
  model: text('model').notNull(),
  temperature: real('temperature').notNull().default(0.7),
  presetId: text('preset_id'),                        // null = custom, named = from template
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// --- Rooms ---
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),                        // nanoid
  name: text('name').notNull(),
  topic: text('topic'),
  status: text('status', { enum: ['idle', 'running', 'paused'] }).notNull().default('idle'),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// --- Room agent instances (copy-on-assign) ---
// Each row is an independent copy of an agent assigned to a room.
// Changing the library agent does NOT affect existing room_agents rows.
export const roomAgents = sqliteTable('room_agents', {
  id: text('id').primaryKey(),                        // nanoid
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  sourceAgentId: text('source_agent_id').references(() => agents.id, { onDelete: 'set null' }),
  name: text('name').notNull(),                       // copied at assignment time
  avatarColor: text('avatar_color').notNull(),
  avatarIcon: text('avatar_icon').notNull(),
  promptRole: text('prompt_role').notNull(),
  promptPersonality: text('prompt_personality'),
  promptRules: text('prompt_rules'),
  promptConstraints: text('prompt_constraints'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  temperature: real('temperature').notNull().default(0.7),
  position: integer('position').notNull().default(0), // turn order
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// --- Messages (empty panel in Phase 1, full use in Phase 2+) ---
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),                        // nanoid
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  roomAgentId: text('room_agent_id').references(() => roomAgents.id, { onDelete: 'set null' }),
  role: text('role', { enum: ['user', 'agent', 'system'] }).notNull(),
  content: text('content').notNull(),
  model: text('model'),                               // model used for this message
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// --- Provider API keys ---
export const providerKeys = sqliteTable('provider_keys', {
  provider: text('provider').primaryKey(),            // 'anthropic'|'openai'|'google'|'openrouter'|'ollama'
  apiKey: text('api_key'),                            // null = not configured
  baseUrl: text('base_url'),                          // for Ollama custom host
  status: text('status', { enum: ['unconfigured', 'configured', 'verified', 'failed'] }).notNull().default('unconfigured'),
  lastTestedAt: integer('last_tested_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// --- Relations ---
export const roomsRelations = relations(rooms, ({ many }) => ({
  roomAgents: many(roomAgents),
  messages: many(messages),
}));

export const roomAgentsRelations = relations(roomAgents, ({ one, many }) => ({
  room: one(rooms, { fields: [roomAgents.roomId], references: [rooms.id] }),
  sourceAgent: one(agents, { fields: [roomAgents.sourceAgentId], references: [agents.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(rooms, { fields: [messages.roomId], references: [rooms.id] }),
  roomAgent: one(roomAgents, { fields: [messages.roomAgentId], references: [roomAgents.id] }),
}));
```

### Pattern 2: Drizzle Database Singleton

**What:** A single db instance shared across all Next.js Route Handlers. In Next.js 16 App Router, server-side modules are singletons per process — export the instance once and import it everywhere.

```typescript
// src/db/index.ts
// Source: Drizzle ORM official docs (orm.drizzle.team/docs/get-started-sqlite)
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'agents-room.db');

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
```

### Pattern 3: LLM Gateway — Provider Factory Registry

**What:** A registry maps provider names to factory functions. Each factory accepts an API key (from the database) and returns a provider instance. The gateway exposes one `getModel(provider, model, apiKey)` function — no provider-specific code leaks into calling code.

```typescript
// src/lib/llm/providers.ts
// Source: ai-sdk.dev official provider docs
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';

export type ProviderName = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string; // Ollama custom host
}

export function getModel(
  provider: ProviderName,
  model: string,
  config: ProviderConfig
): LanguageModel {
  switch (provider) {
    case 'anthropic': {
      const p = createAnthropic({ apiKey: config.apiKey! });
      return p(model);
    }
    case 'openai': {
      const p = createOpenAI({ apiKey: config.apiKey! });
      return p(model);
    }
    case 'google': {
      const p = createGoogleGenerativeAI({ apiKey: config.apiKey! });
      return p(model);
    }
    case 'openrouter': {
      const p = createOpenRouter({ apiKey: config.apiKey! });
      return p.chat(model);
    }
    case 'ollama': {
      const p = createOllama({
        baseURL: config.baseUrl ?? 'http://localhost:11434/api',
      });
      return p(model);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

```typescript
// src/lib/llm/gateway.ts
// Source: ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
import { streamText, generateText } from 'ai';
import { getModel, type ProviderName, type ProviderConfig } from './providers';

export interface LLMRequest {
  provider: ProviderName;
  model: string;
  config: ProviderConfig;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  abortSignal?: AbortSignal;
}

// Streaming — for agent turns in conversation
export function streamLLM(request: LLMRequest) {
  const model = getModel(request.provider, request.model, request.config);
  return streamText({
    model,
    system: request.system,
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    abortSignal: request.abortSignal,
  });
}

// Non-streaming — for connection testing, quick verifications
export async function generateLLM(request: LLMRequest): Promise<string> {
  const model = getModel(request.provider, request.model, request.config);
  const result = await generateText({
    model,
    system: request.system,
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    abortSignal: request.abortSignal,
  });
  return result.text;
}
```

### Pattern 4: Provider Connection Test (Settings Page)

**What:** The "Test connection" button in provider cards calls a POST endpoint that runs a minimal generateText call and returns success/failure. Uses the API key stored in the database.

```typescript
// src/app/api/providers/[provider]/test/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { providerKeys } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateLLM } from '@/lib/llm/gateway';

export async function POST(
  req: Request,
  { params }: { params: { provider: string } }
) {
  const providerName = params.provider as any;
  const keyRow = await db.query.providerKeys.findFirst({
    where: eq(providerKeys.provider, providerName),
  });

  if (!keyRow?.apiKey && providerName !== 'ollama') {
    return NextResponse.json({ ok: false, error: 'No API key configured' }, { status: 400 });
  }

  try {
    const text = await generateLLM({
      provider: providerName,
      model: DEFAULT_TEST_MODELS[providerName],
      config: { apiKey: keyRow?.apiKey ?? undefined, baseUrl: keyRow?.baseUrl ?? undefined },
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    });
    // Update status to 'verified'
    await db.update(providerKeys)
      .set({ status: 'verified', lastTestedAt: new Date() })
      .where(eq(providerKeys.provider, providerName));
    return NextResponse.json({ ok: true, text });
  } catch (err: any) {
    await db.update(providerKeys)
      .set({ status: 'failed' })
      .where(eq(providerKeys.provider, providerName));
    return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
  }
}

const DEFAULT_TEST_MODELS: Record<string, string> = {
  anthropic: 'claude-3-haiku-20240307',
  openai: 'gpt-4o-mini',
  google: 'gemini-2.0-flash',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  ollama: 'llama3.2',
};
```

### Pattern 5: Drizzle Config and Migration Workflow

```typescript
// drizzle.config.ts (project root)
// Source: Drizzle ORM official docs (orm.drizzle.team/docs/kit-overview)
import { defineConfig } from 'drizzle-kit';
import path from 'path';

export default defineConfig({
  out: './src/db/migrations',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(process.cwd(), 'data', 'agents-room.db'),
  },
});
```

**Migration commands:**
```bash
# Generate SQL migration files from schema changes
npx drizzle-kit generate

# Apply pending migrations to the database
npx drizzle-kit migrate

# During development — push schema directly without generating files
npx drizzle-kit push

# Browse database in browser UI
npx drizzle-kit studio
```

**Recommendation for this project:** Use `drizzle-kit push` during active Phase 1 development. Switch to `generate` + `migrate` once schema stabilises or before shipping Phase 2 — migration files give an upgrade path for users who already have a database.

### Anti-Patterns to Avoid

- **FK-only room agents:** A room_agents table that is only a join (room_id, agent_id) with no copied columns cannot support per-room evolution — agents would be shared references. Always copy config columns at assignment time.
- **Env vars for API keys:** The user decision is explicit — keys come from the database, not environment variables. The gateway factories accept apiKey directly; never read from `process.env.ANTHROPIC_API_KEY`.
- **One textarea for system prompt:** The user decision is a structured form with four separate fields (role, personality, rules, constraints). Store them as separate database columns, not one JSON blob or one text column.
- **Global provider singletons:** Do not instantiate providers at module load time (you don't have the API keys yet). Always construct providers at call time with the key fetched from the database.
- **Single-column `system_prompt` in agents table:** Structured form fields must be separate columns for querying, templates, and partial updates.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-provider streaming normalization | Custom streaming logic per provider | `streamText` from `ai@6.x` | Each provider has different chunk formats, error shapes, and streaming protocols; the SDK handles all of it |
| Provider-specific retry/timeout logic | Retry wrappers per provider | AI SDK + AbortSignal | AbortController + abortSignal handles cancellation; SDK handles chunked response parsing |
| Database type safety | Raw SQL queries or custom query builder | Drizzle ORM | Without ORM, TypeScript has no knowledge of column types — insert/select bugs are invisible until runtime |
| Schema migrations | Manual SQL ALTER TABLE scripts | `drizzle-kit generate` + `migrate` | Manual migrations miss constraints, break rollback, and can't be reviewed as diffs |
| UI components (Input, Button, Select, Avatar, Badge) | Custom styled components | shadcn/ui + Radix UI | Accessibility (ARIA, keyboard nav) in form components is hundreds of lines of work per component |
| Client-side state for room + agent + UI | Multiple React Context providers | Zustand store | Context re-renders entire tree on any state change; Zustand's selector model isolates re-renders correctly |

**Key insight:** The LLM abstraction is the highest-value don't-hand-roll in this phase. Every provider has its own streaming protocol quirks, rate limit error shapes, and auth mechanisms. The AI SDK's provider adapters encapsulate all of it — without them, adding a second provider requires rewriting the first provider's streaming logic generically, which is the exact problem the SDK solves.

---

## Common Pitfalls

### Pitfall 1: SQLite Foreign Keys Not Enforced by Default

**What goes wrong:** Drizzle defines foreign key constraints in the schema, but SQLite does not enforce them unless explicitly enabled. Deleting a room does not cascade-delete its room_agents or messages rows.

**Why it happens:** SQLite's default is `PRAGMA foreign_keys = OFF` for backwards compatibility.

**How to avoid:** Enable in the database connection setup: `sqlite.pragma('foreign_keys = ON')`. Do this before any queries. The db/index.ts singleton is the right place.

**Warning signs:** Deleting a room leaves orphaned room_agents rows in the database (check via Drizzle Studio).

### Pitfall 2: Provider API Keys Read from Env Vars by AI SDK Default

**What goes wrong:** The AI SDK providers (createAnthropic, etc.) fall back to environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) if no apiKey is passed. In development, if these env vars happen to be set, tests appear to pass even when the database-key flow is broken.

**Why it happens:** The SDK's fallback behavior is a convenience feature for standard use cases; this project explicitly bypasses it.

**How to avoid:** Always pass `apiKey` explicitly from the database. In the gateway, assert that `config.apiKey` is non-null before calling the factory (except Ollama, which is keyless). Add an integration test that verifies connection fails when an invalid key is provided (proving it's not falling back to env vars).

**Warning signs:** Provider test succeeds even after clearing the key from the settings page.

### Pitfall 3: Next.js Route Handler Caching Interferes with Dynamic DB Reads

**What goes wrong:** Next.js 16 App Router Route Handlers that do GET requests may be cached by default, causing stale room or agent lists to be served.

**Why it happens:** Next.js 16 introduced fetch-level caching that can cache Route Handlers in some configurations.

**How to avoid:** Export `export const dynamic = 'force-dynamic'` or use `{ cache: 'no-store' }` on fetch calls in route handlers that read from the database. For this app, all data reads should be dynamic.

**Warning signs:** Creating a room and immediately listing rooms returns the old list.

### Pitfall 4: Room Creation Wizard State Lost on Navigation

**What goes wrong:** Multi-step wizard (name → agents → topic → done) uses local component state. If the user navigates away or the browser refreshes between steps, wizard state is lost.

**Why it happens:** Component state is in-memory only.

**How to avoid:** Store wizard-in-progress state in Zustand (persisted to localStorage or sessionStorage is optional for a personal tool). Alternatively, use URL search params for each step so the wizard is bookmark-able and browser-back works.

**Warning signs:** User completes step 1, adds agents in step 2, navigates back, and the agent selection is gone.

### Pitfall 5: Copy-on-Assign Executed Incorrectly

**What goes wrong:** Instead of copying all config columns from the library agent into room_agents, only the agent ID is stored as a foreign key. Per-room evolution becomes impossible.

**Why it happens:** "Adding an agent to a room" sounds like a join operation, not a data copy.

**How to avoid:** When the user assigns an agent from the library to a room, the POST /rooms/:roomId/agents handler must:
1. Fetch the library agent row
2. INSERT into room_agents with all config columns copied from the library agent
3. Set sourceAgentId = library agent's id (for traceability only — not for lookups)

**Warning signs:** Editing the library agent's system prompt changes how agents behave in existing rooms.

### Pitfall 6: SQLite `INTEGER` vs `TEXT` for Timestamps

**What goes wrong:** Timestamps stored as raw Unix integers are not automatically converted to JavaScript Date objects when queried.

**Why it happens:** Drizzle's `integer('col', { mode: 'timestamp' })` stores Unix epoch seconds and converts automatically. If you use `integer('col')` without mode, you get raw numbers back.

**How to avoid:** Always use `{ mode: 'timestamp' }` for all timestamp columns. Check the schema definition before writing any queries.

**Warning signs:** `room.createdAt` is a number instead of a Date object.

---

## Code Examples

Verified patterns from official sources:

### Database Connection with WAL + FK
```typescript
// Source: orm.drizzle.team/docs/get-started-sqlite
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('data/agents-room.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
export const db = drizzle(sqlite, { schema });
```

### Insert a Room
```typescript
// Source: drizzle-orm official docs
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { nanoid } from 'nanoid';

const newRoom = await db.insert(rooms).values({
  id: nanoid(),
  name: 'Strategy Debate',
  topic: 'Should we rewrite the frontend in SolidJS?',
}).returning();
```

### Query Rooms with Agent Count
```typescript
// Source: drizzle-orm official docs
import { db } from '@/db';
import { rooms, roomAgents } from '@/db/schema';
import { count } from 'drizzle-orm';

const roomList = await db
  .select({
    id: rooms.id,
    name: rooms.name,
    topic: rooms.topic,
    status: rooms.status,
    lastActivityAt: rooms.lastActivityAt,
    agentCount: count(roomAgents.id),
  })
  .from(rooms)
  .leftJoin(roomAgents, eq(roomAgents.roomId, rooms.id))
  .groupBy(rooms.id)
  .orderBy(desc(rooms.lastActivityAt));
```

### Copy Agent to Room
```typescript
import { db } from '@/db';
import { agents, roomAgents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function addAgentToRoom(roomId: string, agentId: string) {
  const source = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });
  if (!source) throw new Error('Agent not found');

  return db.insert(roomAgents).values({
    id: nanoid(),
    roomId,
    sourceAgentId: source.id,
    // Copy all config columns from library agent
    name: source.name,
    avatarColor: source.avatarColor,
    avatarIcon: source.avatarIcon,
    promptRole: source.promptRole,
    promptPersonality: source.promptPersonality,
    promptRules: source.promptRules,
    promptConstraints: source.promptConstraints,
    provider: source.provider,
    model: source.model,
    temperature: source.temperature,
  }).returning();
}
```

### Streaming with AbortController
```typescript
// Source: ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
import { streamText } from 'ai';
import { getModel } from '@/lib/llm/providers';

const controller = new AbortController();

const result = streamText({
  model: getModel('anthropic', 'claude-3-haiku-20240307', { apiKey: 'sk-...' }),
  system: 'You are a skeptical Devil\'s Advocate.',
  messages: [{ role: 'user', content: 'What do you think about this plan?' }],
  temperature: 0.8,
  abortSignal: controller.signal,
});

// Stream tokens
for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}

// Get full text after stream completes
const fullText = await result.text;

// Cancel mid-stream
controller.abort();
```

### Provider Card Status Logic (Settings Page)
```typescript
// Status determination for provider cards
type ProviderStatus = 'unconfigured' | 'configured' | 'verified' | 'failed';

function getStatusColor(status: ProviderStatus): string {
  switch (status) {
    case 'verified': return 'text-green-500';
    case 'configured': return 'text-yellow-500';
    case 'failed': return 'text-red-500';
    case 'unconfigured': return 'text-gray-400';
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate streaming logic per provider (raw SDK) | Unified `streamText()` across all providers (AI SDK v6) | AI SDK v6 (Dec 2025) | One-line provider swap; no per-provider chunking code |
| Prisma with code generation step | Drizzle (no codegen, TypeScript-first schema) | Drizzle 0.40+ (2025) | Schema changes reflected immediately in TypeScript types |
| ESLint + Prettier dual config | Biome (single tool) | Biome stable 2024-2025 | Zero config, 50-100x faster |
| `moment.js` | `date-fns` | 2020-2022 | Smaller bundle, tree-shakeable |
| SQLite with ORM-defined FK that SQLite ignores | SQLite + `PRAGMA foreign_keys = ON` | Always needed, often missed | Cascades actually work |

**Deprecated/outdated for this project:**
- `@anthropic-ai/sdk` direct use: Still valid but bypasses AI SDK's streaming normalization — do not use raw.
- `openai` npm package direct use: Same issue — use `@ai-sdk/openai` instead.
- `@google/genai` direct use: Use `@ai-sdk/google` instead.
- `drizzle-kit push` in production: Push doesn't generate migration files. Use generate + migrate for production-like environments.

---

## Open Questions

1. **API key encryption at rest**
   - What we know: Keys are stored in SQLite, it's a single-user personal tool, no network exposure unless explicitly deployed.
   - What's unclear: Whether plain text in SQLite is acceptable or if we should encrypt. AES-256 with a machine-local key derived from `os.hostname()` or a local `.key` file are the standard approaches.
   - Recommendation: Plain text is acceptable for initial implementation. Document the decision. If the user later deploys to a server, add encryption as a migration. Do not over-engineer for a personal local tool.

2. **Ollama base URL configuration**
   - What we know: Ollama defaults to `http://localhost:11434`. The `baseUrl` column in `provider_keys` stores overrides.
   - What's unclear: Should the settings page show a "Custom host" field only for Ollama, or make base URL configurable for all providers?
   - Recommendation: Show the custom host field only for Ollama — other providers use fixed HTTPS endpoints. OpenRouter does not need a custom URL.

3. **Agent preset templates data**
   - What we know: Three built-in presets are planned: "Devil's Advocate", "Code Reviewer", "Researcher".
   - What's unclear: Exact system prompt content for each field (role, personality, rules, constraints).
   - Recommendation: Define these in a static `AgentPresets.ts` file — not in the database. Presets are code-level constants, not user data. User can customize after one-click creation.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` — create in Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROOM-01 | Create room, persists to DB | unit (db) | `npx vitest run tests/db/rooms.test.ts -t "create room"` | Wave 0 |
| ROOM-02 | List all rooms with status | unit (db) | `npx vitest run tests/db/rooms.test.ts -t "list rooms"` | Wave 0 |
| ROOM-03 | Delete room cascades to room_agents + messages | unit (db) | `npx vitest run tests/db/rooms.test.ts -t "delete room"` | Wave 0 |
| ROOM-04 | Fetch room with empty message list | unit (db) | `npx vitest run tests/db/rooms.test.ts -t "room conversation history"` | Wave 0 |
| AGNT-01 | Create agent with all structured prompt fields | unit (db) | `npx vitest run tests/db/agents.test.ts -t "create agent"` | Wave 0 |
| AGNT-02 | LLM gateway streams from all 5 providers | integration (live API) | `npx vitest run tests/llm/gateway.test.ts` (requires keys) | Wave 0 |
| AGNT-03 | Add agent to room copies all columns; remove deletes row | unit (db) | `npx vitest run tests/db/roomAgents.test.ts` | Wave 0 |

**Note on AGNT-02:** This test requires real API keys and network access. It should be skipped in CI. Gate it with `process.env.RUN_INTEGRATION_TESTS === 'true'`.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/db/` (unit tests only, ~5s)
- **Per wave merge:** `npx vitest run` (all unit tests)
- **Phase gate:** Full suite + manual provider test via settings page before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/db/rooms.test.ts` — covers ROOM-01 through ROOM-04
- [ ] `tests/db/agents.test.ts` — covers AGNT-01
- [ ] `tests/db/roomAgents.test.ts` — covers AGNT-03
- [ ] `tests/llm/gateway.test.ts` — covers AGNT-02 (integration, skipped without keys)
- [ ] `tests/setup.ts` — shared in-memory SQLite fixture (use `:memory:` DB for unit tests)
- [ ] `vitest.config.ts` — framework config
- [ ] `data/` directory — create for SQLite file: `mkdir -p data && echo "data/*.db" >> .gitignore`
- [ ] Framework install: included in standard stack above

---

## Sources

### Primary (HIGH confidence)
- `https://orm.drizzle.team/docs/get-started-sqlite` — Drizzle ORM better-sqlite3 setup, schema patterns, foreign keys, relations
- `https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text` — streamText API, AbortSignal/abort, textStream iteration
- `https://ai-sdk.dev/providers/ai-sdk-providers/anthropic` — createAnthropic factory, apiKey parameter
- `https://ai-sdk.dev/providers/ai-sdk-providers/openai` — createOpenAI factory
- `https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai` — createGoogleGenerativeAI factory, Gemini model names
- `https://ai-sdk.dev/providers/community-providers/openrouter` — createOpenRouter, openrouter.chat() pattern
- `https://ai-sdk.dev/providers/community-providers/ollama` — createOllama, baseURL configuration
- `https://orm.drizzle.team/docs/kit-overview` — drizzle-kit generate + migrate + push commands
- `https://ui.shadcn.com/docs/installation/next` — shadcn/ui Next.js installation
- npm registry — all package versions verified 2026-03-19
- `.planning/research/STACK.md` — project stack decisions (Next.js 16, Drizzle, AI SDK v6)
- `.planning/research/ARCHITECTURE.md` — layered monolith, LLM gateway pattern, build order
- `.planning/phases/01-foundation/01-CONTEXT.md` — locked user decisions

### Secondary (MEDIUM confidence)
- `https://github.com/OpenRouterTeam/ai-sdk-provider` — OpenRouter provider for AI SDK, version 2.3.3
- `https://github.com/sgomez/ollama-ai-provider` — Ollama community provider
- `https://betterstack.com/community/guides/scaling-nodejs/drizzle-orm/` — Drizzle ORM patterns with better-sqlite3

### Tertiary (LOW confidence — verify during implementation)
- WebSearch synthesis: Ollama provider package name (`ollama-ai-provider-v2`) — verify this is the canonical community provider vs alternatives

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified against npm registry 2026-03-19; provider factory APIs verified against official ai-sdk.dev docs
- Architecture (schema): HIGH — Drizzle foreign key and relations patterns verified against official docs; copy-on-assign design is derived from locked user decisions
- Architecture (LLM gateway): HIGH — all 5 provider factories verified against official and community provider docs
- Pitfalls: HIGH — SQLite FK pragma is documented behavior; Next.js caching is documented; AI SDK env var fallback is documented provider behavior

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — stack is stable)
