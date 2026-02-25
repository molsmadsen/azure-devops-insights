# Project Research Summary

**Project:** Azure DevOps Insights — v1.1 New Skills
**Domain:** Claude Code plugin / Azure DevOps REST API analytics
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

Azure DevOps Insights v1.1 adds five new slash commands to an already-validated v1.0 Claude Code plugin. The v1.0 foundation (Node.js ESM, native fetch, PAT auth, zero npm dependencies, plugin manifest) is production-stable and must not be re-architected. All five new skills follow the same established pattern: a SKILL.md instructs Claude to run a Node.js script via Bash, the script fetches ADO data and emits a single JSON object to stdout, and Claude writes a human-readable narrative. The primary new API surfaces are the Git Commits API (for contributors), the WIQL + Work Items Batch API (for bugs and sprint), and the Iterations API (for sprint). All endpoints are GA at api-version 7.1 and verified against official Microsoft Learn docs.

The recommended build order is dependency-driven and non-negotiable: extend `ado-client.mjs` first to add shared POST support and six new fetch functions, then build contributors, bugs, and sprint (each independent of the others), then summary (which depends on all three data scripts having stable JSON output contracts), then update (which is entirely independent of the ADO API). The `/adi:summary` skill has the hardest constraint — it cannot be tested until contributors, bugs, and sprint all emit known JSON schemas. The `/adi:update` skill is the lowest-risk item and can be built at any point.

The three highest-risk decisions in v1.1 are: (1) the sprint team-segment URL structure (a structural departure from all v1.0 endpoints), (2) the two-step work-item fetch pattern (WIQL returns IDs only; details require a separate batch POST), and (3) the multi-repo contributor loop (no project-wide commits endpoint exists). All three are well-documented in PITFALLS.md with precise avoidance strategies. One new PAT scope (`Work Items (Read)`) must be added to the `/adi:setup` validation flow — without it, bugs and sprint fail at runtime with a confusing 403.

## Key Findings

### Recommended Stack

The v1.0 stack is already correct: Node.js 18+ ESM `.mjs` files, native `fetch()`, Basic auth with a PAT, zero npm dependencies, and skills discovered by the Claude Code plugin manifest. Nothing new is needed at the language or runtime level.

New surface area in v1.1 is exclusively API-level: six new ADO REST endpoints, the Node.js built-in `child_process` module (only if an orchestrator script is chosen for summary — the recommended path avoids this), and the GitHub Releases API for the update mechanism. All new ADO endpoints are GA at api-version 7.1. The GitHub Releases API is unauthenticated at 60 req/hr — sufficient for on-demand update checks.

**Core technologies:**
- Node.js 18+ ESM (`.mjs`): runtime for all scripts — already validated, no change needed
- Native `fetch()`: HTTP client for ADO REST and GitHub Releases APIs — already validated; add POST support to `ado-client.mjs`
- ADO REST API v7.1 (GA): all six new endpoints verified at Microsoft Learn as of 2026-02-25
- GitHub Releases API (unauthenticated): used only by `update.mjs` for version checking

**Critical version requirement:** `wit/workitemsbatch` and `wit/wiql` require POST (not GET). This is the only new HTTP method pattern in v1.1. `ado-client.mjs` currently exports only GET functions; POST support is a prerequisite for bugs and sprint scripts.

### Expected Features

**Must have (table stakes) — ship in v1.1:**
- Commit count per author with configurable date window — every contributor report starts here
- "Gone quiet" detection (author active in prior window, silent in recent 30 days) — explicitly requested signal
- Open bug count by severity, oldest unresolved, unassigned Critical/High bugs — core project health view
- Current sprint identification, dates, days remaining, and work item completion percentage — first questions in any sprint review
- Cross-domain narrative synthesis in `/adi:summary` — the stated purpose of the skill
- `git pull --ff-only` plus changelog display in `/adi:update` — baseline self-update behavior

**Should have (P2 — include when implementing, low marginal cost once base is working):**
- Commit anomaly detection: spike or drop vs. prior 30-day window — two date windows, minimal extra API cost
- Bug stale detection (unchanged for N days) — mirrors stale PR logic from v1.0
- Sprint velocity across last 3 sprints — comparison against past performance; same iterations endpoint
- Days remaining vs. completion rate linear projection — arithmetic on already-fetched data
- Breaking change warning before update apply — simple CHANGELOG string search

**Defer to v2+:**
- Bus factor analysis (per-path commit filtering) — multiple API calls per path; validate demand first
- Sprint velocity via story points — many teams do not use them; item count is sufficient for v1.1
- Team capacity planning — capacity API is complex; deliver risk signal via completion rate instead
- Pipeline/build analytics and DORA metrics — separate API surface, out of scope for v1

### Architecture Approach

v1.1 is a pure extension of the v1.0 pattern with no structural changes. Each new skill follows the identical SKILL.md → script → JSON → Claude narrative chain. The shared `ado-client.mjs` is the only infrastructure file that requires modification (adding POST support and six new named export functions). No new config fields, no new auth mechanisms, no new storage locations.

The `/adi:summary` skill is intentionally script-free. Its SKILL.md runs four sequential Bash steps (pr-metrics, contributors, bugs, sprint), and Claude synthesizes all four JSON payloads into a single narrative. This avoids creating a `summary.mjs` that would duplicate fetch logic and create a maintenance dependency on four sub-script schemas. Each sub-script step degrades gracefully — if one fails (e.g., missing Work Items permission), the summary continues with the remaining payloads and notes the gap.

**Major components:**
1. `scripts/ado-client.mjs` (MODIFY) — add POST support and six new ADO fetch functions; keeps all error handling (203/401/403), auth header construction, and URL building centralized
2. `scripts/contributors.mjs` (NEW) — fetches commits per repo via loop over all repos, aggregates by author email, computes two-window activity comparison
3. `scripts/bugs.mjs` (NEW) — WIQL POST query for open bugs with date filter, batch-fetches work item details in chunks of 200
4. `scripts/sprint.mjs` (NEW) — discovers default team, fetches current iteration, batch-fetches sprint work items, computes completion rate and velocity from prior iterations
5. `scripts/update.mjs` (NEW) — checks GitHub Releases API, applies `git pull --ff-only` to plugin directory, reads CHANGELOG.md, warns user to restart Claude Code
6. `skills/*/SKILL.md` (NEW x5) — one per skill; each copies the PLUGIN_ROOT resolver verbatim from `skills/pr-metrics/SKILL.md`

### Critical Pitfalls

1. **Sprint API requires team segment in URL** — `{org}/{project}/{team}/_apis/work/teamsettings/iterations` — omitting `{team}` causes a 404. Default to project name as team slug; add `--team` flag for non-default teams. This is a structural departure from all v1.0 endpoints and is the most likely implementation error in the milestone.

2. **Work item batch returns IDs only — full details require a POST** — `GET .../iterations/{iterationId}/workitems` returns `workItemRelations[].target.id` only. State, title, and story points require a separate `POST _apis/wit/workitemsbatch` call with IDs chunked to 200 max. Missing this second call means Claude receives only ID arrays and cannot produce a sprint narrative.

3. **Contributors API is per-repository — multi-repo aggregation requires looping** — No project-wide commits endpoint exists. `contributors.mjs` must fetch all repos via `adoGetRepos()`, loop each, and aggregate by `author.email` (not display name). Single-repo projects will appear to work correctly in testing, masking the bug on real projects.

4. **WIQL bug query without date filter hits the 20,000 item hard cap** — Projects with history exceeding 20,000 total work items fail with VS402337 (non-pageable hard limit). Always include `AND [System.CreatedDate] >= @today - 180` and `$top=500` in the WIQL query.

5. **`/adi:summary` additive API cost — must run scripts sequentially** — Four scripts running sequentially makes approximately 4x the individual API calls. Running them in parallel risks ADO rate limits (200 TSTUs / 5-minute window). Sequential execution with per-step progress messages ("Fetching PR data (1/4)...") is required.

## Implications for Roadmap

The build order is dependency-constrained. Summary cannot be built until all three data scripts have stable output contracts. The ado-client extension unblocks everything else.

### Phase 1: Extend ado-client.mjs
**Rationale:** All new data scripts import from `ado-client.mjs`. POST support and the six new named functions must exist before any individual skill script can be written. Building this first prevents parallel work on Phase 2–4 from hitting blockers.
**Delivers:** A complete ADO client capable of WIQL queries, work item batch fetches, commit listing, and iteration lookups — all following the established explicit-config convention.
**Avoids:** The anti-pattern of inlining HTTP logic in individual scripts; the orphaned `adoGet` function must never be used in new scripts.
**Research flag:** None needed — the extension pattern is authoritative from v1.0 source inspection.

### Phase 2: Build /adi:contributors
**Rationale:** Uses only the Git Commits API, which is the same API surface as pr-metrics. Lowest conceptual distance from existing code. Establishes the multi-repo loop pattern and author-email deduplication strategy before entering the new Work Items API territory.
**Delivers:** `scripts/contributors.mjs` + `skills/contributors/SKILL.md` — commit activity per author, gone-quiet detection, spike/drop anomaly signal.
**Implements:** Multi-repo commit loop, two-window activity comparison, grouping-by-field aggregation pattern, `--summary` compact output mode.
**Avoids:** Pitfall 3 (per-repo loop requirement). Acceptance criteria must include testing against a project with 3+ repositories.
**Research flag:** None needed — API verified, patterns established.

### Phase 3: Build /adi:bugs
**Rationale:** Introduces the Work Items API surface (WIQL + batch POST) for the first time. Must precede sprint so the WIQL and batch POST patterns are validated in a simpler context before the more complex multi-step sprint flow.
**Delivers:** `scripts/bugs.mjs` + `skills/bugs/SKILL.md` — open bugs by severity, oldest unresolved, unassigned Critical/High bugs, stale bug detection.
**Implements:** WIQL POST query with date filter and `$top` cap, work item batch chunking (200-ID limit), `--summary` compact output mode.
**Avoids:** Pitfall 6 (WIQL unbounded query). Acceptance criteria must include inspection of the WIQL string to confirm `@today - 180` filter and `$top=500` are present.
**Research flag:** None needed — API verified. Document the "Bug vs Defect work item type" limitation explicitly for users.

### Phase 4: Build /adi:sprint
**Rationale:** Depends on the Work Items batch pattern established in Phase 3. Adds the team-scoped URL structure (the highest-risk pitfall in v1.1) and the four-step iteration lookup chain. Building after bugs ensures prior familiarity with work item batch calls.
**Delivers:** `scripts/sprint.mjs` + `skills/sprint/SKILL.md` — current sprint completion %, state distribution, days remaining vs. completion rate, velocity across last 3 sprints.
**Implements:** Default team slug fallback, iteration ID lookup, work item batch for sprint items, velocity computation from prior iterations, `--summary` compact output mode.
**Avoids:** Pitfall 1 (team segment in URL) and Pitfall 2 (iteration work items return IDs only). Both require explicit verification steps in acceptance criteria.
**Research flag:** Needs careful verification against a real ADO project with a configured sprint. The `$timeframe=current` empty-array case (no active sprint) must be handled gracefully. Note the ADO API inconsistency: iterations response uses `values` key, not `value` — this will cause a silent failure if missed.

### Phase 5: Build /adi:summary
**Rationale:** Hard dependency on Phases 2–4 having stable JSON output contracts. The SKILL.md sequences four Bash calls; if any sub-script output schema changes after this phase, the summary narrative prompt must be updated alongside it.
**Delivers:** `skills/summary/SKILL.md` — no new script; orchestrates pr-metrics, contributors, bugs, sprint into a single cross-domain project health narrative capped at ~400 words.
**Implements:** Sequential sub-script execution with per-step progress messages, graceful degradation when sub-scripts fail, lead-with-one-key-finding narrative structure, 3–5 recommended actions.
**Avoids:** Pitfall 4 (additive API cost via parallelization). The SKILL.md must explicitly run scripts sequentially.
**Research flag:** None needed — pure SKILL.md authoring once sub-scripts are stable.

### Phase 6: Build /adi:update
**Rationale:** Entirely independent of the ADO API and all other skills. Placed here so the full skill pack is in place before shipping the update mechanism. Lowest API risk but highest data-safety risk (must never touch `~/.adi/config.json`).
**Delivers:** `scripts/update.mjs` + `skills/update/SKILL.md` — check GitHub Releases API, show changelog excerpt, apply `git pull --ff-only`, warn user to restart Claude Code.
**Implements:** GitHub Releases API version check, plugin root validation using plugin manifest marker before any write, CHANGELOG.md section parsing for the newest entry, post-update restart warning.
**Avoids:** Pitfall 5 (update overwrites user config). Acceptance criteria must include a before/after `~/.adi/config.json` comparison test.
**Research flag:** The `allowed-tools: Bash(git *)` allowlist syntax is inferred from the existing `Bash(node *)` pattern but not confirmed in Claude Code documentation. Verify at implementation start.

### Phase 7: Update help, manifests, and docs
**Rationale:** Documentation and version bumps happen only after all skills are built and verified. The help skill lists commands that actually exist.
**Delivers:** `skills/help/SKILL.md` updated (five commands promoted from "coming soon"), `plugin.json` and `marketplace.json` bumped to 1.1.0, `CHANGELOG.md` and `README.md` updated.
**Research flag:** None needed — mechanical changes.

### Phase Ordering Rationale

- ado-client.mjs first because all new scripts import from it and POST support is a hard prerequisite for Work Items work.
- Contributors before bugs and sprint because the Git API is familiar from v1.0; it validates the pattern extension end-to-end before entering new API territory.
- Bugs before sprint because WIQL + batch POST is introduced in a simpler context (no team-scoped URLs, no iteration lookup chain) before sprint adds those layers.
- Summary strictly after all three data scripts because it cannot be tested without stable sub-script JSON output.
- Update last among new skills because it is independent but benefits from the full skill pack being in place before the update mechanism ships it.
- Docs after all skills because listing a command that does not work yet erodes trust.

### Research Flags

Phases needing deeper verification during implementation:
- **Phase 4 (sprint):** Team-scoped URL structure is the riskiest new API territory. Manual test against a real ADO project with an active sprint is essential. The `values` vs `value` response key inconsistency in the iterations API is a silent failure risk.
- **Phase 6 (update):** The `Bash(git *)` allowed-tools syntax needs confirmation against the actual Claude Code allowlist format before the SKILL.md is written.

Phases with standard patterns (research not needed):
- **Phase 1 (ado-client extension):** Pure code extension following established patterns; v1.0 source is authoritative.
- **Phase 2 (contributors):** Git Commits API verified; multi-repo loop pattern is explicit.
- **Phase 3 (bugs):** WIQL and work items batch verified; date filter requirement is explicit.
- **Phase 5 (summary):** Pure SKILL.md authoring; no new API surface.
- **Phase 7 (docs):** Mechanical.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All six new ADO endpoints verified at Microsoft Learn api-version 7.1 as of 2026-02-25; Node.js built-ins throughout; zero new dependencies introduced |
| Features | HIGH | Table stakes verified against official ADO API docs; differentiators confirmed feasible with no or minimal extra API calls; anti-features clearly justified with concrete alternatives |
| Architecture | HIGH | Based on direct inspection of all v1.0 source files; extension patterns are unambiguous; no inferred assumptions about v1.0 behavior |
| Pitfalls | HIGH | Six critical pitfalls each traced to a specific root cause, verified against official docs or GitHub issues, with assessed recovery costs |

**Overall confidence:** HIGH

### Gaps to Address

- **`Bash(git *)` allowlist syntax:** The `Bash(node *)` pattern is confirmed in `pr-metrics/SKILL.md`; the `git *` variant is inferred as the same mechanism but not confirmed in Claude Code documentation. Verify during Phase 6 before writing the SKILL.md. Low risk — worst case is a minor syntax adjustment.
- **Custom work item types:** Teams using "Defect" instead of "Bug" get empty results from `/adi:bugs` with no explanation. Mitigate in v1.1 with a clear error message: "Queried work item type: Bug. If your team uses a different type, use `--type=<name>`." A proper `--type` flag is deferred to v1.2.
- **`--summary` compact output mode:** PITFALLS.md flags skipping this flag as "not acceptable." Each data script (Phases 2–4) must implement a compact mode before Phase 5 (summary) is complete. Track this as an explicit acceptance criterion across three phases.
- **ADO rate limit exposure at summary scale:** At 200 TSTUs per 5-minute window, `/adi:summary` (four scripts sequential) is the most exposed path. No test data exists for the exact TSTU cost of the new Work Items endpoints. Monitor during Phase 5 acceptance testing on a large project; add pacing if needed.

## Sources

### Primary (HIGH confidence)
- [Git Commits API v7.1](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits?view=azure-devops-rest-7.1) — endpoint, searchCriteria params, GitCommitRef response shape
- [WIQL Query By Wiql v7.1](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1) — POST endpoint, 20,000 item hard cap (VS402337), WorkItemQueryResult shape
- [Work Items Batch GET v7.1](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-items-batch?view=azure-devops-rest-7.1) — POST endpoint, 200-ID limit, field list, errorPolicy
- [Work Iterations List v7.1](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.1) — `$timeframe=current`, TeamSettingsIteration shape, `values` key (not `value`)
- [Work Iterations Get Work Items v7.1](https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/get-iteration-work-items?view=azure-devops-rest-7.1) — `workItemRelations[]` IDs-only response confirmed
- [Projects Get v7.1](https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/get?view=azure-devops-rest-7.1) — `defaultTeam` field in TeamProject
- [Azure DevOps Work Item Limits](https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/object-limits?view=azure-devops) — 20,000 WIQL cap confirmed
- [Azure DevOps Rate Limits](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rate-limits?view=azure-devops) — 200 TSTU / 5-minute window
- v1.0 source files (`ado-client.mjs`, `pr-metrics.mjs`, `config.mjs`, skill SKILL.md files) — authoritative reference for all established patterns; inspected directly

### Secondary (MEDIUM confidence)
- [GitHub Releases API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) — unauthenticated endpoint, 60 req/hr, `tag_name` and `body` fields
- [Claude Code Plugin Cache Issue #15642](https://github.com/anthropics/claude-code/issues/15642) — stale CLAUDE_PLUGIN_ROOT after plugin update; session restart is the confirmed workaround
- [Keeping Claude Code plugins up to date](https://workingbruno.com/notes/keeping-claude-code-plugins-date) — confirms no native auto-update mechanism; git pull is the practical approach
- [Teams Get All Teams v7.1-preview.3](https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-all-teams?view=azure-devops-rest-7.1) — fallback team discovery; preview endpoint but stable since v4.1

### Tertiary (LOW confidence)
- `allowed-tools: Bash(git *)` syntax — inferred from the `Bash(node *)` pattern in existing SKILL.md files; not confirmed in Claude Code documentation; validate during Phase 6 implementation before writing the SKILL.md

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
