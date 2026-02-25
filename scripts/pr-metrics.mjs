// scripts/pr-metrics.mjs
// Fetches PR data from Azure DevOps and computes all PR health metrics.
// Outputs a single JSON object to stdout for Claude to narrate.
// Progress messages go to stderr only — stdout is JSON-only.

import { loadConfig, configExists } from './config.mjs';
import { adoGetPrsByProject, adoGetPrsByRepo, adoGetPrThreads, adoGetRepos } from './ado-client.mjs';

// ---------------------------------------------------------------------------
// Arg parsing (follows setup.mjs pattern exactly)
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const eq = a.indexOf('='); return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), 'true']; })
);
const repoFilter = args.repo || null;
const daysOverride = args.days ? parseInt(args.days, 10) : null;
const staleDays = args['stale-days'] ? parseInt(args['stale-days'], 10) : 3;
const projectOverride = args.project || null;
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
// Computation functions
// ---------------------------------------------------------------------------

/**
 * Find the earliest non-author vote event (VoteUpdate thread) in a PR's threads.
 * Returns a Date or null.
 */
function findFirstReviewDate(threads, prCreatorId) {
  const voteThreads = (threads || []).filter(t => {
    const threadType = t.properties?.CodeReviewThreadType?.$value;
    if (threadType !== 'VoteUpdate') return false;
    const voterId = t.comments?.[0]?.author?.id;
    return voterId && voterId !== prCreatorId;
  });
  if (voteThreads.length === 0) return null;
  const earliest = voteThreads.reduce((min, t) =>
    t.publishedDate < min.publishedDate ? t : min
  );
  return new Date(earliest.publishedDate);
}

/**
 * Get the most recent activity date for a PR using thread lastUpdatedDate values.
 * Falls back to creationDate if no threads.
 */
function getLastActivityDate(pr, threads) {
  const threadDates = (threads || [])
    .map(t => new Date(t.lastUpdatedDate))
    .filter(d => !isNaN(d.getTime()));
  if (threadDates.length === 0) return new Date(pr.creationDate);
  return new Date(Math.max(...threadDates.map(d => d.getTime())));
}

/**
 * Determine if an active PR is stale given the stale days threshold.
 */
function isStale(pr, threads, staleDaysThreshold) {
  if (pr.status !== 'active') return false;
  const lastActivity = getLastActivityDate(pr, threads);
  return (Date.now() - lastActivity.getTime()) / 86400000 > staleDaysThreshold;
}

/**
 * Compute mean of an array of numbers. Returns null for empty array.
 */
function mean(arr) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Compute median of an array of numbers. Returns null for empty array.
 */
function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// PR fetch with fallback strategy
// ---------------------------------------------------------------------------

async function fetchPagedPrs(config, fetchFn, params, maxPages = 10) {
  const allPrs = [];
  let skip = 0;
  const top = 1000;
  let capHit = false;

  for (let page = 0; page < maxPages; page++) {
    const data = await fetchFn(config, { ...params, '$top': top, '$skip': skip });
    allPrs.push(...(data.value || []));
    if ((data.value || []).length < top) break;
    skip += top;
    if (page === maxPages - 1) { capHit = true; break; }
  }

  return { prs: allPrs, capHit };
}

async function fetchPrsWithFallback(config, repoId) {
  const windows = daysOverride ? [daysOverride] : [null, 365, 90];

  for (const window of windows) {
    const baseParams = {
      'searchCriteria.status': 'all',
      'searchCriteria.queryTimeRangeType': 'created',
    };
    if (window !== null) {
      baseParams['searchCriteria.minTime'] = new Date(Date.now() - window * 86400000).toISOString();
    }

    let result;
    if (repoId) {
      const fetchFn = async (cfg, params) => adoGetPrsByRepo(cfg, repoId, params);
      result = await fetchPagedPrs(config, fetchFn, baseParams);
    } else {
      result = await fetchPagedPrs(config, adoGetPrsByProject, baseParams);
    }

    const { prs, capHit } = result;

    // If no explicit days override and got >= 500 PRs: try shorter window
    if (!daysOverride && prs.length >= 500 && window !== 90) {
      continue;
    }

    return { prs, daysCovered: window, capHit };
  }

  // Should not reach here — 90-day window is always last
  return { prs: [], daysCovered: 90, capHit: false };
}

// ---------------------------------------------------------------------------
// Thread fetching (batched, with 429 retry)
// ---------------------------------------------------------------------------

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchThreadsBatch(config, batch) {
  const results = await Promise.allSettled(
    batch.map(pr => adoGetPrThreads(config, pr.repository.id, pr.pullRequestId))
  );
  return results.map((r, i) => ({
    prId: batch[i].pullRequestId,
    threads: r.status === 'fulfilled' ? (r.value.value || []) : []
  }));
}

async function fetchAllThreads(config, prs) {
  const threadMap = new Map();
  const batchSize = 10;

  for (let i = 0; i < prs.length; i += batchSize) {
    const batch = prs.slice(i, i + batchSize);
    let batchResults;

    // Check for 429 by inspecting a quick pre-fetch (we use allSettled so 429 surfaces as fulfilled with empty)
    // We do a single retry for the batch if any individual returned empty due to potential rate limiting
    batchResults = await fetchThreadsBatch(config, batch);

    // Simple 429 heuristic: if all returned empty and batch size > 1, retry once after 2s
    const allEmpty = batchResults.every(r => r.threads.length === 0);
    if (allEmpty && batch.length > 1) {
      await sleep(2000);
      batchResults = await fetchThreadsBatch(config, batch);
    }

    for (const r of batchResults) {
      threadMap.set(r.prId, r.threads);
    }
  }

  return threadMap;
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

  if (projectOverride) config.project = projectOverride;

  const errors = [];
  let repoId = null;

  // Resolve --repo filter to ID
  if (repoFilter) {
    process.stderr.write('Resolving repository name...\n');
    let repos;
    try {
      const reposData = await adoGetRepos(config);
      repos = reposData.value || [];
    } catch (e) {
      console.log(JSON.stringify({ error: { type: 'api', message: e.message } }));
      process.exit(1);
    }
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
    repoId = match.id;
  }

  // Fetch PRs
  process.stderr.write('Fetching PRs...\n');
  let prs, daysCovered, capHit;
  try {
    ({ prs, daysCovered, capHit } = await fetchPrsWithFallback(config, repoId));
  } catch (e) {
    console.log(JSON.stringify({ error: { type: 'api', message: e.message } }));
    process.exit(1);
  }

  process.stderr.write(`Fetched ${prs.length} PRs.\n`);

  // Compute summary
  const activePrs = prs.filter(pr => pr.status === 'active');
  const completedPrs = prs.filter(pr => pr.status === 'completed');

  // Unique repos in result
  const repoNamesSet = new Set(prs.map(pr => pr.repository?.name).filter(Boolean));
  const repoNames = [...repoNamesSet];

  // Fetch threads for PRs that need them:
  // - Active PRs: needed for staleness + time-to-first-review on pending PRs
  // - Completed PRs: needed for time-to-first-review
  process.stderr.write('Fetching PR threads...\n');
  const prsNeedingThreads = prs; // All PRs need threads for time-to-first-review
  const threadMap = await fetchAllThreads(config, prsNeedingThreads);

  // ---------------------------------------------------------------------------
  // Cycle time (PR-02): completed PRs only, must have closedDate
  // ---------------------------------------------------------------------------
  const cycleTimeHoursArr = completedPrs
    .filter(pr => pr.closedDate)
    .map(pr => (new Date(pr.closedDate) - new Date(pr.creationDate)) / 3600000)
    .filter(h => h >= 0);

  const cycleTimes = {
    meanHours: mean(cycleTimeHoursArr),
    medianHours: median(cycleTimeHoursArr),
    unit: 'hours',
    prCount: cycleTimeHoursArr.length
  };

  // ---------------------------------------------------------------------------
  // Time to first review (PR-01): from VoteUpdate threads
  // ---------------------------------------------------------------------------
  const healthyThresholdHours = 4;
  const firstReviewTimesArr = [];
  let missingCount = 0;

  for (const pr of prs) {
    const threads = threadMap.get(pr.pullRequestId) || [];
    const firstReview = findFirstReviewDate(threads, pr.createdBy?.id);
    if (firstReview) {
      const hours = (firstReview - new Date(pr.creationDate)) / 3600000;
      if (hours >= 0) firstReviewTimesArr.push(hours);
    } else {
      missingCount++;
    }
  }

  const aboveThresholdCount = firstReviewTimesArr.filter(h => h > healthyThresholdHours).length;

  const timeToFirstReview = {
    meanHours: mean(firstReviewTimesArr),
    medianHours: median(firstReviewTimesArr),
    unit: 'hours',
    prCount: firstReviewTimesArr.length,
    missingCount,
    aboveThresholdCount,
    healthyThresholdHours
  };

  // ---------------------------------------------------------------------------
  // Reviewer distribution (PR-03)
  // ---------------------------------------------------------------------------
  // Per-reviewer stats: reviewCount, per-PR first-review times
  const reviewerStats = {};

  // Build a per-reviewer first-review time map using thread data
  // Key: `${prId}:${reviewerId}` -> hours (or null)
  const reviewerPrTimesMap = new Map();

  for (const pr of prs) {
    const threads = threadMap.get(pr.pullRequestId) || [];
    const prCreatorId = pr.createdBy?.id;

    for (const reviewer of (pr.reviewers || [])) {
      // Skip self-review
      if (reviewer.id === prCreatorId) continue;
      // Skip zero-vote (added but not acted)
      if (reviewer.vote === 0) continue;
      // Skip team/container reviewers
      if (reviewer.isContainer === true) continue;

      if (!reviewerStats[reviewer.id]) {
        reviewerStats[reviewer.id] = {
          name: reviewer.displayName,
          reviewCount: 0,
          firstReviewTimes: []
        };
      }
      reviewerStats[reviewer.id].reviewCount++;

      // Find the earliest VoteUpdate thread for THIS specific reviewer
      const reviewerVoteThreads = threads.filter(t => {
        const threadType = t.properties?.CodeReviewThreadType?.$value;
        const voterId = t.comments?.[0]?.author?.id;
        return threadType === 'VoteUpdate' && voterId === reviewer.id;
      });

      if (reviewerVoteThreads.length > 0) {
        const earliest = reviewerVoteThreads.reduce((min, t) =>
          t.publishedDate < min.publishedDate ? t : min
        );
        const reviewTime = (new Date(earliest.publishedDate) - new Date(pr.creationDate)) / 3600000;
        if (reviewTime >= 0) {
          reviewerStats[reviewer.id].firstReviewTimes.push(reviewTime);
        }
      }
    }
  }

  const reviewerDistribution = Object.values(reviewerStats).map(r => ({
    name: r.name,
    reviewCount: r.reviewCount,
    avgTimeToReviewHours: r.firstReviewTimes.length > 0
      ? r.firstReviewTimes.reduce((a, b) => a + b, 0) / r.firstReviewTimes.length
      : null
  })).sort((a, b) => b.reviewCount - a.reviewCount);

  // ---------------------------------------------------------------------------
  // Absent reviewers (PR-03): PR creators who never voted on anyone else's PR
  // ---------------------------------------------------------------------------
  const prCreatorIds = new Set(prs.map(pr => pr.createdBy?.id).filter(Boolean));
  const prCreatorNames = {};
  for (const pr of prs) {
    if (pr.createdBy?.id) prCreatorNames[pr.createdBy.id] = pr.createdBy.displayName;
  }

  // Active reviewer IDs: those who voted non-zero on at least one PR (excluding self)
  const activeReviewerIds = new Set(Object.keys(reviewerStats));

  const absentReviewers = [...prCreatorIds]
    .filter(id => !activeReviewerIds.has(id))
    .map(id => prCreatorNames[id])
    .filter(Boolean);

  // ---------------------------------------------------------------------------
  // Stale PRs (PR-04): active PRs with no activity for > staleDays
  // ---------------------------------------------------------------------------
  const stalePrs = activePrs
    .filter(pr => {
      const threads = threadMap.get(pr.pullRequestId) || [];
      return isStale(pr, threads, staleDays);
    })
    .map(pr => {
      const threads = threadMap.get(pr.pullRequestId) || [];
      const lastActivity = getLastActivityDate(pr, threads);
      const daysStale = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
      return {
        title: pr.title,
        repo: pr.repository?.name || 'unknown',
        daysStale,
        createdBy: pr.createdBy?.displayName || 'unknown',
        url: pr.url || ''
      };
    })
    .sort((a, b) => b.daysStale - a.daysStale);

  // ---------------------------------------------------------------------------
  // Bottleneck (PR-05): reviewer with highest avg time-to-first-review (min 3 reviews)
  // ---------------------------------------------------------------------------
  const totalNonZeroVotes = reviewerDistribution.reduce((sum, r) => sum + r.reviewCount, 0);

  let bottleneck = null;
  const candidates = reviewerDistribution.filter(r => r.reviewCount >= 3);

  if (candidates.length > 0) {
    // Find slowest reviewer
    const withTime = candidates.filter(r => r.avgTimeToReviewHours !== null);
    const slowest = withTime.length > 0
      ? withTime.reduce((max, r) => r.avgTimeToReviewHours > max.avgTimeToReviewHours ? r : max)
      : null;

    // Find most concentrated reviewer
    const concentrated = totalNonZeroVotes > 0
      ? candidates.reduce((max, r) => r.reviewCount > max.reviewCount ? r : max)
      : null;

    const concentrationShare = concentrated && totalNonZeroVotes > 0
      ? concentrated.reviewCount / totalNonZeroVotes
      : 0;
    const isConcentrated = concentrationShare > 0.5;

    if (slowest || isConcentrated) {
      const isBoth = slowest && isConcentrated && slowest.name === concentrated.name;
      const isSlow = slowest && (!isConcentrated || !isBoth);
      const isConc = isConcentrated && (!slowest || !isBoth);

      let candidate;
      let type;

      if (isBoth) {
        candidate = slowest;
        type = 'both';
      } else if (isSlow && isConc) {
        // Different people — pick most severe (slowest)
        candidate = slowest;
        type = 'slow';
      } else if (isSlow) {
        candidate = slowest;
        type = 'slow';
      } else {
        candidate = concentrated;
        type = 'concentrated';
      }

      if (candidate) {
        bottleneck = {
          name: candidate.name,
          avgTimeToReviewHours: candidate.avgTimeToReviewHours,
          reviewShare: totalNonZeroVotes > 0 ? candidate.reviewCount / totalNonZeroVotes : 0,
          type
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------
  const result = {
    summary: {
      totalPrs: prs.length,
      activePrs: activePrs.length,
      completedPrs: completedPrs.length,
      reposAnalyzed: repoNames.length,
      repoNames,
      daysCovered,
      fetchedAt: new Date().toISOString(),
      capHit: capHit || false
    },
    cycleTimes,
    timeToFirstReview,
    reviewerDistribution,
    absentReviewers,
    stalePrs,
    bottleneck,
    thresholds: {
      staleThresholdDays: staleDays,
      healthyReviewHours: healthyThresholdHours
    },
    errors
  };

  console.log(JSON.stringify(result));
}

main().catch(e => {
  console.log(JSON.stringify({ error: { type: 'unexpected', message: e.message } }));
  process.exit(1);
});
