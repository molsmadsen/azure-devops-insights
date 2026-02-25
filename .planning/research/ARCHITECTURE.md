# Architecture Research

**Domain:** Claude Code plugin — Azure DevOps Insights skill pack (v1.1 new skills integration)
**Researched:** 2026-02-25
**Confidence:** HIGH — based on direct inspection of all v1.0 source files

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Claude Code CLI                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  setup   │  │pr-metrics│  │contributors│  │  bugs   │            │
│  │ SKILL.md │  │ SKILL.md │  │ SKILL.md  │  │ SKILL.md│            │
│  └────┬─────┘  └────┬─────┘  └─────┬────┘  └────┬────┘            │
│       │              │              │             │                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  sprint  │  │ summary  │  │  update  │  │   help   │            │
│  │ SKILL.md │  │ SKILL.md │  │ SKILL.md │  │ SKILL.md │            │
│  └────┬─────┘  └─────┬────┘  └──────────┘  └──────────┘            │
│       │               │                                              │
│       └───────────────┴──────────────────────┐                      │
│                       node <script>.mjs       │                      │
├───────────────────────────────────────────────┼─────────────────────┤
│                    Script Layer               │                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │   scripts/ado-client.mjs  (shared HTTP + auth functions)    │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│  ┌───────────────────────────┴──────────────────────────────────┐   │
│  │   scripts/config.mjs  (loadConfig / saveConfig / configExists) │  │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                    Data / External Layer                             │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐    │
│  │  ~/.adi/config.json  │   │  Azure DevOps REST API v7.1      │    │
│  │  (org/project/PAT)   │   │  (git, wit, work endpoints)      │    │
│  └──────────────────────┘   └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `skills/*/SKILL.md` | Define slash command; instruct Claude on steps; invoke scripts via Bash | Markdown with YAML frontmatter (`allowed-tools: Bash(node *)`) |
| `scripts/<skill>.mjs` | Fetch ADO data, compute metrics, emit JSON to stdout | Node.js ESM `.mjs`; stderr for progress; stdout is JSON only |
| `scripts/ado-client.mjs` | Shared HTTP client — auth header, per-resource fetch functions | Named async exports; config always passed explicitly |
| `scripts/config.mjs` | Read/write `~/.adi/config.json`; existence check; PAT masking | `loadConfig`, `saveConfig`, `configExists`, `maskPat` exports |
| `.claude-plugin/plugin.json` | Claude Code plugin manifest — registers the `adi` plugin name | JSON metadata; skills auto-discovered from `skills/` |
| `.claude-plugin/marketplace.json` | Two-step marketplace install entry (GitHub source) | References plugin repo; version field |

---

## Recommended Project Structure (v1.1 additions)

```
azure-devops-insights/
├── .claude-plugin/
│   ├── plugin.json              # MODIFY: bump version to 1.1.0
│   └── marketplace.json         # MODIFY: bump version to 1.1.0
├── skills/
│   ├── setup/SKILL.md           # NO CHANGE
│   ├── help/SKILL.md            # MODIFY: promote new commands from "coming soon" to active
│   ├── pr-metrics/SKILL.md      # NO CHANGE
│   ├── contributors/SKILL.md    # NEW
│   ├── bugs/SKILL.md            # NEW
│   ├── sprint/SKILL.md          # NEW
│   ├── summary/SKILL.md         # NEW — orchestrates four sub-script calls
│   └── update/SKILL.md          # NEW — self-update mechanism
├── scripts/
│   ├── config.mjs               # NO CHANGE
│   ├── ado-client.mjs           # MODIFY: add new ADO fetch functions
│   ├── setup.mjs                # NO CHANGE
│   ├── pr-metrics.mjs           # NO CHANGE
│   ├── contributors.mjs         # NEW
│   ├── bugs.mjs                 # NEW
│   ├── sprint.mjs               # NEW
│   └── update.mjs               # NEW
├── CHANGELOG.md                 # MODIFY: add v1.1.0 section
└── README.md                    # MODIFY: add new commands to skill list
```

### Structure Rationale

- **`skills/<name>/SKILL.md`:** One directory per skill, matching the v1.0 pattern. Claude Code discovers skills by directory name within `skills/`.
- **`scripts/<skill>.mjs`:** One script per skill, named to match. Each script is independently runnable (`node scripts/contributors.mjs`), which aids testing.
- **`scripts/ado-client.mjs` extended — not replaced:** New fetch functions (work items, iterations, commits, pushes) added to the shared client, not inlined in individual scripts. This matches how all existing functions are organized.
- **No `scripts/summary.mjs`:** The summary skill orchestrates the four existing scripts via sequential Bash calls in the SKILL.md. No aggregation script is needed.
- **`scripts/update.mjs`:** Self-contained; does not use `ado-client.mjs` (talks to GitHub API, not ADO).

---

## Architectural Patterns

### Pattern 1: Skill → Script → JSON → Narrative

The established pattern that every v1.1 analysis skill must follow exactly.

**What:** A skill's SKILL.md instructs Claude to run a node script via Bash. The script outputs one JSON object to stdout. Claude reads the JSON and writes a written narrative.

**When to use:** All analysis skills — contributors, bugs, sprint.

**SKILL.md step structure (copy from pr-metrics/SKILL.md):**
```markdown
---
name: contributors
description: AI-narrated contributor activity report for your Azure DevOps project.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Step 0: Guard — check config exists

Run this command to resolve the plugin root and check for config:

` ``bash
PLUGIN_ROOT=`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"` && node "$PLUGIN_ROOT/scripts/contributors.mjs" --check-config
` ``

...
```

**The PLUGIN_ROOT resolver one-liner must be copied verbatim** from `skills/pr-metrics/SKILL.md` into every new skill. It handles both marketplace-installed (`installed_plugins.json`) and `--plugin-dir` installs (`CLAUDE_PLUGIN_ROOT` env fallback).

### Pattern 2: Script Internal Structure (Node.js ESM)

Every new script follows the same internal layout as `pr-metrics.mjs`.

**Key invariants:**
- `stdout` is JSON only. Progress messages go to `process.stderr.write(...)` only.
- Import `loadConfig`, `configExists` from `./config.mjs`.
- Import named functions from `./ado-client.mjs` — never use the orphaned `adoGet` (it calls `loadConfig` internally, breaking the explicit-config convention established in v1.0).
- Pass config explicitly to all `ado-client` functions: `adoGetX(config, ...)`.
- Support `--check-config` flag for the Step 0 guard.
- Wrap `main()` in `.catch(e => { console.log(JSON.stringify({ error: ... })); process.exit(1); })`.

**Script skeleton:**
```javascript
// scripts/contributors.mjs
import { loadConfig, configExists } from './config.mjs';
import { adoGetCommitsByRepo, adoGetRepos } from './ado-client.mjs';

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const eq = a.indexOf('='); return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), 'true']; })
);

if (args['check-config'] === 'true') {
  console.log(JSON.stringify({ configMissing: !configExists() }));
  process.exit(0);
}

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.log(JSON.stringify({ error: { type: 'config', message: e.message } }));
    process.exit(1);
  }

  // fetch + compute ...

  console.log(JSON.stringify(result));
}

main().catch(e => {
  console.log(JSON.stringify({ error: { type: 'unexpected', message: e.message } }));
  process.exit(1);
});
```

### Pattern 3: ADO Client Extension

New ADO endpoints belong in `ado-client.mjs` as named exports, not inline in skill scripts.

**What:** Export a named async function per ADO resource type. Function signature: `async function adoGetX(config, params = {})`. Config always passed explicitly.

**New functions needed for v1.1 (add to `scripts/ado-client.mjs`):**

| Function | ADO Endpoint | Used By |
|----------|-------------|---------|
| `adoGetCommitsByRepo(config, repoId, params)` | `git/repositories/{id}/commits` | `contributors.mjs` |
| `adoGetPushes(config, repoId, params)` | `git/repositories/{id}/pushes` | `contributors.mjs` |
| `adoRunWiql(config, wiql)` | `wit/wiql` (POST) | `bugs.mjs`, `sprint.mjs` |
| `adoGetWorkItemsBatch(config, ids)` | `wit/workitemsbatch` (POST, max 200 IDs) | `bugs.mjs`, `sprint.mjs` |
| `adoGetIterations(config, params)` | `work/teamsettings/iterations` | `sprint.mjs` |
| `adoGetIterationWorkItems(config, iterationId)` | `work/teamsettings/iterations/{id}/workitems` | `sprint.mjs` |

**Why centralize in ado-client.mjs:** Keeps the 203/401/403 error handling, `buildAuthHeader`, and URL construction in one place. When ADO changes behavior (like the 203 login redirect quirk already documented), only one file changes.

**Note on WIQL endpoint:** `wit/wiql` requires a POST with a JSON body `{ "query": "SELECT ... FROM workitems WHERE ..." }`. This is a departure from the GET-only pattern of existing functions. The new `adoRunWiql` function must accept a WIQL string and issue a POST.

**Work item batch fetch limit:** `wit/workitemsbatch` accepts a maximum of 200 IDs per call. `bugs.mjs` and `sprint.mjs` must batch IDs in groups of 200, following the same paged pattern as `fetchPagedPrs` in `pr-metrics.mjs`.

### Pattern 4: /adi:summary — Aggregation via Sequential Script Calls

`/adi:summary` aggregates data from all four analysis scripts. It has no dedicated aggregation script.

**What:** `skills/summary/SKILL.md` instructs Claude to run each of the four existing data scripts as sequential Bash steps, then synthesize the results into a unified narrative. Claude holds all four JSON payloads simultaneously in context.

**Why no `scripts/summary.mjs`:**
- Would duplicate all fetch logic from four other scripts
- Creates a dependency chain: summary.mjs must change whenever any sub-script's output schema changes
- Claude's context window handles four JSON payloads without issue
- Consistent with the core pattern: scripts are data fetchers, Claude is the synthesizer

**Summary SKILL.md step structure:**
```markdown
## Step 0: Guard — check config exists
[same guard as other skills]

## Step 1: Fetch PR metrics
` ``bash
PLUGIN_ROOT=`...` && node "$PLUGIN_ROOT/scripts/pr-metrics.mjs"
` ``
Store JSON output as PR_DATA. If error key present, note failure and continue.

## Step 2: Fetch contributor activity
` ``bash
PLUGIN_ROOT=`...` && node "$PLUGIN_ROOT/scripts/contributors.mjs"
` ``
Store JSON output as CTR_DATA. If error key present, note failure and continue.

## Step 3: Fetch bug report
` ``bash
PLUGIN_ROOT=`...` && node "$PLUGIN_ROOT/scripts/bugs.mjs"
` ``
Store JSON output as BUG_DATA. If error key present, note failure and continue.

## Step 4: Fetch sprint status
` ``bash
PLUGIN_ROOT=`...` && node "$PLUGIN_ROOT/scripts/sprint.mjs"
` ``
Store JSON output as SPR_DATA. If error key present, note failure and continue.

## Step 5: Write the unified narrative
Using all four payloads, write a project health synthesis covering:
...
```

**Error degradation in summary:** Each sub-script step must degrade gracefully. If `bugs.mjs` fails (e.g., Work Items permission not granted), the summary continues with the remaining three payloads and notes the missing section. Do not fail the entire summary when one signal is unavailable.

### Pattern 5: /adi:update — Self-Update Mechanism

`/adi:update` is structurally different from analysis skills — it has no ADO API dependency and operates on the local plugin filesystem.

**What:** The skill checks GitHub Releases API for a newer version, shows changelog, asks for confirmation, then downloads and extracts the release archive to the plugin directory.

**Skill step structure:**
```markdown
## Step 1: Check for updates

` ``bash
PLUGIN_ROOT=`...` && node "$PLUGIN_ROOT/scripts/update.mjs" --check --plugin-root="$PLUGIN_ROOT"
` ``
Output: { currentVersion, latestVersion, hasUpdate, changelog, downloadUrl }

## Step 2: Show changelog and confirm
If hasUpdate: show changelog excerpt, ask user to confirm update.
If no update: tell user they are on the latest version.

## Step 3: Apply update (only if user confirmed)
` ``bash
PLUGIN_ROOT=`...` && node "$PLUGIN_ROOT/scripts/update.mjs" --apply --plugin-root="$PLUGIN_ROOT"
` ``
Output: { success, newVersion, filesUpdated }

## Step 4: Narrate what changed
```

**`scripts/update.mjs` implementation:**
```javascript
// --check mode:
// fetch('https://api.github.com/repos/your-org/azure-devops-insights/releases/latest')
// Read current version from plugin.json at args.pluginRoot
// Compare versions, extract changelog excerpt from release body
// Output: { currentVersion, latestVersion, hasUpdate, changelog, downloadUrl }

// --apply mode:
// Download tarball_url from GitHub release using fetch() (Node 18+ built-in)
// Extract to temp dir using Node.js built-in zlib (no npm dependencies)
// Copy files to args.pluginRoot
// Output: { success, newVersion, filesUpdated }
```

**Critical constraints for update.mjs:**
- Uses `fetch()` (Node.js 18+ built-in) for GitHub API — zero npm dependencies
- Uses Node.js built-in streams for archive extraction — no `tar` npm package
- MUST NEVER touch `~/.adi/config.json` — user credentials live outside the plugin directory
- MUST NOT auto-apply — `--apply` only runs when SKILL.md step explicitly calls it after user confirmation
- Plugin root is passed as `--plugin-root` CLI arg from SKILL.md (not inferred by `import.meta.url` inside the script — fragile under different install methods)
- GitHub Releases API rate limit: 60 req/hr unauthenticated on public repo — acceptable for on-demand update checks

---

## Data Flow

### Standard Analysis Skill Flow

```
User: /adi:contributors
    |
    v
skills/contributors/SKILL.md
    |
    Step 0: node scripts/contributors.mjs --check-config
    |         └─> config.mjs:configExists() → JSON: { configMissing: false }
    |
    Step 2: node scripts/contributors.mjs [--days=N] [--project=X]
    |         |
    |         ├─> config.mjs:loadConfig()  ← ~/.adi/config.json
    |         |
    |         ├─> ado-client.mjs:adoGetRepos(config)
    |         |     └─> fetch(ADO /git/repositories) — auth: Basic base64(:PAT)
    |         |
    |         ├─> ado-client.mjs:adoGetCommitsByRepo(config, repoId, params)
    |         |     └─> fetch(ADO /git/repositories/{id}/commits)
    |         |
    |         └─> stdout: JSON { summary, activeContributors, quietContributors, ... }
    |             stderr: "Fetching commits..." (discarded by Claude)
    |
    Step 3: Claude reads JSON → writes contributor activity narrative
```

### Summary Aggregation Flow

```
User: /adi:summary
    |
    v
skills/summary/SKILL.md
    |
    ├── Step 1: node scripts/pr-metrics.mjs   → JSON_PR  (or { error })
    ├── Step 2: node scripts/contributors.mjs → JSON_CTR (or { error })
    ├── Step 3: node scripts/bugs.mjs         → JSON_BUG (or { error })
    ├── Step 4: node scripts/sprint.mjs       → JSON_SPR (or { error })
    |
    Step 5: Claude holds all four JSON payloads in context
            Sections that errored are noted as "unavailable"
            Writes unified project health narrative from available signals
```

### Update Flow

```
User: /adi:update
    |
    v
skills/update/SKILL.md
    |
    Step 1: node scripts/update.mjs --check --plugin-root="$PLUGIN_ROOT"
    |         └─> fetch(api.github.com/repos/.../releases/latest)
    |             → JSON: { currentVersion, latestVersion, hasUpdate, changelog }
    |
    Step 2: Claude shows changelog, asks user to confirm
    |
    Step 3 (if confirmed):
    |       node scripts/update.mjs --apply --plugin-root="$PLUGIN_ROOT"
    |         └─> Download + extract release archive to $PLUGIN_ROOT
    |             → JSON: { success, newVersion, filesUpdated }
    |
    Step 4: Claude narrates what changed
```

---

## New vs. Modified Files (Explicit List)

### New Files (v1.1)

| File | Type | Purpose |
|------|------|---------|
| `skills/contributors/SKILL.md` | Skill | `/adi:contributors` slash command |
| `skills/bugs/SKILL.md` | Skill | `/adi:bugs` slash command |
| `skills/sprint/SKILL.md` | Skill | `/adi:sprint` slash command |
| `skills/summary/SKILL.md` | Skill | `/adi:summary` — orchestrates four sub-scripts, no dedicated script |
| `skills/update/SKILL.md` | Skill | `/adi:update` — check and apply self-update |
| `scripts/contributors.mjs` | Script | Fetch commit/push activity per author, identify active vs. quiet |
| `scripts/bugs.mjs` | Script | Fetch work items of type Bug, compute severity distribution and trends |
| `scripts/sprint.mjs` | Script | Fetch current iteration + work items, compute completion and velocity |
| `scripts/update.mjs` | Script | Check GitHub releases, download and apply release archive |

### Modified Files (v1.1)

| File | What Changes |
|------|-------------|
| `skills/help/SKILL.md` | Move five commands from "Coming in future versions" to the main command table |
| `scripts/ado-client.mjs` | Add exports: `adoGetCommitsByRepo`, `adoGetPushes`, `adoRunWiql`, `adoGetWorkItemsBatch`, `adoGetIterations`, `adoGetIterationWorkItems` |
| `.claude-plugin/plugin.json` | Bump `version` from `1.0.0` to `1.1.0` |
| `.claude-plugin/marketplace.json` | Bump `version` from `1.0.0` to `1.1.0` |
| `CHANGELOG.md` | Add `[1.1.0]` section listing all new skills |
| `README.md` | Add new commands to the feature list and quick-start |

### Files NOT Changed (v1.1)

| File | Why Stable |
|------|-----------|
| `scripts/config.mjs` | Auth/config system complete; no new fields needed |
| `scripts/setup.mjs` | Setup flow complete; does not need to change for new skills |
| `scripts/pr-metrics.mjs` | Feature-complete; summary calls it as-is |
| `skills/setup/SKILL.md` | No change to setup flow |
| `skills/pr-metrics/SKILL.md` | No change to PR metrics skill |

---

## Build Order (Dependency-Respecting)

```
Step 1: Extend scripts/ado-client.mjs
  Add new fetch functions: adoGetCommitsByRepo, adoGetPushes,
  adoRunWiql, adoGetWorkItemsBatch, adoGetIterations, adoGetIterationWorkItems.
  Rationale: All new data scripts import from ado-client.mjs. Build the
  shared foundation before any individual skill scripts.

Step 2: Build /adi:contributors
  scripts/contributors.mjs + skills/contributors/SKILL.md
  Rationale: Git commits/pushes API — same git surface as pr-metrics.
  Simplest new data domain. Good first skill to validate the pattern
  extension works end-to-end.

Step 3: Build /adi:bugs
  scripts/bugs.mjs + skills/bugs/SKILL.md
  Rationale: Introduces the wit (Work Items) API surface for the first time.
  WIQL POST + workitemsbatch pattern established here is reused by sprint.

Step 4: Build /adi:sprint
  scripts/sprint.mjs + skills/sprint/SKILL.md
  Rationale: Depends on wit pattern from Step 3 plus the iterations API.
  Most complex data model (team context + iteration ID lookup + batch work
  items). Build after bugs so the wit pattern is already established.

Step 5: Build /adi:summary
  skills/summary/SKILL.md only (no new script)
  Rationale: Depends on all four data scripts existing and having known JSON
  output schemas. Build only after Steps 2-4 are complete and verified.
  The SKILL.md simply sequences calls to the four existing scripts.

Step 6: Build /adi:update
  scripts/update.mjs + skills/update/SKILL.md
  Rationale: Entirely independent of ADO API. Can be built at any point
  after Step 1, but placed here so all feature skills exist before the
  update mechanism ships them.

Step 7: Update help, manifests, and docs
  skills/help/SKILL.md (promote commands)
  .claude-plugin/plugin.json (version bump)
  .claude-plugin/marketplace.json (version bump)
  CHANGELOG.md + README.md
  Rationale: Documentation updated only after all skills are built and
  verified. Help lists commands that actually exist.
```

---

## Scaling Considerations

This is a CLI plugin with no server component. "Scaling" means handling large ADO projects.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Small project (<50 repos, <500 work items) | All scripts run fine with single API call per resource type |
| Medium project (50-200 repos, 500-5000 work items) | Work item WIQL queries need `$top` limits; contributors script needs per-repo batching |
| Large project (200+ repos, 5000+ work items) | WIQL has a 20,000 item default cap; apply `--days` filtering; sprint must scope to team, not full project |

**First bottleneck for new skills:** Work Items batch fetch. ADO `wit/workitemsbatch` accepts max 200 IDs per call; WIQL returns IDs only. `bugs.mjs` and `sprint.mjs` must batch-fetch work item details in groups of 200 — the same paged pattern already used in `fetchPagedPrs` in `pr-metrics.mjs`.

---

## Anti-Patterns

### Anti-Pattern 1: Using the Orphaned `adoGet` Function

**What people do:** Import `adoGet` from `ado-client.mjs` because it looks like a universal fetch helper.

**Why it's wrong:** `adoGet` calls `loadConfig()` internally (implicit config loading). The convention established by Phase 2 (`pr-metrics.mjs`) is explicit config passing: `const config = loadConfig()` at the top of `main()`, then `adoGetX(config, ...)`. Using `adoGet` breaks this convention and causes confusion about where config is loaded. This is documented as a known issue in PROJECT.md.

**Do this instead:** Import and use named functions (`adoGetPrsByProject`, `adoGetRepos`, etc.). Add new named functions to `ado-client.mjs` for new endpoints. Always pass config explicitly.

### Anti-Pattern 2: Writing Progress Messages to stdout

**What people do:** `console.log('Fetching commits...')` as a progress indicator.

**Why it's wrong:** stdout is JSON-only. Claude parses the entire stdout as JSON. Any non-JSON line on stdout breaks parsing and the skill fails with a cryptic error.

**Do this instead:** `process.stderr.write('Fetching commits...\n')` for all progress messages. Reserve `console.log(JSON.stringify(...))` for the single final output object.

### Anti-Pattern 3: Inline HTTP in Skill Scripts

**What people do:** Copy the `fetch()` + auth header pattern directly into `contributors.mjs`.

**Why it's wrong:** Duplicates the 203/401/403 error classification, duplicates `buildAuthHeader`, and creates N copies of the retry logic. When ADO changes behavior, all scripts need updating independently.

**Do this instead:** Add a new export function to `ado-client.mjs`. Keep all HTTP logic centralized.

### Anti-Pattern 4: A Summary Script That Re-fetches Everything

**What people do:** Create `scripts/summary.mjs` that imports functions from all four other scripts and runs them internally.

**Why it's wrong:** Creates a dependency chain where `summary.mjs` must be updated whenever any sub-script's internal structure changes. Also conceptually duplicates fetch logic that already works in the individual scripts.

**Do this instead:** `skills/summary/SKILL.md` calls each sub-script as a separate Bash step. Claude aggregates the four JSON payloads. No aggregator script needed.

### Anti-Pattern 5: Update Script Inferring Its Own Location

**What people do:** `scripts/update.mjs` uses `import.meta.url` or walks `__dirname` to discover where it is installed.

**Why it's wrong:** Fragile under different install methods (marketplace copy vs. `--plugin-dir` symlink). The SKILL.md already has the correct PLUGIN_ROOT resolver.

**Do this instead:** SKILL.md resolves `$PLUGIN_ROOT` and passes it explicitly: `node "$PLUGIN_ROOT/scripts/update.mjs" --plugin-root="$PLUGIN_ROOT" --apply`. The script accepts `--plugin-root` as a CLI arg.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Azure DevOps REST API v7.1 | `fetch()` with Basic auth (`base64(:PAT)`); explicit config passed to each call | 203 = auth failure (not 401); 403 = missing permission. Both handled in `ado-client.mjs`. Documented 203 quirk must be preserved in new functions. |
| GitHub Releases API | `fetch('https://api.github.com/repos/.../releases/latest')` — no auth for public repo | Used only by `update.mjs`. Rate limit: 60 req/hr unauthenticated — acceptable for on-demand check. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `SKILL.md` to script | Bash subprocess; stdout JSON; stderr discarded | Any non-JSON on stdout breaks the skill. This is the most fragile boundary. |
| Script to `ado-client.mjs` | ES module import; synchronous function calls | Config always passed explicitly. Never use orphaned `adoGet`. |
| Script to `config.mjs` | ES module import; `loadConfig()` in `main()` | Error on missing config is typed `{ type: 'config' }`. |
| `summary/SKILL.md` to sub-scripts | Four sequential Bash calls; independent JSON payloads | Each runs independently. Sub-script errors are noted but do not abort summary. |
| `update.mjs` to plugin filesystem | Direct filesystem write to `$PLUGIN_ROOT` | Must never write outside plugin directory. Must never touch `~/.adi/config.json`. |

---

## Sources

- Direct inspection of `scripts/ado-client.mjs` (v1.0, 181 LOC) — HIGH confidence
- Direct inspection of `scripts/pr-metrics.mjs` (v1.0, 501 LOC) — HIGH confidence
- Direct inspection of `scripts/config.mjs` (v1.0) — HIGH confidence
- Direct inspection of `skills/pr-metrics/SKILL.md`, `skills/setup/SKILL.md`, `skills/help/SKILL.md` — HIGH confidence
- Direct inspection of `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` — HIGH confidence
- `.planning/PROJECT.md` — `adoGet` orphan warning, key decisions table — HIGH confidence

---

*Architecture research for: Azure DevOps Insights v1.1 — new skills integration*
*Researched: 2026-02-25*
