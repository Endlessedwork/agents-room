# Roadmap: Agents Room

## Milestones

- ✅ **v1.0 Agents Room MVP** — Phases 1-6 (shipped 2026-03-20)
- 🚧 **v1.1 Conversation Quality & Polish** — Phases 7-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 Agents Room MVP (Phases 1-6) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-03-19
- [x] Phase 2: Conversation Engine (3/3 plans) — completed 2026-03-19
- [x] Phase 3: Real-Time UI (3/3 plans) — completed 2026-03-20
- [x] Phase 4: Insights (3/3 plans) — completed 2026-03-20
- [x] Phase 5: Foundation Verification (1/1 plans) — completed 2026-03-20
- [x] Phase 6: Room Configuration UI (2/2 plans) — completed 2026-03-20

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 Conversation Quality & Polish (In Progress)

**Milestone Goal:** Improve conversation quality through better prompting, add cost visibility, enable smarter conversation flow (parallel first round + convergence detection), and eliminate v1.0 tech debt.

- [ ] **Phase 7: Conversation Quality** — Anti-sycophancy prompts and topic-lock injection so agents maintain distinct stances
- [ ] **Phase 8: Cost Estimation** — Real-time estimated cost display per room using static model pricing
- [ ] **Phase 9: Convergence Detection** — Auto-pause when agents reach genuine consensus, with system message explaining why
- [ ] **Phase 10: Parallel First Round** — All agents respond independently in round 1 before seeing each other
- [ ] **Phase 11: Tech Debt Cleanup** — Remove dead code, fix type errors, narrow over-fetching endpoint

## Phase Details

### Phase 7: Conversation Quality
**Goal**: Agents maintain genuinely distinct epistemic stances throughout conversation, with the system actively countering sycophantic drift
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. Each agent in a multi-turn conversation can be observed holding and defending positions that differ from other agents
  2. Before round 2 and every subsequent round, a system-injected anti-agreement instruction appears in agent context (visible in conversation logs)
  3. Every N turns, agents receive a topic-lock reminder that redirects drift back to the original room topic
  4. A conversation on a debatable topic runs 10+ turns without agents collapsing to uniform agreement
**Plans:** 2 plans
Plans:
- [ ] 07-01-PLAN.md — Anti-sycophancy and topic-lock injection logic in ContextService
- [ ] 07-02-PLAN.md — Thread turnCount from ConversationManager to buildContext

### Phase 8: Cost Estimation
**Goal**: Users see estimated dollar cost for every room in real time, with honest "est." labeling and graceful handling of unknown or local models
**Depends on**: Phase 7
**Requirements**: COST-01, COST-02, COST-03
**Success Criteria** (what must be TRUE):
  1. The room header displays a running estimated cost (e.g., "est. $0.04") that increases after each agent turn completes
  2. A room using an unrecognized model shows "—" in the cost field, not "$0.00"
  3. Ollama (local) rooms show "local" rather than a dollar figure
  4. Cost figures carry an "est." prefix throughout the UI, never implying false precision
**Plans**: TBD

### Phase 9: Convergence Detection
**Goal**: The system automatically pauses a conversation when agents have genuinely reached consensus, explaining why it stopped so the user understands what happened
**Depends on**: Phase 7
**Requirements**: CONV-01, CONV-02, CONV-03
**Success Criteria** (what must be TRUE):
  1. When agents begin echoing each other's positions with both agreement phrases and high content similarity, the conversation auto-pauses
  2. Convergence auto-pause never fires before turn 6, preventing false positives on early pleasantries
  3. A system message appears in the chat explaining that agents reached consensus and the conversation was paused
  4. The paused conversation can be resumed by the user via the existing resume control
**Plans**: TBD

### Phase 10: Parallel First Round
**Goal**: In rooms with parallel first round enabled, all agents independently form their initial response before any agent sees a peer's message, producing richer and less anchored starting positions
**Depends on**: Phase 9
**Requirements**: PARA-01, PARA-02, PARA-03
**Success Criteria** (what must be TRUE):
  1. A room config toggle labeled "Parallel first round" is available and persists across sessions
  2. When enabled, round 1 messages from all agents appear in the chat after all agents have responded, in agent order, not arrival order
  3. During the parallel round, the UI shows a distinct "Agents forming independent views..." indicator rather than a per-agent thinking dot
  4. If the conversation is stopped mid-parallel-round, no orphaned partial messages remain in the chat
**Plans**: TBD

### Phase 11: Tech Debt Cleanup
**Goal**: The codebase is free of dead files, type errors, and the room detail endpoint returns only the data its consumers need
**Depends on**: Phase 10
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. `ConversationPanel.tsx` no longer exists in the codebase and `npm run build` passes cleanly
  2. `tsc --noEmit` reports zero errors across all test files with no `as any` casts added to silence them
  3. The room detail API endpoint does not return the full messages relation when no consumer requires it, confirmed by inspecting the response payload
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-03-19 |
| 2. Conversation Engine | v1.0 | 3/3 | Complete | 2026-03-19 |
| 3. Real-Time UI | v1.0 | 3/3 | Complete | 2026-03-20 |
| 4. Insights | v1.0 | 3/3 | Complete | 2026-03-20 |
| 5. Foundation Verification | v1.0 | 1/1 | Complete | 2026-03-20 |
| 6. Room Configuration UI | v1.0 | 2/2 | Complete | 2026-03-20 |
| 7. Conversation Quality | v1.1 | 0/2 | Planning | - |
| 8. Cost Estimation | v1.1 | 0/TBD | Not started | - |
| 9. Convergence Detection | v1.1 | 0/TBD | Not started | - |
| 10. Parallel First Round | v1.1 | 0/TBD | Not started | - |
| 11. Tech Debt Cleanup | v1.1 | 0/TBD | Not started | - |
