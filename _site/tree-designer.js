import {
  addDesignerControl,
  listDesignerControls
} from './src/designer.js?v=9ad29318e93c7c71';
import {
  decorateDesignerAdapterElement,
  installDesignerSelectionBridge,
  rememberDesignerSelection,
  restoreDesignerAdapterSelection,
  selectDesignerElement
} from './designer-selection.js?v=9ad29318e93c7c71';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const addTree = document.querySelector('#addTree');
let scheduled = false;

installDesignerSelectionBridge(canvas);
installTool();
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

  restoreDesignerAdapterSelection(canvas, 'tree', treeElement);
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
    selectDesignerElement(canvas, element, liveSelection, { reason: 'tree-control' });
  };
  element.addEventListener('click', select);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') select(event);
  });
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