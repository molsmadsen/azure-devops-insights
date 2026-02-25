# Phase 2: PR Metrics - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver `/ado:pr-metrics` — a skill that fetches pull request data from Azure DevOps and returns an AI-written narrative about PR health: review times, reviewer participation, stale PRs, and bottlenecks. Creating PRs and interacting with them are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Data Scope
- Default: all repos in the configured ADO project
- `--repo <name>` narrows analysis to a single repo within the project
- `--project <name>` overrides the ADO project from config
- Time window: attempt all-time first; fall back to 1 year if too slow, then 90 days. Always overridable via `--days <n>`
- Include both open and merged PRs (open reveals current bottlenecks; merged gives cycle time history)
- No team filter — full project scope only

### Output Structure
- Narrative with embedded stats and section headers (scannable, not raw tables)
- Show analysis summary at the top: e.g., "Analyzed 87 PRs across 4 repos, last 365 days"
- Call out specific people by name (reviewer participation, bottlenecks)
- Include actionable recommendations section only when issues are found (healthy teams get no recommendations)

### Thresholds & Definitions
- **Stale PR**: no activity for 3 days (overridable via `--stale-days <n>`)
- **Bottleneck**: reviewer with the highest average time-to-first-review across all their reviews
- **Healthy review time**: < 4 hours to first review; anything over is flagged
- All thresholds are overridable via skill arguments

### Invocation & Flags
Supported arguments:
- `--repo <name>` — filter to a single repo
- `--days <n>` — override time window
- `--stale-days <n>` — override stale threshold (default: 3)
- `--project <name>` — override ADO project from config

### Loading & Error Behavior
- Show brief status while fetching: e.g., "Fetching PRs from 4 repos..."
- If no PRs found: friendly message + suggestion to broaden scope (e.g., "No PRs found. Try --days 30.")
- If one repo fails: continue with partial data, note which repos failed in the output

### Claude's Discretion
- Exact section headers and narrative tone
- How to present cycle time (mean vs. median vs. both)
- Order of sections within the narrative
- How to surface anomalies (inline vs. separate section)

</decisions>

<specifics>
## Specific Ideas

- User runs this as a team lead wanting accountability — naming names is intentional and desirable
- Team has a fast-paced expectation: 4-hour review turnaround is the bar, not 24 hours

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-pr-metrics*
*Context gathered: 2026-02-25*
