# Azure DevOps Insights — Claude Code Skill Pack

## What This Is

An open-source collection of Claude Code skills (slash commands) that connect to Azure DevOps and deliver AI-narrated analysis of project health and team activity. Developers install the skill pack globally and run commands like `/ado:pr-metrics` or `/ado:contributors` to get written reports — findings, anomalies, and recommendations — without building custom dashboards.

## Core Value

A developer can run a skill, get a clear written narrative about what's happening in their Azure DevOps project, and immediately know what needs attention.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can run a setup command to configure org URL, project, and PAT token (stored in a local config file)
- [ ] Skill: PR metrics — how long PRs take to get reviewed, who reviews, bottlenecks
- [ ] Skill: Contributors — who is active, who has contributed historically
- [ ] Skill: Bug report — open bugs, severity breakdown, trends
- [ ] Skill: Project state — overall sprint/backlog health, general narrative summary
- [ ] Each skill produces a written AI narrative (findings, anomalies, recommendations)
- [ ] Skills are installable globally via npm (or equivalent) so any Claude Code user can use them
- [ ] Repository is open source and documented for community contribution

### Out of Scope

- Real-time dashboards or web UI — this is a CLI/Claude Code skill, not a dashboard product
- GitHub / GitLab integration — Azure DevOps only for v1
- Push notifications or scheduled reports — runs on-demand only
- Writing back to Azure DevOps (creating work items, commenting on PRs) — read-only for v1

## Context

- Claude Code skills are markdown files that define slash commands; they're invoked in the Claude Code CLI and have access to Claude's tool use (Bash, file reading, web fetch, etc.)
- Azure DevOps exposes a REST API that covers work items, pull requests, git repos, sprints, contributors, and more — no official Node SDK required, raw HTTP calls work fine
- The skill pack needs a PAT token with read permissions on the target project
- The target audience is developers who use Claude Code day-to-day and want quick project visibility without leaving their terminal

## Constraints

- **Distribution**: Must be installable via a single global command (e.g., `npm install -g ado-insights`) — low friction for adoption
- **Auth**: Credentials stored in a local config file (e.g., `~/.ado-insights/config.json`) — never hardcoded or committed
- **API**: Azure DevOps REST API only — no third-party connectors
- **Read-only**: v1 makes no writes to Azure DevOps

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multiple focused skills vs. one mega-command | Easier to run, easier to extend, clearer output | — Pending |
| Config file auth vs. env vars | One-time setup is friendlier for casual users | — Pending |
| Written narrative output vs. raw data | More actionable for developers; Claude adds interpretation | — Pending |

---
*Last updated: 2026-02-25 after initialization*
