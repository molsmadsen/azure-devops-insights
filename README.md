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
| `/adi:contributors` | Contributor activity analysis — active, quiet, and former members. |
| `/adi:bugs` | Open bug health report — severity, age, assignment distribution. |
| `/adi:sprint` | Current sprint health — completion, velocity, backlog, burndown. |
| `/adi:summary` | Full project health synthesis across all analysis skills. |
| `/adi:update` | Update the plugin to the latest version via git pull. |

### `/adi:pr-metrics`

Pull request health report with review speed, cycle time, reviewer participation, bottleneck detection, and stale PR identification.

```
/adi:pr-metrics
/adi:pr-metrics --days=90 --repo=my-api
```

**Flags:**
- `--repo <name>` — Filter to a single repository
- `--days <n>` — Time window in days (default: 30)
- `--stale-days <n>` — Days of inactivity before a PR is considered stale (default: 3)
- `--project <name>` — Override Azure DevOps project from config

### `/adi:contributors`

Contributor activity analysis showing active, quiet, and former team members based on commit history.

```
/adi:contributors
/adi:contributors --days=60 --anonymous
```

**Flags:**
- `--days <n>` — Time window in days (default: 30)
- `--repo <name>` — Filter to a single repository
- `--anonymous` — Replace names and emails with generic labels

### `/adi:bugs`

Open bug health report with severity breakdown, age distribution, and assignment analysis.

```
/adi:bugs
/adi:bugs --types=Bug,Defect --days=90
```

**Flags:**
- `--types <list>` — Comma-separated work item types to include (default: Bug)
- `--days <n>` — Time window in days for trend analysis

### `/adi:sprint`

Current sprint health including completion status, velocity tracking, backlog health, and burndown summary.

```
/adi:sprint
/adi:sprint --sprints=5
```

**Flags:**
- `--sprints <n>` — Number of past sprints for velocity trend (default: 3)

### `/adi:summary`

Full project health synthesis that runs all analysis skills and weaves results into a cross-cutting executive briefing.

```
/adi:summary
/adi:summary --days=60 --repo=my-api --anonymous
```

**Flags:**
- `--days <n>` — Time window in days (default: 30)
- `--repo <name>` — Filter to a single repository
- `--anonymous` — Replace names and emails with generic labels

### `/adi:update`

Update the plugin to the latest version by pulling from the git repository. Shows a changelog of new commits.

```
/adi:update
```

No flags. Pulls immediately and reports what changed.

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
