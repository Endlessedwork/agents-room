# Architecture Research

**Domain:** Agent management features for multi-agent conversation app (v1.2)
**Researched:** 2026-03-21
**Confidence:** HIGH (derived from direct codebase inspection of all relevant modules)

## Existing Architecture Baseline (v1.1)

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (React)                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  AgentsPage / AgentForm / AgentCard (create only, no edit)  │ │
│  │  SettingsPage  (owns provider CRUD via local useState)       │ │
│  │  Zustand: agentStore, roomStore, chatStore                   │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────┘
                              │ HTTP
┌─────────────────────────────┼────────────────────────────────────┐
│                   Next.js 16 API Layer                           │
│  GET/POST  /api/agents                                           │
│  GET/PUT/DELETE /api/agents/[id]   ← PUT already implemented     │
│  GET       /api/providers          ← returns all 5 providers     │
│  PUT       /api/providers/[p]      ← upsert key + baseUrl        │
│  POST      /api/providers/[p]/test ← calls generateLLM to verify │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│            lib/llm/ — LLM Gateway                                │
│  providers.ts: createAnthropic | createOpenAI | createGoogle     │
│               createOpenRouter | createOllama                    │
│  gateway.ts: streamLLM(), generateLLM()                          │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                   SQLite (WAL) via Drizzle                       │
│  agents | rooms | roomAgents | messages | providerKeys           │
│  agents.presetId already exists (nullable text FK)               │
│  agents.notes  — NOT YET in schema, needs migration              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Integration Architecture for v1.2 Features

### What Already Exists vs What is New

**Critical finding:** `PUT /api/agents/[agentId]` and `updateAgentSchema` are already implemented and deployed. The edit API layer requires zero new work. The gap is entirely in the UI.

| Feature | API Layer | Store | UI |
|---------|-----------|-------|-----|
| Agent editing | DONE (PUT route exists) | Missing updateAgent action | Missing edit page + AgentCard edit button |
| Model picker | NEW route needed | NEW model cache | NEW combobox replacing text input |
| Agent presets CRUD | Not needed (stay static) | No change | Minor: presets are already rendered |
| Providers page | DONE (routes exist) | NEW providerStore | NEW /providers page, move from SettingsPage |
| Agent notes | Schema migration needed | updateAgent handles it | New notes textarea in AgentForm |

---

## System Changes for Each Feature

### 1. Agent Editing

**Entry point:** AgentCard gains an Edit button linking to `/agents/[agentId]/edit`.

**New route:** `src/app/(dashboard)/agents/[agentId]/edit/page.tsx` — server component that fetches the agent, renders AgentForm with `initialData` prop.

**AgentForm changes:** Accepts `initialData?: Agent | null`. When set, submit calls `PUT /api/agents/[id]` instead of `POST /api/agents`. After save, calls `agentStore.updateAgent(updated)` and navigates back to `/agents`.

**agentStore changes:** Add `updateAgent(agent: Agent)` action. Patches the agents array by id. Mirrors the existing `deleteAgent` pattern exactly.

**Data flow:**
```
User clicks "Edit" on AgentCard
  → navigate to /agents/[agentId]/edit
  → page server-fetches agent via db.query.agents.findFirst
  → AgentForm rendered with initialData
  → User edits fields
  → Submit: PUT /api/agents/[id] (validated by updateAgentSchema.partial())
  → Response: updated Agent row
  → agentStore.updateAgent(updated)
  → router.push('/agents')
```

**Copy-on-assign isolation:** Editing a library agent does NOT change existing roomAgents rows. No special handling needed — this is by design. The UI should state: "Changes apply to new room assignments only."

**New vs Modified:**
- NEW: `src/app/(dashboard)/agents/[agentId]/edit/page.tsx`
- MODIFIED: `src/components/agents/AgentForm.tsx` — add initialData prop, dual POST/PUT submit path
- MODIFIED: `src/components/agents/AgentCard.tsx` — add Edit button
- MODIFIED: `src/stores/agentStore.ts` — add updateAgent action

---

### 2. Model Picker

**Problem:** AgentForm has a free-text Input for model. Users must know model names exactly. Model picker fetches available models from the selected provider and shows a combobox.

**New API route:** `GET /api/providers/[provider]/models`

**New module:** `src/lib/llm/model-fetcher.ts` — normalizes per-provider model listing to `string[]`.

**Provider API behavior per provider:**

| Provider | Model enumeration | Implementation |
|----------|-------------------|----------------|
| Anthropic | No public /models endpoint | Static curated list (hardcoded in model-fetcher.ts) |
| OpenAI | `GET /v1/models` — filter to chat completions | Live API call |
| Google | No simple enumerate endpoint | Static curated list |
| OpenRouter | `GET /api/v1/models` | Live API call |
| Ollama | `GET {baseUrl}/api/tags` — local installed models | Live API call, no key needed |

**New Zustand store:** `src/stores/providerStore.ts`

```typescript
interface ProviderStore {
  providers: ProviderData[];           // from GET /api/providers
  models: Partial<Record<ProviderName, string[]>>;  // session cache
  loading: Record<ProviderName, boolean>;
  fetchProviders: () => Promise<void>;
  fetchModels: (provider: ProviderName) => Promise<void>;
  updateStatus: (provider: string, status: ProviderStatus) => void;
}
```

The models cache is session-scoped (in-memory Zustand). Re-fetches on page reload are acceptable — models don't change during a session.

**AgentForm integration:**
- On provider change, call `providerStore.fetchModels(provider)` if not cached
- Replace free-text Input with a Select/Combobox populated from `providerStore.models[provider]`
- Fallback: if models unavailable (no key configured, fetch failed), show free-text Input with a warning message
- Loading state: show "Loading models..." in picker while fetch is in flight

**Data flow:**
```
User selects "openai" in provider dropdown
  → AgentForm calls providerStore.fetchModels('openai')
  → If cached: picker populates immediately
  → If not cached:
      → GET /api/providers/openai/models
      → model-fetcher.ts reads apiKey from providerKeys DB table
      → Calls OpenAI /v1/models, filters to gpt-* chat models
      → Returns string[]
      → providerStore.models['openai'] = result
      → picker populates
  → If fetch fails (no key): show text input + "Configure OpenAI key to browse models"
```

**New vs Modified:**
- NEW: `src/app/api/providers/[provider]/models/route.ts`
- NEW: `src/lib/llm/model-fetcher.ts`
- NEW: `src/stores/providerStore.ts`
- MODIFIED: `src/components/agents/AgentForm.tsx` — replace model Input with combobox/select backed by providerStore

---

### 3. Agent Presets CRUD

**Finding:** The existing implementation already satisfies the spirit of this requirement. AGENT_PRESETS is a static array of 3 templates. The `presetId` column in `agents` tracks which preset an agent was created from. AgentCard shows the preset name badge.

**CRUD in practice means:**
- CREATE preset-origin agent: already works via "Use Template" → `/agents/new?preset=X`
- READ presets: already shown as template cards on `/agents`
- UPDATE a preset-origin agent: satisfied by agent editing (feature 1)
- DELETE a preset-origin agent: already works via AgentCard delete button

**No new DB table, no new API routes, no new store actions are required** under this interpretation. If the requirement means "user-created preset templates with full CRUD," that is out of scope for this milestone — it requires a new `presets` table, migration, API routes, and store, adding significant complexity.

**Recommendation:** Interpret as managing agents-from-presets (the narrower reading). The only possible addition is a note on AgentCard identifying preset origin, which already exists via `presetId` badge.

---

### 4. Dedicated Providers Page

**Current state:** `SettingsPage` at `/settings` owns provider CRUD via local `useState`. 71 lines. No Zustand. Component is `ProviderCard` (unchanged).

**Target state:** New `/providers` page backed by `providerStore`. SettingsPage either redirects to `/providers` or becomes a stub with a link. Sidebar gains a "Providers" nav link.

**Migration:** ProviderCard.tsx requires zero changes — it takes `provider`, `status`, `hasKey`, `baseUrl`, and callbacks as props. The page just switches from local useState to `providerStore`.

**Why a separate Zustand store:** AgentForm's model picker needs provider status (is this provider configured?) and the model cache. Putting provider state in Zustand allows AgentForm to read it without prop threading through any shared layout.

**Sidebar change:** Add `<Link href="/providers">` with an appropriate icon (e.g., `Key` from lucide-react). The current `Settings` link either stays pointing to `/settings` as a stub or is renamed to "Providers."

**Data flow:**
```
ProvidersPage mounts
  → providerStore.fetchProviders() (GET /api/providers)
  → Renders ProviderCard per provider (same as SettingsPage today)
  → User saves key: PUT /api/providers/[p]
  → ProviderCard calls onStatusChange callback
  → providerStore.updateStatus(provider, 'configured')
```

**New vs Modified:**
- NEW: `src/app/(dashboard)/providers/page.tsx`
- NEW: `src/stores/providerStore.ts` (also serves model picker above)
- MODIFIED: `src/components/layout/Sidebar.tsx` — add Providers link
- MODIFIED: `src/app/(dashboard)/settings/page.tsx` — redirect or link to /providers

---

### 5. Agent Notes

**What:** A free-text "notes" field on Agent for describing purpose, strengths, intended use cases. Visible in AgentCard, editable in AgentForm.

**Schema change:** Add `notes: text('notes')` (nullable) to `agents` table in `schema.ts`. No change to `roomAgents` — notes are a library-only concept.

**Migration:** `npx drizzle-kit push` (project uses push not migrate — no migrations/ directory exists).

**Validation:** Add `notes: z.string().max(2000).nullable().optional()` to both `createAgentSchema` and `updateAgentSchema` in `validations.ts`.

**agentStore:** Add `notes: string | null` to `Agent` type.

**AgentForm:** One new Textarea for notes, below constraints field.

**AgentCard:** Render notes text below the promptRole preview if present (line-clamp-2 with muted style).

**New vs Modified:**
- MODIFIED: `src/db/schema.ts` — add notes column
- MODIFIED: `src/lib/validations.ts` — add notes to both schemas
- MODIFIED: `src/stores/agentStore.ts` — add notes to Agent type
- MODIFIED: `src/components/agents/AgentForm.tsx` — add notes textarea
- MODIFIED: `src/components/agents/AgentCard.tsx` — render notes preview

---

## Recommended Project Structure — v1.2 Additions

```
src/
├── app/(dashboard)/
│   ├── agents/
│   │   ├── page.tsx                    # Unchanged
│   │   ├── new/page.tsx                # Unchanged
│   │   └── [agentId]/
│   │       └── edit/page.tsx           # NEW — loads agent, renders AgentForm(initialData)
│   ├── providers/
│   │   └── page.tsx                    # NEW — ProviderCard grid backed by providerStore
│   └── settings/
│       └── page.tsx                    # MODIFIED — redirect or stub pointing to /providers
├── app/api/
│   └── providers/
│       └── [provider]/
│           └── models/
│               └── route.ts            # NEW — GET model list from provider
├── components/
│   ├── agents/
│   │   ├── AgentForm.tsx               # MODIFIED — initialData prop, notes textarea, model combobox
│   │   ├── AgentCard.tsx               # MODIFIED — Edit button, notes preview
│   │   └── AgentPresets.ts             # UNCHANGED
│   └── layout/
│       └── Sidebar.tsx                 # MODIFIED — add Providers link
├── lib/
│   └── llm/
│       └── model-fetcher.ts            # NEW — per-provider model list, normalizes to string[]
└── stores/
    ├── agentStore.ts                   # MODIFIED — updateAgent action, notes in Agent type
    └── providerStore.ts                # NEW — providers list + model cache
```

---

## Component Boundary Map — Complete Reference

| Component | Status | Change Summary |
|-----------|--------|----------------|
| `src/app/(dashboard)/agents/[agentId]/edit/page.tsx` | NEW | Fetch agent, render AgentForm in edit mode |
| `src/app/(dashboard)/providers/page.tsx` | NEW | Dedicated provider management page |
| `src/app/api/providers/[provider]/models/route.ts` | NEW | Model list endpoint |
| `src/lib/llm/model-fetcher.ts` | NEW | Provider-specific model enumeration |
| `src/stores/providerStore.ts` | NEW | Provider state + model cache for Zustand |
| `src/components/agents/AgentForm.tsx` | MODIFIED | initialData, notes field, model combobox |
| `src/components/agents/AgentCard.tsx` | MODIFIED | Edit button, notes preview |
| `src/stores/agentStore.ts` | MODIFIED | updateAgent action, notes in Agent type |
| `src/db/schema.ts` | MODIFIED | notes column on agents table |
| `src/lib/validations.ts` | MODIFIED | notes field in createAgent/updateAgent schemas |
| `src/components/layout/Sidebar.tsx` | MODIFIED | Providers nav link |
| `src/app/(dashboard)/settings/page.tsx` | MODIFIED | Redirect or stub |
| `src/components/settings/ProviderCard.tsx` | UNCHANGED | Reused on /providers page |
| `src/components/agents/AgentPresets.ts` | UNCHANGED | Static templates remain static |
| All conversation layer files | UNCHANGED | v1.2 is UI/data only — no turn loop changes |
| All SSE files | UNCHANGED | — |
| All room API routes | UNCHANGED | — |

---

## Data Flow Changes Summary

### Agent Edit Data Flow

```
AgentCard "Edit" → /agents/[id]/edit
  → page: db.query.agents.findFirst(id) → initialData
  → AgentForm(initialData)
  → submit: PUT /api/agents/[id]
  → agentStore.updateAgent(result)
  → router.push('/agents')
```

### Model Picker Data Flow

```
AgentForm: provider changes to "openai"
  → providerStore.fetchModels('openai')
  → if cached → populate Select immediately
  → else → GET /api/providers/openai/models
       → model-fetcher.ts → OpenAI /v1/models → filter → string[]
       → cache in providerStore
       → populate Select
  → if error → show free-text input fallback
```

### Provider State Sharing

```
providerStore (Zustand)
  → ProvidersPage subscribes (status display, save, test)
  → AgentForm subscribes (model cache only)
  → Single fetchProviders() call shared across both consumers
```

---

## Build Order Recommendation

Dependencies drive the sequence. Each step is independently shippable.

**Step 1: Schema + validation + agentStore.updateAgent**
Zero UI impact. Foundation for editing and notes. Run `npx drizzle-kit push` after schema change. Validate updateAgent works against existing PUT route before any UI work.

**Step 2: Agent notes field**
Additive. One column, one textarea. Add to AgentForm (create mode), AgentCard preview. Trivial surface area.

**Step 3: Agent editing (UI)**
Depends on Step 1 (updateAgent in store). Create edit page, modify AgentForm for dual mode, add Edit button to AgentCard. The hardest part is AgentForm dual-mode logic — verify the edit round-trip end-to-end before moving on.

**Step 4: Providers page + providerStore**
Independent of editing features. Extract SettingsPage state into providerStore, create /providers page, update Sidebar. ProviderCard is reused unchanged. Update Settings page.

**Step 5: model-fetcher.ts + models API route**
Depends on Step 4 (providerStore exists and has fetchProviders). Build model-fetcher.ts, wire the API route, test per provider. Anthropic and Google use static lists — code them first, then add live OpenAI/OpenRouter/Ollama calls.

**Step 6: Model picker UI**
Depends on Steps 4+5 (providerStore with models cache). Replace free-text model Input in AgentForm with combobox. Wire loading state and fallback.

**Step 7: Presets CRUD (if required beyond what exists)**
If confirmed to mean "user-managed preset templates," scope to a separate planning session — it adds a new DB table and is not blocked by any other v1.2 feature. If confirmed as "manage preset-origin agents," it is already complete after Step 3.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Re-implementing the PUT route

**What:** Writing a new handler or new route when PUT /api/agents/[agentId] already exists and validates via updateAgentSchema.
**Why wrong:** Duplicate code, divergent validation, wasted effort.
**Do this instead:** The edit form submits to the existing PUT route. No API changes needed for agent editing.

### Anti-Pattern 2: Model fetch on every AgentForm mount

**What:** Fetching models for the current provider every time AgentForm renders.
**Why wrong:** Adds latency on form open, makes redundant network calls if the provider hasn't changed.
**Do this instead:** Check providerStore.models[provider] cache first. Fetch only on cache miss (new provider selected or first load for that provider).

### Anti-Pattern 3: Keeping provider state in SettingsPage local state

**What:** Building the ProvidersPage with its own useState/useEffect, like SettingsPage does now.
**Why wrong:** AgentForm's model picker cannot access local state in ProvidersPage. Two separate fetches of the same data.
**Do this instead:** providerStore in Zustand. One shared fetch, one shared cache, two consumers.

### Anti-Pattern 4: Adding notes to roomAgents table

**What:** Copying the notes column to roomAgents when implementing copy-on-assign.
**Why wrong:** Notes are a user annotation on the library agent, not a behavioral property. Room agents don't benefit from notes — the conversation engine ignores them.
**Do this instead:** notes column on agents only. Copy-on-assign continues to copy only the fields that affect agent behavior (prompts, model, temperature, avatar).

### Anti-Pattern 5: DB-backed presets as a v1.2 scope item

**What:** Building a presets table, presets API routes, and presets management UI in v1.2.
**Why wrong:** Adds 2-3 additional phases of work for marginal user value — the 3 static presets cover 90% of use cases.
**Do this instead:** Confirm with the project owner that "presets CRUD" means edit/delete of preset-origin agents (already handled by agent editing). Defer DB-backed preset templates to v1.3 or later if needed.

---

## Sources

- Direct codebase inspection: `src/db/schema.ts`, `src/lib/validations.ts`, `src/stores/agentStore.ts`
- Direct codebase inspection: `src/app/api/agents/[agentId]/route.ts` (PUT already exists)
- Direct codebase inspection: `src/app/api/providers/route.ts`, `src/app/api/providers/[provider]/route.ts`
- Direct codebase inspection: `src/components/agents/AgentForm.tsx`, `AgentCard.tsx`, `AgentPresets.ts`
- Direct codebase inspection: `src/app/(dashboard)/settings/page.tsx`, `src/components/layout/Sidebar.tsx`
- Provider API knowledge: Anthropic (no public /models enumerate), OpenAI (/v1/models exists), Google (no simple enumerate), OpenRouter (/api/v1/models), Ollama (/api/tags) — training data, MEDIUM confidence
- Project context: `.planning/PROJECT.md` (v1.2 feature list)

---

*Architecture research for: Agents Room v1.2 — Agent Management*
*Researched: 2026-03-21*
