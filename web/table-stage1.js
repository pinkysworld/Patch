import { parse } from '../src/parser.js';
import { evaluateLoose } from '../src/expression.js';
import { getRuntimeSelection, runtimeSelectionKey, setRuntimeSelection } from './studio-runtime-selection-state.js';
import {
  addDesignerControl,
  listDesignerControls
} from '../src/designer.js';
import {
  decorateDesignerAdapterElement,
  installDesignerSelectionBridge,
  rememberDesignerSelection,
  restoreDesignerAdapterSelection,
  selectDesignerElement
} from './designer-selection.js';

const code = document.querySelector('#code');
const designerCanvas = document.querySelector('#designerCanvas');
const appView = document.querySelector('#app');
const addTable = document.querySelector('#addTable');
const observed = new Map();
const appListboxSelections = new Map();
let scheduled = false;

installStyles();
installDesignerSelectionBridge(designerCanvas);
installTool();
observe(designerCanvas, true);
observe(appView, false);
code?.addEventListener('input', scheduleSync);
code?.addEventListener('change', scheduleSync);
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
      if (added) rememberDesignerSelection(designerCanvas, tableSelection(added), { reason: 'add-table' });
      setSource(next);
    } catch (error) {
      showError(error);
    }
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
  const materializedValue = designer ? container.dataset.patchDesignerMaterializedForm : undefined;
  const materializedWindow = materializedValue === undefined ? null : Number(materializedValue);
  shells.forEach((shell, windowIndex) => {
    const body = shell.querySelector('.patch-window-body');
    const windowNode = windows[windowIndex];
    if (!body || !windowNode) return;

    for (const old of body.querySelectorAll(':scope > .patch-table-stage1-control')) old.remove();
    if (!designer && shell.dataset.patchRenderDetail === 'deferred') return;
    if (designer && Number.isInteger(materializedWindow) && windowIndex !== materializedWindow) return;
    const baseChildren = [...body.children].filter(child => !child.classList.contains('patch-form-resize-handle'));
    const sourceControls = (windowNode.body ?? []).filter(node => node.kind === 'uiControl' || node.kind === 'tabs');
    let renderedIndex = 0;

    sourceControls.forEach((node, controlIndex) => {
      if (node.kind === 'uiControl' && node.control === 'table') {
        const key = runtimeSelectionKey(node, {
          windowId: windowNode.id,
          windowIndex,
          controlIndex,
          controlPath: String(controlIndex)
        });
        const element = createTable(node, {
          interactive: !designer,
          container,
          key,
          hasHandler: Boolean(node.id && changedHandlers.has(node.id))
        });
        element.dataset.windowIndex = String(windowIndex);
        element.dataset.controlIndex = String(controlIndex);
        element.dataset.patchControlKey = key;
        element.dataset.patchRuntimeSelectionKind = 'table';
        const anchor = baseChildren[renderedIndex] ?? body.querySelector(':scope > .patch-form-resize-handle') ?? null;
        body.insertBefore(element, anchor);
        if (designer) decorateDesignerTable(element, node, { windowIndex, controlIndex, adapter: 'table', id: node.id ?? '' });
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

  if (designer) restoreDesignerAdapterSelection(designerCanvas, 'table', tableElement);
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
  let selectedIndex = options.interactive ? getRuntimeSelection(options.container, 'table', options.key) : null;
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
  setRuntimeSelection(options.container, 'table', options.key, rowIndex);
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
  decorateDesignerAdapterElement(designerCanvas, element, selection);
  const select = event => {
    event.preventDefault();
    event.stopPropagation();
    const liveSelection = tableSelectionFromElement(element);
    if (!liveSelection) return;
    selectDesignerElement(designerCanvas, element, liveSelection, { reason: 'table-control' });
  };
  element.addEventListener('click', select);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') select(event);
  });
}

function tableElement(selection) {
  if (!designerCanvas || !selection) return null;
  return designerCanvas.querySelector(
    `.patch-table-stage1-control[data-window-index="${selection.windowIndex}"][data-control-index="${selection.controlIndex}"]`
  );
}

function tableSelection(control) {
  return {
    windowIndex: control.windowIndex,
    controlIndex: control.controlIndex,
    adapter: 'table',
    id: control.id ?? ''
  };
}

function tableSelectionFromElement(element) {
  const windowIndex = Number(element?.dataset?.windowIndex);
  const controlIndex = Number(element?.dataset?.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  const control = listDesignerControls(code.value).find(item =>
    item.windowIndex === windowIndex && item.controlIndex === controlIndex && item.type === 'table'
  );
  return control ? tableSelection(control) : null;
}

function displayExpression(expr) {
  const text = String(expr ?? '').trim();
  try {
    return String(evaluateLoose(text, { state: new Map(), locals: {} }));
  } catch {
    return text;
  }
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