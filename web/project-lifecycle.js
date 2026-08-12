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
const LEGACY_KEY = 'patchStudio.project';
const RECOVERY_INTERVAL_MS = 60_000;
const MAX_IMPORT_BYTES = PATCH_STUDIO_MAX_SOURCE_BYTES + 64 * 1024;

const code = document.querySelector('#code');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const saveState = document.querySelector('#saveState');
const exportButton = document.querySelector('#exportProject');
const importButton = document.querySelector('#importProject');
const recoverButton = document.querySelector('#recoverProject');
const importFile = document.querySelector('#importProjectFile');
let lastRecoveryAt = Date.now();

bootstrapProjectStorage();
installProjectActions();
updateRecoveryControl();

function bootstrapProjectStorage() {
  try {
    const pending = readBundle(PENDING_KEY);
    if (pending) {
      writeCanonicalBundle(pending);
      localStorage.removeItem(PENDING_KEY);
      writeLegacyCompatibility(pending);
      return;
    }

    const current = readBundle(CURRENT_KEY);
    if (current) {
      writeLegacyCompatibility(current);
      return;
    }

    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return;
    const migrated = parseStoredStudioProject(legacyRaw);
    if (!migrated) return;
    writeCanonicalBundle(migrated);
    writeLegacyCompatibility(migrated);
  } catch (error) {
    setStatus('Stored project needs recovery', error?.message);
  }
}

function installProjectActions() {
  exportButton?.addEventListener('click', exportProject);
  importButton?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', importProjectFile);
  recoverButton?.addEventListener('click', recoverLatestProject);

  for (const input of [code, projectName, projectKind]) {
    input?.addEventListener('input', () => persistDomProject({ snapshot: 'interval' }));
    input?.addEventListener('change', () => persistDomProject({ snapshot: 'interval' }));
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
    persistDomProject({ snapshot: 'force' });
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
    persistDomProject({ snapshot: 'force' });
    applyBundleToDom(latest.project);
    persistBundle(latest.project, { snapshot: 'none' });
    setStatus(`Recovered snapshot from ${when}`);
  } catch (error) {
    setStatus('Recovery stopped', error?.message);
  }
}

function applyBundleToDom(bundle) {
  const state = studioStateFromBundle(bundle);
  projectName.value = state.name;
  projectKind.value = state.kind;
  code.value = state.code;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
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
  const previous = readBundle(CURRENT_KEY);
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

function readBundle(key) {
  const raw = localStorage.getItem(key);
  return raw ? parseStoredStudioProject(raw) : null;
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

function download(filename, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
