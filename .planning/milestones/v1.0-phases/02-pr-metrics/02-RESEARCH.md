# Phase 2: PR Metrics - Research

**Researched:** 2026-02-25
**Domain:** Azure DevOps Pull Request REST API, data aggregation, Node.js script + Claude skill patterns
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Scope:**
- Default: all repos in the configured ADO project
- `--repo <name>` narrows analysis to a single repo within the project
- `--project <name>` overrides the ADO project from config
- Time window: attempt all-time first; fall back to 1 year if too slow, then 90 days. Always overridable via `--days <n>`
- Include both open and merged PRs (open reveals current bottlenecks; merged gives cycle time history)
- No team filter — full project scope only

**Output Structure:**
- Narrative with embedded stats and section headers (scannable, not raw tables)
- Show analysis summary at the top: e.g., "Analyzed 87 PRs across 4 repos, last 365 days"
- Call out specific people by name (reviewer participation, bottlenecks)
- Include actionable recommendations section only when issues are found (healthy teams get no recommendations)

**Thresholds & Definitions:**
- **Stale PR**: no activity for 3 days (overridable via `--stale-days <n>`)
- **Bottleneck**: reviewer with the highest average time-to-first-review across all their reviews
- **Healthy review time**: < 4 hours to first review; anything over is flagged
- All thresholds are overridable via skill arguments

**Invocation & Flags:**
Supported arguments:
- `--repo <name>` — filter to a single repo
- `--days <n>` — override time window
- `--stale-days <n>` — override stale threshold (default: 3)
- `--project <name>` — override ADO project from config

**Loading & Error Behavior:**
- Show brief status while fetching: e.g., "Fetching PRs from 4 repos..."
- If no PRs found: friendly message + suggestion to broaden scope (e.g., "No PRs found. Try --days 30.")
- If one repo fails: continue with partial data, note which repos failed in the output

**Claude's Discretion:**
- Exact section headers and narrative tone
- How to present cycle time (mean vs. median vs. both)
- Order of sections within the narrative
- How to surface anomalies (inline vs. separate section)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PR-01 | `/adi:pr-metrics` reports average time from PR open to first review | Requires thread API to find first non-system, non-PR-author vote/comment per PR. `VoteUpdate` system thread with `publishedDate` is the most reliable signal. `creationDate` from PR object is the baseline. |
| PR-02 | `/adi:pr-metrics` reports average time from PR open to merge (full cycle time) | `creationDate` and `closedDate` from `GitPullRequest` object. Only applies to `status: completed` PRs. Both fields are present in the main PR list response — no secondary API call needed. |
| PR-03 | `/adi:pr-metrics` shows reviewer distribution — who reviews most, who is absent | `reviewers[]` array on each PR contains `displayName` and `vote`. Count non-zero votes per person across all PRs. Compare active reviewer set against the full set of people who created PRs to identify absent reviewers. |
| PR-04 | `/adi:pr-metrics` flags stale PRs (open with no activity beyond threshold) | `status: active` PRs with `lastUpdatedDate` (from thread API or PR object). Stale = (now - lastUpdatedDate) > staleDays. Thread API `lastUpdatedDate` is the most granular activity signal. The PR object itself does not expose a direct `lastActivityDate` field — thread API is needed for accurate staleness. |
| PR-05 | `/adi:pr-metrics` detects review bottlenecks and names them | Reviewer who has the highest average time-to-first-review. Also detect concentration: if one reviewer voted on >50% of all PRs, name them as a single point of dependency. Both require the thread API for time data. |
| PR-06 | Output is a written AI narrative with findings, anomalies, and recommendations | SKILL.md instructs Claude to receive JSON data from script and write a narrative. Script outputs structured JSON; skill narration is Claude's job. Pattern established in Phase 1. |
</phase_requirements>

---

## Summary

Phase 2 builds the `/adi:pr-metrics` skill on top of the Phase 1 foundation. The skill fetches PR data from Azure DevOps, computes metrics in a Node.js script, and passes structured JSON to Claude for narrative generation. The primary technical challenge is computing **time-to-first-review**: the PR list API does not include this field; it requires a secondary call to the PR Threads API to find the earliest non-system, non-author review event per PR.

There are two distinct API endpoints for PRs: a per-repository endpoint (`_apis/git/repositories/{repoId}/pullrequests`) and a **project-wide endpoint** (`_apis/git/pullrequests`) that returns PRs across all repos in the project in a single call. The project-wide endpoint is the right choice for the default "all repos" mode. For the `--repo` filter, use the per-repo endpoint with `searchCriteria.repositoryId`.

The ADO PR list API uses `$skip`/`$top` pagination (max 1000 per page). For large projects, fetching all-time data can require many pages. The fallback strategy (all-time → 1 year → 90 days) is correctly scoped in the context decisions and must be implemented with explicit count checks to trigger the fallback.

**Primary recommendation:** Build `pr-metrics.mjs` as a data-fetching + computation script that outputs structured JSON, following the exact pattern of `setup.mjs`. The SKILL.md instructs Claude to run it and narrate the JSON output. Keep the time-to-first-review computation in the script (deterministic math), not in Claude's narrative pass (non-deterministic).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `fetch()` (Node 18+) | Built-in | HTTP calls to ADO REST API | Zero deps; already used in `ado-client.mjs` — established pattern |
| `ado-client.mjs` (existing) | Phase 1 | Auth header, error handling, `adoGet()` | Already built and tested; Phase 2 adds new functions to it or imports from it |
| `config.mjs` (existing) | Phase 1 | Load `~/.adi/config.json` | Already built; PR script reads same config |
| Node.js `Date` arithmetic | Built-in | Time-to-review, cycle time, staleness | No library needed for simple timestamp subtraction |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Promise.all()` / `Promise.allSettled()` | Built-in | Parallel repo fetches | Use `allSettled` so one failing repo doesn't block others |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom date arithmetic | `date-fns` npm package | `date-fns` is clean but introduces an npm dependency for operations that are 3 lines of plain JS |
| Project-wide PR endpoint | Per-repo endpoint with loop | Per-repo requires listing repos first, then looping; project-wide is one call for default mode |
| Thread API for first-review time | PR `reviewers[].vote` timestamp | `reviewers` array has no timestamps — only the current vote state. Thread API is the only source of vote timestamps. |

**Installation:**
```bash
# No new dependencies needed — zero npm packages
```

---

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)

```
azure-devops-insights/
  skills/
    pr-metrics/
      SKILL.md                    # /adi:pr-metrics skill
  scripts/
    pr-metrics.mjs                # Data fetch + compute script (new)
    ado-client.mjs                # Extended with PR-specific fetch functions
    config.mjs                    # Unchanged from Phase 1
    setup.mjs                     # Unchanged from Phase 1
```

### Pattern 1: Script-Narrates-JSON (established in Phase 1)

**What:** The `.mjs` script does all data fetching and computation. It outputs a single JSON object to stdout. The SKILL.md tells Claude to run the script, parse the JSON, and write a narrative. Claude never calls the API directly.

**Why:** Scripts are deterministic; narratives improve with model updates. Separating computation from narration means the data is consistent even as the narrative style evolves.

**Pattern:**
```javascript
// scripts/pr-metrics.mjs
// ... fetch and compute ...
console.log(JSON.stringify({
  summary: { totalPrs: 87, repos: 4, daysCovered: 365 },
  cycleTimes: { mean: 26.4, median: 18.2, unit: 'hours' },
  timeToFirstReview: { mean: 3.2, median: 1.8, unit: 'hours', belowThreshold: true },
  reviewerDistribution: [
    { name: 'Alice', reviewCount: 34, avgTimeToReview: 2.1 },
    { name: 'Bob', reviewCount: 12, avgTimeToReview: 6.7 },
  ],
  absentReviewers: ['Charlie', 'Dana'],
  stalePrs: [
    { title: 'Add feature X', repo: 'api-service', daysStale: 8, url: '...' }
  ],
  bottleneck: { name: 'Bob', avgTimeToReview: 6.7, reviewShare: 0.14 },
  errors: []  // repos that failed to fetch
}));
```

### Pattern 2: Project-Wide PR Fetch (vs. Per-Repo)

**What:** Use `GET {org}/{project}/_apis/git/pullrequests` to fetch PRs across all repos in one API call. This is the correct default endpoint. Use the per-repo endpoint only when `--repo` is specified.

**Endpoint:**
```
GET https://dev.azure.com/{org}/{project}/_apis/git/pullrequests
  ?searchCriteria.status=all
  &searchCriteria.minTime=<ISO-date>
  &searchCriteria.queryTimeRangeType=created
  &$top=1000
  &$skip=0
  &api-version=7.1
```

**Key parameters:**
- `searchCriteria.status=all` — returns both `active` and `completed` PRs (required for both open and merged)
- `searchCriteria.minTime` + `searchCriteria.queryTimeRangeType=created` — date window filter (set to `now - days`)
- `$top=1000` + `$skip` — pagination; 1000 is the documented maximum per page

**Per-repo variant (when `--repo` is specified):**
```
GET https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/pullrequests
  ?searchCriteria.status=all
  ...
```
Requires resolving the repo name to its ID first via `GET _apis/git/repositories`.

### Pattern 3: First-Review Time via Thread API

**What:** The PR list response does NOT include a timestamp for when the first review action happened. To compute time-to-first-review, fetch the thread list for a PR and find the earliest thread with `CodeReviewThreadType: VoteUpdate` that was authored by someone other than the PR creator.

**Endpoint:**
```
GET https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/pullRequests/{prId}/threads
  ?api-version=7.1
```

**Algorithm:**
```javascript
function findFirstReviewTime(threads, prCreatorId) {
  const voteThreads = threads.filter(t =>
    t.properties?.CodeReviewThreadType?.$value === 'VoteUpdate' &&
    t.comments?.[0]?.author?.id !== prCreatorId
  );
  if (voteThreads.length === 0) return null;  // no review yet
  const earliest = voteThreads.reduce((min, t) =>
    t.publishedDate < min.publishedDate ? t : min
  );
  return new Date(earliest.publishedDate);
}
```

**Vote values (from IdentityRefWithVote):**
- `10` = approved
- `5` = approved with suggestions
- `0` = no vote (assigned but not acted)
- `-5` = waiting for author
- `-10` = rejected

A vote of `0` in the thread stream means the reviewer was added. Only non-zero vote events (`VoteUpdate` threads) count as "first review."

**Performance warning:** Thread API calls are per-PR. For 100+ PRs, this is 100+ HTTP requests. Batch with `Promise.allSettled()` in groups of 10–20. Consider only fetching threads for PRs where time-to-first-review is needed (i.e., merged PRs for historical averages; active PRs for staleness already detected from PR list).

### Pattern 4: Pagination Loop

**What:** ADO returns at most 1000 PRs per page. Use `$skip` to iterate.

```javascript
async function fetchAllPrs(config, days) {
  const minTime = new Date(Date.now() - days * 86400000).toISOString();
  const allPrs = [];
  let skip = 0;
  const top = 1000;

  while (true) {
    const data = await adoGetPrsByProject(config, {
      'searchCriteria.status': 'all',
      'searchCriteria.minTime': minTime,
      'searchCriteria.queryTimeRangeType': 'created',
      '$top': top,
      '$skip': skip
    });

    allPrs.push(...data.value);
    if (data.value.length < top) break;  // last page
    skip += top;
  }

  return allPrs;
}
```

**Fallback strategy:**
```javascript
// Attempt all-time first; if count is large (>500), fall back to shorter window
async function fetchPrsWithFallback(config, requestedDays) {
  const windows = requestedDays
    ? [requestedDays]                   // explicit --days flag, no fallback
    : [null, 365, 90];                  // null = all-time (no minTime filter)

  for (const days of windows) {
    const prs = await fetchAllPrs(config, days);
    if (!days || prs.length < 500) return { prs, days };
    // too many, try next (shorter) window
  }
}
```

### Pattern 5: Arg Parsing for Skill Script

Following the `setup.mjs` pattern, parse `--key=value` args:

```javascript
// scripts/pr-metrics.mjs
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const eq = a.indexOf('=');
      return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), 'true'];
    })
);

const repo = args.repo || null;
const days = args.days ? parseInt(args.days, 10) : null;
const staleDays = args['stale-days'] ? parseInt(args['stale-days'], 10) : 3;
const projectOverride = args.project || null;
```

### Pattern 6: SKILL.md for Data-Fetch Skills

PR metrics uses the same shell invocation pattern as setup, but with different frontmatter and different narration instructions:

```markdown
---
name: pr-metrics
description: AI-narrated pull request health report for your Azure DevOps project.
allowed-tools: Bash(node *)
---

## Step 0: Guard — check config exists

Run:
```bash
PLUGIN_ROOT=`node -e "..."` && node "$PLUGIN_ROOT/scripts/pr-metrics.mjs" --check-config
```
If output is `{"configMissing": true}`, tell the user: "Run /adi:setup first."

## Step 1: Parse user's arguments

Extract from the user's message:
- `--repo <name>` if present
- `--days <n>` if present
- `--stale-days <n>` if present (default: 3)
- `--project <name>` if present

## Step 2: Fetch and compute

Tell the user: "Fetching PR data..."

Run:
```bash
PLUGIN_ROOT=`...` && node "$PLUGIN_ROOT/scripts/pr-metrics.mjs" [flags]
```

## Step 3: Narrate the JSON output

Parse the JSON output and write a narrative with these characteristics:
- Open with: "Analyzed {totalPrs} PRs across {repos} repos, last {daysCovered} days."
- ... (full narration instructions)
```

### Anti-Patterns to Avoid

- **Fetching thread data for all PRs upfront:** Thread API is per-PR. Fetch threads only for PRs where the vote timestamps are needed. Active PRs with no vote yet should be identified from the `reviewers[].vote === 0` snapshot on the PR object, not by fetching all their threads.
- **Using `reviewers[]` array for time calculations:** The `reviewers` field on the PR list response shows the *current* vote state with no timestamps. Never use it for time calculations.
- **Setting `searchCriteria.status` without `=all`:** Default is `active`. Without `status=all`, you miss completed/merged PRs entirely, making cycle time calculation impossible.
- **Conflating "no vote" with "no review activity":** A reviewer listed with `vote: 0` was added as a reviewer but hasn't acted. This person is not absent — they're pending. Absent reviewers are people who *created* PRs (or were *added* as reviewers) but never voted on anyone else's PRs.
- **Counting the PR author's own vote on their PR as a review:** The PR creator sometimes votes on their own PR (e.g., after resolving comments). Filter by `thread.comments[0].author.id !== pr.createdBy.id` when finding first review.
- **Treating `closedDate` as merge date:** `closedDate` is set for all closed PRs — both merged (`status: completed`) and abandoned (`status: abandoned`). Only use `closedDate` for cycle time when `status === 'completed'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth headers for ADO | Custom auth logic | `buildAuthHeader()` from `ado-client.mjs` | Already implemented, colon-prefix bug handled |
| Config loading | File read inline | `loadConfig()` from `config.mjs` | Consistent error messages; PAT path centralized |
| PR fetch with error handling | Raw `fetch()` calls | `adoGet()` from `ado-client.mjs` (or extend it) | HTTP 203/401/403 edge cases already handled |
| Parallel repo fetching | Serial loop | `Promise.allSettled()` | One failing repo should not block others; `allSettled` gives partial results with errors |
| Repository ID lookup | Guessing or hardcoding | `GET _apis/git/repositories?api-version=7.1` | Repo names are not unique across ADO; use ID for per-repo filtering |

**Key insight:** Phase 2 builds on Phase 1's `ado-client.mjs`. The right approach is to add new ADO-specific fetch functions to `ado-client.mjs` (or a new `pr-client.mjs` if separation is preferred) rather than writing raw fetch calls in the metrics script.

---

## Common Pitfalls

### Pitfall 1: `searchCriteria.status` Defaults to `active`

**What goes wrong:** Omitting `searchCriteria.status` returns only active (open) PRs. Cycle time (PR-02) requires merged PRs. Reviewer distribution is skewed without historical data.

**Why it happens:** The API docs state "Defaults to Active if unset." Easy to miss.

**How to avoid:** Always pass `searchCriteria.status=all` in the project-wide PR fetch. Validate locally: the returned PR list should contain PRs with both `status: active` and `status: completed`.

**Warning signs:** Time-to-merge is undefined or NaN; the PR count seems low compared to what the ADO portal shows.

### Pitfall 2: Thread Fetch Volume for Large Projects

**What goes wrong:** With 200 PRs and 200 thread API calls in parallel, the request burst can hit ADO rate limits (HTTP 429). The code hangs or receives partial data without obvious error.

**Why it happens:** ADO rate limits PAT-authenticated requests. The exact limit is not publicly documented.

**How to avoid:** Batch thread fetches in groups of 10–20 using `Promise.allSettled()`. Add a small sequential delay between batches (100ms is enough for most cases). If HTTP 429 is received, retry that batch after 1 second.

**Warning signs:** Sporadic empty `threads` arrays, HTTP 429 responses, or metrics that look like outliers because some thread data is missing.

**Fallback if too slow:** For large projects, time-to-first-review can be approximated as "unavailable" and the narrative notes this. The staleness check (PR-04) can still work using the PR object's `creationDate` as a conservative lower bound.

### Pitfall 3: Stale PR Detection Without Thread API

**What goes wrong:** Using `creationDate` from the PR object to determine "last activity" marks a PR as stale even if reviewers have been actively commenting on it.

**Why it happens:** The `GitPullRequest` object does not have a `lastActivityDate` field. `creationDate` is the only date on the PR itself for open PRs (active PRs have no `closedDate`).

**How to avoid:** Fetch threads for active PRs and use the maximum `publishedDate` across all threads (including system threads like RefUpdate) as the "last activity" timestamp. Any thread event — a push, a comment, a vote — resets the stale timer.

**Alternative if thread fetch is too expensive:** Use the PR's `reviewers` array to check if any reviewer has a non-zero vote. A non-zero vote is a proxy for "some review happened." This does not give a timestamp, but combined with `creationDate`, can be a cheaper approximate stale check.

### Pitfall 4: Reviewer Distribution Includes the PR Author

**What goes wrong:** PR authors appear in the `reviewers[]` array of their own PR in some ADO setups (self-review policies). This inflates their "reviewer" count.

**Why it happens:** ADO allows PR creators to be listed as required reviewers on their own PRs (e.g., for approval workflows).

**How to avoid:** When computing reviewer distribution, exclude reviewer entries where `reviewer.id === pr.createdBy.id`.

### Pitfall 5: Missing `closedDate` on Active PRs

**What goes wrong:** Trying to access `pr.closedDate` on an active PR throws no error (it's just `undefined`), but including it in cycle time calculations produces NaN or wildly wrong numbers.

**Why it happens:** `closedDate` is only populated for completed/abandoned PRs.

**How to avoid:** Filter to only `status === 'completed'` before computing cycle time. Add an explicit guard:
```javascript
const cycleTimeHours = pr.status === 'completed' && pr.closedDate
  ? (new Date(pr.closedDate) - new Date(pr.creationDate)) / 3600000
  : null;
```

### Pitfall 6: Repository ID vs. Repository Name for Per-Repo Filter

**What goes wrong:** The `--repo <name>` flag takes a human-readable repo name like "api-service". The PR per-repo endpoint requires the repository UUID (`{repositoryId}` in the path). Passing the name directly returns 404 or incorrect results.

**Why it happens:** ADO endpoints accept either UUID or name for project (path param) but the PR endpoint repo param requires UUID.

**How to avoid:** When `--repo` is specified, first call `GET _apis/git/repositories?api-version=7.1` to get the list of repos, find the one matching the name (case-insensitive), and use its `id` field. If no match is found, return a friendly error: "Repository 'api-service' not found. Available repos: [list]."

---

## Code Examples

Verified from official ADO REST API 7.1 documentation:

### Fetch All PRs Across a Project (Project-Wide Endpoint)

```javascript
// Source: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-7.1
// GET {org}/{project}/_apis/git/pullrequests

async function adoGetPrsByProject(config, params = {}) {
  const orgBase = config.orgUrl.replace(/\/$/, '');
  const url = new URL(`${orgBase}/${config.project}/_apis/git/pullrequests`);
  url.searchParams.set('api-version', '7.1');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': buildAuthHeader(config.pat),
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`PR fetch failed: ${response.status}`);
  return response.json();  // { value: GitPullRequest[], count: number }
}
```

### Fetch PR Threads (for First-Review Time and Staleness)

```javascript
// Source: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1
// GET {org}/{project}/_apis/git/repositories/{repoId}/pullRequests/{prId}/threads

async function adoGetPrThreads(config, repoId, prId) {
  const orgBase = config.orgUrl.replace(/\/$/, '');
  const url = new URL(
    `${orgBase}/${config.project}/_apis/git/repositories/${repoId}/pullRequests/${prId}/threads`
  );
  url.searchParams.set('api-version', '7.1');
  const response = await fetch(url.toString(), {
    headers: { 'Authorization': buildAuthHeader(config.pat) }
  });
  if (!response.ok) return { value: [] };  // tolerate failure for a single PR
  return response.json();  // { value: GitPullRequestCommentThread[] }
}
```

### Compute First-Review Time from Threads

```javascript
// Finds the earliest vote by someone other than the PR author
function findFirstReviewDate(threads, prCreatorId) {
  const voteThreads = (threads.value || []).filter(t => {
    const threadType = t.properties?.CodeReviewThreadType?.$value;
    if (threadType !== 'VoteUpdate') return false;
    const voterId = t.comments?.[0]?.author?.id;
    return voterId && voterId !== prCreatorId;
  });

  if (voteThreads.length === 0) return null;

  const earliest = voteThreads.reduce((min, t) =>
    t.publishedDate < min.publishedDate ? t : min
  );
  return new Date(earliest.publishedDate);
}

// Usage:
const firstReview = findFirstReviewDate(threads, pr.createdBy.id);
const timeToFirstReviewHours = firstReview
  ? (firstReview - new Date(pr.creationDate)) / 3600000
  : null;
```

### Compute Staleness for Active PRs

```javascript
// For active PRs: use the most recent thread date as last activity
function getLastActivityDate(pr, threads) {
  const threadDates = (threads.value || [])
    .map(t => new Date(t.lastUpdatedDate))
    .filter(d => !isNaN(d.getTime()));

  if (threadDates.length === 0) return new Date(pr.creationDate);
  return new Date(Math.max(...threadDates.map(d => d.getTime())));
}

function isStale(pr, threads, staleDays) {
  if (pr.status !== 'active') return false;
  const lastActivity = getLastActivityDate(pr, threads);
  const daysSinceActivity = (Date.now() - lastActivity.getTime()) / 86400000;
  return daysSinceActivity > staleDays;
}
```

### Reviewer Distribution Computation

```javascript
function computeReviewerDistribution(prs, reviewerTimesMap) {
  const reviewerStats = {};

  for (const pr of prs) {
    for (const reviewer of (pr.reviewers || [])) {
      // Skip the PR author reviewing their own PR
      if (reviewer.id === pr.createdBy.id) continue;
      // Skip zero votes (added but not acted)
      if (reviewer.vote === 0) continue;

      if (!reviewerStats[reviewer.id]) {
        reviewerStats[reviewer.id] = {
          name: reviewer.displayName,
          reviewCount: 0,
          firstReviewTimes: []
        };
      }
      reviewerStats[reviewer.id].reviewCount++;

      const firstReviewTime = reviewerTimesMap.get(`${pr.pullRequestId}:${reviewer.id}`);
      if (firstReviewTime !== undefined) {
        reviewerStats[reviewer.id].firstReviewTimes.push(firstReviewTime);
      }
    }
  }

  return Object.values(reviewerStats).map(r => ({
    name: r.name,
    reviewCount: r.reviewCount,
    avgTimeToReviewHours: r.firstReviewTimes.length > 0
      ? r.firstReviewTimes.reduce((a, b) => a + b, 0) / r.firstReviewTimes.length
      : null
  })).sort((a, b) => b.reviewCount - a.reviewCount);
}
```

### JSON Output Schema (for Claude to narrate)

```json
{
  "summary": {
    "totalPrs": 87,
    "activePrs": 12,
    "completedPrs": 75,
    "reposAnalyzed": 4,
    "repoNames": ["api-service", "web-app", "mobile", "infra"],
    "daysCovered": 365,
    "fetchedAt": "2026-02-25T14:30:00Z"
  },
  "cycleTimes": {
    "meanHours": 26.4,
    "medianHours": 18.2,
    "unit": "hours",
    "prCount": 75
  },
  "timeToFirstReview": {
    "meanHours": 5.8,
    "medianHours": 2.3,
    "unit": "hours",
    "prCount": 60,
    "missingCount": 15,
    "aboveThresholdCount": 22
  },
  "reviewerDistribution": [
    { "name": "Alice", "reviewCount": 34, "avgTimeToReviewHours": 2.1 },
    { "name": "Bob", "reviewCount": 12, "avgTimeToReviewHours": 6.7 }
  ],
  "absentReviewers": ["Charlie", "Dana"],
  "stalePrs": [
    {
      "title": "Add feature X",
      "repo": "api-service",
      "daysStale": 8,
      "createdBy": "Charlie",
      "url": "https://dev.azure.com/..."
    }
  ],
  "bottleneck": {
    "name": "Bob",
    "avgTimeToReviewHours": 6.7,
    "reviewShare": 0.14
  },
  "thresholds": {
    "staleThresholdDays": 3,
    "healthyReviewHours": 4
  },
  "errors": []
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-repo PR fetch in a loop | Project-wide PR endpoint (`_apis/git/pullrequests`) | Available since ADO REST v5+ | One API call instead of N calls; no repo listing needed for default mode |
| Manual vote timestamp parsing from description text | `CodeReviewThreadType: VoteUpdate` system thread `publishedDate` | Current ADO thread model | Reliable machine-readable first-review signal |

**Deprecated/outdated:**
- ADO Analytics OData: Cloud-only, complex protocol — out of scope for v1 (confirmed in REQUIREMENTS.md)
- `VSTS Analytics` extension API: Replaced by Analytics OData; not relevant here

---

## Open Questions

1. **Thread API rate limits for large projects**
   - What we know: ADO does rate-limit PAT requests. HTTP 429 is the response.
   - What's unclear: The exact request-per-minute limit for PAT auth is not publicly documented.
   - Recommendation: Implement batched concurrent requests (10 at a time with `Promise.allSettled()`). Add a retry on 429 with a 2-second delay. Log a warning if > 50 PRs lack thread data.

2. **"Absent reviewers" definition requires PR author list**
   - What we know: The `absentReviewers` concept (PR-03) means "people who submitted PRs but never reviewed anyone else's." This is computable from the PR dataset alone: collect all PR creators, then check which ones never appear in another PR's `reviewers[]` with a non-zero vote.
   - What's unclear: Should someone who was *added as a reviewer* (vote=0) but never actually voted count as absent? Per the context decisions, `vote === 0` means no action taken — they should be treated as absent unless they voted.
   - Recommendation: Only count people who have voted (non-zero) as active reviewers. Anyone in the PR author set who never cast a non-zero vote on any other PR is "absent from rotation."

3. **Project-wide PR endpoint page count limit**
   - What we know: `$top` max is 1000 per page, `$skip` for pagination is documented.
   - What's unclear: Whether there is a maximum total count or total `$skip` value. Very large projects (10,000+ PRs) might hit undocumented limits.
   - Recommendation: Implement the fallback strategy as designed (all-time → 1 year → 90 days). Cap total page fetches at 10 (10,000 PRs) and note in output if the cap was hit.

---

## Sources

### Primary (HIGH confidence)
- `https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-7.1` — Project-wide PR endpoint, all query parameters, response schema, pagination
- `https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests?view=azure-devops-rest-7.1` — Per-repo PR endpoint, `GitPullRequest` schema including `creationDate`, `closedDate`, `reviewers[].vote`
- `https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1` — Thread list endpoint, `GitPullRequestCommentThread` schema, `CodeReviewThreadType` values, `publishedDate`, `VoteUpdate` system thread structure
- Phase 1 implementation (`scripts/ado-client.mjs`, `scripts/config.mjs`, `skills/setup/SKILL.md`) — Established project patterns for auth, config, and skill invocation

### Secondary (MEDIUM confidence)
- Phase 1 RESEARCH.md — `IdentityRefWithVote.vote` semantics (10/5/0/-5/-10), `isContainer` flag for team reviewers (filter these out for individual attribution)

### Tertiary (LOW confidence)
- ADO rate limit behavior with PAT auth — community reports suggest ~200 req/min but this is unverified; monitor during implementation

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — All APIs verified directly from official Microsoft docs (ADO REST 7.1)
- Architecture: HIGH — Pattern follows established Phase 1 patterns; API endpoints verified
- Pitfalls: HIGH for API gotchas (status default, closedDate, vote semantics); MEDIUM for rate limit behavior (unverified limit number)
- Thread-based first-review time: HIGH — Confirmed `VoteUpdate` system thread is the correct signal from docs

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (ADO REST 7.1 is stable; check for new Claude Code plugin system changes)
