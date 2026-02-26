# Phase 3: Activity Skills - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Two new `/adi:` skills — `/adi:contributors` (who is active, who has gone quiet) and `/adi:bugs` (open bugs by severity, oldest unresolved, assignment distribution). Both follow the proven pr-metrics pattern: fetch data via Azure DevOps REST API, compute metrics in JavaScript, pass structured JSON to Claude for AI-narrated output.

</domain>

<decisions>
## Implementation Decisions

### Contributor signals
- Three categories of contributors: **active** (commits in window), **quiet** (on team but no recent commits), **former** (committed but no longer on team)
- Cross-reference commit authors against Azure DevOps Teams API to distinguish quiet team members from former contributors
- Separate narrative sections for quiet members and former contributors
- No bus factor analysis (deferred — requires per-path commit analysis, too many API calls)
- No anomaly detection / spike-drop comparison (keep it simple — active vs quiet vs former is enough)

### Bug report scope
- Snapshot of current open bugs, not trend over time (no opened-vs-closed comparison)
- Dimensions covered: severity breakdown, age of open bugs, assignment distribution (who has bugs, who's overloaded, unassigned bugs)
- Top 5 oldest unresolved bugs highlighted explicitly by name and age
- Configurable work item types: default to "Bug", override with `--types "Bug,Defect,Issue"` flag per invocation
- Types flag is skill-invocation only (not persisted in config.json)

### Narrative tone & framing
- Names shown by default; `--anonymous` flag or `anonymous: true` in config.json hides names
- Risk framing for all findings — explicitly call out risks and recommend action (e.g., "5 critical bugs open >30 days — delivery risk")
- Former contributors listed with simple factual framing — no interpretation about why they left, just "3 contributors are no longer on the team"
- Conditional recommendations section — only appears when actionable issues found (same pattern as pr-metrics)

### Flags & configuration
- `--days 30` default, consistent with pr-metrics
- `--repo` optional filter, consistent with pr-metrics
- `--types` (bugs only) — configurable work item types, default "Bug"
- `--anonymous` (contributors only) — hide names; also settable as `anonymous: true` in `~/.adi/config.json`
- No new persistent config settings except `anonymous`

### Claude's Discretion
- Exact narrative structure and section ordering within each skill
- How to handle edge cases (zero bugs, zero contributors, API errors)
- Whether to show commit counts alongside contributor names or just active/quiet status

</decisions>

<specifics>
## Specific Ideas

- Follow the exact same architectural pattern as pr-metrics: data-fetching module (`adoGet*` functions) + metrics computation + SKILL.md that passes JSON to Claude for narration
- "Gone quiet" threshold: if a team member has zero commits in the `--days` window, they're quiet
- Anti-features from research: no productivity ranking, no LOC metrics, no attendance inference

</specifics>

<deferred>
## Deferred Ideas

- Bus factor analysis (knowledge concentration per code path) — separate skill or future phase
- Anomaly detection (activity spikes/drops compared to prior period) — future enhancement
- Trend over time for bugs (opened vs closed) — could add later as `--trend` flag

</deferred>

---

*Phase: 03-activity-skills*
*Context gathered: 2026-02-26*
