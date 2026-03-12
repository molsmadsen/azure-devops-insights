---
name: update
description: Update the Azure DevOps Insights plugin to the latest version.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Update the Azure DevOps Insights plugin to the latest version via git pull. Follow these steps exactly.

## Step 0: Resolve plugin root

Run this command to resolve the plugin root:

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && echo "Plugin root: $PLUGIN_ROOT"
```

## Step 1: Run update

```bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/update.mjs"
```

Parse the JSON output.

## Step 2: Narrate the result

**If the output contains `error.type === 'no_git'`:**
Display the error message and stop: "Update requires git. Re-install the plugin via: `git clone https://github.com/molsmadsen/azure-devops-insights`"

**If `updated: false`:**
"Azure DevOps Insights is already up to date."

**If `updated: true`:**
"Updated Azure DevOps Insights from {oldHead} to {newHead}.

**Changes:**
{Format each line of changelog as a bullet point — one commit per line}"
