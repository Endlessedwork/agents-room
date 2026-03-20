# Roadmap: Agents Room

## Overview

Agents Room is built bottom-up: the data schema and LLM gateway must exist before any agent logic, the conversation engine must be testable before any streaming UI, and the real-time UI must be working before insights are meaningful. Four phases, each delivering a coherent capability: room and agent management, autonomous multi-agent conversation, live streaming chat experience, and conversation insights and export.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Room and agent management with LLM gateway infrastructure (completed 2026-03-19)
- [x] **Phase 2: Conversation Engine** - Autonomous multi-agent conversation with turn control and context management (completed 2026-03-19)
- [ ] **Phase 3: Real-Time UI** - Live token streaming, agent identity display, and user participation
- [x] **Phase 4: Insights** - Token usage visibility, on-demand summaries, and conversation export (completed 2026-03-20)
- [ ] **Phase 5: Foundation Verification** - Formal verification of Phase 1 requirements (gap closure)
- [ ] **Phase 6: Room Configuration UI** - Turn limit and speaker strategy UI wiring (gap closure)

## Phase Details

### Phase 1: Foundation
**Goal**: Users can create and configure rooms with agents backed by real LLM providers — every room and agent is persisted and survives restarts
**Depends on**: Nothing (first phase)
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04, AGNT-01, AGNT-02, AGNT-03
**Success Criteria** (what must be TRUE):
  1. User can create a room with a name and optional topic description and see it appear in the room list
  2. User can delete a room and confirm it no longer appears in the list
  3. User can open a room and see its full (empty) conversation history panel
  4. User can create an agent with a name, persona/role, system prompt, and an assigned LLM provider and model (Claude, GPT, or Gemini)
  5. User can add and remove agents from a room; a CLI test confirms streaming responses from all three providers via the same gateway interface
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Bootstrap Next.js 16 project, Drizzle SQLite schema, test infrastructure
- [x] 01-02-PLAN.md — LLM gateway: unified streaming interface over 5 providers
- [x] 01-03-PLAN.md — REST API routes for rooms, agents, providers, and room-agent assignment
- [x] 01-04-PLAN.md — Management UI: sidebar layout, room wizard, agent library, settings page

### Phase 2: Conversation Engine
**Goal**: Agents converse autonomously with full cost and quality safeguards enforced from the first run, verifiable via CLI without any UI
**Depends on**: Phase 1
**Requirements**: AGNT-04, AGNT-05, CONV-01, CONV-02, CONV-03, CONV-04, CONV-05
**Success Criteria** (what must be TRUE):
  1. Given a topic, agents take sequential turns automatically and the conversation stops exactly at the configured turn limit
  2. User can start, pause, and stop a running conversation; stop cancels the in-flight LLM call
  3. Speaker selection operates in both round-robin and LLM-selected modes, configurable per room
  4. Context sent to each agent uses a sliding window — token counts do not grow unboundedly as conversation length increases
  5. System auto-pauses and emits a warning when agent responses are detected as repetitive; all messages persist with sender, timestamp, model, and token count across server restarts
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Schema migration, ContextService (sliding window + repetition detection), SpeakerSelector (round-robin + LLM-selected)
- [x] 02-02-PLAN.md — ConversationManager: turn loop, state machine, AbortController lifecycle, message persistence
- [x] 02-03-PLAN.md — REST endpoints for conversation control (start/pause/stop/resume) and CLI smoke test

### Phase 3: Real-Time UI
**Goal**: Users watch agents think and respond live in a browser chat interface, and can type messages into the running conversation
**Depends on**: Phase 2
**Requirements**: RTUI-01, RTUI-02, RTUI-03, RTUI-04
**Success Criteria** (what must be TRUE):
  1. Agent messages appear token-by-token in the browser as they are generated — no polling, no full-page refresh
  2. The active agent shows a "thinking" indicator before its response begins; the indicator clears when the response completes
  3. User can type and send a message mid-conversation and it enters the agent context on the next turn
  4. Each message displays the agent name, role badge, and model used; agents are visually distinct from one another
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — SSE backend: StreamRegistry bridge, ConversationManager emission points, SSE endpoint, user message API
- [ ] 03-02-PLAN.md — Chat UI: Zustand chatStore, EventSource hook, message components, header controls, smart scroll
- [ ] 03-03-PLAN.md — Human verification: end-to-end live streaming chat experience

### Phase 4: Insights
**Goal**: Users can see token usage per room, generate on-demand conversation summaries, and export conversations as Markdown or JSON
**Depends on**: Phase 3
**Requirements**: INSI-01, INSI-02, INSI-03
**Success Criteria** (what must be TRUE):
  1. Token usage and estimated API cost for a room are visible in the UI and update after each completed turn
  2. User can click a button to generate an LLM-powered summary of the current conversation and read it inline
  3. User can download the current conversation as a Markdown file and as a JSON file
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Token usage display in chat header with real-time SSE updates
- [ ] 04-02-PLAN.md — On-demand LLM-powered conversation summary with inline banner
- [ ] 04-03-PLAN.md — Conversation export to Markdown and JSON with metadata

### Phase 5: Foundation Verification
**Goal:** Formally verify all Phase 1 requirements — create VERIFICATION.md proving ROOM-01..04 and AGNT-01..03 are satisfied
**Depends on:** Phase 1
**Requirements:** ROOM-01, ROOM-02, ROOM-03, ROOM-04, AGNT-01, AGNT-02, AGNT-03
**Gap Closure:** Closes gaps from audit — 7 requirements marked partial due to missing verification

### Phase 6: Room Configuration UI
**Goal:** Users can set turn limit and speaker selection strategy when creating/editing a room — closing the last two UI→DB wiring gaps
**Depends on:** Phase 1, Phase 2
**Requirements:** AGNT-04, AGNT-05
**Gap Closure:** Closes gaps from audit — RoomWizard POST body missing turnLimit and speakerStrategy fields

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-19 |
| 2. Conversation Engine | 3/3 | Complete   | 2026-03-19 |
| 3. Real-Time UI | 1/3 | In Progress|  |
| 4. Insights | 3/3 | Complete   | 2026-03-20 |
| 5. Foundation Verification | 0/0 | Pending | |
| 6. Room Configuration UI | 0/0 | Pending | |
