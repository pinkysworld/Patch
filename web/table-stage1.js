import { parse } from '../src/parser.js';
import { evaluateLoose } from '../src/expression.js';
import { readWindowTableColumnPresentation } from '../src/table-column-presentation.js';
import { getRuntimeSelection, runtimeSelectionKey, setRuntimeSelection } from './studio-runtime-selection-state.js';
import {
  addDesignerControl,
  listDesignerControls
} from '../src/designer.js';
import {
  clearDesignerInspectorError,
  decorateDesignerAdapterElement,
  installDesignerSelectionBridge,
  rememberDesignerSelection,
  restoreDesignerAdapterSelection,
  selectDesignerElement,
  showDesignerInspectorError
} from './designer-selection.js';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector?.('#code') ?? null;
const designerCanvas = doc?.querySelector?.('#designerCanvas') ?? null;
const appView = doc?.querySelector?.('#app') ?? null;
const addTable = doc?.querySelector?.('#addTable') ?? null;
const observed = new Map();
const appListboxSelections = new Map();
let scheduled = false;

export function isRuntimeCoreReconcileChild(child) {
  const key = child?.dataset?.patchControlKey;
  if (!key) return false;
  if (child.dataset.patchRuntimeSelectionKind === 'table') return false;
  if (child.classList?.contains?.('patch-table-stage1-control') === true) return false;
  return true;
}

export function resolveMultiListboxSelection(modelValue, cachedValue) {
  if (Array.isArray(modelValue)) return modelValue.map(item => String(item));
  if (Array.isArray(cachedValue)) return cachedValue.map(item => String(item));
  return null;
}

export function getAppListboxSelection(key) {
  const value = appListboxSelections.get(String(key));
  return Array.isArray(value) ? [...value] : undefined;
}

export function setAppListboxSelection(key, values) {
  const selected = Array.isArray(values) ? values.map(item => String(item)) : [];
  appListboxSelections.set(String(key), selected);
  return [...selected];
}

export function clearAppListboxSelections() {
  appListboxSelections.clear();
}

if (doc) {
  installStyles();
  installDesignerSelectionBridge(designerCanvas);
  installTool();
  observe(designerCanvas, true);
  observe(appView, false);
  code?.addEventListener('input', scheduleSync);
  code?.addEventListener('change', scheduleSync);
  scheduleSync();
}

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
      showDesignerInspectorError(error, { document });
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

function tableAdapterFingerprint(node, options = {}) {
  return JSON.stringify({
    id: node?.id ?? null,
    columns: node?.columns ?? [],
    rows: node?.rows ?? [],
    layout: node?.layout ?? null,
    interactive: options.interactive === true,
    hasHandler: options.hasHandler === true,
    columnPresentation: options.columnPresentation ?? null
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

    const existingTables = new Map();
    for (const element of body.querySelectorAll(':scope > .patch-table-stage1-control')) {
      const key = element.dataset.patchControlKey;
      if (key) existingTables.set(key, element);
      else element.remove();
    }
    if (!designer && shell.dataset.patchRenderDetail === 'deferred') {
      for (const element of existingTables.values()) element.remove();
      return;
    }
    if (designer && Number.isInteger(materializedWindow) && windowIndex !== materializedWindow) {
      for (const element of existingTables.values()) element.remove();
      return;
    }
    const baseChildren = [...body.children].filter(child =>
      !child.classList.contains('patch-form-resize-handle') &&
      !child.classList.contains('patch-table-stage1-control')
    );
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
        const tableOptions = {
          interactive: !designer,
          container,
          key,
          hasHandler: Boolean(node.id && changedHandlers.has(node.id)),
          columnPresentation: readWindowTableColumnPresentation(code.value, node.line, node.columns?.length ?? 0)
        };
        const fingerprint = tableAdapterFingerprint(node, tableOptions);
        let element = existingTables.get(key) ?? null;
        if (!element || element.__patchTableStageFingerprint !== fingerprint) {
          const replacement = createTable(node, tableOptions);
          replacement.dataset.windowIndex = String(windowIndex);
          replacement.dataset.controlIndex = String(controlIndex);
          replacement.dataset.patchControlKey = key;
          replacement.dataset.patchRuntimeSelectionKind = 'table';
          replacement.__patchTableStageFingerprint = fingerprint;
          if (designer) decorateDesignerTable(replacement, node, { windowIndex, controlIndex, adapter: 'table', id: node.id ?? '' });
          element?.replaceWith(replacement);
          element = replacement;
        } else {
          element.dataset.windowIndex = String(windowIndex);
          element.dataset.controlIndex = String(controlIndex);
        }
        existingTables.delete(key);
        const anchor = baseChildren[renderedIndex] ?? body.querySelector(':scope > .patch-form-resize-handle') ?? null;
        body.insertBefore(element, anchor);
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

    for (const stale of existingTables.values()) stale.remove();
  });

  if (typeof container.__patchRestoreRuntimeTransient === 'function') container.__patchRestoreRuntimeTransient();

  if (designer) restoreDesignerAdapterSelection(designerCanvas, 'table', tableElement, {
    isLive: selection => listDesignerControls(code.value).some(item =>
      item.windowIndex === selection.windowIndex &&
      item.controlIndex === selection.controlIndex &&
      item.type === 'table'
    )
  });
}

export function syncMultiListboxes(node, element, context) {
  if (!node || !element) return;
  if (node.kind === 'uiControl') {
    if (node.control !== 'listbox' || !node.id || !context.listInitials.has(node.id)) return;
    const select = element.matches?.('select') ? element : element.querySelector?.('select');
    if (!select) return;
    const key = `${context.windowIndex}:${context.path}:${node.id}`;
    const modelValue = readRenderedListboxSelection(select);
    const cachedValue = getAppListboxSelection(key);
    const selected = resolveMultiListboxSelection(modelValue, cachedValue);
    if (Array.isArray(selected)) setAppListboxSelection(key, selected);
    select.multiple = true;
    select.setAttribute('aria-multiselectable', 'true');
    select.dataset.patchMultiListbox = 'true';
    if (Array.isArray(modelValue) && Array.isArray(selected)) {
      for (const option of select.options) option.selected = selected.includes(option.value);
    }
    if (!context.designer && select.dataset.patchMultiListboxBound !== 'true') {
      select.dataset.patchMultiListboxBound = 'true';
      select.addEventListener('change', event => {
        event.stopImmediatePropagation();
        const value = [...select.selectedOptions].map(option => option.value);
        setAppListboxSelection(key, value);
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

function readRenderedListboxSelection(select) {
  const rendered = select?.dataset?.patchRenderedSelection;
  if (typeof rendered !== 'string' || rendered === '') return undefined;
  try {
    const parsed = JSON.parse(rendered);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
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
  const presentation = options.columnPresentation ?? [];
  if (presentation.length) {
    const colgroup = document.createElement('colgroup');
    for (const spec of presentation) {
      const col = document.createElement('col');
      if (Number.isInteger(spec?.width)) col.style.width = `${spec.width}px`;
      colgroup.appendChild(col);
    }
    table.appendChild(colgroup);
  }
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (let columnIndex = 0; columnIndex < (node.columns ?? []).length; columnIndex += 1) {
    const column = node.columns[columnIndex];
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = displayExpression(column);
    const spec = presentation[columnIndex];
    if (spec?.align) th.style.textAlign = spec.align;
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
      const spec = presentation[index];
      if (spec?.align) td.style.textAlign = spec.align;
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
  clearDesignerInspectorError({ document });
  scheduleSync();
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