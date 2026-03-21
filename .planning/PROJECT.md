# Agents Room

## What This Is

A personal web application where AI agents (powered by Claude, GPT, Gemini, OpenRouter, and Ollama) converse with each other in topic-based rooms. The user observes conversations streaming in real-time, participates by typing messages, and controls agent behavior (start/pause/stop). Conversations feature anti-sycophancy prompting, convergence detection, cost estimation, and parallel first rounds. Agents are fully manageable — editable, annotatable with notes, with live model selection from providers and reusable presets. Built with Next.js 16, Drizzle SQLite, Zustand, and Tailwind v4.

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
- ✓ Anti-sycophancy prompts and topic-lock injection for conversation quality — v1.1
- ✓ Real-time estimated cost display per room (est. prefix, "local" for Ollama, "---" for unknown) — v1.1
- ✓ Convergence detection with auto-pause when agents reach consensus — v1.1
- ✓ Parallel first round (all agents respond independently before seeing peers) — v1.1
- ✓ Tech debt cleanup: dead code removed, type errors fixed, over-fetching eliminated — v1.1
- ✓ Agent notes — add/edit notes on any agent, visible on agent card — v1.2
- ✓ Agent editing — update any field on existing agents with copy-on-assign banner — v1.2
- ✓ Dedicated Providers page — full CRUD for provider keys, moved from Settings — v1.2
- ✓ Live model picker — dropdown populated from provider APIs with search, fallback, and capability tags — v1.2
- ✓ Agent presets — create, save-as, edit, delete presets with 3 seeded system presets — v1.2

### Active

(None — next milestone not yet defined. Use `/gsd:new-milestone` to start.)

### Out of Scope

- Multi-user / team collaboration — personal tool, single user only
- Mobile native app — web-first, responsive works on mobile browser
- Voice/audio interaction — text-only
- Agent tool use / code execution — conversation-focused first
- Agent-driven web search (live RAG) — multiplies latency/cost
- Real-time keystroke streaming — SSE token streaming sufficient
- Dynamic pricing via external API — static table sufficient, API adds latency
- LLM-as-judge for convergence — doubles API cost, Jaccard + phrases sufficient
- Streaming parallel first round — buffer-then-display is cleaner UX
- Per-agent cost breakdown — marginal value over room total

## Context

Shipped v1.2 with 7,219 LOC TypeScript across 15 phases (42 plans) in 3 milestones over 4 days.
Tech stack: Next.js 16, Vercel AI SDK v6, Drizzle ORM + SQLite (WAL), Zustand, Tailwind v4, shadcn/ui (Base UI), llm-info.
v1.2 added agent management: editing, notes, live model picker, providers page, and presets CRUD.
Known tech debt: preset name badge for user-created presets, notes field in save-as-preset.

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
| llm-info for cost estimation | Static pricing, no external API calls | ✓ Good — fast, offline-capable, covers major models |
| AND-logic convergence detection | Phrases + Jaccard ≥ 0.35, min 6 turns | ✓ Good — no false positives on early pleasantries |
| Buffer-then-emit parallel round | Promise.all contexts, Promise.allSettled LLM calls | ✓ Good — structural isolation, clean abort handling |
| Anti-sycophancy prompt injection | System injects counter-agreement prompts from round 2 | ✓ Good — agents maintain distinct stances |
| Topic-lock every 5 turns | Redirects drift back to room topic | ✓ Good — keeps conversations focused |
| Drizzle generate+migrate (not push) | Auditable migration files from Phase 12 onward | ✓ Good — reproducible schema changes |
| Dual-mode AgentForm via initialData prop | Single component for create and edit | ✓ Good — no duplication, clean pattern |
| Settings → /providers redirect | Server component redirect, no dead Settings page | ✓ Good — clean navigation |
| Per-provider model adapters | Each provider has unique API shape for model listing | ✓ Good — 5 providers fully supported |
| ModelCombobox with free-text fallback | Graceful degradation when provider unconfigured | ✓ Good — never blocks agent creation |
| Presets in DB with isSystem flag | System presets seeded, user presets CRUD-able | ✓ Good — clean separation, idempotent seed |
| PresetForm uses plain Input for model | Presets are templates — free-text model string sufficient | ✓ Good — avoids provider coupling |

---
*Last updated: 2026-03-22 after v1.2 milestone completed*
