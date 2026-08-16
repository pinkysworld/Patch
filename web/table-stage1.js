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
const appSelections = new Map();
const appListboxSelections = new Map();
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
  const ast = parse(code.value);
  const windows = ast.filter(node => node.kind === 'window');
  const changedHandlers = new Set(ast
    .filter(node => node.kind === 'event' && node.event === 'changed')
    .map(node => node.control));
  const listInitials = collectListInitials(ast);
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
        const key = `${windowIndex}:${node.id ?? controlIndex}`;
        const element = createTable(node, {
          interactive: !designer,
          key,
          hasHandler: Boolean(node.id && changedHandlers.has(node.id))
        });
        element.dataset.windowIndex = String(windowIndex);
        element.dataset.controlIndex = String(controlIndex);
        const anchor = baseChildren[renderedIndex] ?? body.querySelector(':scope > .patch-form-resize-handle') ?? null;
        body.insertBefore(element, anchor);
        if (designer) decorateDesignerTable(element, node, { windowIndex, controlIndex });
        return;
      }

      const element = baseChildren[renderedIndex] ?? null;
      syncMultiListboxes(node, element, {
        designer,
        windowIndex,
        path: String(controlIndex),
        changedHandlers,
        listInitials
      });
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

function syncMultiListboxes(node, element, context) {
  if (!node || !element) return;
  if (node.kind === 'uiControl') {
    if (node.control !== 'listbox' || !node.id || !context.listInitials.has(node.id)) return;
    const select = element.matches?.('select') ? element : element.querySelector?.('select');
    if (!select) return;
    const key = `${context.windowIndex}:${context.path}:${node.id}`;
    if (!appListboxSelections.has(key)) appListboxSelections.set(key, [...(context.listInitials.get(node.id) ?? [])]);
    const selected = appListboxSelections.get(key) ?? [];
    select.multiple = true;
    select.setAttribute('aria-multiselectable', 'true');
    select.dataset.patchMultiListbox = 'true';
    for (const option of select.options) option.selected = selected.includes(option.value);
    if (!context.designer && select.dataset.patchMultiListboxBound !== 'true') {
      select.dataset.patchMultiListboxBound = 'true';
      select.addEventListener('change', event => {
        event.stopImmediatePropagation();
        const value = [...select.selectedOptions].map(option => option.value);
        appListboxSelections.set(key, [...value]);
        if (!context.changedHandlers.has(node.id)) return;
        select.dispatchEvent(new CustomEvent('patch-studio-table-changed', {
          bubbles: true,
          detail: { control: node.id, value: [...value] }
        }));
      }, { capture: true });
    }
    return;
  }
  if (node.kind !== 'tabs') return;
  const pages = node.body ?? [];
  const buttons = [...element.querySelectorAll?.(':scope > .patch-tabs-list > .patch-tab-button') ?? []];
  let activeIndex = buttons.findIndex(button => button.getAttribute('aria-selected') === 'true');
  if (activeIndex < 0) activeIndex = 0;
  const page = pages[activeIndex];
  const panel = element.querySelector?.(':scope > .patch-tab-panel');
  if (!page || !panel) return;
  const children = [...panel.children];
  let renderedIndex = 0;
  for (let index = 0; index < (page.body ?? []).length; index += 1) {
    const child = page.body[index];
    if (child.kind === 'uiControl' && child.control === 'table') continue;
    const childElement = children[renderedIndex] ?? null;
    syncMultiListboxes(child, childElement, {
      ...context,
      path: `${context.path}.${activeIndex}.${index}`
    });
    renderedIndex += 1;
  }
}

function collectListInitials(ast) {
  const out = new Map();
  for (const node of ast ?? []) {
    if (node.kind !== 'create' || node.valueType !== 'list') continue;
    try {
      const text = String(node.expr ?? '').trim();
      const value = text.startsWith('[')
        ? evaluateLoose(text, { state: new Map(), locals: {} })
        : splitTopLevel(text).map(part => evaluateLoose(part, { state: new Map(), locals: {} }));
      if (Array.isArray(value)) out.set(node.name, value.map(item => String(item)));
    } catch {
      out.set(node.name, []);
    }
  }
  return out;
}

function splitTopLevel(text) {
  const out = [];
  let current = '';
  let quote = null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quote) {
      current += ch;
      if (ch === '\\') {
        current += text[++index] ?? '';
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '[' || ch === '(') depth += 1;
    if (ch === ']' || ch === ')') depth -= 1;
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

function createTable(node, options = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'patch-table-wrap patch-table-stage1-control';
  wrap.dataset.controlId = node.id ?? '';
  if (options.interactive) wrap.dataset.patchInteractive = 'true';
  const table = document.createElement('table');
  table.className = 'patch-table';
  if (node.id) table.setAttribute('aria-label', `${node.id} table`);
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
  const rows = (node.rows ?? []).map(row => row.map(cell => displayExpression(cell)));
  let selectedIndex = options.interactive ? appSelections.get(options.key) : null;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= rows.length) selectedIndex = null;

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    for (let index = 0; index < (node.columns ?? []).length; index += 1) {
      const td = document.createElement('td');
      td.textContent = row[index] ?? '';
      tr.appendChild(td);
    }
    if (options.interactive) {
      const selected = rowIndex === selectedIndex;
      tr.setAttribute('aria-selected', selected ? 'true' : 'false');
      tr.tabIndex = selected || (selectedIndex === null && rowIndex === 0) ? 0 : -1;
      tr.classList.toggle('patch-table-selected', selected);
      tr.addEventListener('click', () => selectAppRow(wrap, options, node, rowIndex, row));
      tr.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectAppRow(wrap, options, node, rowIndex, row);
          return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const next = Math.max(0, Math.min(rows.length - 1, rowIndex + direction));
        body.children[next]?.focus();
      });
    }
    body.appendChild(tr);
  });
  table.append(head, body);
  wrap.appendChild(table);
  return wrap;
}

function selectAppRow(wrap, options, node, rowIndex, row) {
  appSelections.set(options.key, rowIndex);
  for (const [index, current] of [...wrap.querySelectorAll('tbody > tr')].entries()) {
    const selected = index === rowIndex;
    current.classList.toggle('patch-table-selected', selected);
    current.setAttribute('aria-selected', selected ? 'true' : 'false');
    current.tabIndex = selected ? 0 : -1;
  }
  if (!options.hasHandler || !node.id) return;
  wrap.dispatchEvent(new CustomEvent('patch-studio-table-changed', {
    bubbles: true,
    detail: { control: node.id, value: [...row] }
  }));
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
.patch-table-stage1-control[data-patch-interactive="true"] tbody tr{cursor:pointer;outline:none}
.patch-table-stage1-control[data-patch-interactive="true"] tbody tr:focus-visible{outline:2px solid currentColor;outline-offset:-2px}
.patch-table-stage1-control[data-patch-interactive="true"] tbody tr.patch-table-selected td{background:color-mix(in srgb,currentColor 10%,transparent)}
select[data-patch-multi-listbox="true"]{min-height:96px}
@media(prefers-color-scheme:dark){.patch-table-wrap{background:#1b1d22;color:#f4f4f5;border-color:#41444e}.patch-table th,.patch-table td{border-color:#34363e}.patch-table th{background:#24262d}}
`;
  document.head.appendChild(style);
}