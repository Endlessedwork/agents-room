---
phase: 13
slug: agent-editing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/api/agents.test.ts tests/db/agents.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/agents.test.ts tests/db/agents.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | EDIT-01 | unit | `npx vitest run tests/db/agents.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | EDIT-01 | unit | `npx vitest run tests/api/agents.test.ts` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 1 | EDIT-02 | manual | Browser check: banner visible on edit page | N/A | ⬜ pending |
| 13-02-02 | 02 | 1 | EDIT-03 | unit | `npx vitest run tests/api/agents.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/db/agents.test.ts` — new case: "update agent — PUT all fields, verify DB row updated" (covers EDIT-01 DB layer)

*Existing infrastructure covers all other automated aspects.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Copy-on-assign banner visible in edit mode | EDIT-02 | UI/visual element, no programmatic assertion | Navigate to `/agents/[id]/edit`, verify yellow banner reads "Editing this agent won't affect rooms already using it" |
| Edit button appears on AgentCard | EDIT-01 | UI navigation element | Open `/agents`, verify Edit button on each card, click opens pre-populated form |
| All fields pre-populated in edit form | EDIT-01 | Visual confirmation of field values | Edit agent with known values, verify all fields match |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
