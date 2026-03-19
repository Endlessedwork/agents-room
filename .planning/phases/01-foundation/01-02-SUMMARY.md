---
phase: 01-foundation
plan: 02
subsystem: api
tags: [ai-sdk, llm, anthropic, openai, google, openrouter, ollama, streaming, vitest]

# Dependency graph
requires:
  - phase: 01-foundation plan 01
    provides: Next.js project bootstrap, package.json with all AI SDK dependencies installed
provides:
  - "src/lib/llm/providers.ts: getModel() registry for all 5 providers with explicit apiKey"
  - "src/lib/llm/gateway.ts: streamLLM() and generateLLM() over unified LLMRequest interface"
  - "tests/llm/gateway.test.ts: 16 unit tests with mocked AI SDK (no real API calls)"
  - "scripts/test-providers.ts: CLI script for manual live provider verification"
affects: [01-03, 01-04, 02-01, 02-02]

# Tech tracking
tech-stack:
  added:
    - ai@6.0.116 (Vercel AI SDK core — streamText, generateText)
    - "@ai-sdk/anthropic@3.0.58 (Claude provider)"
    - "@ai-sdk/openai@3.0.41 (GPT provider)"
    - "@ai-sdk/google@3.0.43 (Gemini provider)"
    - "@openrouter/ai-sdk-provider@2.3.3 (OpenRouter community provider)"
    - "ollama-ai-provider-v2@3.5.0 (Ollama community provider)"
    - "tsx@4.21.0 (TypeScript executor for CLI scripts)"
  patterns:
    - "Provider factory pattern: construct provider at call time with explicit apiKey from config — never from env vars"
    - "TDD RED/GREEN: failing tests committed before implementation"
    - "Unified interface hides provider differences behind LLMRequest"

key-files:
  created:
    - src/lib/llm/providers.ts
    - src/lib/llm/gateway.ts
    - tests/llm/gateway.test.ts
    - scripts/test-providers.ts
  modified:
    - package.json (added test:providers script)

key-decisions:
  - "API keys passed explicitly to provider factories via config parameter — no env var fallback (enforces DB-as-source-of-truth pattern)"
  - "Provider factories constructed at call time, not at module load time (no API key available at import)"
  - "streamLLM returns streamText result object unchanged; callers iterate textStream directly"
  - "generateLLM returns result.text (string) for simple non-streaming use cases"
  - "Ollama defaults to http://localhost:11434/api; configurable via config.baseUrl"

patterns-established:
  - "Pattern: getModel(provider, model, config) — single point of provider construction, add new providers here only"
  - "Pattern: LLMRequest interface — all gateway calls use the same shape; extend here for new fields (maxTokens, etc.)"
  - "Anti-pattern avoided: env var fallback — ai-sdk-v6 reads process.env.ANTHROPIC_API_KEY by default; explicit apiKey! override prevents this"

requirements-completed: [AGNT-02]

# Metrics
duration: 35min
completed: 2026-03-20
---

# Phase 1 Plan 02: LLM Gateway Summary

**Vercel AI SDK v6 gateway unifying 5 providers (Anthropic, OpenAI, Google, OpenRouter, Ollama) behind streamLLM()/generateLLM() with explicit apiKey injection and 16 passing unit tests**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-20T01:34:00Z
- **Completed:** 2026-03-20T01:43:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Provider factory registry maps 5 provider names to AI SDK factory functions; explicit apiKey passed at call time — no env fallback
- Unified gateway interface: streamLLM() for streaming agent turns, generateLLM() for connection testing
- 16 unit tests covering all 5 providers, apiKey wiring, temperature defaults, streamText/generateText parameter forwarding
- CLI integration test script with SKIPPED/OK/FAIL output per provider for manual live verification

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests** - `5c6ba88` (test)
2. **GREEN: providers.ts + gateway.ts** - `9f4140e` (feat)
3. **Task 2: CLI test script** - `00ee866` (feat)

_Note: TDD tasks have multiple commits (test -> feat)_

## Files Created/Modified

- `src/lib/llm/providers.ts` - Provider factory registry with getModel() for 5 providers
- `src/lib/llm/gateway.ts` - Unified LLMRequest interface, streamLLM() and generateLLM() functions
- `tests/llm/gateway.test.ts` - 16 unit tests, all mocked (no real API calls), vi.mock for all factories
- `scripts/test-providers.ts` - CLI manual integration test; reads keys from env, prints SKIPPED/OK/FAIL
- `package.json` - Added test:providers script

## Decisions Made

- API keys are passed explicitly to provider factories (`config.apiKey!`) — the AI SDK defaults to reading `process.env.ANTHROPIC_API_KEY` etc., which would break the DB-as-source-of-truth architecture. Explicit passing prevents the env var fallback.
- Provider instances are created at call time inside `getModel()`, not as module-level singletons. Database keys are only available at request time.
- `streamLLM` returns the `streamText` result object (callers handle `.textStream` iteration); `generateLLM` unwraps `.text` for simpler use.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Executed prerequisite plan 01-01 schema/tests work**

- **Found during:** Pre-execution check
- **Issue:** Plan 01-02 depends on plan 01-01 being executed. The project had no src/ files (only Next.js bootstrap was committed as `feat(01-01)` but DB schema/tests from Task 2 of 01-01 were not yet done).
- **Fix:** Created src/db/schema.ts, src/db/index.ts, tests/setup.ts, and all DB tests (9 passing). Ran drizzle-kit push to verify schema.
- **Files modified:** src/db/schema.ts, src/db/index.ts, tests/setup.ts, tests/db/rooms.test.ts, tests/db/agents.test.ts, tests/db/roomAgents.test.ts
- **Verification:** `npx vitest run tests/db/` passed 9 tests; `npx drizzle-kit push` succeeded
- **Committed in:** 3a5a079

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Required to unblock plan 01-02. No scope creep — completed exactly the work specified in plan 01-01 Task 2.

## Issues Encountered

None during plan 01-02 itself. Prerequisite unblock was the only deviation.

## User Setup Required

None - no external service configuration required for the unit tests.
The CLI script `npx tsx scripts/test-providers.ts` optionally accepts API keys via environment variables for manual live verification.

## Next Phase Readiness

- LLM gateway ready for use by REST API route handlers in Plan 01-03
- `generateLLM()` can be called from `/api/providers/[provider]/test/route.ts` for connection testing
- `streamLLM()` is ready for streaming agent turns in Phase 2 conversation engine
- No blockers for Plan 01-03

---
*Phase: 01-foundation*
*Completed: 2026-03-20*

## Self-Check: PASSED

All created files verified present:
- FOUND: src/lib/llm/providers.ts
- FOUND: src/lib/llm/gateway.ts
- FOUND: tests/llm/gateway.test.ts
- FOUND: scripts/test-providers.ts
- FOUND: .planning/phases/01-foundation/01-02-SUMMARY.md

All task commits verified present:
- FOUND: 5c6ba88 test(01-02): add failing tests for LLM gateway and provider registry
- FOUND: 9f4140e feat(01-02): implement LLM gateway with provider factory registry
- FOUND: 00ee866 feat(01-02): create CLI integration test script for all 5 providers
