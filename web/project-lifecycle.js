import {
  PATCH_STUDIO_MAX_PROJECT_BYTES,
  addRecoverySnapshot,
  buildStudioProjectBundle,
  composeStudioProjectSource,
  parseRecoverySnapshots,
  parseStoredStudioProject,
  parseStudioProjectBundle,
  serializeRecoverySnapshots,
  serializeStudioProjectBundle,
  studioStateFromBundle,
  validateStudioProjectBundle
} from '../src/studio-project.js';
import { patchArtifactFilename, patchArtifactStem } from '../src/artifact-name.js';

const CURRENT_KEY = 'patchStudio.project.v3';
const PENDING_KEY = 'patchStudio.project.pending.v3';
const V2_CURRENT_KEY = 'patchStudio.project.v2';
const V2_PENDING_KEY = 'patchStudio.project.pending.v2';
const V1_CURRENT_KEY = 'patchStudio.project.v1';
const V1_PENDING_KEY = 'patchStudio.project.pending.v1';
const RECOVERY_KEY = 'patchStudio.recovery.v1';
const CORRUPT_KEY = 'patchStudio.project.corrupt.v3';
const LEGACY_KEY = 'patchStudio.project';
const RECOVERY_INTERVAL_MS = 60_000;
const MAX_IMPORT_BYTES = PATCH_STUDIO_MAX_PROJECT_BYTES + 1024 * 1024;
const encoder = new TextEncoder();

installStylesheet();

const code = document.querySelector('#code');
const editorTitle = document.querySelector('#editorTitle');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const buildTarget = document.querySelector('#buildTarget');
const nativeBuildMode = document.querySelector('#nativeBuildMode');
const saveState = document.querySelector('#saveState');
const exportButton = document.querySelector('#exportProject');
const importButton = document.querySelector('#importProject');
const recoverButton = document.querySelector('#recoverProject');
const importFile = document.querySelector('#importProjectFile');
let lastRecoveryAt = Date.now();
let applyingBundle = false;
let currentBundle = null;
let activeFilePath = 'main.patch';

bootstrapProjectStorage();
installProjectActions();
updateRecoveryControl();

function bootstrapProjectStorage() {
  try {
    const warnings = [];
    const pendingKeys = [PENDING_KEY, V2_PENDING_KEY, V1_PENDING_KEY];
    for (const key of pendingKeys) {
      const pending = readBundleAttempt(key);
      if (pending.bundle) {
        adoptCanonicalBundle(pending.bundle);
        removeMigrationStores();
        writeLegacyCompatibility(pending.bundle);
        setStatus(key === PENDING_KEY ? 'Recovered interrupted local save' : 'Migrated interrupted Studio save to v3');
        return;
      }
      if (pending.error) {
        quarantineCorruptStore(key, pending.raw);
        warnings.push(`Pending save '${key}' was invalid: ${pending.error.message}`);
      }
    }

    const currentKeys = [CURRENT_KEY, V2_CURRENT_KEY, V1_CURRENT_KEY];
    for (const key of currentKeys) {
      const current = readBundleAttempt(key);
      if (current.bundle) {
        adoptCanonicalBundle(current.bundle);
        removeMigrationStores();
        writeLegacyCompatibility(current.bundle);
        if (key !== CURRENT_KEY) setStatus('Migrated Studio project to v3');
        else if (warnings.length) setStatus('Saved project restored', warnings.join(' '));
        return;
      }
      if (current.error) {
        quarantineCorruptStore(key, current.raw);
        warnings.push(`Canonical project '${key}' was invalid: ${current.error.message}`);
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      try {
        const migrated = parseStoredStudioProject(legacyRaw);
        if (migrated) {
          adoptCanonicalBundle(migrated);
          writeLegacyCompatibility(migrated);
          setStatus(warnings.length ? 'Recovered legacy local project' : 'Migrated local project to v3', warnings.join(' '));
          return;
        }
      } catch (error) {
        warnings.push(`Legacy project was invalid: ${error.message}`);
      }
    }

    if (warnings.length) setStatus('Stored project needs recovery', warnings.join(' '));
  } catch (error) {
    setStatus('Local project storage unavailable', error?.message);
  }
}

function installProjectActions() {
  exportButton?.addEventListener('click', exportProject);
  importButton?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', importProjectFile);
  recoverButton?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('patch:open-recovery-manager'));
  });

  for (const input of [code, projectName, projectKind, buildTarget, nativeBuildMode]) {
    input?.addEventListener('input', () => {
      if (!applyingBundle) persistDomProject({ snapshot: 'interval' });
    });
    input?.addEventListener('change', () => {
      if (!applyingBundle) persistDomProject({ snapshot: 'interval' });
    });
  }
}

export function getStudioProjectEditorState() {
  if (!currentBundle) return null;
  const bundle = syncBundleFromDom({ allowEmptyDom: true });
  const state = studioStateFromBundle(bundle);
  const file = state.files.find(item => item.path === activeFilePath) ?? state.files.find(item => item.path === state.entry);
  return { ...state, activeFile: file?.path ?? state.entry, code: file?.content ?? '' };
}

export function getStudioProjectBundle() {
  if (!currentBundle && code && code.value === '' && !projectName?.value) return null;
  return syncBundleFromDom();
}

export function getStudioProjectBuildInput() {
  const bundle = syncBundleFromDom();
  return { bundle, composition: composeStudioProjectSource(bundle) };
}

export function getStudioProjectDiagnosticContext() {
  try {
    const { bundle, composition } = getStudioProjectBuildInput();
    return {
      source: composition.source,
      entry: composition.entry,
      composition,
      kind: bundle.project.kind
    };
  } catch {
    return {
      source: String(code?.value ?? ''),
      entry: 'main.patch',
      composition: null,
      kind: projectKind?.value === 'window' ? 'window' : 'console'
    };
  }
}

export function getStudioProjectFiles() {
  const bundle = syncBundleFromDom();
  return bundle.files.map(file => ({ ...file }));
}

export function getActiveStudioProjectFile() {
  return activeFilePath;
}

export function persistStudioProjectFromDom(options = {}) {
  persistDomProject(options);
  return currentBundle;
}

export function activateStudioProjectFile(path) {
  const bundle = syncBundleFromDom();
  const file = bundle.files.find(item => item.path === path);
  if (!file) throw new Error(`Project file '${path}' is no longer available.`);
  activeFilePath = file.path;
  setEditorSource(file.content, file.path);
  dispatchProjectEvent('patch:studio-active-file-changed');
  return file.path;
}

export function addStudioProjectFile(path, content = '') {
  const bundle = syncBundleFromDom();
  if (bundle.files.some(file => file.path === path)) throw new Error(`Project file '${path}' already exists.`);
  const next = buildStudioProjectBundle({
    name: bundle.project.name,
    kind: bundle.project.kind,
    entry: bundle.project.entry,
    files: [...bundle.files, { path, content }],
    buildTarget: bundle.project.build.target,
    nativeBuildMode: bundle.project.build.nativeMode
  });
  persistBundle(next, { snapshot: 'force' });
  activeFilePath = path;
  setEditorSource(content, path);
  setStatus(`Added ${path}`);
  dispatchProjectEvent('patch:studio-project-files-changed');
  return next;
}

export function removeStudioProjectFile(path) {
  const bundle = syncBundleFromDom();
  if (path === bundle.project.entry) throw new Error(`The entry file '${path}' cannot be removed.`);
  if (!bundle.files.some(file => file.path === path)) throw new Error(`Project file '${path}' is no longer available.`);
  const next = buildStudioProjectBundle({
    name: bundle.project.name,
    kind: bundle.project.kind,
    entry: bundle.project.entry,
    files: bundle.files.filter(file => file.path !== path),
    buildTarget: bundle.project.build.target,
    nativeBuildMode: bundle.project.build.nativeMode
  });
  persistBundle(next, { snapshot: 'force' });
  if (activeFilePath === path) activeFilePath = next.project.entry;
  const active = next.files.find(file => file.path === activeFilePath) ?? next.files[0];
  setEditorSource(active.content, active.path);
  setStatus(`Removed ${path}`);
  dispatchProjectEvent('patch:studio-project-files-changed');
  return next;
}

export function replaceStudioProjectSource(source, options = {}) {
  const name = options.name ?? projectName?.value ?? currentBundle?.project.name ?? 'PatchApp';
  const kind = options.kind ?? projectKind?.value ?? currentBundle?.project.kind ?? 'console';
  const next = buildStudioProjectBundle({
    name,
    kind,
    entry: 'main.patch',
    files: [{ path: 'main.patch', content: String(source ?? '') }],
    buildTarget: buildTarget?.value ?? currentBundle?.project.build.target ?? 'web',
    nativeBuildMode: nativeBuildMode?.value ?? currentBundle?.project.build.nativeMode ?? 'prebuilt'
  });
  activeFilePath = 'main.patch';
  applyBundleToDom(next, { emitSourceEvents: false });
  persistBundle(next, { snapshot: options.snapshot ?? 'force' });
  dispatchProjectEvent('patch:studio-project-files-changed');
  return next;
}

function exportProject() {
  try {
    const bundle = syncBundleFromDom();
    persistBundle(bundle, { snapshot: 'interval' });
    const filename = patchArtifactFilename(bundle.project.name, 'project');
    download(filename, serializeStudioProjectBundle(bundle), 'application/json');
    setStatus(`Exported ${filename}`);
  } catch (error) {
    setStatus('Export stopped', error?.message);
  }
}

async function importProjectFile() {
  const file = importFile?.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error(`Project file is too large. Maximum import size is ${MAX_IMPORT_BYTES} bytes.`);
    const bundle = parseStudioProjectBundle(await file.text());
    protectCurrentProject();
    activeFilePath = bundle.project.entry;
    applyBundleToDom(bundle);
    persistBundle(bundle, { snapshot: 'none' });
    setStatus(`Imported ${file.name}`);
    dispatchProjectEvent('patch:studio-project-files-changed');
  } catch (error) {
    setStatus('Import stopped', error?.message);
  } finally {
    importFile.value = '';
  }
}

export function getRecoverySnapshotSummaries() {
  return readRecoverySnapshots().map((snapshot, index) => {
    const state = studioStateFromBundle(snapshot.project);
    return {
      index,
      savedAt: snapshot.savedAt,
      name: state.name,
      kind: state.kind,
      buildTarget: state.buildTarget,
      fileCount: state.files.length,
      sourceBytes: state.files.reduce((sum, file) => sum + encoder.encode(file.content).length, 0)
    };
  });
}

export function createManualRecoverySnapshot() {
  appendRecovery(syncBundleFromDom());
  lastRecoveryAt = Date.now();
  setStatus('Recovery snapshot saved');
  return getRecoverySnapshotSummaries();
}

export function restoreRecoverySnapshot(index) {
  const snapshots = readRecoverySnapshots();
  const selected = recoveryAt(snapshots, index);
  const when = formatTime(selected.savedAt);
  protectCurrentProject();
  activeFilePath = selected.project.project.entry;
  applyBundleToDom(selected.project);
  persistBundle(selected.project, { snapshot: 'none' });
  setStatus(`Recovered snapshot from ${when}`);
  dispatchProjectEvent('patch:studio-project-files-changed');
  return getRecoverySnapshotSummaries();
}

export function exportRecoverySnapshot(index) {
  const selected = recoveryAt(readRecoverySnapshots(), index);
  const state = studioStateFromBundle(selected.project);
  const stamp = selected.savedAt.replace(/[:.]/g, '-');
  const filename = `${patchArtifactStem(state.name)}-recovery-${stamp}.patchproject`;
  download(filename, serializeStudioProjectBundle(selected.project), 'application/json');
  setStatus(`Exported ${filename}`);
  return filename;
}

export function deleteRecoverySnapshot(index) {
  const snapshots = readRecoverySnapshots();
  const selected = recoveryAt(snapshots, index);
  snapshots.splice(selected.index, 1);
  writeRecoverySnapshots(snapshots);
  setStatus(`Deleted recovery snapshot from ${formatTime(selected.snapshot.savedAt)}`);
  return getRecoverySnapshotSummaries();
}

export function clearRecoverySnapshots() {
  localStorage.removeItem(RECOVERY_KEY);
  updateRecoveryControl([]);
  setStatus('Recovery snapshots cleared');
  return [];
}

function protectCurrentProject() {
  if (!currentBundle && !code) return;
  appendRecovery(syncBundleFromDom());
  lastRecoveryAt = Date.now();
}

function applyBundleToDom(bundle, options = {}) {
  const normalized = validateStudioProjectBundle(bundle);
  currentBundle = normalized;
  if (!normalized.files.some(file => file.path === activeFilePath)) activeFilePath = normalized.project.entry;
  const state = studioStateFromBundle(normalized);
  const active = state.files.find(file => file.path === activeFilePath) ?? state.files.find(file => file.path === state.entry);
  applyingBundle = true;
  try {
    if (projectName) projectName.value = state.name;
    if (projectKind) projectKind.value = state.kind;
    setEditorSource(active?.content ?? '', active?.path ?? state.entry);
    if (buildTarget) buildTarget.value = state.buildTarget;
    if (nativeBuildMode) nativeBuildMode.value = state.nativeBuildMode;
    buildTarget?.dispatchEvent(new Event('change', { bubbles: true }));
    nativeBuildMode?.dispatchEvent(new Event('change', { bubbles: true }));
    if (options.emitSourceEvents !== false) {
      code?.dispatchEvent(new Event('input', { bubbles: true }));
      code?.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } finally {
    applyingBundle = false;
  }
}

function setEditorSource(source, path) {
  applyingBundle = true;
  try {
    if (code) code.value = source;
    if (editorTitle) editorTitle.textContent = path;
  } finally {
    applyingBundle = false;
  }
}

function persistDomProject(options = {}) {
  try {
    persistBundle(syncBundleFromDom(), options);
  } catch (error) {
    setStatus('Local save unavailable', error?.message);
  }
}

function syncBundleFromDom(options = {}) {
  const base = currentBundle;
  if (!base) {
    if (options.allowEmptyDom && !code) return null;
    const created = buildStudioProjectBundle({
      name: projectName?.value ?? 'PatchApp',
      kind: projectKind?.value ?? 'console',
      code: code?.value ?? '',
      buildTarget: buildTarget?.value ?? 'web',
      nativeBuildMode: nativeBuildMode?.value ?? 'prebuilt'
    });
    currentBundle = created;
    activeFilePath = created.project.entry;
    return created;
  }

  const files = base.files.map(file => file.path === activeFilePath
    ? { ...file, content: code?.value ?? file.content }
    : { ...file });
  const next = buildStudioProjectBundle({
    name: projectName?.value ?? base.project.name,
    kind: projectKind?.value ?? base.project.kind,
    entry: base.project.entry,
    files,
    buildTarget: buildTarget?.value ?? base.project.build.target,
    nativeBuildMode: nativeBuildMode?.value ?? base.project.build.nativeMode
  });
  currentBundle = next;
  return next;
}

function persistBundle(bundle, options = {}) {
  const normalized = parseStudioProjectBundle(serializeStudioProjectBundle(bundle));
  const previousAttempt = readBundleAttempt(CURRENT_KEY);
  if (previousAttempt.error) quarantineCorruptStore(CURRENT_KEY, previousAttempt.raw);
  const previous = previousAttempt.bundle;
  const mode = options.snapshot ?? 'interval';
  if (previous && !sameBundle(previous, normalized)) {
    const due = Date.now() - lastRecoveryAt >= RECOVERY_INTERVAL_MS;
    if (mode === 'force' || (mode === 'interval' && due)) {
      appendRecovery(previous);
      lastRecoveryAt = Date.now();
    }
  }

  currentBundle = normalized;
  if (!currentBundle.files.some(file => file.path === activeFilePath)) activeFilePath = currentBundle.project.entry;
  const serialized = serializeStudioProjectBundle(normalized);
  localStorage.setItem(PENDING_KEY, serialized);
  localStorage.setItem(CURRENT_KEY, serialized);
  writeLegacyCompatibility(normalized);
  localStorage.removeItem(PENDING_KEY);
  removeMigrationStores();
  updateRecoveryControl();
}

function adoptCanonicalBundle(bundle) {
  currentBundle = validateStudioProjectBundle(bundle);
  activeFilePath = currentBundle.project.entry;
  localStorage.setItem(CURRENT_KEY, serializeStudioProjectBundle(currentBundle));
}

function removeMigrationStores() {
  for (const key of [V2_CURRENT_KEY, V2_PENDING_KEY, V1_CURRENT_KEY, V1_PENDING_KEY]) localStorage.removeItem(key);
}

function writeLegacyCompatibility(bundle) {
  const state = studioStateFromBundle(bundle);
  localStorage.setItem(LEGACY_KEY, JSON.stringify({
    name: state.name,
    kind: state.kind,
    code: state.code,
    buildTarget: state.buildTarget,
    nativeBuildMode: state.nativeBuildMode
  }));
}

function readBundleAttempt(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return { bundle: null, error: null, raw: null };
  try {
    return { bundle: parseStoredStudioProject(raw), error: null, raw };
  } catch (error) {
    return { bundle: null, error, raw };
  }
}

function quarantineCorruptStore(key, raw) {
  if (raw) {
    try {
      localStorage.setItem(CORRUPT_KEY, JSON.stringify({ key, capturedAt: new Date().toISOString(), raw }));
    } catch { /* best-effort preservation only */ }
  }
  localStorage.removeItem(key);
}

function appendRecovery(bundle) {
  const next = addRecoverySnapshot(readRecoverySnapshots(), bundle, new Date());
  writeRecoverySnapshots(next);
}

function readRecoverySnapshots() {
  return parseRecoverySnapshots(localStorage.getItem(RECOVERY_KEY));
}

function writeRecoverySnapshots(snapshots) {
  if (snapshots.length) localStorage.setItem(RECOVERY_KEY, serializeRecoverySnapshots(snapshots));
  else localStorage.removeItem(RECOVERY_KEY);
  updateRecoveryControl(snapshots);
}

function recoveryAt(snapshots, index) {
  const normalizedIndex = Number(index);
  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= snapshots.length) {
    throw new Error('Recovery snapshot selection is no longer available.');
  }
  return { index: normalizedIndex, snapshot: snapshots[normalizedIndex], ...snapshots[normalizedIndex] };
}

function updateRecoveryControl(known = null) {
  if (!recoverButton) return;
  let snapshots = known;
  if (!snapshots) {
    try { snapshots = readRecoverySnapshots(); } catch { snapshots = []; }
  }
  const count = snapshots.length;
  recoverButton.disabled = false;
  recoverButton.textContent = count ? `Recovery (${count})` : 'Recovery';
  recoverButton.title = count
    ? `${count} local recovery snapshot${count === 1 ? '' : 's'}. Open recovery manager.`
    : 'Open recovery manager and create a snapshot.';
  window.dispatchEvent(new CustomEvent('patch:recovery-changed', {
    detail: { count, latestSavedAt: snapshots[0]?.savedAt ?? null }
  }));
}

function dispatchProjectEvent(type) {
  const detail = currentBundle ? {
    entry: currentBundle.project.entry,
    activeFile: activeFilePath,
    files: currentBundle.files.map(file => file.path)
  } : { entry: 'main.patch', activeFile: 'main.patch', files: ['main.patch'] };
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

function sameBundle(a, b) {
  return serializeStudioProjectBundle(a) === serializeStudioProjectBundle(b);
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'unknown time';
}

function setStatus(text, detail = '') {
  if (!saveState) return;
  saveState.textContent = text;
  if (detail) saveState.title = detail;
  else saveState.removeAttribute('title');
}

function installStylesheet() {
  if (document.querySelector('link[data-patch-project-lifecycle]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './project-lifecycle.css';
  link.dataset.patchProjectLifecycle = '1';
  document.head.appendChild(link);
}

function download(filename, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
