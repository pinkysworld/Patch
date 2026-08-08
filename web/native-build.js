import { compile } from '../src/compiler.js';
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
projectKind.addEventListener('change', refreshNativePanel);
refreshNativePanel();

// Capture native targets before the ordinary browser-local build handler.
buildButton.addEventListener('click', async event => {
  const platform = nativeTargets.get(buildTarget.value);
  if (!platform) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showOutput();

  const name = safeName(projectName.value);
  const kind = projectKind.value === 'window' ? 'window' : 'console';
  try {
    let preflightText;
    if (kind === 'console') {
      const preflight = compileToDirectWasm(code.value, { name, kind: 'console', entry: 'main.patch' });
      preflightText = `direct Wasm ${preflight.metadata.version}`;
    } else {
      const preflight = compile(code.value, { name, kind: 'window', entry: 'main.patch' });
      const windowCount = countWindowInstructions(preflight.ir.instructions);
      if (!windowCount) throw new Error('This project is marked Window but does not define a Patch window. Add a window in Designer or change Project Type to Console.');
      preflightText = `${windowCount} Patch window${windowCount === 1 ? '' : 's'} validated`;
    }

    const token = tokenInput.value.trim();
    if (!token) {
      throw new Error('Paste a fine-grained GitHub token in the Native build bar. It needs Actions read/write access to pinkysworld/Patch. The token is kept only in this page and is never saved to localStorage.');
    }

    const sourceBase64 = utf8Base64(code.value);
    if (sourceBase64.length > 60000) {
      throw new Error('This Studio source is too large for the current GitHub Actions dispatch channel. Use the Patch CLI/native workflow with a repository source file for larger projects.');
    }

    const requestId = makeRequestId();
    const kindLabel = kind === 'window' ? 'Window / GUI' : 'Console';
    setBusy(true, `Starting ${platformLabel(platform)} ${kindLabel} build…`);
    output.textContent = `Native ${platformLabel(platform)} ${kindLabel} build\n\nPreflight passed: ${preflightText}.\nSubmitting the current editor source to Patch Native Apps…`;

    await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}/dispatches`, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          source_b64: sourceBase64,
          source_path: '',
          app_name: name,
          platform,
          kind,
          request_id: requestId
        }
      })
    });

    const run = await waitForRun(token, requestId, platform, kindLabel);
    if (run.conclusion !== 'success') {
      throw new Error(`GitHub native build finished with '${run.conclusion}'. Open ${run.html_url} for the build log.`);
    }

    status.textContent = 'Build complete. Preparing download…';
    const artifacts = await apiJson(`${API}/repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`, token);
    const expectedName = `patch-${platform}-${requestId}`;
    const artifact = (artifacts.artifacts ?? []).find(item => item.name === expectedName && !item.expired);
    if (!artifact) throw new Error(`The native build succeeded but artifact '${expectedName}' was not found. Open ${run.html_url}.`);

    await downloadArtifact(artifact, token, `${name}-${platform}-${kind}-build.zip`);
    output.textContent = `Built ${name} for ${platformLabel(platform)} ✓\n\nType: ${kindLabel}\nThe downloaded GitHub Actions artifact contains the platform package produced from the code currently in Patch Studio.\n\n${artifactDescription(platform, kind)}\n\nBuild run: ${run.html_url}`;
    status.textContent = `${platformLabel(platform)} ${kindLabel} build downloaded`;
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
    const kindLabel = projectKind.value === 'window' ? 'Window / GUI' : 'Console';
    status.textContent = `${platformLabel(platform)} ${kindLabel} build via GitHub Actions. Token is not saved.`;
  }
}

async function waitForRun(token, requestId, platform, kindLabel) {
  const title = `Native Patch ${requestId}`;
  let seen = null;
  for (let attempt = 0; attempt < 360; attempt += 1) {
    const data = await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=30`, token);
    const run = (data.workflow_runs ?? []).find(item => item.display_title === title);
    if (run) {
      seen = run;
      const state = run.status === 'completed' ? run.conclusion : run.status;
      status.textContent = `${platformLabel(platform)} ${kindLabel} build: ${state}…`;
      output.textContent = `Native ${platformLabel(platform)} ${kindLabel} build\n\nGitHub Actions run: ${state}\n${run.html_url}\n\nPatch Studio will download the artifact automatically when the build succeeds.`;
      if (run.status === 'completed') return run;
    } else if (attempt > 3) {
      status.textContent = `${platformLabel(platform)} ${kindLabel} build queued…`;
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

function countWindowInstructions(instructions) {
  let count = 0;
  const visit = list => {
    for (const instruction of list ?? []) {
      if (instruction.op === 'window') count += 1;
      if (instruction.body) visit(instruction.body);
      if (instruction.then) visit(instruction.then);
      if (instruction.else) visit(instruction.else);
    }
  };
  visit(instructions);
  return count;
}

function artifactDescription(platform, kind) {
  if (kind === 'window') {
    if (platform === 'macos') return 'macOS: standalone .app GUI package';
    if (platform === 'windows') return 'Windows: standalone GUI application folder with .exe';
    return 'Linux: standalone GUI application folder';
  }
  if (platform === 'macos') return 'macOS: native .app containing the direct Patch Wasm host';
  if (platform === 'windows') return 'Windows: native .exe';
  return 'Linux: native executable';
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
