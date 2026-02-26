// scripts/bugs.mjs
// Fetches open bug data from Azure DevOps and computes severity, age, and assignment metrics.
// Outputs a single JSON object to stdout for Claude to narrate.
// Progress messages go to stderr only — stdout is JSON-only.

import { loadConfig, configExists } from './config.mjs';
import { adoWiql, adoGetWorkItemsBatch } from './ado-client.mjs';

// ---------------------------------------------------------------------------
// Arg parsing (follows pr-metrics.mjs pattern exactly)
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const eq = a.indexOf('='); return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), 'true']; })
);
const daysContext = args.days ? parseInt(args.days, 10) : 30;
const typesRaw = args.types || 'Bug';
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
// Computation helpers
// ---------------------------------------------------------------------------

function mean(arr) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

  const types = typesRaw.split(',').map(t => t.trim()).filter(Boolean);

  // Build WIQL query — process-template agnostic, uses raw type names
  const typeList = types.map(t => `'${t}'`).join(',');
  const wiqlQuery = `SELECT [System.Id] FROM WorkItems
WHERE [System.WorkItemType] IN (${typeList})
  AND [System.State] NOT IN ('Closed', 'Resolved', 'Done')
  AND [System.TeamProject] = @project
ORDER BY [Microsoft.VSTS.Common.Severity] ASC, [System.CreatedDate] ASC`;

  process.stderr.write('Querying open bugs...\n');

  let wiqlResult;
  try {
    wiqlResult = await adoWiql(config, wiqlQuery, 500);
  } catch (e) {
    console.log(JSON.stringify({ error: { type: e.type || 'api', message: e.message } }));
    process.exit(1);
  }

  const ids = (wiqlResult.workItems || []).map(wi => wi.id);

  // If no bugs found, output summary and exit normally
  if (ids.length === 0) {
    console.log(JSON.stringify({
      summary: {
        project: config.project,
        totalOpenBugs: 0,
        queriedTypes: types,
        queryDate: new Date().toISOString()
      },
      severityBreakdown: {},
      ageAnalysis: { meanDays: null, medianDays: null, buckets: { '0-7 days': 0, '8-30 days': 0, '31-90 days': 0, '90+ days': 0 } },
      top5Oldest: [],
      assignmentDistribution: []
    }));
    process.exit(0);
  }

  // Batch fetch work item details
  process.stderr.write(`Fetching details for ${ids.length} bugs...\n`);

  const fields = [
    'System.Id', 'System.Title', 'System.State', 'System.CreatedDate',
    'System.ChangedDate', 'System.AssignedTo',
    'Microsoft.VSTS.Common.Severity', 'Microsoft.VSTS.Common.Priority',
    'System.Tags'
  ];

  let result;
  try {
    result = await adoGetWorkItemsBatch(config, ids, fields);
  } catch (e) {
    console.log(JSON.stringify({ error: { type: e.type || 'api', message: e.message } }));
    process.exit(1);
  }

  const workItems = result.value || [];
  const now = Date.now();

  // ---------------------------------------------------------------------------
  // Severity breakdown — process-template agnostic (raw values)
  // ---------------------------------------------------------------------------
  const severityGroups = {};
  for (const wi of workItems) {
    const f = wi.fields;
    const severity = f['Microsoft.VSTS.Common.Severity'] || 'Unspecified';
    if (!severityGroups[severity]) severityGroups[severity] = [];
    severityGroups[severity].push({ id: f['System.Id'], title: f['System.Title'] });
  }

  // Sort: numeric prefix first, then alphabetical
  const sortedSeverities = Object.keys(severityGroups).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b);
  });

  const severityBreakdown = {};
  for (const sev of sortedSeverities) {
    severityBreakdown[sev] = { count: severityGroups[sev].length, bugs: severityGroups[sev] };
  }

  // ---------------------------------------------------------------------------
  // Age analysis
  // ---------------------------------------------------------------------------
  const ageDaysArr = workItems.map(wi => {
    const created = new Date(wi.fields['System.CreatedDate']).getTime();
    return Math.floor((now - created) / 86400000);
  });

  const buckets = { '0-7 days': 0, '8-30 days': 0, '31-90 days': 0, '90+ days': 0 };
  for (const age of ageDaysArr) {
    if (age <= 7) buckets['0-7 days']++;
    else if (age <= 30) buckets['8-30 days']++;
    else if (age <= 90) buckets['31-90 days']++;
    else buckets['90+ days']++;
  }

  const ageAnalysis = {
    meanDays: mean(ageDaysArr) !== null ? Math.round(mean(ageDaysArr) * 10) / 10 : null,
    medianDays: median(ageDaysArr),
    buckets
  };

  // ---------------------------------------------------------------------------
  // Top 5 oldest unresolved
  // ---------------------------------------------------------------------------
  const sortedByAge = [...workItems].sort(
    (a, b) => new Date(a.fields['System.CreatedDate']) - new Date(b.fields['System.CreatedDate'])
  );

  const top5Oldest = sortedByAge.slice(0, 5).map(wi => {
    const f = wi.fields;
    const created = new Date(f['System.CreatedDate']);
    const ageDays = Math.floor((now - created.getTime()) / 86400000);
    const assignedTo = f['System.AssignedTo']?.displayName || 'Unassigned';
    return {
      id: f['System.Id'],
      title: f['System.Title'],
      severity: f['Microsoft.VSTS.Common.Severity'] || 'Unspecified',
      ageDays,
      assignedTo,
      createdDate: f['System.CreatedDate']
    };
  });

  // ---------------------------------------------------------------------------
  // Assignment distribution
  // ---------------------------------------------------------------------------
  const assigneeGroups = {};
  for (const wi of workItems) {
    const f = wi.fields;
    const assignee = f['System.AssignedTo']?.displayName || 'Unassigned';
    if (!assigneeGroups[assignee]) assigneeGroups[assignee] = { count: 0, severities: {} };
    assigneeGroups[assignee].count++;
    const sev = f['Microsoft.VSTS.Common.Severity'] || 'Unspecified';
    assigneeGroups[assignee].severities[sev] = (assigneeGroups[assignee].severities[sev] || 0) + 1;
  }

  const assignmentDistribution = Object.entries(assigneeGroups)
    .map(([assignee, data]) => ({
      assignee,
      count: data.count,
      severities: data.severities,
      overloaded: data.count > 5
    }))
    .sort((a, b) => b.count - a.count);

  // ---------------------------------------------------------------------------
  // Output JSON
  // ---------------------------------------------------------------------------
  const output = {
    summary: {
      project: config.project,
      totalOpenBugs: workItems.length,
      queriedTypes: types,
      queryDate: new Date().toISOString()
    },
    severityBreakdown,
    ageAnalysis,
    top5Oldest,
    assignmentDistribution
  };

  console.log(JSON.stringify(output));
}

main().catch(e => {
  console.log(JSON.stringify({ error: { type: 'unexpected', message: e.message } }));
  process.exit(1);
});
