---
name: sprint
description: AI-narrated current sprint health report for your Azure DevOps project.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Generate a sprint health narrative for your Azure DevOps project. Follow these steps exactly.

## Step 0: Guard -- check config exists

Run this command to resolve the plugin root and check for config:

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/sprint.mjs" --check-config
```

Parse the JSON output:
- If `configMissing: true`: tell the user "Run `/adi:setup` first to configure your Azure DevOps connection." and stop.
- If `configMissing: false`: proceed to Step 1.

## Step 1: Parse user arguments

Extract from the user's message (if present):
- `--sprints <n>` -- override velocity trend depth (default 3)

Build the flags string by including only what the user provided:
- `--sprints=<n>` if `--sprints` was specified

## Step 2: Fetch and compute

Tell the user: "Analyzing sprint health in your Azure DevOps project..."

Run (replace `<flags>` with the flag string built in Step 1, omitting any not provided):

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/sprint.mjs" <flags>
```

Parse the JSON output.

**If the output contains a top-level `"error"` key:**
- `error.type === 'auth'`: "Authentication failed. Run `/adi:setup` to reconfigure your PAT."
- `error.type === 'permission'`: "Your PAT needs the Work Items (Read) scope. Regenerate at your ADO PAT settings."
- `error.type === 'network'`: "Could not reach Azure DevOps. Check your network and org URL."
- `error.type === 'no_sprints'`: Display the error message directly and stop.
- Any other error: "Something went wrong: [error.message]"
- Stop after any error.

**If `sprint` is `null`:** "No current sprint active. Velocity data from past sprints is shown below." Then skip to the velocity section.

Otherwise proceed to Step 3.

## Step 3: Write the narrative

Parse the JSON and write a narrative with these sections in order.

---

### Opening line (always first)

If sprint has dates:
"Current sprint: **{sprint.name}** in **{meta.project}** ({sprint.startDate} to {sprint.finishDate}). Snapshot as of {meta.generatedAt formatted as readable date}."

If sprint has no dates:
"Current sprint: **{sprint.name}** in **{meta.project}** (no dates configured). Snapshot as of {meta.generatedAt formatted as readable date}."

---

### Section: Completion Status

Show done/inProgress/notStarted counts.

If using story points (`useItemCount` is false):
"**{completion.donePoints}/{completion.totalPoints} story points complete ({pct}%)**. {completion.done} items done, {completion.inProgress} in progress, {completion.notStarted} not started."

If using item count (`useItemCount` is true):
"**{completion.done}/{completion.totalItems} items complete ({pct}%)**. {completion.inProgress} in progress, {completion.notStarted} not started. Using item count -- no story point estimates found."

Flag if < 50% complete AND sprint > 50% elapsed (from burndown.elapsedPct):
"**Warning:** Less than half the work is complete with more than half the sprint elapsed."

---

### Section: Burndown Summary

State the burndown status:
- `on-track`: "Burndown is **on track** -- completed work ({burndown.completedPct}%) is keeping pace with elapsed time ({burndown.elapsedPct}%)."
- `at-risk`: "Burndown is **at risk** -- completed work ({burndown.completedPct}%) is falling behind elapsed time ({burndown.elapsedPct}%). The team may need to adjust scope or increase throughput."
- `behind`: "Burndown is **behind schedule** -- completed work ({burndown.completedPct}%) is significantly behind elapsed time ({burndown.elapsedPct}%). Scope reduction or deadline extension likely needed."
- `unknown`: "Sprint has no dates configured -- burndown cannot be calculated."

---

### Section: Backlog Health

Report each metric:
- Unestimated: "**{backlogHealth.unestimated} items have no estimates.**" Flag if > 0: "Estimation gaps make velocity tracking unreliable."
- Unassigned: "**{backlogHealth.unassigned} items are unassigned.**" Flag if > 0: "Unassigned work risks being forgotten."
- Scope creep: "**{backlogHealth.scopeCreep} items added after sprint started.**" Flag if > 0: "Mid-sprint additions indicate scope creep."

If all three are 0: "Backlog is healthy -- all items estimated, assigned, and planned before sprint start."

---

### Section: Velocity Trend

If velocity array is empty: "No past sprint data available for velocity trending."

If velocity array has entries, show a table:

| Sprint | Completed | Total | Items |
|--------|-----------|-------|-------|
| {name} | {completedPoints} | {totalPoints} | {itemCount} |

Note the trend direction:
- Compare first and last entries in the velocity array (most recent first).
- If most recent > oldest: "Velocity is **increasing**."
- If most recent < oldest: "Velocity is **decreasing**."
- If equal (within 10%): "Velocity is **stable**."

If any sprint in the velocity array has `useItemCount: true`: "Note: Using item count for some sprints -- no story point estimates found."

---

### Section: Recommendations

Include this section ONLY when at least one of these conditions is true:
- Burndown status is `at-risk` or `behind`
- `backlogHealth.unestimated > 0`
- `backlogHealth.scopeCreep > 0`
- `backlogHealth.unassigned > 0`
- Velocity is decreasing

When included: write 2-4 specific, actionable recommendations based on the actual data. Each recommendation should be tied to a data point from the report. Use risk framing:
- e.g., "**{N} items are unestimated** -- estimate these before next standup to improve velocity accuracy."
- e.g., "Sprint is **{burndown.completedPct}% complete** with **{burndown.elapsedPct}% elapsed** -- consider removing {N} items from scope."
- e.g., "**{N} items added mid-sprint** -- discuss scope discipline in next retrospective."
- e.g., "Velocity has **decreased** over the last {N} sprints -- investigate causes (scope creep, team changes, technical debt)."

If none of the above conditions are true, omit this section entirely.

---

**Tone and style:**
- Direct and factual with risk framing -- this is a team lead tool
- No padding or filler; every sentence should contain a data point or action
- Use bold for key numbers, sprint names, and status labels
- Sections separated by `###` headers
