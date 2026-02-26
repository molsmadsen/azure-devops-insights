---
phase: 03-activity-skills
plan: 02
subsystem: api
tags: [contributors, commits, team-members, classification, azure-devops]

requires:
  - phase: 03-activity-skills-01
    provides: adoGetCommits, adoGetTeamMembers, adoGetProject functions in ado-client.mjs
provides:
  - contributors.mjs script for fetching and classifying contributor activity
  - contributors SKILL.md for Claude narration of contributor data
affects: [03-activity-skills-03]

tech-stack:
  added: []
  patterns: [contributor-classification-active-quiet-former, sequential-repo-fetching, graceful-team-data-degradation]

key-files:
  created: [scripts/contributors.mjs, skills/contributors/SKILL.md]
  modified: []

key-decisions:
  - "Sequential commit fetching per repo (not parallel) for rate-limit safety"
  - "Graceful degradation when team data unavailable: all authors shown as contributors with teamDataUnavailable flag"
  - "Anonymous mode replaces both names and emails with generic labels"

patterns-established:
  - "Contributor classification: active (on team + commits), quiet (on team + no commits), former (commits + not on team)"
  - "Conditional recommendations section: only when actionable issues found (quiet members, significant former contributors, low active ratio)"

requirements-completed: []

duration: 2min
completed: 2026-02-26
---

# Phase 03 Plan 02: Contributors Skill Summary

**Contributor activity script classifying team members as active/quiet/former from commit history cross-referenced with team membership, plus Claude narration SKILL.md with risk-framed recommendations**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T12:46:23Z
- **Completed:** 2026-02-26T12:48:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created contributors.mjs that fetches commits per repo, aggregates by author email, cross-references with team roster, and classifies as active/quiet/former
- Created SKILL.md with full narration instructions including config guard, arg parsing, error handling, and conditional recommendations section
- Supports --days, --repo, --anonymous, --check-config flags consistent with pr-metrics pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/contributors.mjs** - `effcf86` (feat)
2. **Task 2: Create skills/contributors/SKILL.md** - `6f83620` (feat)

## Files Created/Modified
- `scripts/contributors.mjs` - Fetches commits and team data, classifies contributors, outputs JSON
- `skills/contributors/SKILL.md` - Claude narration instructions with active/quiet/former sections and conditional recommendations

## Decisions Made
- Sequential commit fetching per repo (not parallel) for rate-limit safety -- same pattern as noted in plan
- Graceful degradation when team data unavailable: all commit authors listed as contributors with teamDataUnavailable flag
- Anonymous mode replaces both name and email fields with generic labels (Active Contributor N, Team Member N, Former Contributor N)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] scripts/bugs.mjs included in Task 1 commit**
- **Found during:** Task 1 commit
- **Issue:** scripts/bugs.mjs was previously staged (from plan 03-03 or prior work) and got included in the Task 1 commit alongside contributors.mjs
- **Fix:** No corrective action needed -- the file is valid phase 03 work and does not affect contributors.mjs functionality
- **Files modified:** scripts/bugs.mjs (unintentionally included)
- **Committed in:** effcf86

---

**Total deviations:** 1 minor (extra file in commit)
**Impact on plan:** No functional impact. bugs.mjs is valid phase 03 work.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Contributors skill fully defined and ready for end-to-end testing
- scripts/contributors.mjs imports established ado-client.mjs functions from Plan 01
- SKILL.md follows exact pattern from pr-metrics for consistency
- Ready for Plan 03 (next skill in the activity-skills phase)

---
*Phase: 03-activity-skills*
*Completed: 2026-02-26*
