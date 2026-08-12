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

const CURRENT_KEY = 'patchStudio.project.v1';
const PENDING_KEY = 'patchStudio.project.pending.v1';
const RECOVERY_KEY = 'patchStudio.recovery.v1';
const CORRUPT_KEY = 'patchStudio.project.corrupt.v1';
const LEGACY_KEY = 'patchStudio.project';
const RECOVERY_INTERVAL_MS = 60_000;
const MAX_IMPORT_BYTES = PATCH_STUDIO_MAX_SOURCE_BYTES * 8;

installStylesheet();

const code = document.querySelector('#code');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
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
    const pending = readBundleAttempt(PENDING_KEY);
    if (pending.bundle) {
      writeCanonicalBundle(pending.bundle);
      localStorage.removeItem(PENDING_KEY);
      writeLegacyCompatibility(pending.bundle);
      setStatus('Recovered interrupted local save');
      return;
    }
    if (pending.error) {
      quarantineCorruptStore(PENDING_KEY, pending.raw);
      warnings.push(`Pending save was invalid: ${pending.error.message}`);
    }

    const current = readBundleAttempt(CURRENT_KEY);
    if (current.bundle) {
      writeLegacyCompatibility(current.bundle);
      if (warnings.length) setStatus('Saved project restored', warnings.join(' '));
      return;
    }
    if (current.error) {
      quarantineCorruptStore(CURRENT_KEY, current.raw);
      warnings.push(`Canonical project was invalid: ${current.error.message}`);
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
  recoverButton?.addEventListener('click', recoverLatestProject);

  for (const input of [code, projectName, projectKind]) {
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
    const filename = `${safeFileName(bundle.project.name)}.patchproject`;
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

function recoverLatestProject() {
  try {
    const snapshots = readRecoverySnapshots();
    const latest = snapshots[0];
    if (!latest) return;
    const when = formatTime(latest.savedAt);
    if (!window.confirm(`Recover the Patch Studio snapshot from ${when}? Your current project will be kept as a recovery snapshot first.`)) return;
    protectCurrentProject();
    applyBundleToDom(latest.project);
    persistBundle(latest.project, { snapshot: 'none' });
    setStatus(`Recovered snapshot from ${when}`);
  } catch (error) {
    setStatus('Recovery stopped', error?.message);
  }
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
    code: code?.value ?? ''
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
  localStorage.setItem(RECOVERY_KEY, serializeRecoverySnapshots(next));
  updateRecoveryControl(next);
}

function readRecoverySnapshots() {
  return parseRecoverySnapshots(localStorage.getItem(RECOVERY_KEY));
}

function updateRecoveryControl(known = null) {
  if (!recoverButton) return;
  let snapshots = known;
  if (!snapshots) {
    try { snapshots = readRecoverySnapshots(); } catch { snapshots = []; }
  }
  recoverButton.disabled = snapshots.length === 0;
  recoverButton.title = snapshots[0]
    ? `Recover latest snapshot from ${formatTime(snapshots[0].savedAt)}. ${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'} stored.`
    : 'No recovery snapshots stored yet.';
}

function sameBundle(a, b) {
  return serializeStudioProjectBundle(a) === serializeStudioProjectBundle(b);
}

function safeFileName(name) {
  const cleaned = String(name ?? '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
  return cleaned || 'PatchApp';
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
