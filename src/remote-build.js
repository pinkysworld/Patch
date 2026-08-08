export const PATCH_REMOTE_BUILD_VERSION = '0.1';
export const PATCH_REMOTE_BUILD_REPOSITORY = 'pinkysworld/Patch';
export const PATCH_REMOTE_BUILD_WORKFLOW = 'native-apps.yml';
export const PATCH_REMOTE_SOURCE_LIMIT = 45_000;

const TARGETS = new Set(['all', 'windows', 'macos', 'linux']);
const KINDS = new Set(['console', 'window']);

export function createRemoteBuildRequest({ source, name = 'PatchApp', kind = 'console', target = 'all', requestId } = {}) {
  if (!TARGETS.has(target)) throw new Error(`Remote target '${target}' is not supported.`);
  if (!KINDS.has(kind)) throw new Error(`Remote app kind '${kind}' is not supported.`);
  const sourceBytes = new TextEncoder().encode(String(source ?? ''));
  if (!sourceBytes.length) throw new Error('Patch source is empty.');
  if (sourceBytes.length > PATCH_REMOTE_SOURCE_LIMIT) {
    throw new Error(`Studio cloud builds currently accept Patch source up to ${PATCH_REMOTE_SOURCE_LIMIT} UTF-8 bytes.`);
  }
  return {
    requestId: requestId ?? makeRequestId(),
    inputs: {
      source_path: '',
      source_b64: bytesToBase64(sourceBytes),
      app_name: safeName(name),
      target,
      kind,
      request_id: requestId ?? makeRequestId()
    }
  };
}

export async function dispatchRemoteBuild({ token, request, repository = PATCH_REMOTE_BUILD_REPOSITORY, ref = 'main', fetchImpl = fetch } = {}) {
  requireToken(token);
  if (!request?.inputs) throw new Error('Remote build request is missing.');
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/actions/workflows/${PATCH_REMOTE_BUILD_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({ ref, inputs: request.inputs })
  });
  if (!response.ok) throw new Error(await githubError(response, 'GitHub rejected the remote build request'));
  return request;
}

export async function waitForRemoteBuild({ token, requestId, repository = PATCH_REMOTE_BUILD_REPOSITORY, fetchImpl = fetch, timeoutMs = 20 * 60_000, pollMs = 4_000, onStatus = () => {} } = {}) {
  requireToken(token);
  const started = Date.now();
  let run = null;
  while (Date.now() - started < timeoutMs) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/actions/workflows/${PATCH_REMOTE_BUILD_WORKFLOW}/runs?event=workflow_dispatch&branch=main&per_page=30`, {
      headers: githubHeaders(token)
    });
    if (!response.ok) throw new Error(await githubError(response, 'Could not read GitHub build status'));
    const payload = await response.json();
    run = payload.workflow_runs?.find(candidate => String(candidate.display_title ?? candidate.name ?? '').includes(requestId)) ?? null;
    if (!run) {
      onStatus({ phase: 'queued', message: 'Waiting for GitHub Actions to create the build…' });
      await sleep(pollMs);
      continue;
    }
    onStatus({ phase: run.status, conclusion: run.conclusion, run, message: formatRunStatus(run) });
    if (run.status === 'completed') return run;
    await sleep(pollMs);
  }
  throw new Error('Timed out while waiting for the remote build. The build may still be running on GitHub.');
}

export async function listRemoteBuildArtifacts({ token, runId, repository = PATCH_REMOTE_BUILD_REPOSITORY, fetchImpl = fetch } = {}) {
  requireToken(token);
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/actions/runs/${runId}/artifacts?per_page=30`, {
    headers: githubHeaders(token)
  });
  if (!response.ok) throw new Error(await githubError(response, 'Could not list build artifacts'));
  const payload = await response.json();
  return (payload.artifacts ?? []).filter(artifact => !artifact.expired);
}

export async function fetchRemoteBuildArtifact({ token, artifactId, repository = PATCH_REMOTE_BUILD_REPOSITORY, fetchImpl = fetch } = {}) {
  requireToken(token);
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/actions/artifacts/${artifactId}/zip`, {
    headers: githubHeaders(token),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(await githubError(response, 'Could not download the build artifact'));
  return response.blob();
}

export function makeRequestId() {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `patch-${Date.now().toString(36)}-${random.slice(0, 12)}`;
}

function formatRunStatus(run) {
  if (run.status === 'completed') return run.conclusion === 'success' ? 'Build completed.' : `Build finished with ${run.conclusion ?? 'an error'}.`;
  if (run.status === 'in_progress') return 'Building on GitHub Actions…';
  return 'Build queued on GitHub Actions…';
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

async function githubError(response, prefix) {
  let detail = '';
  try {
    const payload = await response.json();
    detail = payload.message ? `: ${payload.message}` : '';
  } catch {}
  return `${prefix} (${response.status})${detail}`;
}

function requireToken(token) {
  if (!String(token ?? '').trim()) throw new Error('A GitHub token is required for Studio cloud builds.');
}

function safeName(name) {
  const cleaned = String(name ?? 'PatchApp').trim().replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').slice(0, 80);
  return cleaned || 'PatchApp';
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
