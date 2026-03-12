# Phase 4: Project State & Distribution - Research

**Researched:** 2026-03-12
**Domain:** Azure DevOps Iterations API, cross-skill synthesis, git self-update, distribution polish
**Confidence:** HIGH

## Summary

Phase 4 ships three new skills (`/adi:sprint`, `/adi:summary`, `/adi:update`) and finalizes distribution. The project has a well-established pattern: `.mjs` data script outputs JSON to stdout, `SKILL.md` provides narration instructions. All three new skills follow this pattern exactly.

The sprint skill requires new Azure DevOps API functions for iterations (team settings iterations endpoint) and iteration work items. These are straightforward REST calls following the existing `ado-client.mjs` pattern. The summary skill imports and calls the four existing data scripts programmatically. The update skill uses `child_process.execSync` for git operations. Distribution polish is mechanical: placeholder replacement, help table update, README rewrite, version bump.

**Primary recommendation:** Build sprint.mjs first (new API surface), then summary.mjs (depends on sprint.mjs), then update.mjs (independent), then distribution polish (final sweep).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Sprint reports four dimensions: completion status, velocity tracking, backlog health, burndown summary
- Story points preferred for velocity; fall back to item count if no estimates exist
- Velocity trend depth: default 3 sprints, configurable via `--sprints=N` flag
- No sprints configured -> clear error message
- Summary runs all four sub-skills live internally -- always fresh data, one command
- All four skills always included -- no skip/select mechanism
- Cross-cutting theme structure for summary (not section-per-skill)
- Graceful skip on sub-skill failure
- Update uses git pull -- simple, leverages existing git install
- Update shows git log between old and new HEAD for changelog
- Always pulls immediately -- no check-first/confirm flow
- No .git directory -> error with instructions
- Replace `your-org` with `molsmadsen` in plugin.json and marketplace.json
- `/adi:help` updated: move all skills to main command table, remove "Coming soon"
- README updated with full skill catalog: all 7 commands with usage examples and flags
- plugin.json version bumped to 1.1.0
- `/adi:sprint`: `--sprints=N` (default 3) -- new flag
- `/adi:summary`: inherits `--days`, `--repo`, `--anonymous` and passes to sub-skills
- `/adi:update`: no flags

### Claude's Discretion
- Sprint API implementation details (Iterations API, team settings API)
- Cross-cutting theme categories and narrative structure for summary
- Exact git commands and error handling for update
- How to import/call sub-skill scripts from summary.mjs
- Burndown on-track/behind heuristic

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fetch` | N/A | Azure DevOps REST API calls | Zero-dependency constraint; already used in all existing scripts |
| Node.js `child_process` | N/A | Git commands in update.mjs | Built-in; `execSync` for synchronous git pull |
| Node.js `fs`, `path`, `os` | N/A | Config, file resolution | Already used in config.mjs |

### Supporting
No additional libraries. Zero npm dependencies constraint is locked.

## Architecture Patterns

### Recommended Project Structure
```
scripts/
  sprint.mjs          # NEW: sprint analysis data script
  summary.mjs         # NEW: cross-skill synthesis script
  update.mjs          # NEW: git self-update script
  ado-client.mjs      # MODIFY: add iteration API functions
  pr-metrics.mjs      # EXISTING (imported by summary.mjs)
  contributors.mjs    # EXISTING (imported by summary.mjs)
  bugs.mjs            # EXISTING (imported by summary.mjs)
  config.mjs          # EXISTING
  setup.mjs           # EXISTING
skills/
  sprint/SKILL.md     # NEW
  summary/SKILL.md    # NEW
  update/SKILL.md     # NEW
  help/SKILL.md       # MODIFY: update command table
.claude-plugin/
  plugin.json         # MODIFY: version + org name
  marketplace.json    # MODIFY: org name
README.md             # MODIFY: full skill catalog
```

### Pattern 1: Sprint Data Fetching (New API Functions in ado-client.mjs)

**What:** Three new exported functions for the iterations/sprints API.
**When to use:** sprint.mjs needs to fetch iterations, iteration work items, and team settings.

The Azure DevOps Work API uses a different URL pattern than the existing functions. The iterations endpoints include `{team}` in the path:

```javascript
// GET {org}/{project}/{team}/_apis/work/teamsettings/iterations?api-version=7.1
// $timeframe=current filters to current sprint only
export async function adoGetTeamIterations(config, teamId, timeframe = null) {
  const orgBase = config.orgUrl.replace(/\/$/, '');
  const url = new URL(`${orgBase}/${config.project}/${teamId}/_apis/work/teamsettings/iterations`);
  url.searchParams.set('api-version', '7.1');
  if (timeframe) url.searchParams.set('$timeframe', timeframe);
  // ... standard fetch + error handling pattern
}

// GET {org}/{project}/{team}/_apis/work/teamsettings/iterations/{iterationId}/workitems?api-version=7.1
// Returns workItemRelations[] with {rel, source, target: {id, url}}
export async function adoGetIterationWorkItems(config, teamId, iterationId) {
  const orgBase = config.orgUrl.replace(/\/$/, '');
  const url = new URL(`${orgBase}/${config.project}/${teamId}/_apis/work/teamsettings/iterations/${iterationId}/workitems`);
  url.searchParams.set('api-version', '7.1');
  // ... standard fetch + error handling pattern
}
```

**Source:** [Iterations - List (Azure DevOps REST API 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.1)

### Pattern 2: Iteration Work Items Response Shape

**What:** The iteration work items endpoint returns a flat list of `workItemRelations`, not work item details.
**Critical:** You must extract unique target IDs, then batch-fetch details via `adoGetWorkItemsBatch`.

```javascript
// Response from adoGetIterationWorkItems:
// { workItemRelations: [
//     { rel: null, source: null, target: { id: 1 } },           // top-level item
//     { rel: "System.LinkTypes.Hierarchy-Forward", source: { id: 1 }, target: { id: 3 } }  // child
//   ] }

// Extract all unique work item IDs (both parents and children):
const allIds = [...new Set(
  data.workItemRelations
    .map(r => r.target?.id)
    .filter(Boolean)
)];

// Then batch-fetch with fields needed for sprint analysis:
const fields = [
  'System.Id', 'System.Title', 'System.State', 'System.WorkItemType',
  'System.AssignedTo', 'System.CreatedDate',
  'Microsoft.VSTS.Scheduling.StoryPoints',
  'Microsoft.VSTS.Scheduling.Effort',
  'Microsoft.VSTS.Scheduling.RemainingWork'
];
const items = await adoGetWorkItemsBatch(config, allIds, fields);
```

**Source:** [Iterations - Get Iteration Work Items (Azure DevOps REST API 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/get-iteration-work-items?view=azure-devops-rest-7.1)

### Pattern 3: Summary Script Importing Sub-Skills

**What:** summary.mjs needs to call the main() functions of pr-metrics, contributors, bugs, and sprint scripts.
**Problem:** Existing scripts execute immediately on import (top-level `main().catch(...)` call). They cannot be imported without running.

**Solution:** Refactor each existing script to export its `main()` function, OR have summary.mjs spawn child processes.

**Recommended approach: child_process spawn.** This avoids refactoring existing scripts, maintains stdout/stderr isolation, and matches the "always fresh data" requirement. Use `execSync` or spawn with captured stdout:

```javascript
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runSubSkill(scriptName, flags = []) {
  const scriptPath = join(__dirname, scriptName);
  const cmd = `node "${scriptPath}" ${flags.join(' ')}`;
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe']  // capture stderr separately
    });
    return { ok: true, data: JSON.parse(stdout) };
  } catch (e) {
    return { ok: false, error: e.message, scriptName };
  }
}
```

This is cleaner than refactoring scripts because:
1. No changes to existing working scripts
2. Each sub-skill runs in isolation (no shared state issues)
3. Stderr progress messages don't pollute summary's stdout
4. Graceful skip on failure is trivial (catch block)

### Pattern 4: Self-Update via Git

**What:** update.mjs runs `git pull` in the plugin directory.
**Key:** Must find the plugin's install directory (same resolver pattern used in SKILL.md).

```javascript
import { execSync } from 'child_process';

// Detect plugin root from installed_plugins.json (same pattern as SKILL.md)
// Then:
function gitPull(pluginDir) {
  // Check for .git directory first
  try {
    execSync('git rev-parse --git-dir', { cwd: pluginDir, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    return { error: { type: 'no_git', message: 'Update requires git. Re-install via: git clone <repo-url>' } };
  }

  const oldHead = execSync('git rev-parse HEAD', { cwd: pluginDir, encoding: 'utf8' }).trim();
  execSync('git pull', { cwd: pluginDir, encoding: 'utf8', stdio: 'pipe' });
  const newHead = execSync('git rev-parse HEAD', { cwd: pluginDir, encoding: 'utf8' }).trim();

  if (oldHead === newHead) {
    return { updated: false, message: 'Already up to date.' };
  }

  const changelog = execSync(`git log --oneline ${oldHead}..${newHead}`, { cwd: pluginDir, encoding: 'utf8' }).trim();
  return { updated: true, oldHead: oldHead.slice(0, 7), newHead: newHead.slice(0, 7), changelog };
}
```

### Pattern 5: Burndown On-Track Heuristic (Claude's Discretion)

**What:** Determine if sprint is on track, ahead, or behind.
**Heuristic:** Compare elapsed time percentage vs completed work percentage.

```javascript
function burndownStatus(sprintStart, sprintEnd, completedPoints, totalPoints) {
  const now = Date.now();
  const start = new Date(sprintStart).getTime();
  const end = new Date(sprintEnd).getTime();
  const duration = end - start;
  if (duration <= 0) return 'unknown';

  const elapsed = Math.min(now - start, duration) / duration;  // 0.0 to 1.0
  const completed = totalPoints > 0 ? completedPoints / totalPoints : 0;

  // Allow 10% margin before flagging
  if (completed >= elapsed - 0.1) return 'on-track';
  if (completed >= elapsed - 0.25) return 'at-risk';
  return 'behind';
}
```

If sprint has no dates (startDate/finishDate null), report status as "unknown" -- dates are optional in ADO.

### Pattern 6: Cross-Cutting Theme Structure for Summary (Claude's Discretion)

**What:** summary.mjs outputs structured data; SKILL.md instructs Claude to organize by themes.
**Recommendation:** Output raw data from all four sub-skills as-is. Let the SKILL.md narration instructions define the cross-cutting themes:

Suggested theme categories:
1. **Delivery Velocity** -- sprint completion + PR cycle times + velocity trend
2. **Team Health** -- contributor activity + reviewer distribution + quiet members
3. **Quality & Risk** -- bug severity + stale PRs + unassigned bugs + scope creep
4. **Actionable Items** -- synthesized recommendations from all signals

The script outputs `{ prMetrics, contributors, bugs, sprint, meta }`. The SKILL.md does the thematic weaving.

### Anti-Patterns to Avoid
- **Importing scripts that auto-execute:** Don't try to `import` from pr-metrics.mjs etc. -- they call `main()` at module level. Use child_process instead.
- **Parallel sub-skill execution in summary:** Run sub-skills sequentially to avoid API rate limiting. The total wall time is still < 30 seconds.
- **Hardcoded sprint state names:** Use raw Azure DevOps states (process-template agnostic, same as bugs.mjs pattern). Common done states include "Done", "Closed", "Completed", "Resolved" -- classify by checking a reasonable set.
- **Assuming story points exist:** Many teams don't estimate. Always fall back to item count.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Iteration/sprint detection | Custom date-range calculation | ADO Iterations API with `$timeframe=current` | API handles edge cases (no current sprint, date overlaps) |
| Work item state classification | Mapping state names to done/not-done per process template | Set-based check against known done states | Agile, Scrum, CMMI all differ; checking `['Done','Closed','Completed','Resolved']` covers them |
| Story points field name | Guessing field references | `Microsoft.VSTS.Scheduling.StoryPoints` (standard Agile/Scrum field) | Official field reference name in ADO |
| Plugin root discovery | New resolver | Existing PLUGIN_ROOT resolver pattern from SKILL.md | Already battle-tested across 5 skills |

## Common Pitfalls

### Pitfall 1: Iterations API Requires Team in URL Path
**What goes wrong:** Using `{project}/_apis/work/teamsettings/iterations` without a team ID returns the default team's iterations, which works -- but the team ID is technically part of the URL path.
**Why it happens:** Other ADO endpoints (PRs, commits, WIQL) don't need team ID.
**How to avoid:** Get the default team from `adoGetProject` (already used in contributors.mjs) and pass `defaultTeam.id` or `defaultTeam.name` to iteration calls.
**Warning signs:** Iterations endpoint returns empty when project has multiple teams with different iteration configurations.

### Pitfall 2: Iteration Work Items Returns Relations, Not Details
**What goes wrong:** Treating the response as work item objects with fields.
**Why it happens:** The endpoint returns `workItemRelations[]` with only `{id, url}` targets.
**How to avoid:** Extract IDs from relations, then batch-fetch via `adoGetWorkItemsBatch` with needed fields.
**Warning signs:** `undefined` when accessing `.fields` on relation targets.

### Pitfall 3: Sprint with No Dates
**What goes wrong:** Burndown calculation divides by zero or produces NaN.
**Why it happens:** ADO allows iterations without start/finish dates.
**How to avoid:** Check `attributes.startDate` and `attributes.finishDate` are non-null before computing burndown. If null, report burndown as "unknown -- sprint has no dates configured."

### Pitfall 4: Story Points Field Varies by Process Template
**What goes wrong:** Looking for `StoryPoints` but team uses `Effort` field instead.
**Why it happens:** Scrum template uses `Microsoft.VSTS.Scheduling.Effort` while Agile uses `Microsoft.VSTS.Scheduling.StoryPoints`.
**How to avoid:** Fetch both fields and use whichever is populated. Check `StoryPoints` first, fall back to `Effort`, fall back to item count.

### Pitfall 5: Summary Sub-Skill Failure Cascading
**What goes wrong:** One sub-skill throws and kills the entire summary.
**Why it happens:** Unhandled rejection when calling sub-skill.
**How to avoid:** Wrap each sub-skill call in try/catch. On failure, set `{ ok: false, error: '...' }` and continue. SKILL.md narration handles missing sections gracefully.

### Pitfall 6: Scope Creep Detection Edge Case
**What goes wrong:** Items added before sprint start are flagged as scope creep.
**Why it happens:** Comparing `System.CreatedDate` against sprint start date without considering that items may be pre-existing backlog items assigned to the sprint.
**How to avoid:** For scope creep, use the iteration assignment relationship. Items in the iteration work items response with `System.CreatedDate` > sprint `startDate` are candidates for mid-sprint additions. But note: re-assigned items (moved from one sprint to another) won't show this. A more reliable approach: count items where `System.CreatedDate` is after sprint `startDate` as the heuristic. Document this limitation.

## Code Examples

### New ado-client.mjs Functions

```javascript
// Source: https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.1

export async function adoGetTeamIterations(config, teamId, timeframe = null) {
  const orgBase = config.orgUrl.replace(/\/$/, '');
  const url = new URL(`${orgBase}/${config.project}/${teamId}/_apis/work/teamsettings/iterations`);
  url.searchParams.set('api-version', '7.1');
  if (timeframe) url.searchParams.set('$timeframe', timeframe);
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'Authorization': buildAuthHeader(config.pat),
        'Content-Type': 'application/json'
      }
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
    throw Object.assign(new Error(`API error: ${response.status}`), { type: 'api' });
  }
  return response.json();
}

export async function adoGetIterationWorkItems(config, teamId, iterationId) {
  const orgBase = config.orgUrl.replace(/\/$/, '');
  const url = new URL(`${orgBase}/${config.project}/${teamId}/_apis/work/teamsettings/iterations/${iterationId}/workitems`);
  url.searchParams.set('api-version', '7.1');
  // ... same error handling pattern
}
```

### sprint.mjs Velocity Computation

```javascript
// Fetch N most recent past iterations + current for velocity trend
const allIterations = await adoGetTeamIterations(config, teamId);
const pastIterations = (allIterations.value || [])
  .filter(i => i.attributes?.timeFrame === 'past')
  .sort((a, b) => new Date(b.attributes.finishDate) - new Date(a.attributes.finishDate))
  .slice(0, sprintsForVelocity);  // --sprints=N, default 3

// For each past iteration, fetch work items and sum completed story points
for (const iteration of pastIterations) {
  const workItemRels = await adoGetIterationWorkItems(config, teamId, iteration.id);
  const ids = [...new Set(workItemRels.workItemRelations.map(r => r.target?.id).filter(Boolean))];
  const items = await adoGetWorkItemsBatch(config, ids, fields);
  // Sum points for items in done states
}
```

### summary.mjs Sub-Skill Orchestration

```javascript
const flags = [];
if (args.days) flags.push(`--days=${args.days}`);
if (args.repo) flags.push(`--repo=${args.repo}`);
if (args.anonymous === 'true') flags.push('--anonymous');

const results = {};
for (const [name, script, extraFlags] of [
  ['prMetrics', 'pr-metrics.mjs', flags],
  ['contributors', 'contributors.mjs', flags],
  ['bugs', 'bugs.mjs', flags.filter(f => !f.startsWith('--repo'))],  // bugs don't use --repo
  ['sprint', 'sprint.mjs', args.days ? [`--days=${args.days}`] : []]
]) {
  results[name] = runSubSkill(script, extraFlags);
  if (!results[name].ok) {
    process.stderr.write(`Warning: ${name} failed: ${results[name].error}\n`);
  }
}

console.log(JSON.stringify({
  meta: { project: config.project, generatedAt: new Date().toISOString() },
  ...results
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Azure DevOps REST API 6.0 | REST API 7.1 | 2023 | Project uses 7.1 consistently; iterations API stable since 5.0 |

No deprecated patterns relevant to this phase.

## Open Questions

1. **Story points vs Effort field detection**
   - What we know: Agile uses `StoryPoints`, Scrum uses `Effort`. Both are in `Microsoft.VSTS.Scheduling` namespace.
   - What's unclear: Whether both fields can coexist on the same work item.
   - Recommendation: Fetch both fields in batch request, prefer `StoryPoints`, fall back to `Effort`, fall back to item count. This covers all process templates.

2. **Multiple teams per project**
   - What we know: The iterations API is team-scoped. We use `defaultTeam` from `adoGetProject`.
   - What's unclear: Whether users expect sprint data from non-default teams.
   - Recommendation: Use default team only (matches contributors.mjs precedent). Document this in SKILL.md narration.

## Sources

### Primary (HIGH confidence)
- [Iterations - List (Azure DevOps REST 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.1) -- URL pattern, response schema, timeframe filter
- [Iterations - Get Iteration Work Items (Azure DevOps REST 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/get-iteration-work-items?view=azure-devops-rest-7.1) -- work item relations response shape
- [Teamsettings - Get (Azure DevOps REST 7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/teamsettings/get?view=azure-devops-rest-7.1) -- team settings including working days, backlog iteration, bugs behavior
- Existing codebase: `ado-client.mjs`, `bugs.mjs`, `contributors.mjs`, `pr-metrics.mjs` -- established patterns

### Secondary (MEDIUM confidence)
- Azure DevOps field reference names (`Microsoft.VSTS.Scheduling.StoryPoints`, `Microsoft.VSTS.Scheduling.Effort`) -- well-documented standard fields

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero-dependency Node.js, same as all previous phases
- Architecture: HIGH -- follows established pattern exactly, new API endpoints well-documented
- Pitfalls: HIGH -- verified against official API docs, field references confirmed
- Sprint API: HIGH -- verified URL patterns and response shapes from official docs
- Summary import strategy: HIGH -- child_process approach avoids refactoring risk
- Update git commands: HIGH -- standard git CLI, well-understood

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable APIs, no breaking changes expected)
