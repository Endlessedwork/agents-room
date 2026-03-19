# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Multi-agent orchestration framework with decoupled specialized agents, workflow-based coordination, and state-driven execution. The system implements a "lean orchestrator, rich agents" pattern where the main orchestrator coordinates work and spawns specialized subagents, each with focused responsibilities.

**Key Characteristics:**
- **Orchestrator-Agent Split:** Central orchestrators (`gsd-*-phase` workflows) coordinate workflow steps, while specialized agents (gsd-executor, gsd-planner, gsd-codebase-mapper, etc.) handle domain-specific work in isolation
- **File-First Communication:** Uses markdown files as primary communication medium—STATE.md for project state, PLAN.md files as executable prompts, SUMMARY.md files as result records
- **Wave-Based Parallelization:** Agents are spawned in parallel waves with dependency analysis to maximize concurrency while respecting task ordering
- **Context Isolation:** Each subagent receives fresh context (~100% budget) while orchestrator stays lean (~15% budget) to avoid token contamination
- **Checkpoint-Driven Interaction:** Execution pauses at checkpoints for user decisions, with structured continuation format to resume work

## Layers

**Orchestration Layer (Workflows):**
- Purpose: Coordinate project lifecycle, route work to agents, manage state transitions
- Location: `.agent/get-shit-done/workflows/`
- Contains: Workflow markdown files (new-project.md, plan-phase.md, execute-phase.md, etc.)
- Depends on: gsd-tools CLI, agent definitions, project state files
- Used by: User commands (e.g., `/gsd-new-project`, `/gsd-execute-phase`)

**Agent Layer (Specialized Executors):**
- Purpose: Execute domain-specific tasks—planning, execution, verification, analysis
- Location: `.agent/agents/`
- Contains: Agent markdown definitions (gsd-executor.md, gsd-planner.md, gsd-codebase-mapper.md, gsd-verifier.md, etc.)
- Depends on: Workflow orchestration, project context files, codebase state
- Used by: Orchestration layer via subagent spawning (Task API)

**State Layer (Project Metadata):**
- Purpose: Track project initialization, phase progress, decisions, requirements, roadmap
- Location: `.planning/` directory
- Contains: STATE.md (current state), ROADMAP.md (phase structure), REQUIREMENTS.md (spec), CONTEXT.md (phase context), phase directories with PLAN.md files
- Depends on: gsd-tools for updates, user input during planning
- Used by: All orchestrators and agents to load execution context

**Skills/Patterns Layer (Project-Specific Conventions):**
- Purpose: Codify project conventions, custom patterns, and rules
- Location: `.agent/skills/` directory (or equivalent per runtime)
- Contains: SKILL.md files per skill (gsd-executor-patterns, gsd-testing-patterns, etc.) + subdirectories with rules
- Depends on: Project conventions established during setup
- Used by: Agents during planning/execution to follow project patterns

**Utilities Layer (CLI Tools):**
- Purpose: Provide atomic operations for state management, git operations, phase discovery
- Location: `.agent/get-shit-done/bin/gsd-tools.cjs`
- Contains: Node.js CLI with 50+ commands for config, state, roadmap, validation
- Depends on: File system, git, node runtime
- Used by: All workflows and agents for state queries and updates

## Data Flow

**New Project Initialization Flow:**

1. User invokes `/gsd-new-project`
2. Orchestrator (new-project.md) loads context via `gsd-tools init new-project`
3. Orchestrator asks clarifying questions (deep questioning flow)
4. Orchestrator spawns gsd-project-researcher agent for research
5. Orchestrator spawns gsd-research-synthesizer agent to synthesize findings
6. Orchestrator spawns gsd-roadmapper agent to create roadmap
7. Agents write PROJECT.md, RESEARCH.md, REQUIREMENTS.md, ROADMAP.md to `.planning/`
8. Orchestrator updates STATE.md with project initialization complete
9. Next command available: `/gsd-plan-phase`

**Phase Planning Flow:**

1. User invokes `/gsd-plan-phase 1` (or next phase)
2. Orchestrator (plan-phase.md) loads phase context via `gsd-tools init plan-phase`
3. If research needed: spawn gsd-phase-researcher to analyze technical approach
4. Orchestrator spawns gsd-planner agent with CONTEXT.md and phase requirements
5. Planner creates PLAN.md files with tasks, dependencies, waves
6. Orchestrator spawns gsd-plan-checker for quality verification
7. If checker finds issues: revision loop (max 3 iterations) back to planner
8. Orchestrator commits planning docs, updates STATE.md
9. Next command available: `/gsd-execute-phase 1`

**Phase Execution Flow:**

1. User invokes `/gsd-execute-phase 1`
2. Orchestrator (execute-phase.md) loads phase plans via `gsd-tools init execute-phase`
3. Orchestrator discovers plans, analyzes dependencies, groups into execution waves
4. For each wave (parallel if dependencies allow):
   - Spawn gsd-executor subagent with PLAN.md file
   - Executor reads STATE.md, loads project context, executes tasks
   - Executor commits per-task, creates SUMMARY.md after plan complete
   - Orchestrator collects SUMMARY.md, updates STATE.md
5. After all plans: spawn gsd-verifier to check phase completion
6. Orchestrator updates STATE.md with phase status
7. Next command available: `/gsd-next` (next phase) or `/gsd-verify-work` (quality check)

**State Management Flow:**

1. All state is stored in `.planning/` as markdown with YAML frontmatter
2. gsd-tools reads/parses STATE.md frontmatter for decisions, phase progress, blockers
3. During execution, agents call `gsd-tools state update` to change state fields
4. STATE.md is the source of truth for:
   - Current phase number and status
   - Locked user decisions from planning
   - Active blockers and checkpoints
   - Completed requirements and plans
5. Git commits capture state transitions at key checkpoints

## Key Abstractions

**Workflow Pattern:**
- Purpose: Represents a major project lifecycle step (new-project, plan-phase, execute-phase, verify-work, etc.)
- Examples: `.agent/get-shit-done/workflows/new-project.md`, `plan-phase.md`, `execute-phase.md`
- Pattern: Each workflow defines: purpose, required_reading (context files), process (numbered steps), success_criteria. Uses gsd-tools for state operations and Task API for subagent spawning.

**Agent Definition:**
- Purpose: Specialized executor with focused responsibilities
- Examples: `gsd-executor.md` (executes plan tasks), `gsd-planner.md` (creates plans), `gsd-codebase-mapper.md` (analyzes code), `gsd-verifier.md` (quality checks)
- Pattern: Each agent defines: role, project_context loading, execution_flow (numbered steps), error handling. Agents read context from `<files_to_read>` blocks before any action.

**Plan File (PLAN.md):**
- Purpose: Executable prompt that guides execution
- Contains: frontmatter (metadata), objective, context (@-file references), tasks array with types/dependencies/verification, success_criteria, output spec
- Pattern: Planner creates structured PLAN.md with 2-3 tasks per plan, assigns execution waves based on dependencies, marks autonomous vs checkpoint-based tasks

**Summary File (SUMMARY.md):**
- Purpose: Execution result record
- Contains: frontmatter, completed_tasks array (with commit hashes), deviations, verification results, artifacts delivered
- Pattern: Executor creates SUMMARY.md after completing all plan tasks, updates STATE.md with completion status

**Context File (CONTEXT.md):**
- Purpose: Captures phase requirements and user decisions
- Contains: phase boundary, locked decisions (non-negotiable), deferred ideas (out of scope), claude's discretion areas, canonical references
- Pattern: Created during planning discussion, consumed by planner to ensure plans align with user intent

**Skill Definition:**
- Purpose: Codify project-specific patterns and conventions
- Location: `.agent/skills/{skill-name}/SKILL.md` + `rules/` subdirectory
- Pattern: Each skill has lightweight index (SKILL.md ~130 lines) plus rule files. Agents load SKILL.md to understand patterns, load specific rules as needed.

## Entry Points

**User-Facing Commands:**
- Location: Invoked via `/gsd-*` syntax in user chat
- Routes to: Workflows in `.agent/get-shit-done/workflows/`
- Examples: `/gsd-new-project`, `/gsd-plan-phase 1`, `/gsd-execute-phase 1`, `/gsd-verify-work`

**Project Initialization Trigger:**
- Location: First user invocation after project setup
- Routes to: `new-project.md` workflow
- Responsibilities: Questions, research, requirements, roadmap creation, STATE.md initialization

**Phase Planning Trigger:**
- Location: User invokes `/gsd-plan-phase {phase-num}`
- Routes to: `plan-phase.md` workflow
- Responsibilities: Research (if needed), planning via gsd-planner, quality checking via gsd-plan-checker, state updates

**Phase Execution Trigger:**
- Location: User invokes `/gsd-execute-phase {phase-num}`
- Routes to: `execute-phase.md` workflow
- Responsibilities: Discover plans, analyze dependencies, spawn gsd-executor agents in waves, collect results, verify completion

## Error Handling

**Strategy:** Multi-layer approach with graceful degradation and explicit checkpoint recovery.

**Patterns:**

**Agent Failure Recovery:**
- If subagent times out or crashes: Orchestrator detects via missing SUMMARY.md or commit verification failure
- Fallback: Respawn same agent with updated continuation context (resume-from-task)
- Max retries: 2 before escalating to user checkpoint

**Execution Deviation Handling:**
- If executor encounters auth error during task: Treat as checkpoint, pause execution, return structured message
- User can: Authenticate and resume, skip task, or redirect work
- Executor resumes from same task number with fresh credentials in context

**State Corruption Recovery:**
- If STATE.md missing but `.planning/` exists: Offer to reconstruct from git history + disk state
- If ROADMAP.md/REQUIREMENTS.md missing: Error with recovery instructions

**Checkpoint-Based Pausing:**
- Executor encounters `type="checkpoint:*"` task: Return structured checkpoint message
- Message includes: completed_tasks list, next_task details, user action required
- Fresh agent spawned to continue with completed_tasks block to skip already-done work

## Cross-Cutting Concerns

**Logging:**
- Orchestrators use ASCII banners (UI-BRAND patterns) for stage transitions
- Agents log via console output + SUMMARY.md result capture
- gsd-tools commands output JSON (for parsing) or human-readable (for display)
- No persistent log files; all state captured in .planning/ files

**Validation:**
- `gsd-tools validate consistency` checks phase numbering, disk/roadmap sync
- `gsd-tools validate health` checks .planning/ integrity with optional `--repair` flag
- Frontmatter validation via `gsd-tools frontmatter validate` against schemas (plan|summary|verification)
- Agents verify plan structures before execution, check must_haves artifacts after completion

**Authentication:**
- No built-in auth; relies on agent runtime environment
- Auth errors during execution trigger checkpoint pause, user authenticates externally
- Secrets managed via runtime environment (not committed)
- .env files listed in .gitignore, never read by gsd-tools or agents

**Dependency Management:**
- Plan-level dependencies tracked via `depends_on` field in PLAN.md frontmatter
- Orchestrator reads plan manifest, builds dependency graph, groups into waves
- Wave execution respects ordering: Plan A must complete before Plan B if depends_on relationship exists
- Parallel execution within a wave when no dependencies exist

**Configuration:**
- Model selection via profile system: gsd-tools resolves agent model based on user profile (in .planning/config.json)
- Workflow flags: `--auto`, `--interactive`, `--gaps-only`, `--skip-research` alter behavior without code changes
- Branching strategy: configured in STATE.md, used during commits (one branch per phase typically)

---

*Architecture analysis: 2026-03-19*
