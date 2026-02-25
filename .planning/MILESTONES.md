# Milestones

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

