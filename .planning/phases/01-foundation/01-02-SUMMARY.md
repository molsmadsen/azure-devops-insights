---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [azure-devops, node-esm, config, pat-auth, http-client]

# Dependency graph
requires: []
provides:
  - "scripts/config.mjs: loadConfig, saveConfig, configExists, maskPat — reads/writes ~/.adi/config.json"
  - "scripts/ado-client.mjs: adoGet, validateConnection, buildAuthHeader — ADO REST API client with typed error classification"
affects: [all future phases that call Azure DevOps API or read config]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero npm dependencies — all Node.js built-ins (fs, os, path, fetch, Buffer)"
    - "ESM .mjs modules imported via relative paths"
    - "Typed error objects via Object.assign(new Error(...), { type: 'network'|'auth'|'permission'|'api'|'not_found' })"
    - "Config permissions via writeFileSync mode 0o600 (Unix owner-only read-write)"

key-files:
  created:
    - scripts/config.mjs
    - scripts/ado-client.mjs
  modified: []

key-decisions:
  - "HTTP 203 treated as auth error: Azure DevOps returns 203 (login redirect) instead of 401 on wrong PAT encoding — response.ok is true for 203 so explicit status check required"
  - "Two-step validateConnection: org-level _apis/projects first (checks URL + PAT), then project-level git/repositories (checks Code Read scope) — maps each failure to a human-readable message"
  - "Colon prefix in PAT encoding: Buffer.from(':' + pat.trim()) is centralized in buildAuthHeader so it cannot be duplicated incorrectly anywhere"
  - "os.homedir() over process.env.HOME: HOME is not set on all Windows environments; os.homedir() is cross-platform"

patterns-established:
  - "Pattern: Config path constant defined once in config.mjs — all scripts import from there, never hardcode ~/.adi"
  - "Pattern: API_VERSION constant '7.1' in ado-client.mjs — never inline the version string"
  - "Pattern: configOverride parameter in adoGet for testing without reading disk config"

requirements-completed: [AUTH-02]

# Metrics
duration: 1min
completed: 2026-02-25
---

# Phase 1 Plan 02: Shared Infrastructure (config.mjs + ado-client.mjs) Summary

**ESM config manager for ~/.adi/config.json and Azure DevOps Basic auth client with HTTP 203 handling and two-step PAT scope validation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-25T08:39:15Z
- **Completed:** 2026-02-25T08:40:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- config.mjs implements loadConfig/saveConfig/configExists/maskPat using os.homedir() for cross-platform compatibility; saveConfig sets file mode 0o600
- ado-client.mjs implements buildAuthHeader with mandatory colon prefix, adoGet with HTTP 203 auth error handling, and validateConnection with two sequential API calls mapping failures to typed error objects
- Both modules use only Node.js built-in APIs — zero npm dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1: Config manager (config.mjs)** - `8291d53` (feat)
2. **Task 2: Azure DevOps API client (ado-client.mjs)** - `242c789` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `scripts/config.mjs` - Config read/write/mask for ~/.adi/config.json; exports loadConfig, saveConfig, configExists, maskPat
- `scripts/ado-client.mjs` - Azure DevOps REST API client; exports adoGet, validateConnection, buildAuthHeader

## Decisions Made

- **HTTP 203 as auth error:** Azure DevOps sometimes returns HTTP 203 (Non-Authoritative Information / login redirect) instead of 401 when PAT encoding is wrong. Since `response.ok` is true for 203, an explicit `response.status === 203` check is required alongside `=== 401`. This prevents silent auth failures that would appear as JSON parse errors or unexpected HTML responses.

- **Two-step validateConnection design:** The function makes two sequential fetch calls: (1) `_apis/projects?$top=1` at org level to verify the org URL is reachable and the PAT is accepted; (2) `{project}/_apis/git/repositories` at project level to verify `Code (Read)` scope. Each failure maps to a distinct `type` field (`network`, `auth`, `permission`, `not_found`) with a human-readable message and, for permission failures, a `missingScope` field naming the exact Azure DevOps scope.

- **Centralized buildAuthHeader:** The colon prefix (`':' + pat.trim()`) required by Azure DevOps Basic auth is implemented once in buildAuthHeader and used by both adoGet and validateConnection. This prevents the common mistake of encoding the PAT without the colon prefix, which causes HTTP 401 or the silent HTTP 203 redirect.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required at this stage.

## Next Phase Readiness

- config.mjs and ado-client.mjs are ready for import by all future scripts
- setup.mjs (Plan 03) can import { saveConfig, maskPat } from './config.mjs' and { validateConnection } from './ado-client.mjs'
- All data scripts in Phases 2-4 can use adoGet with a config loaded via loadConfig()

---
*Phase: 01-foundation*
*Completed: 2026-02-25*
