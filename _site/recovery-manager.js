import {
  clearRecoverySnapshots,
  createManualRecoverySnapshot,
  deleteRecoverySnapshot,
  exportRecoverySnapshot,
  getRecoverySnapshotSummaries,
  restoreRecoverySnapshot
} from './project-lifecycle.js?v=868f0784ca7f3972';

const trigger = document.querySelector('#recoverProject');
const dialog = installRecoveryDialog();
const list = dialog.querySelector('#recoverySnapshotList');
const empty = dialog.querySelector('#recoveryEmpty');
const count = dialog.querySelector('#recoveryCount');
const status = dialog.querySelector('#recoveryManagerStatus');
const createButton = dialog.querySelector('#recoveryCreate');
const clearButton = dialog.querySelector('#recoveryClear');
const closeButton = dialog.querySelector('#recoveryClose');

installStylesheet();
window.addEventListener('patch:open-recovery-manager', openManager);
window.addEventListener('patch:recovery-changed', () => {
  if (dialog.open) renderSnapshots();
});
createButton.addEventListener('click', createSnapshot);
clearButton.addEventListener('click', clearSnapshots);
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => trigger?.focus());

function openManager() {
  renderSnapshots();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function renderSnapshots(message = '') {
  const snapshots = getRecoverySnapshotSummaries();
  list.replaceChildren();
  empty.hidden = snapshots.length !== 0;
  count.textContent = `${snapshots.length} / 5 local snapshots`;
  clearButton.disabled = snapshots.length === 0;
  status.textContent = message;

  for (const snapshot of snapshots) {
    const row = document.createElement('article');
    row.className = 'recovery-row';

    const summary = document.createElement('div');
    summary.className = 'recovery-summary';
    const title = document.createElement('strong');
    title.textContent = snapshot.name;
    const meta = document.createElement('span');
    meta.textContent = `${formatTime(snapshot.savedAt)} · ${snapshot.kind} · ${formatBytes(snapshot.sourceBytes)}`;
    summary.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'recovery-actions';
    actions.append(
      actionButton('Restore', () => restoreSnapshot(snapshot)),
      actionButton('Export', () => exportSnapshot(snapshot), 'secondary'),
      actionButton('Delete', () => removeSnapshot(snapshot), 'secondary danger')
    );

    row.append(summary, actions);
    list.appendChild(row);
  }
}

function createSnapshot() {
  try {
    createManualRecoverySnapshot();
    renderSnapshots('Snapshot saved.');
  } catch (error) {
    setStatus(`Snapshot failed: ${error.message}`);
  }
}

function restoreSnapshot(snapshot) {
  const when = formatTime(snapshot.savedAt);
  if (!window.confirm(`Restore ${snapshot.name} from ${when}? The current project will be saved as a recovery snapshot first.`)) return;
  try {
    restoreRecoverySnapshot(snapshot.index);
    renderSnapshots(`Restored ${snapshot.name} from ${when}.`);
  } catch (error) {
    setStatus(`Restore failed: ${error.message}`);
  }
}

function exportSnapshot(snapshot) {
  try {
    const filename = exportRecoverySnapshot(snapshot.index);
    renderSnapshots(`Exported ${filename}.`);
  } catch (error) {
    setStatus(`Export failed: ${error.message}`);
  }
}

function removeSnapshot(snapshot) {
  const when = formatTime(snapshot.savedAt);
  if (!window.confirm(`Delete the recovery snapshot from ${when}?`)) return;
  try {
    deleteRecoverySnapshot(snapshot.index);
    renderSnapshots('Snapshot deleted.');
  } catch (error) {
    setStatus(`Delete failed: ${error.message}`);
  }
}

function clearSnapshots() {
  if (!window.confirm('Delete all local Patch Studio recovery snapshots?')) return;
  try {
    clearRecoverySnapshots();
    renderSnapshots('All recovery snapshots cleared.');
  } catch (error) {
    setStatus(`Clear failed: ${error.message}`);
  }
}

function actionButton(label, handler, classes = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `small ${classes}`.trim();
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function setStatus(message) {
  status.textContent = message;
}

function installRecoveryDialog() {
  const existing = document.querySelector('#recoveryManager');
  if (existing) return existing;
  const node = document.createElement('dialog');
  node.id = 'recoveryManager';
  node.className = 'recovery-dialog';
  node.setAttribute('aria-labelledby', 'recoveryManagerTitle');
  node.innerHTML = `
    <div class="recovery-dialog-shell">
      <header class="recovery-header">
        <div>
          <h2 id="recoveryManagerTitle">Recovery snapshots</h2>
          <p>Local restore points for this browser. Restoring always protects your current project first.</p>
        </div>
        <span id="recoveryCount" class="recovery-count"></span>
      </header>
      <div id="recoverySnapshotList" class="recovery-list"></div>
      <p id="recoveryEmpty" class="recovery-empty">No recovery snapshots yet. Create one before a risky edit or import.</p>
      <p id="recoveryManagerStatus" class="recovery-status" aria-live="polite"></p>
      <footer class="recovery-footer">
        <button id="recoveryCreate" type="button">Snapshot now</button>
        <button id="recoveryClear" class="secondary" type="button">Clear all</button>
        <button id="recoveryClose" class="secondary" type="button">Close</button>
      </footer>
    </div>`;
  document.body.appendChild(node);
  return node;
}

function installStylesheet() {
  if (document.querySelector('link[data-patch-recovery-manager]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './recovery-manager.css';
  link.dataset.patchRecoveryManager = '1';
  document.head.appendChild(link);
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unknown time';
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
