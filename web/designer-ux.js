import { listDesignerControls, listDesignerWindows } from '../src/designer.js';
import {
  DESIGNER_SELECTION_EVENT,
  clearDesignerSelection,
  currentDesignerSelection
} from './designer-selection.js';

const STORAGE_KEY = 'patch-studio-designer-ux-v1';
const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
let context = null;
let formEnhanceQueued = false;

if (doc) {
  installStylesheet();
  queueMicrotask(install);
}

export function formatDesignerSelectionSummary(control, selectedCount = 1) {
  if (!control) return 'No control selected';
  const parts = [displayControlType(control.type)];
  if (control.id) parts.push(control.id);
  if (Number.isInteger(control.windowIndex)) parts.push(`Form ${control.windowIndex + 1}`);
  if (selectedCount > 1) parts.push(`${selectedCount} selected`);
  return parts.join(' · ');
}

export function formatDesignerFormSummary(windowModel) {
  if (!windowModel) return 'Form settings';
  const width = Number(windowModel.width) || 640;
  const height = Number(windowModel.height) || 420;
  return `Form settings · ${width}×${height}`;
}

function install() {
  if (!designer || !toolbar || !canvas || !code) return;
  if (designer.dataset.patchDesignerUx === 'true') return;
  designer.dataset.patchDesignerUx = 'true';

  context = installContextGroup();
  enhanceInspector();
  bindInspectorListeners();
  scheduleFormEnhancement();

  canvas.addEventListener(DESIGNER_SELECTION_EVENT, syncDesignerUx);
  code.addEventListener('input', syncDesignerUx);
  code.addEventListener('change', syncDesignerUx);
  toolbar.addEventListener('change', event => {
    if (event.target?.id === 'patchFormSelect') syncDesignerUx();
  });
  doc.addEventListener('keydown', handleEscape, { capture: true });

  new MutationObserver(() => {
    scheduleFormEnhancement();
    syncDesignerUx();
  }).observe(designer, { childList: true, subtree: true });

  syncDesignerUx();
}

function installContextGroup() {
  const group = doc.createElement('span');
  group.className = 'designer-context-group';
  group.setAttribute('aria-label', 'Designer selection context');
  group.innerHTML = `
    <span class="designer-context-kicker">Selection</span>
    <strong id="designerSelectionStatus" class="designer-selection-status" role="status" aria-live="polite">No control selected</strong>
    <button id="designerFocusSelection" class="secondary small" type="button">Focus</button>
    <button id="designerClearSelection" class="secondary small" type="button">Clear</button>`;

  const forms = toolbar.querySelector('.forms-toolbar-group');
  toolbar.insertBefore(group, forms ?? null);
  const focus = group.querySelector('#designerFocusSelection');
  const clear = group.querySelector('#designerClearSelection');
  focus.title = 'Center the selected control, or the active Form when nothing is selected';
  clear.title = 'Clear the Designer selection (Esc)';
  focus.addEventListener('click', focusDesignerTarget);
  clear.addEventListener('click', () => {
    clearDesignerSelection(canvas, { reason: 'toolbar-clear' });
    canvas.focus?.({ preventScroll: true });
    syncDesignerUx();
  });
  return { group, status: group.querySelector('#designerSelectionStatus'), focus, clear };
}

function enhanceInspector() {
  const inspector = doc.querySelector('#designerInspector');
  if (!inspector) return;
  const empty = inspector.querySelector('#designerInspectorEmpty');
  if (empty) {
    empty.innerHTML = '<strong>Select a control to edit it.</strong><br>Properties stay in visible Patch source. Use the canvas, then adjust properties or layout here.';
  }
  const location = inspector.querySelector('#designerInspectorLocation');
  if (location && !inspector.querySelector('#designerInspectorState')) {
    const state = doc.createElement('p');
    state.id = 'designerInspectorState';
    state.className = 'inspector-state';
    state.setAttribute('role', 'status');
    state.setAttribute('aria-live', 'polite');
    location.insertAdjacentElement('afterend', state);
  }
}

function bindInspectorListeners() {
  const inspector = doc.querySelector('#designerInspector');
  if (!inspector || inspector.dataset.patchDesignerUxBound === 'true') return;
  inspector.dataset.patchDesignerUxBound = 'true';
  inspector.addEventListener('input', syncInspectorDirtyState);
  inspector.addEventListener('change', syncInspectorDirtyState);
}

function scheduleFormEnhancement() {
  if (formEnhanceQueued) return;
  formEnhanceQueued = true;
  queueMicrotask(() => {
    formEnhanceQueued = false;
    enhanceFormToolbar();
  });
}

function enhanceFormToolbar() {
  const group = toolbar?.querySelector('.forms-toolbar-group');
  if (!group || group.dataset.patchCompactForms === 'true') return;
  const select = group.querySelector('#patchFormSelect');
  const add = group.querySelector('#patchAddForm');
  const apply = group.querySelector('#patchApplyForm');
  if (!select || !add || !apply) return;

  group.dataset.patchCompactForms = 'true';
  add.title = 'Add a source-backed Form';
  apply.title = 'Apply Form name, title and size';

  const formLabel = select.closest('label');
  const count = doc.createElement('span');
  count.id = 'patchFormCount';
  count.className = 'designer-form-count';
  count.setAttribute('aria-live', 'polite');
  formLabel?.insertAdjacentElement('afterend', count);

  const details = doc.createElement('details');
  details.className = 'designer-form-settings';
  const state = loadState();
  details.open = state.formSettingsOpen === true;
  const summary = doc.createElement('summary');
  summary.textContent = 'Form settings';
  summary.title = 'Edit the active Form name, title and dimensions';
  const panel = doc.createElement('div');
  panel.className = 'designer-form-settings-panel';

  for (const id of ['patchFormName', 'patchFormTitle', 'patchFormWidth', 'patchFormHeight']) {
    const field = group.querySelector(`#${id}`)?.closest('label');
    if (!field) continue;
    field.classList.add('designer-form-setting-field', `designer-form-setting-${id.replace('patchForm', '').toLowerCase()}`);
    panel.appendChild(field);
  }
  panel.appendChild(apply);
  details.append(summary, panel);
  group.appendChild(details);

  const syncOpenState = () => {
    toolbar.classList.toggle('designer-form-settings-open', details.open);
    saveState({ ...loadState(), formSettingsOpen: details.open });
  };
  details.addEventListener('toggle', syncOpenState);
  toolbar.classList.toggle('designer-form-settings-open', details.open);

  syncFormContext();
}

function syncDesignerUx() {
  enhanceInspector();
  bindInspectorListeners();
  syncSelectionContext();
  syncFormContext();
  syncInspectorHeading();
  syncInspectorDirtyState();
}

function syncSelectionContext() {
  if (!context) return;
  const selection = currentDesignerSelection(canvas);
  const controls = safeDesignerControls();
  const control = selection
    ? controls.find(item => sameLocation(item, selection)) ?? null
    : null;
  const multiCount = canvas.querySelectorAll('.designer-control.designer-multi-selected').length;
  const selectedCount = selection ? Math.max(1, multiCount) : 0;
  context.status.textContent = formatDesignerSelectionSummary(control, selectedCount);
  context.clear.disabled = !selection;
  context.focus.textContent = selection ? 'Focus selected' : 'Focus form';
}

function syncFormContext() {
  const group = toolbar?.querySelector('.forms-toolbar-group');
  if (!group) return;
  const select = group.querySelector('#patchFormSelect');
  const count = group.querySelector('#patchFormCount');
  const details = group.querySelector('.designer-form-settings');
  const summary = details?.querySelector('summary');
  const windows = safeDesignerWindows();
  const active = Math.max(0, Math.min(Number(select?.value) || 0, Math.max(0, windows.length - 1)));
  if (count) count.textContent = windows.length ? `${active + 1} / ${windows.length}` : '0 forms';
  if (summary) summary.textContent = formatDesignerFormSummary(windows[active] ?? null);
}

function syncInspectorHeading() {
  const inspector = doc.querySelector('#designerInspector');
  const heading = inspector?.querySelector('h3');
  const state = inspector?.querySelector('#designerInspectorState');
  const selection = currentDesignerSelection(canvas);
  const control = selection ? safeDesignerControls().find(item => sameLocation(item, selection)) ?? null : null;
  if (heading) heading.textContent = control ? `${displayControlType(control.type)} properties` : 'Properties';
  if (state && !control) state.textContent = '';
}

function syncInspectorDirtyState() {
  const inspector = doc.querySelector('#designerInspector');
  const apply = inspector?.querySelector('#designerInspectorApply');
  const state = inspector?.querySelector('#designerInspectorState');
  if (!apply || !state) return;
  const selection = currentDesignerSelection(canvas);
  const control = selection ? safeDesignerControls().find(item => sameLocation(item, selection)) ?? null : null;
  if (!control) {
    apply.disabled = true;
    state.textContent = '';
    return;
  }

  const id = inspector.querySelector('#designerInspectorId')?.value ?? '';
  const text = inspector.querySelector('#designerInspectorText')?.value ?? '';
  const options = inspector.querySelector('#designerInspectorOptions')?.value ?? '';
  let dirty = false;
  if (control.type !== 'text') dirty ||= id !== (control.id ?? '');
  if (['text', 'button', 'checkbox'].includes(control.type)) dirty ||= text !== (control.textExpr ?? '');
  if (['combo', 'listbox', 'radio'].includes(control.type)) dirty ||= options !== ((control.options ?? []).join(', '));
  apply.disabled = !dirty;
  apply.title = dirty ? 'Apply these source-backed property changes' : 'No common property changes to apply';
  state.textContent = dirty ? 'Property changes ready to apply.' : 'Source-backed · up to date.';
  state.classList.toggle('is-dirty', dirty);
}

function focusDesignerTarget() {
  const selection = currentDesignerSelection(canvas);
  let target = null;
  if (selection) {
    target = canvas.querySelector(`.designer-control[data-window-index="${selection.windowIndex}"][data-control-index="${selection.controlIndex}"]`);
  }
  if (!target) {
    const activeForm = Number(doc.querySelector('#patchFormSelect')?.value) || 0;
    target = canvas.querySelectorAll('.patch-window')[activeForm] ?? null;
  }
  if (!target) return;
  target.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' });
  if (target.classList.contains('designer-control')) target.focus?.({ preventScroll: true });
  target.classList.add('designer-focus-pulse');
  setTimeout(() => target.classList.remove('designer-focus-pulse'), 650);
}

function handleEscape(event) {
  if (event.key !== 'Escape' || !designer?.contains(doc.activeElement)) return;
  const active = doc.activeElement;
  if (active?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
  if (!currentDesignerSelection(canvas)) return;
  event.preventDefault();
  clearDesignerSelection(canvas, { reason: 'escape' });
  canvas.focus?.({ preventScroll: true });
  syncDesignerUx();
}

function safeDesignerControls() {
  try { return listDesignerControls(code.value); } catch { return []; }
}

function safeDesignerWindows() {
  try { return listDesignerWindows(code.value); } catch { return []; }
}

function sameLocation(control, selection) {
  return Number(control?.windowIndex) === Number(selection?.windowIndex) && Number(control?.controlIndex) === Number(selection?.controlIndex);
}

function displayControlType(type) {
  if (type === 'tree') return 'TreeView';
  if (type === 'combo') return 'ComboBox';
  if (type === 'listbox') return 'ListBox';
  if (type === 'tabs') return 'Tabs';
  if (type === 'table') return 'Table';
  const text = String(type ?? 'Control');
  return text ? text[0].toUpperCase() + text.slice(1) : 'Control';
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-designer-ux]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-ux.css';
  link.dataset.patchDesignerUx = '1';
  doc.head.appendChild(link);
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {}; } catch { return {}; }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage may be unavailable */ }
}
