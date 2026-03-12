# Milestones

## v1.1 — Activity Skills & Distribution (Shipped: 2026-03-12)

**Phases:** 3-4 (2 phases, 6 plans, 12 tasks)
**Git range:** d3be91e → f38be1f
**Timeline:** 15 days (2026-02-26 → 2026-03-12)
**Files:** 17 files, 1,948 insertions | ~2,872 LOC total

**Key accomplishments:**
1. Extended ADO client with 7 new API functions (commits, teams, projects, WIQL, work items batch, iterations)
2. `/adi:contributors` — active/quiet/former contributor classification with team cross-referencing
3. `/adi:bugs` — open bug analysis with severity breakdown, age analysis, assignment distribution
4. `/adi:sprint` — sprint completion, velocity trending, backlog health, burndown heuristic
5. `/adi:summary` — cross-skill synthesis with cross-cutting thematic executive briefing
6. `/adi:update` — git-based self-update with changelog; distribution polish (molsmadsen org, v1.1.0, full README)

**Known Gaps:**
- No REQUIREMENTS.md existed for v1.1 (requirements tracked in PROJECT.md Active section only)
- No milestone audit performed

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`

---

## v1.0 — Azure DevOps Insights MVP (Shipped: 2026-02-25)

**Phases:** 1, 2, 5 (3 phases, 7 plans)
**Git range:** 2eaa93a → 167c960
**Timeline:** 2026-02-25 (1 day)
**Files:** 39 files, 6,294 insertions | ~1,175 LOC

**Key accomplishments:**
1. Plugin scaffold with `.claude-plugin/plugin.json` + marketplace descriptor — two-step install flow for `/adi:*` namespace
2. Zero-dependency API client (`scripts/ado-client.mjs`) with typed error classification, PAT auth, ADO HTTP 203 quirk handling
3. `/adi:setup` interactive credential flow — stores config at `~/.adi/config.json` (0o600 permissions), validates PAT live
4. PR metrics computation (`scripts/pr-metrics.mjs`) — cycle time, reviewer distribution, stale PRs, bottleneck detection
5. `/adi:pr-metrics` AI narration skill — structured JSON → written narrative with findings, anomalies, recommendations
6. Full doc accuracy: promoted `/adi:pr-metrics` from "coming soon" to available; PR-01–PR-05 traceability complete

**Requirements shipped:** DIST-01, AUTH-01, AUTH-02, AUTH-03, PR-01, PR-02, PR-03, PR-04, PR-05, PR-06 (10/10 v1.0 requirements)

**Archive:** `.planning/milestones/v1.0-ROADMAP.md` | `.planning/milestones/v1.0-REQUIREMENTS.md`

---
