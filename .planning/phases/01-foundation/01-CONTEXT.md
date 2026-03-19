# Phase 1: Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Room and agent management with LLM gateway infrastructure. Users can create/manage rooms, create/configure AI agents with distinct personas, and assign agents to rooms. All data persisted in SQLite. LLM gateway verified working with 5 providers. No conversation engine or real-time streaming — those are Phase 2 and 3.

</domain>

<decisions>
## Implementation Decisions

### API Key Management
- In-app settings page with provider cards — one card per provider showing status (configured/not configured) and a "Test connection" button
- 5 providers supported from day one: Anthropic (Claude), OpenAI (GPT), Google (Gemini), OpenRouter, Ollama
- Keys stored in database (Claude's discretion on encryption approach for a single-user local tool)
- No env vars fallback needed — settings page is the single source

### Agent Persona Design
- Agents are **global** — created once in a library, then assigned to rooms (as copies)
- Agent creation form fields: name + avatar (color/icon), system prompt (structured form), provider + model picker, temperature slider
- System prompt editor is a **structured form** with separate fields for role, personality traits, rules, and constraints (not a single textarea)
- **Built-in preset templates** available: e.g., "Devil's Advocate", "Code Reviewer", "Researcher" — one-click creation then customize

### Room List & Navigation
- **Sidebar + main area** layout (Slack/Discord pattern) — room list on the left, conversation view on the right
- Room list items show: name + topic, last activity timestamp, status indicator (running/paused/idle)
- No agent avatars in the sidebar list (keep it clean)
- New room creation via **full-page wizard**: step-by-step flow — name → pick agents from library → set topic → done

### Data Relationships
- Agents are global entities in a library
- Adding an agent to a room creates a **copy** — same starting config but evolves independently per room
- This means each room has its own room_agents table entries with potentially overridden settings
- Default agents on room creation: Claude's discretion (suggest from library during wizard)

### Claude's Discretion
- API key encryption strategy (plain text vs encrypted at rest for personal tool)
- Default agent suggestions during room creation wizard
- Exact avatar system (color palette, icon set, or generated avatars)
- Settings page layout details beyond the provider card pattern
- Database migration strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & Architecture
- `.planning/research/STACK.md` — Technology stack decisions: Next.js 16, AI SDK v6, Drizzle + SQLite, provider adapters
- `.planning/research/ARCHITECTURE.md` — System architecture: layered monolith, LLM gateway pattern, component boundaries
- `.planning/research/SUMMARY.md` — Research synthesis with build order and key decisions

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, out of scope items
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: ROOM-01 through ROOM-04, AGNT-01 through AGNT-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No application code exists yet — this is greenfield
- Only AI tooling configuration present (.agent, .claude, .gemini, .codex, .opencode directories)

### Established Patterns
- No app-level patterns established — Phase 1 will set the conventions
- GSD tooling uses CommonJS + Node.js builtins but this is separate from the app

### Integration Points
- Next.js 16 App Router will be the foundation — all routes, API handlers, and pages start here
- Drizzle + SQLite schema will be the single source of truth for rooms, agents, and messages

</code_context>

<specifics>
## Specific Ideas

- Provider cards in settings should show clear status: green for configured + verified, red for failed test, gray for not configured
- Room creation wizard should feel guided, not overwhelming — 3 clear steps
- Agent presets should be genuinely useful personas, not generic placeholders
- Structured system prompt form should make it easy to create adversarial/contrarian agents (important for conversation quality per research findings on sycophancy)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-19*
