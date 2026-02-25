# Feature Research

**Domain:** Azure DevOps project analytics CLI — v1.1 new skills
**Researched:** 2026-02-25
**Confidence:** HIGH (ADO REST API v7.1 verified via official docs; patterns verified via multiple sources)

---

## Scope

This document covers the five new skills in v1.1:
- `/adi:contributors` — who is active, who has gone quiet
- `/adi:bugs` — open bugs by severity, trends, oldest unresolved
- `/adi:sprint` — current sprint completion, velocity, backlog health
- `/adi:summary` — AI narrative synthesizing PRs, contributors, bugs, sprint
- `/adi:update` — self-update the skill pack with changelog display

Existing v1.0 features (setup, pr-metrics) are documented separately. This file focuses only on new v1.1 features and does not repeat v1.0 decisions.

---

## Skill: /adi:contributors

### Table Stakes

Features users expect from any contributor activity report.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Commit count per author (last N days) | Every "who's working?" question starts here. Seen in GitHub insights, GitLab, every analytics tool. | LOW | `GET /_apis/git/repositories/{repoId}/commits?searchCriteria.fromDate=&searchCriteria.$top=` — returns `author.name`, `author.date`, `changeCounts`. Must aggregate across repos (multiple `adoGetRepos` calls). |
| "Gone quiet" detection | Identifying people who committed recently but have gone silent. Users ask this explicitly. | LOW | Compare last-commit-date per author against a threshold (e.g., 14 days). No special API — derived from commit list. |
| Activity window configurable | Users want "last 30 days" vs "last 7 days" depending on sprint cadence. | LOW | Pass `--days` flag, same pattern as pr-metrics. |
| Per-repo breakdown optional | Multi-repo projects need clarity about which repo activity is in. | LOW | Flag `--repo` filter. Already established pattern from pr-metrics. |
| Written AI narrative with findings | Core ADI pattern. Contributor data without interpretation is raw noise. | LOW | Same JSON-to-Claude narrative pattern used in pr-metrics. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Bus factor" signal | "Only 2 of 7 contributors touched the payments module in the last 30 days." Names knowledge concentration risk. | MEDIUM | Requires commit path/file analysis. `searchCriteria.itemPath` on commits endpoint can scope to directory. Computationally more expensive — multiple API calls per repo/path combination. |
| PR authorship combined with commit activity | Cross-signals: a contributor with many commits but zero PRs may be working in a fork or bypassing code review. | MEDIUM | Requires join of pr-metrics data (PR `createdBy`) with commit author data. Since `/adi:summary` already does this, flag it there rather than contributors. |
| Anomaly: sudden spike or drop | "Alice's commit volume dropped 80% compared to the previous 30 days." Proactive health signal. | LOW | Requires two date windows (current vs prior period). Two API calls per repo, compute delta per author. Worth including — minimal extra cost. |

### Anti-Features

| Feature | Why Avoid | Alternative |
|---------|-----------|-------------|
| Individual productivity ranking / leaderboard | Commit counts are meaningless as a productivity proxy. Ranking people creates toxic dynamics. | Frame output as team health: "3 contributors were active, 2 have been quiet." No ordinal ranking. |
| Code churn / lines changed metrics | LOC metrics are notoriously misleading and actively harmful when used to evaluate people. | Use commit count and PR count as activity proxies only. Explicitly avoid LOC. |
| Attendance / hours inference | "Alice only committed 2 days this week" is not the skill's concern. | Detect inactivity patterns relevant to delivery risk, not personal work schedules. |

### API Surface (contributors)

```
Primary:  GET /_apis/git/repositories/{repoId}/commits
          ?searchCriteria.fromDate={ISO date}
          &searchCriteria.$top=1000

Secondary: GET /_apis/git/repositories   (adoGetRepos — already exists)

Response fields used:
  commit.author.name      — display name
  commit.author.email     — for deduplication
  commit.author.date      — timestamp
  commit.changeCounts     — {Add, Edit, Delete}
  commit.commitId         — for deduplication
```

**PAT scope required:** `Code (Read)` — already required by pr-metrics.

---

## Skill: /adi:bugs

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Open bug count total | Every project health view starts here. | LOW | WIQL: `SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] NOT IN ('Closed','Resolved','Done')` |
| Bugs grouped by severity | "How bad are they?" is the second question after count. | LOW | After WIQL returns IDs, batch-fetch `Microsoft.VSTS.Common.Severity` field. Standard values: "1 - Critical", "2 - High", "3 - Medium", "4 - Low". Custom orgs may vary — handle gracefully. |
| Oldest unresolved bugs | Teams with bugs open 90+ days need to see that clearly. | LOW | Sort by `System.CreatedDate` ascending after batch-fetch. |
| Bug count by state | "Active" vs "Resolved" vs "In Progress" distribution. | LOW | Batch-fetch `System.State`. |
| Written AI narrative with findings | Core ADI pattern. | LOW | JSON-to-Claude narrative. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Bug creation vs resolution trend | "Are we closing bugs faster than we open them?" Trend over last N sprints is the key insight. | MEDIUM | Two WIQL queries with date bucketing: opened-per-week and resolved-per-week over a 6-week window. No OData needed — derive from `System.CreatedDate` and `Microsoft.VSTS.Common.ClosedDate`. |
| Unassigned Critical/High bugs | "2 Critical bugs have no assignee." Immediately actionable. | LOW | Batch-fetch `System.AssignedTo` field. Filter where null and severity <= "2 - High". |
| Stale unresolved bugs (aging) | Bugs open 60+ days that have not been updated. Same pattern as stale PRs. | LOW | Compare `System.ChangedDate` (last update) against threshold. Similar staleness logic to pr-metrics. |
| Priority vs severity mismatch flag | Bugs with Severity=Critical but Priority=4 (unimportant) are misconfigured. | LOW | Cross-field check on `Microsoft.VSTS.Common.Priority` vs `Microsoft.VSTS.Common.Severity`. Simple if both fields are present; no extra API calls. |

### Anti-Features

| Feature | Why Avoid | Alternative |
|---------|-----------|-------------|
| Custom WIQL query input | Power users can run WIQL themselves. Building a query builder matches neither the skill format nor Claude Code UX. | Ship opinionated default queries. Advanced users extend via skill markdown directly. |
| Bug reproduction steps / full description | Fetching full work item content adds API cost and output noise. | Fetch title, severity, priority, state, created date, assigned to. Link to bug in ADO for full detail. |
| Auto-close or write-back recommendations executed | Read-only is a v1 constraint and a trust boundary. | Narrate "consider closing BUG-892" but never execute it. |

### API Surface (bugs)

```
Primary:  POST /_apis/wit/wiql
          Body: { "query": "SELECT [System.Id] FROM WorkItems WHERE ..." }
          Returns: { workItems: [{id, url}] }  -- IDs only

Secondary: POST /_apis/wit/workitemsbatch
           Body: { ids: [1,2,...], fields: [
             "System.Id", "System.Title", "System.State",
             "System.CreatedDate", "System.ChangedDate",
             "System.AssignedTo",
             "Microsoft.VSTS.Common.Severity",
             "Microsoft.VSTS.Common.Priority",
             "Microsoft.VSTS.Common.ClosedDate"
           ]}
           Max 200 IDs per batch. Paginate WIQL+batch for large bug counts.
```

**PAT scope required:** `Work Items (Read)` — new scope, must be verified during `/adi:setup`.

---

## Skill: /adi:sprint

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Current sprint identification | "What sprint are we in?" is always the first question. | LOW | `GET /_apis/work/teamsettings/iterations?$timeframe=current` returns current iteration with name, start, finish dates. Requires `{team}` in URL path — use default team or configurable. |
| Sprint start/end date and days remaining | Users want temporal context instantly. | LOW | Derived from `startDate`/`finishDate` in iteration response. |
| Work item completion count and percentage | "How much is done?" is the core sprint health signal. | MEDIUM | Iteration work items endpoint returns IDs only. Batch-fetch `System.State` for each. Count "Done"/"Closed"/"Completed" states vs total. State names vary by process template — handle "Scrum" and "Agile" templates. |
| Work items by state distribution | "Active / Committed / Done" breakdown. | LOW | Same batch-fetch as above, group by state. |
| Written AI narrative with findings | Core ADI pattern. | LOW | JSON-to-Claude narrative. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Velocity (last N sprints) | "Is this sprint on track relative to past performance?" Requires comparing against previous iterations. | MEDIUM | `GET /_apis/work/teamsettings/iterations` (no timeframe filter) returns all iterations. Fetch work items for last 3-5 completed sprints, compute "completed items" per sprint. No story points needed — item count is sufficient for initial velocity signal. |
| Unassigned sprint work items | Items in sprint with no assignee will not get done. | LOW | Batch-fetch `System.AssignedTo`. Flag any null/empty. |
| Blocked items count | Items tagged as blocked are a delivery risk signal. | LOW | WIQL: `WHERE [System.Tags] Contains 'blocked'` or `[System.BoardLane] = 'Blocked'`. Process-dependent — mark as best-effort. |
| Backlog size ratio | "The sprint has 12 items but 47 are in the backlog." Provides urgency context. | LOW | Run a second WIQL for backlog items (state = New/Active, not in any current iteration). Simple count, no full fetch needed. |
| Days remaining vs completion rate | "At current pace, 3 of 12 items will not complete before the sprint ends." Linear projection. | LOW | (items_done / days_elapsed) * days_remaining. Simple arithmetic on fetched data. High value for AI narration. |

### Anti-Features

| Feature | Why Avoid | Alternative |
|---------|-----------|-------------|
| Burndown chart / ASCII visualization | Rendering time-series charts in terminal is fragile and Claude's strength is prose. | Describe velocity trend in words with concrete numbers. |
| Story points (effort estimation) | Story points require `Microsoft.VSTS.Scheduling.StoryPoints` which is optional and varies by template. Many teams do not use them. | Use item count as the velocity proxy. Note if story points data is available. |
| Capacity planning (team member hours) | Capacity API (`/_apis/work/teamsettings/iterations/{id}/capacities`) requires team member data and is complex to present meaningfully without context. | Defer to v2. Mention sprint completion risk via completion rate instead. |
| Future sprint planning | Looking at upcoming sprints adds scope. Planning is a different workflow from health analysis. | Keep skill focused on the current sprint. |

### API Surface (sprint)

```
Primary:  GET /{project}/{team}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1
          Returns: iteration id, name, startDate, finishDate, timeFrame

Secondary: GET /{project}/{team}/_apis/work/teamsettings/iterations/{iterationId}/workitems?api-version=7.1
           Returns: workItemRelations[] with target.id references only

Tertiary:  POST /_apis/wit/workitemsbatch
           fields: ["System.Id","System.Title","System.State","System.AssignedTo",
                    "System.WorkItemType","Microsoft.VSTS.Scheduling.StoryPoints"]

For velocity:
           GET /{project}/{team}/_apis/work/teamsettings/iterations?api-version=7.1
           (no timeframe filter = all iterations, then filter past N by finishDate)
```

**Important:** `{team}` is required in the URL path. The default team is the project name in most ADO orgs, but must be configurable. This is new API territory for this project — the pr-metrics skill does not use team-scoped endpoints.

**PAT scope required:** `Work Items (Read)` — shared with /adi:bugs.

---

## Skill: /adi:summary

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Synthesizes all other skills into one narrative | This is the stated purpose of /adi:summary. A summary that only shows one domain defeats the point. | MEDIUM | Must invoke pr-metrics.mjs, a contributors script, a bugs script, and a sprint script, collect all JSON outputs, and pass combined payload to Claude for narration. |
| Handles missing data gracefully | Some skills may fail (e.g., no current sprint, no bugs). Summary must still produce a useful report. | LOW | Treat each sub-result as optional. Narrate what is available; call out what could not be fetched. |
| Written AI narrative, not just concatenation | The value is cross-domain correlation: "PR throughput dropped while bug count rose" is a cross-domain insight no individual skill can surface. | LOW | This is inherent in giving Claude a combined JSON payload and asking for a synthesized narrative. The prompt instruction is the implementation. |
| Identifies the most important signal | Users running /adi:summary want ONE key takeaway, not a list of everything. | LOW | Instruct Claude in skill markdown to lead with the single most important finding. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cross-domain correlation in narrative | "The sprint is 60% complete with 3 days left AND 4 team members are inactive AND 3 Critical bugs are unassigned. This combination suggests delivery is at risk." No individual skill can say this. | LOW | Emerges naturally from combined JSON payload + good prompt. No extra API calls needed. |
| Trend framing (this sprint vs last) | "This is the second consecutive sprint where velocity has declined." Requires prior-sprint data to be included in the payload. | MEDIUM | Pass last 2-3 sprint results into the combined payload. /adi:sprint already collects velocity data. |
| Recommended actions section | The most actionable part of any summary is "here is what to do next." | LOW | Instruct Claude in skill markdown to end with 3-5 prioritized actions. Same prompt engineering as pr-metrics. |

### Anti-Features

| Feature | Why Avoid | Alternative |
|---------|-----------|-------------|
| Parallel sub-skill execution | Running all sub-scripts in parallel via Promise.all is tempting but can hit ADO rate limits and makes error handling harder. | Run sub-scripts sequentially. Each takes 1-3 seconds. Total is acceptable for a summary command. |
| Re-implementing sub-skill logic | Duplicating the contributors/bugs/sprint fetch logic in summary.mjs creates maintenance debt. | Import the sub-scripts or invoke them as child processes and capture stdout JSON. The pr-metrics pattern (script outputs JSON to stdout) was designed for exactly this. |
| Excessive output length | If summary outputs 2000+ words, users stop reading it. | Instruct Claude to cap the summary at ~400 words with a structured format: headline finding, sub-domain summaries (2-3 sentences each), recommended actions. |

### Dependency Map (summary)

```
/adi:summary depends on:
  ├── pr-metrics.mjs       (already exists — invoke as subprocess)
  ├── contributors.mjs     (new in v1.1 — must exist first)
  ├── bugs.mjs             (new in v1.1 — must exist first)
  └── sprint.mjs           (new in v1.1 — must exist first)

Build order: contributors → bugs → sprint → summary
```

**This is the hardest ordering constraint in v1.1.** `/adi:summary` cannot be built until all three other new skills have stable JSON output contracts.

---

## Skill: /adi:update

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pull latest from remote and apply | The baseline behavior of any self-update command. Users expect `git pull` semantics. | LOW | `git pull` in the skill pack directory. The plugin directory is a git repo (installed via `--plugin-dir` pointing to a cloned repo). Invoke `git pull` as a child process from the skill markdown, capture exit code. |
| Show what changed (changelog) | Users want to know what they got before restarting Claude Code. Missing this = black-box update. | LOW | Read CHANGELOG.md after the pull and show the latest entry. The project already has a CHANGELOG.md. Parse the topmost section (lines from first `## [version]` to next `## [version]`). |
| Confirm current version and available version | "You are on v1.0, latest is v1.1" framing sets user expectations before the update runs. | LOW | Read `package.json` or a VERSION file for current version. Check git remote for latest tag or read the remote CHANGELOG header. |
| Handle already-up-to-date gracefully | If no update is available, say so clearly. Do not fail silently. | LOW | Check git pull exit output for "Already up to date." message. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Version tag display (not just commit hash) | Users understand "v1.1.0" better than a commit SHA. | LOW | Tag the repo at releases. `git describe --tags` or check `package.json` version field. |
| Breaking change warning | If CHANGELOG.md entry contains "BREAKING" flag it explicitly before applying. | LOW | Simple string search in changelog entry before pull. Warn user and ask for confirmation. |
| Post-update instruction | "Restart Claude Code to use the updated skills." Without this, users wonder why skills did not change. | LOW | Always show this message after a successful update. |

### Anti-Features

| Feature | Why Avoid | Alternative |
|---------|-----------|-------------|
| Automatic/silent updates | Updates without user awareness erode trust. Users run Claude Code commands expecting deterministic behavior. | On-demand only. No background polling. |
| npm publish / registry-based updates | Zero npm dependencies is a v1 constraint and a deliberate design choice. Do not introduce npm to implement update. | Use git pull. The plugin is already a git repo by design. |
| Rollback/downgrade command | Adds scope. Git already provides rollback via `git checkout` but building a first-class rollback UX is a separate feature. | Document manual rollback (`git checkout <tag>`) in CHANGELOG. Do not build it as a command. |
| Checking for updates in other commands | Polling the remote on every skill invocation adds latency and network calls. | Update is on-demand only. No "update available" banner in other skills. |

### API Surface (update)

```
Not an Azure DevOps REST API skill.

Shell operations:
  git -C {pluginDir} pull --ff-only
  git -C {pluginDir} describe --tags --abbrev=0

File reads:
  {pluginDir}/CHANGELOG.md   — show latest section
  {pluginDir}/package.json   — current version field

The skill markdown invokes these via the Node.js script pattern
(child_process.execSync or similar) or directly via bash in the
Claude Code skill step instructions.
```

**No PAT scope required.** This skill does not call Azure DevOps.

---

## Feature Landscape Summary

### Full Table Stakes (across all five skills)

| Feature | Skill | Complexity | User Value |
|---------|-------|------------|------------|
| Commit count per author, last N days | contributors | LOW | HIGH |
| "Gone quiet" detection (last active date) | contributors | LOW | HIGH |
| Open bug count by severity | bugs | LOW | HIGH |
| Oldest unresolved bugs | bugs | LOW | HIGH |
| Current sprint identification + dates | sprint | LOW | HIGH |
| Sprint completion % | sprint | MEDIUM | HIGH |
| Work items by state distribution | sprint | LOW | HIGH |
| Cross-domain narrative synthesis | summary | MEDIUM | HIGH |
| Handles partial data gracefully | summary | LOW | HIGH |
| `git pull` + show changelog | update | LOW | HIGH |
| Confirm current vs available version | update | LOW | MEDIUM |

### Full Differentiators (across all five skills)

| Feature | Skill | Complexity | User Value |
|---------|-------|------------|------------|
| Commit anomaly detection (spike/drop vs prior period) | contributors | LOW | HIGH |
| Bug creation vs resolution trend | bugs | MEDIUM | HIGH |
| Stale unresolved bugs (unchanged for N days) | bugs | LOW | MEDIUM |
| Unassigned Critical/High bugs | bugs | LOW | HIGH |
| Velocity (last N sprints) | sprint | MEDIUM | HIGH |
| Days remaining vs completion rate projection | sprint | LOW | HIGH |
| Unassigned sprint items | sprint | LOW | MEDIUM |
| Cross-domain correlation in narrative | summary | LOW | HIGH |
| Breaking change warning before update | update | LOW | MEDIUM |

---

## Feature Dependencies

```
/adi:setup (v1.0 — complete)
  └──provides auth──> All skills

/adi:pr-metrics (v1.0 — complete)
  └──provides JSON output contract──> /adi:summary (reuse pattern)

/adi:contributors (v1.1 — new)
  └──required by──> /adi:summary

/adi:bugs (v1.1 — new)
  └──required by──> /adi:summary

/adi:sprint (v1.1 — new)
  └──required by──> /adi:summary

/adi:update (v1.1 — new, independent)
  └──no deps on other skills
```

### Dependency Notes

- **contributors, bugs, sprint must be built before summary:** `/adi:summary` invokes the other scripts as subprocesses and reads their JSON stdout. Building summary before the others are stable will result in an incomplete shell.
- **update is independent:** Can be built at any point in v1.1. No Azure DevOps API calls. Lowest risk skill.
- **bugs and sprint share a PAT scope:** Both need `Work Items (Read)`. The `/adi:setup` PAT validation should be updated to check this scope. This is a new requirement not present in v1.0.
- **sprint introduces team-scoped API URLs:** All existing skills use project-scoped URLs. Sprint endpoints require `/{project}/{team}/` in the path. The default team name is typically the same as the project name in ADO, but this is not guaranteed. Config must support team name, or the skill must discover the default team.

---

## MVP Definition

### Ship in v1.1 (this milestone)

- [x] `/adi:contributors` — commit activity per author, gone-quiet detection, anomaly signal
- [x] `/adi:bugs` — open bugs by severity, oldest unresolved, unassigned critical bugs
- [x] `/adi:sprint` — current sprint completion %, state distribution, days remaining vs completion rate
- [x] `/adi:summary` — cross-domain narrative after other three skills are stable
- [x] `/adi:update` — git pull, show changelog, version confirmation

### Defer to v2

- **Bus factor analysis** (`/adi:contributors`): Requires per-path commit filtering — multiple API calls per path. Valuable but expensive. Revisit when user feedback confirms demand.
- **Velocity via story points** (`/adi:sprint`): Many teams do not use story points. Item count velocity is sufficient for v1.1. Add story points as optional layer in v2.
- **Team capacity planning** (`/adi:sprint`): Capacity endpoint complexity is high. Deliver risk signal via completion rate instead.
- **Pipeline/build analytics**: Separate API surface. Out of scope for v1.
- **DORA metrics**: Requires pipeline data. Out of scope for v1.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `/adi:update` | HIGH | LOW | P1 |
| `/adi:contributors` table stakes | HIGH | LOW | P1 |
| `/adi:bugs` table stakes | HIGH | LOW | P1 |
| `/adi:sprint` table stakes | HIGH | MEDIUM | P1 |
| `/adi:summary` cross-domain synthesis | HIGH | MEDIUM | P1 |
| Bug creation vs resolution trend | HIGH | MEDIUM | P2 |
| Sprint velocity (last N sprints) | HIGH | MEDIUM | P2 |
| Days remaining vs completion rate | HIGH | LOW | P2 |
| Commit anomaly (spike/drop) | HIGH | LOW | P2 |
| Unassigned Critical/High bugs | HIGH | LOW | P2 |
| Bus factor analysis | MEDIUM | HIGH | P3 |
| Team capacity planning | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should include when implementing the skill — low marginal cost once base is working
- P3: Future milestone only

---

## Cross-Skill Notes

### New PAT Scope Requirement

v1.1 introduces `Work Items (Read)` as a required PAT scope. `/adi:setup` must be updated to validate this scope at configuration time, alongside the existing `Code (Read)` check. Without this, `/adi:bugs` and `/adi:sprint` will fail at runtime with a confusing 403.

### Team Name Discovery

Sprint endpoints use `/{project}/{team}/` paths. The safest approach: default to `{project}` as the team name (most ADO orgs default team matches project name), and surface a clear error message if team is not found, with instructions to pass `--team` flag.

### JSON Output Contract

Each new skill script must follow the established contract from pr-metrics.mjs:
- `console.log(JSON.stringify(result))` to stdout (Claude reads this)
- `process.stderr.write(...)` for progress messages (not consumed by Claude)
- `{ error: { type, message } }` structure on failure
- `--check-config` flag to validate config without doing API calls

### Narrative Output Pattern

All skills follow the pr-metrics output pattern:
1. Script fetches data and emits structured JSON to stdout
2. Skill markdown instructs Claude to interpret the JSON as a written narrative with: findings, anomalies, recommendations
3. Claude narrates — never just prints raw numbers

---

## Sources

- [Azure DevOps Iterations - List (v7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.1) — confirmed `$timeframe=current` filter, iteration fields including startDate/finishDate/timeFrame
- [Azure DevOps Iterations - Get Iteration Work Items (v7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/get-iteration-work-items?view=azure-devops-rest-7.1) — confirmed returns work item ID references only (requires batch follow-up)
- [Azure DevOps WIQL - Query By WIQL (v7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1) — confirmed POST endpoint, query syntax, returns IDs only
- [Azure DevOps Work Items - Get Work Items Batch (v7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-items-batch?view=azure-devops-rest-7.1) — confirmed max 200 IDs per batch, fields array, `Microsoft.VSTS.Scheduling.RemainingWork` example
- [Azure DevOps Commits - Get Commits (v7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits?view=azure-devops-rest-7.1) — confirmed `searchCriteria.author`, `searchCriteria.fromDate`, `searchCriteria.toDate`, response includes `author.name`, `author.email`, `author.date`, `changeCounts`
- [Microsoft.VSTS.Common.Severity field values](https://developercommunity.visualstudio.com/content/problem/100610/how-to-add-a-new-value-for-severity-field-in-bug-t.html) — standard values confirmed as "1 - Critical", "2 - High", "3 - Medium", "4 - Low"
- [Atlassian: Sprint Health with Agile Metrics](https://community.atlassian.com/forums/App-Central-articles/How-to-Understand-Sprint-Health-with-Agile-Metrics-Velocity/ba-p/3063846) — velocity, burndown, completion rate patterns
- [Monday.com: Agile Velocity Best Practices 2025](https://monday.com/blog/rnd/agile-velocity/) — planned-to-done ratio (80% threshold), velocity tracking patterns

---
*Feature research for: Azure DevOps Insights v1.1 new skills (contributors, bugs, sprint, summary, update)*
*Researched: 2026-02-25*
