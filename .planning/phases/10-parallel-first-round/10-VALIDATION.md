---
phase: 10
slug: parallel-first-round
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 10-01-01 | 01 | 1 | PARA-01 | unit | `npx vitest run tests/conversation/parallel-round.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | PARA-02 | unit | `npx vitest run tests/conversation/parallel-round.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | PARA-03 | unit | `npx vitest run tests/sse/parallel-events.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conversation/parallel-round.test.ts` — stubs for PARA-01, PARA-02
- [ ] `tests/sse/parallel-events.test.ts` — stubs for PARA-03

*Existing infrastructure covers test framework and fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI shows "Agents forming independent views..." indicator | PARA-03 | Visual/UX verification | Start parallel room, verify indicator appears during round 1 |
| Messages appear in agent order after parallel round | PARA-02 | Visual ordering in chat UI | Enable parallel first round, start conversation, verify message ordering |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
