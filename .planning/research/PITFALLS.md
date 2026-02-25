# Domain Pitfalls

**Domain:** Claude Code skill pack integrating with Azure DevOps REST API
**Researched:** 2026-02-25

## Critical Pitfalls

Mistakes that cause rewrites, security incidents, or fundamental architecture problems.

### Pitfall 1: PAT Token Stored in Plaintext Config File

**What goes wrong:** The PROJECT.md specifies storing credentials in `~/.ado-insights/config.json`. A plaintext JSON file containing a PAT is a security incident waiting to happen. Users will accidentally commit it, back it up to cloud storage, or leave it readable by other processes. Azure DevOps auto-revokes PATs found in public GitHub repos, so a leaked token causes immediate breakage.

**Why it happens:** Convenience over security. A JSON config file is the simplest implementation, and the project spec calls for "one-time setup is friendlier for casual users."

**Consequences:** Token exposure leads to unauthorized read access to all Azure DevOps data the PAT can reach. If the user created a full-scope PAT (common among developers who don't read scope docs carefully), this means complete org access.

**Prevention:**
- Use the OS credential store via `keytar` or equivalent (macOS Keychain, Windows Credential Manager, libsecret on Linux)
- If a config file is necessary for org URL and project name, store ONLY non-secret configuration there. Keep the PAT in the credential store or read from an environment variable (`ADO_PAT`)
- Support multiple auth methods: environment variable > credential store > config file (last resort, with a warning)
- Add a `.gitignore`-style warning if the config file contains a token field
- Document minimum required PAT scopes explicitly: `Code (Read)`, `Work Items (Read)`, `Build (Read)`, `Graph (Read)`

**Detection:** Review auth implementation early. If `config.json` has a `pat` or `token` field stored as plain text, this pitfall is active.

**Phase:** Must be addressed in Phase 1 (setup/configuration). Retrofitting auth storage is painful once users have existing configs.

**Confidence:** HIGH -- based on [Microsoft official PAT security guidance](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops) and [GitGuardian remediation docs](https://www.gitguardian.com/remediation/azure-devops-personal-access-token).

---

### Pitfall 2: Distribution Model Mismatch -- npm Global Install vs Claude Code Plugin System

**What goes wrong:** The PROJECT.md says "installable via a single global command (e.g., `npm install -g ado-insights`)." But Claude Code skills are markdown files that live in `~/.claude/skills/` or `.claude/skills/`, not executable binaries. An npm global install would put files in npm's global `node_modules`, which Claude Code does not scan. The npm package would need a postinstall script to copy files into `~/.claude/skills/`, which is fragile and breaks on updates.

Meanwhile, Claude Code now has a dedicated **plugin system** with `.claude-plugin/plugin.json` manifests, plugin marketplaces, and the `/plugin` command for installation. This is the intended distribution mechanism.

**Why it happens:** The project was conceived before fully researching Claude Code's plugin ecosystem. npm is the default mental model for distributing Node.js tools.

**Consequences:** If you build around npm global install, you fight against Claude Code's architecture. Users get a confusing install experience (run npm install, then manually copy files, or rely on a brittle postinstall script). Updates break. Uninstall leaves orphan files.

**Prevention:**
- Distribute as a **Claude Code plugin** using the plugin system with a `.claude-plugin/plugin.json` manifest
- Host the plugin in a GitHub repo as a plugin marketplace so users install via `/plugin marketplace add <org>/<repo>` then `/plugin install ado-insights`
- Keep an npm package as an optional secondary distribution method with a CLI setup script, but make the plugin the primary path
- The plugin structure naturally namespaces skills as `/ado-insights:pr-metrics`, preventing conflicts

**Detection:** If the implementation plan starts with "create an npm package with a bin entry," this pitfall is active. The correct starting point is "create a Claude Code plugin directory structure."

**Phase:** Must be decided in Phase 1. The entire project structure depends on the distribution model.

**Confidence:** HIGH -- based on [Claude Code plugins documentation](https://code.claude.com/docs/en/plugins) and [skills documentation](https://code.claude.com/docs/en/skills).

---

### Pitfall 3: Azure DevOps Pagination is Inconsistent Across Endpoints

**What goes wrong:** You build a generic "fetch all results" helper, then discover that Azure DevOps uses at least three different pagination mechanisms depending on the endpoint:
1. **Continuation tokens** via `x-ms-continuationtoken` response header (Git commits, pipelines, test plans)
2. **`$top` and `$skip`** query parameters (work items, some list endpoints)
3. **WIQL queries** that return only work item IDs (max 20,000), requiring separate batch fetches for actual work item data

You implement one pattern, then hit a different endpoint that uses another. Or worse, you hit the hard 20,000 WIQL result cap and get error `VS402337` with no workaround except changing the query.

**Why it happens:** Azure DevOps API evolved over many years across different teams. There is no single pagination standard.

**Consequences:** Data truncation without warning (the API silently returns partial results on some endpoints). Skills report inaccurate metrics because they only processed the first page. On large orgs, WIQL queries fail entirely.

**Prevention:**
- Build endpoint-specific data fetchers, not a generic "paginate everything" utility
- For each endpoint used by a skill, document which pagination mechanism it uses
- For WIQL: always add date filters (e.g., last 90 days) to keep results under 20,000. Never issue an unbounded WIQL query
- For continuation tokens: URL-encode the token exactly as received. Do not trim, quote-wrap, or modify it
- Add a `maxResults` safety cap (e.g., 5,000) with a warning when hit, so skills don't silently loop forever on large datasets
- Test against a project with 1,000+ work items and 500+ PRs during development

**Detection:** If the codebase has a single `fetchAllPages()` function used across all endpoints, this pitfall is active.

**Phase:** Phase 2 (first skill implementation). This will surface immediately when building the PR metrics or bug report skill.

**Confidence:** HIGH -- based on [Microsoft pagination docs](https://learn.microsoft.com/en-us/answers/questions/1051518/pagination-in-rest-api), [continuation token issues](https://learn.microsoft.com/en-us/answers/questions/5603409/azure-pipeline-api-is-not-accepting-the-continuati), and [20K WIQL limit](https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/object-limits?view=azure-devops).

---

### Pitfall 4: Skill Output Floods Claude's Context Window

**What goes wrong:** A skill fetches 500 PRs, 2,000 work items, or months of contributor data, then dumps it all into the conversation as raw JSON for Claude to narrate. This consumes most of Claude's 200K context window, degrades response quality, and can cause the context to compact mid-analysis, losing data.

**Why it happens:** The natural implementation is: fetch data, give it to Claude, ask Claude to analyze. This works for small datasets but breaks at scale.

**Consequences:** Claude produces shallow or hallucinated analysis because it cannot process the full dataset. Context compaction drops important data. Users on metered API plans burn tokens on raw JSON that should have been pre-processed.

**Prevention:**
- Pre-aggregate data in the skill's fetch logic BEFORE passing to Claude. Claude should receive summary statistics and notable outliers, not raw records
- For PR metrics: compute median review time, p95, reviewer distribution, and bottleneck PRs in code. Pass the computed summary (maybe 50-100 lines) to Claude for narrative generation
- For contributors: compute commit counts, review counts, active days. Pass the leaderboard, not raw commit logs
- Set a hard cap on data passed to Claude (aim for under 2,000 lines of structured summary)
- Use the `context: fork` frontmatter option to run analysis in a subagent, keeping the main conversation clean

**Detection:** If a skill's implementation does `fetch -> JSON.stringify -> pass to Claude`, this pitfall is active.

**Phase:** Phase 2 (first skill implementation). Must be a design principle from the start, not a retrofit.

**Confidence:** HIGH -- based on [Claude Code context window best practices](https://code.claude.com/docs/en/best-practices) and [context window documentation](https://platform.claude.com/docs/en/build-with-claude/context-windows).

---

## Moderate Pitfalls

### Pitfall 5: Hardcoding api-version or Omitting It Entirely

**What goes wrong:** Azure DevOps requires an `api-version` query parameter on every request. If omitted, behavior is undefined and may change without notice. If hardcoded to a specific version (e.g., `7.1`), the tool silently breaks when Microsoft deprecates that version (preview versions are deprecated 12 weeks after GA release).

**Prevention:**
- Define `api-version` as a constant at the top of the codebase, not scattered across URL strings
- Use a released (non-preview) version: `7.2` is current as of early 2026
- Document which API version the tool targets in the README and config
- Add a startup check that validates the API version is still supported (a single lightweight API call)
- Monitor the [Azure DevOps REST API versioning docs](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rest-api-versioning?view=azure-devops) for deprecation notices

**Phase:** Phase 1 (API client setup).

**Confidence:** HIGH -- based on [official versioning documentation](https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2).

---

### Pitfall 6: PAT Base64 Encoding Done Wrong

**What goes wrong:** Azure DevOps Basic auth requires the PAT to be formatted as `:<PAT>` (colon prefix, empty username), then base64-encoded, then sent as `Authorization: Basic <encoded>`. Developers commonly forget the leading colon, double-encode the token, or read the PAT from an environment variable that adds trailing whitespace/newline.

**Prevention:**
- Centralize auth header construction in a single function
- The format is exactly: `Buffer.from(':' + pat).toString('base64')`
- Trim the PAT value before encoding to strip whitespace/newlines from env vars or config files
- Test with a real PAT during development -- this error manifests as HTTP 203 (redirect to login page) or 401, not a clear error message
- Add a `validateConnection()` function in the setup flow that tests the PAT against a lightweight endpoint (e.g., `GET _apis/projects?api-version=7.2&$top=1`)

**Phase:** Phase 1 (API client setup).

**Confidence:** HIGH -- based on [PAT auth issues on Developer Community](https://developercommunity.visualstudio.com/content/problem/446754/pat-auth-docs-for-azure-devops-dont-mention-the-se.html) and [Microsoft docs](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops).

---

### Pitfall 7: Rate Limiting Without Backoff Causes Cascading Failures

**What goes wrong:** Azure DevOps rate limits are expressed in TSTUs (Throughput Units) -- 200 TSTUs per 5-minute sliding window. The API does NOT return HTTP 429 immediately; instead, it progressively delays responses (up to 30 seconds per request). If your code uses Promise.all to fire 50 parallel requests, you burn through TSTUs instantly and all subsequent requests crawl. On large orgs, a single skill invocation can throttle the user's entire Azure DevOps experience for minutes.

**Prevention:**
- Limit concurrency to 3-5 parallel requests maximum
- Implement exponential backoff when `Retry-After` header is present
- Monitor `X-RateLimit-Remaining` header and slow down proactively when remaining drops below 20%
- Add a configurable delay between batched requests (default 100ms)
- Never fire unbounded `Promise.all` against the API
- Warn users in the output if rate limiting was encountered

**Phase:** Phase 1 (API client setup). Build the throttled HTTP client before building any skills.

**Confidence:** HIGH -- based on [official rate limits documentation](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rate-limits?view=azure-devops).

---

### Pitfall 8: Skills Cannot Execute Node.js Directly -- They Are Markdown Instructions

**What goes wrong:** A developer builds the skill pack as a traditional Node.js application with TypeScript modules, API client classes, and data processing pipelines. Then they discover that Claude Code skills are markdown files containing instructions for Claude. The skill does not "run" code -- it instructs Claude to use its available tools (Bash, Read, Grep, WebFetch) to accomplish tasks.

This means the skill must instruct Claude to execute shell commands (e.g., `curl` or a bundled script) to call the Azure DevOps API. The data processing logic must either live in a script that Claude invokes or be described in natural language for Claude to implement on the fly.

**Why it happens:** The mental model of "npm package with executable skills" is wrong. Skills are prompts, not programs.

**Prevention:**
- Architecture must be: skill markdown instructs Claude to run a bundled helper script (e.g., Python or Node.js) that does the actual API fetching and data aggregation
- The helper script outputs a structured summary to stdout
- The skill markdown tells Claude to run the script, read the output, and generate a narrative
- Alternatively, the skill can instruct Claude to use `curl` or `fetch` via Bash tool directly, but this is fragile for complex multi-step API workflows
- Use `allowed-tools: Bash(node *), Bash(python *), Read` in frontmatter to grant necessary permissions

**Detection:** If the project plan describes "TypeScript skill modules that Claude imports," this pitfall is active.

**Phase:** Phase 1 (architecture). This is a foundational understanding that shapes the entire project.

**Confidence:** HIGH -- based on [Claude Code skills documentation](https://code.claude.com/docs/en/skills).

---

### Pitfall 9: Azure DevOps On-Premises (Server) vs Cloud (Services) URL Differences

**What goes wrong:** The tool assumes all users are on Azure DevOps Services (cloud) with URLs like `https://dev.azure.com/{org}`. But many enterprises run Azure DevOps Server (on-premises) with URLs like `https://tfs.company.com/tfs/{collection}`. The URL structure, available API versions, and feature set differ between the two.

**Prevention:**
- Accept a full base URL in configuration, not just an org name
- Do not construct URLs with hardcoded `dev.azure.com` prefix
- Document that v1 targets Azure DevOps Services (cloud) and list any known incompatibilities with Server
- Use API version `7.1` or lower if supporting Server 2022, since Server versions lag behind Services
- Test URL construction with both formats

**Phase:** Phase 1 (configuration/setup). The URL handling must be flexible from the start.

**Confidence:** MEDIUM -- based on [Azure DevOps REST API getting started docs](https://learn.microsoft.com/en-us/azure/devops/integrate/how-to/call-rest-api?view=azure-devops).

---

## Minor Pitfalls

### Pitfall 10: WIQL Date Field Formats Are Non-Standard

**What goes wrong:** WIQL (Work Item Query Language) date comparisons require dates in a specific format and timezone handling. Using ISO 8601 strings or local timezone dates produces unexpected results or query failures. The `Changed Date` field for completed items older than 1 year causes them to disappear from backlog queries.

**Prevention:**
- Use `@today - 90` WIQL syntax for relative date ranges instead of absolute dates
- Always include explicit date bounds in WIQL queries to avoid hitting the 20K limit
- For the "bug report" skill, filter to last 90 days by default with a configurable range

**Phase:** Phase 2-3 (skill implementation).

**Confidence:** MEDIUM -- based on [WIQL reference syntax](https://learn.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax?view=azure-devops).

---

### Pitfall 11: Skill Description Budget Overflow

**What goes wrong:** Claude Code loads all skill descriptions into context so Claude knows what is available. The budget is 2% of the context window (~4,000 characters at 200K tokens), with a fallback of 16,000 characters. If you create many skills with verbose descriptions, some get silently excluded from Claude's awareness.

**Prevention:**
- Keep each skill description under 100 characters
- Use `disable-model-invocation: true` for skills that should only be manually invoked (setup, config) to exclude them from the description budget
- Run `/context` during testing to check for excluded skill warnings
- Set `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var if needed

**Phase:** Phase 3+ (when skill count grows).

**Confidence:** HIGH -- based on [Claude Code skills documentation](https://code.claude.com/docs/en/skills) troubleshooting section.

---

### Pitfall 12: Cross-Platform Path and Shell Assumptions

**What goes wrong:** If skills instruct Claude to run scripts via Bash, those scripts must work on Windows (Git Bash/WSL), macOS, and Linux. Path separators, `curl` availability, `node`/`python` command names (`python3` vs `python`), and line endings all vary.

**Prevention:**
- Use Node.js scripts (not shell scripts) for cross-platform compatibility since Node is guaranteed to be available (Claude Code requires it)
- Use `path.join()` and `os.homedir()` instead of hardcoded paths
- Test on Windows specifically -- it is the most likely to break

**Phase:** Phase 2 (first script implementation).

**Confidence:** MEDIUM -- general cross-platform development knowledge.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Setup / Configuration | PAT stored in plaintext (Pitfall 1) | Implement credential store or env var auth from day one |
| Setup / Configuration | Distribution as npm global (Pitfall 2) | Use Claude Code plugin system as primary distribution |
| Setup / Configuration | Base64 encoding wrong (Pitfall 6) | Centralize auth header, add connection validation |
| API Client Foundation | Rate limiting without backoff (Pitfall 7) | Build throttled HTTP client with concurrency limits |
| API Client Foundation | Hardcoded api-version (Pitfall 5) | Define version constant, use 7.2 (released) |
| First Skill (PR Metrics) | Inconsistent pagination (Pitfall 3) | Build endpoint-specific fetchers, not generic paginator |
| First Skill (PR Metrics) | Context window overflow (Pitfall 4) | Pre-aggregate data before passing to Claude |
| Skill Architecture | Skills are markdown, not code (Pitfall 8) | Bundle helper scripts that skills invoke via Bash tool |
| Multiple Skills | Skill description budget (Pitfall 11) | Keep descriptions concise, use disable-model-invocation |
| All Phases | On-premises URL differences (Pitfall 9) | Accept full base URL, don't hardcode dev.azure.com |
| All Phases | Cross-platform compatibility (Pitfall 12) | Use Node.js scripts, test on Windows |

## Sources

- [Azure DevOps Rate and Usage Limits](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rate-limits?view=azure-devops) -- official Microsoft documentation on TSTUs and throttling
- [Azure DevOps REST API Versioning](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rest-api-versioning?view=azure-devops) -- version format and deprecation policy
- [Azure DevOps PAT Authentication](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops) -- security best practices and scope management
- [Azure DevOps Work Tracking Limits](https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/object-limits?view=azure-devops) -- 20K WIQL cap, revision limits
- [Azure DevOps Integration Best Practices](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/integration-bestpractices?view=azure-devops) -- avoiding rate limit hits
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) -- skill structure, frontmatter, distribution, description budgets
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins) -- plugin system, manifest structure, marketplace distribution
- [Claude Code Context Windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) -- token limits and context management
- [PAT Base64 Encoding Issues](https://developercommunity.visualstudio.com/content/problem/446754/pat-auth-docs-for-azure-devops-dont-mention-the-se.html) -- community-reported colon prefix issue
- [WIQL Reference Syntax](https://learn.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax?view=azure-devops) -- query language limitations
- [Azure DevOps Pagination Issues](https://learn.microsoft.com/en-us/answers/questions/5603409/azure-pipeline-api-is-not-accepting-the-continuati) -- continuation token handling problems
