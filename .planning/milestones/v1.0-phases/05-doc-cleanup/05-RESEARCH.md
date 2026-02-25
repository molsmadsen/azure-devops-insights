# Phase 5: v1.0 Doc & Traceability Cleanup - Research

**Researched:** 2026-02-25
**Domain:** Documentation consistency, planning artifact traceability
**Confidence:** HIGH

## Summary

Phase 5 is a pure documentation and planning-artifact cleanup phase. All v1 requirements (DIST-01, PR-06) are already functionally satisfied by shipped code — this phase closes the gap between what was built and what documents say. No code changes are required.

The audit (`v1.0-MILESTONE-AUDIT.md`) catalogued exactly 8 items across 2 categories: user-visible documentation gaps (3 items in `skills/help/SKILL.md` and `README.md`) and planning artifact inconsistencies (5 items in `REQUIREMENTS.md` and `02-01-SUMMARY.md`). Every item is fully scoped — the research below provides the exact current state and exact required end state for each file.

There is one plan in this phase (05-01). All 8 items can be executed in sequence within that single plan because they are independent text edits with no dependency ordering requirements.

**Primary recommendation:** Treat each file as an atomic edit unit. Verify the exact current text before editing to avoid introducing regressions.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIST-01 | User can install the skill pack via the two-step marketplace flow | Closed by: updating help SKILL.md (command discoverable post-install), README Skills Reference (correct marketing copy), README dev path (correct local dev command), REQUIREMENTS.md DIST-01 text (accurate install description) |
| PR-06 | Output is a written AI narrative with findings, anomalies, and recommendations — not raw numbers | Closed by: moving /adi:pr-metrics out of "Coming soon" in help SKILL.md so the shipped narrative feature is correctly documented as available |
</phase_requirements>

## Standard Stack

No libraries, frameworks, or packages are involved. This phase edits Markdown files and a YAML frontmatter block.

### Core
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| Text editor / Write tool | Edit `.md` files | Direct file modification — no tooling needed |
| YAML frontmatter | Structured metadata at top of SUMMARY.md | Existing pattern used by all SUMMARY.md files in this project |

### Alternatives Considered
None — this is plain-text editing. No tooling alternatives to consider.

## Architecture Patterns

### File Edit Pattern: Read-Verify-Write

For every file in this phase, the correct pattern is:

1. Read the file to confirm the exact current text
2. Verify the target line/section matches what the audit reported
3. Write the corrected version
4. Grep the file to confirm the change landed correctly

This prevents silent mismatches if a file was already partially edited.

### Pattern: YAML Frontmatter Addition

The `02-01-SUMMARY.md` file requires adding a new field to its existing YAML frontmatter block. The frontmatter block is delimited by `---` on line 1 and a closing `---` further down. The new field must be inserted inside this block, not after it.

Current frontmatter fields in `02-01-SUMMARY.md`:
```
---
phase: 02-pr-metrics
plan: 01
subsystem: data-layer
tags: [...]
dependency_graph: ...
tech_stack: ...
key_files: ...
decisions: ...
metrics: ...
---
```

Required addition — insert `requirements-completed` field after `tags`:
```yaml
requirements-completed: [PR-01, PR-02, PR-03, PR-04, PR-05]
```

This matches the field name used in other SUMMARY.md files in the project (e.g., `02-02-SUMMARY.md` which already has `requirements-completed: [PR-06]`).

### Pattern: Table Row Addition

For README.md and skills/help/SKILL.md, the change is adding a row to an existing Markdown table and removing the corresponding row from the "Coming soon" section.

### Anti-Patterns to Avoid
- **Editing without reading first:** Always read the current file state before writing. The audit descriptions match the state at audit time (2026-02-25) — confirm they still match before editing.
- **Partial edits:** When moving `/adi:pr-metrics` from "Coming soon" to the available table, the row must be both added to the table AND removed from the future section. Leaving it in both places creates confusion.
- **Changing unrelated content:** Each file edit should only touch the specific lines identified. Do not reformat, reorder, or improve adjacent content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verifying edits | Custom verification script | Direct grep/read after write | These are one-time text edits; a verification script would be more code than the edit itself |

**Key insight:** This entire phase is find-and-replace / append operations on 4 files. The complexity is in knowing exactly what to change, not in how to change it.

## Exact Changes Required

This section documents the complete, precise change required for each file. The planner should use this to construct task actions.

### File 1: `skills/help/SKILL.md`

**Current state (lines 10-26):**
```markdown
| Command | Description |
|---------|-------------|
| `/adi:setup` | Configure your Azure DevOps connection (org URL, project name, PAT). Run this first. |
| `/adi:help` | Show this help — list all available commands. |

**Coming in future versions:**
- `/adi:pr-metrics` — AI-narrated pull request health report
- `/adi:contributors` — Contributor activity analysis
- `/adi:bugs` — Bug health and trend report
- `/adi:sprint` — Current sprint status and backlog health
- `/adi:summary` — Project health synthesis across all signals
- `/adi:update` — Update the plugin to the latest version

**Getting started:**
1. Run `/adi:setup` to configure your Azure DevOps connection
2. Run `/adi:pr-metrics` to see your first report (available in Phase 2)
```

**Required end state:**
```markdown
| Command | Description |
|---------|-------------|
| `/adi:setup` | Configure your Azure DevOps connection (org URL, project name, PAT). Run this first. |
| `/adi:help` | Show this help — list all available commands. |
| `/adi:pr-metrics` | AI-narrated pull request health report (review times, stale PRs, bottlenecks). |

**Coming in future versions:**
- `/adi:contributors` — Contributor activity analysis
- `/adi:bugs` — Bug health and trend report
- `/adi:sprint` — Current sprint status and backlog health
- `/adi:summary` — Project health synthesis across all signals
- `/adi:update` — Update the plugin to the latest version

**Getting started:**
1. Run `/adi:setup` to configure your Azure DevOps connection
2. Run `/adi:pr-metrics` to see your first pull request health report
```

**Changes:** Add `/adi:pr-metrics` row to the available commands table; remove it from "Coming in future versions" list; update step 2 to remove "(available in Phase 2)" phrasing.

---

### File 2: `README.md`

**Change A — Skills Reference table (lines 56-59):**

Current:
```markdown
| Command | Description |
|---------|-------------|
| `/adi:setup` | Configure your Azure DevOps connection (org URL, project name, PAT). Run this first. Re-run to update credentials. |
| `/adi:help` | List all available commands and their purpose. |
```

Required:
```markdown
| Command | Description |
|---------|-------------|
| `/adi:setup` | Configure your Azure DevOps connection (org URL, project name, PAT). Run this first. Re-run to update credentials. |
| `/adi:help` | List all available commands and their purpose. |
| `/adi:pr-metrics` | AI-narrated pull request health report — review times, stale PRs, bottlenecks. |
```

**Change B — Remove from "Coming Soon" section (lines 61-70):**

Current:
```markdown
### Coming Soon (Phase 2+)

| Command | Description |
|---------|-------------|
| `/adi:pr-metrics` | Pull request throughput, review times, and merge rates |
| `/adi:contributors` | Contributor activity and commit distribution |
...
```

Required (remove `/adi:pr-metrics` row; rename heading):
```markdown
### Coming Soon (Phase 3+)

| Command | Description |
|---------|-------------|
| `/adi:contributors` | Contributor activity and commit distribution |
| `/adi:bugs` | Bug trend and open issue summary |
| `/adi:sprint` | Current sprint health and completion forecast |
| `/adi:summary` | Full project health report combining all metrics |
| `/adi:update` | Refresh all cached data from Azure DevOps |
```

**Change C — Local dev path (line 79):**

Current:
```
claude --plugin-dir ./azure-devops-insights
```

Required:
```
claude --plugin-dir .
```

---

### File 3: `REQUIREMENTS.md`

**Change A — DIST-01 description:**

Current:
```
- [x] **DIST-01**: User can install the skill pack via the two-step marketplace flow: `/plugin marketplace add` then `/plugin install adi@azure-devops-insights`
```

The DIST-01 text is actually already correct in the current REQUIREMENTS.md (it says "two-step marketplace flow"). The audit noted that earlier versions referenced `claude plugin add github:org/repo` — verify current text before editing.

**Actual audit item from v1.0-MILESTONE-AUDIT.md:**
> "REQUIREMENTS.md DIST-01 text describes non-existent 'claude plugin add github:org/repo' single-command install"

Current REQUIREMENTS.md line 10 reads:
```
- [x] **DIST-01**: User can install the skill pack via the two-step marketplace flow: `/plugin marketplace add` then `/plugin install adi@azure-devops-insights`
```

This text already describes the correct two-step flow. Verify on read — if the text already matches the correct state, no change needed for DIST-01 description. However the traceability table at the bottom needs updating (REQUIREMENTS.md line 79) to show Phase 5 gap closure.

**Change B — AUTH-01 storage description (line 17):**

Current:
```
- [x] **AUTH-01**: User can run `/adi:setup` to configure org URL, project name, and PAT -- stored at `~/.adi/config.json` with 0o600 permissions
```

The REQUIREMENTS.md already shows the corrected text (`~/.adi/config.json` with 0o600 permissions). The audit flagged the ORIGINAL text that said "OS credential store / keychain" — verify current state on read. If AUTH-01 already shows the correct storage path, no edit needed.

**Change C — AUTH-01/AUTH-03 prefix fix:**

Current AUTH-01 (line 17): Uses `/adi:setup` — already correct.
Current AUTH-03 (line 19): Uses `/adi:setup` — already correct.

The audit flagged these as using `/ado:setup` — but the REQUIREMENTS.md as read shows `/adi:setup` already. Verify on read.

**Change D — Traceability table update:**

The traceability table at lines 79-88 needs DIST-01 and PR-06 updated to reflect Phase 5:
- DIST-01 row: Phase column should include "Phase 5 (gap closure)"; Status should show "Complete (doc gap -> Phase 5)"
- PR-06 row: same pattern

Verify current state — REQUIREMENTS.md traceability table already shows these updates (was updated during audit). Confirm before editing.

**Net assessment:** The REQUIREMENTS.md was already corrected during the audit process (last updated 2026-02-25 per line 110-111). The planner should instruct the executor to read REQUIREMENTS.md first and only apply changes where the current text does NOT match the correct state. The primary item remaining may be the AUTH-01 "OS keychain" text if not yet corrected.

---

### File 4: `.planning/phases/02-pr-metrics/02-01-SUMMARY.md`

**Change: Add `requirements-completed` frontmatter field**

Current frontmatter (lines 1-26) does NOT include `requirements-completed`.

Required — insert after the `tags` line (line 5):
```yaml
requirements-completed: [PR-01, PR-02, PR-03, PR-04, PR-05]
```

This is the only change needed. All other frontmatter fields are correct.

## Common Pitfalls

### Pitfall 1: Assuming Audit Text = Current File State
**What goes wrong:** The audit was run on 2026-02-25. Some REQUIREMENTS.md items may have already been fixed (AUTH-01 storage description, /ado:setup prefix). Editing based on the audit description without reading the current file will produce double-edits or wrong diffs.
**Why it happens:** Audit reports are point-in-time snapshots; files may have changed since.
**How to avoid:** Always read the file first. Confirm the "current" text before writing the "required" text.
**Warning signs:** The current text doesn't match what the audit says it should be.

### Pitfall 2: Leaving /adi:pr-metrics in Both Table and "Coming Soon"
**What goes wrong:** Add the row to the available commands table but forget to remove it from the future versions list.
**Why it happens:** Two separate edits in the same file, easy to do one and miss the other.
**How to avoid:** Treat both changes as one atomic action. After writing the file, grep for "pr-metrics" to verify it appears exactly once (in the table only).
**Warning signs:** Running `/adi:help` shows `/adi:pr-metrics` twice.

### Pitfall 3: Wrong YAML Indentation in Frontmatter
**What goes wrong:** Adding `requirements-completed` field with wrong indentation or formatting breaks YAML parsing of 02-01-SUMMARY.md.
**Why it happens:** The existing fields use bare list syntax `[PR-01, PR-02]` (inline) not multi-line list format.
**How to avoid:** Use inline list format: `requirements-completed: [PR-01, PR-02, PR-03, PR-04, PR-05]` — matching the `tags` field format on line 5.
**Warning signs:** YAML parser errors if any tool reads the frontmatter.

### Pitfall 4: Getting README Section Heading Wrong
**What goes wrong:** Changing "Coming Soon (Phase 2+)" to something other than "Coming Soon (Phase 3+)" — or leaving it as "Phase 2+" after removing pr-metrics.
**Why it happens:** The heading refers to phase numbers; Phase 2 is now complete.
**How to avoid:** Update the heading to "Phase 3+" when removing the pr-metrics row.

## Code Examples

### Correct skills/help/SKILL.md Final State
```markdown
---
name: help
description: List all available /adi: commands and their purpose.
disable-model-invocation: true
allowed-tools: []
---

List all available Azure DevOps Insights commands:

| Command | Description |
|---------|-------------|
| `/adi:setup` | Configure your Azure DevOps connection (org URL, project name, PAT). Run this first. |
| `/adi:help` | Show this help — list all available commands. |
| `/adi:pr-metrics` | AI-narrated pull request health report (review times, stale PRs, bottlenecks). |

**Coming in future versions:**
- `/adi:contributors` — Contributor activity analysis
- `/adi:bugs` — Bug health and trend report
- `/adi:sprint` — Current sprint status and backlog health
- `/adi:summary` — Project health synthesis across all signals
- `/adi:update` — Update the plugin to the latest version

**Getting started:**
1. Run `/adi:setup` to configure your Azure DevOps connection
2. Run `/adi:pr-metrics` to see your first pull request health report
```

### Verification Command Pattern
After each file edit, run a grep to confirm the expected text is present and the stale text is absent:

```bash
# Confirm /adi:pr-metrics is in the table (not future section) in help SKILL.md
grep -n "pr-metrics" skills/help/SKILL.md

# Confirm README no longer has "Coming Soon (Phase 2+)"
grep -n "Phase 2+" README.md

# Confirm README local dev path is corrected
grep -n "plugin-dir" README.md

# Confirm 02-01-SUMMARY.md has requirements-completed
grep -n "requirements-completed" .planning/phases/02-pr-metrics/02-01-SUMMARY.md
```

## State of the Art

| Old State | Current Required State | Impact |
|-----------|----------------------|--------|
| `skills/help/SKILL.md` lists `/adi:pr-metrics` as "Coming soon" | List it in available commands table | Users running /adi:help after Phase 2 install will discover the command |
| `README.md` Skills Reference missing `/adi:pr-metrics` | Row added to table; removed from Coming Soon | External discoverers see accurate capabilities |
| `README.md` line 79: `./azure-devops-insights` | `claude --plugin-dir .` | Local dev works without path error |
| `02-01-SUMMARY.md` no `requirements-completed` | `requirements-completed: [PR-01, PR-02, PR-03, PR-04, PR-05]` | Traceability audit 3-source coverage complete for PR-01 through PR-05 |

## Open Questions

1. **REQUIREMENTS.md current state vs. audit state**
   - What we know: The audit was run 2026-02-25 and flagged AUTH-01/AUTH-03 `/ado:setup` prefix; DIST-01 "github:" shorthand. The REQUIREMENTS.md as read now (also 2026-02-25, last updated line 110) shows `/adi:setup` and the two-step flow already.
   - What's unclear: Whether the REQUIREMENTS.md was corrected as part of the audit workflow or was always correct (audit may have been reading a stale snapshot).
   - Recommendation: Read REQUIREMENTS.md at task execution time and apply only changes where current text does NOT match the required state. The planner should list the expected incorrect text and the expected correct text; the executor confirms match before applying.

## Sources

### Primary (HIGH confidence)
- `.planning/v1.0-MILESTONE-AUDIT.md` — authoritative gap and tech debt catalog
- `.planning/ROADMAP.md` Phase 5 section — exact success criteria and gap list
- `skills/help/SKILL.md` — current file state read directly
- `README.md` — current file state read directly
- `.planning/phases/02-pr-metrics/02-01-SUMMARY.md` — current frontmatter read directly
- `.planning/REQUIREMENTS.md` — current requirement text read directly

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — confirms Phase 2 is complete; decisions log
- `.planning/config.json` — confirms nyquist_validation not enabled

## Metadata

**Confidence breakdown:**
- Gap inventory: HIGH — sourced directly from audit report and confirmed by reading current file state
- Required changes: HIGH — exact before/after text derived from file reads, not assumptions
- REQUIREMENTS.md state: MEDIUM — text may already be partially corrected; executor must verify on read

**Research date:** 2026-02-25
**Valid until:** 2026-03-26 (stable content — doc edits, no external dependencies)
