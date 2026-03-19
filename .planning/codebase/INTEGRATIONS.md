# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

**Web Search:**
- Brave Search - Web search and content discovery
  - API: https://api.search.brave.com/res/v1/web/search
  - Client: Fetch API (Node.js built-in)
  - Auth: X-Subscription-Token header
  - Env var: BRAVE_API_KEY
  - Location: `bin/lib/commands.cjs`
  - Usage: Optional research capability
  - Query parameters: q, limit, freshness
  - Response format: JSON with web.results array

## Data Storage

**Databases:**
- None - Filesystem-based storage only

**File Storage:**
- Local filesystem only
- All project state in `.planning/` directory
- Configuration: `.planning/config.json`
- State tracking: `.planning/STATE.md`
- Phase planning: `.planning/phases/`
- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- Milestones: `.planning/MILESTONES.md`
- Todos: `.planning/todos/`

**Caching:**
- None - All data is persistent state

## Authentication & Identity

**Auth Provider:**
- Custom (no centralized auth provider)
- API key authentication for Brave Search
- Git authentication via system git configuration

**Implementation:**
- API keys stored in:
  1. Environment variable: BRAVE_API_KEY
  2. File: ~/.gsd/brave_api_key (fallback)
- No session management or token refresh
- Each call passes token in request headers

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service

**Logs:**
- Console logging only (stdout/stderr)
- Hook system outputs JSON for Claude Code
- Context monitoring via temporary files
  - Path: `/tmp/claude-ctx-{session_id}.json`
  - Contains: remaining_percentage, used_pct, timestamp
  - Consumed by: `hooks/gsd-context-monitor.js`

## CI/CD & Deployment

**Hosting:**
- None - Local CLI tool

**CI Pipeline:**
- None - No CI integration
- Git integration for:
  - Checking ignore status
  - Creating commits
  - Branch operations

**Deployment Model:**
- Single-user local execution
- State persisted to git repository
- No server-side deployment

## Environment Configuration

**Required Env Vars:**
- None strictly required

**Optional Env Vars:**
- BRAVE_API_KEY - Web search authentication
- HOME or USERPROFILE - User home directory
- TMPDIR - Temporary directory for metrics

**Secrets Location:**
- ~/.gsd/brave_api_key - Optional persistent key storage
- Never committed to repository

**Config File:**
- `.planning/config.json` - Project configuration
- No credentials stored
- Defaults applied if missing
- Sections: workflow, git, planning, models

## Webhooks & Callbacks

**Incoming:**
- None - Command-driven only

**Outgoing:**
- None - GSD does not post to external services
- Brave Search is read-only
- Git operations are local

## Claude Code Integration

**Hook System:**
- SessionStart: Runs version checking
- PostToolUse: Runs context monitoring
- Status line: Runs progress display

**Hook Output Format:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse|AfterTool",
    "additionalContext": "message text"
  }
}
```

**Metrics Storage:**
- Ephemeral JSON in system temp directory
- Format: `/tmp/claude-ctx-{session_id}.json`

## Custom Agent Profiles

**Supported Agent Types:**
- codebase-mapper
- executor
- planner
- researcher
- verifier
- debugger
- phase-researcher
- plan-checker
- nyquist-auditor
- integration-checker
- ui-researcher
- ui-auditor
- ui-checker
- project-researcher
- user-profiler
- roadmapper

**Agent Configuration:**
- Profiles: balanced, performance, quality
- Model mappings in `bin/lib/model-profiles.cjs`
- Dynamic resolution based on profile

## Integration Locations

**Web Search:**
- Implementation: `bin/lib/commands.cjs` cmdWebSearch()
- Configuration: `.planning/config.json` brave_search flag

**Git Operations:**
- Implementation: `bin/lib/core.cjs` execGit() and isGitIgnored()
- Hook configuration: `.claude/settings.json`

**Config Management:**
- Implementation: `bin/lib/config.cjs`
- API key handling: `bin/lib/init.cjs`

---

*Integration audit: 2026-03-19*
