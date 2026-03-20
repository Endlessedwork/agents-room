---
phase: 5
slug: foundation-verification
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ROOM-01 | unit | `npx vitest run tests/db/rooms.test.ts tests/api/rooms.test.ts` | Yes | pending |
| 05-01-02 | 01 | 1 | ROOM-02 | unit | `npx vitest run tests/db/rooms.test.ts` | Yes | pending |
| 05-01-03 | 01 | 1 | ROOM-03 | unit | `npx vitest run tests/db/rooms.test.ts` | Yes | pending |
| 05-01-04 | 01 | 1 | ROOM-04 | unit | `npx vitest run tests/api/rooms.test.ts` | Yes | pending |
| 05-01-05 | 01 | 1 | AGNT-01 | unit | `npx vitest run tests/db/agents.test.ts tests/api/agents.test.ts` | Yes | pending |
| 05-01-06 | 01 | 1 | AGNT-02 | unit | `npx vitest run tests/llm/gateway.test.ts` | Yes | pending |
| 05-01-07 | 01 | 1 | AGNT-03 | unit | `npx vitest run tests/db/roomAgents.test.ts` | Yes | pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Room creation wizard flow | ROOM-01 | UI interaction flow | Recorded in 01-UAT.md — PASSED |
| Agent visual display | AGNT-01 | Visual rendering | Recorded in 01-UAT.md — PASSED |
| Provider card status indicators | AGNT-02 | Visual rendering | Recorded in 01-UAT.md — PASSED |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
