import './designer-paintbox.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { listDesignerControls, updateDesignerControl } from '../src/designer.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';

export const PATCH_DESIGNER_STATUSBAR_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const app = doc?.querySelector('#app') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
let queued = false;
let cachedSource = null;
let cachedControls = [];
let cachedUi = [];

if (doc) queueMicrotask(install);

export function listDesignerStatusBars(source, windowIndex = null) {
  const bars = listDesignerControls(source).filter(control => control.type === 'statusbar');
  if (!Number.isInteger(windowIndex)) return bars;
  return bars.filter(control => control.windowIndex === windowIndex);
}

export function statusBarPreviewText(control, uiControl = null) {
  if (uiControl && typeof uiControl.text === 'string') return uiControl.text;
  const expression = String(control?.textExpr ?? '"Ready"').trim();
  if ((expression.startsWith('"') && expression.endsWith('"')) || (expression.startsWith("'") && expression.endsWith("'"))) {
    return expression.slice(1, -1);
  }
  return expression || 'Ready';
}

function install() {
  if (!designer || !code || !canvas || !app || designer.dataset.patchStatusbarRad === 'true') return;
  designer.dataset.patchStatusbarRad = 'true';
  installStylesheet();

  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleInspectorSync);
  doc.querySelector('#patchFormSelect')?.addEventListener('change', scheduleSync);
  doc.addEventListener('click', interceptInspectorApply, { capture: true });
  doc.addEventListener('keydown', interceptInspectorEnter, { capture: true });
  doc.addEventListener('input', scheduleInspectorFromInput, { capture: true });
  doc.addEventListener('change', scheduleInspectorFromInput, { capture: true });

  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true });
  new MutationObserver(scheduleSync).observe(app, { childList: true, subtree: true });
  scheduleSync();
}

function scheduleSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    refreshSnapshot();
    syncContainer(canvas, true);
    syncContainer(app, false);
    syncStatusBarInspector();
  });
}

function refreshSnapshot() {
  const source = code?.value ?? '';
  if (source === cachedSource) return;
  cachedSource = source;
  try {
    cachedControls = listDesignerControls(source);
    if (!cachedControls.some(control => control.type === 'statusbar')) {
      cachedUi = [];
      return;
    }
    cachedUi = new PatchInterpreter().run(source).ui ?? [];
  } catch {
    cachedControls = [];
    cachedUi = [];
  }
}

function syncContainer(container, isDesigner) {
  if (!container) return;
  const shells = [...container.querySelectorAll('.patch-window')];
  shells.forEach((shell, windowIndex) => {
    const body = shell.querySelector(':scope > .patch-window-body');
    if (!body) return;
    const bars = cachedControls.filter(control => control.windowIndex === windowIndex && control.type === 'statusbar');
    const live = new Set(bars.map(control => String(control.controlIndex)));
    for (const stale of body.querySelectorAll(':scope > .patch-statusbar[data-patch-statusbar-adapter="true"]')) {
      if (!live.has(stale.dataset.controlIndex ?? '')) stale.remove();
    }

    const uiControls = cachedUi[windowIndex]?.controls ?? [];
    for (const control of bars) {
      let element = body.querySelector(`:scope > .patch-statusbar[data-patch-statusbar-adapter="true"][data-control-index="${control.controlIndex}"]`);
      if (!element) {
        element = doc.createElement('div');
        element.className = 'patch-statusbar';
        element.dataset.patchStatusbarAdapter = 'true';
        element.setAttribute('role', 'status');
        body.appendChild(element);
      }
      element.dataset.windowIndex = String(control.windowIndex);
      element.dataset.controlIndex = String(control.controlIndex);
      element.dataset.statusbarId = control.id ?? '';
      const text = statusBarPreviewText(control, uiControls[control.controlIndex] ?? null);
      if (element.textContent !== text) element.textContent = text;
      element.style.height = `${Number(control.height) || 28}px`;
      body.style.position = 'relative';

      if (isDesigner) {
        element.classList.add('designer-control');
        element.tabIndex = 0;
        element.setAttribute('aria-label', `Select StatusBar ${control.id ?? control.controlIndex + 1}`);
      } else {
        element.classList.remove('designer-control', 'designer-selected', 'designer-multi-selected');
        element.removeAttribute('tabindex');
      }
    }
  });
}

function interceptInspectorApply(event) {
  if (!event.target?.closest?.('#designerInspectorApply')) return;
  const control = currentStatusBar();
  if (!control) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  applyStatusBarInspector(control);
}

function interceptInspectorEnter(event) {
  if (event.key !== 'Enter' || !['designerInspectorId', 'designerInspectorText'].includes(event.target?.id)) return;
  const control = currentStatusBar();
  if (!control) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  applyStatusBarInspector(control);
}

function applyStatusBarInspector(control) {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  try {
    const next = updateDesignerControl(code.value, selection, {
      id: doc.querySelector('#designerInspectorId')?.value ?? control.id,
      textExpr: doc.querySelector('#designerInspectorText')?.value ?? control.textExpr
    });
    const updated = listDesignerControls(next).find(item => sameLocation(item, selection)) ?? control;
    rememberDesignerSelection(canvas, designerSelectionForControl(updated, 'core'), { emit: false });
    setSource(next);
  } catch (error) {
    showInspectorError(error);
  }
}

function scheduleInspectorFromInput(event) {
  if (!['designerInspectorId', 'designerInspectorText'].includes(event.target?.id)) return;
  if (!currentStatusBar()) return;
  scheduleInspectorSync();
}

function scheduleInspectorSync() {
  queueMicrotask(syncStatusBarInspector);
}

function syncStatusBarInspector() {
  refreshSnapshot();
  const selected = currentSelectedControl();
  const layout = doc.querySelector('#patchResponsiveLayout');
  const geometry = doc.querySelector('[data-form-geometry]');
  if (selected?.type !== 'statusbar') {
    if (layout?.dataset.patchStatusbarLocked === 'true') {
      layout.disabled = false;
      delete layout.dataset.patchStatusbarLocked;
    }
    if (geometry?.dataset.patchStatusbarHidden === 'true') {
      geometry.hidden = selected?.type === 'timer';
      delete geometry.dataset.patchStatusbarHidden;
    }
    return;
  }
  const control = selected;

  const form = doc.querySelector('#designerInspectorForm');
  const empty = doc.querySelector('#designerInspectorEmpty');
  if (form) form.hidden = false;
  if (empty) empty.hidden = true;

  const type = doc.querySelector('#designerInspectorType');
  const idField = doc.querySelector('#designerInspectorIdField');
  const textField = doc.querySelector('#designerInspectorTextField');
  const optionsField = doc.querySelector('#designerInspectorOptionsField');
  const sliderFields = doc.querySelector('#designerInspectorSliderFields');
  const timerField = doc.querySelector('#designerInspectorTimerField');
  const location = doc.querySelector('#designerInspectorLocation');
  const id = doc.querySelector('#designerInspectorId');
  const text = doc.querySelector('#designerInspectorText');

  if (type) type.textContent = 'StatusBar';
  if (idField) idField.hidden = false;
  if (textField) textField.hidden = false;
  if (optionsField) optionsField.hidden = true;
  if (sliderFields) sliderFields.hidden = true;
  if (timerField) timerField.hidden = true;
  if (geometry) {
    geometry.hidden = true;
    geometry.dataset.patchStatusbarHidden = 'true';
  }
  if (location) location.textContent = `Window ${control.windowIndex + 1} · control ${control.controlIndex + 1} · line ${control.line} · dock bottom`;
  if (id && doc.activeElement !== id) id.value = control.id ?? '';
  if (text && doc.activeElement !== text) text.value = control.textExpr ?? '"Ready"';

  if (layout) {
    layout.value = 'dock:bottom';
    layout.disabled = true;
    layout.dataset.patchStatusbarLocked = 'true';
    layout.title = 'StatusBar is source-backed Form chrome and remains docked to the bottom.';
  }

  const apply = doc.querySelector('#designerInspectorApply');
  const state = doc.querySelector('#designerInspectorState');
  const dirty = Boolean(
    (id && id.value !== (control.id ?? '')) ||
    (text && text.value !== (control.textExpr ?? '"Ready"'))
  );
  if (apply) {
    apply.disabled = !dirty;
    apply.title = dirty ? 'Apply StatusBar name/text to Patch source' : 'StatusBar properties are up to date';
  }
  if (state) {
    state.textContent = dirty ? 'StatusBar property changes ready to apply.' : 'Source-backed · dock bottom · up to date.';
    state.classList.toggle('is-dirty', dirty);
  }
}

function currentSelectedControl() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  refreshSnapshot();
  return cachedControls.find(control => sameLocation(control, selection)) ?? null;
}

function currentStatusBar() {
  const control = currentSelectedControl();
  return control?.type === 'statusbar' ? control : null;
}

function sameLocation(control, selection) {
  return Number(control?.windowIndex) === Number(selection?.windowIndex) && Number(control?.controlIndex) === Number(selection?.controlIndex);
}

function setSource(source) {
  code.value = source;
  cachedSource = null;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function showInspectorError(error) {
  const target = doc.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function installStylesheet() {
  if (doc.querySelector('style[data-patch-statusbar-rad]')) return;
  const style = doc.createElement('style');
  style.dataset.patchStatusbarRad = 'true';
  style.textContent = `
.patch-statusbar {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  padding: 0 10px;
  border-top: 1px solid var(--border-strong);
  background: var(--soft);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  top: auto !important;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
}
#designerCanvas .patch-statusbar.designer-selected {
  outline: 2px solid color-mix(in srgb, var(--text) 58%, transparent);
  outline-offset: -2px;
}
#designerCanvas .patch-statusbar { cursor: default; }
`;
  doc.head.appendChild(style);
}
