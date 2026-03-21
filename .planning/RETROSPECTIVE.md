# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Agents Room MVP

**Shipped:** 2026-03-20
**Phases:** 6 | **Plans:** 16

### What Was Built
- Full room and agent management system with 5 LLM provider support
- Autonomous multi-agent conversation engine (turn loop, sliding window, repetition detection)
- Real-time SSE streaming chat UI with thinking indicators and user participation
- Token usage visibility, on-demand summaries, and Markdown/JSON export
- Room configuration UI for turn limits and speaker selection strategy
- Comprehensive verification: 121 tests, 12/12 UAT, 21/21 requirements traced

### What Worked
- Bottom-up build order (schema → gateway → engine → UI → insights) prevented rework — each phase had stable foundations
- TDD approach in conversation engine (Phase 2) caught edge cases early — AbortController lifecycle, resume turn counting
- Milestone audit workflow caught 9 requirement gaps after initial 4 phases — gap closure phases (5, 6) resolved all of them
- Copy-on-assign pattern for room agents prevented config drift when library agents are edited
- In-process SSE via StreamRegistry was simple and sufficient for single-user use case

### What Was Inefficient
- Phase 1 verification was deferred — required creating Phase 5 specifically for verification; should have verified inline
- ROADMAP.md plan checkboxes got out of sync (Phase 3, 4, 5, 6 plans show `[ ]` despite being complete) — CLI doesn't update these
- SUMMARY.md files lack `one_liner` and `requirements_completed` frontmatter — made milestone audit 3-source cross-reference fall back to 2 sources
- Phase 3 VERIFICATION.md status is `human_needed` rather than `passed` — human verification was done (per SUMMARY) but VERIFICATION.md wasn't updated

### Patterns Established
- Layered monolith: ConversationManager → ContextService → SpeakerSelector → LLM Gateway
- SSE event taxonomy: 6 event types (turn:start, token, turn:end, turn:cancel, status, system)
- Optimistic UI updates confirmed by SSE (ChatHeader status changes)
- chatStore deduplication via messageIds Set for concurrent SSE + fetch responses
- Structured prompts as separate DB columns (not single blob)

### Key Lessons
1. **Verify phases inline during execution** — deferring verification to a separate phase is wasteful; the verifier agent should run at end of each phase
2. **Audit early, not just before completion** — the milestone audit found 9 gaps after 4 phases; running it after Phase 2 would have caught issues sooner
3. **SUMMARY.md frontmatter fields matter** — `requirements_completed` should be populated for clean 3-source cross-reference during audits
4. **Single-user simplifies everything** — no auth, no permissions, no presence, in-process SSE — but these decisions should be documented as constraints, not assumptions

### Cost Observations
- Model mix: primarily sonnet for execution, opus for planning/auditing
- Notable: 16 plans across 6 phases completed in ~2 days — high velocity due to stable foundations and no blocking dependencies

---

## Milestone: v1.1 — Conversation Quality & Polish

**Shipped:** 2026-03-21
**Phases:** 5 | **Plans:** 11

### What Was Built
- Anti-sycophancy prompt injection and topic-lock reminders for conversation quality
- Real-time estimated cost display per room using llm-info static pricing
- Convergence detection: AND-logic (agreement phrases + Jaccard ≥ 0.35) with auto-pause
- Parallel first round: all agents form independent views before seeing peers (buffer-then-emit)
- Tech debt cleanup: orphaned ConversationPanel.tsx deleted, test type errors fixed, room detail over-fetching narrowed

### What Worked
- Phase dependency ordering (7 → 9): anti-sycophancy prompts produce the explicit agreement language that convergence detector relies on — this was planned upfront in research
- TDD throughout all phases — every feature started with tests, zero regressions
- llm-info dependency for cost estimation avoided building a pricing database from scratch
- Buffer-then-emit pattern for parallel round was simpler and cleaner than streaming multiple agents simultaneously
- All v1.0 tech debt was resolved, leaving a clean codebase for v1.2

### What Was Inefficient
- SUMMARY.md `one_liner` field still returns null from summary-extract — same issue as v1.0
- ROADMAP.md plan checkboxes still show `[ ]` for completed plans — CLI doesn't update these (carried over from v1.0)
- Phase 8 plan 02 took 20min (longest) due to wiring cost through SSE → chatStore → ChatHeader — multiple integration points

### Patterns Established
- Discriminated union types for result objects (CostResult: known | unknown | local)
- AND-logic for detection algorithms (both conditions required, neither alone sufficient)
- Promise.all for independent prep, Promise.allSettled for fault-tolerant execution
- System prompt injection pattern: ContextService.buildContext handles all injection (anti-sycophancy, topic-lock)

### Key Lessons
1. **Research phase dependencies upfront** — Phase 7→9 dependency was identified during research, preventing a painful late discovery
2. **Static data > API calls for personal tools** — llm-info pricing table avoids external API latency and failure modes
3. **Buffer-then-emit > streaming for parallel work** — simpler code, cleaner UX, easier abort handling
4. **Resolve tech debt in the same milestone that creates it** — v1.0 tech debt was cleanly resolved in v1.1 Phase 11

### Cost Observations
- Model mix: primarily sonnet for execution, opus for planning
- Sessions: ~4 sessions across 2 days
- Notable: 11 plans completed in 2 days — consistent velocity with v1.0

---

## Milestone: v1.2 — Agent Management

**Shipped:** 2026-03-22
**Phases:** 4 | **Plans:** 8

### What Was Built
- Agent notes system — DB migration, Zod validation, store action, textarea in form, display on card
- Dual-mode AgentForm for create/edit with copy-on-assign disclosure banner
- Dedicated /providers page replacing Settings — full provider key CRUD with redirect
- Live model picker — API endpoint fetching models from 5 providers, ModelCombobox with search/fallback/capability tags
- Presets CRUD — DB table with isSystem flag, 3 seeded system presets, full API/store/UI lifecycle
- Save as Preset — convert existing agent configuration to reusable preset from edit form

### What Worked
- Drizzle generate+migrate workflow (established in Phase 12) made subsequent schema changes (Phase 15 presets table) smooth and auditable
- Copy-on-assign disclosure banner in edit form provides clear UX — users understand library edits don't cascade
- Per-provider model adapters handled 5 very different APIs cleanly — Anthropic, OpenAI, Google, OpenRouter, Ollama each have unique shapes
- ModelCombobox fallback to free-text when provider is unconfigured — never blocks agent creation
- Presets DB with isSystem flag cleanly separates system vs user presets — idempotent seeding with onConflictDoNothing

### What Was Inefficient
- SUMMARY.md `requirements_completed` frontmatter still empty for Phase 14 (PROV-01, PROV-02) — same documentation gap pattern from v1.0/v1.1
- AgentCard PRESET_NAMES hardcoded to 3 system preset IDs — user-created presets won't display name badge; should have used store query from start
- handleSaveAsPreset omits notes field — incomplete data mapping when converting agent to preset
- ModelInfo type duplicated in ModelCombobox instead of imported from route — fragile type contract
- 13 human browser checks accumulated across 3 phases without resolution

### Patterns Established
- Dual-mode form via initialData prop (create when undefined, edit when present)
- Server component redirect for deprecated pages (Settings → /providers)
- Per-provider adapter pattern with unified ModelInfo interface
- Free-text fallback for combobox when data source unavailable
- isSystem flag pattern for protecting system-managed records from user mutation

### Key Lessons
1. **Populate SUMMARY frontmatter religiously** — `requirements_completed` gaps cause audit "partial" status even when features are fully implemented
2. **Dynamic lookups > static maps for extensible data** — PRESET_NAMES static Record fails when users add data; should query store
3. **Include all fields when converting between types** — save-as-preset missing notes was a simple oversight that automated tests could catch
4. **Human browser verification backlog grows fast** — 13 checks accumulated across 3 phases; batch verification sessions would be more efficient

### Cost Observations
- Model mix: primarily sonnet for execution, opus for planning/auditing/milestone completion
- Sessions: ~3 sessions in 1 day
- Notable: 8 plans completed in 1 day — fastest milestone yet, benefiting from established patterns

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 16 | Initial process — discovered need for inline verification |
| v1.1 | 5 | 11 | Research-driven phase ordering, consistent TDD, tech debt cleanup |
| v1.2 | 4 | 8 | Milestone audit workflow, per-provider adapter pattern, dual-mode forms |

### Cumulative Quality

| Milestone | Tests | Requirements | Verified |
|-----------|-------|-------------|----------|
| v1.0 | 121 | 21/21 | 6/6 phases |
| v1.1 | 121+ | 15/15 | 5/5 phases |
| v1.2 | 121+ | 16/16 | 4/4 phases |

### Top Lessons (Verified Across Milestones)

1. **Bottom-up build order prevents rework** — ✓ Confirmed in v1.1 and v1.2 (Phase 12→13→14→15 dependency chain worked cleanly)
2. **Milestone audits catch gaps** — ✓ Confirmed in v1.2 (audit found documentation gaps and 3 integration issues before completion)
3. **TDD prevents regressions** — ✓ Confirmed across all 3 milestones, zero regressions across 35 plans
4. **Resolve tech debt in same milestone** — ⚠️ v1.2 carries 5 tech debt items forward; consider dedicated cleanup phase
5. **SUMMARY frontmatter must be populated** — ✓ Recurring issue across all 3 milestones; needs process enforcement
