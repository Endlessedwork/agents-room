---
phase: 2
slug: conversation-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npx vitest run tests/conversation/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/conversation/ tests/db/messages.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + CLI smoke test
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AGNT-04, CONV-01, CONV-02 | unit | `npx vitest run tests/conversation/manager.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | CONV-03, CONV-04 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | AGNT-05 | unit | `npx vitest run tests/conversation/speaker-selector.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | CONV-05 | unit (db) | `npx vitest run tests/db/messages.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/conversation/manager.test.ts` — stubs for AGNT-04, CONV-01, CONV-02
- [ ] `tests/conversation/context-service.test.ts` — stubs for CONV-03, CONV-04
- [ ] `tests/conversation/speaker-selector.test.ts` — stubs for AGNT-05
- [ ] `tests/db/messages.test.ts` — stubs for CONV-05
- [ ] Schema migration: add `turnLimit` and `speakerStrategy` columns to rooms table
- [ ] `scripts/test-conversation.ts` — CLI smoke test script

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CLI smoke test with real LLM | CONV-01 | Requires API key + running server | `npx tsx scripts/test-conversation.ts <roomId>` — verify messages appear in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
