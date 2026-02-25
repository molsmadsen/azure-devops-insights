---
name: pr-metrics
description: AI-narrated pull request health report for your Azure DevOps project.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Generate a PR health narrative for your Azure DevOps project. Follow these steps exactly.

## Step 0: Guard — check config exists

Run this command to resolve the plugin root and check for config:

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/pr-metrics.mjs" --check-config
```

Parse the JSON output:
- If `configMissing: true`: tell the user "Run `/adi:setup` first to configure your Azure DevOps connection." and stop.
- If `configMissing: false`: proceed to Step 1.

## Step 1: Parse user arguments

Extract from the user's message (if present):
- `--repo <name>` — filter to a single repository
- `--days <n>` — override time window (e.g., `--days=90`)
- `--stale-days <n>` — override stale threshold (default: 3)
- `--project <name>` — override ADO project from config

Build the flags string by including only what the user provided:
- `--repo=<name>` if `--repo` was specified
- `--days=<n>` if `--days` was specified
- `--stale-days=<n>` if `--stale-days` was specified
- `--project=<name>` if `--project` was specified

## Step 2: Fetch and compute

Tell the user: "Fetching PR data from Azure DevOps..."

Run (replace `<flags>` with the flag string built in Step 1, omitting any not provided):

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/pr-metrics.mjs" <flags>
```

Parse the JSON output.

**If the output contains a top-level `"error"` key:**
- `error.type === 'not_found'`: "Repository not found. Available repos: [error.availableRepos joined with ', ']. Try again with one of these names."
- `error.type === 'auth'`: "Authentication failed. Run `/adi:setup` to reconfigure your PAT."
- `error.type === 'network'`: "Could not reach Azure DevOps. Check your network and org URL."
- Any other error: "Something went wrong: [error.message]"
- Stop after any error.

**If `summary.totalPrs === 0`:** "No PRs found for the selected scope. Try broadening with `--days 90` or removing the `--repo` filter."

Otherwise proceed to Step 3.

## Step 3: Write the narrative

Parse the JSON and write a narrative with these sections in order.

---

### Opening line (always first)

Write exactly:

"Analyzed **{summary.totalPrs} PRs** across **{summary.reposAnalyzed} repos** ({summary.repoNames joined with ', '}), last **{summary.daysCovered} days**."

- If `summary.daysCovered` is null or missing, write "all-time" instead of a number.
- If `summary.capHit` is true, append: "(Note: capped at 10,000 PRs — very large history)"

---

### Section: Review Speed

Lead with time-to-first-review (PR-01):

- If `timeToFirstReview.meanHours` is not null:
  - State both mean and median: e.g., "Mean time to first review: **Xh**, median: **Xh**."
  - If the mean is above the 4-hour target, flag it: "Above the 4-hour target."
  - If `timeToFirstReview.aboveThresholdCount > 0`, include: "**N PRs** exceeded the 4-hour threshold."
- If `timeToFirstReview.meanHours` is null: "No review timing data available."
- If `timeToFirstReview.missingCount > 0`: "({missingCount} PRs had no review activity)"

---

### Section: Cycle Time

Report completed PR cycle time (PR-02):

- If `cycleTimes.prCount > 0`:
  - If `cycleTimes.meanHours > 48`, express in days (round to 1 decimal): e.g., "Mean cycle time: **X.X days**, median: **X.X days** ({cycleTimes.prCount} completed PRs)."
  - Otherwise express in hours: "Mean cycle time: **Xh**, median: **Xh** ({cycleTimes.prCount} completed PRs)."
- If `cycleTimes.prCount === 0`: "No completed PRs in this window."

---

### Section: Reviewer Participation

Report reviewer activity (PR-03):

- List reviewers from `reviewerDistribution`, sorted by review count (already sorted). Show top 5 if more than 5 reviewers.
- For each: name them in bold and state their review count. Include avg time to first review if available.
  - e.g., "**Alice** — 12 reviews (avg 2.1h to first review)"
  - If `avgTimeToReviewHours` is null: omit the avg time portion.
- If `absentReviewers.length > 0`:
  "The following team members submitted PRs but did not review others: **[names joined with ', ']**."
- If `reviewerDistribution` is empty: "No reviewer activity recorded."

---

### Section: Bottlenecks

Report bottleneck analysis (PR-05):

- If `bottleneck` is not null:
  - `type === 'slow'`: "**{name}** averaged **{avgTimeToReviewHours}h** to first review — above the 4-hour target."
  - `type === 'concentrated'`: "**{name}** reviewed **{Math.round(reviewShare*100)}%** of all PRs — single point of dependency."
  - `type === 'both'`: combine both messages into one paragraph.
- If `bottleneck` is null: "No bottlenecks detected."

---

### Section: Stale PRs

Report stale open PRs (PR-04):

- If `stalePrs.length > 0`:
  - Open with: "**{stalePrs.length} stale PR(s)** (no activity for >{thresholds.staleThresholdDays} days):"
  - For each stale PR list: title, repo, age in days, author, and URL (if available).
  - e.g., "- **Fix login bug** (my-repo, {daysStale} days, by **Alice**) — {url}"
- If `stalePrs` is empty: "No stale PRs (threshold: {thresholds.staleThresholdDays} days)."

---

### Section: Recommendations

Include this section ONLY when at least one of these conditions is true:
- `timeToFirstReview.aboveThresholdCount > 0`
- `bottleneck !== null`
- `stalePrs.length > 0`
- `absentReviewers.length > 0`

When included: write 2–4 specific, actionable recommendations based on the actual data. Name specific people and specific numbers — no generic advice. Each recommendation should be tied to a data point from the report.

If none of the above conditions are true, omit this section entirely.

---

**Tone and style:**
- Direct and factual — this is a team lead tool; naming names is intentional
- No padding or filler; every sentence should contain a data point or action
- Use bold for names and key numbers
- Sections separated by `##` or `###` headers
