---
phase: 14-providers-page-model-picker
plan: 02
subsystem: api
tags: [nextjs, provider-api, model-listing, anthropic, openai, google, openrouter, ollama, abort-controller]

# Dependency graph
requires:
  - phase: 14-providers-page-model-picker
    provides: providerKeys table, ProviderName type, existing route patterns
provides:
  - GET /api/providers/[provider]/models endpoint returning sorted ModelInfo[]
  - ModelInfo interface exported for client consumption
  - Per-provider adapters for all 5 providers with correct API endpoints and auth
  - Capability tag extraction from Anthropic (vision, thinking) and OpenRouter (vision, context length)
affects: [14-03-model-combobox, any future provider-aware UI components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AbortController with 5-second setTimeout for external API timeouts
    - Provider-specific adapter functions (fetchXxxModels) per external API format
    - Export interface from API route for client-side type reuse

key-files:
  created:
    - src/app/api/providers/[provider]/models/route.ts
  modified: []

key-decisions:
  - "Anthropic adapter extracts both vision and thinking capabilities when API reports them"
  - "OpenAI filter uses startsWith('gpt-') || /^o\\d/.test(id) to cover GPT-4, GPT-4o, and o1/o3 families"
  - "OpenRouter context length badge threshold set at >=100k (100,000 tokens)"
  - "Ollama host derived by stripping /api suffix from stored baseUrl to avoid /api/api/tags path"

patterns-established:
  - "Server-side proxy pattern: route reads API key from DB, proxies provider API, never exposes key to client"
  - "Timeout pattern: AbortController + setTimeout(5000) with clearTimeout in both success and error paths"
  - "Provider adapter pattern: one fetchXxxModels function per provider with normalized ModelInfo[] return"

requirements-completed: [MODL-01, MODL-05]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 14 Plan 02: Model Listing API Route Summary

**Server-side proxy route at GET /api/providers/[provider]/models with five provider adapters, 5-second timeout, and capability tag extraction from Anthropic and OpenRouter APIs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T16:08:17Z
- **Completed:** 2026-03-21T16:09:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created GET /api/providers/[provider]/models route for all 5 providers
- Implemented per-provider adapters with correct API endpoints, auth headers, and response normalization
- Added AbortController-based 5-second timeout with proper error codes (504 timeout, 502 fetch failure, 400 unconfigured)
- Extracted vision + thinking capabilities from Anthropic; vision + context length badges from OpenRouter
- Exported ModelInfo interface for client-side type reuse in future model combobox

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GET /api/providers/[provider]/models route with per-provider adapters** - `5b7add4` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `src/app/api/providers/[provider]/models/route.ts` - Server-side proxy for provider model listing APIs with 5 adapters

## Decisions Made
- Anthropic adapter pushes both 'vision' and 'thinking' to capabilities array when API reports them (per RESEARCH.md open question resolution)
- OpenAI filter: `startsWith('gpt-') || /^o\d/.test(id)` to match o1/o3 without matching non-chat models
- OpenRouter context length badge added when context_length >= 100,000 (100k threshold)
- Ollama host normalization strips `/api$` suffix to prevent double `/api/api/tags` path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm run lint` reports pre-existing biome.json schema version mismatch (2.0.0 vs CLI 2.4.8) - this is a known pre-existing out-of-scope issue documented in STATE.md. Build (`npm run build`) succeeds cleanly with TypeScript type checking passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Route ready for client-side model combobox to consume (plan 14-03)
- ModelInfo interface exported from route.ts for direct import by client components
- All 5 providers covered including Ollama (no API key required)

## Self-Check: PASSED
- route.ts exists at src/app/api/providers/[provider]/models/route.ts
- SUMMARY.md exists at .planning/phases/14-providers-page-model-picker/14-02-SUMMARY.md
- Commit 5b7add4 exists in git log

---
*Phase: 14-providers-page-model-picker*
*Completed: 2026-03-21*
