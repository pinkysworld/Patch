import { listDesignerControls } from './src/designer.js?v=9ad29318e93c7c71';
import {
  addTreeChild,
  addTreeRoot,
  flattenTreeNodes,
  indentTreeNode,
  moveTreeNode,
  outdentTreeNode,
  removeTreeNode,
  renameTreeNode,
  treeNodeAt
} from './src/designer-data.js?v=9ad29318e93c7c71';
import {
  addDesignerTabPageControl,
  listDesignerTabPageControls,
  removeDesignerTabPageControl,
  supportedDesignerTabControlTypes,
  updateDesignerTabPageTableData,
  updateDesignerTabPageTreeNodes
} from './src/designer-tabs-nested.js?v=9ad29318e93c7c71';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const panel = document.querySelector('[data-designer-data-editor]');
const selectedStructures = new Map();
const selectedTreePaths = new Map();
let scheduled = false;

if (panel) {
  new MutationObserver(scheduleEnhance).observe(panel, { childList: true, subtree: true });
  panel.addEventListener('click', handleClick);
}
code?.addEventListener('input', scheduleEnhance);
code?.addEventListener('change', scheduleEnhance);
canvas?.addEventListener('click', () => queueMicrotask(scheduleEnhance));
scheduleEnhance();

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try { enhanceTabsEditor(); } catch { removeEnhancement(); }
  });
}

function enhanceTabsEditor() {
  if (!panel || panel.hidden) return removeEnhancement();
  const control = selectedTabsControl();
  const activePage = panel.querySelector('.designer-tabs-page.active[data-tab-page-index]');
  if (!control || !activePage) return removeEnhancement();

  const pageIndex = Number(activePage.dataset.tabPageIndex);
  if (!Number.isInteger(pageIndex)) return removeEnhancement();
  const controls = listDesignerTabPageControls(code.value, control, pageIndex);
  const contextKey = nestedContextKey(control, pageIndex);
  let structureIndex = selectedStructures.get(contextKey);
  let structure = controls.find(item => item.controlIndex === structureIndex && ['table', 'tree'].includes(item.type)) ?? null;
  if (!structure) {
    selectedStructures.delete(contextKey);
    structureIndex = null;
  }

  let treePath = null;
  if (structure?.type === 'tree') {
    const key = nestedTreeKey(contextKey, structure);
    const flat = flattenTreeNodes(structure.treeNodes ?? []);
    treePath = selectedTreePaths.get(key);
    if (!treePath || !safeTreeNode(structure.treeNodes, treePath)) treePath = flat[0]?.path ?? null;
    if (treePath) selectedTreePaths.set(key, treePath);
  }

  const signature = `${control.windowIndex}:${control.controlIndex}:${pageIndex}:${controls.map(item => `${item.type}:${item.id ?? ''}:${item.line}:${item.columns.length}:${item.rows.length}:${flattenTreeNodes(item.treeNodes).length}`).join('|')}:edit=${structureIndex ?? ''}:path=${treePath?.join('.') ?? ''}`;
  const existing = panel.querySelector('[data-tabs-nested-controls]');
  if (existing?.dataset.signature === signature) return;
  existing?.remove();

  const section = document.createElement('div');
  section.className = 'designer-tabs-nested-controls';
  section.dataset.tabsNestedControls = '1';
  section.dataset.signature = signature;
  section.dataset.pageIndex = String(pageIndex);
  section.innerHTML = `
    <div class="designer-data-editor-head"><strong>Page controls</strong><span>${controls.length} control${controls.length === 1 ? '' : 's'}</span></div>
    <div class="designer-tabs-control-list" role="list" aria-label="Controls in selected tab page">
      ${controls.map(item => renderControlRow(item, controls.length, structureIndex)).join('')}
    </div>
    ${structure ? renderStructureEditor(structure, treePath) : ''}
    <div class="designer-tabs-control-add">
      <label>New control <select data-tabs-control-type>${supportedDesignerTabControlTypes().map(type => `<option value="${type}">${escapeHtml(displayType(type))}</option>`).join('')}</select></label>
      <button type="button" class="secondary" data-tabs-add-control>Add control</button>
    </div>
    <p class="inspector-hint">Nested controls use Tabs flow layout and remain ordinary visible Patch source. Table columns/rows and TreeView hierarchy can be edited here or directly in source. No second hidden Designer data model is created. Removing a named control also removes its event handler.</p>`;

  const hint = panel.querySelector('.inspector-hint:last-child');
  if (hint) hint.insertAdjacentElement('afterend', section);
  else panel.appendChild(section);
}

function renderControlRow(item, count, structureIndex) {
  const structural = ['table', 'tree'].includes(item.type);
  return `<div class="designer-tabs-control-row${item.controlIndex === structureIndex ? ' active' : ''}" role="listitem" data-tabs-control-index="${item.controlIndex}" data-tabs-control-kind="${item.type}">
    <span><strong>${escapeHtml(displayType(item.type))}</strong>${item.id ? `<small>${escapeHtml(item.id)}</small>` : '<small>unnamed</small>'}</span>
    <span class="designer-tabs-control-row-actions">
      ${structural ? `<button type="button" class="secondary small" data-tabs-edit-structure="${item.controlIndex}">${item.controlIndex === structureIndex ? 'Editing' : 'Edit'}</button>` : ''}
      <button type="button" class="danger small" data-tabs-remove-control="${item.controlIndex}" ${count <= 1 ? 'disabled' : ''}>Remove</button>
    </span>
  </div>`;
}

function renderStructureEditor(structure, treePath) {
  if (structure.type === 'table') return renderNestedTableEditor(structure);
  if (structure.type === 'tree') return renderNestedTreeEditor(structure, treePath);
  return '';
}

function renderNestedTableEditor(control) {
  const columns = control.columns ?? [];
  const rows = control.rows ?? [];
  return `<div class="designer-tabs-structure-editor" data-tabs-structure-editor="table" data-structure-control-index="${control.controlIndex}">
    <div class="designer-data-editor-head"><strong>Nested Table data</strong><span>${columns.length} column${columns.length === 1 ? '' : 's'} · ${rows.length} row${rows.length === 1 ? '' : 's'}</span></div>
    <div class="designer-table-editor" style="--table-columns:${Math.max(1, columns.length)}">
      <div class="designer-table-editor-row designer-table-editor-columns">
        ${columns.map((column, index) => `<label>Column ${index + 1}<input data-tabs-table-column="${index}" spellcheck="false" value="${escapeAttr(column)}"></label>`).join('')}
      </div>
      ${rows.map((row, rowIndex) => `<div class="designer-table-editor-row" data-tabs-table-row="${rowIndex}">
        ${row.map((cell, cellIndex) => `<input aria-label="Nested row ${rowIndex + 1} cell ${cellIndex + 1}" data-tabs-table-cell="${rowIndex}:${cellIndex}" spellcheck="false" value="${escapeAttr(cell)}">`).join('')}
        <button type="button" class="danger small" data-tabs-table-remove-row="${rowIndex}" aria-label="Delete nested row ${rowIndex + 1}">×</button>
      </div>`).join('')}
    </div>
    <div class="designer-data-actions">
      <button type="button" class="secondary" data-tabs-table-action="apply">Apply data</button>
      <button type="button" class="secondary" data-tabs-table-action="add-column">+ Column</button>
      <button type="button" class="secondary" data-tabs-table-action="remove-column" ${columns.length <= 1 ? 'disabled' : ''}>− Column</button>
      <button type="button" class="secondary" data-tabs-table-action="add-row">+ Row</button>
      <button type="button" class="secondary" data-tabs-close-structure>Close</button>
    </div>
    <p class="inspector-hint">Cells are Patch expressions. Applying rewrites only this nested <code>table</code>/<code>row</code> source block.</p>
  </div>`;
}

function renderNestedTreeEditor(control, path) {
  const flat = flattenTreeNodes(control.treeNodes ?? []);
  const selected = path ? treeNodeAt(control.treeNodes, path) : null;
  return `<div class="designer-tabs-structure-editor" data-tabs-structure-editor="tree" data-structure-control-index="${control.controlIndex}">
    <div class="designer-data-editor-head"><strong>Nested TreeView nodes</strong><span>${flat.length} node${flat.length === 1 ? '' : 's'}</span></div>
    <div class="designer-tree-node-list" role="listbox" aria-label="Nested TreeView nodes">
      ${flat.map(item => `<button type="button" class="designer-tree-node${samePath(item.path, path) ? ' active' : ''}" data-tabs-tree-path="${item.path.join('.')}" role="option" aria-selected="${samePath(item.path, path)}" style="--tree-depth:${item.depth}">${escapeHtml(displayExpr(item.labelExpr))}</button>`).join('')}
    </div>
    <label class="inspector-field">Node label expression <input data-tabs-tree-label spellcheck="false" value="${escapeAttr(selected?.labelExpr ?? '')}"></label>
    <div class="designer-data-actions">
      <button type="button" class="secondary" data-tabs-tree-action="add-root">+ Root</button>
      <button type="button" class="secondary" data-tabs-tree-action="add-child" ${path ? '' : 'disabled'}>+ Child</button>
      <button type="button" class="secondary" data-tabs-tree-action="rename" ${path ? '' : 'disabled'}>Rename</button>
      <button type="button" class="secondary" data-tabs-tree-action="up" ${path ? '' : 'disabled'}>↑</button>
      <button type="button" class="secondary" data-tabs-tree-action="down" ${path ? '' : 'disabled'}>↓</button>
      <button type="button" class="secondary" data-tabs-tree-action="indent" ${path ? '' : 'disabled'}>Indent</button>
      <button type="button" class="secondary" data-tabs-tree-action="outdent" ${path ? '' : 'disabled'}>Outdent</button>
      <button type="button" class="danger" data-tabs-tree-action="delete" ${path ? '' : 'disabled'}>Delete node</button>
      <button type="button" class="secondary" data-tabs-close-structure>Close</button>
    </div>
    <p class="inspector-hint">Every action rewrites the selected nested <code>tree</code>/<code>node</code> block and keeps at least one node.</p>
  </div>`;
}

function handleClick(event) {
  const add = event.target.closest?.('[data-tabs-add-control]');
  if (add) {
    event.preventDefault();
    const context = currentContext();
    if (!context) return;
    try {
      const type = panel.querySelector('[data-tabs-control-type]')?.value ?? 'text';
      setSource(addDesignerTabPageControl(code.value, context.control, context.pageIndex, type));
    } catch (error) { showError(error); }
    return;
  }

  const edit = event.target.closest?.('[data-tabs-edit-structure]');
  if (edit) {
    event.preventDefault();
    const context = currentContext();
    if (!context) return;
    selectedStructures.set(nestedContextKey(context.control, context.pageIndex), Number(edit.dataset.tabsEditStructure));
    scheduleEnhance();
    return;
  }

  if (event.target.closest?.('[data-tabs-close-structure]')) {
    event.preventDefault();
    const context = currentContext();
    if (!context) return;
    selectedStructures.delete(nestedContextKey(context.control, context.pageIndex));
    scheduleEnhance();
    return;
  }

  const treePathButton = event.target.closest?.('[data-tabs-tree-path]');
  if (treePathButton) {
    event.preventDefault();
    const structure = currentStructure('tree');
    if (!structure) return;
    selectedTreePaths.set(nestedTreeKey(structure.contextKey, structure.control), parsePath(treePathButton.dataset.tabsTreePath));
    scheduleEnhance();
    return;
  }

  const treeAction = event.target.closest?.('[data-tabs-tree-action]')?.dataset.tabsTreeAction;
  if (treeAction) {
    event.preventDefault();
    applyNestedTreeAction(treeAction);
    return;
  }

  const removeRow = event.target.closest?.('[data-tabs-table-remove-row]');
  if (removeRow) {
    event.preventDefault();
    applyNestedTableMutation(data => ({ ...data, rows: data.rows.filter((_, index) => index !== Number(removeRow.dataset.tabsTableRemoveRow)) }));
    return;
  }

  const tableAction = event.target.closest?.('[data-tabs-table-action]')?.dataset.tabsTableAction;
  if (tableAction) {
    event.preventDefault();
    if (tableAction === 'apply') applyNestedTableMutation(data => data);
    if (tableAction === 'add-row') applyNestedTableMutation(data => ({ ...data, rows: [...data.rows, data.columns.map(() => '""')] }));
    if (tableAction === 'add-column') applyNestedTableMutation(data => ({ columns: [...data.columns, JSON.stringify(`Column ${data.columns.length + 1}`)], rows: data.rows.map(row => [...row, '""']) }));
    if (tableAction === 'remove-column') applyNestedTableMutation(data => {
      if (data.columns.length <= 1) throw new Error('A Table needs at least one column.');
      return { columns: data.columns.slice(0, -1), rows: data.rows.map(row => row.slice(0, -1)) };
    });
    return;
  }

  const remove = event.target.closest?.('[data-tabs-remove-control]');
  if (!remove) return;
  event.preventDefault();
  const context = currentContext();
  if (!context) return;
  try {
    const contextKey = nestedContextKey(context.control, context.pageIndex);
    if (selectedStructures.get(contextKey) === Number(remove.dataset.tabsRemoveControl)) selectedStructures.delete(contextKey);
    setSource(removeDesignerTabPageControl(code.value, context.control, context.pageIndex, Number(remove.dataset.tabsRemoveControl)));
  } catch (error) { showError(error); }
}

function applyNestedTableMutation(transform) {
  const structure = currentStructure('table');
  if (!structure) return;
  try {
    const draft = readNestedTableDraft(structure.control);
    const next = transform(draft);
    setSource(updateDesignerTabPageTableData(code.value, structure.tabs, structure.pageIndex, structure.control.controlIndex, next));
  } catch (error) { showError(error); }
}

function readNestedTableDraft(control) {
  const columns = [...panel.querySelectorAll('[data-tabs-table-column]')].map(input => input.value.trim());
  const rows = (control.rows ?? []).map((_, rowIndex) => columns.map((__, cellIndex) =>
    panel.querySelector(`[data-tabs-table-cell="${rowIndex}:${cellIndex}"]`)?.value.trim() ?? '""'
  ));
  return { columns, rows };
}

function applyNestedTreeAction(action) {
  const structure = currentStructure('tree');
  if (!structure) return;
  const key = nestedTreeKey(structure.contextKey, structure.control);
  const path = selectedTreePaths.get(key) ?? flattenTreeNodes(structure.control.treeNodes ?? [])[0]?.path ?? null;
  try {
    let result;
    if (action === 'add-root') result = addTreeRoot(structure.control.treeNodes);
    else if (action === 'add-child') result = addTreeChild(structure.control.treeNodes, path);
    else if (action === 'rename') result = renameTreeNode(structure.control.treeNodes, path, panel.querySelector('[data-tabs-tree-label]')?.value ?? '');
    else if (action === 'up' || action === 'down') result = moveTreeNode(structure.control.treeNodes, path, action);
    else if (action === 'indent') result = indentTreeNode(structure.control.treeNodes, path);
    else if (action === 'outdent') result = outdentTreeNode(structure.control.treeNodes, path);
    else if (action === 'delete') result = removeTreeNode(structure.control.treeNodes, path);
    else return;
    selectedTreePaths.set(key, result.path);
    setSource(updateDesignerTabPageTreeNodes(code.value, structure.tabs, structure.pageIndex, structure.control.controlIndex, result.nodes));
  } catch (error) { showError(error); }
}

function currentStructure(expectedType = null) {
  const context = currentContext();
  if (!context) return null;
  const contextKey = nestedContextKey(context.control, context.pageIndex);
  const controlIndex = selectedStructures.get(contextKey);
  const control = listDesignerTabPageControls(code.value, context.control, context.pageIndex)
    .find(item => item.controlIndex === controlIndex && ['table', 'tree'].includes(item.type));
  if (!control || (expectedType && control.type !== expectedType)) return null;
  return { tabs: context.control, pageIndex: context.pageIndex, control, contextKey };
}

function currentContext() {
  const control = selectedTabsControl();
  const activePage = panel?.querySelector('.designer-tabs-page.active[data-tab-page-index]');
  const pageIndex = Number(activePage?.dataset.tabPageIndex);
  if (!control || !Number.isInteger(pageIndex)) return null;
  return { control, pageIndex };
}

function selectedTabsControl() {
  const element = canvas?.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  return listDesignerControls(code.value).find(item =>
    item.windowIndex === windowIndex && item.controlIndex === controlIndex && item.type === 'tabs'
  ) ?? null;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleEnhance();
}

function removeEnhancement() {
  panel?.querySelector('[data-tabs-nested-controls]')?.remove();
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (target) {
    target.textContent = error?.message ?? String(error);
    target.hidden = false;
  }
}

function nestedContextKey(control, pageIndex) {
  return `${control.windowIndex}:${control.controlIndex}:${control.id ?? 'tabs'}:${pageIndex}`;
}

function nestedTreeKey(contextKey, control) {
  return `${contextKey}:${control.id ?? control.controlIndex}`;
}

function safeTreeNode(nodes, path) {
  try { return treeNodeAt(nodes, path); } catch { return null; }
}

function parsePath(text) {
  return String(text ?? '').split('.').filter(Boolean).map(Number);
}

function samePath(a, b) {
  return Boolean(a && b && a.length === b.length && a.every((value, index) => value === b[index]));
}

function displayExpr(expr) {
  const text = String(expr ?? '').trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { /* show raw expression */ }
  }
  return text;
}

function displayType(type) {
  return ({ listbox: 'ListBox', checkbox: 'Checkbox', radio: 'Radio', combo: 'ComboBox', button: 'Button', input: 'Input', text: 'Text', table: 'Table', tree: 'TreeView' })[type] ?? String(type);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/`/g, '&#96;');
}
