import { getStudioProjectBuildInput } from './project-lifecycle.js';

const SESSION_ENDPOINT = './__patch/session';
const BUILD_PROTOCOL = 'patch-offline-build-bridge/0.2';
const SNAPSHOT_PROTOCOL = 'patch-offline-workspace-snapshot/0.2';
const targetPlatforms = new Map([
  ['native-windows', 'windows'],
  ['native-macos', 'macos'],
  ['native-linux', 'linux']
]);

const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const buildTarget = document.querySelector('#buildTarget');
const buildButton = document.querySelector('#build');
const output = document.querySelector('#output');
const outputTab = document.querySelector('#tabOutput');
const nativePanel = document.querySelector('#nativeBuildPanel');
const nativeStatus = document.querySelector('#nativeBuildStatus');

let session = null;
let nativeBuildMode = null;

buildButton?.addEventListener('click', event => {
  const platform = targetPlatforms.get(buildTarget?.value);
  if (!canUseInstalledBuild(platform)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void runInstalledBuild(platform);
}, true);

void probeSession();

async function probeSession() {
  try {
    const response = await fetch(SESSION_ENDPOINT, { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return;
    const value = await response.json();
    if (value?.format !== 'patch-offline-studio-session' || value?.version !== 1) return;
    session = value;
    installOfflineMode();
  } catch {
    // Public/PWA Studio intentionally has no privileged host session.
  }
}

function installOfflineMode() {
  let attempts = 0;
  const tryInstall = () => {
    nativeBuildMode = document.querySelector('#nativeBuildMode');
    if (!nativeBuildMode) return false;
    let option = nativeBuildMode.querySelector('option[value="offline-installed"]');
    if (!option) {
      option = document.createElement('option');
      option.value = 'offline-installed';
      option.textContent = 'Installed host build (Offline Studio)';
      nativeBuildMode.insertBefore(option, nativeBuildMode.firstChild);
    }

    const refresh = () => queueMicrotask(() => refreshOfflineMode(option));
    buildTarget?.addEventListener('change', refresh);
    projectKind?.addEventListener('change', refresh);
    nativeBuildMode.addEventListener('change', refresh);
    refreshOfflineMode(option, true);
    return true;
  };

  if (tryInstall()) return;
  const timer = setInterval(() => {
    attempts += 1;
    if (tryInstall() || attempts >= 40) clearInterval(timer);
  }, 25);
}

function refreshOfflineMode(option, preferInstalled = false) {
  const platform = targetPlatforms.get(buildTarget?.value);
  const kind = projectKind?.value === 'window' ? 'window' : 'console';
  const available = Boolean(
    session?.localBuild?.available &&
    platform &&
    platform === session.localBuild.platform &&
    kind === 'window'
  );
  option.hidden = !available;
  if (available && (preferInstalled || nativeBuildMode?.value === 'offline-installed')) nativeBuildMode.value = 'offline-installed';
  if (!available && nativeBuildMode?.value === 'offline-installed') nativeBuildMode.value = 'prebuilt';

  if (!nativePanel || !nativeStatus || !platform) return;
  if (available && nativeBuildMode?.value === 'offline-installed') {
    nativeStatus.textContent = `Offline Studio host build: ${platformLabel(platform)} ${session.localBuild.arch}. The canonical project-v4 snapshot, including validated resources, is written only inside the opened workspace and linked by the bundled Patch offline compiler. No GitHub token or network build queue is used.`;
  } else if (!session?.localBuild?.available && session?.localBuild?.reason) {
    nativeStatus.dataset.offlineBuildHint = session.localBuild.reason;
  }
}

function canUseInstalledBuild(platform) {
  return Boolean(
    platform &&
    session?.localBuild?.available &&
    platform === session.localBuild.platform &&
    projectKind?.value === 'window' &&
    nativeBuildMode?.value === 'offline-installed'
  );
}

async function runInstalledBuild(platform) {
  showOutput();
  const buildInput = getStudioProjectBuildInput();
  const source = String(buildInput.composition?.source ?? '');
  if (!source.trim()) {
    output.textContent = 'Offline Studio local build stopped:\nThe composed Patch project source is empty.';
    return;
  }

  const project = buildInput.bundle;
  if (!project || project.format !== 'patch-studio-project' || project.version !== 4) {
    output.textContent = 'Offline Studio local build stopped:\nThe current Studio state could not be represented as a canonical project-v4 snapshot.';
    return;
  }

  const name = safeName(projectName?.value || project.project?.name);
  const requestId = makeRequestId();
  const originalLabel = buildButton.textContent;
  buildButton.disabled = true;
  buildButton.textContent = 'Building…';
  nativeStatus.textContent = `Building ${name} locally with the installed Patch compiler…`;
  output.textContent = `Offline Studio installed native build\n\nTarget: ${platformLabel(platform)}\nProject snapshot: ${project.files?.length ?? 1} source file(s), ${project.resources?.length ?? 0} resource(s)\nBridge: ${BUILD_PROTOCOL}\nWorkspace snapshot: ${SNAPSHOT_PROTOCOL}\n\nValidating and materializing the current project-v4 Studio state…`;

  try {
    const snapshot = await bridgeJson(session.localBuild.snapshotPath, {
      protocol: SNAPSHOT_PROTOCOL,
      requestId,
      project
    });
    if (!snapshot?.ok || snapshot?.kind !== 'project' || !snapshot?.source || !snapshot?.sha256) {
      throw new Error('Offline Studio returned an invalid project workspace snapshot response.');
    }

    output.textContent = `Offline Studio installed native build\n\nTarget: ${platformLabel(platform)}\nSnapshot SHA-256: ${snapshot.sha256}\nProject: ${snapshot.source}\nSource files: ${snapshot.sourceFileCount ?? project.files?.length ?? 1}\nResources: ${snapshot.resourceCount ?? project.resources?.length ?? 0}\n\nLinking the canonical project-v4 snapshot with the bundled Patch offline compiler…`;

    const result = await bridgeJson(session.localBuild.buildPath, {
      protocol: BUILD_PROTOCOL,
      action: 'build-native-window',
      requestId,
      source: snapshot.source,
      appName: name
    });
    if (!result?.ok) throw new Error(result?.message || result?.error || 'Installed local build failed.');

    let downloadLine = `Output workspace: ${result.outputDirectory}`;
    if (result.artifact?.downloadPath) {
      const response = await bridgeFetch(result.artifact.downloadPath, { method: 'GET' });
      if (!response.ok) throw new Error(`Native artifact download failed with HTTP ${response.status}.`);
      const blob = await response.blob();
      downloadBlob(blob, result.artifact.filename);
      downloadLine = `Downloaded: ${result.artifact.filename}\nSize: ${formatBytes(result.artifact.size)}\nSHA-256: ${result.artifact.sha256}\nWorkspace artifact: ${result.artifact.path}`;
    }

    output.textContent = `Installed native build complete ✓\n\nTarget: ${result.platform}\nBackend: ${result.backend}\nOutput: ${result.outputKind}\n${downloadLine}\nProject snapshot SHA-256: ${snapshot.sha256}\nSource files: ${snapshot.sourceFileCount ?? project.files?.length ?? 1}\nResources: ${snapshot.resourceCount ?? project.resources?.length ?? 0}\n\n${result.diagnostics ? `Compiler diagnostics:\n${result.diagnostics}\n\n` : ''}The installed Studio exposed only its versioned project-snapshot/build/artifact operations. Project resources were validated by digest before the snapshot was accepted. No arbitrary command, executable path, environment map or filesystem path was accepted from the browser.`;
    nativeStatus.textContent = `Installed ${platformLabel(platform)} build complete${result.artifact?.filename ? ` · ${result.artifact.filename}` : ''}`;
  } catch (error) {
    output.textContent = `Offline Studio local build stopped:\n${error?.message ?? String(error)}`;
    nativeStatus.textContent = 'Installed host build stopped';
  } finally {
    buildButton.disabled = false;
    buildButton.textContent = originalLabel;
    showOutput();
  }
}

async function bridgeJson(path, payload) {
  const response = await bridgeFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let value;
  try { value = await response.json(); }
  catch { throw new Error(`Offline build bridge returned non-JSON HTTP ${response.status}.`); }
  if (!response.ok) throw new Error(value?.message || value?.error || `Offline build bridge HTTP ${response.status}.`);
  return value;
}

function bridgeFetch(endpoint, options = {}) {
  const base = String(session?.localBuild?.origin ?? '');
  const token = String(session?.localBuild?.token ?? '');
  if (!base || !token) throw new Error('Offline Studio local-build capability is not available.');
  return fetch(new URL(endpoint, base), {
    ...options,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });
}

function makeRequestId() {
  const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 16) ?? Math.random().toString(16).slice(2, 18);
  return `studio-${Date.now().toString(36)}-${random}`;
}

function safeName(value) {
  const raw = String(value ?? '').trim();
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[^A-Za-z]+/, '');
  return (cleaned || 'PatchApp').slice(0, 64);
}

function showOutput() {
  outputTab?.click();
  output?.removeAttribute('hidden');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function platformLabel(platform) {
  if (platform === 'windows') return 'Windows';
  if (platform === 'macos') return 'macOS';
  if (platform === 'linux') return 'Linux';
  return platform;
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
