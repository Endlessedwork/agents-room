---
phase: 7
slug: conversation-quality
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/conversation/context-service.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/conversation/context-service.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | QUAL-01 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new cases) | ⬜ pending |
| 7-01-02 | 01 | 1 | QUAL-02 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new cases) | ⬜ pending |
| 7-01-03 | 01 | 1 | QUAL-02 | unit | `npx vitest run tests/conversation/manager.test.ts` | ✅ (needs new cases) | ⬜ pending |
| 7-01-04 | 01 | 1 | QUAL-03 | unit | `npx vitest run tests/conversation/context-service.test.ts` | ✅ (needs new cases) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test cases for injection behavior in `tests/conversation/context-service.test.ts` — covers QUAL-01, QUAL-02, QUAL-03
- [ ] Updated test cases in `tests/conversation/manager.test.ts` — verifies `turnCount` is threaded through to `buildContext()`

*Existing test infrastructure is present and working — only new test cases are needed, not new test files or framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agents maintain distinct positions over 10+ turns | QUAL-01 | Requires observing emergent LLM behavior | Run a conversation on a debatable topic with 3+ agents for 10+ turns; verify agents don't all converge to same position |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
