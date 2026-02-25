# Research Summary: Azure DevOps Insights -- Claude Code Skill Pack

**Domain:** Developer tooling / Claude Code plugin / Azure DevOps integration
**Researched:** 2026-02-25
**Overall confidence:** HIGH

## Executive Summary

This project is a Claude Code plugin that ships AI-narrated Azure DevOps reports as slash commands. The architecture is remarkably simple because Claude Code skills are markdown files -- Claude itself is the runtime. There is no application server, no compiled code, and no framework.

The distribution mechanism is Claude Code's native plugin system (`claude plugin add github:org/repo`), which launched with v1.0.33 and is now the standard for sharing skills. The older npm global install pattern mentioned in PROJECT.md is unnecessary and adds friction. A plugin is just a GitHub repo with a `.claude-plugin/plugin.json` manifest and a `skills/` directory.

Data-fetching logic lives in Node.js scripts (.mjs files) that use only built-in Node.js APIs (native `fetch()`, `fs`, `path`, `os`). Node.js was chosen over bash/curl for cross-platform compatibility -- Claude Code requires Node.js 18+, so it is guaranteed present on every machine that can run the plugin. The project has zero npm dependencies. No `package.json` with dependencies, no `node_modules`, no `npm install` step.

Azure DevOps REST API v7.1 (GA) covers all needed data: pull requests, work items, commits, sprints, and team members. Authentication uses Personal Access Tokens with Basic auth. PAT and org config live in `~/.ado-insights/config.json`, matching the convention used by gh CLI, az CLI, and similar tools.

## Key Findings

**Stack:** Claude Code plugin with Node.js (.mjs) helper scripts. Zero npm dependencies. Distribution via `claude plugin add`.
**Architecture:** Plugin with 5 skills (setup, pr-metrics, contributors, bugs, project-state). Scripts output structured JSON; skills tell Claude how to narrate it.
**Critical pitfall:** Azure DevOps API pagination is inconsistent (continuation tokens vs $top/$skip vs WIQL ID-only results). Build endpoint-specific fetchers, not a generic paginator.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation** -- Plugin scaffold, config system, API client
   - Addresses: Plugin manifest, setup skill, config.mjs, ado-client.mjs
   - Avoids: Building skills before the plumbing works

2. **First Skill (PR Metrics)** -- Prove the pattern end-to-end
   - Addresses: PR metrics feature, narrative output format, the skill-calls-script-Claude-narrates pattern
   - Avoids: Building all skills before validating the approach works

3. **Remaining Skills** -- Contributors, bugs, project state
   - Addresses: Full feature set
   - Avoids: Premature optimization; all follow the proven pattern from Phase 2

4. **Polish and Distribution** -- README, marketplace listing, edge cases
   - Addresses: Open source readiness, community contribution docs
   - Avoids: Polishing before features are complete

**Phase ordering rationale:**
- Config/auth must exist before any skill can call the API (hard dependency)
- One skill must be fully working before building more (validates the pattern)
- PR metrics is the best first skill: exercises the most API surface area (PRs, reviewers, threads) and is the highest-value feature
- Remaining skills are independent and can be built in parallel once the pattern is proven
- Distribution is last because you need working skills to distribute

**Research flags for phases:**
- Phase 1: Need to validate `${CLAUDE_PLUGIN_ROOT}` variable behavior for script paths in installed plugins
- Phase 2: Azure DevOps PR thread/review data structure specifics need hands-on investigation
- Phase 3: WIQL query syntax for complex work item filtering (date formats, field reference names)
- Phase 4: Plugin marketplace submission process may need research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Plugin system and skill format well-documented by Anthropic. Node.js built-in APIs are stable. |
| Features | HIGH | Azure DevOps API endpoints confirmed in Microsoft Learn docs. |
| Architecture | HIGH | Plugin structure is prescribed by Claude Code docs. Script-outputs-data, Claude-narrates pattern is validated. |
| Pitfalls | HIGH | Pagination, PAT auth, context window, and cross-platform issues all well-documented. |

## Gaps to Address

- Exact behavior of `${CLAUDE_PLUGIN_ROOT}` in installed vs local dev plugins (needs hands-on testing)
- Azure DevOps API rate limits for PAT-authenticated requests (documented as TSTUs but exact thresholds unclear)
- Whether `claude plugin add` works with private GitHub repos (authentication flow unclear)
- Optimal narrative prompt engineering (will emerge iteratively during development)
- WIQL query syntax for complex bug/work item date filtering (phase-specific research)
