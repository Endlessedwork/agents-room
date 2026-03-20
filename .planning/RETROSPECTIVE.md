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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 16 | Initial process — discovered need for inline verification |

### Cumulative Quality

| Milestone | Tests | Requirements | Verified |
|-----------|-------|-------------|----------|
| v1.0 | 121 | 21/21 | 6/6 phases |

### Top Lessons (Verified Across Milestones)

1. Bottom-up build order prevents rework — validate in v2
2. Milestone audits catch gaps that phase-level verification misses — validate in v2
