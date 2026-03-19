# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```
/home/vsman/agents-room/
├── .agent/                    # Primary orchestration framework
│   ├── get-shit-done/         # Core GSD system
│   │   ├── bin/               # CLI utilities (gsd-tools.cjs)
│   │   ├── workflows/         # Orchestration workflows (47 markdown files)
│   │   ├── templates/         # Document templates (30+ markdown files)
│   │   ├── references/        # Reference documentation (14 files)
│   │   └── VERSION            # Framework version
│   ├── agents/                # Specialized agent definitions (16 agents)
│   ├── skills/                # Project skills/patterns (44 skill directories)
│   ├── hooks/                 # Git hooks
│   ├── agents/                # Legacy? (appears to be definition files)
│   ├── gsd-file-manifest.json # File hash manifest
│   ├── settings.json          # Framework settings
│   └── package.json           # Node.js type declaration
├── .claude/                   # Claude-specific implementation
│   ├── get-shit-done/         # Mirror of .agent structure
│   ├── agents/                # Agent implementations
│   ├── commands/              # Command wrappers (gsd/)
│   └── hooks/
├── .gemini/                   # Gemini-specific implementation
├── .codex/                    # Codex-specific implementation
├── .opencode/                 # OpenCode-specific implementation
├── .github/                   # GitHub-specific implementation
├── .planning/                 # Project state and planning documents
│   ├── codebase/              # Codebase analysis (ARCHITECTURE.md, STRUCTURE.md, etc.)
│   └── [other state files]    # STATE.md, ROADMAP.md, etc. (after project init)
└── .git/                      # Git repository
```

## Directory Purposes

**`.agent/`:**
- Purpose: Master copy of GSD framework, shared across all runtimes
- Contains: Workflows, agents, skills, templates, CLI tools, documentation
- Key files: `gsd-tools.cjs` (CLI), 47 workflow markdown files, 16 agent definitions
- Version controlled: Yes, changes propagate to .claude/, .gemini/, etc.

**`.agent/get-shit-done/`:**
- Purpose: Core GSD orchestration system
- Contains: Complete workflow automation framework
- Key subdirectories:
  - `bin/` — gsd-tools.cjs CLI (primary utility)
  - `workflows/` — 47 orchestration workflows (new-project.md, plan-phase.md, execute-phase.md, etc.)
  - `templates/` — Document templates for projects, phases, verification, etc.
  - `references/` — Reference docs (model profiles, git integration, checkpoints, etc.)
  - `VERSION` — Framework semantic version

**`.agent/agents/`:**
- Purpose: Specialized agent definitions
- Contains: 16 markdown agent types (gsd-executor, gsd-planner, gsd-codebase-mapper, gsd-verifier, etc.)
- Pattern: Each agent has role definition, project context loading, execution flow, error handling
- Used by: Orchestration workflows via Task API (subagent_type parameter)

**`.agent/skills/`:**
- Purpose: Project-specific patterns and conventions
- Contains: 44 skill directories (gsd-add-phase, gsd-execute-phase, gsd-map-codebase, etc.)
- Files per skill: `SKILL.md` (index), `rules/` subdirectory with pattern files
- Used by: Agents during execution to understand project conventions

**`.claude/`, `.gemini/`, `.codex/`, `.opencode/`, `.github/`:**
- Purpose: Runtime-specific implementations of GSD framework
- Mirror structure of `.agent/`
- Key difference: Each has `commands/` or equivalent to bind user commands to runtime
- Status: Parallel implementations maintained from `.agent/` master

**`.planning/`:**
- Purpose: Project-specific state and planning documents
- Contains: STATE.md (project state), ROADMAP.md (phase structure), REQUIREMENTS.md (specs), plus phase directories
- Created by: `/gsd-new-project` workflow
- Updated by: All orchestration workflows and agents
- Structure:
  ```
  .planning/
  ├── codebase/              # Codebase analysis documents
  │   ├── ARCHITECTURE.md    # Architecture patterns and layers
  │   ├── STRUCTURE.md       # Directory layout and locations
  │   ├── STACK.md           # Technology stack
  │   ├── INTEGRATIONS.md    # External APIs and services
  │   ├── CONVENTIONS.md     # Coding conventions
  │   ├── TESTING.md         # Testing patterns
  │   └── CONCERNS.md        # Technical debt and issues
  ├── STATE.md               # Current project state (frontmatter + content)
  ├── ROADMAP.md             # Phase breakdown with goals
  ├── REQUIREMENTS.md        # User stories and acceptance criteria
  ├── PROJECT.md             # Project overview and vision
  ├── RESEARCH.md            # Research findings
  ├── CONTEXT.md             # Current phase context (created per-phase)
  ├── config.json            # Project configuration (model profile, preferences)
  ├── WAITING.json           # Async checkpoint signal (if paused)
  ├── phases/                # Phase directories
  │   ├── 01-phase-name/     # Phase 1 directory
  │   │   ├── PLAN-01.md     # Plan for task 1
  │   │   ├── PLAN-02.md     # Plan for task 2
  │   │   ├── PLAN-01-SUMMARY.md  # Execution result
  │   │   ├── CONTEXT.md     # Phase context (from planning)
  │   │   └── VERIFICATION.md # Phase verification spec
  │   └── 02-phase-name/     # Phase 2, etc.
  ├── milestones/            # Archived milestone phases (after /gsd-complete-milestone)
  └── [other state docs]
  ```

## Key File Locations

**Entry Points:**

- `.agent/get-shit-done/workflows/new-project.md` — Project initialization orchestrator
- `.agent/get-shit-done/workflows/plan-phase.md` — Phase planning orchestrator
- `.agent/get-shit-done/workflows/execute-phase.md` — Phase execution orchestrator
- `.agent/get-shit-done/workflows/verify-work.md` — Phase verification orchestrator
- `.agent/get-shit-done/workflows/autonomous.md` — Continuous execution mode

**Configuration:**

- `.agent/get-shit-done/bin/gsd-tools.cjs` — Main CLI utility (50+ commands)
- `.agent/settings.json` — Framework default settings
- `.planning/config.json` — Project-specific config (created after init)
- `.planning/STATE.md` — Current project state and decisions

**Core Logic:**

- `.agent/get-shit-done/workflows/` — 47 workflow orchestration files
- `.agent/agents/` — 16 specialized agent definitions
- `.agent/get-shit-done/bin/lib/` — gsd-tools internal modules:
  - `commands.cjs` — Command dispatching
  - `config.cjs` — Config management
  - `core.cjs` — Core operations
  - `frontmatter.cjs` — Markdown frontmatter parsing
  - `init.cjs` — Initialization
  - `state.cjs` — STATE.md operations
  - `phase.cjs` — Phase discovery and management
  - `roadmap.cjs` — ROADMAP.md operations
  - `model-profiles.cjs` — Model resolution
  - `verify.cjs` — Verification operations

**Testing:**

- No traditional test files found. Testing is implicit: execution plans are tested during `/gsd-execute-phase` with verification steps + agent checkpoints

**Templates:**

- `.agent/get-shit-done/templates/codebase/` — Codebase analysis templates:
  - `architecture.md`, `structure.md`, `stack.md`, `integrations.md`, `conventions.md`, `testing.md`, `concerns.md`
- `.agent/get-shit-done/templates/context.md` — Phase context template
- `.agent/get-shit-done/templates/roadmap.md` — Roadmap template
- `.agent/get-shit-done/templates/state.md` — STATE.md template
- `.agent/get-shit-done/templates/summary.md` — Execution summary template

## Naming Conventions

**Files:**
- Workflows: kebab-case (new-project.md, plan-phase.md, execute-phase.md)
- Agents: gsd-kebab-case (gsd-executor.md, gsd-planner.md, gsd-codebase-mapper.md)
- Skills: gsd-kebab-case (gsd-add-phase/, gsd-execute-phase/)
- State documents: UPPERCASE (STATE.md, ROADMAP.md, REQUIREMENTS.md, CONTEXT.md, PLAN.md, SUMMARY.md)
- Project documents: UPPERCASE (PROJECT.md, RESEARCH.md, DISCOVERY.md)
- Codebase documents: UPPERCASE (ARCHITECTURE.md, STRUCTURE.md, STACK.md, CONVENTIONS.md)

**Directories:**
- Main framework: hidden (`.agent`, `.claude`, `.gemini`, etc.)
- Phase directories: padded-phase-number-slug (01-phase-name, 02-api-endpoints, 1.1-refinements)
- Planning: hidden (`.planning`)
- Skill directories: gsd-skill-name
- Template categories: lowercase (codebase/, research-project/)

**Phase Numbering:**
- Integer phases: 1, 2, 3 (major phases)
- Decimal phases: 1.1, 1.2, 2.1 (sub-phases or refinements)
- In directories: Zero-padded (01-phase-name, 02-api-design, 1.1-refinements)
- Slug format: phase name converted to kebab-case (api-design, user-auth, bug-fixes)

**Plan Numbering:**
- Format: PLAN-NN.md and PLAN-NN-SUMMARY.md (where NN is zero-padded plan number)
- Example: PLAN-01.md, PLAN-02.md, PLAN-01-SUMMARY.md
- Metadata: Stored in frontmatter (phase, plan, type, wave, depends_on)

## Where to Add New Code

**New Framework Feature (new workflow/agent):**
- Workflow: Add `new-feature.md` to `.agent/get-shit-done/workflows/`
- Agent (if needed): Add `gsd-new-type.md` to `.agent/agents/`
- Skill (if project-specific): Add directory to `.agent/skills/gsd-new-type/` with SKILL.md + rules/
- Template (if needed): Add to `.agent/get-shit-done/templates/` subdirectory

**New Project Skill (project-specific pattern):**
- Location: `.agent/skills/{skill-name}/`
- Structure:
  - `SKILL.md` — Lightweight index (~130 lines max) describing the skill
  - `rules/` — Subdirectory with pattern files (rules/naming.md, rules/error-handling.md)
- Used by: Agents load SKILL.md during project context discovery

**New Project Document (after /gsd-new-project):**
- Phase planning docs: `.planning/phases/{padded-phase}/{filename}`
- Project-wide docs: `.planning/{FILENAME}.md`
- Codebase analysis: `.planning/codebase/{DOCNAME}.md`
- Follow template format from `.agent/get-shit-done/templates/`

**Agent-Generated Code (during execution):**
- Project code: Working directory (typically project root)
- Test files: Follow project convention or co-locate with source
- Config files: Project root or standard location (tsconfig.json, package.json, etc.)
- Temporary files: Use gitignored subdirectories (.tmp, .build, node_modules, etc.)

## Special Directories

**`.planning/codebase/`:**
- Purpose: Codebase analysis documents
- Generated: Yes, created by `/gsd-map-codebase` workflow
- Committed: Yes, part of project git history
- Contents:
  - ARCHITECTURE.md — Architecture patterns and layers
  - STRUCTURE.md — Directory structure and file locations
  - STACK.md — Technology stack
  - INTEGRATIONS.md — External APIs and services
  - CONVENTIONS.md — Coding conventions and styles
  - TESTING.md — Test framework and patterns
  - CONCERNS.md — Technical debt and known issues

**`.planning/phases/`:**
- Purpose: Phase-specific planning and execution
- Generated: Yes, created per-phase during planning/execution
- Committed: Yes, captures phase history
- Lifecycle:
  - Created during `/gsd-plan-phase`
  - Plans (PLAN-NN.md) created by gsd-planner
  - Summaries (PLAN-NN-SUMMARY.md) created by gsd-executor
  - Archived to `.planning/milestones/` after `/gsd-complete-milestone`

**`.planning/milestones/`:**
- Purpose: Archive completed phases after milestone completion
- Generated: Yes, created by `/gsd-complete-milestone`
- Committed: Yes, historical record
- Structure: vX.Y-phases/ subdirectories with archived phase directories

**`.agent/skills/`:**
- Purpose: Project-specific conventions and patterns
- Generated: No, usually created during project setup
- Committed: Yes, part of project conventions
- Discovery: Agents list available skills, read SKILL.md for each during context loading

**`node_modules/`, `.build/`, `.tmp/`:**
- Purpose: Development and build artifacts
- Generated: Yes, by build tools and package managers
- Committed: No, listed in .gitignore
- Lifecycle: Created during setup, recreated as needed, cleaned before deployment

## Integration Points

**gsd-tools CLI Integration:**
- All orchestrations call `gsd-tools init {command}` to load context
- Subagents call `gsd-tools state update` to modify STATE.md
- Commit operations use `gsd-tools commit` for planning docs
- Phase discovery via `gsd-tools find-phase {phase}`, `gsd-tools roadmap get-phase`

**Workflow-to-Agent Spawning:**
- Orchestration workflows use Task API to spawn subagents
- Pattern: `Task(subagent_type="gsd-executor", model="{model}", ...)`
- Context transfer: `<files_to_read>` blocks in agent prompts

**Git Integration:**
- All state changes committed automatically
- Branch per phase (configured in STATE.md)
- Hooks in `.agent/hooks/` run at checkpoints
- Commit message format: `[Phase N] Task description`

---

*Structure analysis: 2026-03-19*
