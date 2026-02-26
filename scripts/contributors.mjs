// scripts/contributors.mjs
// Fetches commit data and team membership from Azure DevOps, classifies
// contributors as active, quiet, or former.
// Outputs a single JSON object to stdout for Claude to narrate.
// Progress messages go to stderr only — stdout is JSON-only.

import { loadConfig, configExists } from './config.mjs';
import { adoGetCommits, adoGetTeamMembers, adoGetProject, adoGetRepos } from './ado-client.mjs';

// ---------------------------------------------------------------------------
// Arg parsing (follows pr-metrics.mjs pattern exactly)
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const eq = a.indexOf('='); return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), 'true']; })
);
const repoFilter = args.repo || null;
const days = args.days ? parseInt(args.days, 10) : 30;
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

  const anonymous = args.anonymous === 'true' || config.anonymous === true;

  // -------------------------------------------------------------------------
  // Fetch repos
  // -------------------------------------------------------------------------
  let repos;
  try {
    const reposData = await adoGetRepos(config);
    repos = reposData.value || [];
  } catch (e) {
    console.log(JSON.stringify({ error: { type: e.type || 'api', message: e.message } }));
    process.exit(1);
  }

  // Apply --repo filter
  if (repoFilter) {
    const match = repos.find(r => r.name.toLowerCase() === repoFilter.toLowerCase());
    if (!match) {
      const available = repos.map(r => r.name);
      console.log(JSON.stringify({
        error: {
          type: 'not_found',
          message: `Repository '${repoFilter}' not found.`,
          availableRepos: available
        }
      }));
      process.exit(1);
    }
    repos = [match];
  }

  // -------------------------------------------------------------------------
  // Fetch commits per repo (sequential — rate limit safety)
  // -------------------------------------------------------------------------
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString();
  const allCommits = [];
  const repoNames = [];

  for (const repo of repos) {
    process.stderr.write(`Fetching commits from ${repo.name}...\n`);
    try {
      const data = await adoGetCommits(config, repo.id, {
        'searchCriteria.fromDate': sinceDate,
        'searchCriteria.$top': '1000'
      });
      const commits = (data.value || []).map(c => ({ ...c, repoName: repo.name }));
      if (commits.length > 0) repoNames.push(repo.name);
      allCommits.push(...commits);
    } catch (e) {
      process.stderr.write(`Warning: failed to fetch commits from ${repo.name}: ${e.message}\n`);
    }
  }

  // -------------------------------------------------------------------------
  // Aggregate commits by author email
  // -------------------------------------------------------------------------
  const authorMap = new Map(); // email -> { name, email, commitCount, repos: Set, lastCommitDate }

  for (const commit of allCommits) {
    const email = (commit.author?.email || '').toLowerCase();
    if (!email) continue;
    const name = commit.author?.name || 'Unknown';
    const date = commit.author?.date || null;

    if (!authorMap.has(email)) {
      authorMap.set(email, {
        name,
        email,
        commitCount: 0,
        repos: new Set(),
        lastCommitDate: date
      });
    }
    const entry = authorMap.get(email);
    entry.commitCount++;
    if (commit.repoName) entry.repos.add(commit.repoName);
    // Keep the most recent display name
    if (date && (!entry.lastCommitDate || date > entry.lastCommitDate)) {
      entry.name = name;
      entry.lastCommitDate = date;
    }
  }

  // -------------------------------------------------------------------------
  // Fetch team members
  // -------------------------------------------------------------------------
  let teamMembers = null;
  let teamName = null;

  try {
    const projectData = await adoGetProject(config);
    const defaultTeamId = projectData.defaultTeam?.id;
    teamName = projectData.defaultTeam?.name || projectData.name;

    if (defaultTeamId) {
      const membersData = await adoGetTeamMembers(config, defaultTeamId);
      teamMembers = membersData.value || [];
    }
  } catch (e) {
    process.stderr.write(`Warning: could not fetch team data: ${e.message}\n`);
    teamMembers = null;
  }

  // -------------------------------------------------------------------------
  // Classify contributors
  // -------------------------------------------------------------------------
  let active = [];
  let quiet = [];
  let former = [];
  let teamDataUnavailable = false;

  if (teamMembers === null) {
    // Degraded mode: no team data, list all commit authors as contributors
    teamDataUnavailable = true;
    active = [...authorMap.values()].map(a => ({
      name: a.name,
      email: a.email,
      commitCount: a.commitCount,
      repos: [...a.repos],
      lastCommitDate: a.lastCommitDate
    })).sort((a, b) => b.commitCount - a.commitCount);
  } else {
    // Build team email set and name map
    const teamEmails = new Set();
    const teamNameMap = new Map();
    for (const member of teamMembers) {
      const email = (member.identity?.uniqueName || '').toLowerCase();
      if (email) {
        teamEmails.add(email);
        teamNameMap.set(email, member.identity?.displayName || email);
      }
    }

    // Classify commit authors
    for (const [email, author] of authorMap) {
      if (teamEmails.has(email)) {
        // Active: on team and has commits
        active.push({
          name: author.name,
          email: author.email,
          commitCount: author.commitCount,
          repos: [...author.repos],
          lastCommitDate: author.lastCommitDate
        });
        teamEmails.delete(email);
      } else {
        // Former: has commits but not on team
        former.push({
          name: author.name,
          email: author.email,
          commitCount: author.commitCount,
          repos: [...author.repos],
          lastCommitDate: author.lastCommitDate
        });
      }
    }

    // Quiet: on team but no commits
    for (const email of teamEmails) {
      quiet.push({
        name: teamNameMap.get(email) || email,
        email
      });
    }

    // Sort
    active.sort((a, b) => b.commitCount - a.commitCount);
    quiet.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    former.sort((a, b) => b.commitCount - a.commitCount);
  }

  // -------------------------------------------------------------------------
  // Anonymous mode
  // -------------------------------------------------------------------------
  if (anonymous) {
    active = active.map((a, i) => ({ ...a, name: `Active Contributor ${i + 1}`, email: '---' }));
    quiet = quiet.map((q, i) => ({ ...q, name: `Team Member ${i + 1}`, email: '---' }));
    former = former.map((f, i) => ({ ...f, name: `Former Contributor ${i + 1}`, email: '---' }));
  }

  // -------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------
  const totalCommits = [...authorMap.values()].reduce((sum, a) => sum + a.commitCount, 0);

  const result = {
    summary: {
      project: config.project,
      daysCovered: days,
      reposAnalyzed: repoNames.length,
      repoNames,
      totalCommits,
      teamName: teamName || config.project,
      teamDataUnavailable
    },
    active,
    quiet,
    former
  };

  console.log(JSON.stringify(result));
}

main().catch(e => {
  console.log(JSON.stringify({ error: { type: 'unexpected', message: e.message } }));
  process.exit(1);
});
