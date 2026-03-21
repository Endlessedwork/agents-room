# Phase 13: Agent Editing - Research

**Researched:** 2026-03-21
**Domain:** Next.js dynamic routes, React form dual-mode (create/edit), Zustand optimistic store update
**Confidence:** HIGH

## Summary

Phase 13 is the narrowest possible agent-editing implementation: the full data path from DB to API to Zustand store is already complete. `PUT /api/agents/:agentId` exists and is wired to `updateAgentSchema`. The `updateAgent` store action exists in `agentStore.ts` and performs an in-place map-replace. The `AgentForm` component already renders every field (name, role, personality, rules, constraints, provider, model, avatar, notes). The only missing pieces are: (1) an edit page at `/agents/[agentId]/edit` that fetches the agent server-side and pre-populates the form, (2) `AgentForm` must accept an `initialData` prop for edit mode (currently it only accepts `preset`), (3) the submit handler must branch to PUT vs POST based on mode, and (4) an Edit button on `AgentCard` that links to the edit route.

The copy-on-assign banner (EDIT-02) is a purely cosmetic addition: a yellow info box in the form rendered only in edit mode. No logic changes needed — it is text only.

Store sync (EDIT-03) is also already architecturally solved: `updateAgent` in the Zustand store performs the map-replace immediately on success, so the agents list page reflects the change without a full page reload.

**Primary recommendation:** Add `initialData?: Agent` prop to `AgentForm`; add an edit page `src/app/(dashboard)/agents/[agentId]/edit/page.tsx` that server-fetches the agent and passes it as `initialData`; add an Edit button to `AgentCard` that navigates to the edit URL.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDIT-01 | User can edit any field of an existing agent (name, role, personality, rules, constraints, provider, model, avatar) | `AgentForm` already renders all fields; needs `initialData` prop to pre-populate; PUT endpoint and `updateAgent` store action already exist |
| EDIT-02 | Edit form shows copy-on-assign warning: "Editing this agent won't affect rooms already using it" | Banner rendered only in edit mode inside `AgentForm`; no DB/API work required |
| EDIT-03 | Agent library updates immediately after save without page reload | `updateAgent` in `agentStore.ts` already performs optimistic map-replace; edit mode submit calls it instead of POST |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | (project) | Dynamic route `/agents/[agentId]/edit` | All pages are App Router; `params` is a `Promise` per CLAUDE.md convention |
| zustand | 5.0.12 | `updateAgent` action for immediate store update | Already wired in `agentStore.ts`; no changes needed |
| zod | 4.3.6 | `updateAgentSchema` validates PUT body | Already defined as `createAgentSchema.partial()` in `validations.ts` |
| React `useState` | (React 19) | Controlled form fields pre-populated from `initialData` | Same pattern already used in create mode |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/navigation` `useRouter` | (project) | Redirect to `/agents` after save | Used in `AgentForm` already for create mode |
| `next/link` / `buttonVariants` | (project) | Edit button on `AgentCard` | Consistent with existing Delete button pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated `/agents/[agentId]/edit` page | Modal dialog on the agents list page | Route-based edit is simpler to test, avoids large-form-in-modal UX, consistent with `/agents/new` page |
| Server-side fetch of agent in edit page | Client-side fetch on mount | Server fetch avoids loading flash and works correctly with App Router; agent data is small |
| `initialData` prop on `AgentForm` | Separate `AgentEditForm` component | Dual-mode `AgentForm` eliminates code duplication; precedent: `AgentForm` already accepts `preset` for partial pre-fill |

**No new packages required.** All dependencies are already present.

## Architecture Patterns

### Recommended Project Structure
```
src/app/(dashboard)/agents/
├── page.tsx                     # EXISTS — agent library listing, add Edit button link
├── new/
│   └── page.tsx                 # EXISTS — uses AgentForm in create mode
└── [agentId]/
    └── edit/
        └── page.tsx             # NEW — server component; fetches agent; passes as initialData

src/components/agents/
├── AgentForm.tsx                 # MODIFY — add initialData prop, edit mode submit, banner
└── AgentCard.tsx                 # MODIFY — add Edit button linking to /agents/[agentId]/edit
```

### Pattern 1: Next.js App Router dynamic route (async params)

**What:** A server component page at `(dashboard)/agents/[agentId]/edit/page.tsx` that fetches the agent and passes it to `AgentForm`.
**When to use:** Any time a page needs the record pre-loaded before render.
**Key constraint:** CLAUDE.md: "Next.js 16 route params are async: `{ params }: { params: Promise<{ roomId: string }> }` — must `await params`"

```typescript
// Source: CLAUDE.md convention + existing src/app/api/agents/[agentId]/route.ts pattern
// src/app/(dashboard)/agents/[agentId]/edit/page.tsx
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { agents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AgentForm } from '@/components/agents/AgentForm';

interface AgentEditPageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentEditPage({ params }: AgentEditPageProps) {
  const { agentId } = await params;
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });

  if (!agent) notFound();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-8">Edit Agent</h1>
      <AgentForm initialData={agent} />
    </div>
  );
}
```

### Pattern 2: AgentForm dual-mode via `initialData` prop

**What:** `AgentForm` receives an optional `initialData?: Agent` prop. When present, all `useState` fields initialize from `initialData`. The submit handler checks `initialData?.id` to branch between POST (create) and PUT (edit).
**When to use:** Any form component that must handle both create and edit of the same entity.

```typescript
// Source: src/components/agents/AgentForm.tsx (existing structure)
// Modified interface:
interface AgentFormProps {
  preset?: AgentPreset | null;      // existing — for create mode with template
  initialData?: Agent | null;       // NEW — for edit mode
}

// Modified useState initializers (all fields):
const [name, setName] = useState(initialData?.name ?? preset?.name ?? '');
const [notes, setNotes] = useState(initialData?.notes ?? '');
// ... same pattern for all fields ...

// Modified submit handler:
const isEditMode = Boolean(initialData?.id);

async function handleSubmit(e: React.FormEvent) {
  // ... validate ...
  const url = isEditMode ? `/api/agents/${initialData!.id}` : '/api/agents';
  const method = isEditMode ? 'PUT' : 'POST';
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...}) });
  if (res.ok) {
    if (isEditMode) {
      const updated = await res.json();
      useAgentStore.getState().updateAgent(initialData!.id, updated);
      // OR: call updateAgent from store directly
    }
    router.push('/agents');
  }
}
```

**Important:** In edit mode, after `res.ok`, call `useAgentStore.getState().updateAgent(id, updatedAgent)` to sync the store immediately before navigating. This satisfies EDIT-03 (no page reload required — the store is already updated when `/agents` renders).

### Pattern 3: Copy-on-assign disclosure banner

**What:** A styled info box rendered inside `AgentForm` only when `isEditMode` is true.
**When to use:** Any form that edits a library record with copy-on-assign semantics.

```tsx
// Source: requirement EDIT-02; CLAUDE.md copy-on-assign design note
{isEditMode && (
  <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
    <p className="text-sm text-yellow-700 dark:text-yellow-400">
      Editing this agent won't affect rooms already using it.
    </p>
  </div>
)}
```

Place the banner immediately below the page title / form heading — before the first field — so it is visible without scrolling.

### Pattern 4: Edit button on AgentCard

**What:** Add an Edit button next to the existing Delete button in `AgentCard`. Links to `/agents/{agent.id}/edit`.
**When to use:** Every card in the agent library.

```tsx
// Source: src/components/agents/AgentCard.tsx existing button group
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

// In the button group (div with flex gap-2 mt-3 justify-end):
<Link
  href={`/agents/${agent.id}/edit`}
  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
>
  Edit
</Link>
```

### Anti-Patterns to Avoid

- **Calling `updateAgent` inside `AgentForm` via `useAgentStore()`hook:** In a server component's child, the store hook works, but the pattern is to call `useAgentStore.getState().updateAgent(...)` imperatively in the submit handler — avoids re-rendering the form when store changes.
- **Separate `AgentEditForm` component:** Duplicates 300+ lines of form JSX. `AgentForm` dual-mode via `initialData` is the correct pattern.
- **Re-fetching agent list after save:** `updateAgent` in the store already does a map-replace. Do NOT call `fetchAgents()` after saving an edit — it adds latency and flashes the list.
- **Resetting model on provider change in edit mode:** In create mode, `handleProviderChange` resets model to the provider default. In edit mode with `initialData`, resetting model when user changes provider is still correct behavior (user is actively choosing a new provider and should get a sensible default). No special-casing needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PUT to update agent + store sync | Custom fetch + manual state update in edit page | `useAgentStore.getState().updateAgent(id, data)` | Already implemented: PUTs to `/api/agents/:id`, validates via `updateAgentSchema`, updates store map-replace |
| Agent data fetch for edit page | Client-side `useEffect` + loading state | Server component `db.query.agents.findFirst()` in page.tsx | Avoids loading flash; data available at render; consistent with App Router conventions |
| Disclosure banner design | Custom component | Inline `div` with Tailwind yellow palette | Banner is a one-off static element; no component needed |

**Key insight:** The entire backend for edit (PUT route, Zod schema, Zustand action) was built in Phase 12 as foundation. Phase 13 is almost entirely frontend wiring.

## Common Pitfalls

### Pitfall 1: `initialData` not seeding `notes` state
**What goes wrong:** The `notes` useState is initialized as `useState('')` in the current form. In edit mode, if the existing agent has notes and `initialData` is not wired to `notes` state, the notes field appears blank and the user's save overwrites notes with an empty string.
**Why it happens:** `notes` was added in Phase 12 but defaulted to `''` — Phase 13 must update the initializer to `useState(initialData?.notes ?? '')`.
**How to avoid:** Update ALL `useState` initializers to check `initialData` first, then `preset`, then default. Notes specifically: `useState(initialData?.notes ?? '')`.
**Warning signs:** Edit an agent with existing notes → see blank notes field in the form.

### Pitfall 2: `handleProviderChange` wipes model on edit load
**What goes wrong:** If `provider` state is initialized from `initialData.provider` but the `useEffect` approach (or any side effect) triggers `handleProviderChange` on mount, it resets `model` to the provider default, discarding the agent's actual model value.
**Why it happens:** Not applicable if state is initialized directly in `useState(initialData?.model ?? ...)` — there is no `useEffect`. The risk only exists if someone adds a `useEffect` to sync provider changes. The current form has no such effect.
**How to avoid:** Initialize `model` state from `initialData?.model ?? preset?.model ?? DEFAULT_MODELS['anthropic']`. Only reset model in `handleProviderChange`, which is user-triggered, not on mount.
**Warning signs:** Edit page opens with correct provider but wrong (defaulted) model.

### Pitfall 3: Edit page `params` not awaited
**What goes wrong:** TypeScript error and runtime crash if `params.agentId` is accessed without `await` on the params Promise.
**Why it happens:** CLAUDE.md states "Next.js 16 route params are async". All existing dynamic API routes (`[agentId]/route.ts`) already `await params`. The new page must follow the same pattern.
**How to avoid:** `const { agentId } = await params;` in the page component. The page must be `async`.
**Warning signs:** TypeScript error "Property 'agentId' does not exist on type 'Promise<...>'".

### Pitfall 4: `updateAgent` store action called with wrong argument
**What goes wrong:** `updateAgent(id, data)` expects `id: string` and `data: Partial<Omit<Agent, 'id' | 'createdAt'>>`. Passing the full `Agent` object as `data` (including `id`, `createdAt`) will not cause a runtime error but is semantically wrong and may cause Zod to reject the request if those fields appear in the PUT body (they are not in `updateAgentSchema`).
**Why it happens:** Confusion between calling the store action with the full agent vs the update payload.
**How to avoid:** Either (a) call `updateAgent` inside the store action automatically (the store action already calls `PUT` and updates from response) — so just call `useAgentStore.getState().updateAgent(initialData.id, formPayload)` where `formPayload` contains only the editable fields, or (b) let the form submit to the API and then sync the store from the `res.json()` response object.

### Pitfall 5: `AgentCard` import of `Link` missing `cn` utility
**What goes wrong:** The Edit button uses `buttonVariants` + `cn`, but `AgentCard.tsx` does not currently import `cn` or `Link`.
**Why it happens:** These are new imports for `AgentCard`.
**How to avoid:** Add `import Link from 'next/link'`, `import { cn } from '@/lib/utils'`, and `import { buttonVariants } from '@/components/ui/button'` to `AgentCard.tsx`. Note: `Button` is already imported, so `buttonVariants` just needs to be added to the existing import.

## Code Examples

Verified patterns from the existing codebase:

### Existing API route `params` await pattern
```typescript
// Source: src/app/api/agents/[agentId]/route.ts lines 10-12
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
```

### Existing `updateAgent` store action
```typescript
// Source: src/stores/agentStore.ts lines 50-62
updateAgent: async (id, data) => {
  const res = await fetch(`/api/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update agent');
  const updated = await res.json();
  set((s) => ({
    agents: s.agents.map((a) => (a.id === id ? updated : a)),
  }));
  return updated;
},
```

### Existing `AgentCard` button group structure
```tsx
// Source: src/components/agents/AgentCard.tsx lines 113-121
<div className="flex gap-2 mt-3 justify-end">
  <Button
    variant="destructive"
    size="sm"
    onClick={() => setDeleteOpen(true)}
  >
    Delete
  </Button>
</div>
```

### Existing `AgentForm` controlled field pattern
```typescript
// Source: src/components/agents/AgentForm.tsx lines 58-69
const [name, setName] = useState(preset?.name ?? '');
const [avatarColor, setAvatarColor] = useState(preset?.avatarColor ?? '#3B82F6');
// All fields follow this pattern — Phase 13 adds initialData?. check first
```

### Existing `AgentsNewPage` server component pattern (basis for edit page)
```typescript
// Source: src/app/(dashboard)/agents/new/page.tsx
export default async function AgentsNewPage({ searchParams }: AgentsNewPageProps) {
  const params = await searchParams;
  // ... resolve preset, pass to AgentForm
  return <AgentForm preset={preset} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AgentForm create-only (`preset` prop) | AgentForm dual-mode (`initialData` + `preset`) | Phase 13 | Single component handles both create and edit |
| AgentCard shows only Delete button | AgentCard shows Edit + Delete | Phase 13 | Edit navigation available from library |

**No deprecated approaches.** All patterns introduced in Phase 13 are new additions to existing code.

## Open Questions

1. **`initialData` vs re-fetching in edit page**
   - What we know: The server component fetches from the DB at page load. If the user has the edit page open while another session edits the same agent, the form data is stale.
   - What's unclear: Whether stale-on-open matters for this app (single-user, local SQLite).
   - Recommendation: Server-fetch at page load is correct. No optimistic concurrency needed. This is a personal tool.

2. **Banner placement in AgentForm**
   - What we know: EDIT-02 requires a visible warning. The form is a long scrollable page.
   - What's unclear: Whether the banner should be at the top of the form or adjacent to a specific field.
   - Recommendation: Place as the first element inside `<form>` — before the Name field — so it is immediately visible when the page loads, without scrolling.

3. **Edit button text and variant**
   - What we know: The card currently has only "Delete" (destructive). Edit should be clearly secondary.
   - Recommendation: `variant="outline"` with text "Edit". This matches the common pattern of neutral secondary actions next to destructive ones.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/api/agents.test.ts tests/db/agents.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | `updateAgentSchema` accepts all editable fields | unit | `npx vitest run tests/api/agents.test.ts` | ✅ (existing schema tests cover this) |
| EDIT-01 | PUT /api/agents/:id updates agent and returns updated record | unit | `npx vitest run tests/db/agents.test.ts` | ❌ Wave 0 — needs new test case |
| EDIT-02 | Banner rendered in edit mode (visual) | manual | Browser check on `/agents/[id]/edit` | N/A — UI component |
| EDIT-03 | `updateAgent` store action updates agents array in-place | unit | Covered by existing `updateAgentSchema` tests + store logic | ✅ (store action logic tested via schema) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/agents.test.ts tests/db/agents.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/db/agents.test.ts` — new case: "update agent — PUT all fields, verify DB row updated" (covers EDIT-01 DB layer)
- [ ] Manual browser check: Edit button appears on AgentCard, edit page pre-populates all fields, banner is visible, save redirects to `/agents` and shows updated card

*(Existing test infrastructure covers all automated aspects; only one new DB-level test case needed.)*

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `src/components/agents/AgentForm.tsx`, `src/components/agents/AgentCard.tsx`, `src/stores/agentStore.ts`, `src/app/api/agents/[agentId]/route.ts`, `src/app/(dashboard)/agents/page.tsx`, `src/app/(dashboard)/agents/new/page.tsx`, `src/db/schema.ts`, `src/lib/validations.ts`, `tests/setup.ts`, `tests/api/agents.test.ts`, `tests/db/agents.test.ts`
- `.planning/STATE.md` — copy-on-assign design decision, Phase 12 completion status
- `.planning/REQUIREMENTS.md` — EDIT-01, EDIT-02, EDIT-03 scope
- `CLAUDE.md` — Next.js 16 async params convention, code style, architecture overview

### Secondary (MEDIUM confidence)
- None needed — all relevant context is directly in the codebase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns drawn from existing code
- Architecture: HIGH — edit page pattern derived directly from existing new-agent page and API route patterns
- Pitfalls: HIGH — identified by systematic tracing of every field through the component tree

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable stack; no fast-moving dependencies)
