# Requirements: Azure DevOps Insights -- Claude Code Skill Pack

**Defined:** 2026-02-25
**Core Value:** A developer runs a skill, gets a clear AI-narrated report about their Azure DevOps project, and immediately knows what needs attention.

## v1 Requirements

### Distribution & Lifecycle

- [ ] **DIST-01**: User can install the skill pack globally with a single command (`claude plugin add github:org/repo`)
- [ ] **DIST-02**: User can update the skill pack to the latest version with `/ado:update`
- [ ] **DIST-03**: Update command shows changelog between current and new version

### Setup & Auth

- [ ] **AUTH-01**: User can run `/ado:setup` to configure org URL, project name, and PAT -- stored securely (OS credential store / keychain)
- [x] **AUTH-02**: Setup validates the PAT has sufficient permissions by making a test API call and reports which scopes are missing
- [ ] **AUTH-03**: User can re-run `/ado:setup` to reconfigure credentials without data loss

### PR Metrics

- [ ] **PR-01**: `/ado:pr-metrics` reports average time from PR open to first review
- [ ] **PR-02**: `/ado:pr-metrics` reports average time from PR open to merge (full cycle time)
- [ ] **PR-03**: `/ado:pr-metrics` shows reviewer distribution -- who reviews most, who is absent from rotation
- [ ] **PR-04**: `/ado:pr-metrics` flags stale PRs (open with no activity beyond a configurable threshold)
- [ ] **PR-05**: `/ado:pr-metrics` detects review bottlenecks and names them in the narrative (e.g. one person reviewing 70%+ of PRs)
- [ ] **PR-06**: Output is a written AI narrative with findings, anomalies, and recommendations -- not raw numbers

### Contributors

- [ ] **CONT-01**: `/ado:contributors` shows who has committed or reviewed PRs in the last 30 days
- [ ] **CONT-02**: `/ado:contributors` shows historical all-time contribution breakdown per team member
- [ ] **CONT-03**: `/ado:contributors` detects and names contributors who were previously active but have gone quiet
- [ ] **CONT-04**: Output is a written AI narrative with findings and observations

### Bugs & Work Items

- [ ] **BUG-01**: `/ado:bugs` shows open bug count broken down by severity (Critical / High / Medium / Low)
- [ ] **BUG-02**: `/ado:bugs` shows bug trend -- are bugs being created faster than they are resolved?
- [ ] **BUG-03**: `/ado:bugs` surfaces the oldest unresolved bugs by age
- [ ] **BUG-04**: Output is a written AI narrative with findings and recommendations

### Project State

- [ ] **PROJ-01**: `/ado:sprint` shows current sprint status -- items completed, remaining, velocity vs previous sprints
- [ ] **PROJ-02**: `/ado:sprint` shows backlog health -- total size, age distribution, stale items
- [ ] **PROJ-03**: `/ado:summary` synthesizes signals from PRs, contributors, bugs, and sprint into a single project health narrative

## v2 Requirements

### Enhanced Analysis

- **ENH-01**: Cross-domain correlation -- narrative connects PR slowdowns to bug spikes or contributor absences
- **ENH-02**: Pipeline / build analytics -- build success rates, flaky tests, deployment frequency
- **ENH-03**: Multi-project support -- named profiles for different orgs/projects

### Notifications

- **NOTF-01**: Scheduled report mode -- run on a schedule and output to a file
- **NOTF-02**: Threshold alerts -- warn when a metric crosses a configured threshold

## Out of Scope

| Feature | Reason |
|---------|---------|
| Write-back to Azure DevOps | Read-only in v1 -- trust must be built before any write operations |
| GitHub / GitLab integration | Azure DevOps only for v1 |
| Web UI / dashboard | CLI + Claude Code is the product; no separate frontend |
| Team comparison leaderboards | Risks toxic team dynamics |
| Azure DevOps Analytics OData | Cloud-only, adds protocol complexity -- defer to v2 |
| Azure DevOps Server (on-prem) | Scope to cloud (dev.azure.com) only for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIST-01 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Pending |
| PR-01 | Phase 2 | Pending |
| PR-02 | Phase 2 | Pending |
| PR-03 | Phase 2 | Pending |
| PR-04 | Phase 2 | Pending |
| PR-05 | Phase 2 | Pending |
| PR-06 | Phase 2 | Pending |
| CONT-01 | Phase 3 | Pending |
| CONT-02 | Phase 3 | Pending |
| CONT-03 | Phase 3 | Pending |
| CONT-04 | Phase 3 | Pending |
| BUG-01 | Phase 3 | Pending |
| BUG-02 | Phase 3 | Pending |
| BUG-03 | Phase 3 | Pending |
| BUG-04 | Phase 3 | Pending |
| PROJ-01 | Phase 4 | Pending |
| PROJ-02 | Phase 4 | Pending |
| PROJ-03 | Phase 4 | Pending |
| DIST-02 | Phase 4 | Pending |
| DIST-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
