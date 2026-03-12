# Phase 4: Project State & Distribution - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Three new `/adi:` skills and distribution polish. `/adi:sprint` delivers sprint completion, velocity, and backlog health analysis. `/adi:summary` synthesizes data from all four analysis skills into a cross-cutting narrative. `/adi:update` provides git-based self-update with changelog. Distribution updates include replacing `your-org` placeholder, updating help listing, full README documentation, and version bump to 1.1.0.

</domain>

<decisions>
## Implementation Decisions

### Sprint analysis (/adi:sprint)
- Reports four dimensions: completion status (% done/in-progress/not-started), velocity tracking (story points trend), backlog health (unestimated, unassigned, mid-sprint additions), and burndown summary (on track/ahead/behind)
- Story points preferred for velocity; fall back to item count if no estimates exist
- Velocity trend depth: default 3 sprints, configurable via `--sprints=N` flag
- No sprints configured → clear error: "No sprints configured for this project. /adi:sprint requires Azure DevOps iterations."
- Follows proven pattern: sprint.mjs script + SKILL.md narration instructions

### Summary synthesis (/adi:summary)
- Runs all four sub-skills live (pr-metrics.mjs, contributors.mjs, bugs.mjs, sprint.mjs) internally — always fresh data, one command
- All four skills always included — no skip/select mechanism
- Cross-cutting theme structure: organize by themes like "Team Health", "Delivery Risk", "Code Quality" weaving data from multiple skills — not section-per-skill repetition
- Graceful skip on sub-skill failure: note missing data ("Sprint data unavailable — no iterations configured") and continue with remaining skills
- Follows proven pattern: summary.mjs script + SKILL.md narration instructions

### Self-update (/adi:update)
- Git pull in plugin directory — simple, leverages existing git install
- Changelog: show git log between old and new HEAD (commit messages since last version)
- Always pulls immediately — no check-first/confirm flow
- No .git directory → error with instructions: "Update requires git. Re-install via: git clone <repo-url>"
- Follows proven pattern: update.mjs script + SKILL.md

### Distribution polish
- Replace `your-org` with `molsmadsen` in plugin.json and marketplace.json (GitHub remote: molsmadsen/azure-devops-insights)
- /adi:help updated: move all skills from "Coming soon" to main command table, remove "Coming soon" section
- README updated with full skill catalog: all 7 commands with usage examples and flags
- plugin.json version bumped to 1.1.0 to match v1.1 milestone

### Flags & configuration
- `/adi:sprint`: `--sprints=N` (default 3, velocity trend depth) — new flag
- `/adi:summary`: inherits `--days`, `--repo`, `--anonymous` and passes them to sub-skills
- `/adi:update`: no flags — always pulls immediately

### Claude's Discretion
- Sprint API implementation details (Iterations API, team settings API)
- Cross-cutting theme categories and narrative structure for summary
- Exact git commands and error handling for update
- How to import/call sub-skill scripts from summary.mjs
- Burndown on-track/behind heuristic

</decisions>

<specifics>
## Specific Ideas

- Summary should feel like an executive briefing — not a concatenation of skill outputs
- Update changelog should be concise — commit subjects only, not full diffs
- Sprint "scope creep detection" = items added after sprint start date

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ado-client.mjs`: adoWiql + adoGetWorkItemsBatch already available for sprint work item queries
- `ado-client.mjs`: adoGetProject available for project-level info
- `config.mjs`: loadConfig for credential loading
- PLUGIN_ROOT resolver pattern: established in every SKILL.md (installed_plugins.json lookup)
- Existing skill scripts (pr-metrics.mjs, contributors.mjs, bugs.mjs): summary.mjs will import and call these

### Established Patterns
- Skill architecture: .mjs data script + SKILL.md narration template
- Error handling: typed error objects (network/auth/permission/not_found/api)
- Flag conventions: --days, --repo, --anonymous
- Conditional recommendations: only when actionable issues found
- --check-config guard in every SKILL.md Step 0
- JSON stdout for skill narration, human-readable errors to stderr

### Integration Points
- New iterations/sprints API functions needed in ado-client.mjs
- summary.mjs imports from pr-metrics.mjs, contributors.mjs, bugs.mjs, sprint.mjs
- skills/sprint/SKILL.md, skills/summary/SKILL.md, skills/update/SKILL.md — new skill directories
- skills/help/SKILL.md — update command table
- plugin.json, marketplace.json — org name and version updates
- README.md — full skill documentation

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-project-state-distribution*
*Context gathered: 2026-03-12*
