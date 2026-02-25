# Phase 1: Foundation - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin scaffold, `/adi:setup` skill, and Azure DevOps API client. Users can install the plugin, configure their connection (org URL, project, PAT), validate it works, and get clear feedback when it doesn't. Creating report skills is a separate phase.

</domain>

<decisions>
## Implementation Decisions

### Setup flow
- Sequential prompts: ask for org URL, then project name, then PAT — one at a time
- When prompting for PAT: include inline guidance on what permissions are required and a link to Azure DevOps PAT settings
- On re-run: show current values (PAT masked), ask which field to update — don't restart from scratch
- Confirmation on success: summary of what was saved (org, project, PAT masked) + "You're ready — try `/adi:pr-metrics`"

### Validation feedback
- Success: confirm what was tested — e.g. "Connected to [org/project]. Verified read access to repos and work items."
- Failure: list specific missing permissions with instructions on where to add them in Azure DevOps PAT settings
- Distinguish network errors (org URL unreachable/wrong) from auth errors (PAT rejected) — separate messages for each
- On failure: re-prompt the specific failed field (org URL or PAT) rather than exiting and making user re-run `/adi:setup`

### Config scope
- Single active connection — one org + project. Re-run `/adi:setup` to switch.
- Config stores only: org URL, project name, PAT
- PAT stored as plaintext JSON; setup output includes a note: "Stored in `~/.adi/config.json` — keep this file private"
- Config directory created silently if it doesn't exist (no mention to user)

### Plugin structure
- One `.md` file per skill, all in a `skills/` directory
- Shared logic (API client, config reader/writer) in a `scripts/` directory as JavaScript (Node.js — no build step)
- Plugin name: `adi` — all commands use `/adi:` prefix (e.g., `/adi:setup`, `/adi:pr-metrics`, `/adi:help`)
- Config directory: `~/.adi/config.json` (short, consistent with plugin prefix)
- Include `/adi:help` skill in Phase 1 listing all available commands and their purpose
- All report skills guard against missing config: if `~/.adi/config.json` doesn't exist, show "Run `/adi:setup` first." before doing anything

### Claude's Discretion
- Exact config directory choice if `~/.adi/` feels wrong given Claude Code plugin conventions (user deferred this)
- README formatting and organization beyond the requirement that it covers install + full skill reference

</decisions>

<specifics>
## Specific Ideas

- GitHub repo is named `azure-devops-insights` → install command will be: `claude plugin add github:org/azure-devops-insights`
- Plugin prefix `adi` chosen specifically to avoid confusion with `ado` (the Azure DevOps CLI tool)
- README should document all skills with expected behavior — not just the install command

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-25*
