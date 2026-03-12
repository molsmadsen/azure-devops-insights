# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Activity Skills & Distribution

**Shipped:** 2026-03-12
**Phases:** 2 | **Plans:** 6 | **Tasks:** 12

### What Was Built
- 4 new analysis skills: contributors, bugs, sprint, summary
- Self-update command with git-based changelog
- 7 new ADO API functions in shared client
- Distribution polish: org metadata, version bump, complete README

### What Worked
- Proven pattern from v1.0 (data script + SKILL.md narration) replicated efficiently across 4 new skills
- Sequential API call approach avoided rate-limit issues entirely
- execSync orchestrator pattern for summary skill cleanly handles partial failures
- Plan execution averaged ~2 min per plan — fast and predictable

### What Was Inefficient
- bugs.mjs accidentally committed during 03-02 plan run (committed alongside contributors.mjs) — no functional impact but shows staging discipline gap
- No REQUIREMENTS.md created for v1.1 — requirements only tracked in PROJECT.md Active section, reducing traceability
- No milestone audit performed before completion

### Patterns Established
- POST endpoint pattern: method:'POST', body:JSON.stringify(...), same error handling as GET
- Internal chunking pattern for batch APIs (200 IDs per request)
- Child process orchestrator for multi-skill synthesis
- Cross-cutting theme narration (by theme, not by data source)
- Config-free skill pattern (update.mjs skips config guard)

### Key Lessons
1. The skill pattern (data script + SKILL.md) is highly replicable — adding a new skill is predictable ~2 min work
2. Sequential API calls are sufficient for single-user CLI tool — no need to optimize for parallelism
3. Cross-cutting themes produce better executive summaries than per-skill sections
4. Create REQUIREMENTS.md at milestone start, not just for v1.0

### Cost Observations
- Model mix: quality profile (opus-heavy for agents)
- Plan execution: 6 plans in ~13 min total
- Notable: Fastest per-plan average of any milestone (2.2 min)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 3 | 7 | Established plugin scaffold + skill pattern |
| v1.1 | 2 | 6 | Replicated pattern 4x, added orchestration layer |

### Top Lessons (Verified Across Milestones)

1. Zero-dependency constraint has held through v1.1 with no friction — Node.js built-ins sufficient for REST API + file I/O + child process
2. Conditional recommendations pattern (only show when actionable issues found) validated across all 5 analysis skills
3. Written narrative output remains the core differentiator — every new skill follows the same narration template approach
