import { compile } from '../src/compiler.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { compileToC99 } from '../src/c99.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildLocalNativeKit } from '../src/local-native-kit.js';
import { buildPrebuiltNativePackage, prebuiltNativeTemplateUrl } from '../src/prebuilt-native.js';

const REPOSITORY = 'pinkysworld/Patch';
const NATIVE_WORKFLOW = 'native-apps.yml';
const FREEBSD_WORKFLOW = 'freebsd-c99.yml';
const API = 'https://api.github.com';
const code = document.querySelector('#code');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const buildTarget = document.querySelector('#buildTarget');
const buildButton = document.querySelector('#build');
const panel = document.querySelector('#nativeBuildPanel');
const tokenInput = document.querySelector('#nativeBuildToken');
const tokenLabel = tokenInput.closest('label');
const status = document.querySelector('#nativeBuildStatus');
const output = document.querySelector('#output');
const nativeBuildMode = installNativeModeControls();

const nativeTargets = new Map([
  ['native-windows', 'windows'],
  ['native-macos', 'macos'],
  ['native-linux', 'linux'],
  ['native-freebsd', 'freebsd']
]);

buildTarget.addEventListener('change', refreshNativePanel);
projectKind.addEventListener('change', refreshNativePanel);
nativeBuildMode.addEventListener('change', refreshNativePanel);
refreshNativePanel();

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
    let directWasm = null;
    if (platform === 'freebsd') {
      if (kind !== 'console') throw new Error('FreeBSD currently supports Console projects only.');
      const preflight = compileToC99(code.value, { name, kind: 'console', entry: 'main.patch' });
      preflightText = `portable C99 ${preflight.metadata.version}`;
    } else if (kind === 'console') {
      directWasm = compileToDirectWasm(code.value, { name, kind: 'console', entry: 'main.patch' });
      preflightText = `direct Wasm ${directWasm.metadata.version}`;
    } else {
      const preflight = compile(code.value, { name, kind: 'window', entry: 'main.patch' });
      const support = validateWindowRuntimeSupport(preflight);
      preflightText = `${support.windows} Patch window${support.windows === 1 ? '' : 's'}, ${support.controls} interactive control${support.controls === 1 ? '' : 's'} and ${support.events} event handler${support.events === 1 ? '' : 's'} validated`;
    }

    const kindLabel = kind === 'window' ? 'Window / GUI' : 'Console';

    if (nativeBuildMode.value === 'prebuilt') {
      if (platform === 'freebsd') {
        throw new Error('Ready-app downloads are currently available for Windows, macOS and Linux. For FreeBSD, choose the local or cloud build mode.');
      }
      setBusy(true, `Building ready ${platformLabel(platform)} ${kindLabel} app…`);
      output.textContent = `${platformLabel(platform)} ${kindLabel} ready-app build\n\nPreflight passed: ${preflightText}.\nLoading the prebuilt Patch runtime…`;
      const templateUrl = prebuiltNativeTemplateUrl(platform, kind);
      const response = await fetch(templateUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`The prebuilt ${platformLabel(platform)} runtime is not available yet (${response.status}).`);
      status.textContent = `Packaging ${platformLabel(platform)} app in this browser…`;
      const ready = buildPrebuiltNativePackage(new Uint8Array(await response.arrayBuffer()), {
        platform,
        kind,
        name,
        source: code.value,
        wasm: directWasm?.module ?? null
      });
      downloadBytes(ready.bytes, ready.filename, 'application/zip');
      output.textContent = `Ready app built ✓\n\nTarget: ${platformLabel(platform)}\nType: ${kindLabel}\nPreflight: ${preflightText}.\n\nDownloaded: ${ready.filename}\nNo GitHub token was used. No Node.js, Rust, Cargo or local compiler is required. Unzip the download and open ${prebuiltLauncher(platform, kind)}.\n\nThe native runtime was prebuilt by the Patch project; Studio only inserted this project's checked payload into that runtime package.`;
      status.textContent = `${platformLabel(platform)} ${kindLabel} app downloaded · no token · no toolchain`;
      return;
    }

    if (nativeBuildMode.value === 'local') {
      setBusy(true, `Preparing ${platformLabel(platform)} local build kit…`);
      const kit = buildLocalNativeKit(code.value, { name, kind, platform });
      downloadBytes(kit.bytes, kit.filename, 'application/zip');
      output.textContent = `Local build kit ready ✓\n\nTarget: ${platformLabel(platform)}\nType: ${kindLabel}\nPreflight passed: ${preflightText}.\n\nNo GitHub token was used. Unzip ${kit.filename} and run ${localLauncher(platform)}.\n\n${localRequirement(platform, kind)}`;
      status.textContent = `${platformLabel(platform)} local build kit downloaded`;
      return;
    }

    const token = tokenInput.value.trim();
    if (!token) throw new Error('Cloud build mode needs a fine-grained GitHub token with Actions read/write access. Switch to “Ready app download (no token)” for the simple credential-free build.');
    const sourceBase64 = utf8Base64(code.value);
    if (sourceBase64.length > 60000) throw new Error('This source is too large for the GitHub Actions dispatch channel. Use the ready-app or local mode.');

    const requestId = makeRequestId();
    const workflow = workflowFor(platform);
    setBusy(true, `Starting ${platformLabel(platform)} ${kindLabel} cloud build…`);
    output.textContent = `${platformLabel(platform)} ${kindLabel} cloud build\n\nPreflight passed: ${preflightText}.\nSubmitting the current editor source to GitHub Actions…`;
    const inputs = { source_b64: sourceBase64, source_path: '', app_name: name, kind, request_id: requestId };
    if (platform !== 'freebsd') inputs.platform = platform;
    await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${workflow}/dispatches`, token, {
      method: 'POST', body: JSON.stringify({ ref: 'main', inputs })
    });
    const run = await waitForRun(token, requestId, platform, kindLabel, workflow);
    if (run.conclusion !== 'success') throw new Error(`GitHub build finished with '${run.conclusion}'. Open ${run.html_url} for the build log.`);
    status.textContent = 'Cloud build complete. Preparing download…';
    const artifacts = await apiJson(`${API}/repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`, token);
    const expectedName = `patch-${platform}-${requestId}`;
    const artifact = (artifacts.artifacts ?? []).find(item => item.name === expectedName && !item.expired);
    if (!artifact) throw new Error(`The build succeeded but artifact '${expectedName}' was not found.`);
    await downloadArtifact(artifact, token, `${name}-${platform}-${kind}-build.zip`);
    output.textContent = `Built ${name} for ${platformLabel(platform)} ✓\n\nType: ${kindLabel}\n${artifactDescription(platform, kind)}\n\nBuild run: ${run.html_url}`;
    status.textContent = `${platformLabel(platform)} ${kindLabel} cloud build downloaded`;
  } catch (error) {
    output.textContent = `Native build stopped:\n${error?.message ?? String(error)}`;
    status.textContent = 'Native build stopped';
  } finally {
    setBusy(false);
  }
}, true);

function installNativeModeControls() {
  const label = document.createElement('label');
  label.append('Native build ');
  const select = document.createElement('select');
  select.id = 'nativeBuildMode';
  select.setAttribute('aria-label', 'Native build mode');
  select.innerHTML = '<option value="prebuilt">Ready app download (no token)</option><option value="cloud">GitHub Actions cloud build (advanced)</option><option value="local">Local toolchain kit (advanced)</option>';
  label.append(select);
  panel.insertBefore(label, tokenLabel);
  tokenLabel.firstChild.textContent = 'GitHub token (cloud only) ';
  tokenInput.placeholder = 'Cloud-build token';
  return select;
}

function refreshNativePanel() {
  const platform = nativeTargets.get(buildTarget.value);
  panel.hidden = !platform;
  tokenLabel.hidden = nativeBuildMode.value !== 'cloud';
  if (!platform || buildButton.disabled) return;
  const kindLabel = projectKind.value === 'window' ? 'Window / GUI' : 'Console';
  if (platform === 'freebsd' && projectKind.value === 'window') {
    status.textContent = 'FreeBSD currently supports Console builds only.';
  } else if (nativeBuildMode.value === 'prebuilt') {
    status.textContent = platform === 'freebsd'
      ? 'Ready-app downloads are not available for FreeBSD yet; choose local or cloud mode.'
      : `${platformLabel(platform)} ${kindLabel}: click Build to download a ready-to-run app. No token or local toolchain.`;
  } else if (nativeBuildMode.value === 'local') {
    status.textContent = `${platformLabel(platform)} ${kindLabel}: advanced local toolchain kit.`;
  } else {
    status.textContent = `${platformLabel(platform)} ${kindLabel}: advanced GitHub Actions build. Token is never saved.`;
  }
}

async function waitForRun(token, requestId, platform, kindLabel, workflow) {
  let seen = null;
  for (let attempt = 0; attempt < 360; attempt += 1) {
    const data = await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=30`, token);
    const run = (data.workflow_runs ?? []).find(item => String(item.display_title ?? item.name ?? '').includes(requestId));
    if (run) {
      seen = run;
      const state = run.status === 'completed' ? run.conclusion : run.status;
      status.textContent = `${platformLabel(platform)} ${kindLabel} cloud build: ${state}…`;
      output.textContent = `${platformLabel(platform)} ${kindLabel} cloud build\n\nGitHub Actions run: ${state}\n${run.html_url}`;
      if (run.status === 'completed') return run;
    }
    await sleep(5000);
  }
  throw new Error(seen ? `Native build did not finish in time. Open ${seen.html_url}.` : 'Patch Studio could not find the dispatched build run.');
}

async function apiJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers ?? {})
    }
  });
  if (response.status === 204) return null;
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).message ?? ''; } catch { detail = await response.text(); }
    if (response.status === 401 || response.status === 403) throw new Error(`GitHub rejected the cloud-build token (${response.status}). Switch to the ready-app mode to build without GitHub credentials.${detail ? ` ${detail}` : ''}`);
    throw new Error(`GitHub API ${response.status}: ${detail || response.statusText}`);
  }
  return response.json();
}

async function downloadArtifact(artifact, token, filename) {
  const response = await fetch(artifact.archive_download_url, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!response.ok) throw new Error(`Could not download native build artifact (${response.status}).`);
  downloadBlob(await response.blob(), filename);
}
function downloadBytes(bytes, filename, type) { downloadBlob(new Blob([bytes], { type }), filename); }
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function showOutput() {
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.tab === 'output');
  document.querySelector('#designer').hidden = true; document.querySelector('#app').hidden = true; document.querySelector('#changes').hidden = true; document.querySelector('#ir').hidden = true; output.hidden = false;
}
function setBusy(busy, message = null) { buildButton.disabled = busy; nativeBuildMode.disabled = busy; if (message) status.textContent = message; if (!busy) refreshNativePanel(); }
function workflowFor(platform) { return platform === 'freebsd' ? FREEBSD_WORKFLOW : NATIVE_WORKFLOW; }
function artifactDescription(platform, kind) {
  if (platform === 'freebsd') return 'FreeBSD native Console package';
  if (kind === 'window') return `${platformLabel(platform)} standalone GUI package`;
  return `${platformLabel(platform)} native Console package`;
}
function prebuiltLauncher(platform, kind) {
  if (platform === 'macos') return kind === 'window' ? 'PatchWindowRuntime.app' : 'PatchConsoleRuntime.app';
  if (platform === 'windows') return kind === 'window' ? 'PatchWindowRuntime/PatchWindowRuntime.exe' : 'PatchConsoleRuntime.exe';
  return kind === 'window' ? 'PatchWindowRuntime/PatchWindowRuntime' : 'PatchConsoleRuntime';
}
function localLauncher(platform) { if (platform === 'windows') return 'build.cmd'; if (platform === 'macos') return 'build.command'; return 'build.sh'; }
function localRequirement(platform, kind) {
  if (platform === 'freebsd') return 'Local requirement: Node.js 22+ and cc.';
  if (kind === 'window') return 'Local requirement: Node.js 22+.';
  return 'Local requirement: Node.js 22+ and Rust/Cargo.';
}
function utf8Base64(text) {
  const bytes = new TextEncoder().encode(text); let binary = ''; const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
  return btoa(binary);
}
function makeRequestId() { if (globalThis.crypto?.randomUUID) return crypto.randomUUID(); return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function safeName(name) { return (name || 'PatchApp').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'PatchApp'; }
function platformLabel(platform) { if (platform === 'macos') return 'macOS'; if (platform === 'windows') return 'Windows'; if (platform === 'freebsd') return 'FreeBSD'; return 'Linux'; }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
