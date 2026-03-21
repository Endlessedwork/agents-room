---
phase: 10
slug: parallel-first-round
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/conversation/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/conversation/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | PARA-01 | unit | `npx vitest run tests/setup.ts && npm test` | Yes (existing) | ⬜ pending |
| 10-01-02 | 01 | 1 | PARA-01 | unit | `npx vitest run tests/api/rooms.test.ts` | Yes (existing) | ⬜ pending |
| 10-02-01 | 02 | 2 | PARA-02, PARA-03 | unit (TDD) | `npx vitest run tests/conversation/manager.test.ts` | Yes (existing, tests added in-task) | ⬜ pending |
| 10-02-02 | 02 | 2 | PARA-02, PARA-03 | unit (TDD) | `npx vitest run tests/conversation/manager.test.ts` | Yes (existing) | ⬜ pending |
| 10-03-01 | 03 | 2 | PARA-01, PARA-03 | build | `npm run build` | N/A (build check) | ⬜ pending |
| 10-03-02 | 03 | 2 | PARA-01, PARA-03 | build | `npm run build` | N/A (build check) | ⬜ pending |
| 10-03-03 | 03 | 2 | PARA-01, PARA-03 | manual | Human visual verification | N/A (checkpoint) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 stubs needed. Plan 10-02 Task 1 uses TDD approach — it creates failing tests in `tests/conversation/manager.test.ts` (existing file) as its first task, then Task 2 makes them pass. Plans 10-01 and 10-03 verify via existing test files and `npm run build`.

*Existing infrastructure covers test framework and fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI shows "Agents forming independent views..." indicator | PARA-03 | Visual/UX verification | Start parallel room, verify indicator appears during round 1 |
| Messages appear in agent order after parallel round | PARA-02 | Visual ordering in chat UI | Enable parallel first round, start conversation, verify message ordering |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or TDD approach (10-02 creates tests inline)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 stubs needed — TDD in 10-02 and existing test files cover all requirements
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
