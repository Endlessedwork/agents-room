# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- Kebab-case for script files: `gsd-context-monitor.js`, `gsd-statusline.js`, `gsd-check-update.js`
- Descriptive names that indicate purpose and event type (e.g., `gsd-{purpose}-{trigger}.js`)

**Functions:**
- camelCase for all function names: `detectConfigDir()`, `spawn()`, `writeFileSync()`
- Descriptive names indicating action: verb + noun pattern
- Inner/helper functions defined inline within file scope

**Variables:**
- camelCase for variable names: `stdinTimeout`, `remaining`, `bridgePath`, `warnData`
- SCREAMING_SNAKE_CASE for constants: `WARNING_THRESHOLD`, `CRITICAL_THRESHOLD`, `STALE_SECONDS`, `DEBOUNCE_CALLS`, `AUTO_COMPACT_BUFFER_PCT`
- Prefix for boolean/state tracking: `is*`, `has*` (e.g., `isGsdActive`, `isCritical`)
- Prefix for path variables: `*Path`, `*Dir` (e.g., `bridgePath`, `cacheDir`, `todosDir`, `globalConfigDir`)
- Suffix for tracking variables: `*Data`, `*Info` (e.g., `warnData`, `metricsPath`)

**Comments:**
- Inline comments use `//` syntax
- Variable declarations occasionally preceded by comment lines explaining purpose
- Multi-line comments use sequential `//` lines, not `/* */` blocks

## Code Style

**Formatting:**
- No explicit formatter detected; follows CommonJS conventions
- 2-space indentation
- Single quotes for strings: `'utf8'`, `'utf-8'`, `'command'`
- Semicolons used consistently at statement endings
- Line length appears unconstrained (some lines exceed 100 characters)

**Linting:**
- No `.eslintrc` or linting config detected
- Code follows implicit Node.js style conventions
- Object shorthand not consistently used

## Import Organization

**Pattern:**
All imports at top of file using `require()`:
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
```

**Order:**
1. Node.js built-in modules (fs, path, os, child_process)
2. No third-party dependencies detected (uses only Node.js core)

**Module Type:**
- CommonJS modules (verified by `"type": "commonjs"` in package.json)
- No module aliases or path mapping detected

## Error Handling

**Patterns:**
- Try/catch blocks for file operations and JSON parsing
- Silent failures on optional/non-critical operations with empty catch blocks:
  ```javascript
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    // Ignore config parse errors
  }
  ```
- Process exit with `process.exit(0)` for graceful exits
- Comments explaining why failures are silent (e.g., "Silent fail -- bridge is best-effort, don't break statusline")

**Exit Strategies:**
- `process.exit(0)` - Used for safe exits after error conditions
- Comments indicate intent to never block operations (e.g., "Silent fail -- never block tool execution")

**Guarding Against Hangs:**
- Explicit timeout guards for stdin operations:
  ```javascript
  const stdinTimeout = setTimeout(() => process.exit(0), 10000);
  ```
- Comments document timeout durations and reasons (e.g., "pipe issues on Windows/Git Bash")

## Logging

**Framework:** `console` and `process.stdout` only (no external logging library detected)

**Patterns:**
- `process.stdout.write()` for statusline output with ANSI color codes
- Color codes using `\x1b[` escape sequences:
  - `\x1b[32m` - Green
  - `\x1b[33m` - Yellow
  - `\x1b[31m` - Red
  - `\x1b[2m` - Dim/grey
  - `\x1b[1m` - Bold
  - `\x1b[5;31m` - Blinking red
  - `\x1b[0m` - Reset
- Progress bar rendering with Unicode: `'█'.repeat(filled) + '░'.repeat(10 - filled)`
- No timestamps or structured logging (output is terminal UI focused)

## Comments

**When to Comment:**
- Before constants: explain thresholds, timeouts, percentages
- Before major blocks: explain workflow or decision
- After closing braces: clarify intent for error handling
- On lines with non-obvious logic: explain why operation is needed

**Examples:**
- Config override explanation: `// Respects CLAUDE_CONFIG_DIR for custom config directory setups (#870)`
- Debounce logic: `// Emit immediately on first warning, then debounce subsequent ones`
- No-op explanations: `// Corrupted file, reset`, `// Silent fail on file system errors`

**Comment Style:**
- Single-line comments only (`//`)
- Comments explain "why", not "what" the code does
- Github issue references: `(#issue-number)` appended to comments

## Function Design

**Size:**
- Most functions fit on single screen (< 50 lines for main functions)
- Helper/wrapper functions typically 10-20 lines
- File-scope functions not separated into modules

**Parameters:**
- Minimal parameters (usually 0-2)
- No destructuring patterns detected
- Path strings passed as direct parameters

**Return Values:**
- Mix of void functions (side effects only) and value-returning functions
- JSON object returns for structured data
- String returns for formatted output
- No explicit error returns (errors handled via exceptions)

**Async Patterns:**
- `process.stdin.on('end', callback)` for async stdin handling
- `setTimeout()` for timeout guards
- `spawn()` for background processes with `{ stdio: 'ignore' }` and `detached: true`
- No async/await patterns detected (uses callback style)

## Module Design

**Exports:**
- No explicit exports from hook files (files are entry points)
- Inline background process spawning using `spawn()` with inline child script

**File Responsibility:**
- Single-purpose hook files:
  - `gsd-context-monitor.js` - Monitors context and emits warnings
  - `gsd-statusline.js` - Formats and displays statusline
  - `gsd-check-update.js` - Checks for version updates in background

**File-Scoped Functions:**
- Helper functions like `detectConfigDir()` defined within file scope
- No cross-file dependencies

## Specific Patterns

**Stdin Processing:**
All hook files follow identical pattern for processing input:
```javascript
let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), timeout);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    // Main logic
  } catch (e) {
    // Silent fail
  }
});
```

**Filesystem Utilities:**
- Direct use of `fs.readFileSync()`, `fs.writeFileSync()`, `fs.existsSync()`
- No wrapper utilities for common patterns
- Error handling wrapped in try/catch per operation

**Path Resolution:**
- Uses `path.join()` for cross-platform path construction
- Environment variable checks: `process.env.CLAUDE_CONFIG_DIR`, `process.env.GEMINI_API_KEY`
- Home directory detection: `os.homedir()`

---

*Convention analysis: 2026-03-19*
