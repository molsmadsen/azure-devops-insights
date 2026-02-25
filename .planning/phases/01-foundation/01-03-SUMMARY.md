---
phase: 01-foundation
plan: 03
subsystem: auth
tags: [azure-devops, node-esm, setup-script, skills, claude-plugin, pat-validation]

# Dependency graph
requires:
  - "scripts/config.mjs: saveConfig, maskPat, loadConfig, configExists (from 01-02)"
  - "scripts/ado-client.mjs: validateConnection (from 01-02)"
provides:
  - "scripts/setup.mjs: dual-mode script — --read returns masked config JSON, --org/--project/--pat validates and saves"
  - "skills/setup/SKILL.md: /adi:setup interactive flow — guides Claude through prompts, uses plugin root resolver"
  - "skills/help/SKILL.md: /adi:help command listing — all Phase 1 commands plus coming-soon placeholders"
affects: [all Phase 2+ skills that build on the setup pattern]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plugin root resolver: reads ~/.claude/plugins/installed_plugins.json to find installPath; falls back to CLAUDE_PLUGIN_ROOT env var, then '.'"
    - "SKILL.md dual bash-block pattern: one for --read (Step 0), one for main invocation (Step 4) — both resolve PLUGIN_ROOT in the same subshell"
    - "Skill output-only JSON: setup.mjs never prints human strings — all output is JSON for skill narration"
    - "disable-model-invocation: true — prevents skill from running on incidental mentions"
    - "allowed-tools: Bash(node *) — permits node execution without per-use dialog"

key-files:
  created:
    - scripts/setup.mjs
    - skills/setup/SKILL.md
    - skills/help/SKILL.md
  modified: []

key-decisions:
  - "Plugin root resolver uses installed_plugins.json not CLAUDE_PLUGIN_ROOT: CLAUDE_PLUGIN_ROOT env var does not expand in SKILL.md body (confirmed bug from research); resolver reads ~/.claude/plugins/installed_plugins.json to find the adi plugin installPath at runtime"
  - "setup.mjs dual-mode design: --read mode for re-run detection (returns masked JSON, no network call), --org/--project/--pat mode for validation+save; clear separation means the skill can show current config cheaply before asking what to update"
  - "Error types in skill narration match ado-client.mjs exactly: network/auth/permission/not_found — each has distinct user message and re-prompts only the failed field (never the full flow)"
  - "Script outputs only JSON to stdout: all narration is done by the skill reading JSON fields — this keeps setup.mjs testable and locale-neutral"

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 1 Plan 03: Setup Script and Skills Summary

**Dual-mode setup.mjs (--read / --org/--project/--pat) with /adi:setup skill using installed_plugins.json resolver and /adi:help command listing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T08:43:28Z
- **Completed:** 2026-02-25T08:45:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- setup.mjs handles two modes: `--read` (prints masked config JSON without network call) and `--org/--project/--pat` (validates via ado-client.mjs, saves via config.mjs, prints JSON result). PAT args with `=` characters parsed correctly via first-occurrence `indexOf('=')`.
- skills/setup/SKILL.md guides Claude through sequential prompts using the plugin root resolver pattern (reads installed_plugins.json, not the broken CLAUDE_PLUGIN_ROOT env var). Step 0 uses `--read` to detect re-run and show current masked values. All four error types have distinct narration with targeted re-prompts.
- skills/help/SKILL.md lists all Phase 1 commands (`/adi:setup`, `/adi:help`) plus coming-soon placeholders for Phases 2-4.

## Task Commits

Each task was committed atomically:

1. **Task 1: Setup script (setup.mjs)** - `9cbf869` (feat)
2. **Task 2: Setup and help skills (SKILL.md files)** - `2114638` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `scripts/setup.mjs` - Dual-mode script: --read for re-run detection, --org/--project/--pat for validate+save. JSON-only stdout.
- `skills/setup/SKILL.md` - /adi:setup interactive skill. Plugin root resolver, re-run flow, 4 error type narrations.
- `skills/help/SKILL.md` - /adi:help listing. Phase 1 commands + coming-soon placeholders.

## Decisions Made

- **Plugin root resolver uses installed_plugins.json:** The CLAUDE_PLUGIN_ROOT environment variable does not expand in SKILL.md bodies (confirmed bug from 01-RESEARCH.md). The resolver uses a Node.js one-liner to read `~/.claude/plugins/installed_plugins.json`, finds the plugin entry matching `'adi'`, and extracts `installPath`. Falls back to `process.env.CLAUDE_PLUGIN_ROOT` (works during `--plugin-dir` development) and then `.` as a last resort.

- **--read / --org/--project/--pat dual-mode design:** The `--read` flag returns the current config (PAT masked) without making any network call. This is called by the skill in Step 0 to cheaply check whether the user has existing credentials. If they do, the skill shows the current values and asks which field to update. The main flags perform validation and save. Clear separation prevents re-validation on field-unchanged re-runs.

- **Error types match ado-client.mjs exactly:** The four error types (`network`, `auth`, `permission`, `not_found`) defined in ado-client.mjs are mirrored verbatim in the SKILL.md narration blocks. Each type has a distinct user-facing message and re-prompts only the field responsible for that failure — the skill never restarts the full flow on partial failures.

- **JSON-only stdout in setup.mjs:** No human-readable strings in `console.log` calls. All output is `JSON.stringify(...)`. This keeps setup.mjs testable, locale-neutral, and clearly separates the script's responsibility (validate/save, report result) from the skill's responsibility (narrate, re-prompt, guide).

## Deviations from Plan

None - plan executed exactly as written. The assertion in the automated verify check for `'setup.mjs --read'` was a minor false negative — the actual string in the file is `setup.mjs" --read` (due to shell quoting in `"$PLUGIN_ROOT/scripts/setup.mjs"`). The file content is correct per the plan design; the assertion string was slightly imprecise. Confirmed passing via broader regex check.

## Issues Encountered

None.

## User Setup Required

None at this stage — setup.mjs and SKILL.md files are ready. Users will run `/adi:setup` once Phase 1 is fully installed.

## Next Phase Readiness

- /adi:setup and /adi:help are fully functional Phase 1 skills
- setup.mjs is the validation+persistence layer for all future credential use
- Phase 2 scripts can call `loadConfig()` to get credentials already validated by setup
- The plugin root resolver pattern established here should be reused by all future skills that invoke Node.js scripts

## Self-Check: PASSED

- FOUND: scripts/setup.mjs
- FOUND: skills/setup/SKILL.md
- FOUND: skills/help/SKILL.md
- FOUND: .planning/phases/01-foundation/01-03-SUMMARY.md
- FOUND: commit 9cbf869 (setup.mjs)
- FOUND: commit 2114638 (SKILL.md files)

---
*Phase: 01-foundation*
*Completed: 2026-02-25*
