// scripts/update.mjs — Self-update via git pull with changelog
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// Parse --key=value args
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const eq = a.indexOf('=');
      if (eq === -1) return [a.slice(2), true];
      return [a.slice(2, eq), a.slice(eq + 1)];
    })
);

// --check-config mode: update does not require config, always proceed
if (args['check-config']) {
  console.log(JSON.stringify({ configMissing: false }));
  process.exit(0);
}

// Resolve plugin directory
function resolvePluginDir() {
  const home = homedir();
  const installedPath = resolve(home, '.claude/plugins/installed_plugins.json');
  try {
    const data = JSON.parse(readFileSync(installedPath, 'utf8'));
    const plugins = data.plugins || data;
    const entry = Object.values(plugins).find(
      x => String(x.name || x.pluginName || x.installPath || '').includes('adi')
    );
    if (entry && entry.installPath) return entry.installPath;
  } catch {
    // Fall through to fallbacks
  }
  if (process.env.CLAUDE_PLUGIN_ROOT) return process.env.CLAUDE_PLUGIN_ROOT;
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, '..');
}

const pluginDir = resolvePluginDir();

// Check for .git directory
try {
  execSync('git rev-parse --git-dir', { cwd: pluginDir, encoding: 'utf8', stdio: 'pipe' });
} catch {
  console.log(JSON.stringify({
    error: {
      type: 'no_git',
      message: 'Update requires git. Re-install via: git clone https://github.com/molsmadsen/azure-devops-insights'
    }
  }));
  process.exit(1);
}

// Get current HEAD
let oldHead;
try {
  oldHead = execSync('git rev-parse HEAD', { cwd: pluginDir, encoding: 'utf8', stdio: 'pipe' }).trim();
} catch (e) {
  console.log(JSON.stringify({ error: { type: 'git', message: `Failed to read current HEAD: ${e.message}` } }));
  process.exit(1);
}

// Pull latest
try {
  process.stderr.write('Pulling latest changes...\n');
  execSync('git pull', { cwd: pluginDir, encoding: 'utf8', stdio: 'pipe' });
} catch (e) {
  console.log(JSON.stringify({ error: { type: 'git', message: `Git pull failed: ${e.message}` } }));
  process.exit(1);
}

// Get new HEAD
let newHead;
try {
  newHead = execSync('git rev-parse HEAD', { cwd: pluginDir, encoding: 'utf8', stdio: 'pipe' }).trim();
} catch (e) {
  console.log(JSON.stringify({ error: { type: 'git', message: `Failed to read new HEAD: ${e.message}` } }));
  process.exit(1);
}

// Compare
if (oldHead === newHead) {
  console.log(JSON.stringify({ updated: false, message: 'Already up to date.' }));
} else {
  let changelog = '';
  try {
    changelog = execSync(`git log --oneline ${oldHead}..${newHead}`, {
      cwd: pluginDir, encoding: 'utf8', stdio: 'pipe'
    }).trim();
  } catch {
    changelog = '(Could not retrieve changelog)';
  }
  console.log(JSON.stringify({
    updated: true,
    oldHead: oldHead.slice(0, 7),
    newHead: newHead.slice(0, 7),
    changelog
  }));
}
