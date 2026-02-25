---
name: help
description: List all available /adi: commands and their purpose.
disable-model-invocation: true
allowed-tools: []
---

List all available Azure DevOps Insights commands:

| Command | Description |
|---------|-------------|
| `/adi:setup` | Configure your Azure DevOps connection (org URL, project name, PAT). Run this first. |
| `/adi:help` | Show this help — list all available commands. |
| `/adi:pr-metrics` | AI-narrated pull request health report (review times, stale PRs, bottlenecks). |

**Coming in future versions:**
- `/adi:contributors` — Contributor activity analysis
- `/adi:bugs` — Bug health and trend report
- `/adi:sprint` — Current sprint status and backlog health
- `/adi:summary` — Project health synthesis across all signals
- `/adi:update` — Update the plugin to the latest version

**Getting started:**
1. Run `/adi:setup` to configure your Azure DevOps connection
2. Run `/adi:pr-metrics` to see your first pull request health report
