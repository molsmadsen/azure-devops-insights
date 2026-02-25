---
phase: 02-pr-metrics
plan: "02"
subsystem: skills
tags: [azure-devops, pr-metrics, skill-definition, narration, claude-plugin]

# Dependency graph
requires:
  - phase: 02-01
    provides: pr-metrics.mjs computes all PR metrics JSON (PR-01 through PR-05)
  - phase: 01-03
    provides: PLUGIN_ROOT resolver pattern via installed_plugins.json
provides:
  - skills/pr-metrics/SKILL.md — /adi:pr-metrics skill with guard, arg parsing, invocation, and full narration instructions
  - Human-verified end-to-end flow from /adi:pr-metrics invocation to AI narrative output
affects: [03-work-items, 04-release-notes, phase-3-planning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SKILL.md narration pattern: structured JSON from script → Claude narration sections with conditional blocks"
    - "Config guard pattern: --check-config before any network fetch, stops with actionable message if missing"
    - "Flag passthrough pattern: user-supplied flags extracted and forwarded verbatim to underlying script"

key-files:
  created:
    - skills/pr-metrics/SKILL.md
  modified: []

key-decisions:
  - "Recommendations section conditional on data: only appears when timeToFirstReview.aboveThresholdCount > 0, bottleneck != null, stalePrs.length > 0, or absentReviewers.length > 0 — avoids filler section on healthy repos"
  - "Human-verified end-to-end: narrative opens with PR/repo count, all 5 data sections present, flags work, error paths confirmed"

patterns-established:
  - "Skill narration structure: opening summary line → data sections in fixed order → conditional Recommendations"
  - "Error handling in skills: type-specific messages for not_found/auth/network/empty-results before narration"

requirements-completed: [PR-06]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 2 Plan 02: PR Metrics Skill Summary

**skills/pr-metrics/SKILL.md wires pr-metrics.mjs JSON output to a Claude-narrated PR health report covering review speed, cycle time, reviewer participation, bottlenecks, stale PRs, and conditional recommendations**

## Performance

- **Duration:** ~2 min (continuation after human checkpoint approval)
- **Started:** 2026-02-25T12:13:44Z
- **Completed:** 2026-02-25T12:15:00Z
- **Tasks:** 2 (Task 1: create SKILL.md; Task 2: human-verify checkpoint — approved)
- **Files modified:** 1

## Accomplishments

- Created `skills/pr-metrics/SKILL.md` with correct frontmatter (`disable-model-invocation: true`, `allowed-tools: Bash(node *)`), config guard, argument parsing for --repo/--days/--stale-days/--project, script invocation with PLUGIN_ROOT resolver, and complete narration instructions for all 6 PR metric sections
- Human approved the end-to-end flow: narrative opens with "Analyzed N PRs across N repos...", all sections present, Recommendations conditional on issues, flags pass through correctly
- All 18 automated checks pass on SKILL.md content (frontmatter, guard, flags, all narration fields)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create skills/pr-metrics/SKILL.md** - `37703d4` (feat)
2. **Task 2: Checkpoint human-verify** - (approved, no additional commit needed — Task 1 commit covers all file changes)

## Files Created/Modified

- `skills/pr-metrics/SKILL.md` - Complete /adi:pr-metrics skill definition: config guard, arg parsing, fetch invocation, and narration instructions for Review Speed (PR-01), Cycle Time (PR-02), Reviewer Participation (PR-03), Bottlenecks (PR-05), Stale PRs (PR-04), and conditional Recommendations (PR-06)

## Decisions Made

- Recommendations section is conditional (only when issues found) — avoids producing a generic "everything looks good" filler section when all metrics are healthy; named explicitly in CONTEXT.md as a locked decision
- Human verification confirmed the skill is readable and useful before marking phase complete

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required beyond existing ~/.adi/config.json (already covered by /adi:setup from Phase 1).

## Next Phase Readiness

- Phase 2 complete: all PR-01 through PR-06 requirements satisfied across plans 02-01 and 02-02
- `skills/pr-metrics/SKILL.md` is the established pattern for future skills (work items, release notes)
- PLUGIN_ROOT resolver and config guard patterns are reusable as-is in Phase 3

## Self-Check: PASSED

- FOUND: .planning/phases/02-pr-metrics/02-02-SUMMARY.md
- FOUND: skills/pr-metrics/SKILL.md
- FOUND: commit 37703d4 (feat(02-02): create skills/pr-metrics/SKILL.md)

---
*Phase: 02-pr-metrics*
*Completed: 2026-02-25*
