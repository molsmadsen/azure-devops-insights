# Azure DevOps Insights — Claude Code Skill Pack

## What This Is

An open-source collection of Claude Code skills (slash commands) that connect to Azure DevOps and deliver AI-narrated analysis of project health and team activity. Developers install the skill pack as a Claude Code plugin and run commands like `/adi:pr-metrics` to get written reports — findings, anomalies, and recommendations — without building custom dashboards.

**Shipped in v1.0:** Plugin scaffold, PAT-based auth (`/adi:setup`), and PR metrics skill (`/adi:pr-metrics`).

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

### Active

- [ ] Skill: Contributors — who is active, who has gone quiet (`/adi:contributors`)
- [ ] Skill: Bug report — open bugs by severity, trends, oldest unresolved (`/adi:bugs`)
- [ ] Skill: Sprint status — current sprint completion, velocity, backlog health (`/adi:sprint`)
- [ ] Skill: Project summary — narrative synthesizing PRs, contributors, bugs, sprint (`/adi:summary`)
- [ ] User can update the skill pack with `/adi:update` and see a changelog
- [ ] Each skill produces a written AI narrative with findings, anomalies, and recommendations

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

**Shipped v1.0 with ~1,175 LOC** across JavaScript (ESM .mjs) and Markdown.
**Tech stack:** Node.js (zero npm dependencies), Azure DevOps REST API, Claude Code plugin manifest format.

- Claude Code skills are markdown files that define slash commands invoked in the Claude Code CLI
- Azure DevOps REST API covers work items, PRs, git repos, sprints, contributors — no official SDK required
- Plugin installed via `--plugin-dir` flag or two-step marketplace flow (`.claude-plugin/plugin.json` + `marketplace.json`)
- Config stored at `~/.adi/config.json` with 0o600 permissions (owner-only read-write)
- HTTP 203 quirk: Azure DevOps returns 203 (login redirect) instead of 401 on wrong PAT — requires explicit status check
- ADO HTTP client pattern: `adoGet` export is orphaned — Phase 3+ authors should use the 4 dedicated functions with explicit config params

## Constraints

- **Distribution**: Installable via Claude Code `--plugin-dir` or two-step marketplace flow — low friction for adoption
- **Auth**: Credentials stored at `~/.adi/config.json` (never hardcoded or committed)
- **API**: Azure DevOps REST API only — no third-party connectors
- **Read-only**: v1 makes no writes to Azure DevOps

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multiple focused skills vs. one mega-command | Easier to run, easier to extend, clearer output | ✓ Good — `/adi:pr-metrics` validated the pattern |
| Config file auth vs. env vars | One-time setup is friendlier for casual users | ✓ Good — `~/.adi/config.json` with 0o600 works well |
| Written narrative output vs. raw data | More actionable for developers; Claude adds interpretation | ✓ Good — core differentiator, validated in v1.0 |
| Zero npm dependencies | Reduces install friction, avoids supply chain risk | ✓ Good — all Node.js built-ins sufficient for v1.0 |
| Plugin manifest approach (not npm global) | Claude Code plugin system is the right distribution channel | ✓ Good — two-step marketplace flow works as designed |
| `adoGet` not used by Phase 2+ | Different calling convention (implicit loadConfig) causes confusion | ⚠️ Revisit — document clearly for Phase 3 authors |

---
*Last updated: 2026-02-25 after v1.0 milestone*
