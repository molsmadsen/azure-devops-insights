# Technology Stack

**Project:** Azure DevOps Insights -- Claude Code Skill Pack
**Researched:** 2026-02-25

## Recommended Stack

### Distribution Format: Claude Code Plugin (not raw npm)

Claude Code has a first-class plugin system. This project should ship as a **Claude Code plugin** hosted on GitHub and installable via:

```bash
claude plugin add github:your-org/ado-insights
```

This is the canonical 2026 distribution mechanism. It installs to `~/.claude/plugins/ado-insights/` at user scope (all projects) or `.claude/plugins/` at project scope. No npm publish required, no postinstall hacks, no `--add-dir` wiring.

**Why not npm?** npm global install was the 2024-early 2025 pattern. Claude Code's plugin system (`claude plugin add`) launched with v1.0.33 and is now the standard. Plugin installation handles discovery, updates (`claude plugin update`), and removal (`claude plugin remove`) natively. npm adds friction (Node.js dependency, PATH issues, sudo problems) for zero benefit.

**Confidence: HIGH** -- Official Claude Code docs describe plugin system, `claude plugin add github:` syntax confirmed.

### Plugin Structure

```
ado-insights/
  .claude-plugin/
    plugin.json                    # Plugin manifest (required)
  skills/
    setup/
      SKILL.md                     # /ado-insights:setup -- configure org, project, PAT
    pr-metrics/
      SKILL.md                     # /ado-insights:pr-metrics -- PR review bottlenecks
      reference.md                 # API endpoint details, field mappings
    contributors/
      SKILL.md                     # /ado-insights:contributors -- team activity
    bugs/
      SKILL.md                     # /ado-insights:bugs -- bug severity and trends
    project-state/
      SKILL.md                     # /ado-insights:project-state -- sprint/backlog health
  scripts/
    ado-client.mjs                 # Shared Azure DevOps API client (fetch + auth + pagination)
    config.mjs                     # Config reader/writer (~/.ado-insights/config.json)
    pr-metrics.mjs                 # Data fetching + aggregation for PR metrics
    contributors.mjs               # Data fetching + aggregation for contributors
    bug-report.mjs                 # Data fetching + aggregation for bugs
    project-state.mjs              # Data fetching + aggregation for project state
    setup.mjs                      # Setup wizard (validates PAT, writes config)
  CLAUDE.md                        # Plugin-level memory (conventions, API patterns)
```

**Confidence: HIGH** -- Plugin structure documented in official Claude Code plugin docs. Skill names use plugin namespace (`ado-insights:skill-name`).

### Plugin Manifest

```json
{
  "name": "ado-insights",
  "description": "AI-narrated Azure DevOps project health reports",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  },
  "repository": "https://github.com/your-org/ado-insights",
  "license": "MIT"
}
```

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude Code Skills (SKILL.md) | Current | Slash command definitions | Native format -- skills ARE the product. Each skill is a markdown file with YAML frontmatter and prompt instructions. Claude executes the instructions using its built-in tools. |
| Node.js scripts (.mjs) | 18+ (bundled with Claude Code) | API calls, data aggregation | Node.js is guaranteed present because Claude Code requires it. Using `.mjs` scripts (ES modules) with native `fetch()` gives cross-platform compatibility (Windows, macOS, Linux) without any additional dependencies. Shell scripts break on Windows. |
| Native `fetch()` API | Node 18+ built-in | HTTP calls to Azure DevOps | No npm dependencies needed. `fetch()` is built into Node.js 18+. No axios, no node-fetch, no dependencies at all. |

**Confidence: HIGH** -- Claude Code requires Node.js 18+. Native fetch is stable in Node 18+. Zero-dependency approach is validated.

### Why Node.js Scripts Instead of Bash/curl

The initial instinct is bash scripts with curl -- simpler, fewer files. But this project must work on Windows, where:
- Bash is only available via Git Bash or WSL (not guaranteed)
- `curl` behavior differs between Windows curl.exe and Unix curl
- Path separators, line endings, and command availability vary
- `jq` is not installed by default on Windows

Node.js scripts solve all of this because Claude Code already requires Node.js. The scripts use only built-in Node.js APIs (`fetch`, `fs`, `path`, `os`, `Buffer`) -- zero npm dependencies.

**Confidence: HIGH** -- Cross-platform concern is well-documented. Node.js is the safest choice for a tool that must work everywhere Claude Code works.

### Azure DevOps REST API

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Azure DevOps REST API | 7.1 (GA) | All data access | 7.1 is the current GA version. 7.2 exists in preview but 7.1 is stable and fully documented. Use 7.1 for reliability. |
| PAT Authentication | N/A | API auth | Basic auth with PAT is the simplest mechanism. Encode as Base64 of `:PAT` and pass as `Authorization: Basic <token>` header. |

**Key API endpoints needed:**

| Endpoint | API Area | Used By |
|----------|----------|---------|
| `GET {org}/{project}/_apis/git/repositories` | Git | All skills (list repos) |
| `GET {org}/{project}/_apis/git/repositories/{repo}/pullrequests` | Git | PR metrics |
| `GET {org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/reviewers` | Git | PR metrics |
| `GET {org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/threads` | Git | PR metrics |
| `POST {org}/{project}/_apis/wit/wiql` | Work Item Tracking | Bugs, project state |
| `GET {org}/{project}/_apis/wit/workitems?ids={ids}` | Work Item Tracking | Bugs, project state |
| `GET {org}/{project}/_apis/work/teamsettings/iterations` | Work | Sprint data |
| `GET {org}/{project}/_apis/git/repositories/{repo}/commits` | Git | Contributors |
| `GET {org}/_apis/projects/{project}/teams/{team}/members` | Core | Contributors |
| `GET {org}/_apis/projects` | Core | Setup (validate connection) |

**Base URL pattern:** `https://dev.azure.com/{organization}/{project}/_apis/{area}/{resource}?api-version=7.1`

**Important:** Accept full base URL in config (not just org name) to support Azure DevOps Server on-premises URLs like `https://tfs.company.com/tfs/{collection}`.

**Confidence: HIGH** -- Microsoft Learn documentation confirms all endpoints and 7.1 GA status.

### Configuration & Auth

| Technology | Purpose | Why |
|------------|---------|-----|
| `~/.ado-insights/config.json` | Store org URL, project name, PAT | Simple JSON file in user home dir. Never committed to repos. Readable by Node.js scripts with built-in `fs` module. |
| Node.js config module (`config.mjs`) | Read/write/validate config | Cross-platform path handling via `os.homedir()` and `path.join()`. |

**Config file format:**

```json
{
  "orgUrl": "https://dev.azure.com/my-org",
  "project": "MyProject",
  "pat": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "defaultRepository": "main-repo"
}
```

**Security approach:**
- PAT stored in plaintext in user home dir (matches pattern used by gh CLI `~/.config/gh/hosts.yml`, az CLI `~/.azure/`, AWS CLI `~/.aws/credentials`)
- Config dir created with restrictive permissions where OS supports it
- Never read config from project directory (prevents accidental commits)
- Setup skill warns user to use minimal-scope PATs (read-only)
- Support `ADO_PAT` environment variable as override (for CI/automation scenarios)
- Document exact required PAT scopes: `Code (Read)`, `Work Items (Read)`, `Project and Team (Read)`

**Confidence: HIGH** -- Matches patterns used by gh CLI, az CLI, AWS CLI, and similar tools.

### Development & Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `--plugin-dir` flag | Current | Local plugin testing | `claude --plugin-dir ./ado-insights` loads the plugin without installation. Edit-test cycle is instant. |
| Node.js built-in test runner | Node 18+ | Script unit tests | `node --test` is built-in since Node 18. No test framework dependency needed. Test the API client and config module in isolation. |
| ESLint | 9.x | Script linting | Catches errors in .mjs scripts. Flat config format (eslint.config.js). |

**Confidence: MEDIUM** -- `--plugin-dir` confirmed in docs. Node built-in test runner is stable. ESLint 9.x flat config is current.

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| **TypeScript** | Adds a build step (compilation) for scripts that are 50-200 lines each. Plain .mjs with JSDoc type comments gives IDE support without build complexity. Zero-build is a feature. |
| **azure-devops-node-api (npm)** | Microsoft's official Node.js client library. Requires `npm install`, adds 50+ transitive dependencies, pulls in the entire azure-devops-node-api. Native `fetch()` with Basic auth does the same thing in 5 lines. Overkill for read-only GET requests. |
| **axios / node-fetch / got** | HTTP client libraries. Unnecessary because Node.js 18+ has built-in `fetch()`. Adding any npm dependency adds `node_modules`, `package-lock.json`, and install steps -- all unnecessary. |
| **npm global install pattern** | Deprecated distribution path for Claude Code extensions. Plugin system (`claude plugin add`) is the 2026 standard. npm adds PATH configuration burden, sudo issues, and requires users to understand npm. |
| **Bash scripts / curl** | Cross-platform problem. Bash is not guaranteed on Windows (Git Bash or WSL only). `curl` behavior differs across platforms. `jq` is not installed by default on Windows. Node.js is guaranteed because Claude Code requires it. |
| **Python scripts** | Python adds a runtime dependency check (which Python? Is it in PATH? venv?). Node.js is already guaranteed. |
| **MCP servers** | MCP servers are for persistent tool connections (databases, APIs with complex state). Our use case is simple read-only REST calls. Skills invoking scripts are simpler and require no running server process. |
| **OpenSkills / AgentSkills.io** | Cross-agent skill standard. Interesting but unnecessary complexity -- this project targets Claude Code only. Plugin system is sufficient. |
| **Entra ID / OAuth authentication** | More secure than PATs but dramatically more complex to set up (app registration, tenant config, redirect URIs). PAT is the right choice for a CLI tool targeting individual developers. Revisit for v2 if enterprise customers need it. |
| **OS credential store (keytar)** | Requires native binary compilation, varies by OS, complex to read from scripts. Plaintext config file in home dir matches how gh, az, and aws CLI tools work. Acceptable tradeoff for v1. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Distribution | Claude Code Plugin (GitHub) | npm global package | Plugin system is native, no Node.js install step, built-in update/remove lifecycle |
| API calls | Node.js `fetch()` (built-in) | curl via Bash | Cross-platform. Node.js is guaranteed on all Claude Code installs. Bash is not. |
| API calls | Node.js `fetch()` (built-in) | azure-devops-node-api | Zero dependencies vs. 50+ transitive deps. We make simple GET/POST requests. |
| Config storage | `~/.ado-insights/config.json` | Environment variables | Config file is one-time setup; env vars must be set per session. Support env var as override. |
| Config storage | `~/.ado-insights/config.json` | OS keychain (keytar) | Keychain requires native binaries, varies by OS. Config file is simpler. |
| API version | 7.1 GA | 7.2 Preview | GA stability over preview features. 7.1 covers all needed endpoints. |
| Script language | Node.js (.mjs) | Bash | Node.js is cross-platform and guaranteed present. Bash breaks on Windows. |
| Script language | Node.js (.mjs) | Python | Node.js is guaranteed by Claude Code. Python may not be installed or in PATH. |
| Auth mechanism | PAT (Basic auth) | Entra ID / OAuth | PAT is simple self-service setup; OAuth requires Azure AD app registration |
| Testing | Node.js built-in test runner | Jest / Vitest | Zero dependencies. Built-in `node --test` is sufficient for 5-10 test files. |

## Skill Anatomy (How Skills Work)

Each skill is a SKILL.md file with two parts:

### 1. YAML Frontmatter (metadata)

```yaml
---
name: pr-metrics
description: Analyze pull request review times, reviewer distribution, and bottlenecks in your Azure DevOps project.
disable-model-invocation: true
allowed-tools: Bash(node *)
---
```

Key fields for this project:
- `name`: Combined with plugin name to create `/ado-insights:pr-metrics` command
- `description`: Tells Claude what this skill does (used for auto-load when enabled)
- `disable-model-invocation: true`: User must explicitly run the command; Claude will not auto-trigger it
- `allowed-tools: Bash(node *)`: Grants permission to run Node.js scripts without per-use approval

### 2. Markdown Body (instructions for Claude)

The body is a prompt that tells Claude:
1. Run the data-fetching script: `node <plugin-root>/scripts/pr-metrics.mjs`
2. Read the structured JSON output
3. Analyze the data following specific guidelines
4. Write a narrative report with prescribed sections (findings, anomalies, recommendations)

**Key architectural principle:** Scripts output structured data (JSON). Skills tell Claude how to narrate it. Claude writes the report. This separation means scripts are testable and deterministic, while narrative quality improves as Claude models improve.

### Dynamic Context Injection

Skills support `!`command`` syntax to run shell commands before the prompt reaches Claude:

```markdown
## Configuration
- Organization: !`node -e "const c=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.ado-insights/config.json'));console.log(c.orgUrl)"`
```

This runs at invocation time, injecting actual config values into the prompt.

### String Substitutions

- `$ARGUMENTS` -- all arguments passed after the command name
- `$ARGUMENTS[0]`, `$0` -- first positional argument
- `$ARGUMENTS[1]`, `$1` -- second positional argument

Example: `/ado-insights:pr-metrics last-30-days` makes `$0` = `last-30-days`

## Installation Instructions for End Users

```bash
# Install the plugin (one-time)
claude plugin add github:your-org/ado-insights

# Run setup to configure credentials
/ado-insights:setup

# Verify connection works
/ado-insights:project-state
```

No npm, no build step. Plugin system handles installation, updates, and removal.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/ado-insights.git
cd ado-insights

# Test locally without installing (loads plugin from current directory)
claude --plugin-dir .

# Now /ado-insights:setup, /ado-insights:pr-metrics, etc. are available

# Run script tests
node --test scripts/*.test.mjs

# Lint scripts
npx eslint scripts/
```

## Zero-Dependency Principle

This project has **zero npm dependencies**. No `package.json` with dependencies. No `node_modules`. No `npm install` step. Everything uses Node.js built-in APIs:

| Need | Built-in Solution |
|------|-------------------|
| HTTP requests | `fetch()` (global, Node 18+) |
| File I/O | `fs` module |
| Path handling | `path` module |
| Home directory | `os.homedir()` |
| Base64 encoding | `Buffer.from().toString('base64')` |
| JSON parsing | `JSON.parse()` (built-in) |
| CLI argument parsing | `process.argv.slice(2)` |
| Test runner | `node --test` (built-in, Node 18+) |

This is intentional. A Claude Code plugin that requires `npm install` before use defeats the purpose of frictionless distribution.

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) -- Skill format, frontmatter, distribution, `!`command`` syntax, allowed-tools (HIGH confidence)
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins) -- Plugin structure, manifest, `.claude-plugin/plugin.json` (HIGH confidence)
- [Claude Code Discover Plugins](https://code.claude.com/docs/en/discover-plugins) -- Plugin marketplace, `claude plugin add github:` syntax (HIGH confidence)
- [Azure DevOps REST API Reference (7.1)](https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.1) -- All API endpoints, auth patterns (HIGH confidence)
- [Azure DevOps REST API Versioning](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rest-api-versioning?view=azure-devops) -- Version format, GA vs preview (HIGH confidence)
- [Azure DevOps PAT Authentication](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops) -- PAT creation, scopes, security best practices (HIGH confidence)
- [Azure DevOps Pull Requests API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests?view=azure-devops-rest-7.1) -- PR endpoints (HIGH confidence)
- [Azure DevOps Work Items API](https://learn.microsoft.com/en-us/azure/devops/integrate/quickstarts/work-item-quickstart?view=azure-devops) -- WIQL queries, work item batch fetch (HIGH confidence)
- [agent-skill-npm-boilerplate](https://github.com/neovateai/agent-skill-npm-boilerplate) -- npm distribution pattern (considered, rejected) (MEDIUM confidence)
- [Claude Code Plugin CLI Guide](https://medium.com/@garyjarrel/claude-code-plugin-cli-the-missing-manual-0a4d3a7c99ce) -- Plugin CLI commands, marketplace management (MEDIUM confidence)
