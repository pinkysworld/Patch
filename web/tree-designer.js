import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const addTree = document.querySelector('#addTree');
let selectedTree = null;
let scheduled = false;

installTool();
installInspectorBridge();
observeCanvas();
code?.addEventListener('input', scheduleSync);
code?.addEventListener('change', scheduleSync);
canvas?.addEventListener('click', event => {
  if (!event.target.closest?.('.patch-tree[data-patch-designer-tree="true"]')) selectedTree = null;
}, { capture: true });
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
      selectedTree = added ? { windowIndex: added.windowIndex, controlIndex: added.controlIndex } : null;
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
      selectedTree = selection;
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
      selectedTree = null;
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
      const selection = { windowIndex, controlIndex: model.controlIndex };
      element.dataset.windowIndex = String(windowIndex);
      element.dataset.controlIndex = String(model.controlIndex);
      element.dataset.patchDesignerTree = 'true';
      decorateTree(element, model, selection);
    });
  });

  if (selectedTree) {
    const element = treeElement(selectedTree);
    if (element) {
      element.classList.add('designer-selected');
      populateInspector(selectedTree);
    } else {
      selectedTree = null;
    }
  }
}

function decorateTree(element, model, selection) {
  element.classList.add('designer-control', 'patch-tree-designer-control');
  element.tabIndex = 0;
  element.setAttribute('aria-label', `Select TreeView control ${model.id ?? selection.controlIndex + 1}`);
  element.classList.toggle('designer-selected', sameSelection(selectedTree, selection));
  if (element.dataset.patchTreeDesignerBound === 'true') return;
  element.dataset.patchTreeDesignerBound = 'true';

  const select = event => {
    event.preventDefault();
    event.stopPropagation();
    selectedTree = selection;
    for (const current of canvas.querySelectorAll('.designer-control.designer-selected')) current.classList.remove('designer-selected');
    element.classList.add('designer-selected');
    populateInspector(selection);
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
  const error = document.querySelector('#designerInspectorError');
  if (error) { error.hidden = true; error.textContent = ''; }
}

function activeTreeSelection() {
  if (!selectedTree) return null;
  const element = treeElement(selectedTree);
  if (!element?.classList.contains('designer-selected')) return null;
  return selectedTree;
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

function countTreeNodes(nodes = []) {
  return (nodes ?? []).reduce((count, node) => count + 1 + countTreeNodes(node.children), 0);
}

function sameSelection(a, b) {
  return Boolean(a && b && a.windowIndex === b.windowIndex && a.controlIndex === b.controlIndex);
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
