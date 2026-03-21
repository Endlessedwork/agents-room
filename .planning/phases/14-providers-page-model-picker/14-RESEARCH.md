# Phase 14: Providers Page + Model Picker - Research

**Researched:** 2026-03-21
**Domain:** Next.js route creation, provider model listing APIs, @base-ui/react Combobox
**Confidence:** HIGH

## Summary

Phase 14 is a UI-focused phase with two parallel tracks: (1) move the existing Settings page provider content to a dedicated `/providers` route, and (2) replace the AgentForm's free-text model input with a searchable combobox populated by live provider API model lists.

The existing codebase makes track 1 trivial: the Settings page is literally just ProviderCard components rendered in a loop — it can be cloned to `/providers` and the Settings page replaced with a redirect. Track 2 requires a new server-side API route (`GET /api/providers/[provider]/models`) that proxies each provider's model listing endpoint, plus a client-side combobox component using `@base-ui/react` which is already installed.

**Primary recommendation:** Use `@base-ui/react` Combobox (v1.3.0, already installed) for the model picker. Build one new API route as a server-side proxy for model fetching. Copy Settings page content to `/providers`, replace Settings with a redirect.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dedicated `/providers` route reusing existing `ProviderCard` component as-is (status dot, API key input, test connection)
- Sidebar: replace "Settings" link with "Providers" — change icon from Settings gear to Key icon
- Settings page either redirects to `/providers` or is removed entirely (no other content on Settings currently)
- No delete/clear key button needed — users can overwrite existing keys, keeping UI simple
- Page header: "Providers" with same max-w-xl layout as current Settings
- Replace plain `<Input>` with a searchable combobox (type-to-filter, client-side)
- Fetch model list once when dropdown opens or provider changes (not on every keystroke)
- Model names displayed as raw model IDs (e.g., `claude-sonnet-4-20250514`) — no prettification, users need exact IDs
- Models sorted alphabetically
- Loading state: spinner + "Loading models..." inside dropdown while fetching
- When provider changes, auto-select first model from fetched list (or keep DEFAULT_MODELS fallback if fetch fails)
- 5-second timeout for model list API calls
- Provider not configured (no API key): show "Not configured" status indicator next to provider selector + model field stays as free-text input (don't attempt fetch)
- Fetch error or timeout: show inline warning "Could not fetch models" + fallback to free-text input
- Provider status indicator in AgentForm: small colored dot next to provider name (green = verified, yellow = configured/not tested, gray = not configured) — reuses ProviderCard status pattern
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROV-01 | Dedicated /providers page with full CRUD for provider API keys | ProviderCard reuse + new route pattern documented |
| PROV-02 | Provider management moved out of Settings page | Settings redirect pattern documented |
| MODL-01 | User can select model from a dropdown populated by the provider's available models | @base-ui/react Combobox + new /api/providers/[provider]/models route documented |
| MODL-02 | Model picker includes search/filter for large model lists (OpenRouter 400+) | @base-ui/react Combobox filter prop with contains match documented |
| MODL-03 | Model picker falls back to free-text input when provider API is unreachable | Fallback pattern using conditional rendering documented |
| MODL-04 | Provider connection status (connected/not configured) shown next to provider select | ProviderStatus type + getStatusConfig pattern already exists, documented for reuse |
| MODL-05 | Model capabilities shown as tags when available from provider API (e.g. vision, large context) | OpenRouter architecture.input_modalities + context_length fields documented; Anthropic capabilities object documented |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @base-ui/react | 1.3.0 (installed) | Combobox component for searchable model picker | Already in project dependencies, has full Combobox with filter prop |
| Next.js | 16.2.0 (installed) | App router for new /providers route | Project framework |
| lucide-react | 0.577.0 (installed) | Key icon for sidebar | Already used throughout project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AbortController + setTimeout | Built-in browser/Node | 5-second timeout on model fetch | Server-side route for provider API calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @base-ui/react Combobox | cmdk (not installed) | cmdk requires installation; @base-ui/react already present |
| @base-ui/react Combobox | Custom combobox | Significant complexity for accessibility, keyboard nav |
| @base-ui/react Combobox | shadcn Command | shadcn CLI generates code using cmdk under the hood, still requires cmdk |

**Installation:** No new packages required. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── providers/
│   │   │   └── page.tsx          # New: clone of settings/page.tsx with "Providers" heading
│   │   └── settings/
│   │       └── page.tsx          # Changed: redirect to /providers
│   └── api/
│       └── providers/
│           └── [provider]/
│               └── models/
│                   └── route.ts  # New: GET proxy to provider model listing APIs
└── components/
    ├── agents/
    │   ├── AgentForm.tsx          # Changed: replace model Input with ModelCombobox
    │   └── ModelCombobox.tsx      # New: @base-ui/react Combobox wrapper
    └── layout/
        └── Sidebar.tsx            # Changed: Settings → Providers link + Key icon
```

### Pattern 1: New /providers Route
**What:** Clone settings/page.tsx content verbatim, change heading from "Settings" to "Providers"
**When to use:** PROV-01 requires dedicated page at /providers
**Example:**
```typescript
// src/app/(dashboard)/providers/page.tsx
// Identical to settings/page.tsx except:
// - heading: "Providers" instead of "Settings"
// - no other changes needed — ProviderCard works as-is
export default function ProvidersPage() {
  // same useEffect + fetch('/api/providers') logic as settings/page.tsx
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-8">Providers</h1>
      {/* same ProviderCard rendering logic */}
    </div>
  );
}
```

### Pattern 2: Settings Page Redirect
**What:** Replace settings/page.tsx with a simple redirect to /providers
**When to use:** PROV-02 — provider management must leave Settings
**Example:**
```typescript
// src/app/(dashboard)/settings/page.tsx
import { redirect } from 'next/navigation';
export default function SettingsPage() {
  redirect('/providers');
}
```

### Pattern 3: Server-Side Model List Proxy Route
**What:** New API route that reads the provider API key from DB and proxies the model listing request, returning normalized model objects
**When to use:** MODL-01 — client must not expose provider API keys; server proxies the call
**Example:**
```typescript
// src/app/api/providers/[provider]/models/route.ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { providerKeys } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface ModelInfo {
  id: string;
  contextLength?: number;
  capabilities?: string[]; // e.g. ['vision', '128k']
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const keyRow = await db.query.providerKeys.findFirst({
    where: eq(providerKeys.provider, provider as ProviderName),
  });

  if (!keyRow?.apiKey && provider !== 'ollama') {
    return NextResponse.json({ error: 'Not configured' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const models = await fetchModelsForProvider(provider, keyRow, controller.signal);
    clearTimeout(timeout);
    return NextResponse.json({ models });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
```

### Pattern 4: Provider-Specific Model Fetching Adapters
**What:** One function per provider that calls the provider's native model listing API and returns normalized `ModelInfo[]`
**When to use:** Inside the models route — each provider has a different endpoint/format

**Anthropic adapter:**
```typescript
// GET https://api.anthropic.com/v1/models
// Headers: X-Api-Key, anthropic-version: 2023-06-01
// Response: { data: [{ id, display_name, max_input_tokens, capabilities }] }
// Source: https://platform.claude.com/docs/en/api/models-list
async function fetchAnthropicModels(apiKey: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'X-Api-Key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal,
  });
  const data = await res.json();
  return (data.data ?? []).map((m: { id: string; max_input_tokens?: number; capabilities?: { image_input?: { supported: boolean } } }) => ({
    id: m.id,
    contextLength: m.max_input_tokens,
    capabilities: m.capabilities?.image_input?.supported ? ['vision'] : [],
  }));
}
```

**OpenAI adapter:**
```typescript
// GET https://api.openai.com/v1/models
// Headers: Authorization: Bearer {apiKey}
// Response: { data: [{ id, object, owned_by }] }
// No capability info in response. Filter: show only gpt- and o- series.
// Source: https://platform.openai.com/docs/api-reference/models/list
async function fetchOpenAIModels(apiKey: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    signal,
  });
  const data = await res.json();
  return (data.data ?? [])
    .filter((m: { id: string }) => m.id.startsWith('gpt-') || m.id.startsWith('o'))
    .map((m: { id: string }) => ({ id: m.id }));
}
```

**Google adapter:**
```typescript
// GET https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}
// Response: { models: [{ name: "models/gemini-...", displayName, inputTokenLimit, supportedGenerationMethods }] }
// Filter: only models where supportedGenerationMethods includes 'generateContent'
// Source: https://ai.google.dev/api/models
async function fetchGoogleModels(apiKey: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal });
  const data = await res.json();
  return (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent')
    )
    .map((m: { name: string; inputTokenLimit?: number }) => ({
      id: m.name.replace('models/', ''), // strip "models/" prefix
      contextLength: m.inputTokenLimit,
    }));
}
```

**OpenRouter adapter:**
```typescript
// GET https://openrouter.ai/api/v1/models
// Headers: Authorization: Bearer {apiKey}
// Response: { data: [{ id, context_length, architecture: { input_modalities, output_modalities } }] }
// capability tags: check input_modalities for 'image' → 'vision'; format context_length as e.g. '128k'
// Source: https://openrouter.ai/docs/api/api-reference/models/get-models
async function fetchOpenRouterModels(apiKey: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    signal,
  });
  const data = await res.json();
  return (data.data ?? []).map((m: {
    id: string;
    context_length?: number;
    architecture?: { input_modalities?: string[] };
  }) => {
    const caps: string[] = [];
    if (m.architecture?.input_modalities?.includes('image')) caps.push('vision');
    if (m.context_length && m.context_length >= 100000) {
      caps.push(`${Math.round(m.context_length / 1000)}k`);
    }
    return { id: m.id, contextLength: m.context_length, capabilities: caps };
  });
}
```

**Ollama adapter:**
```typescript
// GET {baseUrl}/api/tags (default: http://localhost:11434/api/tags)
// No auth required
// Response: { models: [{ name, size, details: { parameter_size } }] }
// Source: https://docs.ollama.com/api/tags
async function fetchOllamaModels(baseUrl: string, signal: AbortSignal): Promise<ModelInfo[]> {
  const host = baseUrl.replace('/api', ''); // normalize
  const res = await fetch(`${host}/api/tags`, { signal });
  const data = await res.json();
  return (data.models ?? []).map((m: { name: string }) => ({ id: m.name }));
}
```

### Pattern 5: ModelCombobox Component
**What:** `@base-ui/react` Combobox wrapper that handles loading/error/fallback states
**When to use:** Replaces `<Input>` in AgentForm at lines 306-316

```typescript
// src/components/agents/ModelCombobox.tsx
'use client';

import { useState, useEffect } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ModelInfo {
  id: string;
  capabilities?: string[];
}

interface ModelComboboxProps {
  provider: string;
  providerConfigured: boolean; // false = show free-text input immediately
  value: string;
  onChange: (model: string) => void;
}

export function ModelCombobox({ provider, providerConfigured, value, onChange }: ModelComboboxProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!providerConfigured) return;
    setLoading(true);
    setError(false);
    fetch(`/api/providers/${provider}/models`)
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.models ?? []).sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
        setModels(sorted);
        setFetched(true);
        if (sorted.length > 0 && !value) onChange(sorted[0].id);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [provider, providerConfigured]);

  // Fallback: not configured or fetch failed
  if (!providerConfigured || error) {
    return (
      <>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. claude-sonnet-4-20250514" />
        {error && <p className="text-xs text-amber-600 mt-1">Could not fetch models — enter model ID manually.</p>}
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        Loading models...
      </div>
    );
  }

  return (
    <Combobox.Root
      value={value}
      onValueChange={onChange}
      items={models}
      itemToStringLabel={(m) => (m as ModelInfo).id}
      itemToStringValue={(m) => (m as ModelInfo).id}
      filter={(item, query) =>
        (item as ModelInfo).id.toLowerCase().includes(query.toLowerCase())
      }
    >
      <Combobox.InputGroup>
        <Combobox.Input placeholder="Search models..." />
        <Combobox.Trigger />
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {(item) => (
                <Combobox.Item key={(item as ModelInfo).id} value={item}>
                  <span>{(item as ModelInfo).id}</span>
                  {(item as ModelInfo).capabilities?.map((cap) => (
                    <span key={cap} className="ml-2 text-xs bg-muted px-1 rounded">{cap}</span>
                  ))}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
```

### Pattern 6: Provider Status Indicator in AgentForm
**What:** Fetch provider statuses alongside model list; show colored dot next to provider select
**When to use:** MODL-04

```typescript
// In AgentForm, fetch providers status once on mount:
const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});

useEffect(() => {
  fetch('/api/providers')
    .then((r) => r.json())
    .then((data: Array<{ provider: string; status: ProviderStatus }>) => {
      const map: Record<string, ProviderStatus> = {};
      data.forEach((p) => { map[p.provider] = p.status; });
      setProviderStatuses(map);
    });
}, []);

// In the provider select section, add status dot:
const currentProviderStatus = providerStatuses[provider] ?? 'unconfigured';
const isProviderConfigured = currentProviderStatus !== 'unconfigured';
// Render dot using same color logic as ProviderCard's getStatusConfig()
```

### Anti-Patterns to Avoid
- **Fetching models on every keystroke:** Violates project Out of Scope rule "Live typeahead against provider API". Fetch once on provider change.
- **Exposing API keys to client:** The model list fetch MUST go through the server-side route `/api/providers/[provider]/models` — the server reads the key from DB, never sending it to the browser.
- **Hardcoding capability tags:** Decision requires tags only when provider API returns them. No static lists.
- **Attempting model fetch when unconfigured:** Check provider status first; if `unconfigured`, show free-text immediately.
- **Using `next/navigation` redirect in a client component without wrapping:** `redirect()` in a server component is the clean pattern for the Settings page redirect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Searchable dropdown with keyboard nav | Custom dropdown | @base-ui/react Combobox | Accessibility, focus management, ARIA all handled |
| Client-side filtering for 400+ items | Custom filter loop | Combobox.Root `filter` prop | Built-in, performant |
| Combobox positioning (flip, overflow) | CSS positioning logic | Combobox.Positioner (uses floating-ui internally) | Viewport awareness built in |

**Key insight:** @base-ui/react Combobox is already installed and handles all the hard parts of an accessible combobox including virtual scroll-friendly rendering, keyboard navigation (arrow keys, Escape, Enter), and ARIA attributes.

## Common Pitfalls

### Pitfall 1: OpenAI Model List Bloat
**What goes wrong:** The OpenAI `/v1/models` endpoint returns ALL models including fine-tuned models, embeddings, whisper, dall-e, tts — potentially 100+ entries. Showing all of them overwhelms users.
**Why it happens:** OpenAI's API is not filtered to chat models by default.
**How to avoid:** Filter to models where `id.startsWith('gpt-') || id.startsWith('o')` — this covers GPT-4, GPT-4o, o1, o3 families without including unrelated models. Validate against live response during implementation.
**Warning signs:** If dropdown shows "whisper-1", "dall-e-3", "text-embedding" entries, filter is wrong.

### Pitfall 2: OpenRouter Models Endpoint Requires Auth Header
**What goes wrong:** OpenRouter's `/api/v1/models` returns fewer models (or different pricing tiers) when called without auth, vs with a valid API key.
**Why it happens:** OpenRouter shows user-specific model availability when authenticated.
**How to avoid:** Always pass `Authorization: Bearer {apiKey}` even for the model listing call.
**Warning signs:** 401 response or unexpectedly short model list.

### Pitfall 3: Google Model Name Format
**What goes wrong:** Google's model listing returns names in the format `models/gemini-2.0-flash` — but the API call uses just `gemini-2.0-flash` without the prefix.
**Why it happens:** REST resource naming convention; the SDK strips the prefix automatically but direct API calls don't.
**How to avoid:** Strip the `models/` prefix when extracting model IDs: `m.name.replace('models/', '')`. Also filter to only `generateContent`-supporting models.
**Warning signs:** API calls fail with "model not found" error if full resource path is stored.

### Pitfall 4: Ollama baseUrl Format
**What goes wrong:** The stored `baseUrl` for Ollama is the API base (e.g., `http://localhost:11434/api`) but the model listing endpoint is `{host}/api/tags` — using baseUrl directly would make `http://localhost:11434/api/api/tags`.
**Why it happens:** `providers.ts` uses `http://localhost:11434/api` as the default base, matching Vercel AI SDK conventions.
**How to avoid:** Derive the host from baseUrl by stripping the `/api` suffix, then append `/api/tags`: `const host = (baseUrl ?? 'http://localhost:11434').replace(/\/api$/, ''); fetch(\`${host}/api/tags\`)`.
**Warning signs:** 404 on Ollama model listing.

### Pitfall 5: @base-ui/react Combobox Item Rendering Pattern
**What goes wrong:** The `Combobox.List` children function pattern (`{(item) => ...}`) is specific to @base-ui/react and differs from other combobox libraries. Using standard `.map()` inside `Combobox.List` will not work correctly.
**Why it happens:** @base-ui/react uses a render-prop pattern for virtualization-friendly list rendering.
**How to avoid:** Use the function-as-children pattern shown in docs and Pattern 5 above.
**Warning signs:** TypeScript errors on Combobox.List children prop type.

### Pitfall 6: Anthropic Models API Pagination
**What goes wrong:** Anthropic's `/v1/models` defaults to 20 models per page. If only one page is fetched, newer models may be missing.
**Why it happens:** API pagination — `has_more: true` signals more pages exist.
**How to avoid:** Pass `?limit=100` to get up to 100 models in one request (avoids pagination for a typical model count).
**Warning signs:** Missing expected models like newer Claude versions.

### Pitfall 7: Next.js 16 Async Params
**What goes wrong:** Forgetting to `await params` in the new models route, leading to type errors or undefined provider.
**Why it happens:** Next.js 16 changed route params to be a Promise.
**How to avoid:** Follow established pattern from existing routes: `const { provider } = await params;`
**Warning signs:** TypeScript error `Property 'provider' does not exist on type 'Promise<...>'`.

## Code Examples

### Sidebar Change (Locked)
```typescript
// Source: existing src/components/layout/Sidebar.tsx, line 60-63
// Change:
import { Key, Users, Plus } from 'lucide-react'; // Settings → Key
// <Link href="/settings"> → <Link href="/providers">
// <Settings size={16} /> → <Key size={16} />
// "Settings" → "Providers"
```

### Extracting getStatusConfig for Reuse
```typescript
// Extract from ProviderCard.tsx into a shared util, or duplicate inline in AgentForm:
// The function is small (12 lines) — inline duplication is acceptable
function getStatusConfig(status: ProviderStatus) {
  // Returns { dotClass, textClass, label } matching existing ProviderCard pattern
}
```

### AgentForm Provider Status Row
```typescript
// Wrap the existing Select with a flex container:
<div className="flex items-center gap-2">
  <Select value={provider} onValueChange={handleProviderChange} className="flex-1">
    {/* existing SelectItems */}
  </Select>
  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusConfig(currentProviderStatus).dotClass}`} />
  <span className={`text-xs ${getStatusConfig(currentProviderStatus).textClass} whitespace-nowrap`}>
    {getStatusConfig(currentProviderStatus).label}
  </span>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text model input | Searchable combobox | Phase 14 | Users no longer need to memorize exact model IDs |
| Settings page for providers | Dedicated /providers route | Phase 14 | Settings page becomes empty → can be a simple redirect |
| cmdk-based combobox (shadcn default) | @base-ui/react Combobox | Phase 14 | No additional dependency needed |

**Deprecated/outdated:**
- Settings page provider section: moves to /providers in this phase

## Open Questions

1. **OpenAI model filter heuristics**
   - What we know: Response includes embeddings, dall-e, whisper, tts models alongside chat models
   - What's unclear: Are there o-series models (o1, o3) that don't start with `o` in the ID?
   - Recommendation: Filter `id.startsWith('gpt-') || /^o\d/.test(id)` and validate against live API during implementation. Make filter a named constant for easy adjustment.

2. **Anthropic capabilities tags display**
   - What we know: API returns `capabilities.image_input.supported` and `capabilities.thinking.supported`
   - What's unclear: Whether to show "thinking" as a tag (CONTEXT says show tags when API returns data — thinking is returned by API)
   - Recommendation: Show "vision" for image_input and "thinking" for thinking capability. Document this choice in implementation.

3. **OpenRouter 400+ models — should there be a "free only" filter?**
   - What we know: OpenRouter has free models (`:free` suffix) and paid models. Users may want to filter to free only.
   - What's unclear: No explicit decision in CONTEXT.md
   - Recommendation: Show all models — no filter. The client-side search handles discoverability. A "free" filter is out of scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/api/providers.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-01 | /providers route exists and renders ProviderCards | smoke | Manual browser check | ❌ Wave 0 (UI-only, no API logic) |
| PROV-02 | /settings redirects to /providers | smoke | Manual browser check | ❌ Wave 0 (UI redirect) |
| MODL-01 | GET /api/providers/[provider]/models returns model list | unit | `npx vitest run tests/api/providers.test.ts` | ❌ Wave 0 |
| MODL-02 | Model list filtered client-side by input query | unit | Not automated (component logic) | N/A — manual |
| MODL-03 | Models route returns 400 when provider unconfigured | unit | `npx vitest run tests/api/providers.test.ts` | ❌ Wave 0 |
| MODL-04 | Provider status shown in AgentForm | smoke | Manual browser check | N/A — UI only |
| MODL-05 | Capability tags from OpenRouter API response | unit | `npx vitest run tests/api/providers.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/providers.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/providers.test.ts` — covers MODL-01, MODL-03, MODL-05 (models route unit tests with mocked fetch)

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `src/components/settings/ProviderCard.tsx`, `src/app/(dashboard)/settings/page.tsx`, `src/components/agents/AgentForm.tsx`, `src/components/layout/Sidebar.tsx` — full understanding of existing code
- Codebase direct read — `src/app/api/providers/route.ts`, `src/app/api/providers/[provider]/route.ts`, `src/app/api/providers/[provider]/test/route.ts` — existing API patterns
- Codebase direct read — `package.json` — confirmed @base-ui/react 1.3.0 installed, cmdk not installed
- Codebase direct read — `node_modules/@base-ui/react/combobox/index.d.ts` — confirmed Combobox exported with Root, Input, InputGroup, Popup, List, Item
- WebFetch of base-ui.com/react/components/combobox — Combobox usage pattern (HIGH: official docs)
- WebFetch of platform.claude.com/docs/en/api/models-list — Anthropic `/v1/models` response format with capabilities object
- WebFetch of openrouter.ai/docs/api/api-reference/models/get-models — OpenRouter `/api/v1/models` response with `architecture.input_modalities`, `context_length`
- WebFetch of ai.google.dev/api/models — Google models endpoint, `models/` prefix, `generateContent` filter

### Secondary (MEDIUM confidence)
- WebSearch for OpenAI `/v1/models` — response format (`{ data: [{ id, owned_by }] }`) — verified against openai.com docs reference link
- WebSearch for Ollama `/api/tags` — response format (`{ models: [{ name, details }] }`) — verified against ollama.com docs link

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages inspected directly in node_modules
- Architecture: HIGH — existing code read directly, provider APIs fetched from official docs
- Pitfalls: HIGH (codebase-derived) / MEDIUM (provider API filtering) — API quirks verified against docs
- Provider API response formats: HIGH (Anthropic, OpenRouter, Google via official docs) / MEDIUM (OpenAI, Ollama via search + doc links)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (provider API formats stable; @base-ui/react API could change on major version)
