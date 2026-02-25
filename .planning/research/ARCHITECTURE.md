# Architecture Patterns

**Domain:** Claude Code Plugin (Skill Pack) for Azure DevOps Insights
**Researched:** 2026-02-25

## Recommended Architecture

This project is a **Claude Code plugin** distributed via a GitHub-hosted marketplace. It contains multiple skills (slash commands), each backed by shared infrastructure for Azure DevOps API access, configuration management, and data formatting. Claude itself acts as the "presentation layer" -- skills feed it structured data and narrative prompts, and Claude produces the final written report.

### High-Level Structure

```
ado-insights/                          # Plugin root (also npm package root)
  .claude-plugin/
    plugin.json                        # Plugin manifest (name, version, description)
  skills/
    setup/
      SKILL.md                         # /ado-insights:setup -- configure org, project, PAT
    pr-metrics/
      SKILL.md                         # /ado-insights:pr-metrics -- PR review analysis
    contributors/
      SKILL.md                         # /ado-insights:contributors -- team activity
    bug-report/
      SKILL.md                         # /ado-insights:bug-report -- bug triage overview
    project-state/
      SKILL.md                         # /ado-insights:project-state -- sprint/backlog health
  scripts/
    ado-client.mjs                     # Azure DevOps REST API client (shared)
    config.mjs                         # Config reader/writer (~/.ado-insights/config.json)
    pr-metrics.mjs                     # Data fetching + processing for PR metrics
    contributors.mjs                   # Data fetching + processing for contributors
    bug-report.mjs                     # Data fetching + processing for bug report
    project-state.mjs                  # Data fetching + processing for project state
    setup.mjs                          # Interactive setup wizard
  package.json                         # For npm distribution (optional, for marketplace npm source)
  README.md
```

### Why This Structure

Claude Code plugins follow a strict convention: `.claude-plugin/plugin.json` at the root, `skills/` directory containing `SKILL.md` files in named subdirectories. The plugin system copies the entire directory to a cache on install, so everything must be self-contained.

Skills are markdown files -- they cannot run JavaScript directly. Instead, skills use the `!`command`` syntax for dynamic context injection or instruct Claude to execute scripts via `Bash` tool calls. This means the actual API logic lives in `scripts/` as standalone executables that Claude runs.

## Component Boundaries

| Component | Responsibility | Location | Communicates With |
|-----------|---------------|----------|-------------------|
| **Plugin Manifest** | Identity, version, metadata | `.claude-plugin/plugin.json` | Claude Code plugin system |
| **Skill Files** | Prompt engineering, narrative instructions, tool permissions | `skills/*/SKILL.md` | Claude (as instructions), scripts (via Bash) |
| **API Client** | HTTP calls to Azure DevOps REST API, auth header injection, pagination, error handling | `scripts/ado-client.mjs` | Config module, data scripts |
| **Config Manager** | Read/write `~/.ado-insights/config.json`, validate config exists | `scripts/config.mjs` | API client, setup script, all data scripts |
| **Data Scripts** | Fetch raw API data, compute metrics, output structured JSON | `scripts/*.mjs` (per-skill) | API client, stdout (for Claude to consume) |
| **Setup Script** | Interactive config creation (org URL, project, PAT) | `scripts/setup.mjs` | Config manager, stdout |

## Data Flow

### Standard Skill Execution

```
User runs /ado-insights:pr-metrics
        |
        v
Claude loads skills/pr-metrics/SKILL.md
        |
        v
SKILL.md instructs Claude to run: node <plugin-root>/scripts/pr-metrics.mjs
        |
        v
pr-metrics.mjs:
  1. Loads config via config.mjs (~/.ado-insights/config.json)
  2. Calls ado-client.mjs to fetch PR data from Azure DevOps REST API
  3. Processes data (computes averages, identifies bottlenecks, etc.)
  4. Outputs structured JSON/text to stdout
        |
        v
Claude receives script output
        |
        v
SKILL.md contains narrative instructions:
  "Analyze this data and write a report covering: findings, anomalies, recommendations"
        |
        v
Claude generates written narrative report for the user
```

### Setup Flow

```
User runs /ado-insights:setup
        |
        v
SKILL.md instructs Claude to prompt user for: org URL, project name, PAT
        |
        v
Claude collects values via conversation
        |
        v
Claude runs: node <plugin-root>/scripts/setup.mjs --org <url> --project <name> --pat <token>
        |
        v
setup.mjs:
  1. Validates inputs (org URL format, PAT not empty)
  2. Tests connection to Azure DevOps API
  3. Writes ~/.ado-insights/config.json
  4. Outputs success/failure message
        |
        v
Claude confirms setup to user
```

### Key Design Decision: Scripts Output Data, Claude Narrates

The scripts do NOT generate narrative text. They output structured data (JSON or formatted text with clear sections). The SKILL.md file contains the narrative prompt -- telling Claude how to interpret the data, what patterns to look for, and what format the report should take. This separation means:

- Scripts are testable and deterministic
- Narrative quality improves as Claude models improve (no code change needed)
- Users get AI-interpreted insights, not just raw numbers

## Patterns to Follow

### Pattern 1: Skill File Structure

Every skill follows the same template. The SKILL.md handles prompt engineering while delegating data collection to a script.

**What:** Each SKILL.md has three sections: frontmatter, data collection instruction, narrative prompt.
**When:** Every skill in the pack.
**Example:**

```yaml
---
name: pr-metrics
description: Analyze pull request review times, reviewer distribution, and bottlenecks in your Azure DevOps project.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

# PR Metrics Analysis

Run the data collection script:

` ` `bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/pr-metrics.mjs
` ` `

## How to interpret the output

The script outputs JSON with the following structure:
- `summary`: High-level stats (total PRs, average review time, etc.)
- `reviewers`: Per-reviewer breakdown
- `bottlenecks`: PRs that exceeded normal review time
- `trends`: Week-over-week changes

## Write the report

Using the data above, write a narrative report that covers:

1. **Overview**: How healthy is the PR process? One paragraph summary.
2. **Key findings**: 3-5 bullet points of the most important observations.
3. **Bottlenecks**: Which PRs are stuck and why? Who is overloaded?
4. **Recommendations**: 2-3 actionable suggestions to improve.

Be specific -- reference actual numbers, reviewer names, and PR titles.
If the script fails, explain the error and suggest how to fix it.
```

### Pattern 2: Shared API Client with Pagination

**What:** A single `ado-client.mjs` module handles all Azure DevOps HTTP calls, including auth, base URL construction, pagination (continuation tokens), and error mapping.
**When:** Every data script imports this instead of making raw fetch calls.
**Example:**

```javascript
// scripts/ado-client.mjs
import { loadConfig } from './config.mjs';

export async function adoFetch(path, params = {}) {
  const config = loadConfig();
  const url = new URL(
    `${config.orgUrl}/${config.project}/_apis/${path}`
  );
  url.searchParams.set('api-version', '7.1');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Basic ${Buffer.from(`:${config.pat}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Azure DevOps API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function adoFetchAll(path, params = {}) {
  let results = [];
  let continuationToken = null;

  do {
    const queryParams = { ...params };
    if (continuationToken) {
      queryParams['continuationToken'] = continuationToken;
    }

    const response = await adoFetch(path, queryParams);
    results = results.concat(response.value || []);
    continuationToken = response.continuationToken || null;
  } while (continuationToken);

  return results;
}
```

### Pattern 3: Config as Simple JSON File

**What:** Config stored as `~/.ado-insights/config.json` with org URL, project, and PAT.
**When:** All scripts read config on startup; setup script writes it.
**Example:**

```javascript
// scripts/config.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.ado-insights');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    throw new Error(
      'Not configured. Run /ado-insights:setup first.\n' +
      `Expected config at: ${CONFIG_FILE}`
    );
  }
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
```

### Pattern 4: Plugin Root Path Resolution

**What:** Use `${CLAUDE_PLUGIN_ROOT}` in SKILL.md to reference scripts, since plugins are cached in a different location than where they were installed from.
**When:** Every SKILL.md that calls a script.

This is critical. When Claude Code installs a plugin, it copies the directory to `~/.claude/plugins/cache/`. Hardcoded paths will break. The `${CLAUDE_PLUGIN_ROOT}` variable resolves to the actual cached location at runtime.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding Logic in SKILL.md

**What:** Writing complex data processing or API calls directly in the skill markdown, relying on Claude to execute inline code blocks.
**Why bad:** Non-deterministic, untestable, fragile. Claude may modify the code, make mistakes in execution, or hallucinate API responses.
**Instead:** Keep all logic in scripts. SKILL.md only orchestrates (run this script) and interprets (narrate this output).

### Anti-Pattern 2: Global npm Install Exposing CLI Binary

**What:** Building a traditional `npm install -g` CLI tool with a bin entry point.
**Why bad:** Claude Code has a first-class plugin system with marketplace distribution. A CLI binary does not integrate with Claude Code's skill discovery, namespace system, or plugin lifecycle. Users would need to run shell commands instead of slash commands.
**Instead:** Distribute as a Claude Code plugin via a GitHub-hosted marketplace. The npm source type in marketplace.json can be used if npm distribution is also desired, but the primary interface is the plugin system.

### Anti-Pattern 3: Scripts That Generate Narrative Text

**What:** Having `pr-metrics.mjs` output a full English report.
**Why bad:** Removes Claude from the value chain. The whole point is AI-narrated analysis. Hardcoded narratives are static, cannot adapt to context, and cannot improve with model updates.
**Instead:** Scripts output structured data (JSON). SKILL.md contains the narrative prompt. Claude synthesizes the report.

### Anti-Pattern 4: Storing PAT in Environment Variables Only

**What:** Requiring `ADO_PAT` env var instead of a config file.
**Why bad:** Every new terminal session requires re-export. Casual users will be frustrated. Env vars are also easy to accidentally log.
**Instead:** One-time setup writes to `~/.ado-insights/config.json`. Support env var override as a fallback for CI scenarios, but config file is primary.

### Anti-Pattern 5: One Mega-Skill

**What:** A single `/ado-insights:report` that does everything.
**Why bad:** Slow (fetches all data every time), overwhelming output, cannot be extended incrementally.
**Instead:** Focused skills (`pr-metrics`, `contributors`, `bug-report`, `project-state`) that each do one thing well.

## Distribution Mechanism

### Primary: GitHub Marketplace

Host the plugin in a public GitHub repository. Create a separate marketplace repository (or use the same repo) with `.claude-plugin/marketplace.json`:

```json
{
  "name": "ado-insights-marketplace",
  "owner": { "name": "ado-insights" },
  "plugins": [
    {
      "name": "ado-insights",
      "source": {
        "source": "github",
        "repo": "your-org/ado-insights"
      },
      "description": "AI-narrated Azure DevOps project insights"
    }
  ]
}
```

Users install with:
```
/plugin marketplace add your-org/ado-insights-marketplace
/plugin install ado-insights@ado-insights-marketplace
```

### Secondary: npm Source

The marketplace entry can also use npm as a source if the package is published:

```json
{
  "name": "ado-insights",
  "source": {
    "source": "npm",
    "package": "ado-insights",
    "version": "^1.0.0"
  }
}
```

### Tertiary: Direct Plugin Dir (Development)

For local development and testing:
```bash
claude --plugin-dir ./ado-insights
```

## Azure DevOps REST API Surface

The skills need these API endpoints (all read-only, all under `{orgUrl}/{project}/_apis/`):

| Skill | API Endpoints | API Version |
|-------|--------------|-------------|
| **pr-metrics** | `git/repositories`, `git/pullrequests` (by project), `git/repositories/{id}/pullrequests/{id}/reviewers`, `git/repositories/{id}/pullrequests/{id}/threads` | 7.1 |
| **contributors** | `git/repositories/{id}/commits`, `git/repositories/{id}/pushes`, `git/pullrequests` | 7.1 |
| **bug-report** | `wit/wiql` (query), `wit/workitems` (batch get) | 7.1 |
| **project-state** | `work/teamsettings/iterations` (current sprint), `wit/wiql`, `wit/workitems` | 7.1 |
| **setup** | `projects` (validate connection) | 7.1 |

All endpoints use Basic auth with PAT: `Authorization: Basic base64(:PAT)`.

Pagination uses either `$top`/`$skip` or `continuationToken` depending on the endpoint. The shared API client must handle both patterns.

## Build Order (Dependencies)

The following build order reflects true dependencies -- each phase uses what was built before it:

```
Phase 1: Foundation
  config.mjs          -- no dependencies, enables everything else
  ado-client.mjs      -- depends on config.mjs
  setup skill + script -- depends on config.mjs and ado-client.mjs
  plugin.json          -- just metadata, but needed for testing

Phase 2: First Skill (proves the pattern)
  pr-metrics.mjs      -- depends on ado-client.mjs
  pr-metrics SKILL.md  -- depends on pr-metrics.mjs existing

Phase 3: Remaining Skills (parallel, all follow the pattern)
  contributors.mjs + SKILL.md
  bug-report.mjs + SKILL.md
  project-state.mjs + SKILL.md

Phase 4: Distribution
  marketplace.json
  README.md
  npm package.json (if publishing to npm)
```

**Phase ordering rationale:**
- Config and API client are imported by every data script -- they must exist first.
- Setup must work before any other skill can run (user needs config).
- PR metrics is the best "first skill" because it exercises the most common API patterns (list repos, list PRs, get details) and proves the skill-calls-script-Claude-narrates architecture.
- Remaining skills are independent of each other and can be built in parallel.
- Distribution is last because you need working skills to distribute.

## Scalability Considerations

| Concern | At 1 project | At 10 projects | At enterprise scale |
|---------|-------------|----------------|---------------------|
| **Config** | Single config.json | Config supports named profiles (`--profile`) | Managed settings via enterprise plugin deployment |
| **API rate limits** | No issue | Add request throttling to ado-client.mjs | Implement caching layer with TTL |
| **Data volume** | Fetch all PRs | Add date range filters (last 30/90 days) | Pagination + streaming output for large datasets |
| **Auth** | PAT per user | PAT per user | Consider Entra ID / service principal auth |

For v1, the single-project single-PAT model is correct. Date range filtering should be built in from the start (default: last 30 days) to avoid hitting API limits on active projects.

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/slash-commands) -- Official skill/command structure, frontmatter, discovery (HIGH confidence)
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins) -- Plugin manifest, directory structure, distribution (HIGH confidence)
- [Claude Code Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) -- Marketplace creation, npm/GitHub sources (HIGH confidence)
- [Azure DevOps REST API - Pull Requests](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests?view=azure-devops-rest-7.1) -- PR endpoints (HIGH confidence)
- [Azure DevOps PAT Authentication](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops) -- Auth mechanism (HIGH confidence)
- [Agent Skills Open Standard](https://agentskills.io) -- Cross-tool skill format that Claude Code follows (MEDIUM confidence)
