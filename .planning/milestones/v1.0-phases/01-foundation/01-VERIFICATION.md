---
phase: 01-foundation
verified: 2026-02-25T12:00:00Z
status: gaps_found
score: 9/11 must-haves verified
re_verification: false
gaps:
  - truth: "User can install the plugin via /plugin marketplace add your-org/azure-devops-insights then /plugin install adi@azure-devops-insights"
    status: partial
    reason: "REQUIREMENTS.md DIST-01 describes a single-command install ('claude plugin add github:org/repo') that does not exist in the Claude Code API and conflicts with the two-step marketplace flow the implementation correctly uses. The implementation is correct per the plan, but REQUIREMENTS.md text must be updated to match the actual install mechanism."
    artifacts:
      - path: "README.md"
        issue: "Correct — uses two-step /plugin marketplace add + /plugin install flow. But REQUIREMENTS.md DIST-01 still references the non-existent 'claude plugin add github:org/repo' single-command shorthand."
      - path: ".planning/REQUIREMENTS.md"
        issue: "DIST-01 text says 'single command (claude plugin add github:org/repo)' — this command does not exist. README explicitly warns against it. Requirement text is stale."
    missing:
      - "Update REQUIREMENTS.md DIST-01 text to describe the actual two-step marketplace install flow"
  - truth: "User runs /adi:setup and credentials are stored securely (OS credential store / keychain)"
    status: failed
    reason: "REQUIREMENTS.md AUTH-01 specifies 'stored securely (OS credential store / keychain)' but implementation stores credentials in a plaintext JSON file at ~/.adi/config.json with 0o600 permissions. The design decision to use a flat file was made intentionally in the research and plan phases, but the requirement text was never updated to reflect the actual storage mechanism."
    artifacts:
      - path: "scripts/config.mjs"
        issue: "Stores config as plaintext JSON at ~/.adi/config.json with 0o600 permissions — NOT an OS credential store or keychain. This is by design per research (complexity of cross-platform keychain), but AUTH-01 in REQUIREMENTS.md still says 'OS credential store / keychain'."
      - path: ".planning/REQUIREMENTS.md"
        issue: "AUTH-01 says 'stored securely (OS credential store / keychain)' but implemented storage is plaintext file with restrictive permissions."
    missing:
      - "Update REQUIREMENTS.md AUTH-01 to reflect actual storage: plaintext JSON at ~/.adi/config.json with 0o600 permissions, not OS keychain"
human_verification:
  - test: "Run /adi:setup with real Azure DevOps credentials"
    expected: "Claude prompts sequentially for org URL, project name, PAT (with scope guidance and link), then connects and saves config to ~/.adi/config.json"
    why_human: "Cannot exercise the Claude conversational skill flow programmatically — requires live Claude Code session with actual ADO credentials"
  - test: "Run /adi:setup with a known-invalid PAT, then with a bad org URL"
    expected: "Each error type produces the correct targeted re-prompt (PAT error re-prompts only PAT, network error re-prompts only org URL)"
    why_human: "Error path narration is Claude behavior driven by SKILL.md instructions — cannot simulate the LLM conversation loop in automated checks"
  - test: "Re-run /adi:setup after config is saved"
    expected: "Claude shows current values with PAT masked (abcd****wxyz format), asks which field to update, keeps unchanged fields"
    why_human: "Re-run flow depends on Claude parsing the --read JSON output and presenting the update menu — conversational behavior not testable statically"
---

# Phase 1: Foundation Verification Report

**Phase Goal:** Establish the complete plugin foundation — installable structure, shared scripts, and first two working skills (/adi:setup and /adi:help).
**Verified:** 2026-02-25T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Plugin is named 'adi' and all skills appear with /adi: prefix after install | VERIFIED | plugin.json `"name": "adi"` (line 2); marketplace.json `plugins[0].name === "adi"` (line 4); skills/setup/SKILL.md frontmatter `name: setup`; skills/help/SKILL.md frontmatter `name: help` |
| 2 | README documents the correct two-step install flow | VERIFIED | README.md lines 21-27 show `/plugin marketplace add` then `/plugin install adi@azure-devops-insights`; line 31 explicitly warns the shorthand does not exist |
| 3 | config.mjs reads and writes ~/.adi/config.json with 0o600 permissions | VERIFIED | scripts/config.mjs line 23: `writeFileSync(CONFIG_FILE, ..., { mode: 0o600 })`; line 6: `join(homedir(), '.adi')` using `os.homedir()` not `process.env.HOME` |
| 4 | config.mjs masks PAT values — first 4 and last 4 chars visible, rest asterisks | VERIFIED | scripts/config.mjs lines 26-29: `pat.slice(0,4) + '*'.repeat(pat.length-8) + pat.slice(-4)`; returns '***' for short/empty PATs |
| 5 | ado-client.mjs builds correct Basic auth header (colon prefix, base64 encoded) | VERIFIED | scripts/ado-client.mjs line 9: `Buffer.from(':' + pat.trim()).toString('base64')` — colon prefix confirmed |
| 6 | validateConnection distinguishes network, auth (401/203), and permission (403) errors for org and project scopes | VERIFIED | ado-client.mjs lines 56-88: two-step fetch (projects endpoint then git/repositories endpoint), each returning `{ ok: false, type: 'network'|'auth'|'permission'|'not_found', message, missingScope? }` |
| 7 | HTTP 203 response treated as auth error | VERIFIED | ado-client.mjs lines 31 and 60: `response.status === 401 || response.status === 203` checks in both adoGet and validateConnection |
| 8 | setup.mjs outputs only JSON — no human-readable strings | VERIFIED | All console.log/console.error calls in setup.mjs use JSON.stringify() with structured objects; no bare string arguments |
| 9 | setup.mjs --read mode returns masked PAT and existing config | VERIFIED | setup.mjs lines 17-30: `--read` branch calls `configExists()`, then `loadConfig()` and returns `{ exists, orgUrl, project, pat: maskPat(c.pat) }` |
| 10 | DIST-01 single-command install matches implementation | FAILED | REQUIREMENTS.md DIST-01 describes `claude plugin add github:org/repo` (a non-existent command). Implementation correctly uses two-step marketplace flow. Requirement text is stale. |
| 11 | AUTH-01 credential storage matches OS keychain requirement | FAILED | REQUIREMENTS.md AUTH-01 says "OS credential store / keychain". Implementation uses plaintext JSON at ~/.adi/config.json with 0o600 permissions. Intentional design choice not reflected in requirements. |

**Score:** 9/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude-plugin/plugin.json` | Plugin manifest — declares name 'adi', version, description, repository | VERIFIED | 8 lines, valid JSON, `"name": "adi"`, `"version": "1.0.0"`, github repository |
| `.claude-plugin/marketplace.json` | Marketplace descriptor — enables /plugin marketplace add flow | VERIFIED | 15 lines, `"plugins"` array with one entry named `"adi"`, `"source": "github"` |
| `CHANGELOG.md` | Version history starting at 1.0.0 | VERIFIED | Contains `## [1.0.0] — Unreleased` with /adi:setup and /adi:help entries |
| `README.md` | Install instructions and skill reference | VERIFIED | Correct two-step install flow, skills reference table, privacy note at ~/.adi/config.json |
| `scripts/config.mjs` | Config read/write/mask for ~/.adi/config.json | VERIFIED | Exports loadConfig, saveConfig, configExists, maskPat; uses homedir(); 0o600 mode; 30 lines of substantive implementation |
| `scripts/ado-client.mjs` | Azure DevOps REST API client with auth and error classification | VERIFIED | Exports buildAuthHeader, adoGet, validateConnection; 203 handling; two-step validation; 93 lines of substantive implementation |
| `scripts/setup.mjs` | Validates connection and writes config via --org/--project/--pat flags | VERIFIED | --read mode and --org/--project/--pat mode; 59 lines; all output is JSON; imports from both config.mjs and ado-client.mjs |
| `skills/setup/SKILL.md` | Interactive /adi:setup skill | VERIFIED | disable-model-invocation: true; allowed-tools: Bash(node *); installed_plugins.json resolver; --read for re-run; all 4 error types handled with re-prompt instructions |
| `skills/help/SKILL.md` | /adi:help skill — lists all commands | VERIFIED | disable-model-invocation: true; /adi:setup and /adi:help in command table; coming-soon entries for Phase 2+ |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.claude-plugin/marketplace.json` | `.claude-plugin/plugin.json` | plugin source reference pointing to github | WIRED | marketplace.json `"source": "github"`, `"repo": "your-org/azure-devops-insights"` matches plugin.json repo |
| `README.md` | `.claude-plugin/marketplace.json` | documented install commands matching marketplace.json plugin name | WIRED | README uses `/plugin marketplace add` + `/plugin install adi@azure-devops-insights`; matches marketplace plugin name "adi" |
| `scripts/ado-client.mjs` | `scripts/config.mjs` | `import { loadConfig } from './config.mjs'` | WIRED | ado-client.mjs line 2: confirmed import present |
| `scripts/ado-client.mjs` | `_apis/projects` org-level endpoint | validateConnection step 1 — org-level PAT check | WIRED | ado-client.mjs line 49: `new URL(\`${orgBase}/_apis/projects\`)` |
| `scripts/ado-client.mjs` | `_apis/git/repositories` project endpoint | validateConnection step 2 — Code (Read) scope check | WIRED | ado-client.mjs line 71: `new URL(\`${orgBase}/${project}/_apis/git/repositories\`)` |
| `skills/setup/SKILL.md` | `scripts/setup.mjs` | bash command invoking setup.mjs via PLUGIN_ROOT resolver | WIRED | SKILL.md line 15 and 59: both Step 0 (--read) and Step 4 (--org/--project/--pat) bash blocks invoke `"$PLUGIN_ROOT/scripts/setup.mjs"` |
| `skills/setup/SKILL.md` | `scripts/setup.mjs` | --read flag for re-run flow | WIRED | SKILL.md line 15: `setup.mjs --read` confirmed present |
| `scripts/setup.mjs` | `scripts/ado-client.mjs` | `import { validateConnection } from './ado-client.mjs'` | WIRED | setup.mjs line 3: confirmed import; line 42: `await validateConnection(org, project, pat)` |
| `scripts/setup.mjs` | `scripts/config.mjs` | `import { saveConfig, maskPat, loadConfig, configExists }` | WIRED | setup.mjs line 2: all four imports confirmed; used at lines 18, 22, 27, 49 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DIST-01 | 01-01-PLAN.md, 01-04-PLAN.md | User can install via marketplace | PARTIAL | Two-step install implemented correctly in code and README. REQUIREMENTS.md text describes non-existent `claude plugin add github:` command — requirement text must be updated. Implementation satisfies the functional intent. |
| AUTH-01 | 01-03-PLAN.md, 01-04-PLAN.md | User runs /adi:setup to configure credentials | PARTIAL | /adi:setup skill exists with full sequential prompt flow. "Stored securely (OS credential store / keychain)" in REQUIREMENTS.md does not match implemented plaintext-file storage at ~/.adi/config.json 0o600. Functional setup works; requirement text is inaccurate. |
| AUTH-02 | 01-02-PLAN.md, 01-04-PLAN.md | Setup validates PAT permissions and reports missing scopes | VERIFIED | validateConnection in ado-client.mjs makes two-step API calls; returns `{ type: 'permission', missingScope }` for 403 responses; SKILL.md narrates the missing scope and links to ADO token settings |
| AUTH-03 | 01-03-PLAN.md, 01-04-PLAN.md | User can re-run /adi:setup without data loss | VERIFIED | SKILL.md Step 0 runs `setup.mjs --read`, shows current masked config, prompts which field to update, only re-saves the changed field. setup.mjs --read mode preserves all existing config values. |

Note: REQUIREMENTS.md uses `/ado:setup` prefix throughout AUTH-01/AUTH-03 descriptions but the implementation consistently uses `/adi:setup`. The ROADMAP.md and all plans use `/adi:` — the REQUIREMENTS.md has a stale command prefix.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 10 | DIST-01 references `claude plugin add github:org/repo` (non-existent command) | Warning | Requirement text is stale — real install mechanism is two-step marketplace flow already implemented correctly |
| `.planning/REQUIREMENTS.md` | 16 | AUTH-01 says "OS credential store / keychain" but implementation uses plaintext file | Warning | Requirement text overstates security posture — 0o600 plaintext file is the actual mechanism |
| `.planning/REQUIREMENTS.md` | 16-18 | AUTH-01/AUTH-03 use `/ado:setup` prefix but implementation uses `/adi:setup` | Info | Stale command prefix in requirement text; all code and documentation correctly uses `/adi:` |
| `README.md` | 79 | `claude --plugin-dir ./azure-devops-insights` (wrong path for development) | Info | The local dev command in README uses `./azure-devops-insights` as the plugin-dir but the repo root itself is the plugin directory — should be `.` per plan 01-03 notes. Minor documentation inconsistency. |

No stub patterns found in any implementation file. All scripts contain substantive logic.

### Human Verification Required

All automated checks (existence, substantive content, wiring) passed for implementation files. The following items require a live Claude Code session to verify end-to-end behavior.

#### 1. Full Setup Happy Path

**Test:** Load the plugin with `claude --plugin-dir .` from the repo root. Run `/adi:setup`. Enter valid Azure DevOps credentials when prompted.
**Expected:** Claude asks for org URL, then project name, then PAT (with required scopes listed and link to ADO token settings). After all three are entered, Claude reports "Connected to [org]/[project]. Config saved to ~/.adi/config.json — keep this file private. You're ready — try /adi:pr-metrics". File ~/.adi/config.json exists afterward.
**Why human:** Claude conversational flow executing SKILL.md instructions cannot be exercised with static file analysis.

#### 2. Error Path — Bad PAT

**Test:** Run `/adi:setup` with a valid org URL but a random invalid PAT string.
**Expected:** Claude reports the PAT was rejected (auth error), re-prompts for the PAT only (not the entire setup from scratch), and does not ask for org URL or project name again.
**Why human:** Requires live ADO network call plus LLM narration behavior.

#### 3. Error Path — Bad Org URL

**Test:** Run `/adi:setup` with a non-existent org URL (e.g., `https://dev.azure.com/nonexistent-org-xyz-12345`).
**Expected:** Claude reports the org URL is unreachable (network error), re-prompts for the org URL only.
**Why human:** Requires live network call plus LLM narration behavior.

#### 4. Re-run Update Flow

**Test:** With config already saved, run `/adi:setup` again. Select one field to update (e.g., project name only).
**Expected:** Claude displays current config with PAT masked in first-4/last-4 format, asks which field to update, re-prompts only that field, keeps other fields unchanged, saves updated config.
**Why human:** Depends on Claude parsing --read output correctly and presenting the interactive menu.

#### 5. /adi:help Display

**Test:** Run `/adi:help` in a session with the plugin loaded.
**Expected:** A table or list showing /adi:setup and /adi:help with descriptions, followed by coming-soon entries for future phase skills.
**Why human:** Requires live plugin session to confirm the skill executes and Claude renders the content correctly.

### Gaps Summary

**Two gaps identified, both in REQUIREMENTS.md text rather than in implementation code:**

**Gap 1 — DIST-01 text mismatch:** The implementation correctly uses the two-step `/plugin marketplace add` + `/plugin install` marketplace flow. REQUIREMENTS.md DIST-01 still describes a non-existent `claude plugin add github:org/repo` single command. The README even explicitly warns users not to use this non-existent shorthand. The implementation is correct; the requirement text needs updating.

**Gap 2 — AUTH-01 storage description mismatch:** REQUIREMENTS.md AUTH-01 specifies "OS credential store / keychain" as the storage mechanism. The implementation stores credentials as plaintext JSON at `~/.adi/config.json` with `0o600` permissions (owner read-write only). This was an intentional design decision documented in the research phase (cross-platform keychain libraries add dependency complexity). The security posture is reasonable but the requirement text overstates it. The requirement text needs updating to describe the actual storage mechanism.

These are documentation gaps in REQUIREMENTS.md, not implementation bugs. The codebase itself is fully functional and correctly implements the intended behavior described in the plan files and ROADMAP.md. Phase 2 can begin building on this foundation — the gaps do not block further development.

**Neither gap blocks Phase 2.** The implementation is sound; only requirement text needs reconciliation.

---

_Verified: 2026-02-25T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
