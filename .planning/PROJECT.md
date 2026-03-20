# Agents Room

## What This Is

A personal web application where AI agents (powered by multiple LLM providers like Claude, GPT, Gemini) converse with each other in topic-based rooms, while the user observes conversations in real-time and participates by typing messages or controlling agent behavior. Think of it as a multi-agent chat room where the human is both audience and director.

## Core Value

Agents must be able to have meaningful conversations with each other that produce genuinely useful insights and solutions — the room is only valuable if agent collaboration yields better outcomes than talking to one agent alone.

## Requirements

### Validated

- [x] Configurable AI agents with custom roles/personas per room — Validated in Phase 1: Foundation
- [x] Multi-provider LLM support (Claude, GPT, Gemini, etc.) — Validated in Phase 1: Foundation
- [x] Agents converse autonomously once given a topic — Validated in Phase 2: Conversation Engine
- [x] User can control agents (start, stop, redirect conversation) — Validated in Phase 2: Conversation Engine
- [x] Conversation history persisted per room — Validated in Phase 2: Conversation Engine

### Active

- [ ] Multiple chat rooms, each with its own topic/purpose
- [ ] User can also initiate/open topics for agents to discuss
- [x] Real-time message display as agents converse — Validated in Phase 3: Real-Time UI
- [x] User can type messages into the room to participate — Validated in Phase 3: Real-Time UI
- [x] Token usage visibility per room — Validated in Phase 4: Insights
- [x] On-demand conversation summaries — Validated in Phase 4: Insights
- [x] Conversation export (Markdown/JSON) — Validated in Phase 4: Insights
- [ ] Quality conversations that surface insights and solve problems

### Out of Scope

- Multi-user / team collaboration — personal tool, single user only
- Mobile native app — web-first
- Voice/audio interaction — text-only for v1
- Agent-to-agent file sharing or code execution — conversation-focused first

## Context

- The user wants a tool to enhance their development workflow by having specialized AI agents debate, brainstorm, and problem-solve together
- Success looks like: conversations that produce genuinely better insights than solo AI chat, and agents that can actually debug/solve real problems collaboratively
- No tech stack decided yet — research phase will help determine the best approach
- Single-user personal tool, so auth complexity is minimal
- Real-time UI is critical — the value comes from watching agents think together live

## Constraints

- **LLM Providers**: Must support multiple providers (not locked to one) — each agent can use a different model
- **Deployment**: Personal use, so can run locally or on a simple server
- **Cost awareness**: Multiple agents calling LLM APIs means token costs add up — need to be mindful of efficiency

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-provider LLM support | Different models have different strengths; want flexibility | — Pending |
| Web chat UI | Real-time visual feedback is essential for the experience | — Pending |
| Single-user focus | Simplifies auth/permissions, faster to ship | — Pending |

---
*Last updated: 2026-03-20 after Phase 6 gap closure — Edit Room dialog, slider fix, full room-config UI verified (AGNT-04, AGNT-05 closed)*
