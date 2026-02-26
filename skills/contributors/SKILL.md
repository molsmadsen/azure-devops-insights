---
name: contributors
description: AI-narrated contributor activity report for your Azure DevOps project.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Generate a contributor activity narrative for your Azure DevOps project. Follow these steps exactly.

## Step 0: Guard — check config exists

Run this command to resolve the plugin root and check for config:

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/contributors.mjs" --check-config
```

Parse the JSON output:
- If `configMissing: true`: tell the user "Run `/adi:setup` first to configure your Azure DevOps connection." and stop.
- If `configMissing: false`: proceed to Step 1.

## Step 1: Parse user arguments

Extract from the user's message (if present):
- `--repo <name>` — filter to a single repository
- `--days <n>` — override time window (default: 30)
- `--anonymous` — hide contributor names

Build the flags string by including only what the user provided:
- `--repo=<name>` if `--repo` was specified
- `--days=<n>` if `--days` was specified
- `--anonymous` if `--anonymous` was specified

## Step 2: Fetch and compute

Tell the user: "Analyzing contributor activity in your Azure DevOps project..."

Run (replace `<flags>` with the flag string built in Step 1, omitting any not provided):

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/contributors.mjs" <flags>
```

Parse the JSON output.

**If the output contains a top-level `"error"` key:**
- `error.type === 'not_found'`: "Repository not found. Available repos: [error.availableRepos joined with ', ']. Try again with one of these names."
- `error.type === 'auth'`: "Authentication failed. Run `/adi:setup` to reconfigure your PAT."
- `error.type === 'network'`: "Could not reach Azure DevOps. Check your network and org URL."
- Any other error: "Something went wrong: [error.message]"
- Stop after any error.

**If `summary.totalCommits === 0`:** "No commit activity found in the last {summary.daysCovered} days. Try broadening with `--days 90` or removing the `--repo` filter."

Otherwise proceed to Step 3.

## Step 3: Write the narrative

Parse the JSON and write a narrative with these sections in order.

---

### Opening line (always first)

Write exactly:

"Analyzed **{summary.totalCommits} commits** across **{summary.reposAnalyzed} repos** ({summary.repoNames joined with ', '}), last **{summary.daysCovered} days**. Team: **{summary.teamName}**."

If `summary.teamDataUnavailable === true`: append on a new line: "(Note: Could not access team roster — showing all commit authors without team classification.)"

---

### Active Contributors

- List each active contributor with bold name, commit count, and repos
- Format: "**{name}** — {commitCount} commits ({repos joined with ', '})"
- Sort by commit count descending (already sorted in data)
- If empty: "No active contributors in this period."

---

### Quiet Team Members

- List team members with zero commits in the window
- Format: "**{name}** — no commits in the last {summary.daysCovered} days"
- Simple factual framing — no interpretation about why
- If empty: "All team members have been active."

---

### Former Contributors

- List people who committed but aren't on the team
- Format: "**{name}** — {commitCount} commits ({repos joined with ', '}) but no longer on the team"
- Simple factual framing — no interpretation about why they left
- If empty: "No former contributors detected."

---

### Recommendations

Include this section ONLY when at least one of these conditions is true:
- `quiet.length > 0` (quiet team members exist)
- `former.length > 0` AND at least one former contributor has significant commit count (> 10)
- Very few active contributors relative to team size: `active.length > 0` AND `active.length < (active.length + quiet.length) / 2`

When included: write 2-4 specific, actionable recommendations with risk framing. Name specific people and numbers — no generic advice. Each recommendation should be tied to a data point from the report.

Examples of risk-framed recommendations:
- If quiet members: "**{name}** has had no commits in {days} days — consider checking in to understand if there are blockers or a role change."
- If former contributors with high commit counts: "{N} former contributors account for {X} commits — verify knowledge transfer is complete for their areas."
- If few active vs team size: "Only {N} of {total} team members are actively committing — risk of knowledge concentration."

If none of the above conditions are true, omit this section entirely.

---

**Tone and style:**
- Direct and factual — naming names is intentional (unless --anonymous)
- Risk framing for findings — frame observations in terms of project risk
- No padding or filler; every sentence should contain a data point or action
- Use bold for names and key numbers
- Sections separated by `###` headers
