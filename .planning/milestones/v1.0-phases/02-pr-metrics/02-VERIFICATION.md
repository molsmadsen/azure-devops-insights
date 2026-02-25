---
phase: 02-pr-metrics
verified: 2026-02-25T13:00:00Z
status: human_needed
score: 11/11 must-haves verified (automated); 1 item requires human confirmation
re_verification: false
human_verification:
  - test: "Run `/adi:pr-metrics` in Claude Code with a real ADO config (~/.adi/config.json)"
    expected: "Narrative opens with 'Analyzed N PRs across N repos...', all five sections appear (Review Speed, Cycle Time, Reviewer Participation, Bottlenecks, Stale PRs), Recommendations only appears when at least one issue is detected"
    why_human: "End-to-end narrative output requires a live ADO connection and Claude narration pass — cannot be verified without real credentials and runtime execution. SUMMARY documents human approval was obtained during plan execution (checkpoint gate in 02-02-PLAN.md was marked approved). This item re-confirms that approval for the verification record."
---

# Phase 2: PR Metrics Verification Report

**Phase Goal:** Deliver the /adi:pr-metrics skill — a complete, human-verified AI-narrated PR health report covering cycle time, time-to-first-review, reviewer distribution, stale PRs, and bottleneck detection for Azure DevOps projects.
**Verified:** 2026-02-25T13:00:00Z
**Status:** human_needed (all automated checks pass; human end-to-end narrative confirmation documented in SUMMARY)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Running `node scripts/pr-metrics.mjs` outputs valid JSON with all required metric fields | VERIFIED | `--check-config` outputs `{"configMissing":false}`; all 9 top-level schema keys confirmed in result object; 26/26 source checks pass |
| 2 | Cycle time (PR-02) is computed only from completed PRs using closedDate - creationDate | VERIFIED | Line 270-273: filters `completedPrs` (status==='completed'), guards `.filter(pr => pr.closedDate)`, computes `(new Date(pr.closedDate) - new Date(pr.creationDate)) / 3600000` |
| 3 | Time-to-first-review (PR-01) is derived from VoteUpdate thread events, not the reviewers array | VERIFIED | Lines 43-55: `findFirstReviewDate` filters `CodeReviewThreadType.$value === 'VoteUpdate'`, not `pr.reviewers` |
| 4 | Stale PR detection (PR-04) uses max thread lastUpdatedDate as last activity, not creationDate | VERIFIED | Lines 61-76: `getLastActivityDate` returns `Math.max(threadDates)`, falls back to `creationDate` only when no threads |
| 5 | Reviewer distribution (PR-03) excludes self-reviews and zero-vote reviewers | VERIFIED | Lines 328-330: `if (reviewer.id === prCreatorId) continue; if (reviewer.vote === 0) continue; if (reviewer.isContainer === true) continue;` |
| 6 | Bottleneck detection (PR-05) identifies the reviewer with highest avg time-to-first-review | VERIFIED | Lines 415-465: candidates filtered to `reviewCount >= 3`; slowest by `avgTimeToReviewHours`; concentration check at >50% share |
| 7 | Thread fetches are batched in groups of 10 via Promise.allSettled to avoid rate limits | VERIFIED | Lines 160-193: `batchSize = 10`, `Promise.allSettled(batch.map(...))`, 429 retry heuristic at line 183-185 (sleep 2000ms) |
| 8 | Fallback strategy: all-time → 365 days → 90 days when PR count is large | VERIFIED | Lines 118-148: `windows = [null, 365, 90]`, falls through when `prs.length >= 500` and `window !== 90` |
| 9 | User can run `/adi:pr-metrics` and receive an AI-written narrative about PR health | VERIFIED (human) | SKILL.md exists with correct invocation; 02-02-SUMMARY documents human checkpoint approval: "narrative opens with 'Analyzed N PRs across N repos...', all sections present, Recommendations conditional on issues" |
| 10 | Skill guards against missing config (runs --check-config before fetching) | VERIFIED | SKILL.md Step 0 runs `pr-metrics.mjs --check-config` and stops with "Run `/adi:setup` first" if `configMissing: true` |
| 11 | Skill passes all user-supplied flags to the script | VERIFIED | SKILL.md Step 1 extracts `--repo`, `--days`, `--stale-days`, `--project` from user message and builds flags string passed to Step 2 invocation |

**Score:** 11/11 truths verified (10 automated, 1 human-documented)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/ado-client.mjs` | PR API fetch functions: adoGetPrsByProject, adoGetPrsByRepo, adoGetPrThreads, adoGetRepos | VERIFIED | All 4 functions exported and confirmed by runtime import: `OK: all exports present: adoGet, adoGetPrThreads, adoGetPrsByProject, adoGetPrsByRepo, adoGetRepos, buildAuthHeader, validateConnection` |
| `scripts/pr-metrics.mjs` | Full PR metrics computation script — outputs structured JSON to stdout | VERIFIED | 502 lines (well above 150-line minimum); contains `findFirstReviewDate`; 26/26 source checks pass |
| `skills/pr-metrics/SKILL.md` | /adi:pr-metrics skill definition — guards, argument parsing, script invocation, narration instructions | VERIFIED | 157 lines (above 60-line minimum); contains `pr-metrics.mjs`; 26/26 source checks pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/pr-metrics.mjs` | `scripts/ado-client.mjs` | ESM import | WIRED | Line 7: `import { adoGetPrsByProject, adoGetPrsByRepo, adoGetPrThreads, adoGetRepos } from './ado-client.mjs';` |
| `scripts/pr-metrics.mjs` | `scripts/config.mjs` | ESM import of loadConfig | WIRED | Line 6: `import { loadConfig, configExists } from './config.mjs';` |
| `scripts/pr-metrics.mjs` | stdout JSON | console.log(JSON.stringify(...)) | WIRED | Line 495: `console.log(JSON.stringify(result));`; all error paths also use `JSON.stringify` |
| `skills/pr-metrics/SKILL.md` | `scripts/pr-metrics.mjs` | Bash invocation in SKILL.md | WIRED | Step 0 and Step 2 both contain `node "$PLUGIN_ROOT/scripts/pr-metrics.mjs"` |
| `skills/pr-metrics/SKILL.md` | installed_plugins.json resolver | PLUGIN_ROOT resolver node one-liner | WIRED | Both Bash blocks contain the identical PLUGIN_ROOT one-liner using `installed_plugins.json` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PR-01 | 02-01-PLAN.md | Time from PR open to first review | SATISFIED | `findFirstReviewDate` uses VoteUpdate threads; `timeToFirstReview` in JSON schema; SKILL.md Section "Review Speed" narrates mean/median/threshold |
| PR-02 | 02-01-PLAN.md | Time from PR open to merge (cycle time) | SATISFIED | `completedPrs.filter(pr => pr.closedDate)` computes hours; `cycleTimes` in JSON schema; SKILL.md Section "Cycle Time" narrates with days conversion if >48h |
| PR-03 | 02-01-PLAN.md | Reviewer distribution — who reviews most, who is absent | SATISFIED | `reviewerStats` excludes self/zero-vote/isContainer; `absentReviewers` computed from PR-creator IDs minus active-reviewer IDs; SKILL.md Sections "Reviewer Participation" names top 5 and lists absent |
| PR-04 | 02-01-PLAN.md | Stale PRs flagged beyond configurable threshold | SATISFIED | `isStale` uses thread `lastUpdatedDate` (not `creationDate`); `stalePrs` sorted by daysStale; SKILL.md Section "Stale PRs" lists each with title/repo/age/author/URL |
| PR-05 | 02-01-PLAN.md | Bottleneck reviewer named in narrative | SATISFIED | `bottleneck` computed from candidates with 3+ reviews; concentration check at >50%; SKILL.md Section "Bottlenecks" names person with type-specific language |
| PR-06 | 02-02-PLAN.md | Output is AI narrative, not raw numbers | SATISFIED | `skills/pr-metrics/SKILL.md` defines complete narration instructions for all 5 sections with conditional Recommendations; human checkpoint in 02-02-PLAN.md confirmed readable narrative |

**Orphaned requirements:** None. All 6 IDs (PR-01 through PR-06) are claimed across the two plans and mapped to Phase 2 in REQUIREMENTS.md.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO, FIXME, placeholder, or stub patterns found in any of the three modified files. All `console.log` calls in `pr-metrics.mjs` are `JSON.stringify(...)` wrappers — stdout is pure JSON. The three `return null` occurrences in the script are legitimate guards for empty-array edge cases in `findFirstReviewDate`, `mean`, and `median`.

---

## Human Verification Required

### 1. End-to-End Narrative Flow

**Test:** Run `/adi:pr-metrics` in Claude Code against a live Azure DevOps project.
**Expected:**
- Narrative opens with "Analyzed **N PRs** across **N repos** (...), last **N days**."
- Five sections appear in order: Review Speed, Cycle Time, Reviewer Participation, Bottlenecks, Stale PRs
- Recommendations section appears only when at least one of: `aboveThresholdCount > 0`, `bottleneck !== null`, `stalePrs.length > 0`, `absentReviewers.length > 0`
- Reviewer names appear in bold; key numbers are bolded
- No raw JSON or progress messages appear in the narrative

**Why human:** End-to-end narrative quality requires Claude to process the JSON and apply the narration instructions in SKILL.md. Cannot verify prose quality, section ordering, or conditional logic execution without a live run.

**Note:** 02-02-SUMMARY.md documents that a human checkpoint was completed and approved during plan execution: "Human approved the end-to-end flow: narrative opens with 'Analyzed N PRs across N repos...', all sections present, Recommendations conditional on issues, flags pass through correctly." This satisfies the gate requirement.

---

## Summary

Phase 2 goal is achieved. All three artifacts exist at full implementation quality (not stubs):

- `scripts/ado-client.mjs` exports all 4 new PR fetch functions alongside the existing Phase 1 exports, confirmed by live Node.js import test.
- `scripts/pr-metrics.mjs` is a 502-line computation script with all 6 metric areas implemented, correct anti-pattern avoidance (searchCriteria.status=all, VoteUpdate thread usage, closedDate guard, self/zero-vote exclusion, isContainer exclusion, batched thread fetching with 429 retry). The `--check-config` mode works without network access.
- `skills/pr-metrics/SKILL.md` is a 157-line skill definition covering config guard, flag passthrough for all 4 flags, script invocation via PLUGIN_ROOT resolver, and complete narration instructions for all 5 data sections with conditional Recommendations.

All 6 requirement IDs (PR-01 through PR-06) are traceable from REQUIREMENTS.md through PLAN frontmatter to concrete implementations. All 3 documented commits (6d2cc5c, 1debb63, 37703d4) exist in git history. No anti-patterns, stubs, or orphaned artifacts found.

The sole human_needed item is confirmation of the live narrative flow, which the 02-02-SUMMARY.md documents as already approved by the human checkpoint gate.

---

_Verified: 2026-02-25T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
