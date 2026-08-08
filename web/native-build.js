import { compileToDirectWasm } from '../src/wasm-direct.js';

const REPOSITORY = 'pinkysworld/Patch';
const WORKFLOW = 'native-apps.yml';
const API = 'https://api.github.com';
const code = document.querySelector('#code');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const buildTarget = document.querySelector('#buildTarget');
const buildButton = document.querySelector('#build');
const panel = document.querySelector('#nativeBuildPanel');
const tokenInput = document.querySelector('#nativeBuildToken');
const status = document.querySelector('#nativeBuildStatus');
const output = document.querySelector('#output');

const nativeTargets = new Map([
  ['native-windows', 'windows'],
  ['native-macos', 'macos'],
  ['native-linux', 'linux']
]);

buildTarget.addEventListener('change', refreshNativePanel);
refreshNativePanel();

// Capture native targets before the ordinary browser-local build handler.
buildButton.addEventListener('click', async event => {
  const platform = nativeTargets.get(buildTarget.value);
  if (!platform) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showOutput();

  const name = safeName(projectName.value);
  try {
    if (projectKind.value !== 'console') {
      throw new Error('Native desktop builds currently support the direct numeric console subset. Build this Window project as a portable app for now; native Window/Designer hosts are the next milestone.');
    }

    // Fail immediately in the browser when the current source is outside the direct backend subset.
    const preflight = compileToDirectWasm(code.value, { name, kind: 'console', entry: 'main.patch' });
    const token = tokenInput.value.trim();
    if (!token) {
      throw new Error('Paste a fine-grained GitHub token in the Native build bar. It needs Actions read/write access to pinkysworld/Patch. The token is kept only in this page and is never saved to localStorage.');
    }

    const sourceBase64 = utf8Base64(code.value);
    if (sourceBase64.length > 60000) {
      throw new Error('This Studio source is too large for the current GitHub Actions dispatch channel. Use the Patch CLI/native workflow with a repository source file for larger projects.');
    }

    const requestId = makeRequestId();
    setBusy(true, `Starting ${platformLabel(platform)} build…`);
    output.textContent = `Native ${platformLabel(platform)} build\n\nPreflight passed: direct Wasm ${preflight.metadata.version}.\nSubmitting the current editor source to Patch Native Apps…`;

    await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}/dispatches`, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          source_b64: sourceBase64,
          source_path: '',
          app_name: name,
          platform,
          request_id: requestId
        }
      })
    });

    const run = await waitForRun(token, requestId, platform);
    if (run.conclusion !== 'success') {
      throw new Error(`GitHub native build finished with '${run.conclusion}'. Open ${run.html_url} for the build log.`);
    }

    status.textContent = 'Build complete. Preparing download…';
    const artifacts = await apiJson(`${API}/repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`, token);
    const expectedName = `patch-${platform}-${requestId}`;
    const artifact = (artifacts.artifacts ?? []).find(item => item.name === expectedName && !item.expired);
    if (!artifact) throw new Error(`The native build succeeded but artifact '${expectedName}' was not found. Open ${run.html_url}.`);

    await downloadArtifact(artifact, token, `${name}-${platform}-build.zip`);
    output.textContent = `Built ${name} for ${platformLabel(platform)} ✓\n\nThe downloaded GitHub Actions artifact contains the platform package produced from the code currently in Patch Studio.\n\nWindows: .exe package\nmacOS: .app package\nLinux: native executable package\n\nBuild run: ${run.html_url}`;
    status.textContent = `${platformLabel(platform)} build downloaded`;
  } catch (error) {
    output.textContent = `Native build stopped:\n${error?.message ?? String(error)}`;
    status.textContent = 'Native build stopped';
  } finally {
    setBusy(false);
  }
}, true);

function refreshNativePanel() {
  const platform = nativeTargets.get(buildTarget.value);
  panel.hidden = !platform;
  if (platform && !buildButton.disabled) {
    status.textContent = `${platformLabel(platform)} build via GitHub Actions. Token is not saved.`;
  }
}

async function waitForRun(token, requestId, platform) {
  const title = `Native Patch ${requestId}`;
  let seen = null;
  for (let attempt = 0; attempt < 360; attempt += 1) {
    const data = await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=30`, token);
    const run = (data.workflow_runs ?? []).find(item => item.display_title === title);
    if (run) {
      seen = run;
      const state = run.status === 'completed' ? run.conclusion : run.status;
      status.textContent = `${platformLabel(platform)} build: ${state}…`;
      output.textContent = `Native ${platformLabel(platform)} build\n\nGitHub Actions run: ${state}\n${run.html_url}\n\nPatch Studio will download the artifact automatically when the build succeeds.`;
      if (run.status === 'completed') return run;
    } else if (attempt > 3) {
      status.textContent = `${platformLabel(platform)} build queued…`;
    }
    await sleep(5000);
  }
  throw new Error(seen ? `Native build did not finish in time. Open ${seen.html_url}.` : 'Patch Studio could not find the dispatched native build run.');
}

async function apiJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {})
    }
  });
  if (response.status === 204) return null;
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).message ?? ''; } catch { detail = await response.text(); }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`GitHub rejected the build token (${response.status}). Use a fine-grained token for pinkysworld/Patch with Actions read/write permission.${detail ? ` ${detail}` : ''}`);
    }
    throw new Error(`GitHub API ${response.status}: ${detail || response.statusText}`);
  }
  return response.json();
}

async function downloadArtifact(artifact, token, filename) {
  const response = await fetch(artifact.archive_download_url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!response.ok) throw new Error(`Could not download native build artifact (${response.status}).`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function showOutput() {
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.tab === 'output');
  document.querySelector('#designer').hidden = true;
  document.querySelector('#app').hidden = true;
  document.querySelector('#changes').hidden = true;
  document.querySelector('#ir').hidden = true;
  output.hidden = false;
}

function setBusy(busy, message = null) {
  buildButton.disabled = busy;
  if (message) status.textContent = message;
  if (!busy) refreshNativePanel();
}

function utf8Base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
  }
  return btoa(binary);
}

function makeRequestId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function safeName(name) { return (name || 'PatchApp').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'PatchApp'; }
function platformLabel(platform) { return platform === 'macos' ? 'macOS' : platform === 'windows' ? 'Windows' : 'Linux'; }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
