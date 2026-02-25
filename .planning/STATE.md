# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** A developer runs a skill, gets a clear AI-narrated report about their Azure DevOps project, and immediately knows what needs attention.
**Current focus:** Phase 2: PR Metrics Skill

## Current Position

Phase: 2 of 4 (PR Metrics)
Plan: 2 of 3 in current phase
Status: In progress — Plan 02-02 complete, moving to 02-03
Last activity: 2026-02-25 -- Completed plan 02-02 (skills/pr-metrics/SKILL.md — AI narration wiring, human-verified end-to-end)

Progress: [██████░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 1.73 min
- Total execution time: 0.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 5 min | 1.25 min |
| 02-pr-metrics | 2 | 4 min | 2.0 min |

**Recent Trend:**
- Last 5 plans: 01-02 (1 min), 01-03 (2 min), 01-04 (1 min), 02-01 (2 min), 02-02 (2 min)
- Trend: On track

*Updated after each plan completion*
| Phase 02-pr-metrics P01 | 148s | 2 tasks | 2 files |
| Phase 02-pr-metrics P02 | 2min | 2 tasks | 1 file |

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
- [01-04]: Phase 1 human-verified — all 6 steps approved; plugin loads, setup flow (happy path/errors/re-run), help listing, and README all confirmed correct
- [02-01]: adoGetPrThreads tolerates per-PR failures (returns empty, no throw) — partial data is better than aborting the whole run
- [02-01]: Thread fetching covers all PRs (not just active/completed subset) — needed for both staleness and first-review computation
- [02-01]: Bottleneck selection: slow-reviewer type wins when slow and concentrated apply to different reviewers (most actionable signal)
- [02-01]: 429 retry heuristic: all-empty batch triggers one retry after 2s (conservative, avoids false rate-limit positives)
- [02-02]: Recommendations section conditional on data — only appears when actual issues found (aboveThresholdCount > 0, bottleneck != null, stalePrs.length > 0, or absentReviewers.length > 0); avoids filler on healthy repos
- [02-02]: Human-verified end-to-end: narrative readable and correct; opens with PR/repo/window summary, all 5 data sections present, flags pass through, error paths confirmed

### Pending Todos

None yet.

### Blockers/Concerns

- RESOLVED: `${CLAUDE_PLUGIN_ROOT}` does not expand in SKILL.md bodies — mitigated by installed_plugins.json resolver pattern (01-03)
- Azure DevOps API rate limits for PAT-authenticated requests unclear (monitor during Phase 2)

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 02-02-PLAN.md (skills/pr-metrics/SKILL.md — AI narration wiring, human-verified end-to-end)
Resume file: None
