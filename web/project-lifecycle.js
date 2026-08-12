import {
  PATCH_STUDIO_MAX_SOURCE_BYTES,
  addRecoverySnapshot,
  buildStudioProjectBundle,
  parseRecoverySnapshots,
  parseStoredStudioProject,
  parseStudioProjectBundle,
  serializeRecoverySnapshots,
  serializeStudioProjectBundle,
  studioStateFromBundle
} from '../src/studio-project.js';
import { patchArtifactFilename, patchArtifactStem } from '../src/artifact-name.js';

const CURRENT_KEY = 'patchStudio.project.v2';
const PENDING_KEY = 'patchStudio.project.pending.v2';
const LEGACY_CURRENT_KEY = 'patchStudio.project.v1';
const LEGACY_PENDING_KEY = 'patchStudio.project.pending.v1';
const RECOVERY_KEY = 'patchStudio.recovery.v1';
const CORRUPT_KEY = 'patchStudio.project.corrupt.v2';
const LEGACY_KEY = 'patchStudio.project';
const RECOVERY_INTERVAL_MS = 60_000;
const MAX_IMPORT_BYTES = PATCH_STUDIO_MAX_SOURCE_BYTES * 8;
const encoder = new TextEncoder();

installStylesheet();

const code = document.querySelector('#code');
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

bootstrapProjectStorage();
installProjectActions();
updateRecoveryControl();

function bootstrapProjectStorage() {
  try {
    const warnings = [];
    for (const key of [PENDING_KEY, LEGACY_PENDING_KEY]) {
      const pending = readBundleAttempt(key);
      if (pending.bundle) {
        writeCanonicalBundle(pending.bundle);
        localStorage.removeItem(key);
        if (key === LEGACY_PENDING_KEY) localStorage.removeItem(LEGACY_CURRENT_KEY);
        writeLegacyCompatibility(pending.bundle);
        setStatus(key === PENDING_KEY ? 'Recovered interrupted local save' : 'Migrated interrupted v1 save');
        return;
      }
      if (pending.error) {
        quarantineCorruptStore(key, pending.raw);
        warnings.push(`Pending save '${key}' was invalid: ${pending.error.message}`);
      }
    }

    for (const key of [CURRENT_KEY, LEGACY_CURRENT_KEY]) {
      const current = readBundleAttempt(key);
      if (current.bundle) {
        writeCanonicalBundle(current.bundle);
        if (key === LEGACY_CURRENT_KEY) localStorage.removeItem(LEGACY_CURRENT_KEY);
        writeLegacyCompatibility(current.bundle);
        if (key === LEGACY_CURRENT_KEY) setStatus('Migrated Studio project v1 to v2');
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
          writeCanonicalBundle(migrated);
          writeLegacyCompatibility(migrated);
          setStatus(warnings.length ? 'Recovered legacy local project' : 'Migrated local project', warnings.join(' '));
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

function exportProject() {
  try {
    const bundle = bundleFromDom();
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
    applyBundleToDom(bundle);
    persistBundle(bundle, { snapshot: 'none' });
    setStatus(`Imported ${file.name}`);
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
      sourceBytes: encoder.encode(state.code).length
    };
  });
}

export function createManualRecoverySnapshot() {
  appendRecovery(bundleFromDom());
  lastRecoveryAt = Date.now();
  setStatus('Recovery snapshot saved');
  return getRecoverySnapshotSummaries();
}

export function restoreRecoverySnapshot(index) {
  const snapshots = readRecoverySnapshots();
  const selected = recoveryAt(snapshots, index);
  const when = formatTime(selected.savedAt);
  protectCurrentProject();
  applyBundleToDom(selected.project);
  persistBundle(selected.project, { snapshot: 'none' });
  setStatus(`Recovered snapshot from ${when}`);
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
  appendRecovery(bundleFromDom());
  lastRecoveryAt = Date.now();
}

function applyBundleToDom(bundle) {
  const state = studioStateFromBundle(bundle);
  applyingBundle = true;
  try {
    projectName.value = state.name;
    projectKind.value = state.kind;
    code.value = state.code;
    if (buildTarget) buildTarget.value = state.buildTarget;
    if (nativeBuildMode) nativeBuildMode.value = state.nativeBuildMode;
    buildTarget?.dispatchEvent(new Event('change', { bubbles: true }));
    nativeBuildMode?.dispatchEvent(new Event('change', { bubbles: true }));
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    applyingBundle = false;
  }
}

function persistDomProject(options = {}) {
  try {
    persistBundle(bundleFromDom(), options);
  } catch (error) {
    setStatus('Local save unavailable', error?.message);
  }
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

  const serialized = serializeStudioProjectBundle(normalized);
  localStorage.setItem(PENDING_KEY, serialized);
  localStorage.setItem(CURRENT_KEY, serialized);
  writeLegacyCompatibility(normalized);
  localStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(LEGACY_CURRENT_KEY);
  localStorage.removeItem(LEGACY_PENDING_KEY);
  updateRecoveryControl();
}

function writeCanonicalBundle(bundle) {
  localStorage.setItem(CURRENT_KEY, serializeStudioProjectBundle(bundle));
}

function writeLegacyCompatibility(bundle) {
  const state = studioStateFromBundle(bundle);
  localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
}

function bundleFromDom() {
  return buildStudioProjectBundle({
    name: projectName?.value ?? 'PatchApp',
    kind: projectKind?.value ?? 'console',
    code: code?.value ?? '',
    buildTarget: buildTarget?.value ?? 'web',
    nativeBuildMode: nativeBuildMode?.value ?? 'prebuilt'
  });
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
