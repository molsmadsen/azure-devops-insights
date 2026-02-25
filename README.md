# Azure DevOps Insights (`adi`)

AI-narrated Azure DevOps project health reports as Claude Code slash commands. Run `/adi:setup` once to connect your Azure DevOps org, then use skills like `/adi:pr-metrics`, `/adi:bugs`, and `/adi:sprint` to get clear, plain-English summaries of what needs attention — without leaving your editor.

---

## Prerequisites

- **Claude Code** v1.0.33 or later
- An **Azure DevOps account** with a Personal Access Token (PAT)
  - Required PAT scopes: Code (Read), Work Items (Read), Project and Team (Read)

---

## Install

The plugin is distributed via the Claude Code marketplace. Installation is a two-step process:

**Step 1 — Add the marketplace source:**
```
/plugin marketplace add molsmadsen/azure-devops-insights
```

**Step 2 — Install the plugin:**
```
/plugin install adi@azure-devops-insights
```

After both steps complete, all `/adi:*` commands will be available.

> Note: The shorthand `claude plugin add` syntax is not part of the current API. Always use the two-step `/plugin marketplace add` + `/plugin install` flow shown above.

---

## Setup

After installation, run setup to connect your Azure DevOps org:

```
/adi:setup
```

This will prompt you for:
1. Your Azure DevOps org URL (e.g. `https://dev.azure.com/my-org`)
2. Your project name
3. Your Personal Access Token (PAT)

On success, you will see a confirmation with your org and project name, and a note about where credentials are stored.

> Privacy: Config is stored at `~/.adi/config.json` — keep this file private. It contains your PAT in plaintext.

---

## Skills Reference

| Command | Description |
|---------|-------------|
| `/adi:setup` | Configure your Azure DevOps connection (org URL, project name, PAT). Run this first. Re-run to update credentials. |
| `/adi:help` | List all available commands and their purpose. |
| `/adi:pr-metrics` | AI-narrated pull request health report — review times, stale PRs, bottlenecks. |

### Coming Soon (Phase 3+)

| Command | Description |
|---------|-------------|
| `/adi:contributors` | Contributor activity and commit distribution |
| `/adi:bugs` | Bug trend and open issue summary |
| `/adi:sprint` | Current sprint health and completion forecast |
| `/adi:summary` | Full project health report combining all metrics |
| `/adi:update` | Refresh all cached data from Azure DevOps |

---

## Local Development

To test the plugin locally without installing it from the marketplace:

```bash
claude --plugin-dir .
```

This makes all `/adi:*` skills available immediately. The `CLAUDE_PLUGIN_ROOT` environment variable is set correctly in this mode.

> Note: Skills reference scripts via a runtime path resolver (not `${CLAUDE_PLUGIN_ROOT}`) due to a known limitation of the Claude Code plugin system. See [GitHub Issue #9354](https://github.com/anthropics/claude-code/issues/9354).

---

## Privacy

Configuration is stored at `~/.adi/config.json` and contains your Azure DevOps PAT in plaintext. Keep this file private and do not commit it to source control. The file is created with owner-read-only permissions (`0o600`) on Unix systems.
