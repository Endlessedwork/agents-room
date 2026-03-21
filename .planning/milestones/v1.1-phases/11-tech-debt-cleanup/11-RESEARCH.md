# Phase 11: Tech Debt Cleanup - Research

**Researched:** 2026-03-21
**Domain:** TypeScript type correctness, dead code removal, API query optimization
**Confidence:** HIGH

## Summary

Phase 11 addresses three discrete, self-contained cleanup tasks. Each is a straightforward surgical edit with no risk of breaking production behavior:

1. **DEBT-01** — `ConversationPanel.tsx` is a dead file. It is exported but never imported anywhere in the app. Safe to delete; `npm run build` will pass once removed.

2. **DEBT-02** — Test files accumulate TypeScript errors from Vercel AI SDK v6 type changes. The mocks return objects typed for an older SDK shape. Two distinct error categories must be fixed: (a) `StreamTextResult` mocks missing 27+ required fields — the fix is to cast mock return values with `as unknown as ReturnType<typeof streamLLM>` at the `vi.mock` factory level and in `makeMockStream()`; (b) `LanguageModel` mock objects reference `doGenerate` which no longer exists on `LanguageModel` in AI SDK v6 (the type is now a union of `GlobalProviderModelId | LanguageModelV3 | LanguageModelV2`, not a directly-accessible interface with `doGenerate`); (c) `LanguageModelUsage` now requires `inputTokenDetails`, `outputTokenDetails`, and `totalTokens` fields; (d) `agent.name` not present in `buildContext`'s agent parameter type.

3. **DEBT-03** — The room detail endpoint (`GET /api/rooms/:roomId`) eagerly loads `messages: true`, returning all messages in the payload. The only consumer (`src/app/(dashboard)/rooms/[roomId]/page.tsx`) destructures only `id`, `name`, `topic`, `status`, `turnLimit`, `speakerStrategy`, `parallelFirstRound`, and `roomAgents` — never `messages`. Drop the `messages: true` from the `with` clause.

**Primary recommendation:** Execute tasks in order DEBT-01 (delete), DEBT-03 (one-line fix), DEBT-02 (type fix in 3 test files). Confirm success gates: build passes, tsc passes, response payload inspection.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-01 | Remove orphaned ConversationPanel.tsx | File confirmed dead — zero imports in codebase |
| DEBT-02 | Fix test file TypeScript errors | tsc --noEmit reveals 3 files with errors; fix patterns documented below |
| DEBT-03 | Narrow room detail endpoint to avoid over-fetching | GET /api/rooms/:roomId returns `messages: true`; no consumer uses it |
</phase_requirements>

## Standard Stack

No new libraries required. All work is type fixes and code deletion within existing stack.

### Core (relevant to fixes)
| Library | Version | Purpose | Why Relevant |
|---------|---------|---------|--------------|
| ai (Vercel AI SDK) | ^6.0.116 | LLM streaming | Source of type drift — mocks must match SDK v6 types |
| @ai-sdk/provider | (peer) | LanguageModel interface | `LanguageModel` is now union type; `doGenerate` is on LanguageModelV3 not on LanguageModel export |
| drizzle-orm | ^0.45.1 | Database ORM | `with:` clause controls eager loading |
| vitest | (dev) | Test runner | Mock typing strategy |

### Installation
No new packages needed.

## Architecture Patterns

### DEBT-01: Dead File Deletion

`ConversationPanel.tsx` lives at `src/components/rooms/ConversationPanel.tsx`. Grep confirms it is exported but never imported:

```
grep -rn "ConversationPanel" src/   # returns only the file itself
```

Safe to delete with `rm src/components/rooms/ConversationPanel.tsx`. Build will pass.

### DEBT-02: Test Type Fix Patterns

#### Category A — StreamTextResult mock shape

`streamLLM` returns `StreamTextResult<ToolSet, Output<string, string, never>>` which has 31+ required members. Tests mock it with `{ textStream, usage }` — a partial shape. The idiomatic Vitest fix is to type-cast at the mock boundary:

```typescript
// In vi.mock factory — cast to silence structural mismatch
vi.mock('@/lib/llm/gateway', () => ({
  streamLLM: vi.fn().mockReturnValue({
    textStream: (async function* () {
      yield 'mock ';
      yield 'response';
    })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
  } as unknown as ReturnType<typeof import('@/lib/llm/gateway').streamLLM>),
}));
```

For `makeMockStream()` helper functions, add `as unknown as ReturnType<typeof streamLLM>` to the return statement.

The deeper fix — if stricter mocking is desired — is to use `vi.mocked(streamText).mockReturnValue(...)` with `as any` only in the gateway test, which already does this correctly.

#### Category B — AsyncIterableStream vs AsyncGenerator

`textStream` must be `AsyncIterableStream<string>` which is `AsyncIterable<T> & ReadableStream<T>`. A plain `AsyncGenerator` satisfies `AsyncIterable` but not `ReadableStream`. The `as unknown as ReturnType<...>` cast in Category A covers this simultaneously — no separate fix needed.

#### Category C — LanguageModelUsage shape

`LanguageModelUsage` in AI SDK v6 requires:
```typescript
{
  inputTokens: number | undefined;
  inputTokenDetails: { noCacheTokens, cacheReadTokens, cacheWriteTokens };
  outputTokens: number | undefined;
  outputTokenDetails: { textTokens, reasoningTokens };
  totalTokens: number | undefined;
}
```

Test mocks only provide `{ inputTokens: 10, outputTokens: 5 }`. Same `as unknown as ReturnType<...>` cast resolves this at the mock boundary — no need to expand every usage mock object.

#### Category D — LanguageModel mock missing `doGenerate` property

`gateway.test.ts` mocks return objects with `specificationVersion: 'v1'` and `doGenerate` — but in AI SDK v6, `LanguageModel` is typed as `GlobalProviderModelId | LanguageModelV3 | LanguageModelV2`. The string union `GlobalProviderModelId` (e.g. `"alibaba/qwen-3-14b"`) causes `model.doGenerate` to error because TS sees the string branch as not having that property.

The test accesses `doGenerate` only to assert `.toBeDefined()` — the intent is to verify factory functions return a usable model object. The correct fix is to use a type assertion at the access site:

```typescript
// Instead of: expect(model.doGenerate).toBeDefined()
expect((model as any).doGenerate).toBeDefined();
```

Or cast the mock return in each provider factory mock to `unknown as LanguageModel` and check a property that definitely exists on a constructed model (like `modelId`). The least invasive fix is `(model as any).doGenerate`.

#### Category E — agent.name not in buildContext type

`ContextService.buildContext` accepts `agent: { id, promptRole, promptPersonality?, promptRules?, promptConstraints? }` — no `name` field.

In `manager.test.ts` line 461, the test spy reads `agent.name` inside `mockImplementation`. Fix options:
1. Widen the spy mock's agent parameter to accept `any`
2. Use `(agent as any).name`

Option 2 is minimal — single cast at the access point.

### DEBT-03: Remove messages from room detail endpoint

File: `src/app/api/rooms/[roomId]/route.ts`

Current:
```typescript
const room = await db.query.rooms.findFirst({
  where: eq(rooms.id, roomId),
  with: {
    roomAgents: true,
    messages: true,   // <-- remove this line
  },
});
```

Target:
```typescript
const room = await db.query.rooms.findFirst({
  where: eq(rooms.id, roomId),
  with: {
    roomAgents: true,
  },
});
```

The only caller (`src/app/(dashboard)/rooms/[roomId]/page.tsx`) defines `RoomDetail` interface without a `messages` field and never accesses `data.messages`. Messages are loaded separately via `chatStore` which calls `/api/rooms/:roomId/messages`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Type-safe mock for StreamTextResult | Custom full StreamTextResult implementation | `as unknown as ReturnType<typeof streamLLM>` cast at mock boundary |
| Suppress TS errors on LanguageModel | Add `doGenerate` to mocked object with all V3 fields | `(model as any).doGenerate` — intent preserved, zero mock bloat |

**Key insight:** The errors are purely at the test/mock boundary. Production code and the SDK are aligned. The fix is targeted type assertions at mock boundaries — not structural changes to production code.

## Common Pitfalls

### Pitfall 1: Using `as any` on the streamLLM mock function signature
**What goes wrong:** Casting `streamLLM` itself as `any` loses type checking on call parameters, defeating the purpose of typed mocks.
**How to avoid:** Cast only the *return value* of `mockReturnValue()` / `makeMockStream()`, not the mock function itself. Keep `vi.mocked(streamLLM)` typed.

### Pitfall 2: Deleting ConversationPanel before confirming no dynamic imports
**What goes wrong:** Next.js allows `dynamic(() => import('...'))` which grep misses.
**How to avoid:** Run `grep -rn "ConversationPanel" src/` before deleting — confirmed zero results beyond the file itself.

### Pitfall 3: Removing messages from the GET route breaks the PATCH/DELETE response
**What goes wrong:** Only the GET handler uses the `with` clause — PATCH returns `updated[0]` from `.returning()` which doesn't load relations at all. DELETE returns `{ ok: true }`. No secondary consumers affected.
**How to avoid:** Check all handlers in the file — confirmed only GET is affected.

### Pitfall 4: `tsc --noEmit` vs `npm run build` scope
**What goes wrong:** `tsc --noEmit` checks all files including `tests/`. `npm run build` only compiles `src/`. DEBT-02 requires tsc to pass on test files, DEBT-01 requires the build to pass. They are separate gates.
**How to avoid:** Run both checks independently after completing each task.

## Code Examples

### Correct mock pattern for StreamTextResult (AI SDK v6)
```typescript
// Source: AI SDK v6 type inspection (node_modules/ai/dist/index.d.ts)
import type { streamLLM } from '@/lib/llm/gateway';

function makeMockStream(yields: string[] = ['mock ', 'response']) {
  return {
    textStream: (async function* () {
      for (const chunk of yields) {
        yield chunk;
      }
    })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
  } as unknown as ReturnType<typeof streamLLM>;
}
```

### Correct mock pattern for LanguageModel in gateway.test.ts
```typescript
// (model as any).doGenerate instead of model.doGenerate
it('returns LanguageModel for anthropic', () => {
  const model = getModel('anthropic', 'claude-3-haiku-20240307', { apiKey: 'test-key' });
  expect(model).toBeDefined();
  expect((model as any).doGenerate).toBeDefined();
});
```

### Drizzle query without messages relation
```typescript
// Source: src/app/api/rooms/[roomId]/route.ts (target state)
const room = await db.query.rooms.findFirst({
  where: eq(rooms.id, roomId),
  with: {
    roomAgents: true,
  },
});
```

## State of the Art

| Old Pattern | Current Pattern | Impact |
|-------------|-----------------|--------|
| LanguageModel as V1 interface with doGenerate | LanguageModel = GlobalProviderModelId \| LanguageModelV3 \| LanguageModelV2 | Mock assertions need `as any` |
| LanguageModelUsage: { inputTokens, outputTokens } | LanguageModelUsage: { inputTokens, inputTokenDetails, outputTokens, outputTokenDetails, totalTokens } | Mock objects need cast at boundary |
| StreamTextResult minimal shape | StreamTextResult has 31 required members | Mock returns need `as unknown as ReturnType<...>` |

## Open Questions

None. All three requirements have clear, verifiable fixes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (version in package.json devDependencies) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/llm/gateway.test.ts tests/conversation/manager.test.ts tests/conversation/manager-sse.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-01 | ConversationPanel.tsx absent, build passes | smoke | `npm run build` | N/A (deletion) |
| DEBT-02 | tsc reports zero errors on test files | type-check | `npx tsc --noEmit` | Existing tests |
| DEBT-03 | GET /api/rooms/:roomId response has no messages field | manual inspect or unit | `npx vitest run tests/api/rooms.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (DEBT-02) / `npm run build` (DEBT-01)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run build` passes AND `npx tsc --noEmit` reports zero errors

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. No new test files needed; the work is fixing existing tests.

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `src/components/rooms/ConversationPanel.tsx` — confirmed dead (no imports)
- Direct file inspection: `src/app/api/rooms/[roomId]/route.ts` — confirmed `messages: true` in GET, no consumer uses it
- `node_modules/ai/dist/index.d.ts` — verified `StreamTextResult` shape, `LanguageModelUsage` shape, `AsyncIterableStream` type
- `node_modules/@ai-sdk/provider/dist/index.d.ts` — verified `LanguageModel` union type, `LanguageModelV2`/`V3` interfaces
- `npx tsc --noEmit` output — authoritative error list with file/line references

### Secondary (MEDIUM confidence)
- N/A — all findings from direct code inspection

## Metadata

**Confidence breakdown:**
- DEBT-01 (dead file): HIGH — grep of entire src/ confirms zero imports
- DEBT-02 (type errors): HIGH — tsc output is authoritative; fix patterns verified against SDK types
- DEBT-03 (over-fetching): HIGH — single consumer confirmed, RoomDetail interface verified

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable work, no fast-moving dependencies)
