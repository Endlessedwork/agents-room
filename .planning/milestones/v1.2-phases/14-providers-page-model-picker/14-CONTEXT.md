# Phase 14: Providers Page + Model Picker - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Provider keys get a dedicated management page at `/providers` (replacing the Settings page provider section), and the model field in AgentForm becomes a live dropdown populated by fetching available models from the selected provider's API. Fallback to free-text input when provider API is unreachable.

</domain>

<decisions>
## Implementation Decisions

### Providers page layout
- Dedicated `/providers` route reusing existing `ProviderCard` component as-is (status dot, API key input, test connection)
- Sidebar: replace "Settings" link with "Providers" — change icon from Settings gear to Key icon
- Settings page either redirects to `/providers` or is removed entirely (no other content on Settings currently)
- No delete/clear key button needed — users can overwrite existing keys, keeping UI simple
- Page header: "Providers" with same max-w-xl layout as current Settings

### Model dropdown behavior
- Replace plain `<Input>` with a searchable combobox (type-to-filter, client-side)
- Fetch model list once when dropdown opens or provider changes (not on every keystroke)
- Model names displayed as raw model IDs (e.g., `claude-sonnet-4-20250514`) — no prettification, users need exact IDs
- Models sorted alphabetically
- Loading state: spinner + "Loading models..." inside dropdown while fetching
- When provider changes, auto-select first model from fetched list (or keep DEFAULT_MODELS fallback if fetch fails)

### Fallback & error states
- 5-second timeout for model list API calls
- Provider not configured (no API key): show "Not configured" status indicator next to provider selector + model field stays as free-text input (don't attempt fetch)
- Fetch error or timeout: show inline warning "Could not fetch models" + fallback to free-text input
- Provider status indicator in AgentForm: small colored dot next to provider name (green = verified, yellow = configured/not tested, gray = not configured) — reuses ProviderCard status pattern

### Model capability tags
- Show capability tags (e.g., "128k", "vision") only when provider API returns this data
- OpenRouter API provides context length + modality — extract and display as small badges
- Anthropic/OpenAI/Google/Ollama: if API doesn't provide capability info, don't display tags — no static/hardcoded capability lists
- Tags are optional enhancement, never block model selection

### Claude's Discretion
- Combobox component choice (shadcn Combobox, custom, or Cmdk-based)
- Per-provider model list API adapter implementation details
- Exact filter matching algorithm (prefix, contains, fuzzy)
- Cache strategy for fetched model lists (if any)
- How to handle OpenAI/OpenRouter model filtering (which models to show vs hide)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Provider management
- `src/components/settings/ProviderCard.tsx` — Existing provider card with status dot, API key input, test connection button
- `src/app/(dashboard)/settings/page.tsx` — Current Settings page (to be replaced/redirected)
- `src/app/api/providers/route.ts` — GET all providers with status
- `src/app/api/providers/[provider]/route.ts` — PUT provider key (upsert)
- `src/app/api/providers/[provider]/test/route.ts` — POST test connection

### Model selection
- `src/components/agents/AgentForm.tsx` — AgentForm with current plain text model input (lines 306-316) and provider select (lines 287-304)
- `src/lib/llm/providers.ts` — Provider factory: `getModel()` with all 5 provider SDK imports
- `src/lib/validations.ts` — Zod schemas for API request bodies

### Navigation
- `src/components/layout/Sidebar.tsx` — Sidebar with Settings link (line 60-63) to be changed to Providers

### Requirements
- `.planning/REQUIREMENTS.md` — MODL-01 through MODL-05 and PROV-01, PROV-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProviderCard` component: fully functional with status management, API key input, test connection — reuse directly on /providers page
- `ProviderStatus` type (`'unconfigured' | 'configured' | 'verified' | 'failed'`): reuse for AgentForm provider status indicator
- `getStatusConfig()` in ProviderCard: status → dot color + label mapping — extract or replicate for AgentForm
- Provider APIs (GET/PUT/test): complete CRUD already exists, no new provider endpoints needed
- shadcn/ui components: Select, Input, Button all available
- `DEFAULT_MODELS` map in AgentForm: useful as fallback when fetch fails

### Established Patterns
- Provider data fetched via `GET /api/providers` returns array with `{ provider, status, apiKey: boolean, baseUrl, lastTestedAt }`
- Settings page uses `useEffect` + `fetch` for provider data — same pattern for /providers page
- AgentForm uses controlled state with `useState` for each field
- Vercel AI SDK providers: each has different model listing API (some may not support it natively)

### Integration Points
- Sidebar: change Settings link → Providers link (src/components/layout/Sidebar.tsx line 60)
- AgentForm: replace `<Input>` at lines 306-316 with combobox component
- New API route needed: `GET /api/providers/[provider]/models` — server-side proxy to fetch model lists from each provider
- AgentForm needs to know provider connection status — either fetch from `/api/providers` or pass as prop

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-providers-page-model-picker*
*Context gathered: 2026-03-21*
