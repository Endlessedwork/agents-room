---
phase: 14
slug: providers-page-model-picker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/api/providers.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/providers.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | PROV-01 | smoke | Manual browser check | N/A | ⬜ pending |
| 14-01-02 | 01 | 1 | PROV-02 | smoke | Manual browser check | N/A | ⬜ pending |
| 14-02-01 | 02 | 1 | MODL-01 | unit | `npx vitest run tests/api/providers.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | MODL-03 | unit | `npx vitest run tests/api/providers.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 1 | MODL-05 | unit | `npx vitest run tests/api/providers.test.ts` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | MODL-02 | manual | Manual browser check | N/A | ⬜ pending |
| 14-03-02 | 03 | 2 | MODL-04 | smoke | Manual browser check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/providers.test.ts` — unit tests for MODL-01 (models route returns list), MODL-03 (returns 400 when unconfigured), MODL-05 (capability tags from OpenRouter)

*Existing infrastructure covers remaining requirements (UI-only verifications).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /providers page renders ProviderCards | PROV-01 | UI rendering, no API logic to test | Navigate to /providers, verify all 5 provider cards display |
| /settings redirects to /providers | PROV-02 | Server redirect, browser-only | Navigate to /settings, verify URL changes to /providers |
| Model dropdown filters client-side | MODL-02 | Component interaction behavior | Open model dropdown, type partial model name, verify list filters |
| Provider status dot in AgentForm | MODL-04 | Visual indicator only | Open AgentForm, verify colored dot next to provider select |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
