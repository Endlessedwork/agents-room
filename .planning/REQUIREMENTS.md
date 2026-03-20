# Requirements: Agents Room

**Defined:** 2026-03-19
**Core Value:** Agents must have meaningful conversations that produce genuinely useful insights and solutions

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Room Management

- [x] **ROOM-01**: User can create a new room with a name and optional topic description
- [x] **ROOM-02**: User can view a list of all rooms with their status
- [x] **ROOM-03**: User can delete a room and its conversation history
- [x] **ROOM-04**: User can open a room and see its full conversation history

### Agent Configuration

- [x] **AGNT-01**: User can create an agent with a name, persona/role, and system prompt
- [x] **AGNT-02**: User can assign a specific LLM provider and model to each agent (Claude, GPT, Gemini)
- [x] **AGNT-03**: User can add/remove agents from a room
- [x] **AGNT-04**: User can set a configurable turn limit per conversation session
- [x] **AGNT-05**: User can configure speaker selection strategy per room (round-robin or LLM-selected)

### Conversation Engine

- [x] **CONV-01**: Agents converse autonomously once a topic is given, taking sequential turns
- [x] **CONV-02**: User can start, pause, and stop a conversation at any time
- [x] **CONV-03**: Context window is managed via sliding window to prevent token cost explosion
- [x] **CONV-04**: System detects when agents are repeating themselves and auto-pauses with a warning
- [x] **CONV-05**: All messages are persisted with sender, timestamp, model used, and token count

### Real-Time UI

- [x] **RTUI-01**: Messages stream in real-time as agents generate tokens (SSE)
- [x] **RTUI-02**: Each agent shows a "thinking" indicator while generating a response
- [x] **RTUI-03**: User can type and send messages into the conversation mid-flow
- [x] **RTUI-04**: Chat interface displays agent name, role badge, and model used per message

### Insights & Export

- [x] **INSI-01**: User can view token usage and estimated cost per room
- [x] **INSI-02**: User can generate an LLM-powered summary of a conversation on demand
- [x] **INSI-03**: User can export a conversation as Markdown or JSON

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Conversation Quality

- **QUAL-01**: Independent parallel first round (agents respond independently before seeing each other's output)
- **QUAL-02**: Asymmetric context injection (different source documents per agent)
- **QUAL-03**: Convergence detection (auto-stop when agents reach consensus)

### Advanced Features

- **ADVN-01**: Redirect injection (change topic mid-conversation via dedicated input)
- **ADVN-02**: Conversation replay / scrubbing (watch past conversations play back)
- **ADVN-03**: Agent long-term memory across rooms (vector-based retrieval)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user / team collaboration | Personal tool — single user; adds auth, permissions, presence complexity |
| Mobile native app | Web-first; responsive web UI works on mobile browser |
| Voice / audio input-output | Separate engineering domain; text-only for v1 |
| Agent tool use / code execution | Sandboxing complexity; conversation-focused first |
| Agent-driven web search (live RAG) | Multiplies latency/cost; user pastes context manually |
| Real-time keystroke streaming | Inflates token cost; standard SSE token streaming sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROOM-01 | Phase 5 | Complete |
| ROOM-02 | Phase 5 | Complete |
| ROOM-03 | Phase 5 | Complete |
| ROOM-04 | Phase 5 | Complete |
| AGNT-01 | Phase 5 | Complete |
| AGNT-02 | Phase 5 | Complete |
| AGNT-03 | Phase 5 | Complete |
| AGNT-04 | Phase 6 | Complete |
| AGNT-05 | Phase 6 | Complete |
| CONV-01 | Phase 2 | Complete |
| CONV-02 | Phase 2 | Complete |
| CONV-03 | Phase 2 | Complete |
| CONV-04 | Phase 2 | Complete |
| CONV-05 | Phase 2 | Complete |
| RTUI-01 | Phase 3 | Complete |
| RTUI-02 | Phase 3 | Complete |
| RTUI-03 | Phase 3 | Complete |
| RTUI-04 | Phase 3 | Complete |
| INSI-01 | Phase 4 | Complete |
| INSI-02 | Phase 4 | Complete |
| INSI-03 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Satisfied: 12/21
- Pending (gap closure): 9/21
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-20 after gap closure phase creation*
