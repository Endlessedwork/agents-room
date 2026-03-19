# Project Research Summary

**Project:** Agents Room — multi-agent AI chat room
**Domain:** Personal single-user web application; multi-LLM real-time agent conversation
**Researched:** 2026-03-19
**Confidence:** HIGH (core architecture and stack), MEDIUM (differentiator features, some library choices)

## Executive Summary

Agents Room is a personal tool for running autonomous multi-agent LLM conversations in named rooms. Expert practitioners (AutoGen, CrewAI, AG-UI protocol, Google ADK) consistently converge on the same foundational architecture: a centralized Conversation Manager that owns sequential turn-taking, an LLM Gateway that normalizes provider differences, a Context Service that prevents token cost explosion, and durable message persistence. The Vercel AI SDK (v6) eliminates the primary implementation complexity — multi-provider streaming — by providing a single interface for Claude, GPT, and Gemini. The remaining complexity is the orchestration loop itself, which must be built from scratch but follows a well-understood pattern documented across all major frameworks.

The recommended approach is a full-stack Next.js 16 monolith with SQLite persistence, SSE streaming, and Zustand client state. This combination avoids the cross-origin complexity of separate frontend/backend, eliminates the need for a real-time service (SSE replaces WebSocket), and keeps the entire application as a single deployable unit suitable for a personal tool. The build order is dictated by the architecture's dependency graph: storage first, then LLM gateway, then agent/context layer, then orchestration, then API, then UI. A working CLI-testable conversation loop exists before any frontend is built.

The most dangerous risks are not architectural but behavioral: infinite conversation loops will burn real API money without hard turn limits, quadratic token cost growth will make long conversations expensive without a context sliding window, and LLM sycophancy will make agent conversations useless echo chambers without adversarial system prompt design. All three are Phase 1 concerns, not later optimizations. Research from ACL 2025 (CONSENSAGENT) confirms sycophancy is a structural property of RLHF-trained models in group settings, not a prompt engineering edge case — it must be addressed at persona design time.

## Key Findings

### Recommended Stack

The Vercel AI SDK (`ai@6.0.116`) is the single most consequential library choice. It provides unified streaming, multi-provider adapters (`@ai-sdk/anthropic@3.0.58`, `@ai-sdk/openai@3.0.41`, `@ai-sdk/google@3.0.43`), and a `ToolLoopAgent` abstraction — without it, separate streaming logic per provider must be written and maintained. Next.js 16 (App Router + Route Handlers) handles SSE natively and keeps the stack unified. Drizzle ORM with `better-sqlite3` gives TypeScript-first schema definition with zero tooling friction for a personal project.

**Core technologies:**
- **Next.js 16.2.0:** Full-stack framework — App Router, Route Handlers for SSE, no separate API server
- **Vercel AI SDK v6:** Multi-provider LLM abstraction — switching models is a one-line change
- **`@ai-sdk/anthropic` + `@ai-sdk/openai` + `@ai-sdk/google`:** Provider adapters — identical interfaces, provider-agnostic agent code
- **Drizzle ORM + SQLite (`better-sqlite3`):** Persistence — TypeScript-first, zero setup, single file, upgrade path to Postgres via Drizzle
- **Zustand 5.x:** Client state — centralized store for room/agent/message state; better fit than Jotai for cross-cutting chat state
- **Tailwind CSS v4 + shadcn/ui:** UI — de facto standard; shadcn components (ScrollArea, Avatar, Badge, Input) cover chat UI needs
- **Zod 3.x:** Validation — required by AI SDK for structured outputs; use throughout for consistency
- **SSE (native Next.js Route Handlers):** Real-time transport — unidirectional server→client, no extra library, native browser reconnect
- **Biome:** Linting/formatting — replaces ESLint + Prettier; single tool, zero config, faster

**What to avoid:** LangChain.js (leaky abstractions, lags provider updates), Socket.IO (unnecessary for unidirectional streaming), Redux (excessive boilerplate), OpenAI Assistants API (locks conversation state to one provider, destroys multi-provider value proposition), MongoDB/NoSQL (chat is relational — rooms contain agents contain messages).

### Expected Features

**Must have (v1 table stakes):**
- Room management (create, name, list, delete) — foundational structure
- Per-agent persona/role assignment (system prompt, provider, model) — without roles, agents produce the same voice
- Multi-provider LLM support (Claude, GPT, Gemini) — stated core requirement
- Autonomous agent conversation with configurable turn limit — the core value proposition; turn limit is not optional
- Real-time token streaming with per-agent thinking indicators — watching agents think is the experience
- User message injection mid-conversation — user is both audience and director
- Start / Stop / Pause controls — without Stop, every session risks runaway cost
- Conversation history persisted per room — context loss on browser close is unacceptable
- Per-room token usage display — cost transparency required for responsible use

**Should have (v1.x, after validation):**
- Conversation summary on demand — needed once rooms exceed ~50 messages
- Conversation export (Markdown/JSON) — users will want to act on insights elsewhere
- Infinite-loop / repetition detection via similarity check — may appear immediately in practice
- Redirect injection (change topic without full restart) — currently workaroundable via Stop + new prompt
- Speaker-selection strategy config (round-robin vs. LLM-selected) — add when rigid round-robin feels limiting

**Defer (v2+):**
- Independent parallel first round (prevents herding) — high complexity; defer until herding is confirmed as a problem
- Asymmetric context injection per agent — adds configuration surface; validate simpler persona differentiation first
- Convergence detection (LLM-as-judge) — adds latency and cost; defer until turn limits prove insufficient
- Agent long-term memory across rooms — significant complexity, token cost risk; defer
- Agent tool use / code execution — out of scope for v1; sandbox security makes this a separate project

**Anti-features (do not build):**
- Multi-user collaboration — destroys simplicity, adds auth/permissions/presence
- Voice/audio — entirely separate engineering domain
- Live web search per agent — tool failures derail conversations; user-paste is adequate

### Architecture Approach

The architecture is a layered monolith within Next.js: Frontend (React) communicates via SSE for streaming and HTTP POST for commands. A Conversation Manager owns the sequential turn loop and is the single point of control for start/stop/redirect. Agent Instances are thin wrappers — they hold persona config and delegate LLM calls to an LLM Gateway that normalizes provider differences. A Context Service assembles per-agent context windows (sliding window, not full history) to prevent O(n²) token cost growth. Storage is SQLite via Drizzle with an in-memory cache for active room history.

**Major components:**
1. **Conversation Manager** — owns the turn loop; select speaker, call agent, broadcast result, repeat; single point for stop/pause/redirect
2. **LLM Gateway** — unified streaming interface over Claude/GPT/Gemini; provider-specific adapters behind a common interface; one place for error normalization and retry
3. **Context Service** — builds per-agent context windows; sliding window (last N messages verbatim + summary of older turns); prevents token bloat and context rot
4. **Storage layer (Drizzle + SQLite)** — persists rooms, agents, messages; in-memory cache for active rooms (fast context assembly without DB round-trips)
5. **SSE Streaming endpoint** — pushes token chunks and turn events from Conversation Manager to Chat View in real-time
6. **REST API (Next.js Route Handlers)** — thin CRUD layer for rooms/agents; control endpoints (start, stop, redirect)
7. **Chat View (React + Zustand)** — renders live message feed with per-agent color/avatar; Zustand stores connection status, active agent state, message buffer

**Build order (architecture-dictated):** Storage → LLM Gateway → Agent Instance + Context Service → Conversation Manager → SSE/WebSocket → REST API → Frontend.

### Critical Pitfalls

1. **Infinite conversation loops** — build turn limits (`max_turns`) and termination checks together with the first conversation loop; this is a correctness requirement, not an optimization. Use defense-in-depth: hard limit AND semantic cycle detection. Without this, $40+ API bills in minutes are documented outcomes.

2. **Runaway token costs (O(n²) growth)** — implement context sliding window from the first iteration. Full conversation history re-sent to every agent every turn is the single most expensive technical debt in this domain; recovery after the fact is a medium-cost refactor. Track cumulative input+output tokens per session with a circuit breaker.

3. **Agent sycophancy / echo chamber collapse** — RLHF-trained models are structurally predisposed to convergence in group settings (ACL 2025, CONSENSAGENT). Adversarial role design must be in system prompts from day one: assign explicit "maintain your position" instructions, a mandatory skeptic role, and position-change tracking. This cannot be patched later without re-architecting personas.

4. **Context rot over long conversations** — system prompts get buried under dozens of prior messages, causing agents to lose their assigned persona. Mitigate by re-injecting condensed role reminders at regular intervals and applying the sliding window before turn 10, not after problems appear. Test at 15+ turns, not 3-5.

5. **Multi-provider API leakage** — define the `LLMProvider` interface before writing the first real provider call. Provider-specific conditionals that leak into agent logic create a painful refactor when adding the second provider. The Vercel AI SDK handles most of this, but the internal abstraction boundary still matters.

6. **No turn-taking coordinator** — parallel agent responses destroy conversation coherence with non-deterministic message ordering. Sequential turns enforced by the Conversation Manager are a foundational architectural decision, not a later addition.

## Implications for Roadmap

### Phase 1: Foundation — Storage, LLM Gateway, Core Data Model

**Rationale:** Nothing else is buildable without the data schema and provider abstraction. Architecture research explicitly identifies storage as the first dependency in the build order graph. The LLM Gateway must be established before any agent code exists to prevent provider-specific code from spreading.

**Delivers:** Working database schema (rooms, agents, messages tables via Drizzle migrations), verified LLM connections to all three providers (Claude, GPT, Gemini) through a unified streaming interface, basic room and agent CRUD via REST API.

**Addresses:** Room management, per-agent config storage, multi-provider LLM support (infrastructure layer).

**Avoids:** Multi-provider API leakage pitfall — gateway interface defined before any agent logic exists.

**Research flag:** Standard patterns — Drizzle schema design and Next.js API routes are well-documented. Skip phase research.

### Phase 2: Orchestration Engine — Conversation Manager + Context Service

**Rationale:** This is the core of the product and the most complex subsystem. It must be built and testable (via CLI, without UI) before any streaming or frontend work. The Context Service must ship alongside the Conversation Manager — never build the turn loop without context windowing, because retrofitting compression is a medium-cost refactor.

**Delivers:** Conversation Manager with sequential turn loop, configurable `max_turns` hard limit, semantic cycle detection, Start/Stop/Pause state machine. Context Service with sliding window (last 20 messages verbatim + summary of older turns). Verified persona stability across 15+ turns. Token accumulator with circuit breaker. CLI-testable multi-agent conversation.

**Addresses:** Autonomous agent conversation, turn limit, Start/Stop/Pause controls, conversation history, token usage tracking.

**Avoids:** Infinite loop pitfall, runaway token cost pitfall, context rot pitfall, sycophancy pitfall (system prompt design for adversarial roles is part of this phase's agent config work).

**Research flag:** Needs phase research — the orchestration loop's interaction with the AI SDK's `streamText` in an SSE context has subtle timing considerations. Research how to cancel in-flight `streamText` calls on Stop command.

### Phase 3: Real-Time UI — SSE Streaming + Chat View

**Rationale:** Backend conversation is verifiable by Phase 2. Frontend can now be built against stable contracts. SSE transport layer connects the working Conversation Manager to the browser. UI must stream tokens as they arrive — no-streaming is a UX non-starter for 5-30s LLM generation times.

**Delivers:** SSE streaming endpoint pushing token chunks and turn events. Chat View with real-time token display, per-agent color/avatar visual identity, per-agent "thinking" indicator (AGENT_THINKING → AGENT_STREAMING → AGENT_DONE events), user message injection, Stop/Pause buttons that cancel in-flight API calls.

**Addresses:** Real-time message display, user participation, Start/Stop/Pause UI controls, per-agent thinking indicator.

**Avoids:** Blocking UI during LLM calls (async Conversation Manager loop runs independent of SSE handler), no-streaming UX pitfall, no visual distinction between agents pitfall.

**Research flag:** Standard patterns — SSE via Next.js Route Handlers is documented and the AI SDK uses it internally. Skip phase research.

### Phase 4: Room Management UI + Agent Config

**Rationale:** Core conversation loop and streaming are working. Polish the management surface — room creation/deletion/listing, agent configuration UI (persona, provider, model, system prompt), conversation history loading on room open.

**Delivers:** Complete room management UI (sidebar, room list, create/delete flow), Agent Config Panel (create/edit/delete agents per room), conversation history loaded on room open, per-room token usage display.

**Addresses:** Room management UI, per-room token display, conversation history persistence UX.

**Avoids:** In-memory state only pitfall (history must load from DB on room open, not just exist in memory).

**Research flag:** Standard patterns — React/Zustand state management for this shape of data is well-documented. Skip phase research.

### Phase 5: Conversation Quality + Safety Features

**Rationale:** Once the core loop is working with real conversations, quality and safety gaps become visible. This phase addresses the pitfalls that are hard to anticipate in theory but obvious in practice: echo chambers, repetition, drift.

**Delivers:** Infinite-loop/repetition detection (hash-based similarity check, auto-pause with warning), conversation summary on demand (LLM call with full transcript), conversation export (Markdown/JSON download), redirect injection (high-priority system message prepended to next turn without full restart).

**Addresses:** Infinite-loop detection (v1.x), conversation summary, export, redirect injection.

**Avoids:** Echo chamber collapse, UI flooding with repeated messages, user frustration with conversation drift.

**Research flag:** Loop detection algorithm (similarity threshold tuning) may benefit from phase research — documented approaches vary and the right threshold depends on model behavior in practice.

### Phase 6: Differentiators (v2 Features)

**Rationale:** After the core workflow is validated and stable, add features that increase the quality of agent disagreement and conversation utility. These are explicitly v2+ in the feature research.

**Delivers:** Speaker-selection strategy config (round-robin vs. LLM-selected next speaker), independent parallel first round (agents commit initial answers before seeing others'), asymmetric context injection per agent (different source documents per agent).

**Addresses:** Speaker-selection strategy, parallel first round, asymmetric context injection.

**Research flag:** LLM-as-judge for speaker selection and convergence detection need phase research — prompt design for reliable meta-reasoning LLM calls is non-trivial.

### Phase Ordering Rationale

- **Storage before everything:** Every other component reads and writes here; schema changes after agent logic exists are painful.
- **Gateway before agents:** Provider-specific code is the highest-recovery-cost pitfall if it spreads into business logic. Containment is architecturally enforced by building the interface first.
- **Orchestration before UI:** The Conversation Manager is testable via CLI. Building UI before the loop is stable means UI development races against backend design changes.
- **Turn limits are non-negotiable in Phase 2:** Every pitfall source explicitly states loop termination is a correctness requirement, not an optimization. Shipping Phase 2 without `max_turns` is not an acceptable MVP state.
- **Context windowing is non-negotiable in Phase 2:** O(n²) token cost is not a performance problem — it's a cost spiral that makes the tool unusable. Build it alongside the first conversation loop.
- **Adversarial persona design in Phase 2:** Sycophancy is structural. System prompt design for agent roles must include anti-convergence instructions from the first working conversation, before behavioral patterns are established and tested-around.

### Research Flags

**Needs phase research during planning:**
- **Phase 2 (Orchestration):** How to cancel in-flight `streamText` calls on Stop command with AI SDK v6. SSE stream lifecycle and cleanup. The ToolLoopAgent abstraction's interaction with custom conversation loops.
- **Phase 6 (Differentiators):** LLM-as-judge prompt design for speaker selection and convergence detection — reliable meta-reasoning prompt patterns.

**Standard patterns (skip phase research):**
- **Phase 1 (Foundation):** Drizzle schema design with SQLite, Next.js Route Handler CRUD, Zod validation — all well-documented.
- **Phase 3 (Streaming UI):** SSE via Next.js Route Handlers — documented; AI SDK uses internally. Zustand for chat state — established patterns.
- **Phase 4 (Room Management):** React UI composition with Zustand, shadcn/ui components — standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official npm versions verified, Next.js 16.2.0 confirmed March 2026, AI SDK v6 release documented, all provider adapter versions from npm registry |
| Features | HIGH (core), MEDIUM (differentiators) | Table stakes verified against AutoGen, CrewAI, AG-UI official docs. Differentiators cross-referenced against MindStudio practitioner article and framework comparison |
| Architecture | HIGH | Confirmed against Google ADK docs, AutoGen 0.2 GroupChatManager, AG2 orchestration patterns, Azure AI agent design patterns. All major patterns independently documented |
| Pitfalls | HIGH | Multiple independent sources including ACL 2025 peer-reviewed research (CONSENSAGENT), arXiv 2025 papers, multiple practitioner post-mortems. Sycophancy pitfall is research-backed, not anecdotal |

**Overall confidence:** HIGH for the core system. The fundamental architecture and stack choices are well-validated. The main uncertainty is in v2 differentiator feature complexity (parallel first round, convergence detection) where real-world performance depends on model behavior that varies by provider.

### Gaps to Address

- **AI SDK v6 Stop/Cancel behavior:** The exact API for cancelling a `streamText` call mid-stream when the user hits Stop is not fully documented in research. Validate during Phase 2 implementation and adjust Conversation Manager design accordingly.
- **Sliding window threshold:** The research cites "last 8-20 messages" as the verbatim window. The right number depends on agent count and average response length. Start with 20, tune based on context window usage in practice.
- **Similarity threshold for loop detection:** Hash-based cycle detection with a similarity threshold needs tuning. Research does not provide a canonical value. Plan for a configurable threshold with a sensible default (e.g., 0.85 cosine similarity on last 5 messages).
- **SQLite WAL mode:** For local personal use, default SQLite journal mode is likely fine. If deployed to a server, enable WAL mode (`db.pragma('journal_mode = WAL')`) for better concurrent reads. Document this in Phase 1 setup.

## Sources

### Primary (HIGH confidence)
- `https://ai-sdk.dev/docs/introduction` — AI SDK v6 (6.0.116), streaming APIs, provider adapters, ToolLoopAgent
- `https://vercel.com/blog/ai-sdk-6` — AI SDK 6 release notes, stable Agent abstraction
- `https://github.com/vercel/next.js/releases` — Next.js 16.2.0 confirmed stable March 18, 2026
- `https://www.npmjs.com/package/@ai-sdk/anthropic` — v3.0.58
- `https://www.npmjs.com/package/@ai-sdk/openai` — v3.0.41
- `https://www.npmjs.com/package/@ai-sdk/google` — v3.0.43
- `https://www.npmjs.com/package/drizzle-orm` — v0.45.1
- `https://ui.shadcn.com/docs/tailwind-v4` — Tailwind v4 support confirmed
- `https://microsoft.github.io/autogen/docs/Use-Cases/agent_chat/` — ConversableAgent, GroupChatManager, turn-taking
- `https://docs.crewai.com/en/concepts/agents` — CrewAI agent design, role/backstory fields
- `https://docs.ag-ui.com/introduction` — AG-UI protocol, agent communication patterns
- `https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/orchestration/group-chat/patterns/` — Speaker selection strategies
- `https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns` — Group chat orchestration, star topology
- `https://docs.cloud.google.com/architecture/multiagent-ai-system` — Reference architecture, component roles
- `https://aclanthology.org/2025.findings-acl.1141/` — CONSENSAGENT, ACL 2025: sycophancy in multi-agent LLM interactions (peer-reviewed)
- `https://arxiv.org/html/2509.23055v1` — Peacemaker or Troublemaker: sycophancy in multi-agent debate (arXiv 2025)

### Secondary (MEDIUM confidence)
- `https://www.mindstudio.ai/blog/agent-chat-rooms-multi-agent-debate-claude-code` — Practitioner implementation of multi-agent chat room
- `https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events` — SSE vs WebSocket for Next.js
- `https://makerkit.dev/blog/tutorials/drizzle-vs-prisma` — Drizzle vs Prisma comparison
- `https://orq.ai/blog/why-do-multi-agent-llm-systems-fail` — Multi-agent failure modes
- `https://galileo.ai/blog/multi-agent-llm-systems-fail` — Multi-agent failure modes (corroborates orq.ai)
- `https://markaicode.com/fix-infinite-loops-multi-agent-chat/` — Infinite loop prevention
- `https://inkeep.com/blog/context-engineering-why-agents-fail` — Context rot in production agents
- `https://www.proxai.co/blog/archive/llm-abstraction-layer` — LLM gateway pattern rationale
- `https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/` — Sliding window, summarization, agent scoping

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
