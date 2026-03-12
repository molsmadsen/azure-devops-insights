---
phase: 04-project-state-distribution
plan: 01
subsystem: api
tags: [azure-devops, iterations, sprint, velocity, burndown]

requires:
  - phase: 01-foundation
    provides: ado-client.mjs HTTP functions, config.mjs, SKILL.md pattern
  - phase: 03-activity-skills
    provides: adoGetWorkItemsBatch chunked batch fetch, adoGetProject team info
provides:
  - adoGetTeamIterations and adoGetIterationWorkItems API functions in ado-client.mjs
  - sprint.mjs data script for sprint completion, velocity, backlog health, burndown
  - skills/sprint/SKILL.md narration template for /adi:sprint
affects: [04-02-summary, 04-03-distribution]

tech-stack:
  added: []
  patterns: [iteration-api-team-scoped-url, story-point-fallback-chain, burndown-heuristic]

key-files:
  created: [scripts/sprint.mjs, skills/sprint/SKILL.md]
  modified: [scripts/ado-client.mjs]

key-decisions:
  - "Burndown heuristic: 10% margin on-track, 25% at-risk, else behind; unknown if no dates"
  - "Story point fallback chain: StoryPoints > Effort > item count with useItemCount flag"
  - "Scope creep detection uses CreatedDate > sprint startDate heuristic"

patterns-established:
  - "Team-scoped API: iterations endpoints include teamId in URL path (different from other ADO endpoints)"
  - "Relation-to-detail fetch: iteration work items returns relations, requires batch fetch for fields"

requirements-completed: [SPRINT-SKILL]

duration: 3min
completed: 2026-03-12
---

# Phase 4 Plan 1: Sprint Skill Summary

**Sprint analysis skill with iteration API functions, completion/velocity/burndown data script, and AI narration template**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T11:45:11Z
- **Completed:** 2026-03-12T11:48:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added adoGetTeamIterations and adoGetIterationWorkItems to ado-client.mjs following established error handling pattern
- Created sprint.mjs with four-dimension analysis: completion status, velocity trending, backlog health, burndown heuristic
- Created skills/sprint/SKILL.md with full narration instructions covering all data dimensions and conditional recommendations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add iteration API functions and create sprint.mjs** - `d5bc382` (feat)
2. **Task 2: Create skills/sprint/SKILL.md narration template** - `0f13e88` (feat)

## Files Created/Modified
- `scripts/ado-client.mjs` - Added adoGetTeamIterations and adoGetIterationWorkItems exports
- `scripts/sprint.mjs` - Sprint analysis data script (completion, velocity, backlog health, burndown)
- `skills/sprint/SKILL.md` - Narration template for /adi:sprint with 6 narrative sections

## Decisions Made
- Burndown heuristic uses elapsed time % vs completed work %: 10% margin for on-track, 25% for at-risk, else behind
- Story point fallback chain: StoryPoints preferred, then Effort field, then item count (with useItemCount flag for narration awareness)
- Scope creep detected via CreatedDate after sprint startDate (documented limitation: reassigned items not distinguished from truly new items)
- Sprint dates formatted as date-only (split on T) for cleaner narration output

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- sprint.mjs ready for import by summary.mjs (Plan 02)
- ado-client.mjs iteration functions available for any future sprint-related features
- /adi:sprint skill fully functional pending ADO connection setup

---
*Phase: 04-project-state-distribution*
*Completed: 2026-03-12*
