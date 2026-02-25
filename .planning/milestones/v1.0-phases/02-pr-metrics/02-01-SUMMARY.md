---
phase: 02-pr-metrics
plan: 01
subsystem: data-layer
tags: [ado-api, pr-metrics, computation, node-esm]
requirements-completed: [PR-01, PR-02, PR-03, PR-04, PR-05]
dependency_graph:
  requires: [scripts/ado-client.mjs, scripts/config.mjs]
  provides: [scripts/pr-metrics.mjs, scripts/ado-client.mjs (extended)]
  affects: [02-02 (SKILL.md depends on pr-metrics.mjs JSON contract)]
tech_stack:
  added: []
  patterns: [script-narrates-json, batched-promise-allsettled, pagination-with-fallback]
key_files:
  created: [scripts/pr-metrics.mjs]
  modified: [scripts/ado-client.mjs]
decisions:
  - "adoGetPrThreads returns {value:[]} on any non-ok response (tolerates per-PR failure) rather than throwing"
  - "Thread fetching covers all PRs (not just active/completed subset) to support both staleness and first-review computation"
  - "Bottleneck selection: among reviewers with 3+ reviews, slow-reviewer type wins when both slow and concentrated apply to different people"
  - "429 retry heuristic: if all threads in a batch return empty, retry once after 2s (conservative, avoids false positives)"
metrics:
  duration: "148 seconds"
  completed: "2026-02-25"
  tasks_completed: 2
  files_modified: 2
---

# Phase 2 Plan 01: PR Metrics Data Layer Summary

**One-liner:** ADO client extended with 4 PR fetch functions and pr-metrics.mjs built — fetches PRs project-wide with pagination fallback, computes cycle time, time-to-first-review via VoteUpdate threads, reviewer distribution, absent reviewers, stale PR detection, and bottleneck identification; outputs structured JSON for Claude narration.

## What Was Built

### Task 1: Extend ado-client.mjs with PR API fetch functions

Added 4 new exported functions to `scripts/ado-client.mjs`:

- **`adoGetPrsByProject(config, params)`** — project-wide PR fetch (`_apis/git/pullrequests`) with typed error on failure
- **`adoGetPrsByRepo(config, repoId, params)`** — per-repo PR fetch for `--repo` filter mode
- **`adoGetPrThreads(config, repoId, prId)`** — per-PR thread fetch; tolerates failure (returns `{value:[]}` on non-ok), no throw
- **`adoGetRepos(config)`** — repo listing for name-to-ID resolution

All functions follow existing `adoGet` style: native `fetch`, `buildAuthHeader`, null/undefined param filtering, typed errors.

### Task 2: Create pr-metrics.mjs — full computation script

Created `scripts/pr-metrics.mjs` (502 lines, zero new npm dependencies):

**Arg parsing:** `--repo`, `--days`, `--stale-days`, `--project`, `--check-config` flags

**Config check mode:** `--check-config` outputs `{"configMissing":true/false}` and exits without network access

**PR fetch with fallback:** all-time → 365 days → 90 days (auto-fallback when ≥500 PRs returned); capped at 10 pages (10,000 PRs); `searchCriteria.status=all` always set

**Thread fetching:** all PRs batched in groups of 10 via `Promise.allSettled`; 429 retry once after 2 seconds

**Computation functions:**
- `findFirstReviewDate(threads, prCreatorId)` — earliest `VoteUpdate` thread by non-author
- `getLastActivityDate(pr, threads)` — max thread `lastUpdatedDate`
- `isStale(pr, threads, staleDays)` — active PRs only, threshold against last activity

**Metrics computed:**
- Cycle time (PR-02): `status === 'completed'` AND `closedDate` guard; mean + median in hours
- Time-to-first-review (PR-01): `VoteUpdate` threads, non-author only; missing count tracked
- Reviewer distribution (PR-03): excludes self-reviews, `vote === 0`, `isContainer` team reviewers; per-reviewer avg time from individual `VoteUpdate` threads
- Absent reviewers (PR-03): PR creators with no non-zero vote on anyone else's PRs
- Stale PRs (PR-04): active PRs sorted by days stale; thread-based last activity
- Bottleneck (PR-05): reviewer with highest avg time among those with 3+ reviews; concentration flag if >50% review share

**JSON output:** all 8 required top-level keys (`summary`, `cycleTimes`, `timeToFirstReview`, `reviewerDistribution`, `absentReviewers`, `stalePrs`, `bottleneck`, `thresholds`, `errors`)

**Progress:** written to stderr only; stdout is pure JSON

## Verification Results

All 3 post-task verification checks passed:

1. `ado-client.mjs` exports: `adoGet, adoGetPrsByProject, adoGetPrsByRepo, adoGetPrThreads, adoGetRepos, buildAuthHeader, validateConnection`
2. `pr-metrics.mjs`: 17500 chars, 502 lines (well above 150-line minimum)
3. `--check-config` mode: outputs `{"configMissing":false}` without network call

16/16 source checks passed (arg parsing, check-config, status=all, findFirstReviewDate, VoteUpdate, getLastActivityDate, isStale, Promise.allSettled, JSON.stringify, self-review exclusion, zero-vote exclusion, closedDate guard, completed guard, stderr, ado-client import, config.mjs import).

**Live test:** Script executed against real ADO instance and returned valid JSON with 314 PRs across 42 repos (90-day window).

## Deviations from Plan

None — plan executed exactly as written.

## All 6 Research Anti-Patterns Avoided

1. `searchCriteria.status=all` always passed — never defaults to active-only
2. Thread data used for time calculations, not `reviewers[].vote` timestamps (which don't exist)
3. `closedDate` guard + `status === 'completed'` filter — abandoned PRs excluded from cycle time
4. Self-reviews excluded (`reviewer.id === pr.createdBy.id`)
5. Zero-vote reviewers excluded (`reviewer.vote === 0`)
6. Thread batching in groups of 10 via `Promise.allSettled` with 429 retry

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `6d2cc5c` | feat(02-01): extend ado-client.mjs with PR API fetch functions |
| Task 2 | `1debb63` | feat(02-01): create pr-metrics.mjs — full PR data fetch and computation script |

## Self-Check: PASSED

- FOUND: scripts/ado-client.mjs
- FOUND: scripts/pr-metrics.mjs
- FOUND: .planning/phases/02-pr-metrics/02-01-SUMMARY.md
- FOUND commit: 6d2cc5c (Task 1)
- FOUND commit: 1debb63 (Task 2)
