# Stack Research

**Domain:** Agent management features — editing, model picker, presets CRUD, providers page, agent notes
**Researched:** 2026-03-21
**Confidence:** HIGH

---

## Context: Subsequent Milestone (v1.2)

This is a research update for a subsequent milestone. The following are already validated and must NOT be re-researched or changed:

| Already Present | Version | Status |
|-----------------|---------|--------|
| Next.js | `^16.2.0` | Validated |
| Vercel AI SDK (`ai`) | `^6.0.116` | Validated |
| `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` | `^3.x` | Validated |
| `ollama-ai-provider-v2`, `@openrouter/ai-sdk-provider` | latest | Validated |
| Drizzle ORM + `better-sqlite3` + `drizzle-kit` | `^0.45.1` / `^0.31.10` | Validated |
| `llm-info` | `^1.0.69` | Validated |
| Zustand, Tailwind v4, Base UI (`@base-ui/react`), Biome, Vitest | — | Validated |
| `zod`, `nanoid`, `date-fns`, `lucide-react`, `clsx`, `tailwind-merge` | — | Validated |

---

## New Dependencies Required for v1.2

**None.** All five v1.2 features can be implemented with the existing stack. No new npm packages should be installed.

---

## Recommended Stack for New Features

### Core Technologies

| Technology | Already Present | New Usage in v1.2 | Why Sufficient |
|------------|-----------------|-------------------|----------------|
| Drizzle ORM + SQLite | Yes | New `notes` column on `agents`; new `presets` table | `ALTER TABLE ADD COLUMN` + `CREATE TABLE` — standard Drizzle migrations |
| Next.js API Routes | Yes | New routes: `/api/providers/[provider]/models`, `/api/presets`, `/api/presets/[presetId]` | Same pattern as existing `/api/agents` and `/api/providers` routes |
| Native `fetch` (Node.js) | Yes (implicit) | Call provider model-listing REST APIs server-side | No HTTP client library needed — Node.js 18+ has native fetch |
| `llm-info` | Yes | `getAllModelsWithIds()` as static fallback for Anthropic/OpenAI/Google when live API unavailable | Already installed; provides 44 models across 5 providers |
| Zod | Yes | Extend schemas for `notes` field; new `createPresetSchema` | Same validation pattern already in `src/lib/validations.ts` |
| Base UI Select + Dialog + Textarea | Yes | Model picker dropdown, edit UI, notes input | All components exist in `src/components/ui/` |

---

## Feature-Specific Implementation Notes

### Feature 1: Agent Editing

**Backend status:** Complete. `PUT /api/agents/[agentId]` already exists with `updateAgentSchema` validation. The route correctly updates and returns the modified agent.

**What is missing:** UI only. The agents list page has no edit trigger. The existing `AgentForm` component and all validation already support edit — it needs only a new page or dialog wired to the existing PUT route.

**Recommended approach:** Add `/agents/[agentId]/edit` page that fetches the agent by ID (via `GET /api/agents/[agentId]`) and renders `AgentForm` pre-populated. Same pattern as the existing `/agents/new` page.

**No new dependencies.**

---

### Feature 2: Model Picker Dropdown

This is the only feature requiring new server-side logic. All five providers expose a model-listing REST endpoint.

#### Provider Model API Summary

| Provider | Endpoint | Auth Method | Response Shape |
|----------|----------|-------------|----------------|
| Anthropic | `GET https://api.anthropic.com/v1/models` | Header: `X-Api-Key: <key>` + `anthropic-version: 2023-06-01` | `{ data: [{ id, display_name, ... }] }` |
| OpenAI | `GET https://api.openai.com/v1/models` | Header: `Authorization: Bearer <key>` | `{ data: [{ id, object, ... }] }` |
| Google | `GET https://generativelanguage.googleapis.com/v1beta/models?key=<key>` | Query param `key` | `{ models: [{ name, displayName, ... }] }` |
| OpenRouter | `GET https://openrouter.ai/api/v1/models` | Header: `Authorization: Bearer <key>` | `{ data: [{ id, name, ... }] }` |
| Ollama | `GET {baseUrl}/api/tags` | None (local service) | `{ models: [{ name, model, ... }] }` |

All endpoints verified against official documentation (sources below). HIGH confidence.

#### Architecture Decision: Server-Side Proxy Route

Implement `GET /api/providers/[provider]/models` in Next.js that:
1. Reads the provider's API key and baseUrl from the `providerKeys` SQLite table (same DB lookup pattern as existing routes)
2. Calls the upstream endpoint with native `fetch`
3. Returns normalized `{ models: Array<{ id: string; name: string }> }`
4. Returns `{ models: [], error: "Provider not configured" }` gracefully when unconfigured

**Why server-side proxy:** The API key must never be sent to the browser. The client-side model picker calls `/api/providers/[provider]/models` which reads the key from the DB and proxies upstream. This matches the existing security model for provider keys.

**Why NOT the Vercel AI SDK for model listing:** The `ai` package and provider SDK wrappers (`@ai-sdk/anthropic`, etc.) are inference-only — they wrap `streamText`/`generateText` and do not expose model-discovery APIs. Direct `fetch` is the correct tool.

#### `llm-info` as Static Fallback

`llm-info`'s `getAllModelsWithIds()` returns 44 models with a `provider` field covering `openai`, `anthropic`, `google`, `deepseek`, and `xai`. It has **no models for `openrouter` or `ollama`** (verified by direct runtime inspection of `node_modules/llm-info/dist/index.js`).

Use this as a fallback only when: the API call fails OR the provider key is unconfigured. Do not use as the primary source — provider APIs are authoritative and more current.

#### OpenRouter Scale Note

OpenRouter lists 400+ models. For the model picker UI, the existing Base UI Select populates a dropdown from a `useEffect` fetch. This is functional but may be slow to scroll. A searchable combobox would be better UX for OpenRouter specifically but is a UX enhancement, not a correctness requirement. Implement plain `<select>` first.

**No new npm packages.**

---

### Feature 3: Agent Presets CRUD

**Current state:** Presets are hardcoded in `src/components/agents/AgentPresets.ts` as a TypeScript constant array `AGENT_PRESETS`. The `agents.preset_id` column already exists in the schema but only stores a string reference to these hardcoded IDs.

**Decision: Persist presets to SQLite.** "CRUD" requires persistence — a hardcoded array cannot be mutated at runtime. The `presetId` foreign-key-like field on `agents` already anticipates this.

#### New DB Table

```sql
CREATE TABLE presets (
  id         TEXT    PRIMARY KEY,  -- nanoid
  name       TEXT    NOT NULL,
  avatar_color TEXT  NOT NULL,
  avatar_icon  TEXT  NOT NULL,
  prompt_role        TEXT NOT NULL,
  prompt_personality TEXT,
  prompt_rules       TEXT,
  prompt_constraints TEXT,
  provider   TEXT    NOT NULL,
  model      TEXT    NOT NULL,
  temperature REAL   NOT NULL DEFAULT 0.7,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Seed the existing 3 presets** (Devil's Advocate, Code Reviewer, Researcher) into this table during the migration so current behavior is preserved.

#### New API Routes

Same REST pattern as `/api/agents`:
- `GET /api/presets` — list all presets
- `POST /api/presets` — create preset
- `PUT /api/presets/[presetId]` — update preset
- `DELETE /api/presets/[presetId]` — delete preset

The existing `/agents/new?preset=<id>` page URL pattern can stay — just look up the preset from the DB instead of the hardcoded array.

**No new npm packages.**

---

### Feature 4: Dedicated Providers Page

**Current state:** The Settings page (`/settings`) is already exclusively a provider management page — it renders `ProviderCard` components and nothing else. Moving it to `/providers` is a routing change, not a capability change.

**Implementation:**
- Add `src/app/(dashboard)/providers/page.tsx` copying the Settings page content
- Update sidebar navigation to add "Providers" link
- Either redirect `/settings` → `/providers` (Next.js `permanentRedirect`) or repurpose Settings for future global app settings

**The `ProviderCard` component, all provider API routes, and the `providerKeys` DB table remain unchanged.**

**No new npm packages.**

---

### Feature 5: Agent Notes

**Current state:** The `agents` table has no `notes` column. The `roomAgents` table (copy-on-assign snapshot) also lacks it.

**Schema change:** Add `notes TEXT` (nullable) to both `agents` and `roomAgents`.

**Migration:** `npx drizzle-kit generate && npx drizzle-kit migrate` generates `ALTER TABLE agents ADD COLUMN notes TEXT`. Non-destructive in SQLite.

**Decision on `roomAgents.notes`:** The copy-on-assign pattern copies all agent fields to `roomAgents` at assignment time for snapshot integrity. Notes should be copied too — the room snapshot should reflect the agent as it was when assigned, including its notes.

**Validation:** Add `notes: z.string().max(2000).nullable().optional()` to `createAgentSchema` and `updateAgentSchema` in `src/lib/validations.ts`.

**UI:** A `<Textarea>` in `AgentForm` below the prompt constraint fields. The `textarea.tsx` component already exists.

**No new npm packages.**

---

## Database Changes Summary

All applied via `npx drizzle-kit generate && npx drizzle-kit migrate` (generates SQL migration files in `src/db/migrations/`):

| Change | Table | SQL Operation | Destructive? |
|--------|-------|---------------|-------------|
| Add `notes` column | `agents` | `ALTER TABLE ADD COLUMN` | No |
| Add `notes` column | `roomAgents` | `ALTER TABLE ADD COLUMN` | No |
| Create `presets` table | (new) | `CREATE TABLE` | No |
| Seed existing 3 presets | `presets` | `INSERT` in seed script | No |

**Note on `drizzle-kit push` vs `generate`+`migrate`:** This project has historically used `drizzle-kit push` (no migration files). For v1.2, prefer `generate`+`migrate` to produce an auditable migration file, especially since a new table is being added. Either works for SQLite.

---

## New API Routes Required

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/providers/[provider]/models` | GET | Fetch available models from provider; returns `{ models: [{id, name}] }` |
| `/api/presets` | GET | List all presets |
| `/api/presets` | POST | Create preset |
| `/api/presets/[presetId]` | PUT | Update preset |
| `/api/presets/[presetId]` | DELETE | Delete preset |

---

## Supporting Libraries

None needed. Decision table for libraries considered and rejected:

| Considered | Verdict | Reason |
|------------|---------|--------|
| `@tanstack/react-query` | SKIP | Model list fetching is a simple `useEffect` + `useState` pattern. The codebase uses this pattern everywhere consistently. Adding react-query for one or two async fetches breaks consistency without adding value at this scale. |
| `cmdk` (Command/Combobox) | SKIP | Useful for OpenRouter's 400+ model list but not a correctness requirement. Base UI Select with dynamic options works. If added later, `cmdk` is zero-dependency and compatible with Base UI. |
| `react-hook-form` | SKIP | `AgentForm` already uses controlled state. Introducing RHF requires rewriting the form. The existing pattern works and is consistent. |
| SWR or TanStack Query | SKIP | Same rationale as react-query — single-purpose, self-contained fetch patterns are already the project standard. |
| `axios` or `ky` | SKIP | Native `fetch` is available in Node.js 18+ and the browser. No HTTP client library adds value here. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vercel AI SDK for model listing | The `ai` package and `@ai-sdk/*` wrappers are inference-only — no model-discovery APIs exposed | Direct native `fetch` to provider REST endpoints |
| Caching model lists in a module-level variable | Ollama model availability changes when user runs `ollama pull`; provider models are released continuously | Fetch on demand per request from the `/api/providers/[provider]/models` route |
| Storing computed or derived data in the preset | Presets are templates — store only the raw fields; derived display values computed at render time | Store raw fields only |
| `llm-info` as primary model source | Covers only 5 providers, 44 models, may lag releases by weeks; no OpenRouter or Ollama entries | Provider APIs as primary, `llm-info` as fallback |
| Sending provider API keys to the browser | Security risk — keys in localStorage or props are visible to the user and any XSS | All provider key reads must remain server-side in API routes |
| Global Zustand store for model lists | Model lists are per-provider, fetched per-form-open, component-local — not shared application state | Component-local `useState` + `useEffect` fetch |

---

## Version Compatibility

No new packages = no new compatibility surface to manage.

The only relevant compatibility check: `drizzle-kit@0.31.10` with SQLite handles `ALTER TABLE ADD COLUMN` and `CREATE TABLE` correctly. This has been the established migration tool in this project since v1.0.

---

## Installation

```bash
# No new packages for v1.2.
# Run migration after schema changes:
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Sources

- Ollama model listing API — `GET /api/tags` returns `{ models: [{name, model, size, ...}] }`, no auth required — **HIGH confidence** — https://docs.ollama.com/api/tags
- OpenRouter model listing API — `GET /api/v1/models` with `Authorization: Bearer <key>` returns `{ data: [{id, name, ...}] }`, 400+ models — **HIGH confidence** — https://openrouter.ai/docs/api/api-reference/models/get-models
- Anthropic model listing API — `GET https://api.anthropic.com/v1/models` with `X-Api-Key` + `anthropic-version` headers — **HIGH confidence** — https://platform.claude.com/docs/en/api/models/list
- OpenAI model listing API — `GET https://api.openai.com/v1/models` with Bearer auth — **HIGH confidence** — https://platform.openai.com/docs/api-reference/models/list
- Google Gemini model listing — `GET https://generativelanguage.googleapis.com/v1beta/models?key=<key>` — **HIGH confidence** — https://ai.google.dev/gemini-api/docs/models
- `llm-info@1.0.69` runtime inspection — `getAllModelsWithIds()` returns 44 models; providers covered: `openai`, `anthropic`, `google`, `deepseek`, `xai`; no `openrouter` or `ollama` entries — **HIGH confidence** (direct `node -e` verification)
- Codebase direct inspection — existing `PUT /api/agents/[agentId]`, `updateAgentSchema`, `AgentPresets.ts`, `providerKeys` table, component inventory — **HIGH confidence**

---

*Stack research for: Agents Room v1.2 — Agent Management milestone*
*Researched: 2026-03-21*
