import { compile } from '../src/compiler.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { compileToC99 } from '../src/c99.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildCompiledWindowArtifact } from '../src/window-compiled.js';
import {
  PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,
  buildCurrentNativeGuiIR as buildNativeGuiIR,
  sealCurrentNativeGuiRuntime
} from '../src/native-current-contract.js';
import { buildLinuxNativeGuiPackage, buildMacosNativeGuiPackage } from '../src/sealed-native-package.js';
import { buildLocalNativeKit } from '../src/local-native-kit.js';
import { buildPrebuiltNativePackage, prebuiltNativeTemplateUrl } from '../src/prebuilt-native.js';
import { buildPrebuiltCompiledWindowPackage } from '../src/prebuilt-window.js';
import { diagnosticFromError, formatPatchDiagnostic } from '../src/diagnostics.js';
import { getStudioProjectDiagnosticContext, getStudioProjectResources } from './project-lifecycle.js';

const REPOSITORY = 'pinkysworld/Patch';
const NATIVE_WORKFLOW = 'native-apps.yml';
const WINDOWS_SINGLE_EXE_WORKFLOW = 'windows-single-exe.yml';
const NATIVE_WINDOW_AOT_WORKFLOW = 'native-window-aot.yml';
const FREEBSD_WORKFLOW = 'freebsd-c99.yml';
const WINDOWS_NATIVE_GUI_RUNTIME = './runtimes/patch-windows-native-gui-runtime.exe';
const LINUX_NATIVE_GUI_RUNTIME = './runtimes/patch-linux-native-gui-runtime.bin';
const MACOS_NATIVE_GUI_RUNTIME = './runtimes/patch-macos-native-gui-runtime.bin';
const API = 'https://api.github.com';
const CLOUD_BUILD_TIMEOUT_MS = 15 * 60 * 1000;
const CLOUD_BUILD_POLL_MS = 5000;
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
const cloudControls = installCloudBuildControls();
let nativeBuildProfile = '';
let activeCloudBuild = null;
let lastCloudBuildSnapshot = null;

const nativeTargets = new Map([
  ['native-windows', 'windows'],
  ['native-macos', 'macos'],
  ['native-linux', 'linux'],
  ['native-freebsd', 'freebsd']
]);

buildTarget.addEventListener('change', refreshNativePanel);
projectKind.addEventListener('change', refreshNativePanel);
nativeBuildMode.addEventListener('change', refreshNativePanel);
cloudControls.cancel.addEventListener('click', cancelActiveCloudBuild);
cloudControls.retry.addEventListener('click', retryLastCloudBuild);
refreshNativePanel();

function formatNativeStop(error) {
  const message = error?.message ?? String(error);
  if (error?.name === 'PatchBuildCancelledError' || error?.name === 'PatchBuildTimeoutError') return message;
  try {
    const context = getStudioProjectDiagnosticContext();
    const diagnostic = diagnosticFromError(error, {
      source: context.source,
      entry: context.entry,
      composition: context.composition,
      phase: 'build'
    });
    if (diagnostic.location) return formatPatchDiagnostic(diagnostic);
  } catch {
    /* keep the original transport or host message */
  }
  return message;
}

buildButton.addEventListener('click', async event => {
  const platform = nativeTargets.get(buildTarget.value);
  if (!platform) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showOutput();

  const name = safeName(projectName.value);
  const kind = projectKind.value === 'window' ? 'window' : 'console';
  const resources = kind === 'window' ? getStudioProjectResources() : [];
  let cloudSnapshot = null;
  try {
    let preflightText;
    let directWasm = null;
    let compiledWindow = null;
    let nativeGui = null;
    if (platform === 'freebsd') {
      if (kind !== 'console') throw new Error('FreeBSD currently supports Console projects only.');
      const preflight = compileToC99(code.value, { name, kind: 'console', entry: 'main.patch' });
      preflightText = `portable C99 ${preflight.metadata.version}`;
    } else if (kind === 'console') {
      directWasm = compileToDirectWasm(code.value, { name, kind: 'console', entry: 'main.patch' });
      preflightText = `direct Wasm ${directWasm.metadata.version}`;
    } else {
      const preflight = compile(code.value, { name, kind: 'window', entry: 'main.patch' });
      const support = validateWindowRuntimeSupport(preflight, {
        allowTables: true,
        allowLists: true,
        allowListControls: true,
        allowMenuDecorations: true,
        allowTree: true,
        allowSlider: true
      });
      compiledWindow = buildCompiledWindowArtifact(preflight);
      const needsNativeGui = (nativeBuildMode.value === 'prebuilt' && ['windows', 'macos', 'linux'].includes(platform))
        || (nativeBuildMode.value === 'cloud' && ['windows', 'macos', 'linux'].includes(platform));
      if (needsNativeGui) nativeGui = buildNativeGuiIR(preflight);
      preflightText = `compiled Window ${compiledWindow.version}, Change IR ${compiledWindow.irVersion}, ${support.windows} form${support.windows === 1 ? '' : 's'}, ${support.controls} control${support.controls === 1 ? '' : 's'} and ${support.events} event handler${support.events === 1 ? '' : 's'} validated`;
      if (nativeGui) preflightText += `; Native GUI IR ${nativeGui.version} lowered`;
      if (resources.length) preflightText += `; ${resources.length} project image resource${resources.length === 1 ? '' : 's'} ready`;
    }

    const kindLabel = kind === 'window' ? 'Window / GUI' : 'Console';

    if (nativeBuildMode.value === 'prebuilt' && platform === 'windows' && kind === 'window') {
      setBusy(true, 'Building native Windows single EXE in this browser…');
      output.textContent = `Windows native single-EXE build\n\nPreflight passed: ${preflightText}.\nLoading the native Win32 runtime template…`;
      const response = await fetch(WINDOWS_NATIVE_GUI_RUNTIME, { cache: 'no-store' });
      if (!response.ok) throw new Error(`The native Win32 runtime template is not available yet (${response.status}).`);
      const runtimeBytes = new Uint8Array(await response.arrayBuffer());
      const sealed = sealCurrentNativeGuiRuntime(runtimeBytes, nativeGui, { platform: 'windows', resources });
      downloadBytes(sealed, `${name}.exe`, 'application/vnd.microsoft.portable-executable');
      output.textContent = `Native Windows app built ✓\n\nTarget: Windows\nType: ${kindLabel}\nPreflight: ${preflightText}.\n\nDownloaded: ${name}.exe\nNo GitHub token was used. No build queue, Electron, Chromium, Node.js, patch-app.json or sidecar runtime is required. Patch Studio compiled the GUI to Native GUI IR 1.4 in this browser and sealed payload v14 into the native Win32 runtime v1.5.\n\nThis is a real single-file native Win32 application using native Windows controls, including Slider. The no-token build uses a precompiled native runtime plus embedded checked GUI IR; choose “Native AOT EXE” if you specifically want MSVC to generate project-specific machine code.`;
      status.textContent = `Windows native ${name}.exe downloaded · runtime v1.5 · no token · no Electron`;
      return;
    }

    if (nativeBuildMode.value === 'prebuilt' && platform === 'linux' && kind === 'window') {
      setBusy(true, 'Building native Linux GTK app in this browser…');
      output.textContent = `Linux native GTK build\n\nPreflight passed: ${preflightText}.\nLoading the native GTK runtime template…`;
      const response = await fetch(LINUX_NATIVE_GUI_RUNTIME, { cache: 'no-store' });
      if (!response.ok) throw new Error(`The native Linux GTK runtime template is not available yet (${response.status}).`);
      const runtimeBytes = new Uint8Array(await response.arrayBuffer());
      const ready = buildLinuxNativeGuiPackage(runtimeBytes, nativeGui, { name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources });
      downloadBytes(ready.bytes, ready.filename, 'application/zip');
      output.textContent = `Native Linux app built ✓\n\nTarget: Linux\nType: ${kindLabel}\nPreflight: ${preflightText}.\n\nDownloaded: ${ready.filename}\nNo GitHub token, cloud build, Electron, Chromium, Node.js, patch-app.json or sidecar Patch runtime is required. Patch Studio compiled the GUI to Native GUI IR 1.4 in this browser and sealed payload v14 into a native GTK3 runtime v1.5.\n\nUnzip the package and run ${ready.executable}. The ZIP preserves the executable bit. Native Slider uses GtkScale; the target Linux system needs a compatible GTK3 runtime and its normal system libraries. Choose “Native AOT app” if you specifically want project-specific g++ machine-code generation in GitHub Actions.`;
      status.textContent = `Linux native GTK runtime v1.5 app downloaded · no token · no Electron`;
      return;
    }

    if (nativeBuildMode.value === 'prebuilt' && platform === 'macos' && kind === 'window') {
      setBusy(true, 'Building native macOS AppKit app in this browser…');
      output.textContent = `macOS native AppKit build\n\nPreflight passed: ${preflightText}.\nLoading the native AppKit runtime template…`;
      const response = await fetch(MACOS_NATIVE_GUI_RUNTIME, { cache: 'no-store' });
      if (!response.ok) throw new Error(`The native macOS AppKit runtime template is not available yet (${response.status}).`);
      const runtimeBytes = new Uint8Array(await response.arrayBuffer());
      const ready = buildMacosNativeGuiPackage(runtimeBytes, nativeGui, { name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources });
      downloadBytes(ready.bytes, ready.filename, 'application/zip');
      output.textContent = `Native macOS app built ✓\n\nTarget: macOS\nType: ${kindLabel}\nPreflight: ${preflightText}.\n\nDownloaded: ${ready.filename}\nNo GitHub token, cloud build, Electron, Chromium, Node.js, patch-app.json or sidecar Patch runtime is required. Patch Studio compiled the GUI to Native GUI IR 1.4 in this browser, sealed payload v14 into native AppKit runtime v1.5, and packaged ${ready.bundle}. Native Slider uses NSSlider.\n\nImportant: this token-free app is unsigned because browser-side sealing changes the executable after the runtime template was built. macOS Gatekeeper may therefore require Control-click → Open on first launch. Choose “Native AOT app” for project-specific clang code generation; signing/notarization remains a separate packaging stage.`;
      status.textContent = `macOS native AppKit runtime v1.5 app downloaded · unsigned · no token · no Electron`;
      return;
    }

    if (nativeBuildMode.value === 'prebuilt' || nativeBuildMode.value === 'compat') {
      if (platform === 'freebsd') throw new Error('Ready-app downloads are currently available for Windows, macOS and Linux. For FreeBSD, choose the local or cloud build mode.');
      if (nativeBuildMode.value === 'compat' && kind !== 'window') throw new Error('Compatibility packaging is only used for Window / GUI projects.');
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
        ? buildPrebuiltCompiledWindowPackage(templateBytes, { platform, name, compiledWindow, source: code.value })
        : buildPrebuiltNativePackage(templateBytes, { platform, kind, name, wasm: directWasm?.module ?? null });
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

    if (kind === 'window' && code.value.includes('patch-resource:')) {
      throw new Error('Native AOT/cloud build does not transport Studio project resources yet. Choose the recommended no-token native build for Windows, macOS or Linux when the project uses embedded Picture resources.');
    }

    const token = tokenInput.value.trim();
    if (!token) {
      const nativeHint = platform === 'windows' && kind === 'window'
        ? 'Native AOT EXE uses GitHub Actions and therefore needs a fine-grained GitHub token with Actions read/write access. Choose “Native single EXE (no token, recommended)” to build directly in Patch Studio without credentials.'
        : platform === 'linux' && kind === 'window'
          ? 'Native Linux AOT uses GitHub Actions and therefore needs a fine-grained GitHub token with Actions read/write access. Choose “Native GTK app (no token, recommended)” to build directly in Patch Studio without credentials.'
          : platform === 'macos' && kind === 'window'
            ? 'Native macOS AOT uses GitHub Actions and therefore needs a fine-grained GitHub token with Actions read/write access. Choose “Native AppKit app (no token, unsigned)” to build directly in Patch Studio without credentials.'
            : 'Cloud build mode needs a fine-grained GitHub token with Actions read/write access. The token is not saved.';
      throw new Error(nativeHint);
    }
    const sourceBase64 = utf8Base64(code.value);
    if (sourceBase64.length > 60000) throw new Error('This source is too large for the GitHub Actions dispatch channel. Use the local build path.');

    const workflow = workflowFor(platform, kind);
    const directWin32 = platform === 'windows' && kind === 'window';
    const directNativeWindow = kind === 'window' && ['windows', 'macos', 'linux'].includes(platform);
    cloudSnapshot = { token, sourceBase64, name, kind, platform, kindLabel, preflightText, workflow, directWin32, directNativeWindow };
    lastCloudBuildSnapshot = cloudSnapshot;
    await runCloudBuild(cloudSnapshot);
  } catch (error) {
    output.textContent = `Native build stopped:\n${formatNativeStop(error)}`;
    status.textContent = error?.name === 'PatchBuildCancelledError'
      ? 'Cloud build cancelled'
      : error?.name === 'PatchBuildTimeoutError'
        ? 'Cloud build timed out'
        : 'Native build stopped';
    if (cloudSnapshot || (nativeBuildMode.value === 'cloud' && lastCloudBuildSnapshot)) showRetryControl();
  } finally {
    activeCloudBuild = null;
    cloudControls.cancel.hidden = true;
    cloudControls.cancel.disabled = false;
    setBusy(false);
  }
}, true);

function installNativeModeControls() {
  const label = document.createElement('label');
  label.append('Native build ');
  const select = document.createElement('select');
  select.id = 'nativeBuildMode';
  select.setAttribute('aria-label', 'Native build mode');
  select.innerHTML = '<option value="prebuilt">Ready app download (no token)</option><option value="cloud">GitHub Actions cloud build (advanced)</option><option value="local">Local toolchain kit (advanced)</option><option value="compat" hidden>Compatibility package (Electron, no token)</option>';
  label.append(select);
  panel.insertBefore(label, tokenLabel);
  tokenLabel.firstChild.textContent = 'GitHub token (AOT/cloud only) ';
  tokenInput.placeholder = 'AOT/cloud-build token';
  return select;
}

function installCloudBuildControls() {
  const group = document.createElement('span');
  group.className = 'native-build-actions';
  group.setAttribute('aria-label', 'Cloud build actions');
  const cancel = document.createElement('button');
  cancel.id = 'cancelNativeBuild';
  cancel.type = 'button';
  cancel.className = 'secondary small';
  cancel.textContent = 'Cancel';
  cancel.hidden = true;
  const retry = document.createElement('button');
  retry.id = 'retryNativeBuild';
  retry.type = 'button';
  retry.className = 'secondary small';
  retry.textContent = 'Retry';
  retry.hidden = true;
  group.append(cancel, retry);
  panel.insertBefore(group, status);
  return { group, cancel, retry };
}

function refreshNativePanel() {
  const platform = nativeTargets.get(buildTarget.value);
  const kind = projectKind.value === 'window' ? 'window' : 'console';
  panel.hidden = !platform;
  const profile = `${platform ?? 'none'}:${kind}`;
  if (profile !== nativeBuildProfile) {
    nativeBuildProfile = profile;
    if (['windows', 'macos', 'linux'].includes(platform) && kind === 'window') nativeBuildMode.value = 'prebuilt';
  }
  updateNativeModeLabels(platform, kind);
  tokenLabel.hidden = nativeBuildMode.value !== 'cloud';
  cloudControls.group.hidden = nativeBuildMode.value !== 'cloud';
  if (!platform || buildButton.disabled) return;
  const kindLabel = kind === 'window' ? 'Window / GUI' : 'Console';
  if (platform === 'freebsd' && kind === 'window') {
    status.textContent = 'FreeBSD currently supports Console builds only.';
  } else if (platform === 'windows' && kind === 'window' && nativeBuildMode.value === 'prebuilt') {
    status.textContent = 'Recommended: native Win32 single EXE with no token. Studio compiles Native GUI IR 1.4 in your browser and seals payload v14 into runtime v1.5, including TreeView and Slider.';
  } else if (platform === 'linux' && kind === 'window' && nativeBuildMode.value === 'prebuilt') {
    status.textContent = 'Recommended: native GTK3 application with no token. Studio compiles Native GUI IR 1.4 in your browser and seals payload v14 into runtime v1.5, including TreeView and Slider.';
  } else if (platform === 'macos' && kind === 'window' && nativeBuildMode.value === 'prebuilt') {
    status.textContent = 'Recommended: native AppKit application with no token. Studio seals Native GUI IR 1.4 / payload v14 into runtime v1.5, including TreeView and Slider, and creates an unsigned .app ZIP. Gatekeeper may require Control-click → Open on first launch.';
  } else if (platform === 'windows' && kind === 'window' && nativeBuildMode.value === 'cloud') {
    status.textContent = 'Optional AOT build: GitHub Actions runs MSVC and returns an artifact ZIP containing only your project-specific .exe. A token is needed only for this Actions route.';
  } else if ((platform === 'macos' || platform === 'linux') && kind === 'window' && nativeBuildMode.value === 'cloud') {
    status.textContent = `Native ${platformLabel(platform)} AOT: GitHub Actions runs the direct ${platform === 'macos' ? 'AppKit' : 'GTK3'} backend and returns the native app with Electron/Chromium excluded.`;
  } else if (nativeBuildMode.value === 'compat') {
    status.textContent = `Compatibility only: this ${platformLabel(platform)} GUI path uses the Electron runtime instead of the direct native GUI runtime.`;
  } else if (nativeBuildMode.value === 'prebuilt') {
    status.textContent = platform === 'freebsd'
      ? 'Ready-app downloads are not available for FreeBSD yet; choose local or cloud mode.'
      : kind === 'console'
        ? `${platformLabel(platform)} Console: click Build for a sealed project-specific executable. No token or local toolchain.`
        : `${platformLabel(platform)} Window / GUI compatibility package: compiled Patch payload inside the Electron desktop runtime.`;
  } else if (nativeBuildMode.value === 'local') {
    status.textContent = kind === 'window'
      ? `${platformLabel(platform)} ${kindLabel}: legacy local compatibility kit. Use patch-app locally for the direct native backend.`
      : `${platformLabel(platform)} ${kindLabel}: advanced local toolchain kit.`;
  } else {
    status.textContent = kind === 'window'
      ? `${platformLabel(platform)} ${kindLabel}: direct native AOT cloud build.`
      : `${platformLabel(platform)} ${kindLabel}: advanced GitHub Actions build. Token is never saved.`;
  }
}

function updateNativeModeLabels(platform, kind) {
  const prebuilt = nativeBuildMode.querySelector('option[value="prebuilt"]');
  const cloud = nativeBuildMode.querySelector('option[value="cloud"]');
  const local = nativeBuildMode.querySelector('option[value="local"]');
  const compat = nativeBuildMode.querySelector('option[value="compat"]');
  compat.hidden = !(kind === 'window' && ['windows', 'macos', 'linux'].includes(platform));
  if (platform === 'windows' && kind === 'window') {
    prebuilt.textContent = 'Native single EXE (no token, recommended)';
    cloud.textContent = 'Native AOT EXE (GitHub Actions)';
    local.textContent = 'Local compatibility kit (advanced)';
    compat.textContent = 'Compatibility package (Electron, no token)';
    return;
  }
  if (platform === 'linux' && kind === 'window') {
    prebuilt.textContent = 'Native GTK app (no token, recommended)';
    cloud.textContent = 'Native AOT app (GitHub Actions)';
    local.textContent = 'Local compatibility kit (advanced)';
    compat.textContent = 'Compatibility package (Electron, no token)';
    return;
  }
  if (platform === 'macos' && kind === 'window') {
    prebuilt.textContent = 'Native AppKit app (no token, unsigned)';
    cloud.textContent = 'Native AOT app (GitHub Actions)';
    local.textContent = 'Local compatibility kit (advanced)';
    compat.textContent = 'Compatibility package (Electron, no token)';
    return;
  }
  if (kind === 'window') {
    prebuilt.textContent = 'Compatibility package (Electron, no token)';
    cloud.textContent = 'Native AOT app (GitHub Actions)';
    local.textContent = 'Local compatibility kit (advanced)';
    return;
  }
  prebuilt.textContent = 'Ready app download (no token)';
  cloud.textContent = 'GitHub Actions cloud build (advanced)';
  local.textContent = 'Local toolchain kit (advanced)';
}

async function runCloudBuild(snapshot) {
  if (activeCloudBuild) throw new Error('A cloud build is already active.');
  const requestId = makeRequestId();
  const nativeWindowLabel = snapshot.directWin32
    ? 'Windows native AOT single-EXE'
    : snapshot.directNativeWindow
      ? `${platformLabel(snapshot.platform)} native AOT Window`
      : `${platformLabel(snapshot.platform)} ${snapshot.kindLabel} cloud`;
  const state = {
    requestId,
    token: snapshot.token,
    runId: null,
    runUrl: null,
    cancelRequested: false,
    cancelSent: false,
    deadline: Date.now() + CLOUD_BUILD_TIMEOUT_MS
  };
  activeCloudBuild = state;
  cloudControls.group.hidden = false;
  cloudControls.cancel.hidden = false;
  cloudControls.cancel.disabled = false;
  cloudControls.retry.hidden = true;
  setBusy(true, snapshot.directNativeWindow ? `Starting native ${platformLabel(snapshot.platform)} AOT build…` : `Starting ${platformLabel(snapshot.platform)} ${snapshot.kindLabel} cloud build…`);
  output.textContent = `${nativeWindowLabel} build\n\nPreflight passed: ${snapshot.preflightText}.\nSubmitting the captured project snapshot to GitHub Actions…\nTimeout: ${Math.round(CLOUD_BUILD_TIMEOUT_MS / 60000)} minutes.`;

  const inputs = snapshot.directNativeWindow
    ? { source_b64: snapshot.sourceBase64, source_path: '', app_name: snapshot.name, request_id: requestId }
    : { source_b64: snapshot.sourceBase64, source_path: '', app_name: snapshot.name, kind: snapshot.kind, request_id: requestId };
  if (!snapshot.directWin32 && snapshot.platform !== 'freebsd') inputs.platform = snapshot.platform;
  await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${snapshot.workflow}/dispatches`, snapshot.token, {
    method: 'POST', body: JSON.stringify({ ref: 'main', inputs })
  });

  const run = await waitForRun(snapshot, state);
  if (run.conclusion !== 'success') throw new Error(`GitHub build finished with '${run.conclusion}'. Open ${run.html_url} for the build log.`);
  status.textContent = 'Cloud build complete. Preparing download…';
  const artifacts = await apiJson(`${API}/repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`, snapshot.token);
  const expectedName = snapshot.directWin32 ? 'patch-windows-single-exe' : `patch-${snapshot.platform}-${requestId}`;
  const artifact = (artifacts.artifacts ?? []).find(item => item.name === expectedName && !item.expired);
  if (!artifact) throw new Error(`The build succeeded but artifact '${expectedName}' was not found.`);
  const downloadName = snapshot.directWin32
    ? `${snapshot.name}-windows-aot-single-exe.zip`
    : `${snapshot.name}-${snapshot.platform}-${snapshot.kind}-build.zip`;
  await downloadArtifact(artifact, snapshot.token, downloadName);
  output.textContent = `Built ${snapshot.name} for ${platformLabel(snapshot.platform)} ✓\n\nType: ${snapshot.kindLabel}\n${artifactDescription(snapshot.platform, snapshot.kind, snapshot.name)}\n\nRequest: ${requestId}\nBuild run: ${run.html_url}`;
  status.textContent = snapshot.directWin32
    ? `Windows native AOT EXE downloaded · artifact ZIP contains only ${snapshot.name}.exe`
    : snapshot.directNativeWindow
      ? `${platformLabel(snapshot.platform)} native AOT Window build downloaded · no Electron`
      : `${platformLabel(snapshot.platform)} ${snapshot.kindLabel} cloud build downloaded`;
  cloudControls.retry.hidden = true;
}

async function waitForRun(snapshot, state) {
  let seen = null;
  while (Date.now() < state.deadline) {
    const data = await apiJson(`${API}/repos/${REPOSITORY}/actions/workflows/${snapshot.workflow}/runs?event=workflow_dispatch&per_page=30`, snapshot.token);
    const run = (data.workflow_runs ?? []).find(item => String(item.display_title ?? item.name ?? '').includes(state.requestId));
    if (run) {
      seen = run;
      state.runId = run.id;
      state.runUrl = run.html_url;
      if (state.cancelRequested) {
        await cancelCloudRun(state);
        throw cancelledBuildError(run.html_url);
      }
      const runState = run.status === 'completed' ? run.conclusion : run.status;
      status.textContent = `${platformLabel(snapshot.platform)} ${snapshot.kindLabel} cloud build: ${runState}…`;
      output.textContent = `${platformLabel(snapshot.platform)} ${snapshot.kindLabel} cloud build\n\nRequest: ${state.requestId}\nGitHub Actions run: ${runState}\n${run.html_url}\n\nCancel remains available until the run completes.`;
      if (run.status === 'completed') return run;
    } else if (state.cancelRequested) {
      status.textContent = 'Cancellation requested. Waiting for GitHub to expose the dispatched run…';
    }
    await sleep(CLOUD_BUILD_POLL_MS);
  }

  if (seen && seen.status !== 'completed') await cancelCloudRun(state).catch(() => {});
  const error = new Error(seen
    ? `Cloud build exceeded the ${Math.round(CLOUD_BUILD_TIMEOUT_MS / 60000)} minute Studio timeout. Patch Studio requested cancellation. Open ${seen.html_url} for final GitHub status.`
    : `Patch Studio could not find the dispatched build run within ${Math.round(CLOUD_BUILD_TIMEOUT_MS / 60000)} minutes.`);
  error.name = 'PatchBuildTimeoutError';
  throw error;
}

async function cancelActiveCloudBuild() {
  const state = activeCloudBuild;
  if (!state || state.cancelRequested) return;
  state.cancelRequested = true;
  cloudControls.cancel.disabled = true;
  status.textContent = state.runId ? 'Cancelling GitHub Actions run…' : 'Cancellation requested…';
  if (state.runId) {
    try {
      await cancelCloudRun(state);
      status.textContent = 'Cancellation sent to GitHub Actions…';
    } catch (error) {
      status.textContent = `Cancellation requested; GitHub replied: ${error?.message ?? String(error)}`;
    }
  }
}

async function cancelCloudRun(state) {
  if (!state?.runId || state.cancelSent) return;
  state.cancelSent = true;
  try {
    const response = await fetch(`${API}/repos/${REPOSITORY}/actions/runs/${state.runId}/cancel`, {
      method: 'POST',
      headers: githubHeaders(state.token)
    });
    if (response.status === 202 || response.status === 204 || response.status === 409) return;
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).message ?? ''; } catch { detail = await response.text(); }
      throw new Error(`GitHub cancel API ${response.status}: ${detail || response.statusText}`);
    }
  } catch (error) {
    state.cancelSent = false;
    throw error;
  }
}

async function retryLastCloudBuild() {
  const snapshot = lastCloudBuildSnapshot;
  if (!snapshot || activeCloudBuild) return;
  showOutput();
  cloudControls.retry.hidden = true;
  try {
    await runCloudBuild(snapshot);
  } catch (error) {
    output.textContent = `Native build stopped:\n${formatNativeStop(error)}`;
    status.textContent = error?.name === 'PatchBuildCancelledError'
      ? 'Cloud build cancelled'
      : error?.name === 'PatchBuildTimeoutError'
        ? 'Cloud build timed out'
        : 'Native build stopped';
    showRetryControl();
  } finally {
    activeCloudBuild = null;
    cloudControls.cancel.hidden = true;
    cloudControls.cancel.disabled = false;
    setBusy(false);
  }
}

function showRetryControl() {
  if (!lastCloudBuildSnapshot || nativeBuildMode.value !== 'cloud') return;
  cloudControls.group.hidden = false;
  cloudControls.retry.hidden = false;
}

function cancelledBuildError(url = '') {
  const error = new Error(`Cloud build cancelled by user.${url ? ` GitHub run: ${url}` : ''}`);
  error.name = 'PatchBuildCancelledError';
  return error;
}

async function apiJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...githubHeaders(token), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers ?? {}) }
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

function githubHeaders(token) {
  return { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
}

async function downloadArtifact(artifact, token, filename) {
  const response = await fetch(artifact.archive_download_url, { headers: githubHeaders(token) });
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
function setBusy(busy, message = null) {
  buildButton.disabled = busy;
  nativeBuildMode.disabled = busy;
  if (message) status.textContent = message;
  if (!busy) refreshNativePanel();
}
function workflowFor(platform, kind) {
  if (platform === 'windows' && kind === 'window') return WINDOWS_SINGLE_EXE_WORKFLOW;
  if ((platform === 'macos' || platform === 'linux') && kind === 'window') return NATIVE_WINDOW_AOT_WORKFLOW;
  return platform === 'freebsd' ? FREEBSD_WORKFLOW : NATIVE_WORKFLOW;
}
function artifactDescription(platform, kind, name) {
  if (platform === 'freebsd') return 'FreeBSD native Console package';
  if (platform === 'windows' && kind === 'window') return `Direct Win32/MSVC AOT GUI build. The GitHub artifact ZIP contains exactly one file: ${name}.exe. No patch-app.json, Electron, Chromium or Node runtime is shipped.`;
  if (platform === 'macos' && kind === 'window') return `Direct AppKit AOT GUI build. The artifact contains the project-specific ${name}.app bundle built with clang/Cocoa. No Electron or Chromium runtime is shipped.`;
  if (platform === 'linux' && kind === 'window') return `Direct GTK3 AOT GUI build. The artifact contains the project-specific native ELF executable and build metadata. No Electron, Chromium, Node runtime or patch-app.json is shipped; a compatible GTK3 runtime is required on the target Linux system.`;
  return `${platformLabel(platform)} native Console package`;
}
function readyPackageNote(kind, platform) {
  if (kind === 'console') return 'Studio compiled this Console project to direct Wasm and sealed that checked payload inside a project-specific executable. The platform runtime machine code is prebuilt; this is sealed native packaging, not a claim of direct Patch-to-x86/ARM AOT compilation.';
  const nativeAlternative = platform === 'windows'
    ? 'For Windows, choose “Native single EXE (no token, recommended)” for the native sealed-runtime build, “Native AOT EXE” for project-specific MSVC codegen, or use patch-app locally.'
    : platform === 'linux'
      ? 'For Linux, choose “Native GTK app (no token, recommended)” for the native sealed-runtime build or “Native AOT app” for project-specific g++ code generation.'
      : 'For macOS, choose “Native AppKit app (no token, unsigned)” for the native sealed-runtime build or “Native AOT app” for project-specific clang code generation.';
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
