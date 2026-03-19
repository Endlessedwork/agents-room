# Codebase Concerns

**Analysis Date:** 2026-03-19

## Tech Debt

**Large Library Files (Knowledge Concentration):**
- Issue: Several core library files exceed 25KB and contain multiple subsystems
  - `state.cjs`: 33KB - manages STATE.md, ROADMAP.md, phase ops, requirements
  - `commands.cjs`: 24KB - CLI command dispatch and routing
  - `verify.cjs`: 32KB - validation and verification logic across multiple concerns
  - `profile-output.cjs`: 40KB - output formatting and profile rendering (largest)
- Files: `.claude/get-shit-done/bin/lib/state.cjs`, `.claude/get-shit-done/bin/lib/commands.cjs`, `.claude/get-shit-done/bin/lib/verify.cjs`, `.claude/get-shit-done/bin/lib/profile-output.cjs`
- Impact: Single-file changes risk breaking unrelated functionality. Difficult to test in isolation. High cognitive load when debugging. New developers cannot safely modify without understanding entire subsystem.
- Fix approach: Break files into single-responsibility modules. Examples: `state-frontmatter.cjs`, `state-roadmap.cjs`, `verify-plans.cjs`, `verify-artifacts.cjs`, `format-progress.cjs`, `format-metrics.cjs`

**Output Size Management Hardcoded:**
- Issue: Large JSON output exceeding 50KB is written to tmpfile and reference passed back. Logic hardcoded in `core.cjs` output()
- Files: `.claude/get-shit-done/bin/lib/core.cjs` (lines 19-35)
- Impact: If buffer limit changes or needs to be configurable per context window, requires modifying core utility. No abstraction for output strategy.
- Fix approach: Create `output-strategy.cjs` module with pluggable strategies: directOutput, tmpFileOutput, streamingOutput. Let callers select strategy based on expected size and runtime.

**Error Handling Pattern Inconsistency:**
- Issue: Only 8 instances of try/catch detected across entire lib/ directory. Most functions use silent failures or return null
- Files: Multiple files in `.claude/get-shit-done/bin/lib/`
- Impact: When things fail, no context about what went wrong. Debugging requires tracing through function returns. Users cannot distinguish between file missing vs permission denied vs bad JSON
- Fix approach: Create `error.cjs` with SafeResult type (success + data, or error + code). Replace bare returns with explicit error wrapping. Callers can then decide: propagate, log, skip, fallback.

**Frontmatter Parsing Fragmentation:**
- Issue: Frontmatter extraction logic scattered across multiple files
  - `frontmatter.cjs` handles YAML parsing
  - `state.cjs` has its own frontmatter extraction for STATE.md
  - `verify.cjs` has schema validation for frontmatter
  - Individual agent files sometimes parse their own YAML
- Files: `.claude/get-shit-done/bin/lib/frontmatter.cjs`, `.claude/get-shit-done/bin/lib/state.cjs`, `.claude/get-shit-done/bin/lib/verify.cjs`, various agent `.md` files
- Impact: If YAML format changes, multiple places need updating. Validation rules defined in multiple places. Inconsistent error messages.
- Fix approach: Consolidate frontmatter handling into `frontmatter.cjs` with unified validation. Export: parseFrontmatter(), validateFrontmatter(data, schema), generateFrontmatter(fields). All callers use these functions.

## Known Bugs

**Temporal Path Resolution in Agent Invocation:**
- Symptoms: Hardcoded paths in workflow files like node /home/vsman/agents-room/.claude/get-shit-done/bin/gsd-tools.cjs fail if framework is copied or user changes directory structure
- Files: Every workflow and agent file containing gsd-tools invocation (execute-phase.md, execute-plan.md, plan-phase.md, etc. - approximately 50+ files)
- Trigger: Run GSD framework from non-standard path, or symlink to framework, or copy framework to new location
- Workaround: Framework must always be at /home/vsman/agents-room/.claude/get-shit-done/bin/gsd-tools.cjs

**Missing Agent Spawning Fallback Documentation:**
- Symptoms: execute-phase.md documents fallback to sequential inline execution if Task/subagent API unavailable, but no code exists in workflows to detect and trigger fallback
- Files: `.claude/get-shit-done/workflows/execute-phase.md` (lines 10-20), no corresponding agent implementation
- Trigger: Run on Copilot, Gemini, or other non-Claude runtime where subagent spawning doesn't work
- Workaround: Must manually follow execute-plan.md for each plan instead of orchestrator managing it

**Context Window Fragility in Large Phases:**
- Symptoms: If a phase has more than 5 plans with 3+ tasks each, orchestrator may exceed context before all plans execute
- Files: `.claude/get-shit-done/workflows/execute-phase.md` has no maximum plan size validation
- Trigger: User creates phase with 8 plans in one wave, executes with orchestrator
- Workaround: Manually split into smaller phases before execution. Orchestrator should validate and warn.

## Security Considerations

**Implicit Secrets in Config Files:**
- Risk: `.planning/config.json` may contain API keys (Brave search), model IDs, branch templates. File is committed to git if user doesn't add to .gitignore
- Files: `.planning/config.json` (not in forbidden_files list, could accidentally leak secrets)
- Current mitigation: Documentation says never commit secrets but no enforcement. No validation that sensitive keys are absent.
- Recommendations:
  - Add pre-commit hook to check `.planning/config.json` for keys matching patterns like _key, _secret, _token, _password
  - Create `config.json.example` with all keys but placeholder values
  - Modify `core.cjs` loadConfig() to warn if detecting secret-like values

**Filepath Injection in Frontmatter:**
- Risk: If user controls frontmatter files_modified array in PLAN.md, could specify paths like ../../../etc/passwd or /.aws/credentials
- Files: `verify.cjs` checks artifacts but doesn't validate paths are within project. `phase.cjs` reads paths without normalization.
- Current mitigation: None. Code assumes frontmatter is trusted.
- Recommendations: Validate all file paths in frontmatter:
  - Normalize using path.normalize() and check path.relative() doesn't contain ..
  - Only allow paths within `.planning/phases/`, `src/`, `lib/`, or configured project roots
  - Reject absolute paths
  - Add validation in `verify.cjs` as verify path-safety

**No Input Sanitization in CLI Arguments:**
- Risk: Commands like phase add --description "evil shell commands" could execute arbitrary commands if description is used in shell context
- Files: `phase.cjs` adds phases with user-provided description. May be used in shell commands or git commits.
- Current mitigation: Description is used in ROADMAP.md and filenames (relatively safe). Not detected in shell execution contexts.
- Recommendations:
  - Audit all CLI argument usage to ensure not used in shell execution
  - Sanitize filenames for phase slugs using whitelist: alphanumeric, hyphens, underscores only
  - Use parameter substitution in git commands, not string concatenation

**Credentials in Model Profiles:**
- Risk: Model profile configuration contains model IDs and names. If extended to include API keys or credentials, they would be in plaintext
- Files: `.claude/get-shit-done/bin/lib/model-profiles.cjs`
- Current mitigation: Only contains model names and IDs, no credentials. But pattern is set for future expansion.
- Recommendations:
  - Model profiles should NEVER contain secrets
  - API keys should come from environment only
  - Add comment in model-profiles.cjs: DO NOT ADD CREDENTIALS — model profiles are committed to git

## Performance Bottlenecks

**Synchronous File I/O in CLI Path:**
- Problem: gsd-tools.cjs uses execSync and synchronous fs operations. Large phases with many plans cause significant latency.
- Files: `.claude/get-shit-done/bin/lib/core.cjs` (safeReadFile, loadConfig), `commands.cjs` (phase operations), `verify.cjs` (verification reads multiple files)
- Cause: CLI tools traditionally synchronous for simplicity. With 50+ commands and nested operations, performance degrades with large projects.
- Improvement path:
  - Phase 1: Profile which commands are slowest (likely phase discovery, validation, history-digest)
  - Phase 2: Batch file reads where possible (load all SUMMARY.md files in one operation)
  - Phase 3: Consider async refactor for long-running operations, with callback compatibility
  - Estimate: 20-40% speed improvement possible with batching alone

**Markdown Parsing Inefficiency:**
- Problem: Frontmatter extraction reads entire file and uses regex to parse YAML. No caching. If same file read multiple times, parsed repeatedly.
- Files: `frontmatter.cjs` (line 60+), `state.cjs` (when reading STATE.md multiple times)
- Cause: Simple implementation sufficient for small files. With phases, roadmaps, and multiple reads per command, adds up.
- Improvement path: Add in-process cache using Map with file mtime tracking. Invalidate when file changes.

**History Digest Generation on Large Projects:**
- Problem: history-digest command reads and parses every SUMMARY.md in project. Linear O(n) per invocation.
- Files: `commands.cjs` (history-digest command), called during every planner invocation
- Cause: No persistent index. Each plan-phase call regenerates full digest.
- Improvement path:
  - Create `.planning/.history-cache.json` with cached digest and timestamp of last SUMMARY.md file change
  - On command: check if any SUMMARY.md newer than cache; if not, use cached digest
  - On cache invalidation: only re-parse changed files
  - Estimate: 80-90% reduction in planning time for projects with 10+ completed phases

**Rollup Distribution Size:**
- Problem: `.planning/codebase/` directory duplicated across 5 provider directories (claude, agent, codex, gemini, opencode)
- Files: Every STACK.md, ARCHITECTURE.md, CONCERNS.md present in 5 locations
- Cause: Framework supports multiple AI providers. Instead of symlinks/references, all files duplicated.
- Improvement path:
  - Create `.planning/codebase/` as single source of truth
  - Other provider directories symlink to it (Claude Code, Codex support symlinks)
  - For providers that don't support symlinks, generate at runtime or document workaround
  - Estimate: 80% reduction in codebase size

## Fragile Areas

**Agent Orchestrator Dependency Chain:**
- Files: `.claude/get-shit-done/workflows/execute-phase.md` (orchestrates executor), executor spawns itself for continuation
- Why fragile: If gsd-tools.cjs init() fails, entire orchestrator fails. No graceful degradation. If one plan fails, orchestrator must be manually resumed with completed_tasks context.
- Safe modification:
  - Add pre-flight checks in orchestrator: validate all PLAN.md files exist and parse correctly before spawning any agents
  - Implement checkpoint state file (`.planning/.checkpoint.json`) to auto-resume instead of manual context passing
  - Test continuation flow regularly (don't wait for real failure)
- Test coverage: No tests for continuation protocol. Multi-wave execution is manually tested only.

**Verification Gate Coverage Gaps:**
- Files: `.claude/get-shit-done/agents/gsd-verifier.md`, `.claude/get-shit-done/workflows/verify-phase.md`
- Why fragile: Verifier checks SUMMARY.md artifacts and key_links but doesn't verify they are USED correctly. Can have artifact file but wrong implementation inside.
- Safe modification:
  - Before changes to verification logic, capture baseline: what are current verification gaps?
  - Test with intentionally broken artifacts (wrong types, missing exports, unused functions)
  - Document what verifier cannot catch (and why)
- Test coverage: Verification logic itself not tested. Changes require manual phase execution to validate.

**Checkpoint Resume State Management:**
- Files: `execute-phase.md`, `execute-plan.md` (checkpoint_return_format, continuation_handling)
- Why fragile: Checkpoint state passed as structured markdown to next invocation. If format changes, continuation breaks. No schema validation.
- Safe modification:
  - Before changing checkpoint format, write migration function to convert old format to new
  - Create `checkpoint.schema.json` with strict format definition
  - Validate checkpoint on parse: verify checkpoint-format filepath
  - Add test plan that intentionally pauses and resumes to catch breakage
- Test coverage: No automated tests for checkpoint round-trips.

**Wave Dependency Calculation:**
- Files: `.claude/get-shit-done/bin/lib/phase.cjs` (assign_waves function), planner uses output
- Why fragile: Recursive dependency resolution. Circular dependencies would cause infinite loop (detected, but no graceful recovery). If a plan's depends_on references non-existent plan, silently treated as wave 1.
- Safe modification:
  - Add explicit cycle detection with error message listing cycle
  - Validate all depends_on references exist before wave calculation
  - Add verify wave-correctness phase command to validate post-planning
  - Test with intentional cycles and dangling references
- Test coverage: Wave calculation logic not tested. Manual spot-check only.

## Scaling Limits

**Phase Directory Growth:**
- Current capacity: Up to approximately 100 phases per project (naming scheme XX-name supports 00-99)
- Limit: Fixed decimal numbering 00-99. After 100 phases, naming breaks or requires redesign.
- Scaling path:
  - Option A: Move to semantic versioning (phases v1.0, v1.1, v2.0)
  - Option B: Extend to 000-999 (support 1000 phases)
  - Option C: Named-only phases without numbers
  - Recommend Option B (backward compatible, simple migration)
  - Migration: Write script to rename phase directories 01-99 to 001-099

**Roadmap File Size:**
- Current capacity: ROADMAP.md with 50 phases equals approximately 15KB. At 100 phases, likely 30KB (acceptable). At 500 phases, approximately 150KB (slow to parse)
- Limit: Beyond 300 phases, ROADMAP becomes unwieldy for human review
- Scaling path:
  - Phase 1: Split ROADMAP into ROADMAP.md (active phases 0-5) and ARCHIVE.md (phases 6+)
  - Phase 2: Index generation: ROADMAP-INDEX.json with metadata for all phases, faster to parse
  - Phase 3: Consider milestone-based organization instead of flat phase list

**Requirements Traceability:**
- Current capacity: Approximately 200 requirement IDs per phase (reasonable). At 100 phases times 200 equals 20K requirements, REQUIREMENTS.md becomes very large
- Limit: Beyond 10K requirements, traceability becomes burdensome. Manual requirement ID management not scalable.
- Scaling path:
  - Move requirement metadata to JSON: `.planning/requirements-index.json` with queryable structure
  - Implement requirement ID generation (AUTO-01, AUTO-02 instead of manual AUTH-01)
  - Add requirement lifecycle: proposed, approved, implemented, verified, archived
  - Current manual approach suitable for projects under 300 requirements

**State File Complexity:**
- Current capacity: STATE.md with decisions, blockers, metrics appends indefinitely. After 50+ phases, file reaches approximately 20KB with many historical entries
- Limit: Beyond 5K lines of state history, parsing and display become slow
- Scaling path:
  - Archive historical state: move decisions/blockers older than 6 months to STATE-ARCHIVE.md
  - Implement state snapshots: save STATE.md backup at each milestone
  - Add state pruning command: state archive --before date

## Dependencies at Risk

**No Pinned Version for gsd-tools Dependencies:**
- Risk: gsd-tools.cjs uses Node.js built-ins (fs, path, child_process) which are stable. But no explicit check for Node version. If Node API changes, could break.
- Impact: Framework doesn't specify minimum Node version. User on old Node (v12) may experience silent failures.
- Files: `.claude/get-shit-done/bin/gsd-tools.cjs` (no version check)
- Migration plan:
  - Add version check at top: require minimum Node 16 (ES2021 compatible)
  - Add .nvmrc with 16.x or 18.x
  - Document in README: Node 16+ required

**Markdown Frontmatter Format Brittleness:**
- Risk: Frontmatter parsing assumes YAML format. If user adds non-standard YAML or comments, parser may silently drop fields.
- Impact: User modifies PLAN.md in text editor, adds comment in frontmatter, frontmatter parser silently ignores it. Plan appears valid but is incomplete.
- Files: `frontmatter.cjs` (YAML regex parsing)
- Migration plan:
  - Switch to proper YAML parser: use lightweight npm package like yaml or js-yaml
  - Add validation: after parsing, check required fields exist
  - Add better error messages: Frontmatter missing field phrase
  - For now: update documentation with Do not add comments in frontmatter block

**Agent File Format Dependencies:**
- Risk: Agent files `.md` have required structure: frontmatter, sections, code blocks. If user edits and breaks structure, agent may not load.
- Impact: User tries to customize an agent (e.g., change description), accidentally removes a section, agent fails to parse.
- Files: All `.md` files in `.claude/agents/`, `.claude/get-shit-done/workflows/`
- Migration plan:
  - Create validate agent filepath command to check structure
  - Generate agent files from templates (instead of hand-editing) to prevent structural breakage
  - Document: Agent files should not be modified by users

## Missing Critical Features

**No Automated Backup of Planning State:**
- Problem: User loses all planning progress if `.planning/` directory deleted. No backup strategy documented. No git integration for automatic backups.
- Blocks: Cannot safely experiment with phases (delete and recreate) without manual backup.
- Impact: Risk of data loss. Users must manually backup .planning/ directory before major changes.
- Fix approach:
  - Implement state backup command to zip `.planning/` with timestamp
  - Configure git hooks to auto-backup STATE.md before major orchestrator operations
  - Document backup strategy in README

**No Phase Template System:**
- Problem: Each new phase must manually create directory, CONTEXT.md, etc. No template for standard frontend phase or API phase
- Blocks: New projects take longer to set up phases. No reusable phase patterns across projects.
- Fix approach: Create `.planning/templates/` with example phases. Planner can instantiate from template.

**No Integrated Metrics/Analytics:**
- Problem: Performance metrics recorded in STATE.md but not analyzed. No dashboard showing which phases took longest, which agents used most context, where time is spent.
- Blocks: Cannot identify optimization opportunities. Cannot track productivity trends.
- Fix approach:
  - Extend STATE.md with JSON metrics block
  - Add metrics report command to generate charts and analysis
  - Track per-phase: duration, tasks completed, context used, commits

**No Automatic Requirement Traceability Validation:**
- Problem: Requirement IDs listed in frontmatter but no validation they actually appear in plan tasks or summaries. Dead requirements go undetected.
- Blocks: Cannot ensure all requirements are implemented. Requirements can be forgotten.
- Fix approach:
  - Add verify requirement-coverage phase command
  - Check: every requirement ID in PLAN.md has corresponding SUMMARY.md evidence
  - Report: which requirements implemented, which missing, which uncertain

## Test Coverage Gaps

**CLI Tool Commands (gsd-tools.cjs) Have No Unit Tests:**
- What's not tested: 50+ commands in gsd-tools.cjs, including:
  - Frontmatter parsing (various document types)
  - Phase operations (add, remove, renumber)
  - Roadmap manipulation
  - State updates
  - Verification commands
- Files: `.claude/get-shit-done/bin/gsd-tools.cjs`, `.claude/get-shit-done/bin/lib/*.cjs`
- Risk: Regression in core tools goes unnoticed until user runs orchestrator. Complex logic like phase renumbering is especially fragile.
- Priority: High

**Checkpoint Resume Protocol Not Tested:**
- What's not tested: Multi-wave execution with checkpoints, continuation context, state transfer between agents
- Files: `.claude/get-shit-done/workflows/execute-phase.md`, `.claude/get-shit-done/agents/gsd-executor.md`
- Risk: Checkpoints work in simple cases but break with complex wave dependencies or missing state
- Priority: High

**Agent Interaction Chains Not Tested:**
- What's not tested: Full orchestrator chains (planner to executor to verifier), error propagation, timeout handling
- Files: Multiple workflow files, orchestrator doesn't explicitly test agent spawning
- Risk: Subtle bugs in agent handoff (missing context, wrong arguments) go undetected until actual execution
- Priority: Medium

**Edge Cases in Dependency Resolution:**
- What's not tested: Circular dependencies, self-dependencies, missing dependencies, complex wave structures
- Files: `.claude/get-shit-done/bin/lib/phase.cjs` (wave assignment)
- Risk: Exotic phase configurations cause incorrect wave assignment or infinite loops
- Priority: Medium

**Markdown Parsing Robustness:**
- What's not tested: Malformed frontmatter, missing sections, special characters in fields, very long descriptions
- Files: `frontmatter.cjs`, files that parse agent/workflow markdown
- Risk: User creates slightly invalid PLAN.md and tools silently fail or produce wrong output
- Priority: Medium

---

*Concerns audit: 2026-03-19*
