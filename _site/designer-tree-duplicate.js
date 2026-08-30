import { listDesignerControls } from './src/designer.js?v=868f0784ca7f3972';
import { updateDesignerTreeNodes } from './src/designer-data.js?v=868f0784ca7f3972';
import {
  listDesignerTabPageControls,
  updateDesignerTabPageTreeNodes
} from './src/designer-tabs-nested.js?v=868f0784ca7f3972';
import { duplicateTreeSubtree } from './designer-tree-model.js?v=868f0784ca7f3972';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const panel = document.querySelector('[data-designer-data-editor]');
let scheduled = false;

if (panel) {
  new MutationObserver(scheduleSync).observe(panel, { childList: true, subtree: true });
  panel.addEventListener('click', handleClick);
}
code?.addEventListener('input', scheduleSync);
code?.addEventListener('change', scheduleSync);
canvas?.addEventListener('click', () => queueMicrotask(scheduleSync));
scheduleSync();

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try { syncDuplicateAction(); } catch { removeDuplicateActions(); }
  });
}

function syncDuplicateAction() {
  if (!panel || panel.hidden) return removeDuplicateActions();
  const context = currentTreeContext();
  if (!context) return removeDuplicateActions();
  const host = context.kind === 'nested'
    ? panel.querySelector('[data-tabs-structure-editor="tree"]')
    : panel;
  const actions = context.kind === 'nested'
    ? host?.querySelector('.designer-data-actions')
    : panel.querySelector(':scope > .designer-data-actions');
  if (!host || !actions) return removeDuplicateActions();
  if (actions.querySelector('[data-tree-duplicate-subtree]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary';
  button.dataset.treeDuplicateSubtree = '1';
  button.textContent = 'Duplicate';
  button.title = 'Duplicate the selected node and its complete subtree';
  const deleteButton = actions.querySelector('.danger');
  actions.insertBefore(button, deleteButton ?? null);
}

function handleClick(event) {
  const button = event.target.closest?.('[data-tree-duplicate-subtree]');
  if (!button) return;
  event.preventDefault();
  const context = currentTreeContext();
  if (!context) return;
  const path = selectedPath(context);
  if (!path) return;
  try {
    const result = duplicateTreeSubtree(context.tree.treeNodes ?? [], path);
    const next = context.kind === 'nested'
      ? updateDesignerTabPageTreeNodes(code.value, context.tabs, context.pageIndex, context.tree.controlIndex, result.nodes)
      : updateDesignerTreeNodes(code.value, context.tree, result.nodes);
    setSource(next);
  } catch (error) {
    showError(error);
  }
}

function currentTreeContext() {
  const selected = selectedTopLevelControl();
  if (!selected) return null;
  const nestedEditor = panel?.querySelector('[data-tabs-structure-editor="tree"][data-structure-control-index]');
  const nestedHost = panel?.querySelector('[data-tabs-nested-controls][data-page-index]');
  if (selected.type === 'tabs' && nestedEditor && nestedHost) {
    const pageIndex = Number(nestedHost.dataset.pageIndex);
    const controlIndex = Number(nestedEditor.dataset.structureControlIndex);
    if (!Number.isInteger(pageIndex) || !Number.isInteger(controlIndex)) return null;
    const tree = listDesignerTabPageControls(code.value, selected, pageIndex)
      .find(item => item.controlIndex === controlIndex && item.type === 'tree');
    if (!tree) return null;
    return { kind: 'nested', tabs: selected, pageIndex, tree };
  }
  if (selected.type === 'tree') return { kind: 'top', tree: selected };
  return null;
}

function selectedTopLevelControl() {
  if (!canvas || !code) return null;
  const element = canvas.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  return listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
}

function selectedPath(context) {
  const selector = context.kind === 'nested'
    ? '.designer-tree-node.active[data-tabs-tree-path]'
    : '.designer-tree-node.active[data-tree-path]';
  const element = panel?.querySelector(selector);
  const raw = context.kind === 'nested' ? element?.dataset.tabsTreePath : element?.dataset.treePath;
  if (!raw) return null;
  const path = String(raw).split('.').map(Number);
  return path.every(Number.isInteger) ? path : null;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function removeDuplicateActions() {
  panel?.querySelectorAll('[data-tree-duplicate-subtree]').forEach(element => element.remove());
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}
