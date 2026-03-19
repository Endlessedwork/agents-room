# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- JavaScript (CommonJS) - GSD CLI tooling and hooks
- Node.js scripts - Hook execution and state management

**Platform:**
- Node.js - Runtime environment

## Runtime

**Environment:**
- Node.js (no version specification, but compatible with hooks infrastructure)

**Package Manager:**
- npm (implied from package.json files)
- Lockfile: Not present (minimal package.json files with only `{"type":"commonjs"}`)

## Frameworks & Core Libraries

**Core Built-in:**
- Node.js `fs` module - File system operations
- Node.js `path` module - Path manipulation (cross-platform)
- Node.js `child_process` module - Subprocess execution (`execSync`, `spawnSync`)
- Node.js `os` module - System utilities (temp directory, homedir)
- Node.js `readline` module - Interactive input handling

**No external dependencies** - GSD is implemented as a self-contained CLI tool with only Node.js builtins

## Key Internal Modules

**GSD Tools (`bin/gsd-tools.cjs`):**
- Main CLI entry point (v1.26.0)
- Orchestrates all GSD commands and workflows
- Manages config, state, phases, and planning documents

**Core Utilities (`bin/lib/core.cjs`):**
- Path helpers (POSIX normalization)
- File I/O and config loading
- Git integration
- Markdown normalization
- Output formatting

**Specialized Modules:**
- `commands.cjs` - Standalone utility commands (slugs, timestamps, todos, search)
- `state.cjs` - STATE.md and project state management
- `config.cjs` - Planning configuration CRUD and validation
- `phase.cjs` - Phase lifecycle (add, remove, complete, renumber)
- `roadmap.cjs` - ROADMAP.md parsing and analysis
- `template.cjs` - Document template filling and scaffolding
- `frontmatter.cjs` - YAML frontmatter extraction and reconstruction
- `verify.cjs` - Verification suite for plans, references, commits
- `milestone.cjs` - Milestone lifecycle and requirements tracking
- `init.cjs` - Project initialization and GSD setup
- `profile-pipeline.cjs` - Agent profile execution pipeline
- `model-profiles.cjs` - Agent-to-model mappings for different profiles
- `profile-output.cjs` - Output formatting for profile data

## Configuration Management

**Environment:**
- `BRAVE_API_KEY` - Optional environment variable for Brave Search integration
- Alternative: Reads from `~/.gsd/brave_api_key` file

**Build/Project Configuration:**
- `.planning/config.json` - Main GSD configuration file (created on init)
- Configuration sections:
  - `model_profile` - Agent profile selection (balanced, performance, quality)
  - `workflow` - Phase research, plan checking, verification, Nyquist validation settings
  - `git` - Branching strategy, branch templates
  - `planning` - Document commit behavior, gitignore search
  - `parallelization` - Concurrent execution settings
  - `brave_search` - Web search availability
- Default configuration applied if `.planning/config.json` missing

**Project Structure Files:**
- `.planning/STATE.md` - Current project state and phase tracking
- `.planning/ROADMAP.md` - Phase roadmap and planning structure
- `.planning/REQUIREMENTS.md` - Requirements traceability
- `.planning/phases/` - Individual phase planning documents
- `.planning/todos/` - Task tracking
- `.planning/MILESTONES.md` - Shipped milestones archive

## External Integrations

**Web Search:**
- Brave Search API (`https://api.search.brave.com/res/v1/web/search`)
- Optional integration
- Requires: `BRAVE_API_KEY` environment variable or `~/.gsd/brave_api_key` file
- Used by: `websearch` command for research tasks

**Git:**
- Invoked via `execSync` for:
  - Checking file ignore status
  - Creating planning commits
  - Branch operations
- Integration: `execGit()` wrapper in `core.cjs`

## Hooks & Events

**Session Start Hook:**
- `hooks/gsd-check-update.js` - Checks for GSD version updates

**Post-Tool Use Hook:**
- `hooks/gsd-context-monitor.js` - Monitors context usage and emits warnings
  - Reads context metrics from temp files
  - Injects warnings as additional context to agent
  - Thresholds: WARNING (≤35%), CRITICAL (≤25%)
  - Debounced to avoid spam (5 tool uses between warnings)

**Status Line:**
- `hooks/gsd-statusline.js` - Renders real-time context and progress metrics

## Platform Requirements

**Development:**
- Node.js runtime
- Git (for version control integration)
- Bash or compatible shell (for hook execution)
- Temporary directory access (`/tmp` or equivalent)

**Production/CI-CD:**
- Node.js runtime
- Git for repository operations
- Read/write access to `.planning/` directory
- Optional: Brave Search API key for web search features

## Data Storage

**Local Filesystem:**
- All GSD state stored in `.planning/` directory
- Relative paths normalized to POSIX format (forward slashes)
- Markdown files with YAML frontmatter
- JSON configuration and state files

**Temporary Storage:**
- `/tmp/claude-ctx-{session_id}.json` - Context metrics (ephemeral)
- `/tmp/gsd-*.json` - Large command outputs (auto-cleanup)

## Architecture Patterns

**Module System:**
- CommonJS (`require()`)
- File-based module organization
- Heavy use of closure-based state encapsulation
- Error handling via `error()` function for early exit

**CLI Pattern:**
- Argument parsing via process.argv in gsd-tools.cjs
- Command dispatch to lib modules
- Output via `output()` function (JSON or raw, with file buffer for large payloads)
- Exit codes: 0 (success), 1 (error)

**Markdown Processing:**
- Normalization applied at write points (MD022, MD031, MD032, MD012, MD047)
- YAML frontmatter extraction via regex
- Support for "must_haves" blocks in PLAN.md

---

*Stack analysis: 2026-03-19*
