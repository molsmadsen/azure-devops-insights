# Roadmap: Azure DevOps Insights -- Claude Code Skill Pack

## Overview

This roadmap delivers a Claude Code plugin that ships AI-narrated Azure DevOps reports as slash commands. The journey starts with a working plugin scaffold and auth system, proves the skill-calls-script-Claude-narrates pattern with PR metrics, expands to contributor and bug analysis, then completes with project-level synthesis and distribution polish. Each phase delivers a usable capability that builds on the previous one.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Plugin scaffold, setup skill, and API client that connects to Azure DevOps
- [ ] **Phase 2: PR Metrics** - First skill proving the end-to-end pattern with pull request analysis
- [ ] **Phase 3: Activity Skills** - Contributors and bugs skills following the proven pattern
- [ ] **Phase 4: Project State & Distribution** - Sprint/summary synthesis and distribution polish

## Phase Details

### Phase 1: Foundation
**Goal**: User can install the plugin, configure their Azure DevOps connection, and verify it works
**Depends on**: Nothing (first phase)
**Requirements**: DIST-01, AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can install the plugin via `/plugin marketplace add your-org/azure-devops-insights` then `/plugin install adi@azure-devops-insights` and see `/adi:setup` and `/adi:help` commands available
  2. User can run `/adi:setup`, enter their org URL, project name, and PAT, and have credentials stored in `~/.adi/config.json`
  3. Setup validates the PAT by making a test API call and reports clearly whether it succeeded or which permissions are missing
  4. User can re-run `/adi:setup` to change credentials without losing existing config
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Plugin scaffold: plugin.json, marketplace.json, README, CHANGELOG
- [x] 01-02-PLAN.md — Shared scripts: config.mjs (config read/write/mask), ado-client.mjs (API client with PAT auth and error classification)
- [ ] 01-03-PLAN.md — Setup and help skills: setup.mjs, skills/setup/SKILL.md, skills/help/SKILL.md
- [ ] 01-04-PLAN.md — End-to-end verification checkpoint

### Phase 2: PR Metrics
**Goal**: User can run `/ado:pr-metrics` and receive a clear AI narrative about their pull request health
**Depends on**: Phase 1
**Requirements**: PR-01, PR-02, PR-03, PR-04, PR-05, PR-06
**Success Criteria** (what must be TRUE):
  1. User runs `/ado:pr-metrics` and sees time-to-first-review and full cycle time (open to merge) averages
  2. User sees who reviews the most and who is absent from the review rotation
  3. User sees stale PRs flagged (open with no activity beyond threshold) and review bottlenecks named in the narrative
  4. Output is a written AI narrative with findings, anomalies, and actionable recommendations -- not raw numbers or tables
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Activity Skills
**Goal**: User can analyze contributor activity and bug health through AI-narrated reports
**Depends on**: Phase 2
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. User runs `/ado:contributors` and sees who has been active in the last 30 days, all-time contribution breakdowns, and previously active contributors who have gone quiet
  2. User runs `/ado:bugs` and sees open bug counts by severity, bug creation vs resolution trend, and oldest unresolved bugs by age
  3. Both skills produce written AI narratives with findings and recommendations -- not raw data dumps
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Project State & Distribution
**Goal**: User gets a holistic project health view and can keep the plugin updated
**Depends on**: Phase 3
**Requirements**: PROJ-01, PROJ-02, PROJ-03, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. User runs `/ado:sprint` and sees current sprint status (completed, remaining, velocity vs previous sprints) and backlog health (total size, age distribution, stale items)
  2. User runs `/ado:summary` and gets a single narrative synthesizing signals from PRs, contributors, bugs, and sprint into overall project health
  3. User can run `/ado:update` to update the plugin to the latest version and see a changelog of what changed
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/4 | In progress | - |
| 2. PR Metrics | 0/0 | Not started | - |
| 3. Activity Skills | 0/0 | Not started | - |
| 4. Project State & Distribution | 0/0 | Not started | - |
