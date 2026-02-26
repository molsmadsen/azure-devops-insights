---
name: bugs
description: AI-narrated open bug report for your Azure DevOps project.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Generate an open bug health narrative for your Azure DevOps project. Follow these steps exactly.

## Step 0: Guard — check config exists

Run this command to resolve the plugin root and check for config:

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/bugs.mjs" --check-config
```

Parse the JSON output:
- If `configMissing: true`: tell the user "Run `/adi:setup` first to configure your Azure DevOps connection." and stop.
- If `configMissing: false`: proceed to Step 1.

## Step 1: Parse user arguments

Extract from the user's message (if present):
- `--types <list>` — override work item types (e.g., `--types "Bug,Defect,Issue"`)
- `--days <n>` — age context reference (default 30) — note: does NOT filter bugs, only used for context in narrative

Build the flags string by including only what the user provided:
- `--types=<list>` if `--types` was specified
- `--days=<n>` if `--days` was specified

Note: `--repo` is not applicable to bugs (work items are project-scoped, not repo-scoped).

## Step 2: Fetch and compute

Tell the user: "Querying open bugs in your Azure DevOps project..."

Run (replace `<flags>` with the flag string built in Step 1, omitting any not provided):

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/bugs.mjs" <flags>
```

Parse the JSON output.

**If the output contains a top-level `"error"` key:**
- `error.type === 'auth'`: "Authentication failed. Run `/adi:setup` to reconfigure your PAT."
- `error.type === 'permission'`: "Your PAT needs the Work Items (Read) scope. Regenerate at your ADO PAT settings."
- `error.type === 'network'`: "Could not reach Azure DevOps. Check your network and org URL."
- Any other error: "Something went wrong: [error.message]"
- Stop after any error.

**If `summary.totalOpenBugs === 0`:** "No open bugs found (queried types: {queriedTypes joined with ', '}). If you expected bugs, try `--types 'Bug,Defect,Issue'` to broaden the search."

Otherwise proceed to Step 3.

## Step 3: Write the narrative

Parse the JSON and write a narrative with these sections in order.

---

### Opening line (always first)

Write exactly:

"Found **{summary.totalOpenBugs} open bugs** in **{summary.project}** (queried types: {summary.queriedTypes joined with ', '}). Snapshot as of {summary.queryDate formatted as readable date}."

---

### Section: Severity Breakdown

For each severity group (in order from severityBreakdown):
- "**{severity}**: {count} bugs"
- If severity starts with "1" or contains "Critical": add risk flag — "Delivery risk: {count} critical bugs remain open."

If all bugs are low severity (no group starts with "1" or "2"): note this positively — "All open bugs are lower severity — no critical or high-priority items."

---

### Section: Bug Age

State mean and median age:
- "Mean age: **{ageAnalysis.meanDays} days**, median: **{ageAnalysis.medianDays} days**."

Show age buckets:
- "0-7 days: {N}, 8-30 days: {N}, 31-90 days: {N}, 90+ days: {N}"

Flags:
- If `ageAnalysis.medianDays > 30`: "Median bug age is **{medianDays} days** — bugs are aging."
- If `ageAnalysis.buckets['90+ days'] > 0`: "**{N} bugs** are over 90 days old."

---

### Section: Top 5 Oldest Unresolved

List each with bold title, severity, age, and assignee:
- "1. **{title}** — {severity}, {ageDays} days old, assigned to **{assignedTo}**"

If assignedTo is "Unassigned": flag it — "1. **{title}** — {severity}, {ageDays} days old, **unassigned**"

These are highlighted explicitly by name and age to surface delivery risk.

---

### Section: Assignment Distribution

List assignees sorted by bug count (already sorted descending):
- "**{assignee}** — {count} open bugs ({severity breakdown as comma-separated list})"

For each entry where `overloaded === true`:
- Append flag: "**overloaded** (>5 open bugs)"

Highlight unassigned bugs count separately:
- If any assignee is "Unassigned": "**{count} bugs are unassigned** — no one is responsible for these."

---

### Section: Recommendations

Include this section ONLY when at least one of these conditions is true:
- Critical or high severity bugs exist (any severity starting with "1" or "2")
- `ageAnalysis.medianDays > 30`
- Any assignee has `overloaded === true`
- Unassigned bugs exist

When included: write 2-4 specific, actionable recommendations based on the actual data. Name specific people and specific bugs — no generic advice. Each recommendation should be tied to a data point from the report. Use risk framing:
- e.g., "**{N} critical bugs** open >{days} days — delivery risk. Triage immediately."
- e.g., "**{assignee}** has {count} open bugs — reassign {N} medium-severity items to balance the load."
- e.g., "**{count} bugs are unassigned** — assign owners to prevent these from aging further."

If none of the above conditions are true, omit this section entirely.

---

**Tone and style:**
- Direct and factual with risk framing — this is a team lead tool; naming names is intentional
- No padding or filler; every sentence should contain a data point or action
- Use bold for titles, names, and key numbers
- Sections separated by `###` headers
