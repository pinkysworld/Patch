import { listDesignerControls } from '../src/designer.js';
import {
  DESIGNER_SELECTION_EVENT,
  clearDesignerSelection,
  currentDesignerSelection,
  decorateDesignerAdapterElement,
  designerSelectionForControl,
  installDesignerSelectionBridge,
  rememberDesignerSelection,
  sameDesignerSelection,
  selectDesignerElement
} from './designer-selection.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const sample = document.querySelector('#sample');
const CORE_TOOL_TYPES = new Map([
  ['addText', 'text'],
  ['addButton', 'button'],
  ['addInput', 'input'],
  ['addCheckbox', 'checkbox'],
  ['addRadio', 'radio'],
  ['addCombo', 'combo'],
  ['addListbox', 'listbox'],
  ['addTabs', 'tabs']
]);
let scheduled = false;
let pendingToolAdd = null;

if (canvas && code) {
  installDesignerSelectionBridge(canvas);
  document.addEventListener('click', captureToolboxIntent, { capture: true });
  canvas.addEventListener('click', captureCoreSelection, { capture: true });
  canvas.addEventListener('keydown', captureCoreSelectionKey, { capture: true });
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleSync);
  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true });
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  sample?.addEventListener('change', () => {
    pendingToolAdd = null;
    clearDesignerSelection(canvas, { reason: 'sample-change' });
    scheduleSync();
  });
  scheduleSync();
}

function captureToolboxIntent(event) {
  const button = event.target?.closest?.('button[id]');
  const type = button ? CORE_TOOL_TYPES.get(button.id) : null;
  if (!type) return;
  pendingToolAdd = {
    type,
    windowIndex: Number(document.querySelector('#patchFormSelect')?.value) || 0
  };
}

function captureCoreSelection(event) {
  const element = coreControlFromTarget(event.target);
  if (!element) return;
  selectCoreElement(element, 'core-control');
}

function captureCoreSelectionKey(event) {
  if (!['Enter', ' '].includes(event.key)) return;
  const element = coreControlFromTarget(event.target);
  if (!element) return;
  selectCoreElement(element, 'core-keyboard');
}

function selectCoreElement(element, reason) {
  const control = controlFromElement(element);
  const selection = designerSelectionForControl(control, 'core');
  if (!selection) return;
  selectDesignerElement(canvas, element, selection, { reason });
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try { syncCoreSelection(); } catch { /* source may be transiently invalid while typing */ }
  });
}

function syncCoreSelection() {
  const controls = listDesignerControls(code.value);
  const elements = [...canvas.querySelectorAll('.designer-control')].filter(isCoreElement);

  if (pendingToolAdd) {
    const added = controls
      .filter(control => control.windowIndex === pendingToolAdd.windowIndex && control.type === pendingToolAdd.type)
      .at(-1);
    const element = added ? elementFor(added) : null;
    if (added && element) {
      selectDesignerElement(canvas, element, designerSelectionForControl(added, 'core'), { reason: 'add-core-control' });
      pendingToolAdd = null;
    }
  }

  let shared = currentDesignerSelection(canvas);
  if (shared?.adapter === 'core') {
    const live = controls.find(control => sameLocation(control, shared) && isCoreType(control.type));
    if (!live) {
      clearDesignerSelection(canvas, { adapter: 'core', reason: 'missing-core-control' });
      shared = null;
    } else {
      const normalized = designerSelectionForControl(live, 'core');
      if (!sameDesignerSelection(shared, normalized) || (shared.id ?? '') !== (normalized.id ?? '')) {
        rememberDesignerSelection(canvas, normalized, { emit: false });
        shared = normalized;
      }
    }
  }

  if (!shared) {
    const legacySelected = elements.find(element => element.classList.contains('designer-selected'));
    const control = legacySelected ? controlFromElement(legacySelected, controls) : null;
    if (control) {
      const selection = designerSelectionForControl(control, 'core');
      rememberDesignerSelection(canvas, selection, { emit: false });
      shared = selection;
    }
  }

  for (const element of elements) {
    const control = controlFromElement(element, controls);
    if (!control) continue;
    decorateDesignerAdapterElement(canvas, element, designerSelectionForControl(control, 'core'));
  }
}

function coreControlFromTarget(target) {
  const element = target?.closest?.('.designer-control');
  if (!element || !canvas.contains(element) || !isCoreElement(element)) return null;
  return element;
}

function isCoreElement(element) {
  if (!element?.classList?.contains('designer-control')) return false;
  if (element.classList.contains('patch-table-stage1-control')) return false;
  if (element.classList.contains('patch-tree-designer-control')) return false;
  if (element.dataset.patchDesignerTree === 'true') return false;
  const adapter = String(element.dataset.patchDesignerAdapter ?? '');
  return !adapter || adapter === 'core';
}

function isCoreType(type) {
  return !['table', 'tree'].includes(String(type ?? ''));
}

function controlFromElement(element, controls = null) {
  const windowIndex = Number(element?.dataset?.windowIndex);
  const controlIndex = Number(element?.dataset?.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  const sourceControls = controls ?? listDesignerControls(code.value);
  const control = sourceControls.find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
  return control && isCoreType(control.type) ? control : null;
}

function elementFor(control) {
  return canvas.querySelector(
    `.designer-control[data-window-index="${control.windowIndex}"][data-control-index="${control.controlIndex}"]`
  );
}

function sameLocation(control, selection) {
  return Number(control.windowIndex) === Number(selection.windowIndex) && Number(control.controlIndex) === Number(selection.controlIndex);
}
