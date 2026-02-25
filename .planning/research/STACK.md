# Technology Stack

**Project:** Azure DevOps Insights — v1.1 New Skills
**Researched:** 2026-02-25
**Confidence:** HIGH (all endpoints verified against official Microsoft Learn docs at api-version 7.1)

---

## Scope of This Document

This document covers ONLY the new technical surface area introduced by v1.1. The v1.0 stack
(Node.js ESM .mjs, native fetch, PAT auth, zero npm deps, plugin manifest) is already validated
and documented. Do not re-research it.

New surface area: five API service areas, two new Node.js aggregation patterns, and the
self-update mechanism.

---

## New API Endpoints by Skill

### /adi:contributors — Git Commits API

**Why this endpoint:** PR reviewers (already collected) tell half the story. Commit activity
per author tells the other half — who is actually merging code vs. who is just reviewing.
Combining commit frequency with PR authorship gives the "active/quiet" signal.

**Endpoint:**
```
GET https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/commits
    ?api-version=7.1
    &searchCriteria.fromDate={ISO8601}
    &searchCriteria.$top=1000
```

**Required PAT scope:** `Code (Read)` — already required by /adi:setup for repo listing.

**Key response fields (GitCommitRef[]):**
```json
{
  "commitId": "9991b4f...",
  "author": {
    "name": "Alice Smith",
    "email": "alice@example.com",
    "date": "2026-02-01T10:00:00Z"
  },
  "committer": {
    "name": "Alice Smith",
    "email": "alice@example.com",
    "date": "2026-02-01T10:00:00Z"
  },
  "comment": "Fix login redirect"
}
```

**Implementation notes:**
- Must iterate per-repo (endpoint requires a `repositoryId`). Use existing `adoGetRepos` to
  enumerate repos first, then fan-out per repo.
- Use `searchCriteria.author` for per-author filtering OR fetch all and group by
  `author.email` in Node.js (grouping in JS is simpler than N per-author API calls).
- `author.date` is the commit date; `committer.date` is when it landed (merge commits diverge).
  Use `author.date` for "who wrote it" and `committer.date` for "when it merged".
- Pagination: use `searchCriteria.$top=1000` and `searchCriteria.$skip=N`. Follow the existing
  `fetchPagedPrs` pattern from pr-metrics.mjs.
- "Gone quiet" definition: author has commits in the prior window but zero in the recent window.
  Use a two-window fetch (e.g., 30-day recent vs. 90-day full) to identify regression.

**Confidence: HIGH** — Endpoint verified at
https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits?view=azure-devops-rest-7.1

---

### /adi:bugs — Work Item Tracking (WIQL + Batch)

**Why this approach:** There is no single "get all bugs" endpoint. Azure DevOps work items
require a two-step flow: (1) run a WIQL query to get matching IDs, (2) batch-fetch the full
work item records with specific fields. WIQL is the only way to filter by work item type
and state server-side.

**Step 1 — WIQL query (POST):**
```
POST https://dev.azure.com/{org}/{project}/_apis/wit/wiql?api-version=7.1
     &$top=500

Body: {
  "query": "SELECT [System.Id] FROM WorkItems
            WHERE [System.WorkItemType] = 'Bug'
            AND [System.State] <> 'Closed'
            AND [System.State] <> 'Resolved'
            ORDER BY [Microsoft.VSTS.Common.Severity] ASC,
                     [System.CreatedDate] ASC"
}
```

Response shape:
```json
{
  "queryType": "flat",
  "workItems": [
    { "id": 300, "url": "..." },
    { "id": 299, "url": "..." }
  ]
}
```

**Step 2 — Work Items Batch (POST):**
```
POST https://dev.azure.com/{org}/{project}/_apis/wit/workitemsbatch?api-version=7.1

Body: {
  "ids": [300, 299, 298],
  "fields": [
    "System.Id",
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "Microsoft.VSTS.Common.Severity",
    "Microsoft.VSTS.Common.Priority",
    "System.Tags"
  ],
  "errorPolicy": "omit"
}
```

Response shape:
```json
{
  "count": 3,
  "value": [
    {
      "id": 300,
      "fields": {
        "System.Id": 300,
        "System.Title": "Login fails on mobile Safari",
        "System.State": "Active",
        "System.CreatedDate": "2025-11-01T00:00:00Z",
        "System.AssignedTo": { "displayName": "Alice", "id": "..." },
        "Microsoft.VSTS.Common.Severity": "2 - High",
        "Microsoft.VSTS.Common.Priority": 1
      }
    }
  ]
}
```

**Required PAT scope:** `Work Items (Read)` — must be added to /adi:setup scope validation.
This is a NEW scope requirement not present in v1.0.

**Key field reference names:**
| Friendly Name | Reference Name |
|--------------|----------------|
| Severity | `Microsoft.VSTS.Common.Severity` |
| Priority | `Microsoft.VSTS.Common.Priority` |
| State | `System.State` |
| Created Date | `System.CreatedDate` |
| Assigned To | `System.AssignedTo` (returns identity object with `displayName`) |
| Title | `System.Title` |

**Severity values** (standard ADO process templates): `"1 - Critical"`, `"2 - High"`,
`"3 - Medium"`, `"4 - Low"`. Custom process templates may differ — treat as opaque strings
and group by value.

**Batch size limit:** 200 IDs per batch call (hard API limit). Must chunk arrays of IDs.
Pattern: `for (let i=0; i<ids.length; i+=200) { batch(ids.slice(i,i+200)) }`.

**Important:** WIQL `$top` parameter caps at 20,000. For projects with >500 open bugs, this
is sufficient. No pagination needed for the WIQL step; the batch step handles chunking.

**Confidence: HIGH** — Both endpoints verified at Microsoft Learn 7.1 docs.

---

### /adi:sprint — Work/Iterations API

**Why this approach:** Sprint data lives in the Work API (not the Work Item Tracking API).
Getting sprint completion requires three steps: (1) discover the default team, (2) get current
iteration for that team, (3) get work items assigned to that iteration, (4) enrich with state
via the batch endpoint.

**Step 1 — Get default team ID:**
```
GET https://dev.azure.com/{org}/_apis/projects/{project}?api-version=7.1
    &includeCapabilities=false
```

Response includes `defaultTeam.id` (UUID) and `defaultTeam.name`.

The `{team}` path parameter in the iterations API can be omitted if the default team matches
what the user expects. However, using the explicit default team ID is more reliable across
projects with custom team configurations.

**Step 2 — Get current iteration:**
```
GET https://dev.azure.com/{org}/{project}/{team}/_apis/work/teamsettings/iterations
    ?api-version=7.1
    &$timeframe=current
```

`{team}` can be the team name (URL-encoded) or team ID. Use `defaultTeam.name` from Step 1.

Response — `TeamSettingsIteration[]`:
```json
{
  "values": [
    {
      "id": "a589a806-bf11-4d4f-a031-c19813331553",
      "name": "Sprint 47",
      "attributes": {
        "startDate": "2026-02-17T00:00:00Z",
        "finishDate": "2026-02-28T00:00:00Z",
        "timeFrame": "current"
      }
    }
  ]
}
```

Note: `values` key (not `value`) is used in this response. This is an inconsistency in the
ADO API — most list endpoints use `value`, but teamsettings uses `values`.

**Step 3 — Get iteration work items (IDs only):**
```
GET https://dev.azure.com/{org}/{project}/{team}/_apis/work/teamsettings/iterations
    /{iterationId}/workitems?api-version=7.1
```

Response `workItemRelations[]` contains `target.id` for each work item. Use these IDs with
the batch endpoint (Step 4) to get state and story points.

**Step 4 — Batch fetch sprint work items:**
Same `workitemsbatch` endpoint as /adi:bugs, with fields:
```json
{
  "ids": [...],
  "fields": [
    "System.Id",
    "System.Title",
    "System.WorkItemType",
    "System.State",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Scheduling.RemainingWork",
    "System.AssignedTo"
  ],
  "errorPolicy": "omit"
}
```

**Velocity calculation:** Sprint velocity = sum of `StoryPoints` for completed items
(`System.State` in `["Done", "Closed", "Resolved"]`). Fetch 3 prior iterations
(`$timeframe` not set, take last 3 by `finishDate`) and average their completed story
points to get baseline velocity.

**Required PAT scope:** `Work Items (Read)` — same new scope as /adi:bugs.

**Team discovery fallback:** If the project has no `defaultTeam` or if team name contains
characters that break URL encoding, use the org-level teams list:
```
GET https://dev.azure.com/{org}/_apis/teams?api-version=7.1-preview.3
    &$mine=true&$top=10
```
Note this endpoint is still in preview (7.1-preview.3) — use it only as fallback.

**Confidence: HIGH** — All iteration endpoints verified at Microsoft Learn 7.1 docs.

---

### /adi:summary — Aggregation Pattern (No New Endpoints)

**Why no new endpoints:** Summary calls the existing three data scripts and aggregates their
JSON outputs. It does not make its own API calls. This is intentional — re-use, do not
duplicate.

**Implementation pattern:**
The SKILL.md for /adi:summary runs three Node.js scripts sequentially and receives three JSON
payloads. Claude then synthesizes a single narrative.

```bash
# In SKILL.md, run all three:
node "$PLUGIN_ROOT/scripts/pr-metrics.mjs"
node "$PLUGIN_ROOT/scripts/contributors.mjs"
node "$PLUGIN_ROOT/scripts/bugs.mjs"
node "$PLUGIN_ROOT/scripts/sprint.mjs"
```

Alternatively, a single `summary.mjs` orchestrator script can spawn child processes and merge
outputs into one JSON object. The orchestrator approach reduces the number of Bash steps in
the SKILL.md and gives a single JSON for Claude to narrate.

**Recommended: orchestrator script (`summary.mjs`)** using `child_process.execFile` to run
the other scripts and `JSON.parse` their stdout. This keeps SKILL.md simple (one Bash step)
while providing a single structured object.

```javascript
// Pattern in summary.mjs
import { execFile } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execFile);

const [prResult, contribResult, bugsResult, sprintResult] = await Promise.all([
  exec('node', ['pr-metrics.mjs']).then(r => JSON.parse(r.stdout)),
  exec('node', ['contributors.mjs']).then(r => JSON.parse(r.stdout)),
  exec('node', ['bugs.mjs']).then(r => JSON.parse(r.stdout)),
  exec('node', ['sprint.mjs']).then(r => JSON.parse(r.stdout)),
]);
console.log(JSON.stringify({ prMetrics: prResult, contributors: contribResult,
                              bugs: bugsResult, sprint: sprintResult }));
```

**`child_process` and `util` are both Node.js built-ins** — no npm dependencies.

**Confidence: HIGH** — Node.js built-in modules; no external sources needed.

---

### /adi:update — Self-Update Mechanism

**The gap:** Claude Code has no native "update installed plugin" automatic flow. Plugins are
pinned to the commit SHA at install time. `claude plugin update` exists but requires manual
invocation by the user outside Claude. The `/adi:update` skill bridges this.

**Mechanism — git pull in the plugin install directory:**

The plugin is installed as a Git-cloned directory. The simplest update is `git pull` inside
that directory. The SKILL.md already resolves `PLUGIN_ROOT` via the installed_plugins.json
lookup. The same pattern applies here.

```bash
# In SKILL.md for /adi:update:
PLUGIN_ROOT=`node -e "..."` && git -C "$PLUGIN_ROOT" pull --ff-only
```

`git -C <dir>` sets the working directory, so no `cd` is needed. `--ff-only` prevents
accidental merge commits if the user has local modifications.

**Version display — CHANGELOG.md read:**
After the pull, read `CHANGELOG.md` from the plugin root and surface the top section (most
recent version notes) to the user. Node.js `fs.readFileSync` reads the file; Claude extracts
and formats the newest changelog entry.

**Version check (optional, no API needed):** Read `version` from
`.claude-plugin/plugin.json` (local) and compare to the GitHub releases API:
```
GET https://api.github.com/repos/{owner}/{repo}/releases/latest
```
This endpoint is unauthenticated, returns JSON with `tag_name` and `body` (release notes).
Rate limit: 60 requests/hour unauthenticated. Acceptable for an on-demand update check.

**The SKILL.md flow:**
1. Resolve `PLUGIN_ROOT` (existing pattern).
2. Run `git -C "$PLUGIN_ROOT" fetch --dry-run` — check if updates are available.
3. If up to date: tell user "Already on latest version."
4. If updates available: run `git -C "$PLUGIN_ROOT" pull --ff-only`.
5. Read `CHANGELOG.md` from `PLUGIN_ROOT` and display the most recent entry.
6. Tell user to restart Claude Code for changes to take effect.

**Required tools in SKILL.md frontmatter:**
```yaml
allowed-tools: Bash(node *), Bash(git *)
```

Git is available on any system where Claude Code is installed (Claude Code itself requires Git
for its own update mechanism).

**What NOT to do:** Do not call `npm install` or run a build step. This project has zero
dependencies by design. A `git pull` is sufficient because all scripts are plain .mjs files.

**Confidence: MEDIUM** — The `git -C <dir> pull` mechanism is standard Git and works on all
platforms. The `allowed-tools: Bash(git *)` allowlist pattern is inferred from the existing
`Bash(node *)` pattern in pr-metrics/SKILL.md; this should be verified during implementation
against the actual Claude Code tool allowlist syntax.

---

## New PAT Scopes Required

v1.0 required: `Project and Team (Read)`, `Code (Read)`

v1.1 adds: `Work Items (Read)` — required for /adi:bugs and /adi:sprint.

The /adi:setup skill must be updated to validate the new scope. The setup validation pattern
(attempt a known API call and check for 403) should add:
```
GET {org}/{project}/_apis/wit/workItems/1?api-version=7.1
```
A 403 on this call means `Work Items (Read)` is missing.

---

## New Functions Needed in ado-client.mjs

The existing `adoGet` function is orphaned (implicit loadConfig, inconsistent with the 4
dedicated functions). New functions should follow the dedicated-function pattern: explicit
`config` parameter, no internal `loadConfig` call.

| Function Name | Purpose | HTTP Method |
|---------------|---------|-------------|
| `adoGetCommits(config, repoId, params)` | Fetch commits for one repo | GET |
| `adoWiql(config, query, top)` | Run WIQL query, return ID list | POST |
| `adoGetWorkItemsBatch(config, ids, fields)` | Batch-fetch work items by ID array | POST |
| `adoGetIterations(config, teamName, timeframe)` | Get team iterations | GET |
| `adoGetIterationWorkItems(config, teamName, iterationId)` | Get work item IDs in sprint | GET |
| `adoGetProject(config)` | Get project details including defaultTeam | GET |

**POST requests in ado-client.mjs:** The existing functions are all GET. The WIQL and
batch endpoints require POST with `Content-Type: application/json` and a JSON body.
The `fetch` call changes to:
```javascript
response = await fetch(url.toString(), {
  method: 'POST',
  headers: {
    'Authorization': buildAuthHeader(config.pat),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});
```
This is the only new pattern vs. existing GET functions.

---

## Aggregation Patterns (Node.js)

### Grouping by field value (contributors, bugs by severity)

```javascript
// Group commits by author email
const byAuthor = commits.reduce((acc, commit) => {
  const key = commit.author.email;
  if (!acc[key]) acc[key] = { name: commit.author.name, commits: [] };
  acc[key].commits.push(commit);
  return acc;
}, {});
```

This pattern is already used in pr-metrics.mjs for reviewer distribution. Apply the same
pattern for commit authors and bug severity grouping.

### Chunking arrays for batch API limits

```javascript
// Chunk IDs into batches of 200 (hard API limit)
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
const batches = chunk(workItemIds, 200);
const results = await Promise.all(batches.map(ids => adoGetWorkItemsBatch(config, ids, fields)));
const allItems = results.flatMap(r => r.value || []);
```

### Two-window activity comparison (contributors)

```javascript
// Fetch 90-day window, then identify who has no commits in recent 30 days
const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
// activeInLast30 = authors with commit.author.date >= thirtyDaysAgo
// quietSince30   = authors with commits in 90d window but none in 30d window
```

---

## What NOT to Add

| Temptation | Why Not |
|-----------|---------|
| Azure DevOps Analytics OData | Cloud-only, different auth model, different query language. Explicitly out of scope (PROJECT.md). Deferred to v2. |
| Work item history / revisions | Adds significant API call volume. Not needed for the stated goals of bug trends (created date is sufficient). |
| Board columns / swimlane state | Board configuration varies per team/process. Stick to `System.State` which is universal. |
| GraphQL / VSTS client library | Adds dependencies. All needed data is reachable via REST. |
| Webhooks or polling | Out of scope; v1 is on-demand only (PROJECT.md). |
| Writing back to ADO (resolving bugs, etc.) | Out of scope; v1 is read-only (PROJECT.md). |
| `npm install` in /adi:update | Project is zero-dependency. `git pull` is sufficient. Never add a build step. |

---

## Version Compatibility

| API Endpoint | API Version | Status | Notes |
|-------------|-------------|--------|-------|
| `git/repositories/{id}/commits` | 7.1 | GA | Use for contributors |
| `wit/wiql` | 7.1 | GA | Use for bug queries |
| `wit/workitemsbatch` | 7.1 | GA | Use for work item batch fetch |
| `work/teamsettings/iterations` | 7.1 | GA | Use for sprint data |
| `work/teamsettings/iterations/{id}/workitems` | 7.1 | GA | Use for sprint item IDs |
| `projects/{project}` | 7.1 | GA | Use for defaultTeam discovery |
| `_apis/teams` | 7.1-preview.3 | Preview | Use only as fallback for team discovery |

All GA endpoints confirmed at Microsoft Learn api-version=7.1 as of 2026-02-25.
The `_apis/teams` preview endpoint has been stable since v4.1 — low risk.

---

## Sources

- [Git Commits API (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits?view=azure-devops-rest-7.1) — endpoint, params, GitCommitRef shape (HIGH confidence)
- [WIQL Query By Wiql (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1) — POST endpoint, request body, WorkItemQueryResult shape (HIGH confidence)
- [Work Items Batch GET (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-items-batch?view=azure-devops-rest-7.1) — POST endpoint, field list, 200-item limit (HIGH confidence)
- [Work Iterations List (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.1) — GET endpoint, `$timeframe=current`, TeamSettingsIteration shape (HIGH confidence)
- [Work Iterations Get Work Items (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/get-iteration-work-items?view=azure-devops-rest-7.1) — GET endpoint, IterationWorkItems shape, `workItemRelations` array (HIGH confidence)
- [Projects Get (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/get?view=azure-devops-rest-7.1) — `defaultTeam` field in TeamProject (HIGH confidence)
- [Teams Get All Teams (7.1-preview.3)](https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-all-teams?view=azure-devops-rest-7.1) — fallback team discovery, WebApiTeam shape (HIGH confidence)
- [Keeping Claude Code plugins up to date](https://workingbruno.com/notes/keeping-claude-code-plugins-date) — confirms no native auto-update for plugins; git pull approach is the practical mechanism (MEDIUM confidence)
- [GitHub Releases API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) — `GET /repos/{owner}/{repo}/releases/latest` unauthenticated, 60 req/hour (HIGH confidence)
- Existing `ado-client.mjs` and `pr-metrics.mjs` — established patterns for pagination, error types, config loading (HIGH confidence — source code)

---
*Stack research for: Azure DevOps Insights v1.1 new skills*
*Researched: 2026-02-25*
