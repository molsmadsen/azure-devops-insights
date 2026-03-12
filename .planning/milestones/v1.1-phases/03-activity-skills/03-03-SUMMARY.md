---
phase: 03-activity-skills
plan: 03
subsystem: skills
tags: [bugs, wiql, work-items, severity, azure-devops]

requires:
  - phase: 03-activity-skills/01
    provides: adoWiql and adoGetWorkItemsBatch functions in ado-client.mjs
provides:
  - scripts/bugs.mjs — bug data fetching and metrics computation
  - skills/bugs/SKILL.md — Claude narration instructions for bug data
affects: [04-polish, future bug trend skills]

tech-stack:
  added: []
  patterns: [WIQL query for work items, severity-agnostic grouping, age bucketing]

key-files:
  created: [scripts/bugs.mjs, skills/bugs/SKILL.md]
  modified: []

key-decisions:
  - "Severity grouping uses raw API values (process-template agnostic) — no hardcoded severity names"
  - "bugs.mjs was already committed in prior 03-02 run; SKILL.md created fresh"

patterns-established:
  - "Work item skill pattern: WIQL query + batch fetch + metrics computation + JSON output"
  - "Overloaded threshold: >5 open bugs per assignee flags as overloaded"

requirements-completed: []

duration: 3min
completed: 2026-02-26
---

# Phase 03 Plan 03: Bugs Skill Summary

**Open bug reporting skill with severity breakdown, age analysis, top 5 oldest highlights, and assignment distribution via WIQL query**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T12:46:27Z
- **Completed:** 2026-02-26T12:49:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- bugs.mjs queries open bugs via WIQL with configurable --types flag (default: "Bug")
- Severity breakdown, age analysis (mean/median/buckets), top 5 oldest, assignment distribution with overloaded detection
- SKILL.md provides complete Claude narration instructions with conditional recommendations section and risk framing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/bugs.mjs** - `effcf86` (feat — committed in prior 03-02 run, content verified correct)
2. **Task 2: Create skills/bugs/SKILL.md** - `bb11d90` (feat)

## Files Created/Modified
- `scripts/bugs.mjs` - WIQL query + batch fetch + severity/age/assignment metrics, outputs JSON
- `skills/bugs/SKILL.md` - Claude narration instructions with config guard, error handling, and 5 narrative sections

## Decisions Made
- Severity grouping uses raw API values (process-template agnostic) — no hardcoded "1 - Critical" etc.
- Age buckets: 0-7, 8-30, 31-90, 90+ days
- Overloaded threshold set at >5 open bugs per assignee
- Recommendations section conditional on actual issues found (critical/high severity, aging, overloaded, unassigned)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] bugs.mjs already committed in 03-02 task**
- **Found during:** Task 1 (Create scripts/bugs.mjs)
- **Issue:** bugs.mjs was already tracked in git from a prior partial run that committed it alongside 03-02 contributors.mjs
- **Fix:** Verified the committed content meets all plan requirements (correct imports, flags, metrics, JSON output). No code changes needed.
- **Files modified:** None (content already correct)
- **Verification:** `node -c scripts/bugs.mjs` passes, all imports and flags present

---

**Total deviations:** 1 (pre-existing commit from prior run)
**Impact on plan:** No scope creep. Content verified correct.

## Issues Encountered
None beyond the pre-committed file noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /adi:bugs skill fully defined and ready for use
- Pattern established for additional work item skills (e.g., tasks, user stories)
- All CONTEXT.md locked decisions honored (snapshot not trend, severity agnostic, types invocation-only)

---
*Phase: 03-activity-skills*
*Completed: 2026-02-26*
