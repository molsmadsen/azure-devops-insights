---
status: complete
phase: 03-activity-skills
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-02-26T13:00:00Z
updated: 2026-02-26T13:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Contributors script --check-config
expected: Running `node scripts/contributors.mjs --check-config` outputs `{"configMissing":true}` and exits cleanly with no crash.
result: pass

### 2. Bugs script --check-config
expected: Running `node scripts/bugs.mjs --check-config` outputs `{"configMissing":true}` and exits cleanly with no crash.
result: pass

### 3. Contributors script syntax valid
expected: Running `node -c scripts/contributors.mjs` exits with code 0 (no syntax errors).
result: pass

### 4. Bugs script syntax valid
expected: Running `node -c scripts/bugs.mjs` exits with code 0 (no syntax errors).
result: pass

### 5. Contributors SKILL.md exists and has narration sections
expected: `skills/contributors/SKILL.md` exists and contains sections for config guard, arg parsing, narration instructions (active/quiet/former contributor sections), and conditional recommendations.
result: pass

### 6. Bugs SKILL.md exists and has narration sections
expected: `skills/bugs/SKILL.md` exists and contains sections for config guard, arg parsing, narration instructions (severity breakdown, age analysis, assignment distribution), and conditional recommendations.
result: pass

### 7. ADO client exports new functions
expected: `scripts/ado-client.mjs` exports adoGetCommits, adoGetTeamMembers, adoGetProject, adoWiql, and adoGetWorkItemsBatch. Running `node -e "import('./scripts/ado-client.mjs').then(m => console.log(Object.keys(m).sort().join(', ')))"` shows all five new functions.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
