# Feature Research

**Domain:** Agent management features for multi-agent LLM conversation app (v1.2 milestone)
**Researched:** 2026-03-21
**Confidence:** HIGH

## Context: What Already Exists

This is a subsequent milestone. The following is already built and working:

- Agent create/delete with structured prompts (role, personality, rules, constraints) and avatar
- Model specified as free-text string per agent (no dropdown, no validation)
- Provider key management embedded in Settings page (with test-connection)
- 3 hardcoded preset templates (Devil's Advocate, Code Reviewer, Researcher) rendered as read-only cards with a "Use Template" link — cannot be edited or deleted
- Copy-on-assign agent-to-room binding
- PUT `/api/agents/:agentId` route already exists (`updateAgentSchema` is `createAgentSchema.partial()`)
- Schema has `presetId` column on `agents` table (nullable string)
- `providerKeys` table fully functional with status tracking

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Agent editing | Any CRUD app supports edit. A library of agents with no edit forces delete-and-recreate — obviously broken workflow. | LOW | API route already exists. Need: edit page/dialog + Edit button on AgentCard. AgentForm must become reusable for both create and edit modes. |
| Model picker dropdown | Free-text model input is error-prone. Every serious LLM tool (ChatGPT, LM Studio, Open WebUI, TypingMind) provides a model picker. The current free-text field silently accepts misspelled model names that only fail at runtime during a conversation. | MEDIUM | Requires server-side proxy routes per provider. Fallback to free-text if fetch fails or provider unconfigured. See provider API reference section below. |
| Dedicated Providers page | Settings pages with mixed concerns are confusing. Provider management is a distinct, frequently-needed action (checking connection status, rotating keys) and deserves its own route. | LOW | Move existing ProviderCard components from `/settings` to `/providers`. The ProviderCard component is fully functional — this is a navigation and layout change, not a new feature. Add sidebar nav link. |
| Agent notes | Users build libraries of agents and need to track why each exists, when to use it, known strengths and weaknesses. Without notes, context is lost when the agent name alone is not self-explanatory. | LOW | Requires: `notes` column added to `agents` table (TEXT, nullable), migration, field in AgentForm, display in AgentCard. Notes are library-level metadata — do NOT copy to roomAgents (room agents are operational copies, not annotated entries). |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| User-created preset CRUD | Built-in presets are hardcoded in a .ts file — they cannot be modified, deleted, or created by the user. Allowing users to save agents as named presets turns the library into a composition tool: design a persona once, reuse across rooms with one click. | MEDIUM | Two flows: (1) "Save as preset" action on an existing agent — writes a record to a new `presets` table. (2) Preset management — list, rename, delete user presets. System presets (hardcoded) remain separate from user-defined ones to avoid migration complexity. Requires new DB table. |
| Model picker with search/filter | OpenRouter exposes 400+ models. A flat dropdown is unusable at that scale. Filtering by name or modality makes the picker practical. | LOW-MEDIUM | Only valuable for OpenRouter. For Anthropic/OpenAI/Google, model lists are short enough that filtering is unnecessary. For Ollama, list reflects only locally-pulled models. Add a search input to the dropdown for OpenRouter only. |
| Provider connection status inline in agent form | When configuring an agent, knowing the selected provider's connection status (verified / not configured) prevents saving an agent that will fail at runtime. | LOW | Read from existing providerKeys data already available via `/api/providers`. Show a status dot next to the provider select. No new API route needed. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-save agent fields on blur | Feels modern and frictionless | Partial saves during multi-field edits can leave agents in invalid states; the PUT route validation requires at least `name` and `promptRole` — intermediate blur states may fail validation silently | Explicit save button with loading state (already the pattern in the codebase) |
| Real-time model list refresh in dropdown | Ensure dropdown always shows current models | Provider APIs can be slow or rate-limited; adds latency to every form open; for Ollama, list changes only when user pulls a model locally | Fetch once on form open; provide a manual "refresh" button if the user needs to re-fetch |
| Sync agent library edits to existing room agents | Prevent stale room agent configs | Breaks the copy-on-assign design decision made deliberately in v1.0; room conversations in progress would have configs mutated under them mid-conversation | Copy-on-assign is the correct design — add a UI note: "Editing this agent won't affect rooms already using it" |
| Cascade-delete presets when agents reference them | Cleanup feels natural | Agents referencing a deleted preset would need their presetId nulled out; cascading logic adds failure paths | Allow preset deletion, null out `presetId` on orphaned agents (set-null FK pattern, already used for `sourceAgentId` on roomAgents) |
| Live model search via typeahead against provider API | Feels responsive | Provider APIs are not designed for typeahead; rate limiting and latency make this impractical; increases API usage costs | Fetch full model list once on form open, filter client-side |

---

## Feature Dependencies

```
Agent Editing
    └──requires──> AgentForm refactored into create/edit modes
                       └──enables──> Agent Notes field (appears in same form)
                       └──enables──> "Save as Preset" action (acts on an existing edited agent)
    └──unblocks──> User Preset CRUD (preset management UX assumes agents can be edited)

Model Picker Dropdown
    └──requires──> Server-side proxy route: GET /api/providers/:provider/models
                       └──requires──> providerKeys with stored API keys (already exists)
    └──integrates into──> AgentForm (model field becomes picker, same form used for create + edit)
    └──independent of──> Agent Editing (can be built in parallel)

Agent Notes
    └──requires──> DB migration (add notes TEXT column to agents table)
    └──requires──> AgentForm refactored for edit mode (same form renders notes field)
    └──independent of──> Model Picker, Presets, Providers page

Dedicated Providers Page
    └──requires──> New route /providers + sidebar nav link
    └──requires──> Move ProviderCard usage from settings/page.tsx to providers/page.tsx
    (no cross-dependencies — fully self-contained)

User Preset CRUD
    └──requires──> New presets table + DB migration
    └──requires──> Agent Editing (natural flow: edit agent → save as preset)
    └──enhances──> Agent Library (user presets appear alongside hardcoded ones in the templates section)
```

### Dependency Notes

- **Agent editing requires AgentForm refactor:** The current AgentForm always POSTs to `/api/agents`. For edit mode it must accept an `agent` prop, prefill all fields, and PUT to `/api/agents/:agentId` on submit. This is the central refactor that unlocks notes and presets.
- **Model picker requires a proxy route:** Provider APIs require the stored API key, which must be injected server-side. A direct client-side fetch would expose keys or fail CORS. Pattern: `GET /api/providers/:provider/models` fetches the provider API using the stored key and returns a normalized list.
- **Notes requires only a DB migration:** One nullable TEXT column on `agents`. The column is not added to `roomAgents` — room agents are operational copies, not the annotated source record.
- **Dedicated providers page has no cross-dependencies:** Can be built first in any phase without affecting other features. Recommended as a quick win to start the milestone.
- **User preset CRUD is the most design-heavy feature:** Requires deciding how user presets are displayed alongside system presets, whether presets are editable in place, and what "delete preset" means for agents that used it.

---

## MVP Definition

### This Milestone (v1.2) — All Five Features

Recommended build order based on dependency graph and risk:

- [ ] **Dedicated Providers page** — LOW complexity, zero risk, no dependencies. Move existing components to `/providers`.
- [ ] **Agent editing** — LOW complexity (API exists). Central refactor that unblocks notes and presets.
- [ ] **Agent notes** — TRIVIAL once editing form is refactored. One migration, one field.
- [ ] **Model picker dropdown** — MEDIUM complexity. Isolated feature; parallel to notes. Highest implementation risk due to provider API variability.
- [ ] **Agent presets CRUD** — MEDIUM complexity. Builds on editing. Comes last because it is the most UX-design-heavy and requires a new DB table.

### Defer to v2+

- [ ] **Agent versioning** — Track history of prompt changes per agent. Requires a history table and diff UI.
- [ ] **Agent import/export (JSON)** — Share agent configs across instances. No immediate need for a single-user personal tool.
- [ ] **Bulk agent operations** — Delete multiple, assign multiple to a room simultaneously.
- [ ] **Room agent editing** — Edit a room-specific copy of an agent without touching the library. High complexity, low immediate need.
- [ ] **Agent tags/categories** — Organize larger libraries. Needed when library grows beyond ~20 agents.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Agent editing | HIGH | LOW | P1 |
| Dedicated Providers page | HIGH | LOW | P1 |
| Agent notes | MEDIUM | LOW | P1 |
| Model picker dropdown | HIGH | MEDIUM | P1 |
| User preset CRUD | MEDIUM | MEDIUM | P2 |
| Provider status indicator in agent form | LOW | LOW | P3 — include if in same sprint as model picker |
| Model list search/filter (OpenRouter) | LOW | LOW | P3 — include if model picker is built |

**Priority key:**
- P1: Must have for v1.2
- P2: High confidence, include in v1.2 scope
- P3: Nice to have, include if time permits within the milestone

---

## Provider Model API Reference

Confirmed endpoints per provider (verified against official docs):

| Provider | List Models Endpoint | Auth | Response Key | Model ID Field |
|----------|---------------------|------|--------------|----------------|
| Anthropic | `GET https://api.anthropic.com/v1/models` | `X-Api-Key` header + `anthropic-version` header | `data` array | `id` field |
| OpenAI | `GET https://api.openai.com/v1/models` | Bearer token | `data` array | `id` field |
| Google | `GET https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}` | Query param API key | `models` array | `name` field (strip `models/` prefix) |
| OpenRouter | `GET https://openrouter.ai/api/v1/models` | Bearer token (optional for public list) | `data` array | `id` field |
| Ollama | `GET http://{host}/api/tags` | None (local) | `models` array | `name` field |

**Implementation pattern for proxy route:**

Each provider has a different response shape. The proxy route at `GET /api/providers/:provider/models` should normalize the response to a flat array of `{ id: string, name: string }` for uniform consumption by the dropdown. If the provider is unconfigured or the fetch fails, return a 503 or empty array — the form falls back to free-text input.

**OpenAI model list note:** The `/v1/models` endpoint returns all models including deprecated and fine-tuned ones. Filter to keep only chat-completion models by checking that the `id` contains common prefixes (`gpt-`, `o1`, `o3`, `o4`) or by checking `owned_by: "openai"`.

**Confidence on API endpoints:** HIGH for all five providers — verified against official documentation.

---

## Sources

- Anthropic List Models API: https://platform.claude.com/docs/en/api/models-list (HIGH — official docs, verified)
- OpenAI List Models API: https://platform.openai.com/docs/api-reference/models/list (HIGH — official docs)
- Google Generative AI models REST: https://ai.google.dev/api/rest/v1beta/models (MEDIUM — referenced in official API index)
- OpenRouter models endpoint: https://openrouter.ai/docs/api/api-reference/models/get-models (HIGH — verified via WebFetch, returns `id`, `name`, pricing metadata)
- Ollama list models: https://docs.ollama.com/api/tags (HIGH — official Ollama docs, endpoint `/api/tags`)
- Existing codebase analysis: schema.ts, AgentForm.tsx, AgentPresets.ts, AgentCard.tsx, ProviderCard.tsx, settings/page.tsx, api/agents/[agentId]/route.ts

---

*Feature research for: Agents Room v1.2 — Agent Management milestone*
*Researched: 2026-03-21*
