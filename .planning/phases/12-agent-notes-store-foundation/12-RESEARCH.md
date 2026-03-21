# Phase 12: Agent Notes + Store Foundation - Research

**Researched:** 2026-03-21
**Domain:** SQLite schema migration (Drizzle), Zod validation, Zustand store update action, React UI (AgentForm textarea, AgentCard display)
**Confidence:** HIGH

## Summary

Phase 12 is a narrow, well-scoped change: add a `notes` nullable text column to the `agents` table, wire it through the existing validation/API/store stack, and surface it in the two agent UI components (AgentForm for input, AgentCard for display). No new dependencies are required — the project already has Drizzle ORM, Zod 4, Zustand 5, and a Textarea component.

The biggest decision is the migration workflow. STATE.md documents a firm decision: use `drizzle-kit generate + migrate` (not `push`) from Phase 12 onward for auditability. The project has no existing migrations directory (drizzle.config.ts points to `./src/db/migrations`, which does not exist yet), so Phase 12 will produce the first migration file. The test setup in `tests/setup.ts` uses raw SQL `CREATE TABLE` statements that must also be updated to include the new column.

The store currently has no `updateAgent` action — it only has `fetchAgents`, `createAgent`, and `deleteAgent`. Phase 12 adds `updateAgent` to support immediate in-place store mutation after a save (success criterion 3). Because AgentForm currently navigates to `/agents` after save via `router.push`, the notes-save flow for create mode is already covered. An `updateAgent` action in the store is the foundation that Phase 13 (edit form) will depend on heavily, so getting the interface right here matters.

**Primary recommendation:** Add `notes TEXT` (nullable, no default) to the `agents` table via `drizzle-kit generate && drizzle-kit migrate`, extend `createAgentSchema` and `updateAgentSchema` with `.string().nullable().optional()`, add `notes` to the `Agent` TypeScript interface and `updateAgent` to `AgentStore`, then thread the field through `AgentForm` (textarea) and `AgentCard` (conditional display block).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTE-01 | User can add/edit notes on any agent to describe purpose and strengths | Textarea in AgentForm (create mode), notes field wired through schema/API/store |
| NOTE-02 | Notes visible on agent card in the library view | Conditional notes block in AgentCard, rendered from Zustand store state |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 (project) | ORM + query builder for SQLite | Already in use; schema changes via `text('notes')` |
| drizzle-kit | 0.31.10 (project) | Migration generation and execution | `generate` + `migrate` workflow per STATE.md decision |
| zod | 4.3.6 (project) | Request body validation | `createAgentSchema` / `updateAgentSchema` already defined |
| zustand | 5.0.12 (project) | Client state store | `agentStore.ts` already owns agent list; add `updateAgent` |
| better-sqlite3 | 12.8.0 (project) | SQLite driver | Used by both production db and test `createTestDb()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/components/ui/textarea | (local shadcn) | Textarea input component | Notes input in AgentForm — already imported and used in the form |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| drizzle-kit migrate | drizzle-kit push | push is fine for dev-only, but STATE.md locks in generate+migrate for auditability |
| nullable text column | separate notes table | Separate table is massive overkill for a simple text annotation |

**No new installation required.** All libraries are already present.

## Architecture Patterns

### Recommended Project Structure

No new files or directories needed. All changes are in-place modifications to existing files:

```
src/db/
├── schema.ts              # Add notes column to agents table
├── migrations/            # CREATED by drizzle-kit generate (first migration)
│   └── 0000_*.sql         # Generated migration file

src/lib/
└── validations.ts         # Add notes field to createAgentSchema

src/stores/
└── agentStore.ts          # Add notes to Agent interface; add updateAgent action

src/components/agents/
├── AgentForm.tsx           # Add notes textarea field
└── AgentCard.tsx           # Add conditional notes display block

tests/
├── setup.ts               # Add notes column to in-memory CREATE TABLE for agents
└── db/agents.test.ts      # New test: create agent with notes, verify persisted
```

### Pattern 1: Drizzle nullable column addition

**What:** Add an optional text column to an existing table. Nullable columns with no DEFAULT need no backfill — existing rows get NULL automatically.
**When to use:** Any time an optional field is added to an existing table.

```typescript
// src/db/schema.ts — add to agents table definition
notes: text('notes'),   // nullable, no .notNull(), no .default()
```

Then generate + apply migration:
```bash
npx drizzle-kit generate   # produces src/db/migrations/0000_*.sql
npx drizzle-kit migrate    # applies to data/agents-room.db
```

### Pattern 2: Zod schema extension

**What:** Add `notes` as an optional nullable string to both create and update schemas.
**When to use:** Every new column that flows through the API must have matching Zod validation.

```typescript
// src/lib/validations.ts
export const createAgentSchema = z.object({
  // ... existing fields ...
  notes: z.string().nullable().optional(),
});
// updateAgentSchema = createAgentSchema.partial() — automatically inherits notes
```

### Pattern 3: Zustand store updateAgent action

**What:** Add an `updateAgent` action that PUTs to `/api/agents/:id` and mutates the store array in-place.
**When to use:** Any action that modifies an existing item and must reflect immediately in the UI.

```typescript
// src/stores/agentStore.ts — updated Agent interface and store action
export interface Agent {
  // ... existing fields ...
  notes: string | null;
}

// Add to AgentStore interface:
updateAgent: (id: string, data: Partial<Omit<Agent, 'id' | 'createdAt'>>) => Promise<Agent>;

// Implementation (inside create() call):
updateAgent: async (id, data) => {
  const res = await fetch(`/api/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const updated = await res.json();
  set((s) => ({
    agents: s.agents.map((a) => (a.id === id ? updated : a)),
  }));
  return updated;
},
```

### Pattern 4: AgentCard conditional notes display

**What:** Show a notes section only when notes is non-null and non-empty. Avoids any visible block for agents without notes (success criterion 4).
**When to use:** All optional text fields in card displays.

```tsx
{agent.notes && (
  <p className="text-xs text-muted-foreground mt-2 border-t pt-2 line-clamp-3">
    {agent.notes}
  </p>
)}
```

### Pattern 5: AgentForm wired for create mode (Phase 12 scope)

Phase 12 only covers create mode (AgentForm in `/agents/new`). The form currently POSTs then calls `router.push('/agents')`. After the push, the agents page calls `fetchAgents()` on mount — so the notes value will appear after navigation without any store surgery. The `updateAgent` store action added here is foundation for Phase 13 edit mode.

For the notes textarea in AgentForm, follow the exact pattern used by `promptPersonality`, `promptRules`, and `promptConstraints`: a controlled `useState('')` + `Textarea` component + trim-or-null on submit.

### Anti-Patterns to Avoid

- **Adding notes to roomAgents table in Phase 12:** Notes are a library annotation (describe purpose/strengths), not a per-room attribute. Do not copy notes into the `room_agents` table; the copy-on-assign pattern intentionally isolates room copies from library edits.
- **Required notes field:** Notes must be fully optional — no validation requiring a value, no form error shown when empty.
- **Auto-save on blur:** Explicitly out of scope per REQUIREMENTS.md — partial saves cause invalid states.
- **Using `drizzle-kit push` instead of `generate + migrate`:** STATE.md locks this decision. Push is not acceptable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite column migration | Custom `ALTER TABLE` SQL in application code | `drizzle-kit generate + migrate` | drizzle-kit produces a proper migration file in `src/db/migrations/`; manual SQL bypasses the migration audit trail |
| In-place store update | Re-fetch full agent list after every save | Zustand `set((s) => ({ agents: s.agents.map(...) }))` | Re-fetching adds latency and causes flash; map-replace is the Zustand idiomatic pattern |
| Conditional rendering logic | CSS visibility tricks | `{agent.notes && <p>...</p>}` | Simple conditional JSX is the correct React pattern; no empty elements in DOM |

**Key insight:** The full data path (DB column → Drizzle type → Zod schema → API route → Zustand store → React component) is already established by existing fields like `promptPersonality`. Notes follows the exact same path with zero structural novelty.

## Common Pitfalls

### Pitfall 1: Test setup not updated
**What goes wrong:** Tests fail because `tests/setup.ts` has a hardcoded `CREATE TABLE agents (...)` SQL that doesn't include `notes TEXT`. Drizzle will succeed against the live DB but tests will fail on insert or schema-type mismatch.
**Why it happens:** The test DB is built from raw SQL in `tests/setup.ts`, not from the Drizzle schema file. They must be kept in sync manually.
**How to avoid:** After adding `notes` to `schema.ts`, immediately add `notes TEXT` to the agents `CREATE TABLE` statement in `tests/setup.ts`.
**Warning signs:** `tests/db/agents.test.ts` fails on insert when `notes` is passed.

### Pitfall 2: Zod 4 `.nullable().optional()` order
**What goes wrong:** Using `.optional().nullable()` vs `.nullable().optional()` in Zod 4 produces different TypeScript types (`string | undefined | null` vs `string | null | undefined`) — semantically equivalent but worth being consistent with existing field patterns in the file.
**Why it happens:** Zod method chaining order matters for the resulting type signature.
**How to avoid:** Follow the existing pattern in `createAgentSchema`: `z.string().nullable().optional()` (same as `promptPersonality`).

### Pitfall 3: API route not passing notes through
**What goes wrong:** `notes` is accepted by Zod but not included in the `.values({...})` insert call in `POST /api/agents`, so it is silently dropped.
**Why it happens:** The insert in `src/app/api/agents/route.ts` explicitly lists every field. Adding to schema without updating the insert call leaves notes out.
**How to avoid:** Add `notes: parsed.data.notes ?? null` to the `db.insert(agents).values({...})` call in the POST handler.

### Pitfall 4: Agent interface out of sync with API response
**What goes wrong:** The `Agent` TypeScript interface in `agentStore.ts` does not include `notes`, so the field is stripped by TypeScript even if the API returns it. Cards show no notes even when data exists.
**Why it happens:** The interface is manually maintained, not derived from Drizzle's inferred type.
**How to avoid:** Add `notes: string | null` to the `Agent` interface in `agentStore.ts` as part of Phase 12.

### Pitfall 5: First migration file — migrations directory must be committed
**What goes wrong:** `drizzle-kit generate` creates `src/db/migrations/` with SQL files. If the directory is gitignored or not committed, production/CI environments have no migration to apply.
**Why it happens:** New directory, easy to overlook in git add.
**How to avoid:** After generating, verify `src/db/migrations/` appears in `git status` and commit it.

## Code Examples

Verified patterns from the existing codebase:

### Existing nullable field pattern in schema.ts (basis for notes)
```typescript
// Source: src/db/schema.ts line 13
promptPersonality: text('prompt_personality'),
// notes follows exact same pattern:
notes: text('notes'),
```

### Existing nullable field in Zod schema (basis for notes)
```typescript
// Source: src/lib/validations.ts line 24
promptPersonality: z.string().nullable().optional(),
// notes follows exact same pattern:
notes: z.string().nullable().optional(),
```

### Existing Zustand in-place delete (basis for updateAgent map-replace)
```typescript
// Source: src/stores/agentStore.ts line 49
set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
// updateAgent uses map instead of filter:
set((s) => ({ agents: s.agents.map((a) => (a.id === id ? updated : a)) }));
```

### Existing AgentCard optional field display (basis for notes display)
```tsx
// Source: src/components/agents/AgentCard.tsx line 92
{agent.promptRole && (
  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
    {agent.promptRole}
  </p>
)}
// Notes uses same conditional pattern with appropriate sizing
```

### Drizzle migration workflow (per STATE.md decision)
```bash
# Generate migration file into src/db/migrations/
npx drizzle-kit generate

# Apply migration to data/agents-room.db
npx drizzle-kit migrate
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| drizzle-kit push (dev shortcut) | drizzle-kit generate + migrate | STATE.md decision, Phase 12 | First migration file created; all future schema changes go through migrations |

**Deprecated/outdated:**
- `drizzle-kit push`: explicitly superseded by STATE.md decision for auditability. Do not use.

## Open Questions

1. **notes column in roomAgents table**
   - What we know: Notes are described as "describe purpose and strengths" — a library annotation
   - What's unclear: Whether a future phase might want room-specific notes
   - Recommendation: Do NOT add notes to `room_agents` in Phase 12. The copy-on-assign design means room agents are snapshots; annotating the library agent is sufficient and correct. Defer room-agent notes to future requirements if needed.

2. **notes display in AgentForm for edit mode**
   - What we know: Phase 12 explicitly covers create mode; Phase 13 covers edit
   - What's unclear: Whether the state for `notes` in AgentForm needs to accept an initial value (for future edit mode)
   - Recommendation: Wire the `notes` state as `useState('')` for create mode. Phase 13 will pass the existing agent's notes as an initial value. Do not over-engineer for Phase 13 now.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/db/agents.test.ts tests/api/agents.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTE-01 | notes column persists in DB | unit | `npx vitest run tests/db/agents.test.ts` | ✅ (needs new test case) |
| NOTE-01 | createAgentSchema accepts notes field | unit | `npx vitest run tests/api/agents.test.ts` | ✅ (needs new test case) |
| NOTE-01 | notes flows through POST /api/agents | unit | `npx vitest run tests/api/agents.test.ts` | ✅ (needs new test case) |
| NOTE-02 | agent with notes renders notes on card | manual | visual check in browser | N/A — UI component |
| NOTE-02 | agent without notes shows no notes section | manual | visual check in browser | N/A — UI component |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/db/agents.test.ts tests/api/agents.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test case in `tests/db/agents.test.ts` — "create agent with notes — verify notes persisted" (covers NOTE-01 DB layer)
- [ ] New test cases in `tests/api/agents.test.ts` — "createAgentSchema accepts notes", "updateAgentSchema accepts notes" (covers NOTE-01 validation layer)
- [ ] `tests/setup.ts` — add `notes TEXT` to agents `CREATE TABLE` (prerequisite for any test touching notes)

*(Existing test files exist; new test cases and setup update are needed, not new files.)*

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `src/db/schema.ts`, `src/lib/validations.ts`, `src/stores/agentStore.ts`, `src/components/agents/AgentCard.tsx`, `src/components/agents/AgentForm.tsx`, `src/app/api/agents/route.ts`, `src/app/api/agents/[agentId]/route.ts`, `tests/setup.ts`, `tests/db/agents.test.ts`
- `.planning/STATE.md` — confirmed `drizzle-kit generate + migrate` decision
- `.planning/REQUIREMENTS.md` — confirmed NOTE-01 and NOTE-02 scope
- `drizzle.config.ts` — confirmed migrations output directory and DB path

### Secondary (MEDIUM confidence)
- Package.json dependency versions verified via direct file read

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in project, versions read from package.json
- Architecture: HIGH — patterns derived directly from existing analogous fields (promptPersonality) in the same files
- Pitfalls: HIGH — identified by systematic inspection of the data path from schema to UI

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable stack; Drizzle/Zod/Zustand APIs unlikely to change)
