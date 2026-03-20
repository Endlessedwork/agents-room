---
phase: 6
slug: room-configuration-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/api/rooms.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/rooms.test.ts tests/db/rooms.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AGNT-04 | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | AGNT-04 | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | AGNT-04 | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ | ⬜ pending |
| 06-01-04 | 01 | 1 | AGNT-05 | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ | ⬜ pending |
| 06-01-05 | 01 | 1 | AGNT-05 | unit | `npx vitest run tests/api/rooms.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Tests only need new test cases added to existing files (`tests/api/rooms.test.ts`, `tests/db/rooms.test.ts`), not new files created.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slider renders at correct position for turnLimit | AGNT-04 | Visual rendering | Open RoomWizard, verify slider shows at default 20, drag to new value |
| Select dropdown shows both strategy options | AGNT-05 | Visual rendering | Open RoomWizard, verify Select shows round-robin and llm-selected |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
