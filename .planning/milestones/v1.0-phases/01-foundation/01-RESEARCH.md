# Phase 1: Foundation - Research

**Researched:** 2026-02-25
**Domain:** Claude Code Plugin System, Azure DevOps REST API Authentication, Node.js config management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Setup flow:**
- Sequential prompts: ask for org URL, then project name, then PAT — one at a time
- When prompting for PAT: include inline guidance on what permissions are required and a link to Azure DevOps PAT settings
- On re-run: show current values (PAT masked), ask which field to update — don't restart from scratch
- Confirmation on success: summary of what was saved (org, project, PAT masked) + "You're ready — try `/adi:pr-metrics`"

**Validation feedback:**
- Success: confirm what was tested — e.g. "Connected to [org/project]. Verified read access to repos and work items."
- Failure: list specific missing permissions with instructions on where to add them in Azure DevOps PAT settings
- Distinguish network errors (org URL unreachable/wrong) from auth errors (PAT rejected) — separate messages for each
- On failure: re-prompt the specific failed field (org URL or PAT) rather than exiting and making user re-run `/adi:setup`

**Config scope:**
- Single active connection — one org + project. Re-run `/adi:setup` to switch.
- Config stores only: org URL, project name, PAT
- PAT stored as plaintext JSON; setup output includes a note: "Stored in `~/.adi/config.json` — keep this file private"
- Config directory created silently if it doesn't exist (no mention to user)

**Plugin structure:**
- One `.md` file per skill, all in a `skills/` directory
- Shared logic (API client, config reader/writer) in a `scripts/` directory as JavaScript (Node.js — no build step)
- Plugin name: `adi` — all commands use `/adi:` prefix (e.g., `/adi:setup`, `/adi:pr-metrics`, `/adi:help`)
- Config directory: `~/.adi/config.json` (short, consistent with plugin prefix)
- Include `/adi:help` skill in Phase 1 listing all available commands and their purpose
- All report skills guard against missing config: if `~/.adi/config.json` doesn't exist, show "Run `/adi:setup` first." before doing anything

### Claude's Discretion

- Exact config directory choice if `~/.adi/` feels wrong given Claude Code plugin conventions (user deferred this)
- README formatting and organization beyond the requirement that it covers install + full skill reference

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIST-01 | User can install the skill pack globally with a single command (`claude plugin add github:org/repo`) | Plugin marketplace system documented; install flow is two-step: add marketplace then install plugin. Covered in Standard Stack and Architecture sections. |
| AUTH-01 | User can run `/adi:setup` to configure org URL, project name, and PAT — stored in `~/.adi/config.json` | Skill frontmatter, Node.js config.mjs pattern, and interactive prompting approach all documented in Architecture Patterns. |
| AUTH-02 | Setup validates the PAT has sufficient permissions by making a test API call and reports which scopes are missing | Azure DevOps `GET _apis/projects` validation endpoint, PAT Base64 encoding, and error differentiation patterns covered in Code Examples and Pitfalls. |
| AUTH-03 | User can re-run `/adi:setup` to reconfigure credentials without data loss | Re-run detection pattern (load existing config, show current values masked, prompt for specific field) covered in Architecture Patterns. |
</phase_requirements>

---

## Summary

Phase 1 builds the plugin scaffold, `/adi:setup` skill, and the shared infrastructure (API client + config manager) that every future skill depends on. The domain is Claude Code's plugin system and Azure DevOps PAT authentication.

The most important finding is a **critical bug** in the Claude Code plugin system: `${CLAUDE_PLUGIN_ROOT}` does NOT expand inside SKILL.md files (skill markdown bodies). It only works in JSON configs (hooks, MCP servers). This means skills cannot reference bundled scripts using that variable. The verified workaround is to look up the plugin's install path from `~/.claude/plugins/installed_plugins.json` at runtime, via a small resolver script invoked using the `!`command`` dynamic context injection syntax.

Installation is a **two-step process**: the user first adds the plugin's GitHub repo as a marketplace source (`/plugin marketplace add owner/repo`), then installs the plugin (`/plugin install adi@marketplace-name`). The `claude plugin add github:org/repo` syntax listed in REQUIREMENTS.md does not match current documented API — the requirements will need a note about the correct install command.

**Primary recommendation:** Build the plugin root resolver first (a tiny Node.js one-liner in `!`command\`\` syntax in each SKILL.md), then build config.mjs and ado-client.mjs, then the setup skill. Test locally with `claude --plugin-dir .` throughout.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude Code Skills (`SKILL.md`) | Current (v1.0.33+) | Slash command definitions (`/adi:setup`, `/adi:help`) | Native Claude Code format. Skills in `skills/<name>/SKILL.md` are auto-discovered. Plugin name prefixes them: `/adi:setup`. |
| Node.js ESM scripts (`.mjs`) | 18+ (guaranteed by Claude Code) | Config I/O, API calls, data processing | Node.js is guaranteed present on every Claude Code install. `.mjs` uses native `fetch()`, `fs`, `os`, `path` — zero npm dependencies needed. |
| Native `fetch()` API | Node 18+ built-in | HTTP to Azure DevOps REST API | No axios, no node-fetch, no npm install. Works cross-platform. |
| `~/.adi/config.json` | N/A | Store org URL, project name, PAT | Plain JSON in home dir. Consistent with plugin prefix. Pattern used by `gh`, `az`, `aws` CLIs. Never committed to repos. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node --test` (built-in) | Node 18+ | Unit test scripts in isolation | Use to test `config.mjs` and `ado-client.mjs` without Claude. |
| `claude --plugin-dir .` | Current | Local development without install | Use throughout Phase 1 to test skills as you build them. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain JSON config (`~/.adi/`) | `keytar` OS credential store | `keytar` requires native binary compilation, varies by OS. User accepted plaintext with privacy note. |
| Native `fetch()` | `azure-devops-node-api` npm package | npm package adds 50+ transitive deps and requires `npm install`. Native fetch does the same in 5 lines. |
| Node.js `.mjs` scripts | Bash/curl | Bash breaks on Windows (not guaranteed). Node.js is guaranteed by Claude Code. |

**Installation (development):**
```bash
# No npm install needed — zero dependencies
# Test locally:
claude --plugin-dir ./azure-devops-insights
```

**Installation (end user, once plugin is in a GitHub repo):**
```
/plugin marketplace add <your-org>/azure-devops-insights
/plugin install adi@azure-devops-insights
```

---

## Architecture Patterns

### Recommended Project Structure

```
azure-devops-insights/              # Plugin root (GitHub repo name)
  .claude-plugin/
    plugin.json                     # Plugin manifest (name: "adi")
  skills/
    setup/
      SKILL.md                      # /adi:setup — configure org, project, PAT
    help/
      SKILL.md                      # /adi:help — list all commands and purpose
  scripts/
    resolve-plugin-root.mjs         # One-liner: prints plugin install path
    config.mjs                      # Read/write ~/.adi/config.json
    ado-client.mjs                  # Azure DevOps REST API client (auth, fetch, errors)
    setup.mjs                       # Validate PAT, write config, print result
  README.md
  CHANGELOG.md
```

**Key constraint:** `commands/` is the legacy location; use `skills/` for all new skills. Each skill is a directory with `SKILL.md` inside. The `name` field in `plugin.json` sets the namespace prefix (`adi` → `/adi:skill-name`).

### Pattern 1: Plugin Root Resolution (CRITICAL — solves the CLAUDE_PLUGIN_ROOT bug)

**What:** `${CLAUDE_PLUGIN_ROOT}` does NOT expand in SKILL.md bodies. Skills that call scripts must resolve the plugin install path at runtime.

**Verified workaround:** Use `!`command`` dynamic context injection to run a tiny Node.js one-liner that reads `~/.claude/plugins/installed_plugins.json` and prints the plugin's `installPath`. This runs before Claude sees the skill content.

**When to use:** Every SKILL.md that invokes a script from `scripts/`.

**Example pattern in SKILL.md:**
```markdown
---
name: setup
description: Configure your Azure DevOps connection
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Run the setup script:

```bash
node "!`node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const e=Object.values(p.plugins||p).find(x=>(x.name||x.pluginName||'').includes('adi')||(x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"`"/scripts/setup.mjs
```
```

**Simpler alternative:** Extract the resolver to `scripts/resolve-plugin-root.mjs` and reference it via a known path. Since `~/.claude/plugins/` is consistent, the `!`command`` can read `installed_plugins.json` directly. The one-liner above is self-contained and eliminates a chicken-and-egg dependency.

**Fallback for `--plugin-dir` development:** `process.env.CLAUDE_PLUGIN_ROOT` IS set when using `--plugin-dir`, so the fallback to `process.env.CLAUDE_PLUGIN_ROOT || '.'` handles local development correctly.

**Source:** GitHub Issue #9354 (`anthropics/claude-code`) — confirmed not working; workaround by user `rhuss` verified production-tested.

### Pattern 2: Skill Frontmatter for Setup Skills

**What:** Setup and interactive skills need `disable-model-invocation: true` (user-only invocation) and `allowed-tools: Bash(node *)` (script execution without per-use approval).

**Example:**
```yaml
---
name: setup
description: Configure your Azure DevOps org URL, project name, and PAT. Run this first.
disable-model-invocation: true
allowed-tools: Bash(node *)
---
```

Key frontmatter fields for Phase 1:
- `disable-model-invocation: true` — setup and help should only run when explicitly invoked
- `allowed-tools: Bash(node *)` — allows `node scripts/setup.mjs` without permission dialog
- `description` — keep under 100 chars; not shown in context when `disable-model-invocation: true`

### Pattern 3: Config Manager (`config.mjs`)

**What:** Single module handles read/write of `~/.adi/config.json`. All scripts import this. Setup writes it; all data scripts read it.

**Example:**
```javascript
// scripts/config.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.adi');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    throw new Error('Not configured. Run /adi:setup first.\nExpected config at: ' + CONFIG_FILE);
  }
}

export function configExists() {
  try { readFileSync(CONFIG_FILE); return true; } catch { return false; }
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function maskPat(pat) {
  if (!pat || pat.length < 8) return '***';
  return pat.slice(0, 4) + '*'.repeat(pat.length - 8) + pat.slice(-4);
}
```

**Note:** `{ mode: 0o600 }` sets file permissions to owner-read-only on Unix systems. Silently no-ops on Windows but is the right practice.

### Pattern 4: Azure DevOps API Client (`ado-client.mjs`)

**What:** Single module wraps all Azure DevOps HTTP calls. Handles PAT auth header construction, api-version parameter, and error classification (network vs auth vs permission).

**Key implementation details:**
- PAT encoding: `Buffer.from(':' + pat.trim()).toString('base64')` — colon prefix is required, trim removes whitespace from env vars
- Use `api-version=7.1` (GA, stable as of 2026) — define as a constant, not inline strings
- Classify errors: HTTP 401 = PAT rejected (auth error); HTTP 403 = PAT valid but insufficient permissions; connection refused / DNS failure = network/URL error

```javascript
// scripts/ado-client.mjs
import { loadConfig } from './config.mjs';

const API_VERSION = '7.1';

export function buildAuthHeader(pat) {
  return 'Basic ' + Buffer.from(':' + pat.trim()).toString('base64');
}

export async function adoGet(path, params = {}, configOverride = null) {
  const config = configOverride || loadConfig();
  const url = new URL(`${config.orgUrl.replace(/\/$/, '')}/${config.project}/_apis/${path}`);
  url.searchParams.set('api-version', API_VERSION);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'Authorization': buildAuthHeader(config.pat),
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    throw Object.assign(new Error('Network error: cannot reach ' + config.orgUrl + '. Check the org URL.'), { type: 'network' });
  }

  if (response.status === 401) {
    throw Object.assign(new Error('PAT rejected (HTTP 401). The token may be expired or invalid.'), { type: 'auth' });
  }
  if (response.status === 403) {
    throw Object.assign(new Error('PAT lacks required permissions (HTTP 403). See setup for required scopes.'), { type: 'permission' });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Azure DevOps API error: ${response.status} ${response.statusText}`), { type: 'api' });
  }
  return response.json();
}

// Validation call — tests both connectivity and PAT permissions
export async function validateConnection(orgUrl, project, pat) {
  const config = { orgUrl, project, pat };
  try {
    // Test 1: org URL and PAT validity (project-agnostic endpoint)
    await adoGet('', {}, { orgUrl, project: '_apis', pat }); // Will not work cleanly
    // Use org-level projects list instead:
    const orgBase = orgUrl.replace(/\/$/, '');
    const url = new URL(`${orgBase}/_apis/projects`);
    url.searchParams.set('api-version', API_VERSION);
    url.searchParams.set('$top', '1');
    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': buildAuthHeader(pat), 'Content-Type': 'application/json' }
    });
    if (!resp.ok) return { ok: false, type: resp.status === 401 ? 'auth' : 'permission', status: resp.status };

    // Test 2: project access (git repos)
    const reposUrl = new URL(`${orgBase}/${project}/_apis/git/repositories`);
    reposUrl.searchParams.set('api-version', API_VERSION);
    const reposResp = await fetch(reposUrl.toString(), {
      headers: { 'Authorization': buildAuthHeader(pat), 'Content-Type': 'application/json' }
    });
    if (!reposResp.ok) return { ok: false, type: 'permission', missingScope: 'Code (Read)', status: reposResp.status };

    return { ok: true };
  } catch (err) {
    return { ok: false, type: err.type || 'network', message: err.message };
  }
}
```

### Pattern 5: Setup Script (`setup.mjs`)

**What:** The setup script is invoked by the setup skill with `--org`, `--project`, `--pat` flags after Claude collects them. It validates, writes config, and outputs a machine-readable result for Claude to narrate.

**Re-run behavior:** On re-run, the setup skill's SKILL.md instructs Claude to first run `node .../setup.mjs --read` to get current config values (PAT masked), show them to the user, then prompt for the specific field the user wants to change.

```javascript
// scripts/setup.mjs — simplified structure
import { saveConfig, maskPat } from './config.mjs';
import { validateConnection } from './ado-client.mjs';

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
    .map(([k, ...v]) => [k, v.join('=')])
);

if (args.read) {
  // Print current config (PAT masked) for re-run flow
  const { loadConfig, configExists } = await import('./config.mjs');
  if (!configExists()) { console.log(JSON.stringify({ exists: false })); process.exit(0); }
  const c = loadConfig();
  console.log(JSON.stringify({ exists: true, orgUrl: c.orgUrl, project: c.project, pat: maskPat(c.pat) }));
  process.exit(0);
}

const { org, project, pat } = args;
if (!org || !project || !pat) {
  console.error('Usage: setup.mjs --org=<url> --project=<name> --pat=<token>');
  process.exit(1);
}

const result = await validateConnection(org, project, pat);
if (!result.ok) {
  console.log(JSON.stringify({ success: false, error: result }));
  process.exit(1);
}

saveConfig({ orgUrl: org, project, pat });
console.log(JSON.stringify({
  success: true,
  summary: { orgUrl: org, project, pat: maskPat(pat) }
}));
```

### Pattern 6: SKILL.md Interactive Setup Flow

The setup skill instructs Claude to run an interactive conversation. The key is: Claude collects values conversationally, then calls the script once with all values.

**SKILL.md structure:**
```markdown
---
name: setup
description: Configure your Azure DevOps connection (org URL, project, PAT)
disable-model-invocation: true
allowed-tools: Bash(node *)
---

## Step 0: Check for existing config

Run: `node "<PLUGIN_ROOT>/scripts/setup.mjs" --read`

If `exists: true`, show the current values (PAT will be masked) and ask:
"Which field would you like to update? (org URL / project name / PAT / all)"
Only re-prompt the selected field(s), keeping others from existing config.

If `exists: false`, proceed with full setup.

## Step 1: Collect org URL

Ask: "What is your Azure DevOps org URL? (e.g. https://dev.azure.com/my-org)"

## Step 2: Collect project name

Ask: "What is the project name in that org?"

## Step 3: Collect PAT

Ask: "What is your Personal Access Token (PAT)?"

Guidance to include when asking for PAT:
- Required scopes: Code (Read), Work Items (Read), Project and Team (Read)
- Create/manage PATs at: https://dev.azure.com/<org>/_usersSettings/tokens
- Use minimum required scopes for security

## Step 4: Validate and save

Run: `node "<PLUGIN_ROOT>/scripts/setup.mjs" --org=<url> --project=<name> --pat=<token>`

Parse the JSON output:
- If `success: true`: Tell the user "Connected to [org/project]. Config saved to ~/.adi/config.json — keep this file private. You're ready — try /adi:pr-metrics"
- If `error.type === 'network'`: Tell the user the org URL appears unreachable and ask them to verify it
- If `error.type === 'auth'`: Tell the user the PAT was rejected and ask them to re-enter it
- If `error.type === 'permission'` and `missingScope`: Tell the user which permission is missing and where to add it

On network or auth failure: re-prompt only the failed field, do not restart from scratch.
```

### Anti-Patterns to Avoid

- **Using `${CLAUDE_PLUGIN_ROOT}` in SKILL.md body:** It does not expand. Use `!`command`` to resolve path at runtime.
- **Hardcoding `dev.azure.com` in the API client:** Accept the full org URL in config, construct requests from it. Supports future on-premises use.
- **Generic paginator for all ADO endpoints:** ADO uses at least 3 different pagination mechanisms. For Phase 1, the validation call only needs `$top=1` so pagination is not needed yet.
- **Bundled `npm install` requirement:** Zero dependencies. No `package.json` with `dependencies`. Everything uses Node.js built-ins.
- **Narrative in scripts:** Scripts output structured JSON. SKILL.md tells Claude how to narrate it. Scripts are deterministic; narratives improve with models.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform home directory | `process.env.HOME` or hardcoded paths | `os.homedir()` | `HOME` is not set on all Windows environments; `os.homedir()` works everywhere |
| Base64 PAT encoding | Manual string manipulation | `Buffer.from(':' + pat.trim()).toString('base64')` | Whitespace bugs are common; the colon prefix is required and easy to forget |
| Plugin root path in skills | Anything with `${CLAUDE_PLUGIN_ROOT}` | `!`node -e "..."`` dynamic injection reading `installed_plugins.json` | `${CLAUDE_PLUGIN_ROOT}` is a known bug in skill markdown bodies |
| Directory creation | Checking `existsSync` then `mkdirSync` | `mkdirSync(path, { recursive: true })` | `recursive: true` is idempotent — no race condition, no extra check needed |
| JSON arg parsing in scripts | Full arg parser library | `process.argv.slice(2)` with `--key=value` split | For 3-5 args, a 3-line inline parser is sufficient; no dependency needed |

**Key insight:** Node.js built-ins cover everything this phase needs. The moment you reach for an npm package, ask whether a built-in does the job.

---

## Common Pitfalls

### Pitfall 1: `${CLAUDE_PLUGIN_ROOT}` Fails Silently in Skill Markdown

**What goes wrong:** Skill instructs Claude to run `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs`. The variable expands to an empty string, producing `node /scripts/setup.mjs`. The error message is confusing.

**Why it happens:** `${CLAUDE_PLUGIN_ROOT}` is only populated in JSON configurations (hooks, MCP servers). It is explicitly NOT available in skill markdown bodies. This is a confirmed bug (GitHub Issue #9354).

**How to avoid:** Use `!`command`` dynamic context injection to resolve the path before Claude sees the skill content. The one-liner reads `~/.claude/plugins/installed_plugins.json` and finds the `installPath` for the `adi` plugin. Falls back to `process.env.CLAUDE_PLUGIN_ROOT` (which IS set during `--plugin-dir` development) or `.` as last resort.

**Warning signs:** Skills that invoke scripts work locally with `--plugin-dir` but fail after proper marketplace installation.

### Pitfall 2: PAT Base64 Encoding — Missing Colon Prefix

**What goes wrong:** Azure DevOps Basic auth requires `:<PAT>` (empty username, colon, then PAT) base64-encoded. Developers encode only the PAT. The API returns HTTP 401 or — more confusingly — HTTP 203 (redirect to the login page) with no clear error.

**Why it happens:** Azure DevOps Basic auth format differs from standard HTTP Basic auth where username is present. Many code examples online omit the colon.

**How to avoid:** Always use `Buffer.from(':' + pat.trim()).toString('base64')`. Centralize this in `ado-client.mjs` so it cannot be duplicated incorrectly. Add `.trim()` to remove whitespace from env vars or config files.

**Warning signs:** HTTP 401 or HTTP 203 response from ADO despite a valid PAT. Validate your encoding with `echo -n ':yourpat' | base64`.

### Pitfall 3: Install Flow Mismatch — Wrong Command in README

**What goes wrong:** REQUIREMENTS.md specifies `claude plugin add github:org/repo` but the current Claude Code API (v1.0.33+) uses a two-step marketplace flow: `/plugin marketplace add owner/repo` then `/plugin install plugin-name@marketplace-name`. A README with the wrong command confuses users.

**Why it happens:** The requirements were written before the plugin system was fully researched.

**How to avoid:** README and setup instructions must use the documented two-step flow. See the Distribution section for correct commands. The `claude plugin add github:` shorthand does not exist in official docs.

**Warning signs:** Users getting "unknown command" on `claude plugin add`.

### Pitfall 4: PAT Validation Cannot Enumerate Missing Scopes

**What goes wrong:** AUTH-02 requires "reports which scopes are missing." The Azure DevOps API does not return a list of missing scopes in its error responses. HTTP 403 only tells you "forbidden" — not "you need Code (Read)."

**Why it happens:** Azure DevOps security model does not expose required scopes in error payloads. There is no `WWW-Authenticate: Bearer scope="vso.code"` header.

**How to avoid:** Validate against specific endpoints that require known scopes, and map HTTP 403 responses to the expected scope. Example:
- `GET _apis/projects?$top=1` failing = PAT invalid or `Project and Team (Read)` missing
- `GET {project}/_apis/git/repositories` failing = `Code (Read)` missing

The setup script makes both calls and maps failures to human-readable permission names. This is the only practical approach — direct scope enumeration from the API is not possible.

**Warning signs:** Trying to use `GET _apis/token/scopes` or similar — this endpoint does not exist for PATs.

### Pitfall 5: Config Directory `~/.adi/` vs `~/.adi-insights/`

**What goes wrong:** The prior domain research used `~/.ado-insights/` as the config path. The user locked in `~/.adi/config.json`. If any code defaults to the old path, config is not found.

**How to avoid:** Use `~/.adi/config.json` everywhere. Define the path as a single constant in `config.mjs`. The user's config will always be at `path.join(os.homedir(), '.adi', 'config.json')`.

---

## Code Examples

Verified patterns from official sources and confirmed working practices:

### Plugin Manifest (`plugin.json`)
```json
{
  "name": "adi",
  "description": "AI-narrated Azure DevOps project health reports",
  "version": "1.0.0",
  "author": { "name": "Your Name" },
  "repository": "https://github.com/your-org/azure-devops-insights",
  "license": "MIT"
}
```
The `name` field here (`adi`) becomes the skill namespace — `/adi:setup`, `/adi:help`, etc.

### Plugin Root Resolution (for SKILL.md `!`command`` block)
```javascript
// Inline Node.js one-liner for !`...` dynamic injection
node -e "const f=require('fs'),h=require('os').homedir();try{const p=JSON.parse(f.readFileSync(h+'/.claude/plugins/installed_plugins.json','utf8'));const plugins=p.plugins||p;const e=Object.values(plugins).find(x=>String(x.name||x.pluginName||x.installPath||'').includes('adi'));console.log((e&&e.installPath)||process.env.CLAUDE_PLUGIN_ROOT||'.')}catch(e){console.log(process.env.CLAUDE_PLUGIN_ROOT||'.')}"
```
This is placed inside `!`...`` in the SKILL.md body. It executes before Claude sees the prompt.

### Azure DevOps Connection Validation
```javascript
// Validate org URL and PAT — two sequential checks
// Step 1: org-level (checks URL reachability + PAT validity)
GET https://{orgUrl}/_apis/projects?api-version=7.1&$top=1
Authorization: Basic {base64(':' + pat)}

// Step 2: project-level code access (checks Code Read scope)
GET https://{orgUrl}/{project}/_apis/git/repositories?api-version=7.1
Authorization: Basic {base64(':' + pat)}
```
- Step 1 failure with connection error → network/URL problem
- Step 1 failure with HTTP 401 → PAT invalid/expired
- Step 1 failure with HTTP 403 → PAT missing `Project and Team (Read)`
- Step 2 failure with HTTP 403 → PAT missing `Code (Read)`

### Config File Structure
```json
{
  "orgUrl": "https://dev.azure.com/my-org",
  "project": "MyProject",
  "pat": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```
Stored at `~/.adi/config.json` with mode `0o600` (owner read-write only).

### Missing Config Guard (for all future report skills)
```javascript
// scripts/check-config.mjs — or inline in each data script
import { configExists } from './config.mjs';
if (!configExists()) {
  console.log('Run /adi:setup first.');
  process.exit(1);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm install -g` for Claude Code extensions | `claude plugin marketplace + install` | v1.0.33 (2025) | npm global install is deprecated path; plugin system is native |
| Shell scripts for cross-platform tools | Node.js `.mjs` with built-in APIs | Node 18+ (2022) | `fetch()` built-in eliminates need for `curl` or `node-fetch` |
| `commands/` directory for skills | `skills/<name>/SKILL.md` structure | Claude Code 2025 | `commands/` still works (backwards compat) but `skills/` is recommended |
| Hardcoded `CLAUDE_PLUGIN_ROOT` in skill bodies | `!`command`` dynamic resolution | Known bug unfixed as of 2026-02-25 | Must use workaround for all plugin skills that call scripts |

**Deprecated/outdated from prior research:**
- `claude plugin add github:org/repo` syntax: Not documented as a real command. Install flow is `/plugin marketplace add owner/repo` + `/plugin install name@marketplace`.
- Config path `~/.ado-insights/`: Replaced by user decision: `~/.adi/config.json`.
- Plugin name `ado-insights`: Replaced by user decision: plugin name is `adi`.

---

## Open Questions

1. **`installed_plugins.json` Schema Stability**
   - What we know: The file exists at `~/.claude/plugins/installed_plugins.json` and contains plugin install paths. The `installPath` field is used by the community workaround.
   - What's unclear: The exact JSON schema is not officially documented. Key names (`plugins`, `name`, `installPath`) may change between Claude Code versions.
   - Recommendation: The `!`command`` resolver should handle multiple possible key structures defensively (check `plugins`, fall back to `p` as direct object, check `name`, `pluginName`, `installPath`). Add a log warning if the plugin cannot be found so users can report it.

2. **Marketplace `marketplace.json` Location for a Single-Plugin Repo**
   - What we know: To install via `/plugin marketplace add owner/repo`, the repo needs a `.claude-plugin/marketplace.json`. The plugin source can point to the same repo or a subdirectory.
   - What's unclear: Whether a single-plugin repo needs a separate `marketplace.json` or if the plugin itself is auto-discovered when added as a marketplace. The official demo uses a separate marketplace repo.
   - Recommendation: Include a minimal `.claude-plugin/marketplace.json` that points to the repo root. See Distribution section.

3. **HTTP 203 from Azure DevOps on Wrong PAT Encoding**
   - What we know: A common failure mode is Azure DevOps returning HTTP 203 (redirect to login page) instead of 401 when the PAT is wrongly encoded. `response.ok` is true for 203, so a naive check misses this.
   - What's unclear: Exactly when this happens (seems to be on `dev.azure.com` only, not all endpoints).
   - Recommendation: In `validateConnection`, check `response.status === 203` explicitly and treat it as an auth error. Also check `Content-Type` — a JSON API returning HTML is a sign of auth redirect.

---

## Distribution

### Marketplace Setup (required for `DIST-01`)

The plugin repo needs `.claude-plugin/marketplace.json` to support `/plugin marketplace add`:

```json
{
  "name": "azure-devops-insights",
  "owner": { "name": "your-org" },
  "plugins": [
    {
      "name": "adi",
      "source": {
        "source": "github",
        "repo": "your-org/azure-devops-insights"
      },
      "description": "AI-narrated Azure DevOps project health reports",
      "version": "1.0.0"
    }
  ]
}
```

**End-user install flow:**
```
/plugin marketplace add your-org/azure-devops-insights
/plugin install adi@azure-devops-insights
```

**Note for DIST-01:** The requirement says `claude plugin add github:org/repo`. This command format is not in current official docs. The actual install is the two-step marketplace flow above. The README should document the real commands.

### Local Development Flow
```bash
# Test without installing (CLAUDE_PLUGIN_ROOT is set here, workaround still needed for installed path)
claude --plugin-dir ./azure-devops-insights

# Skills are immediately available as /adi:setup, /adi:help
```

---

## Sources

### Primary (HIGH confidence)
- `https://code.claude.com/docs/en/plugins-reference` — Plugin manifest schema, `${CLAUDE_PLUGIN_ROOT}` variable documentation (JSON only), directory structure, CLI commands
- `https://code.claude.com/docs/en/skills` — SKILL.md format, frontmatter reference, `!`command`` dynamic injection, `allowed-tools`, supporting files
- `https://code.claude.com/docs/en/discover-plugins` — Marketplace install flow (`/plugin marketplace add`, `/plugin install`)
- `https://code.claude.com/docs/en/plugins` — Plugin creation guide, `--plugin-dir` development flag, `skills/` vs `commands/` guidance
- `https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate` — PAT creation, Base64 encoding format, required scopes

### Secondary (MEDIUM confidence)
- GitHub Issue `anthropics/claude-code#9354` — Confirmed `${CLAUDE_PLUGIN_ROOT}` does not work in command markdown. Community workaround using `installed_plugins.json` verified by user `rhuss` as production-tested.
- GitHub Issue `anthropics/claude-code#27145` — `CLAUDE_PLUGIN_ROOT` not set for SessionStart hooks (additional evidence of variable scope limitations)
- `https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.1` — ADO REST API 7.1 GA endpoints (projects list, git repositories)

### Tertiary (LOW confidence)
- Community reports of HTTP 203 redirect from Azure DevOps on wrong PAT encoding — verify during implementation

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — Node.js built-ins, Claude Code plugin system, and ADO REST API all documented with official sources
- Architecture: HIGH — Plugin structure confirmed against official docs. Skill patterns confirmed. CLAUDE_PLUGIN_ROOT bug confirmed with two GitHub issues.
- Pitfalls: HIGH for PAT encoding and CLAUDE_PLUGIN_ROOT; MEDIUM for HTTP 203 edge case
- Distribution: MEDIUM — Marketplace flow confirmed in docs; single-repo marketplace.json schema inferred from examples

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (plugin system is active development; check release notes before planning)
