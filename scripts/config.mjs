// scripts/config.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.adi');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    throw new Error('Not configured. Run /adi:setup first.\nExpected config at: ' + CONFIG_FILE);
  }
}

export function configExists() {
  try { readFileSync(CONFIG_FILE); return true; } catch { return false; }
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function maskPat(pat) {
  if (!pat || pat.length < 8) return '***';
  return pat.slice(0, 4) + '*'.repeat(pat.length - 8) + pat.slice(-4);
}
