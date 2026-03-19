---
phase: 3
slug: real-time-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/sse/ tests/api/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/sse/ tests/api/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | RTUI-01 | unit | `npx vitest run tests/sse/stream-registry.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | RTUI-01 | unit | `npx vitest run tests/api/stream.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | RTUI-02 | unit | `npx vitest run tests/conversation/manager.test.ts` | ✅ extend | ⬜ pending |
| 03-02-01 | 02 | 2 | RTUI-02 | unit | `npx vitest run tests/conversation/manager.test.ts` | ✅ extend | ⬜ pending |
| 03-02-02 | 02 | 2 | RTUI-04 | unit | `npx vitest run tests/sse/stream-registry.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | RTUI-03 | unit | `npx vitest run tests/api/messages.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/sse/stream-registry.test.ts` — stubs for RTUI-01: register, unregister, emit, enqueue error resilience
- [ ] `tests/api/stream.test.ts` — stubs for RTUI-01: SSE route handler returns `text/event-stream` response
- [ ] `tests/api/messages.test.ts` — stubs for RTUI-03: POST /api/rooms/[roomId]/messages persists role='user' message

*Existing `tests/conversation/manager.test.ts` must be extended to cover RTUI-02 emission points.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smart auto-scroll stops when user scrolls up | RTUI-01 | Browser scroll behavior requires visual verification | Open chat, start streaming, scroll up — verify auto-scroll stops; scroll to bottom — verify it resumes |
| Thinking dots transition smoothly to real content | RTUI-02 | Animation timing requires visual check | Start a turn, observe dots bubble transitions to text without flicker or layout jump |
| Chat bubbles show correct agent color accents | RTUI-04 | Visual styling requires browser inspection | Open room with 2+ agents, verify each agent's bubble has distinct left border color matching avatarColor |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
