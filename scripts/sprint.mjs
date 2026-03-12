// scripts/sprint.mjs
// Fetches sprint/iteration data from Azure DevOps and computes completion,
// velocity, backlog health, and burndown metrics.
// Outputs a single JSON object to stdout for Claude to narrate.
// Progress messages go to stderr only -- stdout is JSON-only.

import { loadConfig, configExists } from './config.mjs';
import { adoGetProject, adoGetTeamIterations, adoGetIterationWorkItems, adoGetWorkItemsBatch } from './ado-client.mjs';

// ---------------------------------------------------------------------------
// Arg parsing (follows bugs.mjs pattern exactly)
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const eq = a.indexOf('='); return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), 'true']; })
);
const sprintsForVelocity = args.sprints ? parseInt(args.sprints, 10) : 3;
const checkConfig = args['check-config'] === 'true';
// --days accepted for summary.mjs passthrough compatibility (unused here)

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
// Constants
// ---------------------------------------------------------------------------
const DONE_STATES = ['Done', 'Closed', 'Completed', 'Resolved'];
const NOT_STARTED_STATES = ['New', 'To Do'];

const WORK_ITEM_FIELDS = [
  'System.Id', 'System.Title', 'System.State', 'System.WorkItemType',
  'System.AssignedTo', 'System.CreatedDate',
  'Microsoft.VSTS.Scheduling.StoryPoints',
  'Microsoft.VSTS.Scheduling.Effort',
  'Microsoft.VSTS.Scheduling.RemainingWork'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyState(state) {
  if (!state || NOT_STARTED_STATES.includes(state)) return 'notStarted';
  if (DONE_STATES.includes(state)) return 'done';
  return 'inProgress';
}

function getPoints(fields) {
  const sp = fields['Microsoft.VSTS.Scheduling.StoryPoints'];
  if (sp != null && sp !== '') return { value: Number(sp), source: 'storyPoints' };
  const effort = fields['Microsoft.VSTS.Scheduling.Effort'];
  if (effort != null && effort !== '') return { value: Number(effort), source: 'effort' };
  return { value: 1, source: 'itemCount' };
}

function burndownStatus(startDate, finishDate, completedPoints, totalPoints) {
  if (!startDate || !finishDate) return { status: 'unknown', elapsedPct: null, completedPct: null };
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(finishDate).getTime();
  const duration = end - start;
  if (duration <= 0) return { status: 'unknown', elapsedPct: null, completedPct: null };

  const elapsedPct = Math.round(Math.min(Math.max((now - start) / duration, 0), 1) * 100);
  const completedPct = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  const elapsedFrac = elapsedPct / 100;
  const completedFrac = completedPct / 100;

  let status;
  if (completedFrac >= elapsedFrac - 0.1) status = 'on-track';
  else if (completedFrac >= elapsedFrac - 0.25) status = 'at-risk';
  else status = 'behind';

  return { status, elapsedPct, completedPct };
}

async function fetchIterationItems(config, teamId, iterationId) {
  const relData = await adoGetIterationWorkItems(config, teamId, iterationId);
  const relations = relData.workItemRelations || [];
  const ids = [...new Set(relations.map(r => r.target?.id).filter(Boolean))];
  if (ids.length === 0) return [];
  const result = await adoGetWorkItemsBatch(config, ids, WORK_ITEM_FIELDS);
  return result.value || [];
}

function computeCompletion(workItems) {
  let done = 0, inProgress = 0, notStarted = 0;
  let donePoints = 0, totalPoints = 0;
  let useItemCount = false;
  let unestimated = 0, unassigned = 0;

  for (const wi of workItems) {
    const f = wi.fields;
    const category = classifyState(f['System.State']);
    const pts = getPoints(f);

    if (pts.source === 'itemCount') useItemCount = true;
    totalPoints += pts.value;

    if (category === 'done') { done++; donePoints += pts.value; }
    else if (category === 'inProgress') { inProgress++; }
    else { notStarted++; }

    const sp = f['Microsoft.VSTS.Scheduling.StoryPoints'];
    const effort = f['Microsoft.VSTS.Scheduling.Effort'];
    if ((sp == null || sp === '') && (effort == null || effort === '')) unestimated++;
    if (!f['System.AssignedTo']) unassigned++;
  }

  return { done, inProgress, notStarted, totalItems: workItems.length, donePoints, totalPoints, useItemCount, unestimated, unassigned };
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

  // Get project info for default team
  process.stderr.write('Fetching project info...\n');
  let projectInfo;
  try {
    projectInfo = await adoGetProject(config);
  } catch (e) {
    console.log(JSON.stringify({ error: { type: e.type || 'api', message: e.message } }));
    process.exit(1);
  }

  const teamId = projectInfo.defaultTeam?.id;
  if (!teamId) {
    console.log(JSON.stringify({ error: { type: 'no_team', message: 'No default team found for this project.' } }));
    process.exit(1);
  }

  // Fetch all iterations (no timeframe filter -- need all for velocity)
  process.stderr.write('Fetching iterations...\n');
  let iterationsData;
  try {
    iterationsData = await adoGetTeamIterations(config, teamId);
  } catch (e) {
    console.log(JSON.stringify({ error: { type: e.type || 'api', message: e.message } }));
    process.exit(1);
  }

  const iterations = iterationsData.value || [];
  if (iterations.length === 0) {
    console.log(JSON.stringify({ error: { type: 'no_sprints', message: 'No sprints configured for this project. /adi:sprint requires Azure DevOps iterations.' } }));
    process.exit(0);
  }

  // Classify iterations by timeFrame
  const currentIterations = iterations.filter(i => i.attributes?.timeFrame === 'current');
  const pastIterations = iterations.filter(i => i.attributes?.timeFrame === 'past');

  // ---------------------------------------------------------------------------
  // Current sprint processing
  // ---------------------------------------------------------------------------
  let sprintOutput = null;

  if (currentIterations.length > 0) {
    const current = currentIterations[0];
    const startDate = current.attributes?.startDate || null;
    const finishDate = current.attributes?.finishDate || null;

    process.stderr.write(`Processing current sprint: ${current.name}...\n`);
    let workItems;
    try {
      workItems = await fetchIterationItems(config, teamId, current.id);
    } catch (e) {
      console.log(JSON.stringify({ error: { type: e.type || 'api', message: e.message } }));
      process.exit(1);
    }

    const completion = computeCompletion(workItems);

    // Scope creep: items created after sprint start
    let scopeCreep = 0;
    if (startDate) {
      const sprintStart = new Date(startDate).getTime();
      for (const wi of workItems) {
        const created = new Date(wi.fields['System.CreatedDate']).getTime();
        if (created > sprintStart) scopeCreep++;
      }
    }

    const burndown = burndownStatus(startDate, finishDate, completion.donePoints, completion.totalPoints);

    sprintOutput = {
      name: current.name,
      startDate: startDate ? startDate.split('T')[0] : null,
      finishDate: finishDate ? finishDate.split('T')[0] : null,
      completion: {
        done: completion.done,
        inProgress: completion.inProgress,
        notStarted: completion.notStarted,
        totalItems: completion.totalItems,
        donePoints: completion.donePoints,
        totalPoints: completion.totalPoints,
        useItemCount: completion.useItemCount
      },
      backlogHealth: {
        unestimated: completion.unestimated,
        unassigned: completion.unassigned,
        scopeCreep
      },
      burndown
    };
  }

  // ---------------------------------------------------------------------------
  // Velocity tracking (past sprints)
  // ---------------------------------------------------------------------------
  process.stderr.write('Computing velocity trend...\n');
  const sortedPast = pastIterations
    .sort((a, b) => new Date(b.attributes?.finishDate || 0) - new Date(a.attributes?.finishDate || 0))
    .slice(0, sprintsForVelocity);

  const velocity = [];
  for (const iteration of sortedPast) {
    try {
      const items = await fetchIterationItems(config, teamId, iteration.id);
      let completedPoints = 0, totalPoints = 0;
      let useItemCount = false;
      for (const wi of items) {
        const pts = getPoints(wi.fields);
        if (pts.source === 'itemCount') useItemCount = true;
        totalPoints += pts.value;
        if (DONE_STATES.includes(wi.fields['System.State'])) {
          completedPoints += pts.value;
        }
      }
      velocity.push({
        name: iteration.name,
        completedPoints,
        totalPoints,
        itemCount: items.length,
        useItemCount
      });
    } catch (e) {
      process.stderr.write(`Warning: Could not fetch data for ${iteration.name}: ${e.message}\n`);
    }
  }

  // ---------------------------------------------------------------------------
  // Output JSON
  // ---------------------------------------------------------------------------
  const output = {
    sprint: sprintOutput,
    velocity,
    meta: {
      project: config.project,
      generatedAt: new Date().toISOString(),
      sprintsAnalyzed: velocity.length
    }
  };

  console.log(JSON.stringify(output));
}

main().catch(e => {
  console.log(JSON.stringify({ error: { type: 'unexpected', message: e.message } }));
  process.exit(1);
});
