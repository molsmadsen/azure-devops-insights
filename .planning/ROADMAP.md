# Roadmap: Azure DevOps Insights — Claude Code Skill Pack

## Milestones

- ✅ **v1.0** — Phases 1, 2, 5 (shipped 2026-02-25)
- 📋 **v1.1** — Phases 3, 4 (planned)

## Phases

<details>
<summary>✅ v1.0 — Azure DevOps Insights MVP (Phases 1, 2, 5) — SHIPPED 2026-02-25</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-02-25
- [x] Phase 2: PR Metrics (2/2 plans) — completed 2026-02-25
- [x] Phase 5: Doc & Traceability Cleanup (1/1 plan) — completed 2026-02-25

Full archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 📋 v1.1 (Planned)

- [ ] **Phase 3: Activity Skills** — Contributors and bugs skills following the proven pattern
- [ ] **Phase 4: Project State & Distribution** — Sprint/summary synthesis and distribution polish

### Phase 3: Activity Skills

**Goal:** Ship `/adi:contributors` and `/adi:bugs` skills — two new Azure DevOps analysis skills that follow the proven pr-metrics pattern (data fetch → metrics computation → AI-narrated output).

**Plans:** 3 plans

Plans:
- [ ] 03-01-PLAN.md — Extend ado-client.mjs with 5 new API functions (commits, team members, project, WIQL, work items batch)
- [ ] 03-02-PLAN.md — Build /adi:contributors skill (script + SKILL.md)
- [ ] 03-03-PLAN.md — Build /adi:bugs skill (script + SKILL.md)

**Delivers:**
- `/adi:contributors` — active, quiet, and former contributor analysis with team cross-referencing
- `/adi:bugs` — open bugs by severity, age, assignment distribution, top 5 oldest unresolved
- Shared flags (`--days`, `--repo`, `--anonymous`) consistent with existing skills
- Conditional recommendations section (only when actionable issues found)

### Phase 4: Project State & Distribution

**Goal:** Ship `/adi:sprint`, `/adi:summary`, and `/adi:update` skills — completing the v1.1 skill collection with sprint analysis, cross-skill synthesis, and self-update capability.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-02-25 |
| 2. PR Metrics | v1.0 | 2/2 | Complete | 2026-02-25 |
| 3. Activity Skills | v1.1 | 0/3 | Planned | - |
| 4. Project State & Distribution | v1.1 | 0/? | Not started | - |
| 5. Doc & Traceability Cleanup | v1.0 | 1/1 | Complete | 2026-02-25 |
