---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ROOM-01 | unit | `npx vitest run src/db` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AGNT-01 | unit | `npx vitest run src/db` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | AGNT-02 | integration | `npx vitest run src/lib/llm` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | ROOM-01/02/03 | e2e | `npx vitest run src/app` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | AGNT-01/03 | e2e | `npx vitest run src/app` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — vitest configuration for Next.js 16
- [ ] `src/db/__tests__/schema.test.ts` — stubs for room and agent CRUD
- [ ] `src/lib/llm/__tests__/gateway.test.ts` — stubs for multi-provider gateway
- [ ] `@testing-library/react` — if UI tests needed

*Wave 0 establishes test infrastructure before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Room creation wizard flow | ROOM-01 | Multi-step UI interaction | Create room via wizard, verify all steps complete |
| Agent avatar display | AGNT-01 | Visual correctness | Create agent, verify color/icon renders correctly |
| Provider card status indicators | AGNT-02 | Visual state display | Configure API key, verify green/red/gray status |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
