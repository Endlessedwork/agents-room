---
phase: 9
slug: convergence-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/conversation/context-service.test.ts tests/conversation/manager.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/conversation/context-service.test.ts tests/conversation/manager.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | CONV-01 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (extend) | ⬜ pending |
| 09-01-02 | 01 | 1 | CONV-01 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (extend) | ⬜ pending |
| 09-01-03 | 01 | 1 | CONV-01 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (extend) | ⬜ pending |
| 09-01-04 | 01 | 1 | CONV-01 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (extend) | ⬜ pending |
| 09-02-01 | 02 | 1 | CONV-02 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (extend) | ⬜ pending |
| 09-02-02 | 02 | 1 | CONV-02 | integration | `npx vitest run tests/conversation/manager.test.ts` | ✅ (extend) | ⬜ pending |
| 09-03-01 | 03 | 1 | CONV-03 | integration | `npx vitest run tests/conversation/manager.test.ts` | ✅ (extend) | ⬜ pending |
| 09-03-02 | 03 | 1 | CONV-03 | integration | `npx vitest run tests/conversation/manager.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conversation/context-service.test.ts` — add `describe('ContextService.detectConvergence', ...)` block with unit tests for CONV-01, CONV-02
- [ ] `tests/conversation/manager.test.ts` — add convergence auto-pause integration tests for CONV-02, CONV-03

*Existing infrastructure covers all phase requirements — extend existing test files, no new files needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
