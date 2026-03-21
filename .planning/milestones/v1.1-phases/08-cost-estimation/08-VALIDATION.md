---
phase: 8
slug: cost-estimation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lib/pricing.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/pricing.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | COST-01 | unit | `npx vitest run tests/lib/pricing.test.ts` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | COST-03 | unit | `npx vitest run tests/lib/pricing.test.ts` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 1 | COST-03 | unit | `npx vitest run tests/lib/pricing.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 1 | COST-02 | unit | `npx vitest run tests/stores/chatStore.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/pricing.test.ts` — stubs for COST-01, COST-03 (calculateCost known/unknown/local)
- [ ] `tests/stores/chatStore.test.ts` — stubs for COST-02 (completeTurn cost accumulation, loadHistory rehydration)

*Existing test infrastructure (Vitest) covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "est." prefix visible in UI | COST-01 | Visual check — React render | Open room with known model, verify header shows "est. $X.XX" |
| "—" shown for unknown model | COST-03 | Visual check — React render | Create agent with unrecognized model, run conversation, verify header shows "—" |
| "local" shown for Ollama | COST-03 | Visual check + requires Ollama running | Create Ollama agent, run conversation, verify header shows "local" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
