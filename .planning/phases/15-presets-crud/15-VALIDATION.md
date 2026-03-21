---
phase: 15
slug: presets-crud
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node environment) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/db/presets.test.ts tests/api/presets.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/db/presets.test.ts tests/api/presets.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | PRST-04 | unit (DB) | `npx vitest run tests/db/presets.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | PRST-01 | unit (schema) | `npx vitest run tests/api/presets.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | PRST-03 | unit (DB) | `npx vitest run tests/db/presets.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-04 | 01 | 1 | PRST-02 | unit (schema) | `npx vitest run tests/api/presets.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | PRST-01, PRST-02 | manual (UI) | N/A | N/A | ⬜ pending |
| 15-02-02 | 02 | 2 | PRST-03 | manual (UI) | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/db/presets.test.ts` — stubs for PRST-03, PRST-04 (DB insert/delete/guard)
- [ ] `tests/api/presets.test.ts` — stubs for PRST-01, PRST-02 (Zod schema validation)
- [ ] `tests/setup.ts` — add `CREATE TABLE IF NOT EXISTS presets` block to `createTestDb()`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preset list renders system + user presets | PRST-04 | Visual rendering | Navigate to presets page, verify 3 system presets visible |
| Create preset form flow | PRST-01 | Full form interaction | Fill preset form, submit, verify appears in list |
| Save agent as preset | PRST-02 | Cross-page interaction | Open agent edit, click "Save as preset", verify preset created |
| Edit user preset | PRST-03 | Form interaction | Edit a user preset name, save, verify update |
| Delete user preset + system guard | PRST-03 | Dialog interaction | Delete user preset (succeeds), attempt delete system preset (blocked) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
