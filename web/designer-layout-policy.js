import { listDesignerControls } from '../src/designer.js';
import {
  applyWindowResizePolicy,
  formatWindowLayoutPolicy,
  isDesignerMetadataDirective,
  normalizeWindowLayoutPolicy,
  readWindowLayoutPolicy,
  resolveWindowTabOrders,
  setWindowTabOrders
} from '../src/window-layout-policy.js';
import { designerSelectionForControl, selectDesignerElement } from './designer-selection.js';

export const PATCH_DESIGNER_LAYOUT_POLICY_VERSION = '0.1';
export const PATCH_DESIGNER_TAB_ORDER_VERSION = '0.1';

const DIRECTIVE_RE = /^\s*#\s*@layout\s+(anchor\s+(?:left|right|top|bottom)(?:\s+(?:left|right|top|bottom))*|dock\s+(?:left|right|top|bottom|fill))\s*$/i;
const TAB_ORDER_FOCUSABLE_TYPES = new Set(['button', 'input', 'memo', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'table', 'tree', 'tabs', 'picture']);
const TAB_ORDER_NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End']);
const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;

if (doc) queueMicrotask(installTabOrderEditor);

export function readDesignerLayoutPolicy(source, sourceLine) {
  return readWindowLayoutPolicy(source, sourceLine);
}

export function setDesignerLayoutPolicy(source, sourceLine, policy) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveControlLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected control line is outside the Patch source.');

  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && isDesignerMetadataDirective(rows[index]); index -= 1) {
    if (DIRECTIVE_RE.test(rows[index])) existingIndex = index;
  }

  const normalized = normalizeDesignerLayoutPolicy(policy);
  if (normalized.kind === 'fixed') {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }

  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const directive = `${indent}# @layout ${formatDesignerLayoutPolicy(normalized)}`;
  if (existingIndex >= 0) rows[existingIndex] = directive;
  else rows.splice(lineIndex, 0, directive);
  return preserveTrailingNewline(original, rows.join('\n'));
}

export function applyDesignerResizePolicy(layout, policy, resize) {
  return applyWindowResizePolicy(layout, policy, resize);
}

export function normalizeDesignerLayoutPolicy(policy) {
  return normalizeWindowLayoutPolicy(policy);
}

export function formatDesignerLayoutPolicy(policy) {
  return formatWindowLayoutPolicy(policy);
}

export function parseDesignerLayoutPreset(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === 'fixed') return { kind: 'fixed' };
  if (text.startsWith('dock:')) return normalizeDesignerLayoutPolicy({ kind: 'dock', side: text.slice(5) });
  if (text.startsWith('anchor:')) return normalizeDesignerLayoutPolicy({ kind: 'anchor', edges: text.slice(7).split('+') });
  throw new Error(`Unknown Designer layout preset '${value}'.`);
}

export function designerLayoutPresetValue(policy) {
  const normalized = normalizeDesignerLayoutPolicy(policy);
  if (normalized.kind === 'fixed') return 'fixed';
  if (normalized.kind === 'dock') return `dock:${normalized.side}`;
  return `anchor:${normalized.edges.join('+')}`;
}

export function listDesignerTabOrder(source, windowIndex = 0) {
  const controls = listDesignerControls(source)
    .filter(control => control.windowIndex === Number(windowIndex) && TAB_ORDER_FOCUSABLE_TYPES.has(control.type) && control.id);
  return resolveWindowTabOrders(source, controls);
}

export function reorderDesignerTabOrder(source, selector, direction) {
  if (direction !== 'earlier' && direction !== 'later') throw new Error(`Unknown TabOrder direction '${direction}'.`);
  const order = listDesignerTabOrder(source, selector?.windowIndex ?? 0);
  const index = order.findIndex(control =>
    control.windowIndex === selector?.windowIndex && control.controlIndex === selector?.controlIndex
  );
  if (index < 0) throw new Error('TabOrder selection must be a named focusable Designer control.');
  const targetIndex = direction === 'earlier' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= order.length) return { source: String(source), moved: false, control: order[index], orderIndex: index };

  const nextOrder = [...order];
  const [moved] = nextOrder.splice(index, 1);
  nextOrder.splice(targetIndex, 0, moved);
  const nextSource = setWindowTabOrders(source, nextOrder.map((control, tabOrder) => ({ sourceLine: control.line, tabOrder })));
  const nextControl = listDesignerControls(nextSource).find(control =>
    control.windowIndex === moved.windowIndex && control.controlIndex === moved.controlIndex
  );
  if (!nextControl) throw new Error('Reordered TabOrder control could not be resolved after source rewrite.');
  return { source: nextSource, moved: true, control: nextControl, orderIndex: targetIndex };
}

export function clearDesignerTabOrder(source, windowIndex = 0) {
  const controls = listDesignerControls(source)
    .filter(control => control.windowIndex === Number(windowIndex) && TAB_ORDER_FOCUSABLE_TYPES.has(control.type) && control.id);
  return setWindowTabOrders(source, controls.map(control => ({ sourceLine: control.line, tabOrder: null })));
}

function installTabOrderEditor() {
  if (!code || !canvas || doc.querySelector('#designerTabOrder')) return;
  const toolbar = doc.querySelector('#designer .designer-toolbar');
  if (!toolbar) {
    const observer = new MutationObserver(() => {
      if (!doc.querySelector('#designer .designer-toolbar')) return;
      observer.disconnect();
      installTabOrderEditor();
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    return;
  }

  const button = doc.createElement('button');
  button.id = 'designerTabOrder';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = 'Tab order';
  button.title = 'Edit independent source-backed TabOrder metadata for the active Form';
  button.setAttribute('aria-haspopup', 'dialog');
  toolbar.appendChild(button);

  const dialog = doc.createElement('dialog');
  dialog.id = 'designerTabOrderDialog';
  dialog.className = 'designer-tab-order-dialog';
  dialog.setAttribute('aria-labelledby', 'designerTabOrderTitle');
  dialog.innerHTML = `
    <section class="designer-tab-order-shell">
      <header><div><strong id="designerTabOrderTitle">Tab Order · Stage 2</strong><span>Independent source-backed focus order</span></div><button type="button" class="secondary small" data-tab-order-close>Close</button></header>
      <p class="designer-tab-order-note">This order is stored as <code># @taborder N</code> metadata and does not move controls in source or change z-order. Use ↑/↓ or Home/End to navigate; Ctrl/Cmd+↑/↓ changes TabOrder.</p>
      <div id="designerTabOrderList" class="designer-tab-order-list" role="list" aria-label="Independent TabOrder"></div>
      <footer><button type="button" class="secondary small" data-tab-order-reset>Reset to source order</button></footer>
    </section>`;
  doc.body.appendChild(dialog);
  installTabOrderStyles();

  button.addEventListener('click', () => {
    renderTabOrder(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    requestAnimationFrame(() => focusTabOrderRow(dialog.querySelector('.designer-tab-order-row')));
  });
  dialog.querySelector('[data-tab-order-close]')?.addEventListener('click', () => dialog.close?.());
  dialog.querySelector('[data-tab-order-reset]')?.addEventListener('click', () => resetTabOrder(dialog));
  dialog.addEventListener('click', event => handleTabOrderClick(event, dialog));
  dialog.addEventListener('keydown', event => handleTabOrderKeydown(event, dialog));
  code.addEventListener('input', () => { if (dialog.open) renderTabOrder(dialog); });
  code.addEventListener('change', () => { if (dialog.open) renderTabOrder(dialog); });
}

function renderTabOrder(dialog) {
  const list = dialog.querySelector('#designerTabOrderList');
  if (!list) return;
  let controls = [];
  try { controls = listDesignerTabOrder(code.value, activeFormIndex()); }
  catch (error) {
    list.innerHTML = `<p class="designer-tab-order-error">${escapeHtml(error?.message ?? String(error))}</p>`;
    return;
  }
  if (!controls.length) {
    list.innerHTML = '<p class="designer-tab-order-empty">No named focusable controls on this Form.</p>';
    return;
  }
  list.innerHTML = controls.map((control, index) => `
    <div class="designer-tab-order-row" role="listitem" tabindex="${index === 0 ? '0' : '-1'}" data-window-index="${control.windowIndex}" data-control-index="${control.controlIndex}">
      <span class="designer-tab-order-number">${index}</span>
      <div><strong>${escapeHtml(control.id)}</strong><span>${escapeHtml(displayType(control.type))} · source line ${control.line}${control.explicitTabOrder === null ? ' · inherited' : ' · explicit'}</span></div>
      <span class="designer-tab-order-actions">
        <button type="button" class="secondary small" data-tab-order-action="earlier" ${index === 0 ? 'disabled' : ''} aria-label="Move ${escapeHtml(control.id)} earlier in TabOrder">↑</button>
        <button type="button" class="secondary small" data-tab-order-action="later" ${index === controls.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(control.id)} later in TabOrder">↓</button>
        <button type="button" class="secondary small" data-tab-order-action="select">Select</button>
      </span>
    </div>`).join('');
}

function handleTabOrderClick(event, dialog) {
  const actionButton = event.target?.closest?.('[data-tab-order-action]');
  if (!actionButton) return;
  event.preventDefault();
  const selector = tabOrderSelector(actionButton.closest('.designer-tab-order-row'));
  if (!selector) return;
  const action = actionButton.dataset.tabOrderAction;
  if (action === 'select') {
    selectTabOrderControl(selector);
    return;
  }
  moveTabOrderControl(selector, action, dialog);
}

function handleTabOrderKeydown(event, dialog) {
  if (event.defaultPrevented || event.isComposing || event.altKey) return;
  const row = event.target?.closest?.('.designer-tab-order-row');
  if (!row || !dialog.contains(row)) return;
  const commandKey = event.ctrlKey || event.metaKey;
  if (commandKey && !event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    const selector = tabOrderSelector(row);
    if (!selector) return;
    event.preventDefault();
    event.stopPropagation();
    moveTabOrderControl(selector, event.key === 'ArrowUp' ? 'earlier' : 'later', dialog);
    return;
  }
  if (commandKey || event.shiftKey || !TAB_ORDER_NAVIGATION_KEYS.has(event.key)) return;
  const rows = [...dialog.querySelectorAll('.designer-tab-order-row')];
  const index = rows.indexOf(row);
  if (index < 0) return;
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)));
  event.preventDefault();
  event.stopPropagation();
  focusTabOrderRow(rows[nextIndex]);
}

function moveTabOrderControl(selector, direction, dialog) {
  try {
    const result = reorderDesignerTabOrder(code.value, selector, direction);
    if (!result.moved) {
      focusTabOrderRow(findTabOrderRow(dialog, selector));
      return;
    }
    setTabOrderSource(result.source);
    queueMicrotask(() => {
      renderTabOrder(dialog);
      selectTabOrderControl({ windowIndex: result.control.windowIndex, controlIndex: result.control.controlIndex }, { focus: false });
      focusTabOrderRow(findTabOrderRow(dialog, result.control));
    });
  } catch (error) {
    showTabOrderError(dialog, error);
  }
}

function resetTabOrder(dialog) {
  try {
    setTabOrderSource(clearDesignerTabOrder(code.value, activeFormIndex()));
    queueMicrotask(() => renderTabOrder(dialog));
  } catch (error) {
    showTabOrderError(dialog, error);
  }
}

function selectTabOrderControl(selector, options = {}) {
  let control = null;
  try {
    control = listDesignerControls(code.value).find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex) ?? null;
  } catch { return; }
  if (!control) return;
  const element = canvas.querySelector(`.designer-control[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
  if (!element) return;
  const selection = designerSelectionForControl(control);
  if (!selection) return;
  selectDesignerElement(canvas, element, selection, { reason: 'tab-order-stage2' });
  element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  if (options.focus !== false) element.focus?.({ preventScroll: true });
}

function tabOrderSelector(row) {
  const selector = { windowIndex: Number(row?.dataset.windowIndex), controlIndex: Number(row?.dataset.controlIndex) };
  return Number.isInteger(selector.windowIndex) && Number.isInteger(selector.controlIndex) ? selector : null;
}

function findTabOrderRow(dialog, selector) {
  return dialog.querySelector(`.designer-tab-order-row[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
}

function focusTabOrderRow(row) {
  if (!row) return;
  const list = row.closest('#designerTabOrderList');
  for (const item of list?.querySelectorAll?.('.designer-tab-order-row') ?? []) item.tabIndex = item === row ? 0 : -1;
  row.focus?.({ preventScroll: true });
  row.scrollIntoView?.({ block: 'nearest' });
}

function showTabOrderError(dialog, error) {
  const list = dialog.querySelector('#designerTabOrderList');
  if (list) list.innerHTML = `<p class="designer-tab-order-error">${escapeHtml(error?.message ?? String(error))}</p>`;
}

function activeFormIndex() {
  const value = Number(doc.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function setTabOrderSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function installTabOrderStyles() {
  if (doc.querySelector('style[data-patch-tab-order]')) return;
  const style = doc.createElement('style');
  style.dataset.patchTabOrder = '1';
  style.textContent = `.designer-tab-order-dialog{width:min(720px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 32px));border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);padding:0;box-shadow:0 18px 60px rgba(0,0,0,.28)}.designer-tab-order-dialog::backdrop{background:rgba(0,0,0,.38)}.designer-tab-order-shell{display:grid;gap:10px;padding:14px}.designer-tab-order-shell header,.designer-tab-order-shell footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.designer-tab-order-shell header>div{display:grid;gap:2px}.designer-tab-order-shell header span{font-size:10px;color:var(--muted)}.designer-tab-order-note,.designer-tab-order-empty,.designer-tab-order-error{margin:0;font-size:10px;line-height:1.45;color:var(--muted)}.designer-tab-order-error{color:var(--danger,#b42318)}.designer-tab-order-list{display:grid;gap:5px;max-height:min(560px,calc(100vh - 210px));overflow:auto}.designer-tab-order-row{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px;border:1px solid var(--border);border-radius:8px;background:var(--surface-subtle);outline:none}.designer-tab-order-row:focus{box-shadow:0 0 0 2px var(--focus-ring,#5b9cff)}.designer-tab-order-number{display:grid;place-items:center;width:28px;height:24px;border-radius:6px;background:var(--soft);font-size:10px;font-weight:800}.designer-tab-order-row>div{display:grid;gap:1px}.designer-tab-order-row>div span{font-size:9px;color:var(--muted)}.designer-tab-order-actions{display:flex;gap:4px}`;
  doc.head.appendChild(style);
}

function resolveControlLineIndex(rows, sourceLine) {
  const raw = Number(sourceLine);
  if (!Number.isInteger(raw)) return -1;
  for (const candidate of [raw - 1, raw]) {
    if (candidate < 0 || candidate >= rows.length) continue;
    if (/^\s*(?:text|button|input|memo|checkbox|radio|combo|listbox|slider|table|tree|tabs|panel|timer|picture|paintbox|imagelist|statusbar|shape)\b/i.test(rows[candidate])) return candidate;
  }
  return raw >= 1 && raw <= rows.length ? raw - 1 : -1;
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /\n$/.test(original);
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}

function displayType(type) {
  if (type === 'combo') return 'ComboBox';
  if (type === 'listbox') return 'ListBox';
  if (type === 'tree') return 'TreeView';
  if (type === 'picture') return 'PictureBox';
  const text = String(type ?? 'Control');
  return text ? text[0].toUpperCase() + text.slice(1) : 'Control';
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
