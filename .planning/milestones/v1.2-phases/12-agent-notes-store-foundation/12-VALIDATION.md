---
phase: 12
slug: agent-notes-store-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/db/agents.test.ts tests/api/agents.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/db/agents.test.ts tests/api/agents.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | NOTE-01 | unit | `npx vitest run tests/db/agents.test.ts` | ✅ (needs new case) | ⬜ pending |
| 12-01-02 | 01 | 1 | NOTE-01 | unit | `npx vitest run tests/api/agents.test.ts` | ✅ (needs new case) | ⬜ pending |
| 12-02-01 | 02 | 1 | NOTE-02 | manual | visual check in browser | N/A — UI | ⬜ pending |
| 12-02-02 | 02 | 1 | NOTE-02 | manual | visual check in browser | N/A — UI | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/setup.ts` — add `notes TEXT` to agents `CREATE TABLE` SQL
- [ ] `tests/db/agents.test.ts` — new test case: "create agent with notes — verify notes persisted"
- [ ] `tests/api/agents.test.ts` — new test cases: "createAgentSchema accepts notes", "updateAgentSchema accepts notes"

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Notes visible on AgentCard | NOTE-02 | UI rendering / visual layout | Open agent library → verify notes text appears below agent info |
| Empty notes shows no section | NOTE-02 | UI rendering / empty state | Create agent without notes → verify no notes block on card |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
