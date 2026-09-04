import { getStudioProjectResources } from './project-lifecycle.js';

const SESSION_ENDPOINT = './__patch/session';
const REQUEST_FORMAT = 'patch-offline-studio-build-request';
const TOKEN_HEADER = 'X-Patch-Local-Token';
const targetPlatforms = new Map([
  ['native-windows', 'windows'],
  ['native-macos', 'macos'],
  ['native-linux', 'linux']
]);

const code = document.querySelector('#code');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const buildTarget = document.querySelector('#buildTarget');
const buildButton = document.querySelector('#build');
const output = document.querySelector('#output');
const outputTab = document.querySelector('#tabOutput');
const nativePanel = document.querySelector('#nativeBuildPanel');
const nativeStatus = document.querySelector('#nativeBuildStatus');

let bridgeSession = null;
let nativeBuildMode = null;

void probeBridge();

buildButton?.addEventListener('click', event => {
  const platform = targetPlatforms.get(buildTarget?.value);
  if (!canUseBridge(platform)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void runLocalBuild(platform);
}, true);

async function probeBridge() {
  try {
    const response = await fetch(SESSION_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) return;
    const session = await response.json();
    if (session?.format !== 'patch-offline-studio-session' || session?.version !== 1 || !session?.token) return;
    if (session?.nativeBuild?.contract !== 'patch-offline-studio-build-bridge/0.1') return;
    bridgeSession = session;
    installModeOption();
  } catch {
    // Normal browser/PWA builds intentionally have no privileged local bridge.
  }
}

function installModeOption() {
  const install = () => {
    nativeBuildMode = document.querySelector('#nativeBuildMode');
    if (!nativeBuildMode) return false;
    let option = nativeBuildMode.querySelector('option[value="offline"]');
    if (!option) {
      option = document.createElement('option');
      option.value = 'offline';
      option.textContent = 'Installed local compiler (Offline Studio)';
      nativeBuildMode.insertBefore(option, nativeBuildMode.firstChild);
    }
    const refresh = () => {
      const platform = targetPlatforms.get(buildTarget?.value);
      option.hidden = !bridgeSession?.nativeBuild?.supported || platform !== bridgeSession?.nativeBuild?.platform;
      if (!option.hidden) nativeBuildMode.value = 'offline';
      renderBridgeStatus(platform);
    };
    buildTarget?.addEventListener('change', () => queueMicrotask(refresh));
    projectKind?.addEventListener('change', () => queueMicrotask(refresh));
    nativeBuildMode.addEventListener('change', () => renderBridgeStatus(targetPlatforms.get(buildTarget?.value)));
    refresh();
    return true;
  };

  if (install()) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 20) clearInterval(timer);
  }, 25);
}

function canUseBridge(platform) {
  return Boolean(
    platform &&
    bridgeSession?.nativeBuild?.supported &&
    bridgeSession.nativeBuild.platform === platform &&
    nativeBuildMode?.value === 'offline'
  );
}

function renderBridgeStatus(platform) {
  if (!nativeStatus || !nativePanel || !bridgeSession) return;
  const capability = bridgeSession.nativeBuild;
  if (!platform || nativeBuildMode?.value !== 'offline') return;
  if (!capability.supported || platform !== capability.platform) {
    nativeStatus.textContent = capability.reason || 'Installed host-native build is not available for this target.';
    return;
  }
  nativeStatus.textContent = `Offline Studio local build: ${platformLabel(platform)} ${capability.arch} uses the bundled Patch offline compiler. No GitHub token, network build queue or general shell bridge is exposed.`;
}

async function runLocalBuild(platform) {
  showOutput();
  const name = safeName(projectName?.value);
  const kind = projectKind?.value === 'window' ? 'window' : 'console';
  const resources = kind === 'window' ? getStudioProjectResources() : [];
  const originalLabel = buildButton.textContent;
  buildButton.disabled = true;
  buildButton.textContent = 'Building…';
  if (nativeStatus) nativeStatus.textContent = `Building ${name} locally with the bundled Patch compiler…`;
  output.textContent = `Offline Studio local native build\n\nTarget: ${platformLabel(platform)}\nType: ${kind === 'window' ? 'Window / GUI' : 'Console'}\nCompiler bridge: patch-offline-studio-build-bridge/0.1\n\nCompiling on this machine…`;

  try {
    const response = await fetch('./__patch/build', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        [TOKEN_HEADER]: bridgeSession.token
      },
      body: JSON.stringify({
        format: REQUEST_FORMAT,
        version: 1,
        target: 'native-host',
        platform,
        kind,
        name,
        source: String(code?.value ?? ''),
        resources
      })
    });
    const result = await readJsonResponse(response);
    if (!response.ok) throw new Error(result?.diagnostics ? `${result.error}\n${result.diagnostics}` : result?.error || `Local build failed with HTTP ${response.status}.`);
    if (result?.format !== 'patch-offline-studio-build-result' || !result?.artifactId || !result?.sha256) {
      throw new Error('Offline Studio returned an invalid local-build result.');
    }

    const artifactResponse = await fetch(`./${result.downloadPath}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { [TOKEN_HEADER]: bridgeSession.token }
    });
    if (!artifactResponse.ok) throw new Error(`Local build succeeded, but artifact download failed with HTTP ${artifactResponse.status}.`);
    const blob = await artifactResponse.blob();
    downloadBlob(blob, result.filename);

    output.textContent = `Local native build complete ✓\n\nTarget: ${platformLabel(platform)}\nType: ${kind === 'window' ? 'Window / GUI' : 'Console'}\nDownloaded: ${result.filename}\nSize: ${formatBytes(result.size)}\nSHA-256: ${result.sha256}\n\nCompiler diagnostics:\n${result.diagnostics || 'No diagnostics.'}\n\nThe build ran through the bundled Patch offline compiler on this host. The browser received only the versioned Patch build API and the resulting artifact; it did not receive a general shell or arbitrary filesystem API.`;
    if (nativeStatus) nativeStatus.textContent = `Local ${platformLabel(platform)} build complete · ${result.filename} · SHA-256 ${result.sha256.slice(0, 12)}…`;
  } catch (error) {
    output.textContent = `Local native build stopped:\n${error?.message ?? String(error)}`;
    if (nativeStatus) nativeStatus.textContent = 'Offline Studio local build stopped';
  } finally {
    buildButton.disabled = false;
    buildButton.textContent = originalLabel;
  }
}

async function readJsonResponse(response) {
  try { return await response.json(); }
  catch { return { error: `Offline Studio returned a non-JSON response (${response.status}).` }; }
}

function safeName(value) {
  const raw = String(value ?? '').trim();
  const cleaned = raw.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^[^A-Za-z]+/, '');
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
