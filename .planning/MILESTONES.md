# Milestones

## v1.1 Conversation Quality & Polish (Shipped: 2026-03-21)

**Phases completed:** 5 phases, 11 plans
**Timeline:** 2 days (2026-03-20 → 2026-03-21)
**Code:** 5,942 LOC TypeScript | 108 commits
**Requirements:** 15/15 satisfied

**Key accomplishments:**

1. Anti-sycophancy prompts and topic-lock injection keep agents maintaining distinct epistemic stances
2. Real-time estimated cost display per room using llm-info pricing data (est. prefix, "local" for Ollama, "---" for unknown)
3. Convergence detection auto-pauses conversations when agents reach genuine consensus (AND-logic: phrases + Jaccard ≥ 0.35)
4. Parallel first round lets all agents form independent views before seeing peers (buffer-then-emit pattern)
5. Tech debt eliminated: orphaned ConversationPanel.tsx deleted, test file type errors fixed, room detail over-fetching narrowed

**v1.0 tech debt resolved:**

- ✓ Orphaned `ConversationPanel.tsx` removed
- ✓ Token display now includes cost estimation
- ✓ Room detail endpoint no longer over-fetches messages
- ✓ Test file TypeScript errors fixed

---

## v1.0 Agents Room MVP (Shipped: 2026-03-20)

**Phases completed:** 6 phases, 16 plans
**Timeline:** 2 days (2026-03-19 → 2026-03-20)
**Code:** 8,359 LOC TypeScript | 121 tests passing
**Requirements:** 21/21 satisfied

**Key accomplishments:**

1. Full room and agent management with 5 LLM provider support (Claude, GPT, Gemini, OpenRouter, Ollama)
2. Autonomous multi-agent conversation engine with turn control, sliding window context, and repetition detection
3. Real-time SSE streaming chat UI with thinking indicators, user message injection, and agent identity display
4. Token usage visibility, on-demand LLM-powered summaries, and Markdown/JSON conversation export
5. Room configuration UI for turn limits and speaker selection strategy (create + edit)
6. Comprehensive verification: 121 tests, 12/12 UAT, full requirement traceability across all 6 phases

**Tech debt accepted:**

- Orphaned `ConversationPanel.tsx` (dead code)
- Token display shows counts only (no cost estimation)
- GET /api/rooms/:roomId over-fetches messages relation
- Test file TypeScript errors (runtime passes)

---
