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
| `/adi:contributors` | Contributor activity analysis (active, quiet, former members). |
| `/adi:bugs` | Open bug health report (severity, age, assignment distribution). |
| `/adi:sprint` | Current sprint health (completion, velocity, backlog, burndown). |
| `/adi:summary` | Full project health synthesis across all analysis skills. |
| `/adi:update` | Update the plugin to the latest version via git pull. |

**Getting started:**
1. Run `/adi:setup` to configure your Azure DevOps connection
2. Run any analysis skill (`/adi:pr-metrics`, `/adi:bugs`, `/adi:sprint`, `/adi:contributors`) or `/adi:summary` for a full project overview
