// scripts/ado-client.mjs
import { loadConfig } from './config.mjs';

const API_VERSION = '7.1';

export function buildAuthHeader(pat) {
  // CRITICAL: colon prefix required for Azure DevOps Basic auth
  // Buffer.from(':' + pat.trim()) — empty username + colon + PAT
  return 'Basic ' + Buffer.from(':' + pat.trim()).toString('base64');
}

export async function adoGet(path, params = {}, configOverride = null) {
  const config = configOverride || loadConfig();
  const base = config.orgUrl.replace(/\/$/, '');
  const url = new URL(`${base}/${config.project}/_apis/${path}`);
  url.searchParams.set('api-version', API_VERSION);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'Authorization': buildAuthHeader(config.pat),
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    throw Object.assign(new Error('Network error: cannot reach ' + config.orgUrl + '. Check the org URL.'), { type: 'network' });
  }

  if (response.status === 401 || response.status === 203) {
    // 203: Azure DevOps redirects to login page on wrong PAT encoding — treat as auth error
    throw Object.assign(new Error('PAT rejected. The token may be expired, invalid, or wrongly encoded.'), { type: 'auth' });
  }
  if (response.status === 403) {
    throw Object.assign(new Error('PAT lacks required permissions (HTTP 403). Check required scopes in /adi:setup.'), { type: 'permission' });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Azure DevOps API error: ${response.status} ${response.statusText}`), { type: 'api' });
  }
  return response.json();
}

export async function validateConnection(orgUrl, project, pat) {
  const orgBase = orgUrl.replace(/\/$/, '');
  const headers = { 'Authorization': buildAuthHeader(pat), 'Content-Type': 'application/json' };

  // Step 1: Test org URL reachability + PAT validity (project-agnostic endpoint)
  const projectsUrl = new URL(`${orgBase}/_apis/projects`);
  projectsUrl.searchParams.set('api-version', API_VERSION);
  projectsUrl.searchParams.set('$top', '1');

  let projectsResp;
  try {
    projectsResp = await fetch(projectsUrl.toString(), { headers });
  } catch (err) {
    return { ok: false, type: 'network', message: 'Cannot reach ' + orgUrl + '. Check the org URL and your internet connection.' };
  }

  if (projectsResp.status === 401 || projectsResp.status === 203) {
    return { ok: false, type: 'auth', message: 'PAT rejected. The token may be expired or invalid. Generate a new PAT at: https://dev.azure.com/' + orgUrl.replace(/^https?:\/\/[^/]+\//, '') + '/_usersSettings/tokens' };
  }
  if (projectsResp.status === 403) {
    return { ok: false, type: 'permission', missingScope: 'Project and Team (Read)', message: 'PAT missing "Project and Team (Read)" permission.' };
  }
  if (!projectsResp.ok) {
    return { ok: false, type: 'api', message: `Unexpected response: ${projectsResp.status} ${projectsResp.statusText}` };
  }

  // Step 2: Test project access + Code (Read) scope
  const reposUrl = new URL(`${orgBase}/${project}/_apis/git/repositories`);
  reposUrl.searchParams.set('api-version', API_VERSION);

  let reposResp;
  try {
    reposResp = await fetch(reposUrl.toString(), { headers });
  } catch (err) {
    return { ok: false, type: 'network', message: 'Connected to org but cannot reach project. Check the project name.' };
  }

  if (reposResp.status === 403) {
    return { ok: false, type: 'permission', missingScope: 'Code (Read)', message: 'PAT missing "Code (Read)" permission. Add this scope at: https://dev.azure.com/' + orgUrl.replace(/^https?:\/\/[^/]+\//, '') + '/_usersSettings/tokens' };
  }
  if (reposResp.status === 404) {
    return { ok: false, type: 'not_found', message: 'Project "' + project + '" not found in this org. Check the project name.' };
  }
  if (!reposResp.ok) {
    return { ok: false, type: 'api', message: `Project access check failed: ${reposResp.status} ${reposResp.statusText}` };
  }

  return { ok: true };
}
