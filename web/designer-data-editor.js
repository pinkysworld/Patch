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
  setTreeNodeHint,
  setTreeNodeImage,
  setTreeNodeState,
  treeNodeAt,
  updateDesignerTableData,
  updateDesignerTreeNodes
} from '../src/designer-data.js';
import { installDesignerStructuralKeyboard } from './designer-structural-keyboard.js';
import {
  defaultTableColumnPresentation,
  readWindowTableColumnPresentation,
  setWindowTableColumnPresentation
} from '../src/table-column-presentation.js';
import {
  clearDesignerInspectorError,
  currentDesignerSelection,
  showDesignerInspectorError
} from './designer-selection.js';

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
    item.windowIndex === selection.windowIndex && item.controlIndex === selection.controlIndex
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
    <label class="inspector-field">Node image <input id="designerTreeNodeImage" spellcheck="false" placeholder="tree_icons.folder" value="${escapeAttr(selected?.imageListId && selected?.imageItem ? `${selected.imageListId}.${selected.imageItem}` : '')}"></label>
    <label class="inspector-field">Node hint <input id="designerTreeNodeHint" spellcheck="false" placeholder="Shown as a tooltip" value="${escapeAttr(selected?.hint ?? '')}"></label>
    <label class="inspector-field">Node state <select id="designerTreeNodeState"><option value=""${selected?.state ? '' : ' selected'}>None</option><option value="muted"${selected?.state === 'muted' ? ' selected' : ''}>Muted</option><option value="info"${selected?.state === 'info' ? ' selected' : ''}>Info</option><option value="success"${selected?.state === 'success' ? ' selected' : ''}>Success</option><option value="warning"${selected?.state === 'warning' ? ' selected' : ''}>Warning</option><option value="danger"${selected?.state === 'danger' ? ' selected' : ''}>Danger</option></select></label>
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
    <p class="inspector-hint designer-keyboard-hint">Keyboard: ↑/↓ or Home/End selects nodes; Ctrl/Cmd+↑/↓ reorders; Ctrl/Cmd+←/→ outdents/indents; Ctrl/Cmd+Enter focuses the label. Ctrl/Cmd+Enter in the label, image, hint or state field applies the selected node source metadata.</p>`;
}

function renderTableEditor(control) {
  const columns = control.columns ?? [];
  const rows = control.rows ?? [];
  const presentation = readWindowTableColumnPresentation(code.value, control.line, columns.length) ?? defaultTableColumnPresentation(columns.length);
  panel.innerHTML = `
    <div class="designer-data-editor-head"><strong>Table data</strong><span>${columns.length} column${columns.length === 1 ? '' : 's'} · ${rows.length} row${rows.length === 1 ? '' : 's'}</span></div>
    <div class="designer-table-editor" style="--table-columns:${Math.max(1, columns.length)}">
      <div class="designer-table-editor-row designer-table-editor-columns">
        ${columns.map((column, index) => `<div class="designer-table-column-card"><label>Column ${index + 1}<input data-table-column="${index}" spellcheck="false" value="${escapeAttr(column)}"></label><label>Width px <input data-table-column-width="${index}" type="number" min="40" max="2000" placeholder="auto" value="${presentation[index]?.width ?? ''}"></label><label>Align <select data-table-column-align="${index}"><option value="left"${presentation[index]?.align === 'left' ? ' selected' : ''}>Left</option><option value="center"${presentation[index]?.align === 'center' ? ' selected' : ''}>Center</option><option value="right"${presentation[index]?.align === 'right' ? ' selected' : ''}>Right</option></select></label></div>`).join('')}
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
    <p class="inspector-hint">Cells are Patch expressions. Width/alignment are source-backed <code># @table-columns</code> presentation metadata and do not change row selection or Patch state. <span class="designer-keyboard-hint">Ctrl/Cmd+Enter in any cell or column applies the current grid.</span></p>`;
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

  const tabPageButton = event.target.closest?.('[data-tab-page-index]');
  if (tabPageButton) {
    const control = selectedControl();
    if (!control || control.type !== 'tabs') return;
    selectedTabPages.set(controlKey(control), Number(tabPageButton.dataset.tabPageIndex));
    renderTabsEditor(control);
    return;
  }

  const tabsAction = event.target.closest?.('[data-tabs-action]')?.dataset.tabsAction;
  if (tabsAction) {
    event.preventDefault();
    applyTabsAction(tabsAction);
    return;
  }

  const removeRow = event.target.closest?.('[data-table-remove-row]');
  if (removeRow) {
    event.preventDefault();
    applyTableMutation(data => ({ ...data, rows: data.rows.filter((_, index) => index !== Number(removeRow.dataset.tableRemoveRow)) }));
    return;
  }

  const tableAction = event.target.closest?.('[data-table-action]')?.dataset.tableAction;
  if (!tableAction) return;
  event.preventDefault();
  if (tableAction === 'apply') applyTableMutation(data => data);
  if (tableAction === 'add-row') applyTableMutation(data => ({ ...data, rows: [...data.rows, data.columns.map(() => '""')] }));
  if (tableAction === 'add-column') applyTableMutation(data => ({ columns: [...data.columns, JSON.stringify(`Column ${data.columns.length + 1}`)], rows: data.rows.map(row => [...row, '""']), presentation: [...data.presentation, { width: null, align: 'left' }] }));
  if (tableAction === 'remove-column') applyTableMutation(data => {
    if (data.columns.length <= 1) throw new Error('A Table needs at least one column.');
    return { columns: data.columns.slice(0, -1), rows: data.rows.map(row => row.slice(0, -1)), presentation: data.presentation.slice(0, -1) };
  });
}

function applyTreeAction(action) {
  const control = selectedControl();
  if (!control || control.type !== 'tree') return;
  const key = controlKey(control);
  const path = selectedTreePaths.get(key) ?? flattenTreeNodes(control.treeNodes ?? [])[0]?.path ?? null;
  try {
    let result;
    if (action === 'add-root') result = addTreeRoot(control.treeNodes);
    else if (action === 'add-child') result = addTreeChild(control.treeNodes, path);
    else if (action === 'rename') { result = renameTreeNode(control.treeNodes, path, panel.querySelector('#designerTreeNodeLabel')?.value ?? ''); result = setTreeNodeImage(result.nodes, result.path, panel.querySelector('#designerTreeNodeImage')?.value ?? ''); result = setTreeNodeHint(result.nodes, result.path, panel.querySelector('#designerTreeNodeHint')?.value ?? ''); result = setTreeNodeState(result.nodes, result.path, panel.querySelector('#designerTreeNodeState')?.value ?? ''); }
    else if (action === 'up' || action === 'down') result = moveTreeNode(control.treeNodes, path, action);
    else if (action === 'indent') result = indentTreeNode(control.treeNodes, path);
    else if (action === 'outdent') result = outdentTreeNode(control.treeNodes, path);
    else if (action === 'delete') result = removeTreeNode(control.treeNodes, path);
    else return;
    selectedTreePaths.set(key, result.path);
    setSource(updateDesignerTreeNodes(code.value, control, result.nodes));
  } catch (error) { showDesignerInspectorError(error, { document }); }
}

function applyTabsAction(action) {
  const control = selectedControl();
  if (!control || control.type !== 'tabs') return;
  const key = controlKey(control);
  const pages = listDesignerTabPages(code.value, control);
  const pageIndex = selectedTabPages.get(key) ?? 0;
  try {
    let next = code.value;
    let nextIndex = pageIndex;
    if (action === 'add') {
      next = addDesignerTabPage(code.value, control);
      nextIndex = pages.length;
    } else if (action === 'rename') {
      next = renameDesignerTabPage(code.value, control, pageIndex, panel.querySelector('#designerTabPageTitle')?.value ?? '');
    } else if (action === 'up' || action === 'down') {
      next = moveDesignerTabPage(code.value, control, pageIndex, action);
      nextIndex = pageIndex + (action === 'up' ? -1 : 1);
      nextIndex = Math.max(0, Math.min(pages.length - 1, nextIndex));
    } else if (action === 'delete') {
      next = removeDesignerTabPage(code.value, control, pageIndex);
      nextIndex = Math.max(0, Math.min(pageIndex, pages.length - 2));
    } else return;
    selectedTabPages.set(key, nextIndex);
    setSource(next);
  } catch (error) { showDesignerInspectorError(error, { document }); }
}

function applyTableMutation(transform) {
  const control = selectedControl();
  if (!control || control.type !== 'table') return;
  try {
    const draft = readTableDraft(control);
    const next = transform(draft);
    let source = updateDesignerTableData(code.value, control, next);
    const updated = listDesignerControls(source).find(item => item.windowIndex === control.windowIndex && item.controlIndex === control.controlIndex && item.type === 'table');
    if (!updated) throw new Error('Updated Table could not be located after source rewrite.');
    const presentation = Array.isArray(next.presentation) && next.presentation.length === next.columns.length ? next.presentation : defaultTableColumnPresentation(next.columns.length);
    source = setWindowTableColumnPresentation(source, updated.line, presentation, next.columns.length);
    setSource(source);
  } catch (error) { showDesignerInspectorError(error, { document }); }
}

function readTableDraft(control) {
  const columns = [...panel.querySelectorAll('[data-table-column]')].map(input => input.value.trim());
  const rows = (control.rows ?? []).map((_, rowIndex) => columns.map((__, cellIndex) =>
    panel.querySelector(`[data-table-cell="${rowIndex}:${cellIndex}"]`)?.value.trim() ?? '""'
  ));
  const presentation = columns.map((_, index) => {
    const rawWidth = panel.querySelector(`[data-table-column-width=\"${index}\"]`)?.value.trim() ?? '';
    const width = rawWidth ? Number(rawWidth) : null;
    const align = panel.querySelector(`[data-table-column-align=\"${index}\"]`)?.value ?? 'left';
    return { width, align };
  });
  return { columns, rows, presentation };
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  clearDesignerInspectorError({ document });
  scheduleSync();
}

function hidePanel() {
  if (!panel) return;
  panel.hidden = true;
  panel.innerHTML = '';
}

function controlKey(control) {
  return `${control.windowIndex}:${control.controlIndex}:${control.id ?? control.type}`;
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
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
  return text;
}

function installStylesheet() {
  if (document.querySelector('link[data-patch-designer-data-editor]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-data-editor.css';
  link.dataset.patchDesignerDataEditor = '1';
  document.head.appendChild(link);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/`/g, '&#96;');
}
