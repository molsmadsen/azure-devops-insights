# Azure DevOps Insights — Claude Code Skill Pack

## What This Is

An open-source collection of Claude Code skills (slash commands) that connect to Azure DevOps and deliver AI-narrated analysis of project health and team activity. Developers install the skill pack as a Claude Code plugin and run commands like `/adi:pr-metrics`, `/adi:contributors`, `/adi:bugs`, `/adi:sprint`, or `/adi:summary` to get written reports — findings, anomalies, and recommendations — without building custom dashboards.

**Shipped in v1.0:** Plugin scaffold, PAT-based auth (`/adi:setup`), and PR metrics skill (`/adi:pr-metrics`).
**Shipped in v1.1:** Contributors, bugs, sprint, and summary analysis skills; self-update command; distribution polish.

## Core Value

A developer can run a skill, get a clear written narrative about what's happening in their Azure DevOps project, and immediately know what needs attention.

## Requirements

### Validated

- ✓ User can install the skill pack via the two-step marketplace flow — v1.0
- ✓ User can run `/adi:setup` to configure org URL, project, and PAT — stored at `~/.adi/config.json` with 0o600 permissions — v1.0
- ✓ Setup validates the PAT by making a test API call and reports which scopes are missing — v1.0
- ✓ User can re-run `/adi:setup` to reconfigure credentials without data loss — v1.0
- ✓ `/adi:pr-metrics` reports average time-to-first-review and full cycle time — v1.0
- ✓ `/adi:pr-metrics` shows reviewer distribution and absence from rotation — v1.0
- ✓ `/adi:pr-metrics` flags stale PRs and detects review bottlenecks — v1.0
- ✓ Output is a written AI narrative with findings, anomalies, and recommendations — v1.0
- ✓ Skill: Contributors — who is active, who has gone quiet (`/adi:contributors`) — v1.1
- ✓ Skill: Bug report — open bugs by severity, trends, oldest unresolved (`/adi:bugs`) — v1.1
- ✓ Skill: Sprint status — current sprint completion, velocity, backlog health (`/adi:sprint`) — v1.1
- ✓ Skill: Project summary — narrative synthesizing PRs, contributors, bugs, sprint (`/adi:summary`) — v1.1
- ✓ User can update the skill pack with `/adi:update` and see a changelog — v1.1
- ✓ Each skill produces a written AI narrative with findings, anomalies, and recommendations — v1.1

### Active

(None — planning next milestone)

### Out of Scope

| Feature | Reason |
|---------|---------|
| Real-time dashboards or web UI | CLI/Claude Code skill, not a dashboard product |
| GitHub / GitLab integration | Azure DevOps only for v1 |
| Push notifications or scheduled reports | On-demand only |
| Writing back to Azure DevOps | Read-only for v1; trust must be built before writes |
| Azure DevOps Analytics OData | Cloud-only, adds protocol complexity — defer to v2 |
| Azure DevOps Server (on-prem) | Scope to cloud (dev.azure.com) only for v1 |

## Context

**Shipped v1.1 with ~2,872 LOC** across JavaScript (ESM .mjs) and Markdown.
**Tech stack:** Node.js (zero npm dependencies), Azure DevOps REST API, Claude Code plugin manifest format.

- Claude Code skills are markdown files that define slash commands invoked in the Claude Code CLI
- Azure DevOps REST API covers work items, PRs, git repos, sprints, contributors — no official SDK required
- Plugin installed via `--plugin-dir` flag or two-step marketplace flow (`.claude-plugin/plugin.json` + `marketplace.json`)
- Config stored at `~/.adi/config.json` with 0o600 permissions (owner-only read-write)
- HTTP 203 quirk: Azure DevOps returns 203 (login redirect) instead of 401 on wrong PAT — requires explicit status check
- 8 skills total: setup, help, pr-metrics, contributors, bugs, sprint, summary, update
- Cross-skill synthesis via child_process execSync orchestration pattern
- Sequential API calls (not parallel) for rate-limit safety throughout

## Constraints

- **Distribution**: Installable via Claude Code `--plugin-dir` or two-step marketplace flow — low friction for adoption
- **Auth**: Credentials stored at `~/.adi/config.json` (never hardcoded or committed)
- **API**: Azure DevOps REST API only — no third-party connectors
- **Read-only**: v1 makes no writes to Azure DevOps

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multiple focused skills vs. one mega-command | Easier to run, easier to extend, clearer output | ✓ Good — pattern validated across 6 analysis skills |
| Config file auth vs. env vars | One-time setup is friendlier for casual users | ✓ Good — `~/.adi/config.json` with 0o600 works well |
| Written narrative output vs. raw data | More actionable for developers; Claude adds interpretation | ✓ Good — core differentiator, validated across all skills |
| Zero npm dependencies | Reduces install friction, avoids supply chain risk | ✓ Good — all Node.js built-ins sufficient through v1.1 |
| Plugin manifest approach (not npm global) | Claude Code plugin system is the right distribution channel | ✓ Good — two-step marketplace flow works as designed |
| Sequential API calls (not parallel) | Rate-limit safety with PAT-authenticated Azure DevOps requests | ✓ Good — no rate-limit issues observed |
| Cross-cutting theme narration for summary | Weave data by theme (velocity, health, quality, actions) not per-skill | ✓ Good — more coherent executive briefing |
| Child process orchestration for summary | execSync to run sub-skills, graceful per-skill failure handling | ✓ Good — partial data degradation works cleanly |
| Story point fallback chain | StoryPoints > Effort > item count with flag for narration awareness | ✓ Good — handles diverse ADO configurations |

---
*Last updated: 2026-03-12 after v1.1 milestone*
