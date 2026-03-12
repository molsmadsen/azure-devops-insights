---
name: summary
description: AI-narrated project health synthesis across all Azure DevOps analysis skills.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Generate a cross-skill project health narrative for your Azure DevOps project. Follow these steps exactly.

## Step 0: Guard -- check config exists

Run this command to resolve the plugin root and check for config:

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/summary.mjs" --check-config
```

Parse the JSON output:
- If `configMissing: true`: tell the user "Run `/adi:setup` first to configure your Azure DevOps connection." and stop.
- If `configMissing: false`: proceed to Step 1.

## Step 1: Parse user arguments

Extract from the user's message (if present):
- `--days <n>` -- analysis window in days (default: sub-skill defaults)
- `--repo <name>` -- target a specific repository for PR and contributor data
- `--anonymous` -- anonymize contributor names

Build the flags string by including only what the user provided:
- `--days=<n>` if `--days` was specified
- `--repo=<name>` if `--repo` was specified
- `--anonymous` if `--anonymous` was specified

## Step 2: Fetch and compute

Tell the user: "Running full project health analysis across all data sources..."

Run (replace `<flags>` with the flag string built in Step 1, omitting any not provided):

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/summary.mjs" <flags>
```

Parse the JSON output.

**If the output contains a top-level `"error"` key:**
- `error.type === 'all_failed'`: "All analysis skills failed. Run `/adi:setup` to check your Azure DevOps connection."
- `error.type === 'config'`: "Not configured. Run `/adi:setup` first."
- Any other error: "Something went wrong: [error.message]"
- Stop after any error.

Otherwise proceed to Step 3.

## Step 3: Write the narrative

Parse the JSON. The output contains `prMetrics`, `contributors`, `bugs`, `sprint` (each with `ok` boolean and `data` or `error`), plus `meta`.

**Do NOT organize by skill.** Instead, weave data from all available skills into cross-cutting themes. If a skill's data is unavailable (`ok: false`), note what is missing and work with whatever data is available. Never skip a theme entirely.

---

### Opening

Write exactly:

"Project health report for **{meta.project}** as of {meta.generatedAt formatted as readable date}. Based on **{meta.skillsSucceeded}** of 4 data sources."

If any skills failed (`ok: false`), add a note: "(Note: {skillName} data unavailable -- {error})" for each failed skill. Use these display names: prMetrics = "PR Metrics", contributors = "Contributors", bugs = "Bugs", sprint = "Sprint".

---

### Theme 1: Delivery Velocity

Weave together data from sprint and prMetrics:

**From sprint data** (if `sprint.ok`):
- Current sprint name, date range, completion: `sprint.data.sprint.completion` (done/inProgress/notStarted items, donePoints/totalPoints)
- Burndown status: `sprint.data.sprint.burndown.status` (on-track / at-risk / behind) with elapsed% vs completed%
- Velocity trend: `sprint.data.velocity[]` array -- compare completedPoints across recent sprints, note trend direction

**From prMetrics data** (if `prMetrics.ok`):
- PR cycle times: `prMetrics.data.cycleTime` (medianHours, p95Hours)
- Active vs completed PRs in window
- If cycle time p95 > 48h, flag as review bottleneck

**Focus question:** Are we shipping on time? Is velocity trending up or down?

If sprint data unavailable: use PR throughput as proxy for delivery pace. If prMetrics unavailable: rely on sprint completion and velocity alone.

---

### Theme 2: Team Health

Weave together data from contributors and prMetrics:

**From contributors data** (if `contributors.ok`):
- Activity levels: `contributors.data.activityLevels` (active/quiet/former counts)
- Team size vs active contributors
- If `teamDataUnavailable` flag is true, note limitation

**From prMetrics data** (if `prMetrics.ok`):
- Reviewer distribution: identify if reviews are concentrated on few people
- Absent reviewers: `prMetrics.data.absentReviewers[]` if present
- If any reviewer has disproportionate share, flag load imbalance

**Focus question:** Is the team engaged? Is review/commit load balanced?

If contributors unavailable: use PR reviewer data as proxy. If prMetrics unavailable: use commit activity levels alone.

---

### Theme 3: Quality & Risk

Weave together data from bugs, sprint, and prMetrics:

**From bugs data** (if `bugs.ok`):
- Total open bugs: `bugs.data.summary.totalOpenBugs`
- Severity breakdown: `bugs.data.severityBreakdown[]` -- flag critical/high severity
- Bug age: `bugs.data.ageAnalysis` (meanDays, medianDays) -- flag if median > 30 days
- Top oldest unresolved: `bugs.data.oldestUnresolved[]`

**From sprint data** (if `sprint.ok`):
- Backlog health: `sprint.data.sprint.backlogHealth` (unestimated, unassigned, scopeCreep counts)
- If scopeCreep > 0, flag scope instability

**From prMetrics data** (if `prMetrics.ok`):
- Stale PRs: `prMetrics.data.stalePrs[]` if present -- flag as review risk
- If stale PRs exist AND critical bugs open, escalate risk level

**Focus question:** What could derail us? Where are the hidden risks?

If bugs unavailable: focus on sprint backlog health and stale PRs. If sprint unavailable: focus on bug severity and PR staleness.

---

### Theme 4: Actionable Items

Synthesize 3-5 specific, prioritized recommendations from ALL available data above. Each recommendation should:
- Reference data from multiple skills where possible
- Be specific (name numbers, name people if not anonymous, name sprints)
- Be actionable (what to do, not what is wrong)
- Use risk framing (tie to delivery impact)

**Priority order for recommendations:**
1. Critical bugs + sprint behind schedule = highest priority
2. Scope creep + burndown at-risk = reduce sprint scope
3. Review bottlenecks + stale PRs = address reviewer load
4. Unassigned/unestimated items = backlog grooming needed
5. Team engagement gaps = check contributor activity

Example patterns:
- "Sprint is **behind** at {elapsed}% elapsed with only {completed}% complete, AND {N} critical bugs are open -- consider reducing sprint scope and triaging bugs immediately."
- "Review load is concentrated: {reviewer} handled {N}% of reviews while {N} reviewers are absent. Redistribute review assignments."
- "{N} items are unestimated and {N} are unassigned in the current sprint -- run a backlog grooming session before the next sprint."

If limited data is available (1-2 skills only), still produce at least 2 recommendations from whatever data exists. Frame missing data as a recommendation: "PR and contributor data unavailable -- run `/adi:pr-metrics` and `/adi:contributors` individually to diagnose."

---

**Tone and style:**
- Executive briefing: concise, decisive, risk-forward
- Every sentence should contain a data point or action -- no filler
- Use bold for key numbers, names, and status indicators
- Themes separated by `---` and `###` headers
- This is the "single command to know everything" -- make it worth the user's time
