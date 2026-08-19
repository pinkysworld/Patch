import {
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
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
  installSharedInspectorBridge();
  document.addEventListener('click', captureToolboxIntent, { capture: true });
  canvas.addEventListener('click', captureCoreSelection, { capture: true });
  canvas.addEventListener('keydown', captureCoreSelectionKey, { capture: true });
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, () => {
    populateSharedInspector();
    scheduleSync();
  });
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
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
  const element = coreControlFromTarget(event.target);
  if (!element) return;
  selectCoreElement(element, 'core-control');
}

function captureCoreSelectionKey(event) {
  if (!['Enter', ' '].includes(event.key)) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
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
    try {
      syncCoreSelection();
      populateSharedInspector();
    } catch {
      // Source may be transiently invalid while typing. Playground owns the visible parse diagnostic.
    }
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

  const shared = currentDesignerSelection(canvas);
  if (shared?.adapter === 'core') {
    const live = controls.find(control => sameLocation(control, shared) && isCoreType(control.type));
    if (!live) {
      clearDesignerSelection(canvas, { adapter: 'core', reason: 'missing-core-control' });
    } else {
      const normalized = designerSelectionForControl(live, 'core');
      if (!sameDesignerSelection(shared, normalized) || (shared.id ?? '') !== (normalized.id ?? '')) {
        rememberDesignerSelection(canvas, normalized, { emit: false });
      }
    }
  }

  for (const element of elements) {
    const control = controlFromElement(element, controls);
    if (!control) continue;
    decorateDesignerAdapterElement(canvas, element, designerSelectionForControl(control, 'core'));
  }
}

function installSharedInspectorBridge() {
  const apply = document.querySelector('#designerInspectorApply');
  const remove = document.querySelector('#designerInspectorDelete');
  const source = document.querySelector('#designerInspectorSource');
  apply?.addEventListener('click', captureInspectorApply, { capture: true });
  remove?.addEventListener('click', captureInspectorDelete, { capture: true });
  source?.addEventListener('click', captureInspectorSource, { capture: true });
  for (const field of [
    document.querySelector('#designerInspectorId'),
    document.querySelector('#designerInspectorText'),
    document.querySelector('#designerInspectorOptions')
  ]) {
    field?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || !currentDesignerSelection(canvas)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applySharedInspector();
    }, { capture: true });
  }
}

function captureInspectorApply(event) {
  if (!currentDesignerSelection(canvas)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  applySharedInspector();
}

function captureInspectorDelete(event) {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const next = removeDesignerControl(code.value, selection);
    clearDesignerSelection(canvas, { reason: 'delete-control' });
    setSource(next);
  } catch (error) {
    showInspectorError(error);
  }
}

function captureInspectorSource(event) {
  const control = currentSharedControl();
  if (!control) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  revealLine(control.line);
}

function applySharedInspector() {
  const selection = currentDesignerSelection(canvas);
  const selected = currentSharedControl();
  if (!selection || !selected) return;
  try {
    const changes = {};
    if (selected.type !== 'text') changes.id = document.querySelector('#designerInspectorId')?.value ?? '';
    if (['text', 'button', 'checkbox'].includes(selected.type)) {
      changes.textExpr = document.querySelector('#designerInspectorText')?.value ?? '';
    }
    if (['combo', 'listbox', 'radio'].includes(selected.type)) {
      changes.options = splitOptionExpressions(document.querySelector('#designerInspectorOptions')?.value ?? '');
    }
    const next = updateDesignerControl(code.value, selection, changes);
    const updated = listDesignerControls(next).find(control => sameLocation(control, selection));
    if (updated) rememberDesignerSelection(canvas, designerSelectionForControl(updated, selection.adapter), { emit: false });
    setSource(next);
  } catch (error) {
    showInspectorError(error);
  }
}

function populateSharedInspector() {
  const selection = currentDesignerSelection(canvas);
  const control = currentSharedControl();
  const empty = document.querySelector('#designerInspectorEmpty');
  const form = document.querySelector('#designerInspectorForm');
  if (!selection || !control) {
    if (empty) empty.hidden = false;
    if (form) form.hidden = true;
    return;
  }

  if (empty) empty.hidden = true;
  if (form) form.hidden = false;
  const type = document.querySelector('#designerInspectorType');
  const location = document.querySelector('#designerInspectorLocation');
  const idField = document.querySelector('#designerInspectorIdField');
  const textField = document.querySelector('#designerInspectorTextField');
  const optionsField = document.querySelector('#designerInspectorOptionsField');
  const id = document.querySelector('#designerInspectorId');
  const text = document.querySelector('#designerInspectorText');
  const options = document.querySelector('#designerInspectorOptions');

  if (type) type.textContent = displayControlType(control.type);
  if (location) location.textContent = inspectorLocation(control);
  if (idField) idField.hidden = control.type === 'text';
  if (textField) textField.hidden = !['text', 'button', 'checkbox'].includes(control.type);
  if (optionsField) optionsField.hidden = !['combo', 'listbox', 'radio'].includes(control.type);
  if (id) id.value = control.id ?? '';
  if (text) text.value = control.textExpr ?? '';
  if (options) options.value = control.options?.join(', ') ?? '';
  clearInspectorError();
}

function currentSharedControl() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  return listDesignerControls(code.value).find(control => sameLocation(control, selection)) ?? null;
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

function displayControlType(type) {
  if (type === 'tree') return 'TreeView';
  if (type === 'combo') return 'ComboBox';
  if (type === 'listbox') return 'ListBox';
  if (type === 'tabs') return 'Tabs';
  if (type === 'table') return 'Table';
  const text = String(type ?? 'Control');
  return text ? text[0].toUpperCase() + text.slice(1) : 'Control';
}

function inspectorLocation(control) {
  let suffix = '';
  if (control.type === 'tree') suffix = ` · ${countTreeNodes(control.treeNodes)} nodes`;
  if (control.type === 'table') suffix = ` · ${(control.columns ?? []).length} columns · ${(control.rows ?? []).length} rows`;
  return `Window ${control.windowIndex + 1} · control ${control.controlIndex + 1} · line ${control.line}${suffix}`;
}

function countTreeNodes(nodes = []) {
  return (nodes ?? []).reduce((count, node) => count + 1 + countTreeNodes(node.children), 0);
}

function splitOptionExpressions(text) {
  const out = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let depth = 0;
  for (const ch of String(text ?? '')) {
    if (quote) {
      current += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '(' || ch === '[') depth += 1;
    if ((ch === ')' || ch === ']') && depth > 0) depth -= 1;
    if (ch === ',' && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function revealLine(line) {
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let index = 0; index < line - 1; index += 1) start += lines[index].length + 1;
  const end = start + (lines[line - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function showInspectorError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function clearInspectorError() {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = '';
  target.hidden = true;
}
