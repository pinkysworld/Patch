import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import { formControlDefaultSize } from '../src/form-layout.js';
import {
  clearDesignerSelection,
  currentDesignerSelection,
  decorateDesignerAdapterElement,
  installDesignerSelectionBridge,
  rememberDesignerSelection,
  restoreDesignerAdapterSelection,
  selectDesignerElement
} from './designer-selection.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const addTree = document.querySelector('#addTree');
let scheduled = false;

installDesignerSelectionBridge(canvas);
installTool();
installInspectorBridge();
observeCanvas();
code?.addEventListener('input', scheduleSync);
code?.addEventListener('change', scheduleSync);
scheduleSync();

function installTool() {
  addTree?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const activeForm = Number(document.querySelector('#patchFormSelect')?.value) || 0;
      const next = addDesignerControl(code.value, 'tree', { windowIndex: activeForm });
      const trees = listDesignerControls(next).filter(item => item.windowIndex === activeForm && item.type === 'tree');
      const added = trees[trees.length - 1];
      if (added) rememberDesignerSelection(canvas, treeSelection(added), { reason: 'add-tree' });
      setSource(next);
    } catch (error) {
      showError(error);
    }
  }, { capture: true });
}

function installInspectorBridge() {
  document.querySelector('#designerInspectorApply')?.addEventListener('click', event => {
    const selection = activeTreeSelection();
    if (!selection) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const id = document.querySelector('#designerInspectorId')?.value ?? '';
      const next = updateDesignerControl(code.value, selection, { id });
      const updated = listDesignerControls(next).find(item =>
        item.windowIndex === selection.windowIndex &&
        item.controlIndex === selection.controlIndex &&
        item.type === 'tree'
      );
      if (updated) rememberDesignerSelection(canvas, treeSelection(updated), { emit: false });
      setSource(next);
    } catch (error) {
      showError(error);
    }
  }, { capture: true });

  document.querySelector('#designerInspectorDelete')?.addEventListener('click', event => {
    const selection = activeTreeSelection();
    if (!selection) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const next = removeDesignerControl(code.value, selection);
      clearDesignerSelection(canvas, { adapter: 'tree', reason: 'delete-tree' });
      setSource(next);
    } catch (error) {
      showError(error);
    }
  }, { capture: true });

  document.querySelector('#designerInspectorSource')?.addEventListener('click', event => {
    const selection = activeTreeSelection();
    if (!selection) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const control = treeControl(selection);
    if (control) revealLine(control.line);
  }, { capture: true });
}

function observeCanvas() {
  if (!canvas) return;
  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true });
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try { syncTrees(); } catch { /* normal while source is temporarily invalid */ }
  });
}

function syncTrees() {
  if (!canvas || !code) return;
  const controls = listDesignerControls(code.value);
  const shells = [...canvas.querySelectorAll('.patch-window')];

  shells.forEach((shell, windowIndex) => {
    const trees = [...shell.querySelectorAll(':scope > .patch-window-body > .patch-tree')];
    const models = controls.filter(item => item.windowIndex === windowIndex && item.type === 'tree');
    trees.forEach((element, index) => {
      const model = models[index];
      if (!model) return;
      const selection = treeSelection(model);
      element.dataset.patchDesignerTree = 'true';
      decorateTree(element, model, selection);
    });
  });

  const restored = restoreDesignerAdapterSelection(canvas, 'tree', treeElement);
  const selection = currentDesignerSelection(canvas, 'tree');
  if (restored && selection) {
    populateInspector(selection);
    ensureTreeResizeHandle(restored, selection);
  }
}

function decorateTree(element, model, selection) {
  element.classList.add('designer-control', 'patch-tree-designer-control');
  element.tabIndex = 0;
  element.setAttribute('aria-label', `Select TreeView control ${model.id ?? selection.controlIndex + 1}`);
  decorateDesignerAdapterElement(canvas, element, selection);
  if (element.dataset.patchTreeDesignerBound === 'true') return;
  element.dataset.patchTreeDesignerBound = 'true';

  const select = event => {
    event.preventDefault();
    event.stopPropagation();
    const liveSelection = treeSelectionFromElement(element);
    if (!liveSelection) return;
    for (const handle of canvas.querySelectorAll('.patch-form-resize-handle')) handle.remove();
    selectDesignerElement(canvas, element, liveSelection, { reason: 'tree-control' });
    populateInspector(liveSelection);
    ensureTreeResizeHandle(element, liveSelection);
  };
  element.addEventListener('click', select);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') select(event);
  });
}

function populateInspector(selection) {
  const control = treeControl(selection);
  if (!control) return;
  const empty = document.querySelector('#designerInspectorEmpty');
  const form = document.querySelector('#designerInspectorForm');
  if (empty) empty.hidden = true;
  if (form) form.hidden = false;
  const type = document.querySelector('#designerInspectorType');
  const location = document.querySelector('#designerInspectorLocation');
  const idField = document.querySelector('#designerInspectorIdField');
  const textField = document.querySelector('#designerInspectorTextField');
  const optionsField = document.querySelector('#designerInspectorOptionsField');
  const id = document.querySelector('#designerInspectorId');
  if (type) type.textContent = 'TreeView';
  if (location) location.textContent = `Window ${control.windowIndex + 1} · control ${control.controlIndex + 1} · line ${control.line} · ${countTreeNodes(control.treeNodes)} nodes`;
  if (idField) idField.hidden = false;
  if (textField) textField.hidden = true;
  if (optionsField) optionsField.hidden = true;
  if (id) id.value = control.id ?? '';
  syncGeometryFields(control);
  const error = document.querySelector('#designerInspectorError');
  if (error) { error.hidden = true; error.textContent = ''; }
}

function syncGeometryFields(control) {
  const defaults = formControlDefaultSize('tree');
  const values = {
    patchControlX: control.x ?? 24,
    patchControlY: control.y ?? (24 + control.controlIndex * 48),
    patchControlWidth: control.width ?? defaults.width,
    patchControlHeight: control.height ?? defaults.height
  };
  for (const [id, value] of Object.entries(values)) {
    const field = document.querySelector(`#${id}`);
    if (field) field.value = String(value);
  }
}

function ensureTreeResizeHandle(element, selection) {
  const body = element.parentElement;
  if (!body) return;
  const selector = `.patch-form-resize-handle[data-window-index="${selection.windowIndex}"][data-control-index="${selection.controlIndex}"]`;
  let handle = body.querySelector(selector);
  for (const other of body.querySelectorAll('.patch-form-resize-handle')) {
    if (other !== handle) other.remove();
  }
  if (!handle) {
    handle = document.createElement('span');
    handle.className = 'patch-form-resize-handle';
    handle.dataset.windowIndex = String(selection.windowIndex);
    handle.dataset.controlIndex = String(selection.controlIndex);
    body.appendChild(handle);
  }
  const x = parseInt(element.style.left, 10) || 0;
  const y = parseInt(element.style.top, 10) || 0;
  const width = parseInt(element.style.width, 10) || element.offsetWidth;
  const height = parseInt(element.style.height, 10) || element.offsetHeight;
  handle.style.left = `${x + width - 7}px`;
  handle.style.top = `${y + height - 7}px`;
}

function activeTreeSelection() {
  const selection = currentDesignerSelection(canvas, 'tree');
  if (!selection) return null;
  const element = treeElement(selection);
  if (!element?.classList.contains('designer-selected')) return null;
  return selection;
}

function treeControl(selection) {
  return listDesignerControls(code.value).find(item =>
    item.windowIndex === selection.windowIndex &&
    item.controlIndex === selection.controlIndex &&
    item.type === 'tree'
  ) ?? null;
}

function treeElement(selection) {
  if (!canvas || !selection) return null;
  return canvas.querySelector(
    `.patch-tree[data-patch-designer-tree="true"][data-window-index="${selection.windowIndex}"][data-control-index="${selection.controlIndex}"]`
  );
}

function treeSelection(control) {
  return {
    windowIndex: control.windowIndex,
    controlIndex: control.controlIndex,
    adapter: 'tree',
    id: control.id ?? ''
  };
}

function treeSelectionFromElement(element) {
  const windowIndex = Number(element?.dataset?.windowIndex);
  const controlIndex = Number(element?.dataset?.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  const control = listDesignerControls(code.value).find(item =>
    item.windowIndex === windowIndex && item.controlIndex === controlIndex && item.type === 'tree'
  );
  return control ? treeSelection(control) : null;
}

function countTreeNodes(nodes = []) {
  return (nodes ?? []).reduce((count, node) => count + 1 + countTreeNodes(node.children), 0);
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

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (target) {
    target.textContent = error?.message ?? String(error);
    target.hidden = false;
  }
}
