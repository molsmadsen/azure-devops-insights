// scripts/setup.mjs
import { saveConfig, maskPat, loadConfig, configExists } from './config.mjs';
import { validateConnection } from './ado-client.mjs';

// Parse --key=value args from process.argv
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const eq = a.indexOf('=');
      if (eq === -1) return [a.slice(2), true];
      return [a.slice(2, eq), a.slice(eq + 1)];
    })
);

// --read mode: print current config (PAT masked) for re-run detection
if (args.read) {
  if (!configExists()) {
    console.log(JSON.stringify({ exists: false }));
    process.exit(0);
  }
  const c = loadConfig();
  console.log(JSON.stringify({
    exists: true,
    orgUrl: c.orgUrl,
    project: c.project,
    pat: maskPat(c.pat)
  }));
  process.exit(0);
}

// --org/--project/--pat mode: validate and save
const { org, project, pat } = args;
if (!org || !project || !pat) {
  console.error(JSON.stringify({
    success: false,
    error: { type: 'usage', message: 'Usage: setup.mjs --org=<url> --project=<name> --pat=<token>' }
  }));
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
  summary: {
    orgUrl: org,
    project,
    pat: maskPat(pat)
  }
}));
