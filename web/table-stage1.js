import { parse } from '../src/parser.js';
import { evaluateLoose } from '../src/expression.js';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';

const code = document.querySelector('#code');
const designerCanvas = document.querySelector('#designerCanvas');
const appView = document.querySelector('#app');
const addTable = document.querySelector('#addTable');
const observed = new Map();
let scheduled = false;
let selectedTable = null;

installStyles();
installTool();
installInspectorBridge();
observe(designerCanvas, true);
observe(appView, false);
code?.addEventListener('input', scheduleSync);
code?.addEventListener('change', scheduleSync);
designerCanvas?.addEventListener('click', event => {
  if (!event.target.closest?.('.patch-table-stage1-control')) selectedTable = null;
}, { capture: true });
scheduleSync();

function installTool() {
  addTable?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const activeForm = Number(document.querySelector('#patchFormSelect')?.value) || 0;
      const next = addDesignerControl(code.value, 'table', { windowIndex: activeForm });
      const tables = listDesignerControls(next).filter(item => item.windowIndex === activeForm && item.type === 'table');
      const added = tables[tables.length - 1];
      selectedTable = added ? { windowIndex: added.windowIndex, controlIndex: added.controlIndex } : null;
      setSource(next);
    } catch (error) {
      showError(error);
    }
  }, { capture: true });
}

function installInspectorBridge() {
  document.querySelector('#designerInspectorApply')?.addEventListener('click', event => {
    const selection = activeTableSelection();
    if (!selection) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const id = document.querySelector('#designerInspectorId')?.value ?? '';
      const next = updateDesignerControl(code.value, selection, { id });
      selectedTable = selection;
      setSource(next);
    } catch (error) {
      showError(error);
    }
  }, { capture: true });

  document.querySelector('#designerInspectorDelete')?.addEventListener('click', event => {
    const selection = activeTableSelection();
    if (!selection) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const next = removeDesignerControl(code.value, selection);
      selectedTable = null;
      setSource(next);
    } catch (error) {
      showError(error);
    }
  }, { capture: true });

  document.querySelector('#designerInspectorSource')?.addEventListener('click', event => {
    const selection = activeTableSelection();
    if (!selection) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const control = listDesignerControls(code.value).find(item =>
      item.windowIndex === selection.windowIndex && item.controlIndex === selection.controlIndex
    );
    if (!control) return;
    revealLine(control.line);
  }, { capture: true });
}

function observe(container, designer) {
  if (!container) return;
  const observer = new MutationObserver(scheduleSync);
  observed.set(container, { observer, designer });
  observer.observe(container, { childList: true, subtree: true });
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    for (const { observer } of observed.values()) observer.disconnect();
    try {
      for (const [container, config] of observed) syncContainer(container, config.designer);
    } catch {
      // Source can be temporarily invalid while typing. Playground owns the visible diagnostic.
    } finally {
      for (const [container, config] of observed) config.observer.observe(container, { childList: true, subtree: true });
    }
  });
}

function syncContainer(container, designer) {
  const windows = parse(code.value).filter(node => node.kind === 'window');
  const shells = [...container.querySelectorAll('.patch-window')];
  shells.forEach((shell, windowIndex) => {
    const body = shell.querySelector('.patch-window-body');
    const windowNode = windows[windowIndex];
    if (!body || !windowNode) return;

    for (const old of body.querySelectorAll(':scope > .patch-table-stage1-control')) old.remove();
    const baseChildren = [...body.children].filter(child => !child.classList.contains('patch-form-resize-handle'));
    const sourceControls = (windowNode.body ?? []).filter(node => node.kind === 'uiControl' || node.kind === 'tabs');
    let renderedIndex = 0;

    sourceControls.forEach((node, controlIndex) => {
      if (node.kind === 'uiControl' && node.control === 'table') {
        const element = createTable(node);
        element.dataset.windowIndex = String(windowIndex);
        element.dataset.controlIndex = String(controlIndex);
        const anchor = baseChildren[renderedIndex] ?? body.querySelector(':scope > .patch-form-resize-handle') ?? null;
        body.insertBefore(element, anchor);
        if (designer) decorateDesignerTable(element, node, { windowIndex, controlIndex });
        return;
      }
      renderedIndex += 1;
    });
  });

  if (designer && selectedTable) {
    const selected = tableElement(selectedTable);
    if (selected) {
      selected.classList.add('designer-selected');
      populateInspector(selectedTable);
    }
  }
}

function createTable(node) {
  const wrap = document.createElement('div');
  wrap.className = 'patch-table-wrap patch-table-stage1-control';
  wrap.dataset.controlId = node.id ?? '';
  const table = document.createElement('table');
  table.className = 'patch-table';
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const column of node.columns ?? []) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = displayExpression(column);
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  const body = document.createElement('tbody');
  for (const row of node.rows ?? []) {
    const tr = document.createElement('tr');
    for (let index = 0; index < (node.columns ?? []).length; index += 1) {
      const td = document.createElement('td');
      td.textContent = displayExpression(row[index] ?? '');
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  table.append(head, body);
  wrap.appendChild(table);
  return wrap;
}

function decorateDesignerTable(element, node, selection) {
  element.classList.add('designer-control');
  element.tabIndex = 0;
  element.setAttribute('aria-label', `Select table control ${node.id ?? selection.controlIndex + 1}`);
  if (sameSelection(selectedTable, selection)) element.classList.add('designer-selected');
  const select = event => {
    event.preventDefault();
    event.stopPropagation();
    selectedTable = selection;
    for (const current of designerCanvas.querySelectorAll('.designer-control.designer-selected')) current.classList.remove('designer-selected');
    element.classList.add('designer-selected');
    populateInspector(selection);
    const marker = document.createTextNode('');
    element.appendChild(marker);
    marker.remove();
  };
  element.addEventListener('click', select);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') select(event);
  });
}

function populateInspector(selection) {
  const control = listDesignerControls(code.value).find(item =>
    item.windowIndex === selection.windowIndex && item.controlIndex === selection.controlIndex && item.type === 'table'
  );
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
  if (type) type.textContent = 'Table';
  if (location) location.textContent = `Window ${control.windowIndex + 1} · control ${control.controlIndex + 1} · line ${control.line}`;
  if (idField) idField.hidden = false;
  if (textField) textField.hidden = true;
  if (optionsField) optionsField.hidden = true;
  if (id) id.value = control.id ?? '';
  const error = document.querySelector('#designerInspectorError');
  if (error) { error.hidden = true; error.textContent = ''; }
}

function activeTableSelection() {
  if (!selectedTable) return null;
  const element = tableElement(selectedTable);
  if (!element?.classList.contains('designer-selected')) return null;
  return selectedTable;
}

function tableElement(selection) {
  if (!designerCanvas || !selection) return null;
  return designerCanvas.querySelector(
    `.patch-table-stage1-control[data-window-index="${selection.windowIndex}"][data-control-index="${selection.controlIndex}"]`
  );
}

function sameSelection(a, b) {
  return Boolean(a && b && a.windowIndex === b.windowIndex && a.controlIndex === b.controlIndex);
}

function displayExpression(expr) {
  const text = String(expr ?? '').trim();
  try {
    return String(evaluateLoose(text, { state: new Map(), locals: {} }));
  } catch {
    return text;
  }
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

function installStyles() {
  if (document.querySelector('style[data-patch-table-stage1]')) return;
  const style = document.createElement('style');
  style.dataset.patchTableStage1 = '1';
  style.textContent = `
.patch-table-wrap{width:100%;height:100%;overflow:auto;border:1px solid #d4d4d8;border-radius:9px;background:#fff;color:#18181b}
.patch-table{width:100%;border-collapse:collapse;font-size:13px}
.patch-table th,.patch-table td{border-bottom:1px solid #e4e4e7;border-right:1px solid #e4e4e7;padding:7px 9px;text-align:left;vertical-align:top;white-space:nowrap}
.patch-table th:last-child,.patch-table td:last-child{border-right:0}
.patch-table th{position:sticky;top:0;background:#f4f4f5;font-weight:750}
.patch-table tr:last-child td{border-bottom:0}
@media(prefers-color-scheme:dark){.patch-table-wrap{background:#1b1d22;color:#f4f4f5;border-color:#41444e}.patch-table th,.patch-table td{border-color:#34363e}.patch-table th{background:#24262d}}
`;
  document.head.appendChild(style);
}