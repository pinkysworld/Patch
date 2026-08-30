import { listDesignerControls } from '../src/designer.js';
import {
  addDesignerTabPage,
  addTreeChild,
  addTreeRoot,
  flattenTreeNodes,
  indentTreeNode,
  listDesignerTabPages,
  moveDesignerTabPage,
  moveTreeNode,
  outdentTreeNode,
  removeDesignerTabPage,
  removeTreeNode,
  renameDesignerTabPage,
  renameTreeNode,
  treeNodeAt,
  updateDesignerTableData,
  updateDesignerTreeNodes
} from '../src/designer-data.js';
import { currentDesignerSelection } from './designer-selection.js';
import { installDesignerStructuralKeyboard } from './designer-structural-keyboard.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const inspectorForm = document.querySelector('#designerInspectorForm');
const selectedTreePaths = new Map();
const selectedTabPages = new Map();
let scheduled = false;

installStylesheet();
const panel = installPanel();
installDesignerStructuralKeyboard(panel);
observe();
scheduleSync();

function installPanel() {
  if (!inspectorForm) return null;
  const existing = inspectorForm.querySelector('[data-designer-data-editor]');
  if (existing) return existing;
  const section = document.createElement('section');
  section.className = 'designer-data-editor';
  section.dataset.designerDataEditor = '1';
  section.hidden = true;
  const error = inspectorForm.querySelector('#designerInspectorError');
  inspectorForm.insertBefore(section, error ?? inspectorForm.querySelector('.inspector-actions'));
  section.addEventListener('click', handleAction);
  return section;
}

function observe() {
  if (canvas) {
    new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    canvas.addEventListener('click', () => queueMicrotask(scheduleSync));
    canvas.addEventListener('keydown', () => queueMicrotask(scheduleSync));
    canvas.addEventListener('patch-designer-selection-change', scheduleSync);
  }
  code?.addEventListener('input', scheduleSync);
  code?.addEventListener('change', scheduleSync);
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try { syncPanel(); } catch { hidePanel(); }
  });
}

function syncPanel() {
  if (!panel || !code || !canvas) return;
  const selected = selectedControl();
  if (!selected || !['tree', 'table', 'tabs'].includes(selected.type)) {
    hidePanel();
    return;
  }
  panel.hidden = false;
  if (selected.type === 'tree') renderTreeEditor(selected);
  else if (selected.type === 'table') renderTableEditor(selected);
  else renderTabsEditor(selected);
}

function selectedControl() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  return listDesignerControls(code.value).find(item =>
    Number(item.windowIndex) === Number(selection.windowIndex) &&
    Number(item.controlIndex) === Number(selection.controlIndex)
  ) ?? null;
}

function renderTreeEditor(control) {
  const key = controlKey(control);
  const flat = flattenTreeNodes(control.treeNodes ?? []);
  let path = selectedTreePaths.get(key);
  if (!path || !safeTreeNode(control.treeNodes, path)) path = flat[0]?.path ?? null;
  if (path) selectedTreePaths.set(key, path);
  const selected = path ? treeNodeAt(control.treeNodes, path) : null;

  panel.innerHTML = `
    <div class="designer-data-editor-head"><strong>Tree nodes</strong><span>${flat.length} node${flat.length === 1 ? '' : 's'}</span></div>
    <div class="designer-tree-node-list" role="listbox" aria-label="TreeView nodes">
      ${flat.map(item => `<button type="button" class="designer-tree-node${samePath(item.path, path) ? ' active' : ''}" data-tree-path="${item.path.join('.')}" role="option" aria-selected="${samePath(item.path, path)}" style="--tree-depth:${item.depth}">${escapeHtml(displayExpr(item.labelExpr))}</button>`).join('')}
    </div>
    <label class="inspector-field">Node label expression <input id="designerTreeNodeLabel" spellcheck="false" value="${escapeAttr(selected?.labelExpr ?? '')}"></label>
    <div class="designer-data-actions">
      <button type="button" class="secondary" data-tree-action="add-root">+ Root</button>
      <button type="button" class="secondary" data-tree-action="add-child" ${path ? '' : 'disabled'}>+ Child</button>
      <button type="button" class="secondary" data-tree-action="rename" ${path ? '' : 'disabled'}>Rename</button>
      <button type="button" class="secondary" data-tree-action="up" ${path ? '' : 'disabled'}>↑</button>
      <button type="button" class="secondary" data-tree-action="down" ${path ? '' : 'disabled'}>↓</button>
      <button type="button" class="secondary" data-tree-action="indent" ${path ? '' : 'disabled'}>Indent</button>
      <button type="button" class="secondary" data-tree-action="outdent" ${path ? '' : 'disabled'}>Outdent</button>
      <button type="button" class="danger" data-tree-action="delete" ${path ? '' : 'disabled'}>Delete node</button>
    </div>
    <p class="inspector-hint designer-keyboard-hint">Keyboard: ↑/↓ or Home/End selects nodes; Ctrl/Cmd+↑/↓ reorders; Ctrl/Cmd+←/→ outdents/indents; Ctrl/Cmd+Enter focuses the label. Ctrl/Cmd+Enter in the label applies Rename.</p>`;
}

function renderTableEditor(control) {
  const columns = control.columns ?? [];
  const rows = control.rows ?? [];
  panel.innerHTML = `
    <div class="designer-data-editor-head"><strong>Table data</strong><span>${columns.length} column${columns.length === 1 ? '' : 's'} · ${rows.length} row${rows.length === 1 ? '' : 's'}</span></div>
    <div class="designer-table-editor" style="--table-columns:${Math.max(1, columns.length)}">
      <div class="designer-table-editor-row designer-table-editor-columns">
        ${columns.map((column, index) => `<label>Column ${index + 1}<input data-table-column="${index}" spellcheck="false" value="${escapeAttr(column)}"></label>`).join('')}
      </div>
      ${rows.map((row, rowIndex) => `<div class="designer-table-editor-row" data-table-row="${rowIndex}">
        ${row.map((cell, cellIndex) => `<input aria-label="Row ${rowIndex + 1} cell ${cellIndex + 1}" data-table-cell="${rowIndex}:${cellIndex}" spellcheck="false" value="${escapeAttr(cell)}">`).join('')}
        <button type="button" class="danger small" data-table-remove-row="${rowIndex}" aria-label="Delete row ${rowIndex + 1}">×</button>
      </div>`).join('')}
    </div>
    <div class="designer-data-actions">
      <button type="button" class="secondary" data-table-action="apply">Apply data</button>
      <button type="button" class="secondary" data-table-action="add-column">+ Column</button>
      <button type="button" class="secondary" data-table-action="remove-column" ${columns.length <= 1 ? 'disabled' : ''}>− Column</button>
      <button type="button" class="secondary" data-table-action="add-row">+ Row</button>
    </div>
    <p class="inspector-hint">Cells are Patch expressions. Editing this grid rewrites only the selected source-backed <code>table</code>/<code>row</code> block. <span class="designer-keyboard-hint">Ctrl/Cmd+Enter in any cell or column applies the current grid.</span></p>`;
}

function renderTabsEditor(control) {
  const pages = listDesignerTabPages(code.value, control);
  const key = controlKey(control);
  let pageIndex = selectedTabPages.get(key) ?? 0;
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) pageIndex = 0;
  selectedTabPages.set(key, pageIndex);
  const page = pages[pageIndex] ?? null;

  panel.innerHTML = `
    <div class="designer-data-editor-head"><strong>Tab pages</strong><span>${pages.length} pages</span></div>
    <div class="designer-tabs-page-list" role="listbox" aria-label="Tabs pages">
      ${pages.map(item => `<button type="button" class="designer-tabs-page${item.pageIndex === pageIndex ? ' active' : ''}" data-tab-page-index="${item.pageIndex}" role="option" aria-selected="${item.pageIndex === pageIndex}"><span>${escapeHtml(displayExpr(item.titleExpr))}</span><small>${item.controlIds.length} control${item.controlIds.length === 1 ? '' : 's'}</small></button>`).join('')}
    </div>
    <label class="inspector-field">Page title expression <input id="designerTabPageTitle" spellcheck="false" value="${escapeAttr(page?.titleExpr ?? '')}"></label>
    <div class="designer-data-actions">
      <button type="button" class="secondary" data-tabs-action="add">+ Page</button>
      <button type="button" class="secondary" data-tabs-action="rename" ${page ? '' : 'disabled'}>Rename</button>
      <button type="button" class="secondary" data-tabs-action="up" ${pageIndex <= 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="secondary" data-tabs-action="down" ${pageIndex >= pages.length - 1 ? 'disabled' : ''}>↓</button>
      <button type="button" class="danger" data-tabs-action="delete" ${pages.length <= 2 ? 'disabled' : ''}>Delete page</button>
    </div>
    <p class="inspector-hint">Tabs Stage 1 keeps at least two pages. Reordering preserves each page body; deleting a page also removes handlers that belong only to controls removed with that page. <span class="designer-keyboard-hint">↑/↓ or Home/End selects pages; Ctrl/Cmd+↑/↓ reorders; Ctrl/Cmd+Enter focuses the title, and Ctrl/Cmd+Enter there applies Rename.</span></p>`;
}

function handleAction(event) {
  const treePathButton = event.target.closest?.('[data-tree-path]');
  if (treePathButton) {
    const control = selectedControl();
    if (!control || control.type !== 'tree') return;
    selectedTreePaths.set(controlKey(control), parsePath(treePathButton.dataset.treePath));
    renderTreeEditor(control);
    return;
  }

  const treeAction = event.target.closest?.('[data-tree-action]')?.dataset.treeAction;
  if (treeAction) {
    event.preventDefault();
    applyTreeAction(treeAction);
    return;
  }

  const tabPage = event.target.closest?.('[data-tab-page-index]');
  if (tabPage) {
    const control = selectedControl();
    if (!control || control.type !== 'tabs') return;
    selectedTabPages.set(controlKey(control), Number(tabPage.dataset.tabPageIndex));
    renderTabsEditor(control);
    return;
  }

  const tabAction = event.target.closest?.('[data-tabs-action]')?.dataset.tabsAction;
  if (tabAction) {
    event.preventDefault();
    applyTabAction(tabAction);
    return;
  }

  const tableAction = event.target.closest?.('[data-table-action]')?.dataset.tableAction;
  if (tableAction) {
    event.preventDefault();
    applyTableAction(tableAction);
    return;
  }

  const removeRow = event.target.closest?.('[data-table-remove-row]');
  if (removeRow) {
    event.preventDefault();
    removeTableRow(Number(removeRow.dataset.tableRemoveRow));
  }
}

function applyTreeAction(action) {
  const control = selectedControl();
  if (!control || control.type !== 'tree') return;
  try {
    const key = controlKey(control);
    const path = selectedTreePaths.get(key) ?? null;
    const labelExpr = panel.querySelector('#designerTreeNodeLabel')?.value ?? '"Node"';
    const result = action === 'add-root'
      ? addTreeRoot(control.treeNodes, '"Node"')
      : action === 'add-child'
        ? addTreeChild(control.treeNodes, path, '"Child"')
        : action === 'rename'
          ? renameTreeNode(control.treeNodes, path, labelExpr)
          : action === 'up' || action === 'down'
            ? moveTreeNode(control.treeNodes, path, action)
            : action === 'indent'
              ? indentTreeNode(control.treeNodes, path)
              : action === 'outdent'
                ? outdentTreeNode(control.treeNodes, path)
                : action === 'delete'
                  ? removeTreeNode(control.treeNodes, path)
                  : null;
    if (!result) return;
    if (result.path) selectedTreePaths.set(key, result.path);
    const next = updateDesignerTreeNodes(code.value, control, result.treeNodes);
    setSource(next);
  } catch (error) { showError(error); }
}

function applyTabAction(action) {
  const control = selectedControl();
  if (!control || control.type !== 'tabs') return;
  try {
    const key = controlKey(control);
    let pageIndex = selectedTabPages.get(key) ?? 0;
    let next = code.value;
    if (action === 'add') {
      const result = addDesignerTabPage(next, control, { titleExpr: '"New page"' });
      pageIndex = result.page.pageIndex;
      next = result.source;
    } else if (action === 'rename') {
      next = renameDesignerTabPage(next, control, pageIndex, panel.querySelector('#designerTabPageTitle')?.value ?? '"Page"');
    } else if (action === 'up' || action === 'down') {
      const result = moveDesignerTabPage(next, control, pageIndex, action);
      pageIndex = result.pageIndex;
      next = result.source;
    } else if (action === 'delete') {
      const result = removeDesignerTabPage(next, control, pageIndex);
      pageIndex = result.pageIndex;
      next = result.source;
    }
    selectedTabPages.set(key, pageIndex);
    setSource(next);
  } catch (error) { showError(error); }
}

function applyTableAction(action) {
  const control = selectedControl();
  if (!control || control.type !== 'table') return;
  try {
    const data = tableDataFromPanel(control);
    if (action === 'apply') {
      setSource(updateDesignerTableData(code.value, control, data));
      return;
    }
    if (action === 'add-column') {
      data.columns.push('"Column"');
      for (const row of data.rows) row.push('""');
    } else if (action === 'remove-column') {
      if (data.columns.length <= 1) return;
      data.columns.pop();
      for (const row of data.rows) row.pop();
    } else if (action === 'add-row') {
      data.rows.push(data.columns.map(() => '""'));
    }
    setSource(updateDesignerTableData(code.value, control, data));
  } catch (error) { showError(error); }
}

function removeTableRow(rowIndex) {
  const control = selectedControl();
  if (!control || control.type !== 'table') return;
  try {
    const data = tableDataFromPanel(control);
    data.rows.splice(rowIndex, 1);
    setSource(updateDesignerTableData(code.value, control, data));
  } catch (error) { showError(error); }
}

function tableDataFromPanel(control) {
  const columns = [...panel.querySelectorAll('[data-table-column]')].map(input => input.value.trim());
  const rows = (control.rows ?? []).map((_, rowIndex) => columns.map((__, cellIndex) =>
    panel.querySelector(`[data-table-cell="${rowIndex}:${cellIndex}"]`)?.value.trim() ?? '""'
  ));
  return { columns, rows };
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function hidePanel() {
  if (!panel) return;
  panel.hidden = true;
  panel.replaceChildren();
}

function controlKey(control) {
  return `${control.windowIndex}:${control.controlIndex}:${control.id ?? control.type}`;
}

function samePath(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function safeTreeNode(nodes, path) {
  try { return treeNodeAt(nodes, path); } catch { return null; }
}

function parsePath(value) {
  if (!String(value ?? '').length) return [];
  return String(value).split('.').map(Number);
}

function displayExpr(expr) {
  const text = String(expr ?? '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
  return text;
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/`/g, '&#96;');
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function installStylesheet() {
  if (document.querySelector('style[data-patch-designer-data-editor]')) return;
  const style = document.createElement('style');
  style.dataset.patchDesignerDataEditor = '1';
  style.textContent = `
.designer-data-editor{border:1px solid var(--border);border-radius:10px;padding:10px;margin:10px 0;background:var(--soft)}
.designer-data-editor[hidden]{display:none}
.designer-data-editor-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.designer-data-editor-head span{color:var(--muted);font-size:12px}
.designer-tree-node-list,.designer-tabs-page-list{display:grid;gap:4px;max-height:190px;overflow:auto;margin:8px 0}
.designer-tree-node,.designer-tabs-page{display:flex;justify-content:space-between;align-items:center;text-align:left;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:8px;padding:6px 8px}
.designer-tree-node{padding-left:calc(8px + var(--tree-depth, 0) * 16px)}
.designer-tree-node.active,.designer-tabs-page.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.designer-tabs-page small{color:var(--muted)}
.designer-data-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.designer-table-editor{display:grid;gap:4px;overflow:auto;margin:8px 0}
.designer-table-editor-row{display:grid;grid-template-columns:repeat(var(--table-columns, 1),minmax(110px,1fr)) auto;gap:4px;align-items:end}
.designer-table-editor-columns{grid-template-columns:repeat(var(--table-columns, 1),minmax(110px,1fr))}
.designer-table-editor input{width:100%;box-sizing:border-box}
`;
  document.head.appendChild(style);
}
