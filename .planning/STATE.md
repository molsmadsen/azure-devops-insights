# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** A developer runs a skill, gets a clear AI-narrated report about their Azure DevOps project, and immediately knows what needs attention.
**Current focus:** Phase 1: Foundation

## Current Position

Phase: 1 of 4 (Foundation)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-02-25 -- Completed plan 01-03 (setup.mjs + /adi:setup + /adi:help skills)

Progress: [███░░░░░░░] 18%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 1.3 min
- Total execution time: 0.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 4 min | 1.3 min |

**Recent Trend:**
- Last 5 plans: 01-01 (1 min), 01-02 (1 min), 01-03 (2 min)
- Trend: On track

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Plugin distributed via `claude plugin add` (not npm global install) per research findings
- [Roadmap]: Zero npm dependencies -- Node.js .mjs scripts use only built-in APIs
- [Roadmap]: PR Metrics is the first skill to build (validates the pattern before expanding)
- [01-01]: Plugin name "adi" (not "ado-insights") avoids conflict with Azure DevOps CLI tool (az devops); sets /adi:* namespace
- [01-01]: "your-org" placeholder used in plugin.json and marketplace.json; will be replaced when GitHub repo is created (Phase 4)
- [01-01]: README documents only two-step marketplace install; claude plugin add github: shorthand deliberately omitted (not real API per RESEARCH Pitfall 3)
- [01-02]: HTTP 203 treated as auth error — Azure DevOps returns 203 (login redirect) on wrong PAT encoding; explicit status check required since response.ok is true for 203
- [01-02]: Two-step validateConnection — org-level projects check (URL + PAT), then project-level git/repos (Code Read scope); typed error objects distinguish network/auth/permission/not_found
- [01-02]: Colon prefix centralized in buildAuthHeader — Buffer.from(':' + pat.trim()) prevents common mistake of encoding PAT without colon prefix
- [01-03]: Plugin root resolver uses installed_plugins.json not CLAUDE_PLUGIN_ROOT — env var does not expand in SKILL.md bodies (confirmed bug); resolver reads ~/.claude/plugins/installed_plugins.json at runtime
- [01-03]: setup.mjs dual-mode design — --read for cheap re-run detection (no network), --org/--project/--pat for validate+save; JSON-only stdout for skill narration

### Pending Todos

None yet.

### Blockers/Concerns

- RESOLVED: `${CLAUDE_PLUGIN_ROOT}` does not expand in SKILL.md bodies — mitigated by installed_plugins.json resolver pattern (01-03)
- Azure DevOps API rate limits for PAT-authenticated requests unclear (monitor during Phase 2)

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 01-03-PLAN.md (setup.mjs + /adi:setup skill + /adi:help skill) — SUMMARY created
Resume file: None
