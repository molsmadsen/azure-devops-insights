# Phase 3: Activity Skills - Research

**Researched:** 2026-02-26
**Domain:** Azure DevOps REST API — contributors and bugs analysis skills
**Confidence:** HIGH

## Summary

Phase 3 ships two new Azure DevOps analysis skills (`/adi:contributors` and `/adi:bugs`) that follow the proven pr-metrics pattern: a Node.js script fetches data via the ADO REST API, computes metrics, emits JSON to stdout, and a SKILL.md instructs Claude to narrate the results. The codebase already has all infrastructure needed — `ado-client.mjs` for HTTP, `config.mjs` for auth, and the SKILL.md/script pattern validated in v1.0.

The contributors skill introduces two new API surfaces: the Git Commits endpoint (per-repository, requiring multi-repo aggregation) and the Teams Members endpoint (for cross-referencing active commit authors against team rosters to distinguish quiet members from former contributors). The bugs skill introduces the Work Item Tracking API surface: WIQL POST queries for ID retrieval, then batch POST for work item detail enrichment. Both POST endpoints are a departure from the GET-only pattern in the current `ado-client.mjs` — new helper functions must handle `method: 'POST'` with JSON bodies.

The `--types` flag for bugs (configurable work item types, defaulting to "Bug") and the `--anonymous` flag for contributors are new per-skill flags that extend the established `--days`/`--repo` pattern. The `anonymous` setting is also persistable in `~/.adi/config.json`, making it the first config.json change since v1.0.

**Primary recommendation:** Build contributors first (same Git API surface as pr-metrics, lower risk), then bugs (introduces WIQL/batch pattern). Extend `ado-client.mjs` with new functions before writing either skill script.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three categories of contributors: **active** (commits in window), **quiet** (on team but no recent commits), **former** (committed but no longer on team)
- Cross-reference commit authors against Azure DevOps Teams API to distinguish quiet team members from former contributors
- Separate narrative sections for quiet members and former contributors
- No bus factor analysis (deferred — requires per-path commit analysis, too many API calls)
- No anomaly detection / spike-drop comparison (keep it simple — active vs quiet vs former is enough)
- Snapshot of current open bugs, not trend over time (no opened-vs-closed comparison)
- Dimensions covered: severity breakdown, age of open bugs, assignment distribution (who has bugs, who's overloaded, unassigned bugs)
- Top 5 oldest unresolved bugs highlighted explicitly by name and age
- Configurable work item types: default to "Bug", override with `--types "Bug,Defect,Issue"` flag per invocation
- Types flag is skill-invocation only (not persisted in config.json)
- Names shown by default; `--anonymous` flag or `anonymous: true` in config.json hides names
- Risk framing for all findings — explicitly call out risks and recommend action
- Former contributors listed with simple factual framing — no interpretation about why they left
- Conditional recommendations section — only appears when actionable issues found (same pattern as pr-metrics)
- `--days 30` default, consistent with pr-metrics
- `--repo` optional filter, consistent with pr-metrics
- `--types` (bugs only) — configurable work item types, default "Bug"
- `--anonymous` (contributors only) — hide names; also settable as `anonymous: true` in `~/.adi/config.json`
- No new persistent config settings except `anonymous`

### Claude's Discretion
- Exact narrative structure and section ordering within each skill
- How to handle edge cases (zero bugs, zero contributors, API errors)
- Whether to show commit counts alongside contributor names or just active/quiet status

### Deferred Ideas (OUT OF SCOPE)
- Bus factor analysis (knowledge concentration per code path) — separate skill or future phase
- Anomaly detection (activity spikes/drops compared to prior period) — future enhancement
- Trend over time for bugs (opened vs closed) — could add later as `--trend` flag
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fetch` | Node 18+ | HTTP requests to ADO REST API | Zero-dependency constraint; already used by all v1.0 scripts |
| Node.js built-in `fs` | Node 18+ | Read/write `~/.adi/config.json` | Already used by `config.mjs` |
| Node.js built-in `Buffer` | Node 18+ | PAT Base64 encoding for Basic auth | Already used by `buildAuthHeader` in `ado-client.mjs` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `scripts/ado-client.mjs` | v1.0 (extended) | Shared HTTP + auth + error handling | All ADO API calls; extend with new exports |
| `scripts/config.mjs` | v1.0 | Config load/save/exists/mask | Config guard (`--check-config`); loading PAT and org URL |

### Alternatives Considered

None — the stack is locked by the zero-dependency constraint and established v1.0 patterns. No new libraries needed.

**Installation:**
```bash
# No installation needed — zero npm dependencies. All Node.js built-ins.
```

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
azure-devops-insights/
├── scripts/
│   ├── ado-client.mjs           # MODIFY: add adoGetCommits, adoGetTeamMembers, adoWiql, adoGetWorkItemsBatch
│   ├── config.mjs               # NO CHANGE (anonymous read comes from loadConfig)
│   ├── contributors.mjs         # NEW: fetch commits + team members, compute active/quiet/former
│   └── bugs.mjs                 # NEW: WIQL query + batch fetch, compute severity/age/assignment
├── skills/
│   ├── contributors/SKILL.md    # NEW: Claude narration instructions for contributor data
│   └── bugs/SKILL.md            # NEW: Claude narration instructions for bug data
```

### Pattern 1: Skill Script — Established Internal Structure

**What:** Every new `.mjs` script follows the exact internal layout of `pr-metrics.mjs`.

**Key invariants:**
- `stdout` is JSON only. Progress messages go to `process.stderr.write(...)`.
- Import `loadConfig`, `configExists` from `./config.mjs`.
- Import named functions from `./ado-client.mjs` — never use the orphaned `adoGet`.
- Pass config explicitly to all `ado-client` functions.
- Support `--check-config` flag for the Step 0 guard.
- Wrap `main()` in `.catch(e => { console.log(JSON.stringify({ error: ... })); process.exit(1); })`.

**Example (script skeleton):**
```javascript
// scripts/contributors.mjs
import { loadConfig, configExists } from './config.mjs';
import { adoGetCommits, adoGetTeamMembers, adoGetRepos } from './ado-client.mjs';

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const eq = a.indexOf('='); return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), 'true']; })
);

if (args['check-config'] === 'true') {
  console.log(JSON.stringify({ configMissing: !configExists() }));
  process.exit(0);
}

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.log(JSON.stringify({ error: { type: 'config', message: e.message } }));
    process.exit(1);
  }
  // ... fetch + compute ...
  console.log(JSON.stringify(result));
}

main().catch(e => {
  console.log(JSON.stringify({ error: { type: 'unexpected', message: e.message } }));
  process.exit(1);
});
```

### Pattern 2: SKILL.md — Established Step Structure

**What:** Every SKILL.md follows the pr-metrics/SKILL.md template: YAML frontmatter, Step 0 config guard, Step 1 arg parsing, Step 2 fetch/compute, Step 3 narrative instructions.

**The PLUGIN_ROOT resolver one-liner must be copied verbatim** from `skills/pr-metrics/SKILL.md`:
```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/contributors.mjs" --check-config
```

**SKILL.md frontmatter:**
```yaml
---
name: contributors
description: AI-narrated contributor activity report for your Azure DevOps project.
disable-model-invocation: true
allowed-tools: Bash(node *)
---
```

### Pattern 3: ADO Client Extension — New Function Signatures

**What:** New ADO endpoints are added as named exports to `ado-client.mjs`. Config always passed explicitly.

**New functions for Phase 3:**

| Function | ADO Endpoint | HTTP Method | Used By |
|----------|-------------|-------------|---------|
| `adoGetCommits(config, repoId, params)` | `git/repositories/{repoId}/commits` | GET | `contributors.mjs` |
| `adoGetTeamMembers(config, projectId, teamId)` | `projects/{projectId}/teams/{teamId}/members` | GET | `contributors.mjs` |
| `adoGetProject(config)` | `projects/{project}` | GET | `contributors.mjs` (to get defaultTeam) |
| `adoWiql(config, query, top)` | `wit/wiql` | POST | `bugs.mjs` |
| `adoGetWorkItemsBatch(config, ids, fields)` | `wit/workitemsbatch` | POST | `bugs.mjs` |

**Critical: POST request pattern.** The existing `ado-client.mjs` only has GET functions. WIQL and workitemsbatch require POST. The new pattern:
```javascript
export async function adoWiql(config, query, top = 500) {
  const orgBase = config.orgUrl.replace(/\/$/, '');
  const url = new URL(`${orgBase}/${config.project}/_apis/wit/wiql`);
  url.searchParams.set('api-version', '7.1');
  if (top) url.searchParams.set('$top', String(top));
  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': buildAuthHeader(config.pat),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
  } catch (err) {
    throw Object.assign(new Error('Network error: cannot reach ' + config.orgUrl), { type: 'network' });
  }
  if (response.status === 401 || response.status === 203) {
    throw Object.assign(new Error('PAT rejected.'), { type: 'auth' });
  }
  if (response.status === 403) {
    throw Object.assign(new Error('PAT lacks Work Items (Read) permission.'), { type: 'permission' });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`WIQL query failed: ${response.status}`), { type: 'api' });
  }
  return response.json();
}
```

### Pattern 4: Multi-Repo Aggregation (Contributors)

**What:** The commits API is per-repository. Contributors must loop all repos, fetch commits per repo, and aggregate by author email.

**Flow:**
1. `adoGetRepos(config)` — list all repos (already exists)
2. For each repo (or filtered by `--repo`): `adoGetCommits(config, repoId, { 'searchCriteria.fromDate': ..., 'searchCriteria.$top': 1000 })`
3. Aggregate commits by `author.email` (not `author.name` — display names change, email is stable)
4. Deduplicate: merge entries with the same email, keep the most recent display name

**Rate limit concern:** Projects with 10+ repos will make 10+ API calls. Use sequential fetching (not parallel) with the existing batched pattern from `fetchAllThreads` in `pr-metrics.mjs`.

### Pattern 5: Team Cross-Reference (Contributors — Active vs Quiet vs Former)

**What:** Cross-reference commit authors against ADO Teams API to classify contributors into three categories.

**Flow:**
1. `adoGetProject(config)` — get `defaultTeam.id` and `defaultTeam.name`
2. `adoGetTeamMembers(config, config.project, teamId)` — get team member list with `identity.uniqueName` (email) and `identity.displayName`
3. Build a Set of team member emails
4. For each commit author:
   - Has commits in window AND is on team → **active**
   - Is on team but has zero commits in window → **quiet**
   - Has commits in window but is NOT on team → **former**

**API endpoint verified:**
```
GET https://dev.azure.com/{org}/_apis/projects/{projectId}/teams/{teamId}/members?api-version=7.1
```

**Response shape:**
```json
{
  "value": [
    {
      "isTeamAdmin": false,
      "identity": {
        "id": "3b5f0c34-...",
        "displayName": "Christie Church",
        "uniqueName": "fabrikamfiber1@hotmail.com"
      }
    }
  ],
  "count": 3
}
```

**PAT scope required:** `vso.project` (Project and Team Read) — already required by v1.0 setup.

**Matching strategy:** Match commit `author.email` against team member `identity.uniqueName`. Both are email addresses. Case-insensitive comparison required.

### Pattern 6: WIQL + Batch Two-Step (Bugs)

**What:** Bug data requires a two-step fetch: WIQL query returns IDs only, then batch POST retrieves full work item details.

**Flow:**
1. `adoWiql(config, wiqlQuery, 500)` — returns `{ workItems: [{ id, url }] }`
2. Extract IDs: `ids = result.workItems.map(wi => wi.id)`
3. Chunk into batches of 200 (hard API limit)
4. For each batch: `adoGetWorkItemsBatch(config, batchIds, fields)`
5. Flatten results: `allItems = batches.flatMap(r => r.value || [])`

**WIQL query (configurable types):**
```sql
SELECT [System.Id] FROM WorkItems
WHERE [System.WorkItemType] IN ('Bug')
  AND [System.State] NOT IN ('Closed', 'Resolved', 'Done')
  AND [System.TeamProject] = @project
ORDER BY [Microsoft.VSTS.Common.Severity] ASC, [System.CreatedDate] ASC
```

When `--types "Bug,Defect,Issue"` is provided, replace `IN ('Bug')` with `IN ('Bug','Defect','Issue')`.

**Fields to fetch in batch:**
```json
[
  "System.Id",
  "System.Title",
  "System.State",
  "System.CreatedDate",
  "System.ChangedDate",
  "System.AssignedTo",
  "Microsoft.VSTS.Common.Severity",
  "Microsoft.VSTS.Common.Priority",
  "System.Tags"
]
```

### Anti-Patterns to Avoid

- **Using `adoGet` (orphaned export):** Uses implicit `loadConfig()`. All new code must use named functions with explicit config. Documented in PROJECT.md as a known issue.
- **Writing progress to stdout:** `console.log('Fetching...')` breaks JSON parsing. Use `process.stderr.write(...)`.
- **Inline HTTP in skill scripts:** All `fetch()` calls belong in `ado-client.mjs`. Keeps 203/401/403 handling centralized.
- **Matching contributors by display name:** Display names change. Use `author.email` for deduplication and `identity.uniqueName` for team matching.
- **WIQL without $top or date filtering:** Hits 20,000 item hard cap on large projects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP auth + error handling | Custom fetch wrapper in each script | `ado-client.mjs` named exports | 203/401/403 error classification already implemented; one place to fix |
| Config loading + validation | Read config.json directly in script | `loadConfig()` / `configExists()` from `config.mjs` | Handles missing config with typed error; consistent across all scripts |
| Arg parsing | Full CLI parser (minimist, yargs) | Inline `Object.fromEntries` pattern from pr-metrics.mjs | Zero-dependency constraint; existing pattern handles all flag types needed |
| Work item ID batching | Custom chunking logic per script | Shared `chunk(arr, size)` utility or inline in `adoGetWorkItemsBatch` | 200-item batch limit is an API constraint; centralize it |
| PLUGIN_ROOT resolution | New resolver per skill | Copy the verbatim one-liner from pr-metrics SKILL.md | Resolver handles both marketplace and `--plugin-dir` installs; fragile if modified |

**Key insight:** The v1.0 codebase already has all shared infrastructure. Phase 3 adds new `ado-client.mjs` functions and new script+SKILL.md pairs. No new shared infrastructure is needed.

## Common Pitfalls

### Pitfall 1: Commits API Is Per-Repository — No Project-Wide Endpoint

**What goes wrong:** Developer expects a single call to return all contributors across all repos. Gets only one repo's data. Projects with multiple repos silently under-count contributors.
**Why it happens:** PR API has `adoGetPrsByProject` (project-scoped). Commits API does not — it requires `repositoryId` in the path.
**How to avoid:** `contributors.mjs` must enumerate repos via `adoGetRepos`, loop each, and aggregate by `author.email`.
**Warning signs:** Contributor counts don't match what developers see in the ADO web UI.

### Pitfall 2: Team Members Endpoint Returns `uniqueName` Not `email`

**What goes wrong:** Developer tries to match team members against commit authors using `identity.id` or `identity.displayName` — neither matches the commit's `author.email` field.
**Why it happens:** The Teams Members API returns an `IdentityRef` with `uniqueName` (which is the email/UPN) and `displayName` (which is the friendly name). The commits API returns `author.email`. The field names differ but the values match.
**How to avoid:** Match `commit.author.email.toLowerCase()` against `teamMember.identity.uniqueName.toLowerCase()`. Both are email addresses.
**Warning signs:** All contributors classified as "former" even though they're on the team.

### Pitfall 3: WIQL Query Without Date Filter Hits 20,000 Work Item Hard Cap

**What goes wrong:** A WIQL query for all bugs without date filtering attempts to return every bug ever created. Projects with >20,000 work items fail with `VS402337`.
**Why it happens:** "Show me all open bugs" sounds reasonable. The WIQL hard cap only surfaces on mature projects.
**How to avoid:** Always include `$top=500` on WIQL queries. For "oldest unresolved," use a separate query with `ORDER BY [System.CreatedDate] ASC` and `$top=5`.
**Warning signs:** Script works on small test projects but fails on production orgs.

### Pitfall 4: Work Item Batch Max 200 IDs Per Call

**What goes wrong:** Passing 500 IDs in a single batch call to `wit/workitemsbatch`. The API returns an error (not a partial result).
**Why it happens:** Hard API limit. Easy to miss since the WIQL step can return up to 500 IDs.
**How to avoid:** Chunk IDs into groups of 200: `for (let i = 0; i < ids.length; i += 200) { batch(ids.slice(i, i+200)) }`.
**Warning signs:** Bugs skill works for projects with <200 open bugs but fails on larger projects.

### Pitfall 5: Severity Field Values Are Process-Template Dependent

**What goes wrong:** Script hardcodes expected severity values like `"1 - Critical"`. A team using a custom process template has different values (e.g., `"Critical"`, `"Sev1"`, or localized strings).
**Why it happens:** Standard ADO process templates use `"1 - Critical"`, `"2 - High"`, `"3 - Medium"`, `"4 - Low"`. Custom templates may differ.
**How to avoid:** Treat severity as an opaque string. Group bugs by the raw `Microsoft.VSTS.Common.Severity` value. Sort groups by their numeric prefix if present, else alphabetically. Never hardcode expected severity values.
**Warning signs:** Severity breakdown shows "Unknown" or groups bugs incorrectly for non-standard process templates.

### Pitfall 6: Anonymous Flag Must Read From Both CLI and Config

**What goes wrong:** `--anonymous` flag works but `anonymous: true` in `config.json` is ignored (or vice versa).
**Why it happens:** Two sources of truth for the same setting. Developer implements one and forgets the other.
**How to avoid:** In `contributors.mjs`: `const anonymous = args.anonymous === 'true' || config.anonymous === true;`. CLI flag overrides config. Config is the default.
**Warning signs:** User sets `anonymous: true` in config but names still appear.

## Code Examples

### Contributors: Multi-Repo Commit Aggregation

```javascript
// Source: Established pattern from pr-metrics.mjs + ADO Commits API docs
async function fetchAllCommits(config, repoFilter, days) {
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString();
  const reposData = await adoGetRepos(config);
  const repos = reposData.value || [];
  const targetRepos = repoFilter
    ? repos.filter(r => r.name.toLowerCase() === repoFilter.toLowerCase())
    : repos;

  const allCommits = [];
  for (const repo of targetRepos) {
    process.stderr.write(`Fetching commits from ${repo.name}...\n`);
    try {
      const data = await adoGetCommits(config, repo.id, {
        'searchCriteria.fromDate': sinceDate,
        'searchCriteria.$top': '1000'
      });
      for (const commit of (data.value || [])) {
        allCommits.push({ ...commit, repoName: repo.name });
      }
    } catch (e) {
      // Tolerate per-repo failures (same pattern as adoGetPrThreads)
      process.stderr.write(`Warning: could not fetch commits from ${repo.name}\n`);
    }
  }
  return allCommits;
}
```

### Contributors: Team Cross-Reference Classification

```javascript
// Source: ADO Teams Members API (verified at Microsoft Learn 7.1)
async function classifyContributors(commitsByAuthor, teamMembers) {
  // Build set of team member emails (lowercase for matching)
  const teamEmails = new Set(
    teamMembers.map(m => (m.identity.uniqueName || '').toLowerCase())
  );
  const teamNameMap = new Map(
    teamMembers.map(m => [(m.identity.uniqueName || '').toLowerCase(), m.identity.displayName])
  );

  const active = [];   // On team + has commits
  const quiet = [];    // On team + no commits
  const former = [];   // Not on team + has commits

  // Classify commit authors
  for (const [email, data] of Object.entries(commitsByAuthor)) {
    if (teamEmails.has(email.toLowerCase())) {
      active.push({ name: data.name, email, commitCount: data.commits.length, repos: data.repos });
      teamEmails.delete(email.toLowerCase()); // Remove from set — remaining are quiet
    } else {
      former.push({ name: data.name, email, commitCount: data.commits.length, repos: data.repos });
    }
  }

  // Remaining team members with no commits are quiet
  for (const email of teamEmails) {
    quiet.push({ name: teamNameMap.get(email) || email, email });
  }

  return { active, quiet, former };
}
```

### Bugs: WIQL + Batch Fetch

```javascript
// Source: ADO WIQL + Work Items Batch API docs (verified at Microsoft Learn 7.1)
async function fetchBugs(config, types, days) {
  // Build type filter
  const typeList = types.map(t => `'${t}'`).join(',');
  const wiql = `SELECT [System.Id] FROM WorkItems
    WHERE [System.WorkItemType] IN (${typeList})
      AND [System.State] NOT IN ('Closed', 'Resolved', 'Done')
      AND [System.TeamProject] = @project
    ORDER BY [Microsoft.VSTS.Common.Severity] ASC, [System.CreatedDate] ASC`;

  const wiqlResult = await adoWiql(config, wiql, 500);
  const ids = (wiqlResult.workItems || []).map(wi => wi.id);
  if (ids.length === 0) return [];

  // Batch fetch in groups of 200
  const fields = [
    'System.Id', 'System.Title', 'System.State', 'System.CreatedDate',
    'System.ChangedDate', 'System.AssignedTo',
    'Microsoft.VSTS.Common.Severity', 'Microsoft.VSTS.Common.Priority'
  ];
  const allItems = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const result = await adoGetWorkItemsBatch(config, batch, fields);
    allItems.push(...(result.value || []));
  }
  return allItems;
}
```

### Bugs: Severity Grouping (Process-Template Agnostic)

```javascript
// Source: Established grouping pattern from pr-metrics.mjs reviewerStats
function groupBySeverity(items) {
  const groups = {};
  for (const item of items) {
    const sev = item.fields['Microsoft.VSTS.Common.Severity'] || 'Unspecified';
    if (!groups[sev]) groups[sev] = [];
    groups[sev].push(item);
  }
  // Sort keys: numeric prefix first (e.g., "1 - Critical" < "2 - High"), then alpha
  const sorted = Object.entries(groups).sort(([a], [b]) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });
  return Object.fromEntries(sorted);
}
```

### Config.json Anonymous Setting

```javascript
// Source: Existing config.mjs pattern + CONTEXT.md decision
// In contributors.mjs:
const anonymous = args.anonymous === 'true' || config.anonymous === true;

// When outputting JSON, conditionally mask names:
function maskName(name, anonymous) {
  return anonymous ? 'Contributor' : name;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `adoGet(path, params)` with implicit `loadConfig()` | Named functions `adoGetX(config, ...)` with explicit config | v1.0 Phase 2 | All new scripts must use named functions |
| GET-only `ado-client.mjs` | GET + POST (WIQL, batch) needed for work item APIs | v1.1 Phase 3 | First POST endpoints in the codebase |
| `Code (Read)` PAT scope only | `Work Items (Read)` scope also needed | v1.1 Phase 3 | Setup already lists scope; no setup.mjs change needed |

**Note:** The setup SKILL.md already lists `Work Items (Read)` in the required scopes guidance (confirmed in `skills/setup/SKILL.md`). No changes to setup are needed.

## Open Questions

1. **Team member matching across multiple teams**
   - What we know: `adoGetProject` returns `defaultTeam`. We use that team's members for cross-referencing.
   - What's unclear: If a project has multiple teams, some contributors may be on a non-default team and get classified as "former."
   - Recommendation: Use default team for v1.1. Document the limitation. If the default team call fails or returns unexpected results, fall back to listing all commit authors without team classification (degrade gracefully).

2. **Commit author email vs uniqueName mismatch**
   - What we know: Commit `author.email` and team member `identity.uniqueName` are both email addresses. They should match.
   - What's unclear: Some orgs use different email domains for Git commits vs Azure AD identity (e.g., personal email in git config vs corporate UPN in AAD).
   - Recommendation: Match case-insensitively. If match rate is very low (<50% of commit authors match any team member), include a note in the output suggesting the user check their git config email settings. LOW confidence this will be an issue in practice.

3. **Work item type names for non-English ADO instances**
   - What we know: Standard types are "Bug", "Task", "User Story". Custom process templates can use any name.
   - What's unclear: Whether localized ADO instances use translated work item type names (e.g., "Fehler" for Bug in German).
   - Recommendation: Default to "Bug" but make `--types` flag the explicit escape hatch. Document in SKILL.md narrative: "Queried type: Bug. Use `--types` to change."

## Sources

### Primary (HIGH confidence)
- [Azure DevOps Git Commits API (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits?view=azure-devops-rest-7.1) — endpoint URL, `searchCriteria.fromDate`, response shape with `author.name`, `author.email`, `author.date`
- [Azure DevOps Teams - Get Team Members With Extended Properties (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-team-members-with-extended-properties?view=azure-devops-rest-7.1) — endpoint URL, response shape with `identity.displayName`, `identity.uniqueName`, `identity.id`, required scope `vso.project`
- [Azure DevOps WIQL - Query By Wiql (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1) — POST endpoint, request body, 20,000 item hard cap
- [Azure DevOps Work Items - Get Work Items Batch (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-items-batch?view=azure-devops-rest-7.1) — POST endpoint, 200 ID max, `errorPolicy: "omit"`, field reference names
- Existing codebase: `scripts/ado-client.mjs` (181 LOC), `scripts/pr-metrics.mjs` (501 LOC), `skills/pr-metrics/SKILL.md` — established patterns for HTTP, JSON output, SKILL.md structure

### Secondary (MEDIUM confidence)
- [Azure DevOps Work Item Limits](https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/object-limits?view=azure-devops) — 20K WIQL limit confirmed
- [Azure DevOps Rate Limits](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rate-limits?view=azure-devops) — 200 TSTUs per 5-minute window
- `.planning/research/FEATURES.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md` — pre-researched for v1.1 milestone

### Tertiary (LOW confidence)
- None — all claims verified with official Microsoft Learn docs or existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero-dependency Node.js; all APIs verified against Microsoft Learn 7.1 docs
- Architecture: HIGH — follows established pr-metrics pattern exactly; new functions extend existing `ado-client.mjs`
- Pitfalls: HIGH — per-repo commit looping, WIQL caps, batch limits all verified in official docs; team member matching verified with API response shape

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (stable — ADO REST API v7.1 is GA; project patterns established)
