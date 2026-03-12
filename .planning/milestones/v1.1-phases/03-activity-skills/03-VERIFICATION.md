---
phase: 03-activity-skills
verified: 2026-02-26T00:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
human_verification:
  - test: "Run /adi:contributors against a live Azure DevOps project"
    expected: "Narrative classifies team members as active, quiet, or former; recommendations appear only when actionable issues exist; --anonymous replaces names with generic labels"
    why_human: "Requires live ADO connection with real commit history and team membership data"
  - test: "Run /adi:bugs against a live Azure DevOps project"
    expected: "Narrative shows severity breakdown, bug age, top 5 oldest by name and age, assignment distribution; recommendations appear only when conditions met"
    why_human: "Requires live ADO connection with open work items in the system"
  - test: "Verify /adi:bugs --types 'Bug,Defect,Issue' includes alternate work item types"
    expected: "WIQL query dynamically includes all specified types; no hardcoded 'Bug' assumption"
    why_human: "Requires a project with multiple work item types to validate the comma-separated parsing"
---

# Phase 03: Activity Skills Verification Report

**Phase Goal:** Ship /adi:contributors and /adi:bugs skills — two new Azure DevOps analysis skills that follow the proven pr-metrics pattern (data fetch → metrics computation → AI-narrated output).
**Verified:** 2026-02-26
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `adoGetCommits` fetches commits for a given repo with date filtering | VERIFIED | `scripts/ado-client.mjs` line 132 — GET `git/repositories/${repoId}/commits`, accepts `searchCriteria.*` params, typed error handling |
| 2 | `adoGetTeamMembers` fetches team members for a project's default team | VERIFIED | `scripts/ado-client.mjs` line 162 — org-scoped URL `_apis/projects/${project}/teams/${teamId}/members`, 401/203/403 error handling |
| 3 | `adoGetProject` fetches project metadata including defaultTeam | VERIFIED | `scripts/ado-client.mjs` line 189 — org-scoped URL `_apis/projects/${project}`, returns defaultTeam.id/name |
| 4 | `adoWiql` executes a WIQL POST query and returns work item IDs | VERIFIED | `scripts/ado-client.mjs` line 216 — POST with `method:'POST'`, `body:JSON.stringify({query})`, 401/203/403 handling |
| 5 | `adoGetWorkItemsBatch` fetches work items with 200-ID chunking | VERIFIED | `scripts/ado-client.mjs` lines 246-282 — `chunkSize=200`, loop with sequential POST requests, merges via `allItems.push(...)`, returns `{value: allItems}` |
| 6 | All new ado-client functions accept explicit config (no internal loadConfig) | VERIFIED | All 5 new functions take `config` as first argument; `loadConfig` only in legacy `adoGet` at line 13 |
| 7 | Running /adi:contributors produces active/quiet/former narrative | VERIFIED | `scripts/contributors.mjs` classifies into three arrays, SKILL.md instructs narrative with three sections |
| 8 | --anonymous flag and config.anonymous hide contributor names | VERIFIED | `contributors.mjs` line 47 — `args.anonymous === 'true' \|\| config.anonymous === true`; lines 221-224 replace name+email with generic labels |
| 9 | --days and --repo flags work consistently with pr-metrics | VERIFIED | `contributors.mjs` lines 18-19 parse both; `--repo` does repo filter (lines 62-76), `--days` sets `sinceDate` (line 81) |
| 10 | Conditional recommendations section appears only when actionable | VERIFIED | `skills/contributors/SKILL.md` lines 102-114: "Include ONLY when..." with 3 conditions; "omit this section entirely" when none |
| 11 | Running /adi:bugs produces severity/age/assignment narrative | VERIFIED | `scripts/bugs.mjs` computes all 4 metrics; `skills/bugs/SKILL.md` instructs 5 sections |
| 12 | Top 5 oldest unresolved bugs highlighted by name and age | VERIFIED | `bugs.mjs` lines 173-190 sort by CreatedDate ASC, slice(0,5), include `title`/`ageDays`/`assignedTo` |
| 13 | Severity grouping is process-template agnostic (raw values) | VERIFIED | `bugs.mjs` line 128 — `f['Microsoft.VSTS.Common.Severity'] \|\| 'Unspecified'` — no hardcoded severity names |
| 14 | --types flag overrides default 'Bug' work item type | VERIFIED | `bugs.mjs` line 18 — `const typesRaw = args.types \|\| 'Bug'`; line 62 splits on comma |

**Score:** 14/14 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/ado-client.mjs` | Five new named exports for Phase 3 skills | VERIFIED | 5 exports confirmed: adoGetCommits (L132), adoGetTeamMembers (L162), adoGetProject (L189), adoWiql (L216), adoGetWorkItemsBatch (L246) |
| `scripts/contributors.mjs` | Contributor data fetching and classification | VERIFIED | 253 lines (min 80), full active/quiet/former logic, --check-config, --days, --repo, --anonymous |
| `skills/contributors/SKILL.md` | Claude narration instructions | VERIFIED | `disable-model-invocation: true`, references `contributors.mjs`, 3-section narrative, conditional recommendations |
| `scripts/bugs.mjs` | Bug data fetching and metrics computation | VERIFIED | 236 lines (min 80), WIQL query, severity/age/top5/assignment metrics, --check-config, --types |
| `skills/bugs/SKILL.md` | Claude narration instructions for bug data | VERIFIED | `disable-model-invocation: true`, references `bugs.mjs`, 5-section narrative, conditional recommendations |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/ado-client.mjs` | Azure DevOps REST API | `fetch` with `buildAuthHeader(config.pat)` | WIRED | All 5 new functions use `buildAuthHeader(config.pat)` |
| `scripts/contributors.mjs` | `scripts/ado-client.mjs` | import named functions | WIRED | Line 8: `import { adoGetCommits, adoGetTeamMembers, adoGetProject, adoGetRepos } from './ado-client.mjs'` |
| `skills/contributors/SKILL.md` | `scripts/contributors.mjs` | PLUGIN_ROOT resolver + node invocation | WIRED | Lines 15, 41: verbatim PLUGIN_ROOT resolver + `node "$PLUGIN_ROOT/scripts/contributors.mjs"` |
| `scripts/bugs.mjs` | `scripts/ado-client.mjs` | import named functions | WIRED | Line 7: `import { adoWiql, adoGetWorkItemsBatch } from './ado-client.mjs'` |
| `skills/bugs/SKILL.md` | `scripts/bugs.mjs` | PLUGIN_ROOT resolver + node invocation | WIRED | Lines 15, 41: verbatim PLUGIN_ROOT resolver + `node "$PLUGIN_ROOT/scripts/bugs.mjs"` |

---

## Requirements Coverage

No requirement IDs declared in any plan's frontmatter (`requirements: []` in all three plans). Phase-level prompt states "Phase requirement IDs: none." No entries in REQUIREMENTS.md to cross-reference. No orphaned requirements found.

---

## Commit Verification

All commits documented in SUMMARY files exist and are valid:

| Commit | Summary claim | Verified |
|--------|---------------|---------|
| `d3be91e` | feat(03-01): add GET functions | YES |
| `79541c0` | feat(03-01): add POST functions | YES |
| `effcf86` | feat(03-02): create contributors.mjs | YES |
| `6f83620` | feat(03-02): create contributors SKILL.md | YES |
| `bb11d90` | feat(03-03): create bugs SKILL.md | YES |

Note: bugs.mjs was committed in `effcf86` alongside contributors.mjs (documented deviation in 03-02-SUMMARY and 03-03-SUMMARY). Content verified correct — no functional impact.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/bugs.mjs` | 38, 43 | `return null` in helper functions | INFO | Expected — `mean()` and `median()` return null for empty arrays; this is correct behavior signaling no data, not a stub |

No TODO/FIXME/HACK/placeholder comments found. No empty handlers. No stub implementations. No console.log-only handlers.

---

## Notable Implementation Details

**adoGetProject URL (org-scoped, not project-scoped):** Correctly uses `${orgBase}/_apis/projects/${config.project}` rather than the erroneous `${orgBase}/${config.project}/_apis/projects/...` pattern. This matches the ADO Projects API contract.

**adoGetTeamMembers URL (org-scoped):** Uses `${orgBase}/_apis/projects/${config.project}/teams/${teamId}/members` — also org-scoped, consistent with ADO Teams API.

**errorPolicy: "omit":** Present in `adoGetWorkItemsBatch` body (line 263) — silently skips unreadable items rather than failing the entire batch.

**Sequential commit fetching:** `contributors.mjs` fetches repos in a `for...of` loop (not `Promise.all`) — correct for rate-limit safety per plan.

**Graceful team data degradation:** When `adoGetProject` or `adoGetTeamMembers` fail, `contributors.mjs` sets `teamMembers = null` and sets `teamDataUnavailable: true` in output — full degradation path wired.

**PLUGIN_ROOT resolver:** Both new SKILL.md files use the identical one-liner from `skills/pr-metrics/SKILL.md` — consistent plugin resolution across all skills.

---

## Human Verification Required

### 1. Live /adi:contributors Run

**Test:** Run `/adi:contributors` against an Azure DevOps project that has commit history and team membership set up
**Expected:** Narrative appears with Active Contributors, Quiet Team Members, and Former Contributors sections; Recommendations section appears only when quiet/former conditions are met; `--anonymous` replaces names with "Active Contributor N" etc.
**Why human:** Requires live ADO credentials, real commit data, and real team roster — cannot be verified with grep alone

### 2. Live /adi:bugs Run

**Test:** Run `/adi:bugs` against an Azure DevOps project with open bugs
**Expected:** Narrative appears with Severity Breakdown, Bug Age, Top 5 Oldest, and Assignment Distribution sections; overloaded flag triggers for assignees with >5 bugs; Recommendations section omitted when no actionable conditions
**Why human:** Requires live ADO connection and real work items

### 3. /adi:bugs --types Override

**Test:** Run `/adi:bugs --types "Bug,Defect,Issue"` on a project using non-standard work item type names
**Expected:** WIQL query includes all three types; no errors from type mismatch
**Why human:** Requires a project using alternate work item type names to exercise the comma-separated parsing path

---

## Summary

Phase 03 fully achieves its goal. Both /adi:contributors and /adi:bugs skills are shipped following the proven pr-metrics pattern:

- **Data layer (Plan 01):** 5 new API functions added to `ado-client.mjs` with correct URL patterns (org-scoped where required), POST support, 200-ID chunking, and typed error handling consistent with existing functions
- **Contributors skill (Plan 02):** `contributors.mjs` correctly fetches commits per repo sequentially, aggregates by email, cross-references team membership, classifies into active/quiet/former arrays, supports all required flags including dual-source anonymous mode; `SKILL.md` provides complete narration instructions with conditional recommendations
- **Bugs skill (Plan 03):** `bugs.mjs` queries open bugs via WIQL with process-template-agnostic severity grouping, computes age buckets, highlights top 5 oldest with names and ages, maps assignment distribution with overloaded detection; `SKILL.md` provides complete narration instructions with 5 sections and conditional recommendations

All automated checks pass. Three human verification items remain for live integration testing.

---

_Verified: 2026-02-26_
_Verifier: Claude (gsd-verifier)_
