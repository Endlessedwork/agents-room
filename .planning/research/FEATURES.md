# Feature Research

**Domain:** Multi-agent AI chat room (personal tool, single-user, LLM-powered)
**Researched:** 2026-03-19
**Confidence:** HIGH for core features, MEDIUM for differentiators (verified against AutoGen, CrewAI, MindStudio, AG-UI protocol)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Named rooms with persistent topics | Mental model of a "chat room" demands distinct spaces per subject | LOW | Simple room CRUD + DB table; each room has a name, optional description, and topic |
| Per-agent persona/role assignment | Agents need distinct identities to produce substantive disagreement; without roles every agent echoes the same voice | MEDIUM | System prompt per agent configures persona, bias, mandate; stored in room config |
| Multi-provider LLM support | User requires Claude, GPT, Gemini; not all models excel at same tasks | MEDIUM | Each agent carries its own provider + model + API key reference; abstracted via a unified call interface |
| Autonomous agent conversation | The core value proposition: agents exchange messages without user driving every turn | HIGH | Requires an orchestrator loop: select next speaker, call LLM, broadcast response, repeat |
| Real-time message display (streaming) | Watching agents think live is the primary experience; batch display kills engagement | HIGH | SSE or WebSocket; stream tokens as they arrive from LLM; per-agent "thinking" indicator before first token |
| User participation (send messages mid-conversation) | User needs to inject context, clarify, or redirect without stopping the whole room | MEDIUM | User messages are injected into the broadcast history; agents acknowledge and respond |
| Start / Stop / Pause conversation controls | Without hard stop, agents burn tokens indefinitely; pause lets user think before re-entering | MEDIUM | Orchestrator state machine: IDLE, RUNNING, PAUSED, STOPPED; UI controls map to state transitions |
| Conversation history persisted per room | Closing the browser must not lose context; user returns to pick up where left off | MEDIUM | Store every message (role, content, timestamp, agent name, model) in DB; load on room open |
| Configurable turn limit / max iterations | Prevents runaway token spend and infinite loops — the single most reported multi-agent failure mode | LOW | Simple integer config per room or per session; orchestrator halts when limit reached |
| Per-agent "typing" / "thinking" indicator | Users need visual feedback that agents are active; without it the UI feels broken during LLM latency | LOW | Frontend state driven by SSE events: AGENT_THINKING, AGENT_STREAMING, AGENT_DONE |
| Conversation summary on demand | Long rooms accumulate hundreds of messages; user needs distilled output | MEDIUM | Call an LLM with the full transcript and a "summarize key insights" prompt; display separately |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Speaker-selection strategy (round-robin vs. prompt-based) | Round-robin is predictable but dumb; prompt-based selection lets the conversation self-organize — one agent defers when another has stronger relevant expertise | MEDIUM | Orchestrator selects next agent via an LLM call or rule (e.g., "who should respond next?"); configurable per room |
| Independent response before reveal ("parallel first round") | Prevents herding — agents see each other's output only after each has committed an initial answer; produces genuine disagreement rather than sycophantic echo | HIGH | Orchestrator runs N LLM calls in parallel for round 1, then shares all into shared context for subsequent rounds |
| Asymmetric context injection | Give different agents different source documents/data; forces substantive debate from different informational vantage points | MEDIUM | Per-agent "context" field in room config; injected into system prompt or user turn prefix |
| Convergence detection | Automatically halts the conversation when agents reach consensus, saving tokens | MEDIUM | After each round, a lightweight LLM call classifies agreement level; if above threshold, stop and surface synthesis |
| Per-room token usage dashboard | Single-user cost awareness — shows tokens consumed and estimated cost per session and across rooms | LOW | Sum token counts returned in API responses; store with each message; aggregate per room and total |
| Conversation export (Markdown / JSON) | User wants to take insights elsewhere — into docs, Obsidian, GitHub issues | LOW | Serialize stored messages into Markdown or JSON; browser download or clipboard copy |
| "Redirect" injection: change topic mid-conversation | User sees conversation drifting; types a redirect prompt that overrides the current direction without full restart | LOW | Treat redirect as a high-priority system message prepended to next agent turn; UI has a dedicated "redirect room" input |
| Agent memory across rooms (long-term) | An agent accumulates institutional knowledge from past sessions; carries reasoning forward | HIGH | Requires vector store (e.g., SQLite + sqlite-vec) with retrieval at each turn; significant complexity; HIGH risk of scope creep |
| Infinite-loop / repetition detection | Automatically flags when agents are repeating identical or near-identical content and pauses the run with a warning | MEDIUM | Hash or embed recent N messages; if cosine similarity exceeds threshold, halt and alert user |
| Conversation replay / scrubbing | Watch a past conversation play back in real time to review how conclusions were reached | MEDIUM | Store messages with timestamps; replay mode re-renders with artificial delay matching original cadence |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-user / team collaboration | "Let my colleague join" | Adds auth, permissions, presence, conflict resolution; destroys simplicity; this is a personal tool | Keep single-user; export and share conversation transcripts manually |
| Agent tool use / code execution | "Have agents actually run code" | Sandboxing, security, dependency management, error handling balloon scope dramatically; v1 focus is conversation quality | Defer to v2+; agents can discuss code and the user executes manually |
| Voice / audio input-output | "Talk to the room" | Real-time audio pipeline is an entirely separate engineering domain; TTS/STT latency conflicts with streaming text | Text-only for v1; revisit after core conversation quality is validated |
| Agent-driven web search (live RAG) | "Let agents Google things" | Each tool call multiplies latency and cost; tool failures cause conversation derailment; adds orchestration complexity | User pastes relevant URLs or text into the room context as asymmetric input |
| Global shared memory / "learning" across sessions by default | "Agents should remember everything" | Context bloat — injecting all past memories into every turn degrades response quality and inflates costs; difficult to prune | Explicit conversation summaries the user can optionally include as room context |
| Real-time everything (every keystroke streamed) | "Show exactly what the agent is thinking" | Streaming reasoning traces significantly increases token cost and UI complexity; some providers don't support it | Stream tokens as they arrive (standard SSE); hide internal chain-of-thought unless user enables it |
| Mobile native app | "I want this on my phone" | Native app duplicates the codebase; web-first already works on mobile browser | Responsive web UI |

## Feature Dependencies

```
[Room management (CRUD)]
    └──requires──> [Conversation history persistence]
                       └──requires──> [Database layer]

[Autonomous agent conversation]
    └──requires──> [Per-agent persona/role assignment]
    └──requires──> [Multi-provider LLM support]
    └──requires──> [Turn limit / max iterations]       ← prevents infinite loops

[Real-time message display]
    └──requires──> [Autonomous agent conversation]
    └──requires──> [SSE or WebSocket transport]
    └──requires──> [Per-agent thinking indicator]

[User participation]
    └──requires──> [Autonomous agent conversation]
    └──requires──> [Real-time message display]

[Start/Stop/Pause controls]
    └──requires──> [Autonomous agent conversation]
    └──requires──> [Orchestrator state machine]

[Conversation summary]
    └──requires──> [Conversation history persistence]

[Token usage dashboard]
    └──requires──> [Multi-provider LLM support]        ← need unified token count reporting

[Convergence detection]
    └──requires──> [Autonomous agent conversation]
    └──enhances──> [Turn limit / max iterations]       ← stops early rather than hitting hard limit

[Infinite-loop detection]
    └──requires──> [Conversation history persistence]
    └──enhances──> [Start/Stop/Pause controls]         ← auto-triggers pause on detection

[Independent parallel first round]
    └──requires──> [Autonomous agent conversation]
    └──conflicts──> [Round-robin speaker selection]    ← parallel and sequential are mutually exclusive for round 1

[Asymmetric context injection]
    └──requires──> [Per-agent persona/role assignment]

[Agent long-term memory]
    └──requires──> [Conversation history persistence]
    └──requires──> [Vector store]
    └──conflicts──> [Cost control]                     ← retrieval adds tokens every turn
```

### Dependency Notes

- **Autonomous conversation requires turn limits:** Without a hard cap, runaway loops are certain. This is the single most documented failure mode in multi-agent systems. Turn limits must ship with the orchestrator, not as a later addition.
- **Convergence detection enhances turn limits:** Convergence is a soft stop (agents agreed); max iterations is the hard stop (safety net). Both are needed.
- **Parallel first round conflicts with round-robin:** If you run agents in parallel for round 1, you cannot also sequence them. The orchestrator must choose a strategy per room.
- **Long-term memory conflicts with cost control:** Vector retrieval injects tokens every single turn. For a personal tool, this can silently inflate costs. Defer this feature until token budgeting is solid.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate whether agent conversation produces useful insights.

- [ ] Room management (create, name, list, delete rooms) — without rooms there is no structure
- [ ] Per-agent persona/role assignment (name, system prompt, provider, model) — without distinct roles agents echo each other
- [ ] Multi-provider LLM support (Claude, OpenAI, Gemini at minimum) — flexibility is a core requirement from PROJECT.md
- [ ] Autonomous agent conversation with configurable turn limit — the core value proposition
- [ ] Real-time message display with SSE streaming and thinking indicators — watching agents think live is the experience
- [ ] User participation (inject messages mid-conversation) — user is both audience and director
- [ ] Start / Stop / Pause controls — without stop, every session risks runaway cost
- [ ] Conversation history persisted per room — losing context on browser close is unacceptable
- [ ] Per-room token usage display — cost awareness is a stated constraint in PROJECT.md

### Add After Validation (v1.x)

Features to add once agent conversation quality is confirmed to produce useful output.

- [ ] Conversation summary on demand — trigger once rooms grow beyond ~50 messages; validates the insight-extraction use case
- [ ] Conversation export (Markdown/JSON) — add when user wants to act on insights outside the tool
- [ ] Redirect injection (change topic mid-conversation) — add when user reports frustration with drift; currently achievable via Stop + new prompt
- [ ] Infinite-loop / repetition detection — add when user reports agents getting stuck (may appear immediately in practice)
- [ ] Speaker-selection strategy config (round-robin vs. LLM-selected) — add when room dynamics feel rigid

### Future Consideration (v2+)

Features to defer until the core workflow is validated and stable.

- [ ] Independent parallel first round — high implementation complexity; defer until conversation quality experiments identify herding as a problem
- [ ] Asymmetric context injection per agent — useful but adds configuration surface; validate simpler persona differentiation first
- [ ] Convergence detection — requires reliable LLM-as-judge; adds latency and cost; defer until turn limits prove insufficient
- [ ] Agent long-term memory across rooms — significant complexity and cost risk; defer until user identifies specific cross-session continuity needs
- [ ] Conversation replay — nice UX but no core value; defer
- [ ] Agent tool use / code execution — out of scope for v1 per PROJECT.md; revisit after text-conversation quality is proven

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Room management | HIGH | LOW | P1 |
| Per-agent persona/role | HIGH | LOW | P1 |
| Multi-provider LLM | HIGH | MEDIUM | P1 |
| Autonomous conversation | HIGH | HIGH | P1 |
| Real-time streaming display | HIGH | HIGH | P1 |
| Turn limit / max iterations | HIGH | LOW | P1 |
| Start/Stop/Pause controls | HIGH | MEDIUM | P1 |
| Conversation history persistence | HIGH | MEDIUM | P1 |
| User participation | HIGH | MEDIUM | P1 |
| Per-room token usage display | MEDIUM | LOW | P1 |
| Conversation summary | MEDIUM | LOW | P2 |
| Conversation export | MEDIUM | LOW | P2 |
| Redirect injection | MEDIUM | LOW | P2 |
| Infinite-loop detection | HIGH | MEDIUM | P2 |
| Speaker-selection strategy | MEDIUM | MEDIUM | P2 |
| Independent parallel first round | HIGH | HIGH | P3 |
| Asymmetric context injection | MEDIUM | MEDIUM | P3 |
| Convergence detection | MEDIUM | HIGH | P3 |
| Agent long-term memory | LOW | HIGH | P3 |
| Conversation replay | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

This is a novel personal tool rather than a direct product competitor. The closest analogs are frameworks (AutoGen, CrewAI) and the MindStudio agent chat room article. No direct consumer competitors exist.

| Feature | AutoGen (framework) | CrewAI (framework) | MindStudio (blog example) | Our Approach |
|---------|--------------------|--------------------|---------------------------|--------------|
| Multi-agent conversation | Yes, core | Yes, core | Yes, documented | Core — autonomous orchestrator loop |
| Real-time UI | Next.js + FastAPI; separate project | No built-in UI | No built-in UI | Built-in streaming UI from day one |
| Persona/role | System prompt per agent | Role + backstory fields | System prompt per agent | System prompt + name + provider config |
| Turn limits | MaximumIterationCount | Max iterations param | Manual in code | Configurable per room, enforced by orchestrator |
| Multi-provider | Yes (LiteLLM proxy or native) | Yes (litellm) | No (Claude only in article) | Native support for Claude, OpenAI, Gemini APIs |
| Speaker selection | Round-robin, LLM selector, custom | Sequential by role | Custom coded | Round-robin (v1), LLM-selector (v2) |
| Conversation history | In-memory; optional SQLite | SQLite + ChromaDB | Not persisted | Persisted in DB per room, loaded on open |
| User participation | Human proxy agent | Human input mode | Not described | Direct message injection into orchestrator loop |
| Stop/Pause controls | No built-in UI | No built-in UI | Manual keyboard interrupt | Explicit UI controls driving orchestrator state machine |
| Token cost visibility | API responses include usage | API responses include usage | Not described | Aggregated and displayed per room and globally |
| Loop detection | No | No | Not described | Automatic detection via similarity check (v1.x) |

## Sources

- [AutoGen Multi-agent Conversation Framework](https://microsoft.github.io/autogen/docs/Use-Cases/agent_chat/) — HIGH confidence, official docs
- [Agent Chat Rooms: Multi-Agent Debate](https://www.mindstudio.ai/blog/agent-chat-rooms-multi-agent-debate-claude-code) — MEDIUM confidence, practitioner article
- [CrewAI Agents Documentation](https://docs.crewai.com/en/concepts/agents) — HIGH confidence, official docs
- [Deep Dive into CrewAI Memory Systems](https://sparkco.ai/blog/deep-dive-into-crewai-memory-systems) — MEDIUM confidence, verified against CrewAI docs
- [AG-UI Protocol Overview](https://docs.ag-ui.com/introduction) — HIGH confidence, official protocol docs
- [Fix Infinite Loops in Multi-Agent Chat Frameworks](https://markaicode.com/fix-infinite-loops-multi-agent-chat/) — MEDIUM confidence, practitioner guide
- [Why AI Agents Get Stuck in Infinite Loops](https://www.fixbrokenaiapps.com/blog/ai-agents-infinite-loops) — MEDIUM confidence, corroborated by multiple sources
- [Token-Based Rate Limiting for AI Agents](https://zuplo.com/learning-center/token-based-rate-limiting-ai-agents) — MEDIUM confidence
- [Multi-Agent Frameworks Explained for Enterprise AI 2026](https://www.adopt.ai/blog/multi-agent-frameworks) — MEDIUM confidence, current overview
- [Microsoft Group Chat Orchestration](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/group-chat) — HIGH confidence, official Microsoft docs

---
*Feature research for: Multi-agent AI chat room (Agents Room)*
*Researched: 2026-03-19*
