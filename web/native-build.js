import { compile } from '../src/compiler.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { compileToC99 } from '../src/c99.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildCompiledWindowArtifact } from '../src/window-compiled.js';
import { buildLocalNativeKit } from '../src/local-native-kit.js';
import { buildPrebuiltNativePackage, prebuiltNativeTemplateUrl } from '../src/prebuilt-native.js';
import { buildPrebuiltCompiledWindowPackage } from '../src/prebuilt-window.js';

const REPOSITORY = 'pinkysworld/Patch';
const NATIVE_WORKFLOW = 'native-apps.yml';
const WINDOWS_SINGLE_EXE_WORKFLOW = 'windows-single-exe.yml';
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
let nativeBuildProfile = '';

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
    let compiledWindow = null;
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
      compiledWindow = buildCompiledWindowArtifact(preflight);
      preflightText = `compiled Window ${compiledWindow.version}, Change IR ${compiledWindow.irVersion}, ${support.windows} form${support.windows === 1 ? '' : 's'}, ${support.controls} control${support.controls === 1 ? '' : 's'} and ${support.events} event handler${support.events === 1 ? '' : 's'} validated`;
    }

    const kindLabel = kind === 'window' ? 'Window / GUI' : 'Console';

    if (nativeBuildMode.value === 'prebuilt') {
      if (platform === 'freebsd') {
        throw new Error('Ready-app downloads are currently available for Windows, macOS and Linux. For FreeBSD, choose the local or cloud build mode.');
      }
      setBusy(true, `Building ${kind === 'window' ? 'compatibility' : 'ready'} ${platformLabel(platform)} ${kindLabel} app…`);
      output.textContent = `${platformLabel(platform)} ${kindLabel} ${kind === 'window' ? 'compatibility' : 'ready-app'} build\n\nPreflight passed: ${preflightText}.\nLoading the Patch runtime asset…`;
      const templateUrl = prebuiltNativeTemplateUrl(platform, kind);
      const response = await fetch(templateUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`The prebuilt ${platformLabel(platform)} runtime is not available yet (${response.status}).`);
      status.textContent = kind === 'console'
        ? `Sealing project-specific ${platformLabel(platform)} executable in this browser…`
        : `Linking compiled Patch Window program into the Electron compatibility runtime…`;
      const templateBytes = new Uint8Array(await response.arrayBuffer());
      const ready = kind === 'window'
        ? buildPrebuiltCompiledWindowPackage(templateBytes, {
            platform,
            name,
            compiledWindow,
            source: code.value
          })
        : buildPrebuiltNativePackage(templateBytes, {
            platform,
            kind,
            name,
            wasm: directWasm?.module ?? null
          });
      downloadBytes(ready.bytes, ready.filename, 'application/zip');
      output.textContent = `${kind === 'window' ? 'Compatibility package' : 'Ready app'} built ✓\n\nTarget: ${platformLabel(platform)}\nType: ${kindLabel}\nPreflight: ${preflightText}.\n\nDownloaded: ${ready.filename}\nNo GitHub token was used. No local compiler is required. Unzip the download and open ${prebuiltLauncher(platform, kind, name)}.\n\n${readyPackageNote(kind, platform)}`;
      status.textContent = kind === 'window'
        ? `${platformLabel(platform)} ${kindLabel} compatibility package downloaded · Electron runtime`
        : `${platformLabel(platform)} ${kindLabel} app downloaded · compiled · no token · no toolchain`;
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
    if (!token) {
      const nativeHint = platform === 'windows' && kind === 'window'
        ? 'The recommended Windows native single-EXE build needs a fine-grained GitHub token with Actions read/write access. The token is used only for this build request and is not saved. Choose “Compatibility package (Electron, no token)” only if you specifically need the old no-token path.'
        : 'Cloud build mode needs a fine-grained GitHub token with Actions read/write access. The token is not saved.';
      throw new Error(nativeHint);
    }
    const sourceBase64 = utf8Base64(code.value);
    if (sourceBase64.length > 60000) throw new Error('This source is too large for the GitHub Actions dispatch channel. Use the local build path.');

    const requestId = makeRequestId();
    const workflow = workflowFor(platform, kind);
    const directWin32 = platform === 'windows' && kind === 'window';
    setBusy(true, directWin32 ? 'Starting native Windows single-EXE build…' : `Starting ${platformLabel(platform)} ${kindLabel} cloud build…`);
    output.textContent = `${directWin32 ? 'Windows native single-EXE' : `${platformLabel(platform)} ${kindLabel} cloud`} build\n\nPreflight passed: ${preflightText}.\nSubmitting the current editor source to GitHub Actions…`;
    const inputs = directWin32
      ? { source_b64: sourceBase64, source_path: '', app_name: name, request_id: requestId }
      : { source_b64: sourceBase64, source_path: '', app_name: name, kind, request_id: requestId };
    if (!directWin32 && platform !== 'freebsd') inputs.platform = platform;
    await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${workflow}/dispatches`, token, {
      method: 'POST', body: JSON.stringify({ ref: 'main', inputs })
    });
    const run = await waitForRun(token, requestId, platform, kindLabel, workflow);
    if (run.conclusion !== 'success') throw new Error(`GitHub build finished with '${run.conclusion}'. Open ${run.html_url} for the build log.`);
    status.textContent = 'Cloud build complete. Preparing download…';
    const artifacts = await apiJson(`${API}/repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`, token);
    const expectedName = directWin32 ? 'patch-windows-single-exe' : `patch-${platform}-${requestId}`;
    const artifact = (artifacts.artifacts ?? []).find(item => item.name === expectedName && !item.expired);
    if (!artifact) throw new Error(`The build succeeded but artifact '${expectedName}' was not found.`);
    const downloadName = directWin32 ? `${name}-windows-single-exe.zip` : `${name}-${platform}-${kind}-build.zip`;
    await downloadArtifact(artifact, token, downloadName);
    output.textContent = `Built ${name} for ${platformLabel(platform)} ✓\n\nType: ${kindLabel}\n${artifactDescription(platform, kind, name)}\n\nBuild run: ${run.html_url}`;
    status.textContent = directWin32
      ? `Windows native single EXE downloaded · artifact ZIP contains only ${name}.exe`
      : `${platformLabel(platform)} ${kindLabel} cloud build downloaded`;
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
  const kind = projectKind.value === 'window' ? 'window' : 'console';
  panel.hidden = !platform;
  const profile = `${platform ?? 'none'}:${kind}`;
  if (profile !== nativeBuildProfile) {
    nativeBuildProfile = profile;
    if (platform === 'windows' && kind === 'window') nativeBuildMode.value = 'cloud';
  }
  updateNativeModeLabels(platform, kind);
  tokenLabel.hidden = nativeBuildMode.value !== 'cloud';
  if (!platform || buildButton.disabled) return;
  const kindLabel = kind === 'window' ? 'Window / GUI' : 'Console';
  if (platform === 'freebsd' && kind === 'window') {
    status.textContent = 'FreeBSD currently supports Console builds only.';
  } else if (platform === 'windows' && kind === 'window' && nativeBuildMode.value === 'cloud') {
    status.textContent = 'Recommended: native Win32 single EXE. GitHub Actions runs MSVC, launches the real GUI smoke, and returns an artifact ZIP containing only your .exe. Token is never saved.';
  } else if (nativeBuildMode.value === 'prebuilt') {
    status.textContent = platform === 'freebsd'
      ? 'Ready-app downloads are not available for FreeBSD yet; choose local or cloud mode.'
      : kind === 'console'
        ? `${platformLabel(platform)} Console: click Build for a sealed project-specific executable. No token or local toolchain.`
        : platform === 'windows'
          ? 'Compatibility only: this no-token Windows GUI path uses the old Electron runtime and is not a single EXE. Choose “Native single EXE” for the real Win32 build.'
          : `${platformLabel(platform)} Window / GUI compatibility package: compiled Patch payload inside the Electron desktop runtime.`;
  } else if (nativeBuildMode.value === 'local') {
    status.textContent = kind === 'window'
      ? `${platformLabel(platform)} ${kindLabel}: legacy local compatibility kit. Use patch-app locally for the direct native backend.`
      : `${platformLabel(platform)} ${kindLabel}: advanced local toolchain kit.`;
  } else {
    status.textContent = kind === 'window'
      ? `${platformLabel(platform)} ${kindLabel}: cloud compatibility build currently uses the legacy desktop packager on this platform.`
      : `${platformLabel(platform)} ${kindLabel}: advanced GitHub Actions build. Token is never saved.`;
  }
}

function updateNativeModeLabels(platform, kind) {
  const prebuilt = nativeBuildMode.querySelector('option[value="prebuilt"]');
  const cloud = nativeBuildMode.querySelector('option[value="cloud"]');
  const local = nativeBuildMode.querySelector('option[value="local"]');
  if (platform === 'windows' && kind === 'window') {
    prebuilt.textContent = 'Compatibility package (Electron, no token)';
    cloud.textContent = 'Native single EXE (GitHub Actions, recommended)';
    local.textContent = 'Local compatibility kit (advanced)';
    return;
  }
  if (kind === 'window') {
    prebuilt.textContent = 'Compatibility package (Electron, no token)';
    cloud.textContent = 'Cloud compatibility build (Electron, advanced)';
    local.textContent = 'Local compatibility kit (advanced)';
    return;
  }
  prebuilt.textContent = 'Ready app download (no token)';
  cloud.textContent = 'GitHub Actions cloud build (advanced)';
  local.textContent = 'Local toolchain kit (advanced)';
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
    if (response.status === 401 || response.status === 403) throw new Error(`GitHub rejected the cloud-build token (${response.status}). The token is not stored by Patch Studio.${detail ? ` ${detail}` : ''}`);
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
function workflowFor(platform, kind) {
  if (platform === 'windows' && kind === 'window') return WINDOWS_SINGLE_EXE_WORKFLOW;
  return platform === 'freebsd' ? FREEBSD_WORKFLOW : NATIVE_WORKFLOW;
}
function artifactDescription(platform, kind, name) {
  if (platform === 'freebsd') return 'FreeBSD native Console package';
  if (platform === 'windows' && kind === 'window') return `Direct Win32/MSVC native GUI build. The GitHub artifact ZIP contains exactly one file: ${name}.exe. No patch-app.json, Electron, Chromium or Node runtime is shipped.`;
  if (kind === 'window') return `${platformLabel(platform)} compatibility GUI package using the current desktop runtime.`;
  return `${platformLabel(platform)} native Console package`;
}
function readyPackageNote(kind, platform) {
  if (kind === 'console') {
    return 'Studio compiled this Console project to direct Wasm and sealed that checked payload inside a project-specific executable. The platform runtime machine code is prebuilt; this is sealed native packaging, not a claim of direct Patch-to-x86/ARM AOT compilation.';
  }
  const nativeAlternative = platform === 'windows'
    ? 'For Windows, choose “Native single EXE (GitHub Actions, recommended)” or use patch-app locally to build the direct Win32 application.'
    : 'Direct AppKit/GTK backends exist in the Patch compiler, but Studio integration for those native GUI paths is still pending.';
  return `Compatibility path: Studio links the compiled Patch Window artifact into the prebuilt Electron desktop runtime, which can include patch-app.json and multiple runtime files. This is not the direct native GUI backend. ${nativeAlternative}`;
}
function prebuiltLauncher(platform, kind, name) {
  if (kind === 'console') {
    if (platform === 'macos') return `${name}.app`;
    if (platform === 'windows') return `${name}.exe`;
    return name;
  }
  if (platform === 'macos') return 'PatchWindowRuntime.app';
  if (platform === 'windows') return 'PatchWindowRuntime/PatchWindowRuntime.exe';
  return 'PatchWindowRuntime/PatchWindowRuntime';
}
function localLauncher(platform) { if (platform === 'windows') return 'build.cmd'; if (platform === 'macos') return 'build.command'; return 'build.sh'; }
function localRequirement(platform, kind) {
  if (platform === 'freebsd') return 'Local requirement: Node.js 22+ and cc.';
  if (kind === 'window') return 'Legacy compatibility kit requirement: Node.js 22+. For a direct native build use patch-app with the platform native toolchain.';
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
