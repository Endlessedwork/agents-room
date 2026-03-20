# Phase 6: Room Configuration UI - Research

**Researched:** 2026-03-20
**Domain:** React/Next.js form UI wiring, Zod validation, REST PATCH pattern, shadcn/ui Base UI components
**Confidence:** HIGH

---

## Summary

Phase 6 closes the last two UI-to-DB wiring gaps in the room creation flow: `turnLimit` and `speakerStrategy`. Both fields already exist in the DB schema (confirmed by reading `src/db/schema.ts`) and are already consumed by `ConversationManager` (confirmed by reading `src/lib/conversation/manager.ts`). The gap is purely in the frontend (`RoomWizard.tsx`) and the API route (`POST /api/rooms`), which today ignore these fields. No migrations are required.

The work has three parallel tracks: (1) extend `createRoomSchema` in `validations.ts` to accept the two new optional fields with sane defaults, (2) wire the POST body in `RoomWizard.handleCreate` to include `turnLimit` and `speakerStrategy`, and (3) add a new Step inside the wizard (or extend Step 1) to surface controls for both fields. A fourth, optional track is a PATCH `/api/rooms/[roomId]` endpoint to allow editing these settings after creation — worth considering given AGNT-05 mentions "per room" which implies edit-in-place.

The UI components already in the repo (`Slider` wrapping Base UI, `Select` wrapping Base UI) are exactly the right primitives. `Slider` handles `turnLimit` (numeric range) and `Select` handles `speakerStrategy` (enum choice). Both are confirmed installed and functional from Phase 1 work.

**Primary recommendation:** Add a new Step 2 ("Settings") between existing Step 1 (Name) and Step 2 (Agents) in RoomWizard, exposing `turnLimit` via `Slider` (range 5–100, default 20) and `speakerStrategy` via `Select` (two options: round-robin / llm-selected). Extend `createRoomSchema` to accept both with defaults. Wire `handleCreate` to pass them to the POST body. Optionally, add a PATCH endpoint plus a settings drawer on the room detail page for post-creation editing.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGNT-04 | User can set a configurable turn limit per conversation session | `turnLimit` column already in `rooms` table; `ConversationManager.start()` already reads `room.turnLimit`; gap is only in wizard UI and POST schema |
| AGNT-05 | User can configure speaker selection strategy per room (round-robin or LLM-selected) | `speakerStrategy` enum column already in `rooms` table (`'round-robin'|'llm-selected'`); `SpeakerSelector` already reads `room.speakerStrategy`; gap is only in wizard UI and POST schema |
</phase_requirements>

---

## Gap Analysis (What Exactly Is Missing)

### What DB already has (no migration needed)
```sql
turn_limit INTEGER NOT NULL DEFAULT 20
speaker_strategy TEXT NOT NULL DEFAULT 'round-robin'
  CHECK(speaker_strategy IN ('round-robin', 'llm-selected'))
```
Source: `src/db/schema.ts` lines 43–48. Tests in `tests/setup.ts` already include both columns.

### What the API is missing
`POST /api/rooms` route at `src/app/api/rooms/route.ts` line 46–49 inserts only `{ id, name, topic }`. It never passes `turnLimit` or `speakerStrategy`, so they always use DB defaults.

`createRoomSchema` at `src/lib/validations.ts` lines 3–6 has no fields for these values.

There is no `PATCH /api/rooms/[roomId]` endpoint at all — only `GET` and `DELETE` exist.

### What the frontend is missing
`RoomWizard.handleCreate()` at line 113–116 posts `{ name, topic }` only. No controls for `turnLimit` or `speakerStrategy` exist anywhere in the wizard.

`RoomDetail` interface at `src/app/(dashboard)/rooms/[roomId]/page.tsx` line 13–23 already includes `turnLimit` — the page already receives it from the GET endpoint. `speakerStrategy` is not in that interface yet.

---

## Standard Stack

### Core (all already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react` | ^1.3.0 | Slider, Select primitives | Already used via shadcn wrappers in `src/components/ui/` |
| `zod` | ^4.3.6 | Schema validation | Already used for all route validation |
| `zustand` | ^5.0.12 | Client store for room state | Already used in `roomStore.ts` |
| `drizzle-orm` | ^0.45.1 | DB query/update | Already used everywhere |
| `next` | ^16.2.0 | Route handlers | Already used |

**No new packages needed.** All required UI primitives (`Slider`, `Select`) are confirmed present in `src/components/ui/`.

### shadcn/ui Base UI Note (HIGH confidence — verified in source)
This project uses `@base-ui/react` (not Radix UI). The existing `Slider` component (`src/components/ui/slider.tsx`) wraps `SliderPrimitive.Root` from `@base-ui/react/slider`. Its `value` prop accepts a **number array** (e.g. `[20]`) not a scalar.

The `Select` component (`src/components/ui/select.tsx`) wraps `SelectPrimitive.Root` from `@base-ui/react/select`. Its `value` prop accepts a string. The `onValueChange` callback is available on `SelectPrimitive.Root`.

---

## Architecture Patterns

### Recommended Project Structure (no new files beyond one wizard change)

Files to modify:
```
src/
├── lib/validations.ts               # extend createRoomSchema + add updateRoomSchema
├── app/api/rooms/route.ts            # extend POST handler to pass turnLimit + speakerStrategy
├── app/api/rooms/[roomId]/route.ts   # add PATCH handler (new method, same file)
├── components/rooms/RoomWizard.tsx   # add Step 2 "Settings" with Slider + Select
└── stores/roomStore.ts               # optionally extend Room type + createRoom signature
```

No new files needed for AGNT-04/05. Everything is in-place editing of existing files.

### Pattern 1: Extending createRoomSchema with Defaults

**What:** Add optional `turnLimit` and `speakerStrategy` to the Zod schema. Use `.default()` so the DB default is mirrored at the validation layer.
**When to use:** Always — API routes must validate before touching DB.
**Example:**
```typescript
// src/lib/validations.ts
export const createRoomSchema = z.object({
  name: z.string().min(1).max(60),
  topic: z.string().max(280).optional(),
  turnLimit: z.number().int().min(5).max(100).default(20),
  speakerStrategy: z.enum(['round-robin', 'llm-selected']).default('round-robin'),
});
```

Note: Zod v4 `.default()` fills in the value when the field is absent from input, so the POST body does not need to include these fields if the user accepts defaults.

### Pattern 2: PATCH Endpoint for Room Settings

**What:** `PATCH /api/rooms/[roomId]` that accepts partial room update (turnLimit, speakerStrategy, name, topic). Uses Drizzle `update().set().where()`.
**When to use:** When user edits settings after creation.
**Example:**
```typescript
// In src/app/api/rooms/[roomId]/route.ts — add PATCH handler
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const body = await req.json();
  const parsed = updateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const updated = await db
    .update(rooms)
    .set(parsed.data)
    .where(eq(rooms.id, roomId))
    .returning();
  if (!updated.length) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }
  return NextResponse.json(updated[0]);
}
```

Corresponding schema:
```typescript
export const updateRoomSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  topic: z.string().max(280).optional(),
  turnLimit: z.number().int().min(5).max(100).optional(),
  speakerStrategy: z.enum(['round-robin', 'llm-selected']).optional(),
});
```

### Pattern 3: RoomWizard Step Addition

**What:** Insert a new step "Settings" (becomes Step 2 out of 4, renumbering Agents to Step 3 and Review to Step 4) — OR add the fields to existing Step 1 "Name" to avoid renumbering. The Step 1 append approach is simpler.
**When to use:** Adding fields to an existing step avoids renumbering step indicators and step-state array. Preferred unless UX clarity demands a separate step.
**Step layout recommendation:** Add `turnLimit` and `speakerStrategy` to Step 1 below the Topic field — they are room-level metadata, not agent-level. This avoids adding a 4th step to a 3-step wizard.

```typescript
// State additions in RoomWizard
const [turnLimit, setTurnLimit] = useState<number>(20);
const [speakerStrategy, setSpeakerStrategy] = useState<'round-robin' | 'llm-selected'>('round-robin');
```

Slider usage (value is number array):
```tsx
<Slider
  value={[turnLimit]}
  onValueChange={(vals) => setTurnLimit(vals[0])}
  min={5}
  max={100}
  step={5}
/>
<span className="text-sm text-muted-foreground">{turnLimit} turns</span>
```

Select usage:
```tsx
<Select value={speakerStrategy} onValueChange={(v) => setSpeakerStrategy(v as 'round-robin' | 'llm-selected')}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="round-robin">Round-Robin</SelectItem>
    <SelectItem value="llm-selected">LLM-Selected</SelectItem>
  </SelectContent>
</Select>
```

### Pattern 4: POST Body Extension in handleCreate

```typescript
body: JSON.stringify({
  name: roomName.trim(),
  topic: topic.trim() || undefined,
  turnLimit,           // add
  speakerStrategy,     // add
}),
```

### Anti-Patterns to Avoid
- **Adding DB migration for turnLimit/speakerStrategy:** These columns already exist. Do not touch `drizzle.config.ts` or run `drizzle-kit push` — migration is already in place.
- **Passing turnLimit as an array to the API:** The Slider component uses `[20]` (array) internally; extract `vals[0]` before storing in state and posting to API.
- **Forgetting room.speakerStrategy in GET /api/rooms/:roomId response:** The GET currently returns the full row via Drizzle `.query.rooms.findFirst()` with `with: {roomAgents, messages}` — Drizzle includes all columns automatically. No API change needed for the GET; only the frontend type needs `speakerStrategy` added to its interface.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Range input for turnLimit | `<input type="range">` from scratch | `<Slider>` from `src/components/ui/slider.tsx` | Already installed, accessible, themed via Tailwind |
| Dropdown for speakerStrategy | `<select>` HTML element or custom dropdown | `<Select>` components from `src/components/ui/select.tsx` | Already installed, accessible, portal-positioned correctly |
| Client-side validation | Manual field checks in handlers | Zod `createRoomSchema` — extend it | Consistent with all other routes in the project |

**Key insight:** All building blocks exist. This phase is about wiring, not building.

---

## Common Pitfalls

### Pitfall 1: Slider value prop is an array, not a scalar
**What goes wrong:** `value={turnLimit}` (number) throws a type error or silently fails; the Slider renders incorrectly.
**Why it happens:** `@base-ui/react/slider` `Root.Props.value` is typed as `number[]` (supports range sliders with multiple thumbs).
**How to avoid:** Always pass `[turnLimit]` and extract with `onValueChange={(vals) => setTurnLimit(vals[0])}`.
**Warning signs:** TypeScript error on the `value` prop; slider thumb not showing at correct position.

### Pitfall 2: createRoomSchema default() vs DB default
**What goes wrong:** If Zod `.default(20)` is not added to the schema, the POST body from the wizard always includes `turnLimit`, but the existing schema rejects it as an unknown key (Zod v4 uses `z.object().strict()` semantics in some configurations) or silently strips it.
**Why it happens:** Zod strips unknown fields by default in v4 `object` unless `passthrough()` is used.
**How to avoid:** Add `turnLimit` and `speakerStrategy` explicitly to `createRoomSchema` — not just to the POST handler's insert call.
**Warning signs:** POST returns 400 validation error, or turnLimit always saves as 20 regardless of wizard input.

### Pitfall 3: POST route inserts only name+topic (hard-coded)
**What goes wrong:** Even after extending the schema, the DB insert at `src/app/api/rooms/route.ts` line 46–49 currently passes only `{ id, name, topic }` to Drizzle. The new fields are parsed but silently discarded.
**Why it happens:** The insert call must be updated to spread `parsed.data` or explicitly include the new fields.
**How to avoid:** Change insert to `{ id, name: parsed.data.name, topic: parsed.data.topic ?? null, turnLimit: parsed.data.turnLimit, speakerStrategy: parsed.data.speakerStrategy }`.
**Warning signs:** DB rows always have `turn_limit=20` and `speaker_strategy='round-robin'` regardless of what the wizard submits.

### Pitfall 4: speakerStrategy missing from RoomDetail TypeScript interface
**What goes wrong:** The `RoomDetail` interface in `src/app/(dashboard)/rooms/[roomId]/page.tsx` and `ChatViewProps` in `ChatView.tsx` currently omit `speakerStrategy`. Passing it from the page will fail TypeScript compilation.
**Why it happens:** The GET endpoint returns the full DB row including `speakerStrategy`, but the frontend interfaces were defined before this field was needed in the UI.
**How to avoid:** Add `speakerStrategy: 'round-robin' | 'llm-selected'` to `RoomDetail`, `ChatViewProps`, and `ChatHeaderProps` if the header needs to display it.
**Warning signs:** TypeScript errors in `page.tsx` or `ChatView.tsx` when accessing `room.speakerStrategy`.

### Pitfall 5: Editing settings while conversation is running
**What goes wrong:** If a PATCH endpoint allows changing `turnLimit` or `speakerStrategy` while `status='running'`, the live `ConversationManager` loop uses cached values from its initial `start()` call and ignores the DB change mid-run.
**Why it happens:** The manager reads `room.turnLimit` once at start, then runs with a local `turnLimit` variable.
**How to avoid:** Either (a) guard the PATCH to reject updates when `status='running'`|`'paused'`, or (b) document clearly that changes take effect on next start. Option (a) is safer and simpler for v1.
**Warning signs:** User changes limit from 20→5 during a run; conversation continues past turn 5.

---

## Code Examples

Verified patterns from source code:

### Existing Select usage pattern (from AgentForm.tsx equivalent)
The project's existing agent form uses native HTML selects, but the shadcn `Select` is available and has been confirmed to work via `@base-ui/react/select`. The API is:

```tsx
// Source: src/components/ui/select.tsx
<Select value={value} onValueChange={(v) => setValue(v)}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="round-robin">Round-Robin</SelectItem>
    <SelectItem value="llm-selected">LLM-Selected</SelectItem>
  </SelectContent>
</Select>
```

### Existing Slider usage pattern
```tsx
// Source: src/components/ui/slider.tsx — value is number[]
<Slider
  value={[turnLimit]}
  onValueChange={(vals) => setTurnLimit(vals[0])}
  min={5}
  max={100}
  step={5}
/>
```

### Drizzle PATCH pattern (consistent with existing routes)
```typescript
// Source: src/app/api/rooms/[roomId]/route.ts (pattern — PATCH not yet added)
const updated = await db
  .update(rooms)
  .set({ turnLimit: parsed.data.turnLimit, speakerStrategy: parsed.data.speakerStrategy })
  .where(eq(rooms.id, roomId))
  .returning();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Radix UI Select/Slider | `@base-ui/react` Select/Slider (no `asChild`) | Phase 1 decision | Must use Base UI API — no Radix patterns |
| shadcn `Button` with `asChild` | `buttonVariants + Link` pattern | Phase 1 decision | Not relevant for this phase (no nav CTAs) |
| Wizard posts only `{name, topic}` | Wizard should post `{name, topic, turnLimit, speakerStrategy}` | Phase 6 target | Gap to close |

**Deprecated/outdated:**
- `createRoomSchema` without `turnLimit`/`speakerStrategy`: becomes outdated in Phase 6; update it.

---

## Open Questions

1. **Should settings be editable post-creation?**
   - What we know: Requirements say "per room" for AGNT-05, implying persistent per-room config not just at creation time. The RoomDetail page already displays `turnLimit` in ChatHeader. No PATCH endpoint exists today.
   - What's unclear: Whether an in-place edit UI on the room detail page is required for v1, or if the wizard-only approach satisfies AGNT-04/05.
   - Recommendation: Include a `PATCH /api/rooms/[roomId]` endpoint (minimal effort, high future value) but defer the room detail UI edit surface to keep Phase 6 scope tight. The planner should decide whether to make PATCH a task.

2. **Turn limit range (5–100 or different bounds)?**
   - What we know: DB has no CHECK constraint on `turn_limit` beyond the column type (INTEGER). ConversationManager uses whatever value is stored. The only hard constraints are positive integer and "reasonable" UX range.
   - What's unclear: Whether power users might want > 100 turns.
   - Recommendation: Use 5–100 for v1 slider. Allow manual Input as fallback if needed. The Zod schema can enforce the range.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/api/rooms.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGNT-04 | `createRoomSchema` accepts `turnLimit` (int, min 5, max 100) | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ (extend existing) |
| AGNT-04 | `createRoomSchema` rejects `turnLimit < 5` and `> 100` | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ (extend existing) |
| AGNT-04 | POST `/api/rooms` persists `turnLimit` to DB | unit (DB layer) | `npx vitest run tests/api/rooms.test.ts` | ✅ (extend existing) |
| AGNT-04 | DB insert with explicit `turnLimit` returns correct value | unit | `npx vitest run tests/db/rooms.test.ts` | ✅ (extend existing) |
| AGNT-05 | `createRoomSchema` accepts `speakerStrategy` enum values | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ (extend existing) |
| AGNT-05 | `createRoomSchema` rejects invalid `speakerStrategy` | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ (extend existing) |
| AGNT-05 | POST persists `speakerStrategy` to DB | unit (DB layer) | `npx vitest run tests/api/rooms.test.ts` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/rooms.test.ts tests/db/rooms.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. Tests only need new test cases added to existing files, not new files created.

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `src/db/schema.ts` — confirmed `turnLimit` and `speakerStrategy` columns exist, types, and defaults
- Direct source read: `src/lib/validations.ts` — confirmed `createRoomSchema` has no turnLimit/speakerStrategy fields
- Direct source read: `src/app/api/rooms/route.ts` — confirmed POST handler inserts only name/topic
- Direct source read: `src/app/api/rooms/[roomId]/route.ts` — confirmed no PATCH handler exists
- Direct source read: `src/components/rooms/RoomWizard.tsx` — confirmed POST body is `{name, topic}` only
- Direct source read: `src/components/ui/slider.tsx` — confirmed Base UI Slider, value is `number[]`
- Direct source read: `src/components/ui/select.tsx` — confirmed Base UI Select API
- Direct source read: `src/lib/conversation/manager.ts` — confirmed `room.turnLimit` and `room.speakerStrategy` already consumed
- Direct source read: `tests/setup.ts` — confirmed test DB schema already includes both columns
- Direct source read: `vitest.config.ts` — confirmed test runner setup

### Secondary (MEDIUM confidence)
- `package.json` inspection — confirmed `@base-ui/react ^1.3.0`, `zod ^4.3.6`, `drizzle-orm ^0.45.1`, no migration needed

### Tertiary (LOW confidence)
- None — all findings backed by primary source reads.

---

## Metadata

**Confidence breakdown:**
- Gap analysis: HIGH — verified by reading actual source files
- Standard stack: HIGH — all packages confirmed in package.json and component source
- Architecture: HIGH — all patterns derived from existing codebase conventions
- Pitfalls: HIGH — derived from reading actual code; not speculative

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase, no fast-moving dependencies relevant to this phase)
