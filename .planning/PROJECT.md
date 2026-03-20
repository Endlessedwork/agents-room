# Agents Room

## What This Is

A personal web application where AI agents (powered by Claude, GPT, Gemini, OpenRouter, and Ollama) converse with each other in topic-based rooms. The user observes conversations streaming in real-time, participates by typing messages, and controls agent behavior (start/pause/stop). Built with Next.js 16, Drizzle SQLite, Zustand, and Tailwind v4.

## Core Value

Agents must be able to have meaningful conversations with each other that produce genuinely useful insights and solutions — the room is only valuable if agent collaboration yields better outcomes than talking to one agent alone.

## Requirements

### Validated

- ✓ Room CRUD with name, topic, status — v1.0
- ✓ Agent creation with structured prompts (role, personality, rules, constraints) and avatar — v1.0
- ✓ Multi-provider LLM support: Claude, GPT, Gemini, OpenRouter, Ollama — v1.0
- ✓ Copy-on-assign agent-to-room binding — v1.0
- ✓ Autonomous multi-agent conversation with configurable turn limits — v1.0
- ✓ Start/pause/stop/resume conversation control — v1.0
- ✓ Sliding window context management (20 messages) — v1.0
- ✓ Repetition detection with auto-pause (Jaccard similarity) — v1.0
- ✓ Message persistence with sender, timestamp, model, token counts — v1.0
- ✓ Real-time SSE token streaming — v1.0
- ✓ Thinking indicator with animated dots — v1.0
- ✓ User message injection mid-conversation — v1.0
- ✓ Agent identity display (name, role badge, model, colored avatar) — v1.0
- ✓ Token usage visibility per room — v1.0
- ✓ On-demand LLM-powered conversation summary — v1.0
- ✓ Conversation export as Markdown and JSON — v1.0
- ✓ Round-robin and LLM-selected speaker strategies — v1.0
- ✓ Room configuration UI (turn limit slider, speaker strategy select) — v1.0
- ✓ Edit room settings for existing rooms — v1.0

### Active

- ✓ Quality conversations that surface insights and solve problems — Validated in Phase 7: Conversation Quality
- ✓ Cost estimation display per room — Validated in Phase 8: Cost Estimation
- [ ] Independent parallel first round (agents respond before seeing each other)
- ✓ Convergence detection (auto-pause when agents reach consensus) — Validated in Phase 9: Convergence Detection
- [ ] Clean up tech debt (orphaned files, type errors, over-fetching)

## Current Milestone: v1.1 Conversation Quality & Polish

**Goal:** Improve conversation quality, add cost visibility, enable smarter conversation flow (parallel first round + convergence detection), and clean up tech debt from v1.0.

**Target features:**
- Quality conversations with better prompting and insight surfacing
- Cost estimation per room based on model pricing
- Independent parallel first round for richer initial responses
- Convergence detection to auto-stop when agents agree
- Tech debt cleanup (dead code, type errors, over-fetching)

### Out of Scope

- Multi-user / team collaboration — personal tool, single user only
- Mobile native app — web-first, responsive works on mobile browser
- Voice/audio interaction — text-only
- Agent tool use / code execution — conversation-focused first
- Agent-driven web search (live RAG) — multiplies latency/cost
- Real-time keystroke streaming — SSE token streaming sufficient

## Context

Shipped v1.0 with 8,359 LOC TypeScript across 6 phases in 2 days.
Tech stack: Next.js 16, Vercel AI SDK v6, Drizzle ORM + SQLite (WAL), Zustand, Tailwind v4, shadcn/ui (Base UI).
121 tests passing across 14 test files. 12/12 UAT tests passed.
All 21 v1 requirements satisfied with full traceability.

Known tech debt: orphaned ConversationPanel.tsx, test file type errors, over-fetching in room detail endpoint, no cost estimation.

## Constraints

- **LLM Providers**: Must support multiple providers — each agent can use a different model
- **Deployment**: Personal use, runs locally or simple server
- **Cost awareness**: Multiple agents × LLM API calls — token visibility and cost estimation shipped
- **Browser**: SSE-based streaming, no WebSocket complexity

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 16 + Vercel AI SDK v6 | Research-backed: best streaming + React integration | ✓ Good — SSE streaming works well |
| Drizzle + SQLite (WAL mode) | Lightweight, single-user, no DB server needed | ✓ Good — fast, reliable, cascade deletes work |
| Copy-on-assign room agents | Room agent config independent of library edits | ✓ Good — prevents config drift |
| Structured prompt fields (4 columns) | Better than single blob for UI and validation | ✓ Good — AgentForm has clear sections |
| Layered monolith architecture | ConversationManager → ContextService → Gateway | ✓ Good — clean separation, testable |
| In-process SSE via StreamRegistry | Simple fan-out, no Redis/external broker needed | ✓ Good — works for single-user |
| Zustand for client state | Lightweight, no boilerplate vs Redux | ✓ Good — chatStore handles complex streaming state well |
| Transient summary (not persisted) | Summary is cheap to regenerate, avoids DB schema change | ✓ Good — simple, works via URL param for export |
| window.location.reload for edit save | Simpler than prop threading for infrequent action | ⚠️ Revisit — could use router.refresh() |
| Token counts only (no cost) | Cost requires dynamic pricing per model/provider | ✓ Resolved — Phase 8 added cost estimation via llm-info |

---
*Last updated: 2026-03-21 after Phase 9 (Convergence Detection) complete*
