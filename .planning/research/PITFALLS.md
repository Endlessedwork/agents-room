# Pitfalls Research

**Domain:** Adding agent editing, model picker, presets CRUD, dedicated providers page, and agent notes to an existing multi-agent conversation app (v1.2 Agent Management milestone)
**Researched:** 2026-03-21
**Confidence:** HIGH (existing codebase fully inspected, patterns verified against schema and live code)

---

## Critical Pitfalls

### Pitfall 1: Editing a Global Agent and Expecting Room Agents to Update

**What goes wrong:**
The app uses a copy-on-assign pattern: when an agent is assigned to a room, all fields are copied into the `room_agents` table. The `PUT /api/agents/:agentId` endpoint already exists and updates the `agents` table. When agent editing UI is added, a developer or user assumes that editing the global agent card also updates how that agent behaves in rooms it was previously added to. It does not — and it must not. But the UI can mislead: if the agent list on the Agents page shows the updated global fields, while the room still runs with the old snapshot, the user gets confused about why their "updated" agent is still using the old role.

**Why it happens:**
The copy-on-assign pattern is correct and intentional, but it's non-obvious to users who expect "edit agent" to mean "update the agent everywhere." The UI gives no indication that room agents are independent snapshots.

**How to avoid:**
- On the agent edit form, add a clear disclosure: "Changes apply to new room assignments only. Existing room agents are not affected."
- Never cascade `UPDATE` from `agents` to `room_agents` in the database or API. The FK `sourceAgentId` is intentionally nullable and `onDelete: 'set null'` — it is a trace reference, not a live link.
- If the user needs the updated version in a room, the correct workflow is: remove the agent from the room and re-add it. Make this explicit in the UI.
- The `agentStore` does not have an `updateAgent` method yet. When adding it, update only the local Zustand state — do not try to propagate changes to `roomAgents` through the store.

**Warning signs:**
- A database trigger or API code that does `UPDATE room_agents SET ... WHERE source_agent_id = ?` after an agent edit.
- The agent edit form has no note about room agent independence.
- A test that checks the room agent's fields after editing the global agent and expects them to match.

**Phase to address:** Agent editing phase. The disclosure text and the store-only update path must be in the acceptance criteria.

---

### Pitfall 2: Model Picker Fetching Available Models at Form Open Time — Without Handling Failure

**What goes wrong:**
A model picker dropdown that calls `GET /api/providers/:provider/models` (or a similar endpoint) when the form opens will fail silently if the provider's API is unreachable, the API key is invalid, or the provider rate-limits the list endpoint. The user sees an empty dropdown or a spinner that never resolves. Even worse: different providers have wildly different model-list API shapes. OpenRouter's `/models` endpoint returns ~200+ model objects with complex pricing metadata; Anthropic's list is small and stable; Ollama's `/api/tags` returns locally-installed models only; Google's model listing requires a separate API; OpenAI's `/models` returns both LLM and non-LLM models mixed together.

**Why it happens:**
Developers implement the happy path (API returns list, dropdown populates) without building the failure path first. The shape diversity across providers is also underestimated — treating all five provider APIs as equivalent breaks on the first non-Anthropic test.

**How to avoid:**
- Build fallback behavior first: if the model list fetch fails, fall back to a curated static list of known-good models per provider (the same models currently hardcoded in `DEFAULT_TEST_MODELS` and `AgentPresets.ts` are a good starting point).
- Set a 5-second timeout on model list fetches. Do not let an unresponsive Ollama instance block the form.
- Implement per-provider model list adapters with a shared interface: `{ id: string; name: string; contextWindow?: number }`. The transformation from raw API response to this shape happens inside the adapter, not in the UI component.
- For Ollama specifically: the model list is empty if Ollama is not running locally. Show "No local models found — start Ollama first" rather than an empty dropdown.
- For OpenRouter: filter the 200+ models list. Show only models that are not deprecated and have a non-null context window. Consider grouping by provider family.
- The model picker does NOT need to be live-fetched on every form open. Fetch once when the provider changes, cache the result for the session.

**Warning signs:**
- The model picker shows a loading spinner indefinitely when Ollama is not running.
- The dropdown is empty for valid, configured providers.
- The fetch for model list has no error boundary or timeout.
- All five provider adapters are written as one `switch` statement with no shared interface.

**Phase to address:** Model picker phase. Build the fallback static list before building the live fetch. Test with Ollama stopped.

---

### Pitfall 3: Presets Table Confusion — Static Presets vs. User-Created Presets

**What goes wrong:**
The existing codebase already has a `AGENT_PRESETS` constant in `src/components/agents/AgentPresets.ts` with three hard-coded presets (Devil's Advocate, Code Reviewer, Researcher). The `agents` schema also has a `presetId` column. If the v1.2 milestone adds "agent presets CRUD" using a new database table, there are now two parallel systems: static in-code presets and user-created database presets. When the model picker or agent form asks "which presets exist?", it has to query both sources. If the developer forgets the static presets exist, the Agents page shows only user-created presets and the existing presets silently disappear.

**Why it happens:**
The static `AGENT_PRESETS` array is in a component file with a non-obvious path. A developer scoping the new presets feature looks at the database schema, sees `presetId` as a column on `agents`, and assumes presets are already DB-backed — but they're not. The existing `presetId` values like `'devils-advocate'` are just strings that happen to match the hard-coded preset IDs.

**How to avoid:**
- Before designing the presets CRUD schema, decide: migrate static presets to database at startup, or keep them as static defaults and layer DB presets on top. The cleaner approach is to seed the static presets into the DB as system presets on first run (with a flag like `isSystem: true` to prevent deletion).
- If a `presets` table is added, the seeding logic must run on app startup before any user interaction (in `src/db/index.ts` or a startup hook).
- Do not create a new table named `agent_presets` if the agents table already has `presetId` — the relationship must be clear: is `presetId` a FK to the new table, or is it a string ID matching the static list?
- Ensure the Agents page "Apply Preset" action works for both system presets and user-created presets through a unified API endpoint.

**Warning signs:**
- The new `presets` table exists but the three existing presets from `AgentPresets.ts` are not in it.
- `presetId` on the `agents` table is not updated to be a FK when the presets table is created.
- Two separate API calls are needed to get all presets (one for static, one for DB).

**Phase to address:** Presets CRUD phase. Audit `AgentPresets.ts` before writing a single line of schema code.

---

### Pitfall 4: Schema Migration for `notes` Column Not Applied to Existing Database

**What goes wrong:**
Adding a `notes` column to the `agents` table requires a migration. The project uses Drizzle ORM with migrations generated to `src/db/migrations/`. If the developer updates `src/db/schema.ts` with the new column but does not generate and apply the migration, the app boots with a schema mismatch. Worse: the project's `src/db/index.ts` does not call `migrate()` on startup — it uses Drizzle with the schema directly. Any migration must be applied manually. If the developer forgets this and just edits the schema, `INSERT INTO agents` calls that include `notes` will fail with "table agents has no column notes."

**Why it happens:**
Drizzle's type system reflects the schema TypeScript definition, not the actual SQLite schema. TypeScript compiles fine, the app boots, and only the first insert or query involving the new column reveals the mismatch — often not in development if seed data does not exercise the new field.

**How to avoid:**
- Run `npx drizzle-kit generate` after updating `schema.ts` to produce the migration SQL file.
- Apply the migration with `npx drizzle-kit migrate` against the actual `data/agents-room.db` file before starting the dev server.
- Add the migration step to the development setup notes. This project has no auto-migration on startup, so it is always a manual step.
- For the `notes` column specifically: add it as `text('notes')` (nullable, no default required). This is the lowest-risk schema change — nullable columns with no default never break existing rows.
- When adding `presetId` as a FK (see Pitfall 3): this is higher risk because it changes the column from a bare string to a constrained FK. Test with existing agents that have `presetId: 'devils-advocate'` — the FK constraint will fail if the referenced presets table does not have that row.

**Warning signs:**
- TypeScript compiles cleanly but the dev server logs `SqliteError: table agents has no column notes` on any agent write.
- The migration file in `src/db/migrations/` is outdated (timestamp older than last schema.ts modification).
- `drizzle-kit generate` produces an empty diff (suggests the migration was already applied to a previous DB version that the tool is comparing against, but the actual DB file was never migrated).

**Phase to address:** Agent notes phase — it is the first schema change in this milestone. Get the migration workflow right here before any other schema changes.

---

### Pitfall 5: Moving the Providers UI Breaks Navigation and Orphans Settings

**What goes wrong:**
Moving provider management from the Settings page to a dedicated Providers page sounds simple (copy components, add a nav link, remove from Settings). In practice, three things break:
1. Any existing bookmarks or direct navigation to the Settings page that expected to configure providers now finds them missing — the user sees an empty Settings page.
2. If the Providers page URL is `/providers` and the Settings page URL is `/settings`, any link in the codebase that says "configure your API keys in Settings" is now wrong.
3. The `providerKeys` store or fetch logic may be co-located with the Settings component. Moving the UI without moving the data layer means either the data is fetched twice (once for Providers page, once in residual Settings code) or not at all.

**Why it happens:**
UI migration is underestimated as a "just move the component" task. The side effects (navigation, copy/text, data fetching responsibility) are not obvious until the move is done.

**How to avoid:**
- Before moving, `grep -r "Settings\|/settings\|providerKey"` across all component files to find every reference.
- After moving, redirect `/settings` to `/providers` (or update all links) rather than leaving an empty Settings page.
- Check whether provider data fetching lives in the Settings page component or in a shared hook/store. If it's in the component, the fetch logic must move with the UI.
- The providers page needs its own `useEffect` fetch, not a dependency on Settings mounting.
- Settings page should still exist if there are other settings (room defaults, theme, etc.). If provider management was the only thing in Settings, the Settings page may be removed entirely — but confirm this before deleting it.

**Warning signs:**
- The Providers page renders but shows no provider data (fetch not called on mount).
- The Settings page still shows provider configuration controls after the move (duplicate UI).
- Navigation links in the sidebar still point to `/settings` for provider configuration.

**Phase to address:** Dedicated Providers page phase. Do the grep audit before touching any component.

---

### Pitfall 6: `agentStore` Missing `updateAgent` — UI Updates Without Store Sync

**What goes wrong:**
The current `agentStore` (Zustand) has `fetchAgents`, `createAgent`, and `deleteAgent` — but no `updateAgent`. When the agent editing UI calls `PUT /api/agents/:agentId` successfully, the API updates the DB, but the local Zustand state still has the stale agent object. The Agents page re-renders with old values because the store was not updated. The user saves the edit, the form closes, and the card shows the old name/model/role. A page reload fixes it — but that is exactly the `window.location.reload()` anti-pattern already flagged as a tech debt in `PROJECT.md`.

**Why it happens:**
The store was designed for create/delete flows (both of which modify the agents array length). Update is the missing third CRUD operation. It's easy to implement the API call without wiring the store update, especially if the developer tests by reloading the page.

**How to avoid:**
- Add `updateAgent: (id: string, data: Partial<Agent>) => Promise<Agent>` to the `AgentStore` interface before building the edit UI.
- The implementation pattern follows `createAgent`: call `PUT`, receive the updated agent from `returning()`, then use `set((s) => ({ agents: s.agents.map(a => a.id === id ? updated : a) }))`.
- Never use `window.location.reload()` after an agent edit. The `PROJECT.md` already flags this as a tech debt on the room edit path — do not repeat it for agent edit.
- Test the store update path explicitly: edit an agent, verify the card reflects the new values without a page reload.

**Warning signs:**
- Agent cards show stale values after editing until the page is reloaded.
- The edit form uses `router.refresh()` or `window.location.reload()` after save.
- `agentStore.ts` does not have an `updateAgent` export.

**Phase to address:** Agent editing phase. The store method is a prerequisite — implement it before the UI form.

---

### Pitfall 7: Model Picker Selecting a Model the Provider Cannot Run

**What goes wrong:**
A user opens the model picker, sees a list of models from OpenRouter (which proxies 200+ models), and selects one that requires a paid subscription tier they don't have, or an Anthropic model they don't have quota for. The model picker has no way to verify the model is runnable without actually making a test call. The agent is saved with that model. When the conversation starts, the first turn fails with a provider error (403, insufficient quota, model deprecated). The error surfaces as a failed turn in the conversation log — confusing because the failure is in a room, not in the provider config page.

**Why it happens:**
Model listing APIs return all available models, not all models accessible with the current API key. Access control is enforced at inference time, not list time. The model picker UI has no way to distinguish "accessible" from "listed."

**How to avoid:**
- Surface the model picker error at agent save time, not conversation time, by optionally running a minimal test inference on model selection (same pattern as the existing `POST /api/providers/:provider/test` endpoint — extend it to accept a specific model).
- If the test is too slow or too costly, at minimum validate that the provider is configured (status is 'verified' or 'configured') before allowing the agent to be saved.
- Show a "Verify model" button on the agent edit form that fires a minimal test inference with the selected model. This is a better UX than silently failing in the room.
- For the OpenRouter case: filter the model list to show only free-tier models when the user has not configured premium access, or add an "estimated cost" column in the picker so the user knows what they're selecting.

**Warning signs:**
- Agent is saved with a model, conversation starts, first turn error occurs with a 4xx response from the provider.
- The provider test endpoint (`/api/providers/:provider/test`) does not accept a custom model — it only tests a default model.
- The model picker shows all OpenRouter models including paid ones with no visual distinction.

**Phase to address:** Model picker phase. The "verify model" test path is part of the model picker feature, not an afterthought.

---

### Pitfall 8: Preset Application Overwrites Fields the User Already Customized

**What goes wrong:**
A user creates an agent, customizes the name, avatar, and some prompt fields. They then click "Apply Preset" from the preset picker. The preset application overwrites all fields with the preset's values, including the name and avatar the user set. The user's customization is lost.

Conversely, if the preset application is too conservative and only fills empty fields, a user who wants to fully reset to a preset's configuration cannot do so without clearing every field manually first.

**Why it happens:**
The "apply preset" action has ambiguous semantics. Developers default to the simplest implementation (overwrite everything), which is destructive. Users expect smarter behavior (fill only empty fields, or ask which fields to overwrite).

**How to avoid:**
- Design the apply-preset action with explicit semantics: "Apply Preset" fills all fields from the preset. "Apply Preset (fill empty only)" fills only blank fields. The simpler approach: show a confirmation dialog listing which fields will be overwritten.
- The minimum acceptable behavior: warn the user before overwriting non-empty fields. "This will replace your current name, role, and prompt. Continue?"
- Presets should apply the provider and model fields too — this is the primary value of a preset (pre-configured provider/model pairing). Do not apply prompt fields but skip provider/model.
- The `presetId` column on the `agents` row should be set to the preset's ID after applying, so the Agents page can show "based on Devil's Advocate" as a badge.

**Warning signs:**
- "Apply Preset" button has no confirmation step.
- After applying a preset, the agent's `presetId` column is still null.
- The provider and model fields are not updated when a preset is applied (incomplete apply).

**Phase to address:** Presets CRUD phase. Define the apply semantics in the phase spec before implementing.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode model lists per provider in the frontend | No API call needed | Lists go stale when providers add/deprecate models | Acceptable as fallback, not as primary path |
| Skip `updateAgent` in store, use page reload instead | Saves 10 minutes | Perpetuates the `window.location.reload()` anti-pattern already flagged in PROJECT.md | Never — the store method costs 5 lines |
| Make presets static-only (no DB table) | No migration needed | Cannot add user presets without a code deploy | Acceptable only if user-created presets are truly out of scope for v1.2 |
| Overwrite all fields on "Apply Preset" with no confirmation | Simplest implementation | Destroys user customization; erodes trust | Never without a confirmation dialog |
| Model picker with no fallback static list | Simpler code | Empty dropdown when provider is unreachable | Never — always have a static fallback |
| Move provider management without updating all nav links | Faster move | Broken navigation; users lose muscle memory to find providers | Never — do the grep audit first |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic model list | Calling `anthropic.models.list()` and expecting a simple response | Anthropic's SDK `models.list()` returns a paginated response; call `.data` to get the array |
| OpenAI model list | Showing all models including embeddings, whisper, dall-e | Filter `GET /v1/models` to only `gpt-*` models; `object: "model"` and `id.startsWith("gpt")` |
| OpenRouter model list | Assuming every listed model is accessible with any API key | Some require pro subscription; display `pricing.prompt` cost per token to let users self-select |
| Ollama model list | Calling `GET /api/tags` when Ollama is not running | Handle ECONNREFUSED — show "Ollama not running" message, fall back to empty list |
| Google model list | Using Generative AI API to list models | The `genai.list_models()` endpoint includes non-chat models; filter for `generateContent` method support |
| Drizzle migration | Editing `schema.ts` without running `drizzle-kit generate && drizzle-kit migrate` | Always run both commands against the actual DB file; Drizzle's type system is ahead of the DB |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching model list on every keystroke in provider select | Rate limit errors; slow UI; excess API calls | Fetch once on provider change, cache in component state for the session | Immediately if provider list is dropdown-linked to model fetch |
| Fetching all agent presets from DB on every agent form open | Slow form open on large preset collections | Presets change rarely; fetch once on page mount and cache in component state or store | After ~50 presets, noticeable delay |
| Saving agent with `updatedAt: new Date()` but no migration | `SqliteError: no column updatedAt` | Always run migration before testing any save path | First agent edit attempt on existing DB |
| Provider page loading all provider status + fetching model lists simultaneously | 5 concurrent API calls on page load | Lazy-load model lists only when the user expands a provider section | With 5 providers all fetching simultaneously |

---

## Security Mistakes

Personal tool — attack surface is narrow. These are operational safety concerns.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging API keys in model-fetch error messages | Key exposed in server logs or browser console | Log provider name and error code only; never log the key or the full config object |
| Displaying API key in plain text on the Providers page | Key visible on screen recording or shared screenshot | Show masked key: `sk-ant-api03-...****` with a "reveal" toggle; never full plain text |
| Accepting arbitrary `baseUrl` for Ollama without validation | SSRF: attacker redirects Ollama to internal network | Validate `baseUrl` is `http://localhost:*` or `http://127.0.0.1:*`; the `saveProviderKeySchema` already uses `z.string().url()` but does not restrict to localhost |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Agent edit form opens as a full page instead of a sheet/modal | User loses context of which agent they were editing | Open edit in a side sheet or modal, same pattern as the existing room config UI |
| Model picker shows raw model IDs (e.g., `claude-sonnet-4-20250514`) | Users cannot distinguish between models by name | Show human-readable label alongside the ID: "Claude Sonnet 4 (claude-sonnet-4-20250514)" |
| No indication that editing a global agent doesn't affect room agents | User edits agent, goes to room, confused why nothing changed | Show a banner on the agent edit form: "Room agents already using this template are not affected" |
| Preset CRUD with no preview | User applies a preset without knowing what the prompt says | Show preset details (role, personality summary) in the preset picker before applying |
| Provider page "Test Connection" button with no per-model test | User knows the key is valid but not if their chosen model is accessible | Add a "Test with selected model" option on the agent form; the existing provider test uses default models only |
| Deleting a global agent while it is assigned to an active room | Room continues working (FK is `set null`) but the source reference is lost | Show a warning: "X rooms are currently using this agent. Deleting removes the library entry but does not affect running rooms." |

---

## "Looks Done But Isn't" Checklist

- [ ] **Agent editing:** Edit form saves — verify the Agents page shows updated values WITHOUT a page reload (store update confirmed).
- [ ] **Agent editing:** Banner or note present — verify UI discloses that room agents are not affected by global edits.
- [ ] **Agent editing:** `updatedAt` is updated on every save — verify the DB row has a new timestamp after edit.
- [ ] **Model picker:** Provider is down — verify the picker shows a static fallback list, not an empty dropdown.
- [ ] **Model picker:** Ollama not running — verify the picker shows "No local models" message, not a spinner.
- [ ] **Model picker:** Model ID is saved correctly — verify the full model string (e.g., `claude-sonnet-4-20250514`) is stored, not a display label.
- [ ] **Presets:** All three static presets from `AgentPresets.ts` appear in the preset picker without separate code paths.
- [ ] **Presets:** Apply Preset has confirmation — verify no fields are overwritten without user acknowledgment when the agent already has non-empty values.
- [ ] **Presets:** `presetId` column updated on agents table after applying a preset.
- [ ] **Providers page:** No provider data visible — verify fetch is called on mount, not inherited from Settings.
- [ ] **Providers page:** API key display — verify keys are masked, not shown in full.
- [ ] **Agent notes:** Notes column exists in DB — verify `drizzle-kit migrate` was run against the actual `data/agents-room.db` file.
- [ ] **Agent notes:** Notes saved — verify notes persist across page reloads (confirm they are in the DB row, not just local state).
- [ ] **Schema migration:** `tsc --noEmit` and `npm run build` both pass after each schema change.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Agent edit overwrites room agent data (cascade bug) | HIGH | Revert the migration and API code; room agents have FK to source agent but data is copied; no data loss if cascade did not run |
| Model picker shows wrong models (stale static list) | LOW | Update the static fallback list; takes ~10 minutes; no migration needed |
| Preset apply destroyed user's custom fields | MEDIUM | Add undo via optimistic rollback in the store; if not implemented, user must re-enter their customization |
| Schema migration not applied — app crashes on agent edit | LOW | Run `npx drizzle-kit migrate`; app recovers immediately |
| Provider page move broke navigation — users can't find providers | LOW | Add a redirect from `/settings` to `/providers`; takes 5 minutes |
| Ollama `baseUrl` SSRF vulnerability | MEDIUM | Add a validator to `saveProviderKeySchema` that checks hostname is localhost; existing keys may need re-validation |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Global agent edit ≠ room agent update | Agent editing phase | Room agent fields unchanged after global edit; disclosure text present in UI |
| Missing `updateAgent` in store | Agent editing phase | Agents page reflects edits without page reload |
| Model picker no fallback on fetch failure | Model picker phase | Picker shows static list when provider API is unreachable |
| Model picker model not accessible at inference | Model picker phase | "Verify model" test button present; conversation failure is surfaced early |
| Static vs. DB presets confusion | Presets CRUD phase | All three existing presets appear in the picker without two separate code paths |
| Preset apply overwrites without warning | Presets CRUD phase | Confirmation dialog shown when applying over non-empty fields |
| `notes` column schema not migrated | Agent notes phase | `npm run build` passes; first agent save with notes does not throw SQLiteError |
| Provider move breaks navigation | Dedicated Providers page phase | All links pointing to provider config go to `/providers`; Settings page redirects or is removed |
| Providers page fetch not called on mount | Dedicated Providers page phase | Provider status loads on fresh page visit without visiting Settings first |
| API key logged or displayed in plain text | Dedicated Providers page phase | Server logs contain no key strings; UI shows masked format |

---

## Sources

- Codebase inspection: `src/db/schema.ts`, `src/components/agents/AgentPresets.ts`, `src/stores/agentStore.ts`, `src/app/api/agents/[agentId]/route.ts`, `src/app/api/providers/route.ts`, `src/app/api/providers/[provider]/test/route.ts`, `src/lib/llm/providers.ts`, `src/lib/validations.ts`
- `PROJECT.md` key decisions table: `window.location.reload` flagged as tech debt on room edit path
- Ollama API documentation: `GET /api/tags` for local model listing (official Ollama docs)
- OpenRouter API: `/api/v1/models` endpoint returns full model catalog including access-controlled models
- Anthropic Python SDK `models.list()` returns paginated response — confirmed in SDK source
- OpenAI `/v1/models` endpoint returns mixed model types (embeddings, whisper, GPT) requiring client-side filtering
- Drizzle ORM migration docs: schema changes require explicit `drizzle-kit generate` + `drizzle-kit migrate`; no auto-migration on startup
- SSRF via `baseUrl` in Ollama provider: known pattern in any app that accepts user-supplied HTTP endpoints

---
*Pitfalls research for: Agents Room v1.2 — agent editing, model picker, presets CRUD, dedicated providers page, agent notes*
*Researched: 2026-03-21*
