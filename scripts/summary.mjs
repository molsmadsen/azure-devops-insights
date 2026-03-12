// scripts/summary.mjs
// Orchestrates all four analysis sub-skills (pr-metrics, contributors, bugs, sprint)
// and outputs combined JSON for cross-skill synthesis narration.
// Progress messages go to stderr only — stdout is JSON-only.

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { configExists, loadConfig } from './config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Arg parsing (follows established pattern)
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const eq = a.indexOf('='); return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), 'true']; })
);
const days = args.days || null;
const repo = args.repo || null;
const anonymous = args.anonymous === 'true';
const checkConfig = args['check-config'] === 'true';

// ---------------------------------------------------------------------------
// Config check mode (for SKILL.md Step 0 guard)
// ---------------------------------------------------------------------------
if (checkConfig) {
  if (!configExists()) {
    console.log(JSON.stringify({ configMissing: true }));
  } else {
    console.log(JSON.stringify({ configMissing: false }));
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Sub-skill runner
// ---------------------------------------------------------------------------
function runSubSkill(scriptName, flags) {
  const scriptPath = join(__dirname, scriptName);
  const cmd = `node "${scriptPath}" ${flags}`.trim();
  process.stderr.write(`Running ${scriptName}...\n`);

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const parsed = JSON.parse(stdout);
    // Sub-skill returned an error JSON
    if (parsed.error) {
      return { ok: false, error: parsed.error.message || String(parsed.error), scriptName };
    }
    return { ok: true, data: parsed };
  } catch (e) {
    return { ok: false, error: e.message, scriptName };
  }
}

// ---------------------------------------------------------------------------
// Build flag strings for each sub-skill
// ---------------------------------------------------------------------------
function buildPrMetricsFlags() {
  const parts = [];
  if (days) parts.push(`--days=${days}`);
  if (repo) parts.push(`--repo=${repo}`);
  return parts.join(' ');
}

function buildContributorsFlags() {
  const parts = [];
  if (days) parts.push(`--days=${days}`);
  if (repo) parts.push(`--repo=${repo}`);
  if (anonymous) parts.push('--anonymous');
  return parts.join(' ');
}

function buildBugsFlags() {
  const parts = [];
  if (days) parts.push(`--days=${days}`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.log(JSON.stringify({ error: { type: 'config', message: e.message } }));
    process.exit(1);
  }

  // Run sub-skills sequentially (rate-limit safety)
  const prMetrics = runSubSkill('pr-metrics.mjs', buildPrMetricsFlags());
  const contributors = runSubSkill('contributors.mjs', buildContributorsFlags());
  const bugs = runSubSkill('bugs.mjs', buildBugsFlags());
  const sprint = runSubSkill('sprint.mjs', '');

  const results = { prMetrics, contributors, bugs, sprint };

  // Count successes/failures
  const skillNames = Object.keys(results);
  const succeeded = skillNames.filter(k => results[k].ok).length;
  const failed = skillNames.length - succeeded;

  // All four failed — single error output
  if (succeeded === 0) {
    console.log(JSON.stringify({
      error: {
        type: 'all_failed',
        message: 'All analysis skills failed. Check your connection with /adi:setup.'
      }
    }));
    process.exit(1);
  }

  const output = {
    prMetrics,
    contributors,
    bugs,
    sprint,
    meta: {
      project: config.project,
      generatedAt: new Date().toISOString(),
      skillsSucceeded: succeeded,
      skillsFailed: failed
    }
  };

  console.log(JSON.stringify(output));
}

main().catch(e => {
  console.log(JSON.stringify({ error: { type: 'unexpected', message: e.message } }));
  process.exit(1);
});
