import { listDesignerControls } from '../src/designer.js';
import { updateDesignerTableData } from '../src/designer-data.js';
import {
  duplicateTableColumn,
  duplicateTableRow,
  moveTableColumn,
  moveTableRow,
  tableActionAvailability
} from '../src/designer-table-actions.js';
import {
  listDesignerTabPageControls,
  updateDesignerTabPageTableData
} from '../src/designer-tabs-nested.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const panel = document.querySelector('[data-designer-data-editor]');
const selectionMemory = new Map();
let scheduled = false;

installStylesheet();
if (panel) {
  new MutationObserver(scheduleSync).observe(panel, { childList: true, subtree: true });
  panel.addEventListener('click', handleClick);
  panel.addEventListener('change', handleChange);
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
    try { syncToolbar(); } catch { removeToolbar(); }
  });
}

function syncToolbar() {
  if (!panel || panel.hidden) return removeToolbar();
  const context = currentTableContext();
  if (!context) return removeToolbar();
  const host = context.kind === 'nested'
    ? panel.querySelector('[data-tabs-structure-editor="table"]')
    : panel;
  const editor = context.kind === 'nested'
    ? host?.querySelector('.designer-table-editor')
    : [...panel.querySelectorAll(':scope > .designer-table-editor')][0] ?? panel.querySelector('.designer-table-editor');
  if (!host || !editor) return removeToolbar();

  const data = readTableDraft(context);
  const key = contextKey(context);
  const remembered = selectionMemory.get(key) ?? { rowIndex: 0, columnIndex: 0 };
  const rowIndex = clampIndex(remembered.rowIndex, data.rows.length);
  const columnIndex = clampIndex(remembered.columnIndex, data.columns.length);
  selectionMemory.set(key, { rowIndex, columnIndex });

  let toolbar = host.querySelector(':scope > [data-table-advanced-actions]');
  if (!toolbar) {
    toolbar = document.createElement('section');
    toolbar.className = 'designer-table-advanced-actions';
    toolbar.dataset.tableAdvancedActions = '1';
    toolbar.setAttribute('aria-label', 'Table row and column actions');
    editor.insertAdjacentElement('afterend', toolbar);
  }
  renderToolbar(toolbar, data, rowIndex, columnIndex);
}

function renderToolbar(toolbar, data, rowIndex, columnIndex) {
  const availability = tableActionAvailability(data, rowIndex, columnIndex);
  const rows = data.rows.map((_, index) => `<option value="${index}"${index === rowIndex ? ' selected' : ''}>Row ${index + 1}</option>`).join('');
  const columns = data.columns.map((column, index) => `<option value="${index}"${index === columnIndex ? ' selected' : ''}>Column ${index + 1}: ${escapeHtml(shortExpression(column))}</option>`).join('');
  toolbar.innerHTML = `
    <div class="designer-table-action-group">
      <label>Row <select data-table-action-row ${data.rows.length ? '' : 'disabled'}>${rows || '<option>No rows</option>'}</select></label>
      <div class="designer-table-action-buttons">
        <button type="button" class="secondary small" data-table-advanced-action="row-up" ${availability.row.up ? '' : 'disabled'} aria-label="Move selected row up">↑</button>
        <button type="button" class="secondary small" data-table-advanced-action="row-down" ${availability.row.down ? '' : 'disabled'} aria-label="Move selected row down">↓</button>
        <button type="button" class="secondary small" data-table-advanced-action="row-duplicate" ${availability.row.duplicate ? '' : 'disabled'}>Duplicate</button>
      </div>
    </div>
    <div class="designer-table-action-group">
      <label>Column <select data-table-action-column>${columns}</select></label>
      <div class="designer-table-action-buttons">
        <button type="button" class="secondary small" data-table-advanced-action="column-left" ${availability.column.left ? '' : 'disabled'} aria-label="Move selected column left">←</button>
        <button type="button" class="secondary small" data-table-advanced-action="column-right" ${availability.column.right ? '' : 'disabled'} aria-label="Move selected column right">→</button>
        <button type="button" class="secondary small" data-table-advanced-action="column-duplicate" ${availability.column.duplicate ? '' : 'disabled'}>Duplicate</button>
      </div>
    </div>
    <p class="inspector-hint">Reorder and Duplicate use the current edited grid values, then rewrite the same source-backed Table block. A moved column carries every cell in that column.</p>`;
}

function handleChange(event) {
  const row = event.target.closest?.('[data-table-action-row]');
  const column = event.target.closest?.('[data-table-action-column]');
  if (!row && !column) return;
  const context = currentTableContext();
  if (!context) return;
  const key = contextKey(context);
  const remembered = selectionMemory.get(key) ?? { rowIndex: 0, columnIndex: 0 };
  if (row) remembered.rowIndex = Number(row.value);
  if (column) remembered.columnIndex = Number(column.value);
  selectionMemory.set(key, remembered);
  syncToolbar();
}

function handleClick(event) {
  const action = event.target.closest?.('[data-table-advanced-action]')?.dataset.tableAdvancedAction;
  if (!action) return;
  event.preventDefault();
  const context = currentTableContext();
  if (!context) return;
  try {
    const data = readTableDraft(context);
    const key = contextKey(context);
    const remembered = selectionMemory.get(key) ?? { rowIndex: 0, columnIndex: 0 };
    let result;
    if (action === 'row-up') result = moveTableRow(data, remembered.rowIndex, 'up');
    else if (action === 'row-down') result = moveTableRow(data, remembered.rowIndex, 'down');
    else if (action === 'row-duplicate') result = duplicateTableRow(data, remembered.rowIndex);
    else if (action === 'column-left') result = moveTableColumn(data, remembered.columnIndex, 'left');
    else if (action === 'column-right') result = moveTableColumn(data, remembered.columnIndex, 'right');
    else if (action === 'column-duplicate') result = duplicateTableColumn(data, remembered.columnIndex);
    else return;

    selectionMemory.set(key, {
      rowIndex: Number.isInteger(result.rowIndex) ? result.rowIndex : remembered.rowIndex,
      columnIndex: Number.isInteger(result.columnIndex) ? result.columnIndex : remembered.columnIndex
    });
    const nextData = { columns: result.columns, rows: result.rows };
    const next = context.kind === 'nested'
      ? updateDesignerTabPageTableData(code.value, context.tabs, context.pageIndex, context.table.controlIndex, nextData)
      : updateDesignerTableData(code.value, context.table, nextData);
    setSource(next);
  } catch (error) {
    showError(error);
  }
}

function currentTableContext() {
  const selected = selectedTopLevelControl();
  if (!selected) return null;
  const nestedEditor = panel?.querySelector('[data-tabs-structure-editor="table"][data-structure-control-index]');
  const nestedHost = panel?.querySelector('[data-tabs-nested-controls][data-page-index]');
  if (selected.type === 'tabs' && nestedEditor && nestedHost) {
    const pageIndex = Number(nestedHost.dataset.pageIndex);
    const controlIndex = Number(nestedEditor.dataset.structureControlIndex);
    if (!Number.isInteger(pageIndex) || !Number.isInteger(controlIndex)) return null;
    const table = listDesignerTabPageControls(code.value, selected, pageIndex)
      .find(item => item.controlIndex === controlIndex && item.type === 'table');
    if (!table) return null;
    return { kind: 'nested', tabs: selected, pageIndex, table };
  }
  if (selected.type === 'table') return { kind: 'top', table: selected };
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

function readTableDraft(context) {
  const nested = context.kind === 'nested';
  const columnSelector = nested ? '[data-tabs-table-column]' : '[data-table-column]';
  const cellAttribute = nested ? 'data-tabs-table-cell' : 'data-table-cell';
  const columns = [...panel.querySelectorAll(columnSelector)].map(input => input.value.trim());
  const sourceRows = context.table.rows ?? [];
  const rows = sourceRows.map((_, rowIndex) => columns.map((__, cellIndex) =>
    panel.querySelector(`[${cellAttribute}="${rowIndex}:${cellIndex}"]`)?.value.trim() ?? '""'
  ));
  return { columns, rows };
}

function contextKey(context) {
  if (context.kind === 'nested') return `nested:${context.tabs.windowIndex}:${context.tabs.controlIndex}:${context.pageIndex}:${context.table.controlIndex}`;
  return `top:${context.table.windowIndex}:${context.table.controlIndex}`;
}

function clampIndex(index, length) {
  if (!length) return 0;
  if (!Number.isInteger(index)) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

function shortExpression(value) {
  const text = String(value ?? '').trim();
  return text.length > 24 ? `${text.slice(0, 21)}…` : text;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function removeToolbar() {
  panel?.querySelectorAll('[data-table-advanced-actions]').forEach(element => element.remove());
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function installStylesheet() {
  if (document.querySelector('link[data-patch-table-actions]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-table-actions.css';
  link.dataset.patchTableActions = '1';
  document.head.appendChild(link);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
