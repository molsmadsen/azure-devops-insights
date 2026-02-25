---
name: setup
description: Configure your Azure DevOps connection (org URL, project name, PAT). Run this first.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Configure your Azure DevOps connection. Follow these steps exactly.

## Step 0: Check for existing config

Run this command to get the plugin root path and check for existing config:

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/setup.mjs" --read
```

Parse the JSON output:
- If `exists: false` → proceed to Step 1 (full setup)
- If `exists: true` → show the user their current config:
  ```
  Current config:
    Org URL:  <orgUrl>
    Project:  <project>
    PAT:      <pat (masked)>

  Which field would you like to update? (org URL / project name / PAT / all)
  ```
  Based on the user's answer, only re-prompt the selected field(s). Keep the others from existing config.

## Step 1: Collect org URL

Ask: "What is your Azure DevOps org URL?"

Example: `https://dev.azure.com/my-org`

## Step 2: Collect project name

Ask: "What is the project name in that org?"

## Step 3: Collect PAT

Ask: "What is your Personal Access Token (PAT)?"

When asking for the PAT, include this guidance:

> **Required scopes** (create PAT at https://dev.azure.com/{org}/_usersSettings/tokens):
> - Code (Read)
> - Work Items (Read)
> - Project and Team (Read)
>
> Use minimum required scopes. The token will be stored in `~/.adi/config.json`.

## Step 4: Validate and save

Resolve plugin root and run setup:

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/setup.mjs" --org="<org_url>" --project="<project_name>" --pat="<pat_token>"
```

Parse the JSON output and narrate:

**If `success: true`:**
> Connected to **<orgUrl>** / **<project>**.
> Config saved to `~/.adi/config.json` — keep this file private.
> You're ready — try `/adi:pr-metrics`

**If `error.type === 'network'`:**
> I can't reach that org URL. Please check: is `<orgUrl>` correct?
Then re-prompt for the org URL (Step 1) and retry validation.

**If `error.type === 'auth'`:**
> The PAT was rejected. It may be expired or invalid. Please enter a new PAT.
Then re-prompt for the PAT (Step 3) and retry validation.

**If `error.type === 'permission'` and `error.missingScope`:**
> The PAT is valid but missing the "**<missingScope>**" permission.
> Add this scope at: https://dev.azure.com/{org}/_usersSettings/tokens
> Once you've updated the PAT, paste the new token here.
Then re-prompt for the PAT (Step 3) and retry validation.

**If `error.type === 'not_found'`:**
> Project not found. Please check the project name — it should match exactly as shown in Azure DevOps.
Then re-prompt for the project name (Step 2) and retry validation.

Do NOT exit on validation failure — re-prompt only the failed field and retry.
