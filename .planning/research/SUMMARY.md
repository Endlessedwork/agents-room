# Project Research Summary

**Project:** Agents Room v1.2 — Agent Management milestone
**Domain:** Agent library management features for a multi-agent LLM conversation app
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

Agents Room v1.2 is a targeted management milestone that adds five agent-centric features to an already-functional multi-agent conversation platform: agent editing, model picker dropdown, agent presets CRUD, a dedicated providers page, and agent notes. Research confirms the existing codebase is further along than the feature list implies — the PUT `/api/agents/:agentId` edit route, `updateAgentSchema` validation, all five provider API routes, and `ProviderCard` components already exist. The implementation gap is mostly UI and store plumbing, not backend engineering. No new npm packages are required; the entire milestone is deliverable with the current stack.

The recommended build sequence follows a strict dependency graph: schema and store foundations first, then the `AgentForm` refactor (which unlocks notes, editing, and eventually presets), then the providers page and model picker in parallel (both require a shared `providerStore`), and presets last because they are the most design-heavy and their scope needs clarification before implementation. The single highest-risk feature is the model picker — all five providers have different model-listing API shapes, some providers expose 400+ models, and the fallback behavior (static list when the API is unreachable) must be built before the happy path.

The primary risks are operational rather than technical: the copy-on-assign architecture means editing a global agent does NOT update existing room agents (by design), and the UI must surface this clearly. Separately, there is genuine ambiguity in what "presets CRUD" means — the architecture researcher recommends the narrow interpretation (manage agents-created-from-presets, no new DB table) while the stack researcher recommends the wider interpretation (migrate presets to a DB table with seeding). This conflict must be resolved before the presets phase begins.

## Key Findings

### Recommended Stack

No new dependencies are needed for v1.2. All five features can be implemented with the existing stack: Next.js 16 API routes for new endpoints, Drizzle ORM + SQLite for schema migrations, native `fetch` for provider model-listing API calls (not the Vercel AI SDK, which is inference-only), Zod for validation extensions, and Base UI Select/Textarea for UI components. The `llm-info` package (already installed) serves as a static fallback for model lists when provider APIs are unavailable, though it covers only Anthropic, OpenAI, Google, Deepseek, and xAI — not OpenRouter or Ollama.

**Core technologies:**
- **Next.js 16 API Routes**: New routes for `/api/providers/[provider]/models`, `/api/presets`, `/api/presets/[presetId]` — same pattern as existing `/api/agents` routes
- **Drizzle ORM + SQLite (WAL)**: `ALTER TABLE ADD COLUMN` for notes; `CREATE TABLE` for presets (if wide scope) — both non-destructive; prefer `drizzle-kit generate && drizzle-kit migrate` over `push` for auditability
- **Native `fetch` (Node.js 18+)**: All five provider model-listing endpoints called server-side; no HTTP client library needed; keys never reach the browser
- **`llm-info@1.0.69`**: Static fallback for model lists; use only when live API is unavailable; does not cover OpenRouter or Ollama
- **Zod**: Extend `createAgentSchema` and `updateAgentSchema` with `notes` field; new `createPresetSchema` if wide scope presets land in v1.2
- **Base UI Select + Textarea**: Model picker combobox and notes textarea — both components already exist in `src/components/ui/`

### Expected Features

**Must have (table stakes):**
- **Agent editing** — API route already exists; only UI is missing; central `AgentForm` refactor unlocks notes and presets
- **Model picker dropdown** — free-text model input is error-prone; every serious LLM tool provides a picker; highest implementation complexity of the five features
- **Dedicated Providers page** — provider management deserves its own `/providers` route; current `/settings` conflates concerns
- **Agent notes** — users need free-text annotations on library agents; one nullable TEXT column + a textarea field

**Should have (competitive):**
- **User-created preset CRUD** — turns the agent library into a composition tool; requires new `presets` DB table (if wide scope confirmed)
- **Provider connection status indicator in agent form** — show configured/unconfigured status next to the provider selector; no new API route needed
- **Model list search/filter for OpenRouter** — 400+ models makes a flat dropdown unusable; client-side filter on the fetched list

**Defer to v2+:**
- Agent versioning (prompt change history + diff UI)
- Agent import/export (JSON)
- Bulk agent operations
- Room agent editing (editing in-room copies independently of library)
- Agent tags/categories

### Architecture Approach

The existing architecture requires only additive changes for v1.2. The conversation engine, SSE streaming, and all room-level components are untouched. Changes concentrate in the agent management layer: `AgentForm` becomes a dual-mode component (create and edit), a new `providerStore` Zustand store centralizes provider state for both the providers page and the model picker, a new `model-fetcher.ts` module normalizes per-provider model-list API responses, and the `agents` schema gains a nullable `notes` column via migration.

**Major components:**
1. **`AgentForm.tsx` (modified)** — dual create/edit mode via `initialData` prop; model combobox replacing free-text input; notes textarea; wires to both `POST /api/agents` and `PUT /api/agents/[id]`
2. **`providerStore.ts` (new)** — Zustand store holding providers list, model cache keyed by provider name, and loading flags; shared by `ProvidersPage` and `AgentForm`
3. **`model-fetcher.ts` (new)** — per-provider model-listing adapters with a unified `{ id, name }` interface; 5-second timeout; static fallback list when API is unreachable
4. **`/api/providers/[provider]/models/route.ts` (new)** — server-side proxy that reads the stored API key from `providerKeys` table and returns a normalized model list; prevents key exposure in the browser
5. **`/agents/[agentId]/edit/page.tsx` (new)** — server component that fetches agent by ID and renders `AgentForm` with `initialData`
6. **`/providers/page.tsx` (new)** — dedicated provider management page backed by `providerStore`; reuses `ProviderCard` component unchanged

### Critical Pitfalls

1. **Agent edit silently diverging from room agents** — Editing a global agent does NOT update room agents (copy-on-assign by design). Without a UI disclosure, users will be confused when their "updated" agent behaves differently in existing rooms. Add a banner: "Changes apply to new room assignments only." Never cascade `UPDATE` from `agents` to `roomAgents`. Address in: agent editing phase.

2. **Missing `updateAgent` in agentStore causing stale UI** — The store has `createAgent` and `deleteAgent` but no `updateAgent`. After a successful PUT, the agents list shows stale data until page reload. Implement `updateAgent` before building the edit UI. Never use `window.location.reload()` as a workaround — PROJECT.md already flags this as tech debt. Address in: agent editing phase (prerequisite).

3. **Model picker with no fallback on API failure** — Provider model-listing APIs fail for many legitimate reasons (key not configured, provider down, Ollama not running). A picker that shows an empty dropdown or infinite spinner is worse than free-text input. Build the static fallback list before the live fetch. Apply a 5-second timeout. Show "No local models — start Ollama" specifically for Ollama. Address in: model picker phase.

4. **Static vs. DB presets duality causing silent data loss** — `AgentPresets.ts` has 3 hardcoded presets. If a new `presets` DB table is added without seeding these 3 records, the existing presets vanish from the UI. The `presetId` column on `agents` currently stores string IDs matching the static list — making it a true FK requires the referenced rows to exist. Audit `AgentPresets.ts` before writing any schema code. Address in: presets CRUD phase.

5. **Schema migration not applied to actual DB file** — Drizzle's TypeScript types track the schema definition; the SQLite file tracks reality. Editing `schema.ts` without running `drizzle-kit generate && drizzle-kit migrate` against the actual `data/agents-room.db` produces a TypeScript-passes/runtime-crashes mismatch. The first schema change (notes column) is the moment to establish this workflow correctly. Address in: agent notes phase.

## Implications for Roadmap

Based on combined research, the five features group into four implementation phases that follow a dependency graph rather than arbitrary time-boxing.

### Phase 1: Foundation — Schema, Store, Notes

**Rationale:** Notes requires the first schema migration and establishes the `drizzle-kit generate + migrate` workflow for all subsequent changes. The `agentStore.updateAgent` action is a prerequisite for editing and has zero UI surface area to debate. Getting both right first de-risks everything else. This phase has the smallest blast radius if something goes wrong.

**Delivers:** `notes` column on `agents` table (migration applied), `updateAgent` action in `agentStore`, notes textarea in `AgentForm` (create mode only for now), notes preview in `AgentCard`.

**Addresses:** Agent notes (table stakes), tech debt of missing `updateAgent`.

**Avoids:** Schema-not-migrated pitfall (Pitfall 4); store-sync pitfall (Pitfall 6); perpetuating `window.location.reload()` anti-pattern.

### Phase 2: Agent Editing UI

**Rationale:** With `updateAgent` in the store and the schema migrated, the only remaining work is UI. This phase performs the central refactor of `AgentForm` into dual create/edit mode — the same refactor that notes (in edit mode), the model picker, and presets all depend on. Completing this phase makes the milestone's most-depended-upon change independently verifiable before other features build on it.

**Delivers:** `/agents/[agentId]/edit` page, `AgentForm` dual-mode (create and edit), Edit button on `AgentCard`, notes field active in both create and edit modes, disclosure banner about copy-on-assign isolation.

**Addresses:** Agent editing (table stakes), notes field available in edit mode.

**Avoids:** Copy-on-assign divergence pitfall (Pitfall 1) — disclosure banner is a required acceptance criterion, not optional polish.

### Phase 3: Providers Page + Model Picker

**Rationale:** These two features share `providerStore` — building them together prevents the anti-pattern of keeping provider state in local component state, which would make the model picker unable to access provider data without prop threading. Build providers page and store first, then wire `model-fetcher.ts` and the API route, then replace the text input in `AgentForm` with the combobox.

**Delivers:** `/providers` page, `providerStore` Zustand store, `/settings` redirected to `/providers`, `Sidebar` updated with Providers link, `/api/providers/[provider]/models` route, `model-fetcher.ts`, model combobox in `AgentForm` with loading state and static fallback.

**Uses:** Native `fetch` for provider APIs, `llm-info` as fallback for unconfigured providers, Base UI Select for combobox.

**Addresses:** Dedicated providers page (table stakes), model picker (table stakes).

**Avoids:** Provider-state-in-local-state anti-pattern; model picker no-fallback pitfall (Pitfall 2); provider page navigation and fetch-not-called-on-mount pitfall (Pitfall 5).

**Research flag:** This phase has the highest implementation risk due to per-provider API shape diversity. The STACK.md and FEATURES.md research provides verified endpoints and response shapes for all five providers — use as the implementation spec. No additional research-phase is needed, but keep per-provider adapter logic strictly isolated from UI.

### Phase 4: Presets CRUD

**Rationale:** Presets are the most design-heavy feature and carry a scope ambiguity that must be resolved before implementation. Placing presets last means the decision can be made with full context of what editing already delivers. Under the narrow interpretation (presets = agents-created-from-presets), Phase 2 already satisfies the requirement. Under the wide interpretation (user-managed preset templates in a DB table), this phase adds a migration, CRUD routes, and management UI.

**Delivers (narrow scope — no new code required):** Preset-origin agents are fully editable after Phase 2. Document the workflow. Mark as complete.

**Delivers (wide scope):** New `presets` DB table, seeded with all 3 existing presets from `AgentPresets.ts`, CRUD API routes (`GET/POST /api/presets`, `PUT/DELETE /api/presets/[id]`), preset management UI, "Save as preset" action on agent edit form, confirmation dialog on "Apply Preset" to prevent silent field overwrite.

**Addresses:** Agent presets CRUD (differentiator if wide scope).

**Avoids:** Static-vs-DB presets duality pitfall (Pitfall 3) — seed existing presets into DB before removing the static array; preset apply overwrites user fields without warning (Pitfall 8).

**Research flag:** Scope decision required before planning this phase. If wide scope is confirmed, plan the preset management UX (preset list page vs. inline on agents page, system vs. user preset display, apply-with-confirmation flow) before implementation. This phase may warrant `/gsd:research-phase` if wide scope is selected.

### Phase Ordering Rationale

- **Foundation before editing:** `updateAgent` in the store is a code-level prerequisite for the edit form; the schema migration establishes the migration workflow for notes and (if needed) presets.
- **Editing before model picker:** `AgentForm` must be refactored to dual-mode before the model picker field can be added to both create and edit paths consistently.
- **Providers page before model picker:** `providerStore` must exist before the model picker can use it; both consumers (providers page and model picker) share one store fetch, avoiding duplicate API calls.
- **Presets last:** Scope is ambiguous; resolving after editing is implemented reveals whether presets CRUD is already satisfied or needs a new DB table and management UI.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Presets CRUD — wide scope only):** Scope must be confirmed with project owner first. If wide scope, plan preset management UX before any implementation begins. Consider `/gsd:research-phase` for this phase if wide scope is selected.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Standard Drizzle migration + Zustand store action patterns; both fully established in the existing codebase.
- **Phase 2 (Agent Editing):** PUT route already exists; edit page pattern mirrors existing `/agents/new` exactly.
- **Phase 3 (Providers + Model Picker):** All five provider API endpoints verified with HIGH confidence; per-provider adapter pattern is well-defined in research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in use; no new packages; all five provider model-listing API endpoints verified against official documentation |
| Features | HIGH | Based on direct codebase inspection; existing routes and components inventoried; clear dependency graph derived from live code |
| Architecture | HIGH | Derived from direct codebase inspection of all relevant modules; component boundary map names specific files with NEW/MODIFIED/UNCHANGED status |
| Pitfalls | HIGH | Codebase-specific pitfalls verified against live code; standard SQLite/Drizzle/Zustand failure modes well-documented; security patterns (key masking, SSRF) drawn from established patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **Presets scope ambiguity:** Architecture research and stack research disagree on whether "presets CRUD" requires a new DB table. Architecture team recommends narrow interpretation (no new table); stack team recommends wide interpretation (new `presets` table with seeded data). Resolve with project owner before Phase 4 planning.
- **Anthropic model list endpoint discrepancy:** ARCHITECTURE.md states Anthropic has no public `/models` enumerate endpoint and recommends a static curated list; STACK.md documents a live `GET https://api.anthropic.com/v1/models` endpoint. Reconcile during Phase 3: attempt the live endpoint first, fall back to curated static list if unavailable.
- **OpenAI model list filtering criteria:** The `/v1/models` endpoint returns non-chat models (embeddings, whisper, DALL-E). The filter heuristic (`id.startsWith('gpt-')` + o-series prefixes) may need tuning as OpenAI releases new model families. Validate filtering logic against a live response during Phase 3 implementation.
- **Migration tool consistency:** ARCHITECTURE.md notes the project has historically used `drizzle-kit push` (no migration files directory). STACK.md recommends switching to `generate + migrate` for v1.2 for auditability. Confirm and document the chosen approach at the start of Phase 1; do not mix strategies across phases.

## Sources

### Primary (HIGH confidence)
- Anthropic List Models API — `GET /v1/models` with `X-Api-Key` + `anthropic-version` headers — https://platform.claude.com/docs/en/api/models/list
- OpenAI List Models API — `GET /v1/models` with Bearer auth — https://platform.openai.com/docs/api-reference/models/list
- OpenRouter models endpoint — `GET /api/v1/models` — https://openrouter.ai/docs/api/api-reference/models/get-models
- Ollama list models — `GET /api/tags` — https://docs.ollama.com/api/tags
- Google Generative AI models — `GET /v1beta/models?key={API_KEY}` — https://ai.google.dev/gemini-api/docs/models
- `llm-info@1.0.69` runtime inspection — 44 models across 5 providers; no OpenRouter or Ollama entries verified by direct `node -e` inspection
- Direct codebase inspection — `src/db/schema.ts`, `src/lib/validations.ts`, `src/stores/agentStore.ts`, `src/app/api/agents/[agentId]/route.ts`, `src/app/api/providers/`, `src/components/agents/AgentForm.tsx`, `AgentCard.tsx`, `AgentPresets.ts`, `src/app/(dashboard)/settings/page.tsx`, `src/components/layout/Sidebar.tsx`

### Secondary (MEDIUM confidence)
- Drizzle ORM migration docs — `drizzle-kit generate` + `drizzle-kit migrate` workflow; project history with `drizzle-kit push` inferred from absence of migrations directory
- OpenAI model list filtering heuristics — `id.startsWith('gpt-')` + o-series prefix filtering — verified against training data; needs runtime validation during Phase 3

### Tertiary (LOW confidence)
- Ollama SSRF via `baseUrl` — known pattern for apps accepting user-supplied HTTP endpoints; `saveProviderKeySchema` uses `z.string().url()` but does not restrict to localhost — assess during Phase 3 security review

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
