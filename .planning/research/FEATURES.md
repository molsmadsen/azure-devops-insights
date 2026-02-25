# Feature Landscape

**Domain:** Azure DevOps project analytics CLI (Claude Code skill pack)
**Researched:** 2026-02-25

## Table Stakes

Features users expect from any DevOps project analytics tool. Missing any of these and the skill pack feels incomplete for its stated purpose.

| Feature | Why Expected | Complexity | API Endpoints | Notes |
|---------|--------------|------------|---------------|-------|
| **PR cycle time** | The single most-asked metric for code review health. Every DevOps analytics tool surfaces this. | Medium | `GET .../_apis/git/repositories/{repoId}/pullrequests` (list with date filters), plus individual PR `creationDate` vs `closedDate` | Calculate from PR creation to completion. Filter by status=completed, use `searchCriteria.fromDate`/`toDate`. |
| **PR reviewer distribution** | Developers want to know who reviews what and whether reviews are concentrated on one person. | Medium | `GET .../_apis/git/repositories/{repoId}/pullRequests/{prId}/reviewers` | Vote field values: 10=approved, 5=approved with suggestions, -5=waiting, -10=rejected, 0=no vote. Aggregate across PRs. |
| **PR review turnaround time** | Time from PR creation to first vote. Distinguishes "PR sits for days" from "PR gets quick feedback." | High | PR list endpoint + per-PR reviewer list (need to cross-reference `creationDate` with reviewer thread timestamps) | `GET .../_apis/git/repositories/{repoId}/pullRequests/{prId}/threads` gives `publishedDate` for first comment. Requires N+1 calls or batching. |
| **Open bugs by severity** | Table stakes for any project health view. Developers and managers both ask "how many bugs are open?" | Low | `POST .../_apis/wit/wiql` with WIQL: `SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] <> 'Closed'` then `GET .../_apis/wit/workitems?ids={ids}&$fields=...` | Two-step: WIQL returns IDs only, then batch-fetch fields. Max 200 IDs per batch call. |
| **Bug trend over time** | "Are we fixing bugs faster than we create them?" Basic trend analysis. | Medium | WIQL queries filtered by `[System.CreatedDate]` and `[Microsoft.VSTS.Common.ClosedDate]` over date ranges | Run multiple WIQL queries bucketed by week/month, or use OData: `GET analytics.dev.azure.com/{org}/{project}/_odata/v3.0-preview/WorkItems?$filter=WorkItemType eq 'Bug'` |
| **Sprint/iteration status** | Current sprint progress: how many items done vs remaining. | Low | `GET .../_apis/work/teamsettings/iterations?$timeframe=current` then `GET .../_apis/work/teamsettings/iterations/{iterationId}/workitems` | Need team context in URL. Returns work item references; batch-fetch for state info. |
| **Contributor commit activity** | Who committed code recently and how much. Basic "who is active?" signal. | Medium | `GET .../_apis/git/repositories/{repoId}/commits?searchCriteria.fromDate={date}` | Returns author info, date, changeCounts (add/edit/delete). Paginated; aggregate by author. |
| **Setup/config command** | Users must be able to configure org URL, project name, and PAT without editing files manually. | Low | N/A | Store in `~/.ado-insights/config.json`. Validate PAT by calling `GET .../_apis/projects` on setup. |

## Differentiators

Features that set this skill pack apart. Not expected from a typical dashboard tool, but uniquely valuable in a CLI + AI narrative format.

| Feature | Value Proposition | Complexity | API Endpoints | Notes |
|---------|-------------------|------------|---------------|-------|
| **AI-narrated findings** | The core differentiator. Instead of charts/numbers, Claude writes a narrative: "PR review times spiked last week because reviewer X was on vacation, creating a bottleneck. Consider adding Y as a backup reviewer." | Medium | All of the above (data collection) + Claude's own reasoning | This is the product's reason to exist. Every skill should output prose with findings, anomalies, and recommendations. |
| **Anomaly detection in narrative** | AI identifies outliers: "This PR took 14 days to merge, 5x the team average. It touched 47 files across 12 directories." | Low (incremental) | Same data as PR metrics | Simple statistical outlier detection (>2 std dev from mean) narrated by Claude. Low marginal cost once base metrics exist. |
| **Cross-domain correlation** | "Sprint velocity dropped 30% this iteration. Notably, 3 team members were pulled into emergency bug fixes (BUG-1234, BUG-1256)." Connects work items, PRs, and contributor data. | High | Combines work item, PR, and commit APIs | This is where AI narration shines over dashboards. Requires all base skills to exist first. Build last. |
| **Review bottleneck identification** | Specifically names who is a bottleneck and why: "Alice reviewed 73% of all PRs this month. Her average response time is 4 hours, but PRs assigned only to her wait 2 days because of volume." | Medium | PR reviewers endpoint aggregated | Goes beyond "reviewer distribution" by computing load vs capacity and making actionable recommendations. |
| **Work item aging report** | "12 bugs have been open for over 90 days. The oldest (BUG-892) was created 7 months ago and hasn't been triaged." Highlights neglected work. | Low | WIQL with date math on `[System.CreatedDate]` | Simple query, but AI narrative makes it actionable by highlighting the worst offenders and patterns. |
| **Cycle time / lead time (OData)** | Pre-computed by Azure DevOps Analytics. More accurate than hand-calculating from state changes. | Medium | `GET analytics.dev.azure.com/{org}/{project}/_odata/v3.0-preview/WorkItems?$select=WorkItemId,Title,CycleTimeDays,LeadTimeDays,CompletedDateSK&$filter=CompletedDateSK ge {date}` | Only available on Azure DevOps Services (cloud), not Server. Requires Analytics extension enabled. Should detect availability and fall back gracefully. |
| **Project health summary** | One command gives a 2-paragraph executive summary: sprint status, open bugs, PR throughput, contributor activity. The "morning standup cheat sheet." | Medium | All base endpoints combined | Aggregates outputs from all other skills into a single narrative. Natural upsell once individual skills work. |

## Anti-Features

Features to explicitly NOT build in v1. Each has a clear reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Web dashboard / UI** | Completely different product. Claude Code skills are CLI-native; building a web UI fragments focus and multiplies complexity by 10x. | Output clean markdown text in the terminal. If someone wants charts, they can pipe data to another tool. |
| **Write-back to Azure DevOps** | Creating/updating work items, commenting on PRs, or modifying anything introduces risk. One bug could spam a team's board. Read-only is trust-building. | Clearly state this is read-only in docs. Recommend actions in narrative ("consider closing BUG-892") but never execute them. |
| **Scheduled/automated reports** | Requires a daemon, cron setup, or cloud hosting. Massively increases ops complexity for marginal value. | On-demand only. User runs the command when they want insights. |
| **GitHub/GitLab support** | Splits API surface, doubles testing, triples edge cases. Azure DevOps is the stated scope. | Design the data layer with clean interfaces so a future v2 could add other providers, but do not build it. |
| **Pipeline/build analytics** | Build success rates, pipeline duration, and DORA metrics (deployment frequency, change failure rate) are valuable but represent a large additional API surface (`_apis/build/builds`, `_apis/pipelines/`) with different data shapes. Scope creep risk. | Defer to v2. The four core skills (PRs, contributors, bugs, sprint) are a coherent v1. Pipeline data can be a separate milestone. |
| **Historical trend charts / ASCII graphs** | Rendering charts in a terminal is fragile and hard to get right across terminal emulators. Claude's strength is prose, not visualization. | Describe trends in words: "Bug creation rate increased 40% over the last 3 sprints." Use simple tables for numbers if needed. |
| **Team comparison / leaderboards** | Comparing team members' output creates toxic dynamics. "Alice commits more than Bob" is reductive and harmful. | Focus on team-level and process-level metrics. Individual data is for identifying bottlenecks, not ranking people. |
| **Custom WIQL query builder** | Power users can already run WIQL in Azure DevOps. Building a query builder adds complexity without matching the core value prop of narrated insights. | Provide opinionated, pre-built queries that cover 80% of needs. Advanced users can extend skills themselves. |

## Feature Dependencies

```
Setup/Config ─────────────────────────────────────────────┐
  │                                                        │
  ├── PR Metrics (cycle time, size)                        │
  │     ├── PR Reviewer Distribution                       │
  │     │     └── Review Bottleneck Identification         │
  │     └── PR Review Turnaround Time                      │
  │                                                        │
  ├── Bug Report (open bugs, severity)                     │
  │     ├── Bug Trend Over Time                            │
  │     └── Work Item Aging Report                         │
  │                                                        │
  ├── Sprint Status (iteration progress)                   │
  │                                                        │
  ├── Contributor Activity (commit stats)                  │
  │                                                        │
  └── Cycle Time / Lead Time (OData, optional)             │
                                                           │
  All of the above ──► Project Health Summary              │
  All of the above ──► Cross-Domain Correlation            │
  All narrative features require: AI narration layer  ◄────┘
```

Key dependency insight: **Setup/Config must come first.** Every skill depends on a valid org URL, project name, and PAT. The AI narration layer is not a separate feature to build -- it is inherent in how Claude Code skills work (the skill's markdown instructs Claude to narrate).

## MVP Recommendation

Build these in order for v1:

1. **Setup/Config command** -- gate for everything else. Validate PAT on setup. Store credentials safely.
2. **PR Metrics skill** -- highest developer interest. Includes cycle time, reviewer distribution, and basic anomaly flagging. Uses `pullrequests` + `reviewers` endpoints.
3. **Bug Report skill** -- second most requested. Open bugs by severity, aging analysis. Uses WIQL + work items batch endpoint.
4. **Sprint Status skill** -- rounds out the "project state" picture. Uses iterations + work items endpoints.
5. **Contributor Activity skill** -- "who's active?" Uses commits endpoint.
6. **Project Health Summary** -- aggregates all of the above into one command. Build last since it depends on everything.

**Defer to v2:**
- Pipeline/build analytics: large additional API surface, different audience concern
- DORA metrics: requires pipeline data that is out of v1 scope
- Cycle time via OData: only works on Azure DevOps Services (cloud), adds a second API protocol. Can fall back to calculated values from WIQL in v1.
- Cross-domain correlation: requires all base skills to be mature and reliable first

## API Authentication Note

All REST API calls require a PAT (Personal Access Token) with at minimum these scopes:
- **Code (Read)**: For PR and commit data
- **Work Items (Read)**: For bugs, sprints, work items
- **Analytics (Read)**: For OData cycle/lead time (v2)
- **Build (Read)**: For pipeline data (v2)

The PAT is passed as a Basic auth header: `Authorization: Basic base64(:PAT)`.

## API Pagination Note

Most Azure DevOps list endpoints return paginated results with `$top` (default 100) and `$skip` or continuation tokens. Skills must handle pagination to avoid silently missing data on active projects. The WIQL endpoint has a hard cap of 20,000 work item IDs per query.

## Sources

- [Azure DevOps REST API Reference (v7.2)](https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2)
- [Pull Requests API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests?view=azure-devops-rest-7.1)
- [Pull Request Reviewers API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-reviewers?view=azure-devops-rest-7.1)
- [Pull Request Threads API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads?view=azure-devops-rest-7.1)
- [WIQL Query Endpoint](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1)
- [Work Items Batch API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item?view=azure-devops-rest-7.1)
- [Iterations API](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations?view=azure-devops-rest-7.1)
- [Git Commits API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits?view=azure-devops-rest-7.1)
- [Git Stats API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/stats?view=azure-devops-rest-7.1)
- [Analytics OData Endpoint](https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/data-model-analytics-service?view=azure-devops)
- [Cycle Time and Lead Time](https://learn.microsoft.com/en-us/azure/devops/report/dashboards/cycle-time-and-lead-time?view=azure-devops)
- [Lead/Cycle Time OData Sample](https://learn.microsoft.com/en-us/azure/devops/report/powerbi/sample-boards-leadcycletime?view=azure-devops)
- [Builds API](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/builds?view=azure-devops-rest-7.1)
- [DORA Metrics for Azure DevOps (community project)](https://github.com/DeveloperMetrics/DevOpsMetrics)
- [Measuring PR Cycle Time in Azure DevOps](https://community.zenduty.com/t/measuring-pull-request-cycle-time-in-azure-devops/250)
