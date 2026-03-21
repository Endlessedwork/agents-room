# Deferred Items - Phase 12

## Out-of-scope pre-existing issues

### Biome config schema mismatch
- **Found during:** 12-02 Task 1 lint verification
- **Issue:** `biome.json` uses schema version `2.0.0` but installed Biome CLI is `2.4.8`. Also `organizeImports` key was renamed in Biome 2.x. `npm run lint` exits 1 with config errors.
- **Impact:** `npm run lint` fails project-wide (pre-existing, not caused by 12-02 changes)
- **Fix:** Run `biome migrate` to update biome.json schema version and key names
- **Scope:** Pre-existing — not caused by changes in this plan
