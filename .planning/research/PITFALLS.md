# Pitfalls Research

**Domain:** Adding new skills to an existing Azure DevOps Insights Claude Code plugin (v1.1)
**Researched:** 2026-02-25
**Confidence:** HIGH

> **Scope note:** This file covers pitfalls specific to v1.1 additions — `/adi:contributors`,
> `/adi:bugs`, `/adi:sprint`, `/adi:summary`, and `/adi:update`. Pitfalls already mitigated
> in v1.0 (HTTP 203, adoGet orphan, CLAUDE_PLUGIN_ROOT resolver) are referenced but not
> repeated in full.

---

## Critical Pitfalls

### Pitfall 1: Sprint API Requires a Team Segment in the URL Path

**What goes wrong:**

The sprint/iteration endpoints live under `teamsettings`, not the project-level `_apis` root:

```
GET {org}/{project}/{team}/_apis/work/teamsettings/iterations?$timeframe=current
```

Omitting `{team}` causes a 404 or returns data for the wrong default team. A developer who models this endpoint after the existing PR endpoints (which use `{project}/_apis/git/...`) will write the wrong URL and get confusing errors.

The two-step pattern required is:

1. `GET {org}/{project}/_apis/teams` — list teams, pick one (or use project name as default team slug)
2. `GET {org}/{project}/{team}/_apis/work/teamsettings/iterations?$timeframe=current` — get current sprint
3. `GET {org}/{project}/{team}/_apis/work/teamsettings/iterations/{iterationId}/workitems` — get work item references
4. `POST {org}/{project}/_apis/wit/workitemsbatch` — fetch actual work item details by ID batch

**Why it happens:**

v1.0 skills only use `git/repositories/...` and `git/pullrequests/...` endpoints, which are project-scoped. The team-scoped `work/teamsettings/...` namespace is structurally different and not established in the existing `ado-client.mjs` helper library.

**How to avoid:**

- Add a dedicated `adoGetTeamIterations(config, team, timeframe)` function to `ado-client.mjs` before writing `sprint.mjs`
- Default team slug: Azure DevOps accepts the project name as the team slug when the project has only one team (the default team). Document this fallback clearly.
- Add a `--team` flag to `sprint.mjs` so users can specify a non-default team
- If no team is configured and the API returns 404, surface: "No team found. Try `--team=<name>`. List teams with `/adi:help`."

**Warning signs:**

- `sprint.mjs` constructs URLs that look like `{org}/{project}/_apis/work/teamsettings/...` (missing the team segment)
- Test against a project with multiple teams — the default team assumption breaks immediately

**Phase to address:** Phase building `/adi:sprint` (before writing the script)

---

### Pitfall 2: Iteration Work Items Returns References Only — Full Details Require a Second Batch Call

**What goes wrong:**

`GET .../iterations/{iterationId}/workitems` returns `workItemRelations[]` with only IDs and URLs — no titles, states, story points, or types:

```json
{
  "workItemRelations": [
    { "target": { "id": 42, "url": "..." } }
  ]
}
```

A developer who expects rich work item data from this endpoint will output only IDs to Claude. Claude cannot produce a sprint narrative from IDs alone.

The full data requires a second call: `POST {org}/{project}/_apis/wit/workitemsbatch` with the extracted IDs, specifying `fields` to include `System.State`, `System.Title`, `Microsoft.VSTS.Scheduling.StoryPoints`, `System.WorkItemType`, etc.

**Why it happens:**

The pattern is the classic N+1 problem disguised as an ADO API design — the relations endpoint is intentionally lightweight. The batch endpoint exists to solve this, but it requires a POST with a body, which is different from every other call in the v1.0 codebase (all are GETs).

**How to avoid:**

- Extract IDs from `workItemRelations[].target.id` (skip null targets from hierarchy links)
- Batch into groups of 200 (the batch endpoint maximum)
- POST to `_apis/wit/workitemsbatch?api-version=7.1` with `{ "ids": [...], "fields": [...] }`
- The existing `ado-client.mjs` pattern only supports GET requests — add `adoPost(path, body, config)` or a dedicated `adoGetWorkItemsBatch(config, ids, fields)` function

**Warning signs:**

- `sprint.mjs` passes `workItemRelations` array directly to output without a second fetch
- Output JSON contains only `id` and `url` fields, no `System.State` or `System.Title`

**Phase to address:** Phase building `/adi:sprint`

---

### Pitfall 3: Contributors API Is Per-Repository — Multi-Repo Aggregation Requires Looping

**What goes wrong:**

There is no project-wide "contributor summary" endpoint. The commits API is scoped to a single repository:

```
GET {org}/{project}/_apis/git/repositories/{repoId}/commits?searchCriteria.fromDate=...
```

A developer who expects a single call to return all contributors across all repos in the project will get only one repo's worth of data. Projects with 5–20 repositories will silently under-count contributors.

**Why it happens:**

The PR metrics skill used both `adoGetPrsByProject` (project-wide) and `adoGetPrsByRepo` (per-repo). The PR API supports project-wide queries because PRs have a project-scoped endpoint. The commits API does not — it requires a repo ID in the path.

**How to avoid:**

- `contributors.mjs` must: (1) fetch all repos via `adoGetRepos(config)`, (2) loop each repo and fetch commits with date filter, (3) aggregate by author email/name across repos
- Use `searchCriteria.fromDate` with a 30-day window by default to limit data volume
- Deduplicate contributors by email, not display name (display names change; email is stable)
- Respect rate limits: with 10 repos and 30 days of commits, this can be 10+ API calls. Use the existing batched approach from `pr-metrics.mjs`

**Warning signs:**

- `contributors.mjs` calls only one repo (hard-coded or only the first repo)
- Contributor counts don't match what developers see in the ADO UI (UI aggregates cross-repo)

**Phase to address:** Phase building `/adi:contributors`

---

### Pitfall 4: summary Skill Calling Other Scripts via Bash Doubles the API Call Count

**What goes wrong:**

The natural implementation of `/adi:summary` is for the SKILL.md to instruct Claude to run each of the four sibling scripts in sequence:

```bash
node "$PLUGIN_ROOT/scripts/pr-metrics.mjs"
node "$PLUGIN_ROOT/scripts/contributors.mjs"
node "$PLUGIN_ROOT/scripts/bugs.mjs"
node "$PLUGIN_ROOT/scripts/sprint.mjs"
```

This pattern works but creates a compounding rate-limit problem. Each script makes its own independent API calls. Running all four in a `/adi:summary` session makes approximately 4x the Azure DevOps API calls as a single skill. On teams with active ADO usage, this is likely to hit TSTU limits (200 TSTUs per 5-minute window) and cause the later scripts to slow down or time out.

Additionally, Claude's context grows by the JSON output of all four scripts. At 2–4KB each, this is manageable, but must be verified against large projects (many repos, large sprints).

**Why it happens:**

Code reuse instinct: "just call the scripts we already wrote." This is correct for simplicity but ignores the additive API cost.

**How to avoid:**

- Document the expected API call count per script in each script's header comment
- In the summary SKILL.md, run the four scripts sequentially (not in parallel), with progress updates between each: "Fetching PR data... Fetching contributor data..." — this also helps users see progress on what can be a 15–30 second operation
- Add a `--summary` flag to each script that reduces the output size (e.g., top-3 contributors only, no full stale PR list) so the JSON passed to Claude is smaller when called from summary context
- Do not run all scripts with `Promise.all` or via background processes — sequential is safer under rate limits

**Warning signs:**

- Summary SKILL.md launches all four scripts simultaneously in a single bash invocation
- No progress messaging between script runs — user sees nothing for 20+ seconds

**Phase to address:** Phase building `/adi:summary`

---

### Pitfall 5: /adi:update Overwrites Plugin Files — Must Not Touch ~/.adi/config.json

**What goes wrong:**

The self-update mechanism for `/adi:update` will likely use `git pull` (or equivalent) in the plugin install directory to fetch new skill files, scripts, and manifests. If the update logic is not scoped precisely to the plugin directory, it can:

1. Accidentally attempt to overwrite `~/.adi/config.json` if the update logic confuses the plugin install path with the config path
2. Leave old cached plugin versions in `~/.claude/plugins/cache/...` pointing to outdated scripts (confirmed GitHub issue #15642 in the Claude Code repo)
3. Fail silently if the plugin was installed from a marketplace zip (no git remote to pull from) versus a git clone

**Why it happens:**

The plugin install path (`installPath` in `installed_plugins.json`) is separate from `~/.adi/config.json`. But if the update script uses a relative path, cwd assumptions, or an imprecise glob, it can reach outside the plugin directory. Also: the existing `installed_plugins.json` resolver already shows that path resolution is fragile (hence the complex resolver one-liner in every SKILL.md).

**How to avoid:**

- `update.mjs` must resolve and validate the plugin root using the same `installed_plugins.json` resolver pattern already established
- Before any file write, assert that the resolved path contains a recognizable plugin marker (`plugin.json` or `marketplace.json`) — abort if not found
- `~/.adi/config.json` is not in the plugin directory and must never be in scope for update operations
- The update mechanism should prefer `git fetch + git reset --hard origin/main` over `git pull` (avoids merge conflicts if user modified files)
- After update, display the diff of `CHANGELOG.md` between old and new versions as the changelog
- Warn the user: "You must restart Claude Code for updated skills to take effect" (the CLAUDE_PLUGIN_ROOT stale cache issue means running scripts may still point to old versions in the same session)

**Warning signs:**

- `update.mjs` uses `process.cwd()` instead of the resolved plugin root
- No validation that the target directory is the plugin before writing
- No post-update message telling the user to restart Claude Code

**Phase to address:** Phase building `/adi:update`

---

### Pitfall 6: WIQL Bug Query Without Date Filter Hits the 20,000 Work Item Hard Cap

**What goes wrong:**

A WIQL query for bugs without a date filter will attempt to return all bugs ever created in the project. Projects with more than 20,000 work items total will fail with `VS402337`. This error is not a soft limit — you cannot paginate past it. The entire query fails.

Even projects under 20,000 total items can have thousands of bugs accumulated over years. An unbounded bug query will return stale data from 3+ years ago, which pollutes the "oldest unresolved bug" metric and makes the report feel wrong to the user.

**Why it happens:**

"Show me all open bugs" sounds like a reasonable query, and the WIQL syntax makes it easy to write. The cap is a project-wide constraint that only surfaces on mature or large projects — it passes in testing on small projects.

**How to avoid:**

- Default WIQL filter: `AND [System.CreatedDate] >= @today - 180` — bugs created in the last 6 months
- For "oldest unresolved" metric: make a separate query ordering by `[System.CreatedDate] ASC` with `$top=5`
- Add `--days` flag to `bugs.mjs` (mirrors `pr-metrics.mjs` convention) so users can expand the window
- Cap total results at 500 items via WIQL `$top=500` — more than enough for actionable reporting

**Warning signs:**

- `bugs.mjs` runs a WIQL query with no date condition
- WIQL query has no `$top` limit

**Phase to address:** Phase building `/adi:bugs`

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copy-paste the PLUGIN_ROOT resolver one-liner into each new SKILL.md | Gets new skills working quickly | 5+ SKILL.md files all contain the same fragile 200-character one-liner; any fix must be applied in 5 places | Acceptable for v1.1 since the resolver works; add extraction note to backlog |
| Using `adoGet` (the v1.0 orphaned export) instead of the dedicated functions | Fewer lines to write | `adoGet` uses implicit `loadConfig()` — breaks if called with a config override; causes subtle bugs in summary skill which may want to pass a modified config | Never acceptable — only use the dedicated functions |
| Hardcoding `"Bug"` as the work item type in bugs.mjs | Works for most teams | Teams using custom work item types ("Defect", "Issue") get zero results with no explanation | Acceptable for v1.1 with a user-visible note; add `--type` flag in v1.2 |
| Skipping `--summary` mode flag and always outputting full data | Less code per script | Summary skill receives 4x full JSON payloads; context grows; rate limit exposure increases | Not acceptable — add summary flag before shipping `/adi:summary` |
| Using `searchCriteria.author` string match for contributor filtering | Simple to implement | String match is partial/fuzzy; "John" matches "John Smith" and "John Doe"; use email identity for deduplication instead | Never acceptable for contributor aggregation |

---

## Integration Gotchas

Common mistakes when connecting to external services or sibling scripts.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ADO Iterations API | Calling `teamsettings/iterations` without team segment | Include `{team}` in path; default to project name as team slug |
| ADO Work Items Batch | Calling GET with IDs in query string | Use POST to `_apis/wit/workitemsbatch` with body `{ ids: [...], fields: [...] }` |
| ADO Commits API | Expecting cross-repo results from a single call | Loop all repos from `adoGetRepos()`, aggregate by author email |
| ADO WIQL | No date filter on work item queries | Always include `@today - N` filter; use `$top` cap |
| Summary → sibling scripts | Parallel Bash execution of all four scripts | Sequential execution with progress messages; each script is an independent API session |
| Update → plugin files | Using `process.cwd()` or relative paths in update.mjs | Resolve plugin root from `installed_plugins.json`; validate with plugin marker file check |
| Update → config.json | Broad file writes during update | Scope writes explicitly to plugin directory; assert path before every write |
| Post-update session | Expecting updated scripts to be active immediately | Warn user to restart Claude Code; CLAUDE_PLUGIN_ROOT may point to stale cache until session restart |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Looping repos for contributor commits without rate-limit pacing | Scripts timeout after 30–60 seconds on projects with 10+ repos | Batch repo loops with sleep between groups; use existing `fetchAllThreads` pattern from pr-metrics.mjs | Projects with 5+ repos and 30-day window |
| Fetching full commit objects to count contributors | Slow response; large JSON in context | Only request commit count fields; use `$top` to cap per-repo; aggregate counts, not raw commits | Projects with >500 commits in window |
| Summary skill concatenating raw JSON from 4 scripts | Context window grows to 20KB+; Claude narration quality degrades | Each script outputs a compact summary-mode payload when called from summary context | Projects with 10+ repos, 200+ work items |
| Work item batch calls with IDs from a large sprint | Batches of 200 return slowly; sprint script times out | Sprint script should cap sprint work items at 100 for reporting; flag if sprint is larger | Sprints with >100 items |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| update.mjs writing to paths derived from user-supplied input | Path traversal if a malicious `installed_plugins.json` exists | Resolve path from known system file; validate result contains plugin marker before write |
| Displaying full PAT in error messages during update | PAT leaks into Claude conversation context | Always use `maskPat()` from `config.mjs` when displaying any credential-related value |
| update.mjs fetching the changelog from a user-controlled URL | Open redirect / SSRF if org URL is malicious | Changelog is read from the local plugin directory after update, not fetched remotely |
| Logging config values to stderr during script execution | PAT appears in stderr which may be captured in logs | Scripts must never write config fields to stderr; only write progress messages like "Fetching sprint data..." |

---

## UX Pitfalls

Common user experience mistakes specific to this skill pack.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| summary skill showing "Loading..." then silent for 30 seconds | User thinks Claude crashed or hung | Show per-script progress: "Fetching PR data (1/4)... Fetching contributor data (2/4)..." |
| bugs.mjs returning "no bugs found" when the team uses "Defect" type | User assumes the skill is broken | Output "Queried work item type: Bug. If your team uses a different type, use `--type=Defect`." |
| sprint.mjs returning empty when no team is configured | Cryptic 404 error or empty sprint | Output: "No sprint found for default team. If your project uses custom teams, run with `--team=<name>`." |
| update skill showing git hash as "changelog" | Users can't interpret a SHA as meaningful output | Read and display the diff of CHANGELOG.md sections between old and new version |
| contributors.mjs counting merge commit authors as contributors | Bot/automation accounts appear in contributor list | Filter out commits where `author.name` contains "[bot]", "Build", or matches the org's automation patterns — or add a `--exclude` flag |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **sprint.mjs:** Sprint work item references fetched but work item details (state, title, story points) not fetched via batch — verify `System.State` and `System.Title` appear in output JSON
- [ ] **sprint.mjs:** `$timeframe=current` returns empty array when the team has no active sprint configured — verify graceful "No active sprint" message, not a crash
- [ ] **contributors.mjs:** Single-repo projects work; test with a multi-repo project to verify loop and deduplication produce correct counts
- [ ] **contributors.mjs:** Author deduplication uses email, not display name — verify by checking for two contributors with similar names
- [ ] **bugs.mjs:** Default work item type filter is "Bug" — verify with a team using "Defect" produces a clear message, not silent empty results
- [ ] **bugs.mjs:** WIQL query includes date filter — verify by adding `console.error(wiqlQuery)` during development and inspecting it
- [ ] **summary skill:** Runs all four scripts in sequence with progress messages — verify by timing; if under 5 seconds total, scripts are probably not actually running
- [ ] **/adi:update:** After update, existing Claude session still uses old scripts — verify by checking version output; warn user in post-update message
- [ ] **/adi:update:** Config at `~/.adi/config.json` survives update unchanged — verify by checking `orgUrl`, `project`, and masked PAT before and after update
- [ ] **All new skills:** Step 0 config guard uses same `installed_plugins.json` resolver pattern as `pr-metrics` — verify by copying the exact pattern, not re-implementing it

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Sprint API 404 due to missing team segment | LOW | Add `{team}` to URL; default to project name slug; test |
| Work item batch returns IDs but no details | LOW | Add POST batch call after relation fetch; add `adoPost` helper to ado-client.mjs |
| Contributors under-count due to single-repo loop | MEDIUM | Rewrite loop to iterate all repos; re-verify aggregation logic |
| Summary skill hits rate limits on large project | MEDIUM | Add sequential execution with progress messages; add `--summary` flag to each script |
| Update overwrites user config | HIGH | Add config path assertion before any write; restore from backup; document recovery steps in README |
| Post-update scripts use stale cache | LOW | Tell user to restart Claude Code; document in update output |
| WIQL cap hit on bug query | LOW | Add date filter and `$top` cap; rerun |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Sprint API team-segment URL structure (Pitfall 1) | Phase building `/adi:sprint` | Confirm URL pattern in sprint.mjs before any test run |
| Work item batch second call required (Pitfall 2) | Phase building `/adi:sprint` | Output JSON must contain `System.State` and `System.Title` |
| Contributors per-repo loop required (Pitfall 3) | Phase building `/adi:contributors` | Test against project with 3+ repos; verify cross-repo aggregation |
| Summary additive API cost (Pitfall 4) | Phase building `/adi:summary` | Run summary on large project; confirm no rate limit errors; confirm sequential progress output |
| Update must not touch config.json (Pitfall 5) | Phase building `/adi:update` | Before-after config comparison test in acceptance criteria |
| WIQL unbounded bug query (Pitfall 6) | Phase building `/adi:bugs` | Inspect WIQL string in script; confirm date filter and $top present |
| adoGet orphan reuse | All new script phases | Code review: grep for `adoGet(` — should only appear in `ado-client.mjs` export, not in new scripts |
| Post-update stale cache | Phase building `/adi:update` | Post-update message explicitly tells user to restart Claude Code |

---

## Sources

- [Azure DevOps Iterations API — List](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.1) — confirmed team segment required in URL path; `$timeframe=current` supported
- [Azure DevOps Iterations API — Get Iteration Work Items](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/get-iteration-work-items?view=azure-devops-rest-7.1) — confirmed returns `workItemRelations[]` with IDs only, not full work item data
- [Azure DevOps Git Commits API — Get Commits](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits?view=azure-devops-rest-7.1) — confirmed per-repository scope; supports `searchCriteria.fromDate` and `searchCriteria.author`
- [Azure DevOps WIQL — Query By Wiql](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1) — 20,000 item hard cap, VS402337 error
- [Azure DevOps Work Item Limits](https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/object-limits?view=azure-devops) — 20K WIQL limit confirmed
- [Claude Code Plugin Cache Stale Issue #15642](https://github.com/anthropics/claude-code/issues/15642) — CLAUDE_PLUGIN_ROOT points to old version after update; confirmed workaround is session restart / cache cleanup
- [Azure DevOps Rate Limits](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rate-limits?view=azure-devops) — 200 TSTUs per 5-minute window; progressive throttling under load
- v1.0 codebase — `scripts/ado-client.mjs`: confirmed `adoGet` orphan exists alongside 4 dedicated functions; all existing calls use dedicated functions; new scripts must follow the same pattern
- v1.0 codebase — `skills/pr-metrics/SKILL.md`: confirmed `installed_plugins.json` resolver pattern; same pattern must be used verbatim in all new SKILL.md files

---

*Pitfalls research for: Azure DevOps Insights v1.1 — adding contributors, bugs, sprint, summary, update skills*
*Researched: 2026-02-25*
