import { listDesignerControls } from '../src/designer.js';
import {
  resolveWindowTabOrders,
  setWindowTabOrders
} from '../src/window-tab-order.js';
import { designerSelectionForControl, selectDesignerElement } from './designer-selection.js';

export const PATCH_DESIGNER_TAB_ORDER_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
const FOCUSABLE_TYPES = new Set(['button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'table', 'tree', 'tabs', 'picture']);
const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End']);

if (doc) queueMicrotask(install);

export function listDesignerTabOrder(source, windowIndex = 0) {
  const controls = listDesignerControls(source)
    .filter(control => control.windowIndex === Number(windowIndex) && FOCUSABLE_TYPES.has(control.type) && control.id);
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
  const nextSource = setWindowTabOrders(source, nextOrder.map((control, tabOrder) => ({
    sourceLine: control.line,
    tabOrder
  })));
  const nextControl = listDesignerControls(nextSource).find(control =>
    control.windowIndex === moved.windowIndex && control.controlIndex === moved.controlIndex
  );
  if (!nextControl) throw new Error('Reordered TabOrder control could not be resolved after source rewrite.');
  return { source: nextSource, moved: true, control: nextControl, orderIndex: targetIndex };
}

export function clearDesignerTabOrder(source, windowIndex = 0) {
  const controls = listDesignerControls(source)
    .filter(control => control.windowIndex === Number(windowIndex) && FOCUSABLE_TYPES.has(control.type) && control.id);
  return setWindowTabOrders(source, controls.map(control => ({ sourceLine: control.line, tabOrder: null })));
}

function install() {
  if (!toolbar || !code || !canvas || doc.querySelector('#designerTabOrder')) return;
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
      <header>
        <div><strong id="designerTabOrderTitle">Tab Order · Stage 2</strong><span>Independent source-backed focus order</span></div>
        <button type="button" class="secondary small" data-tab-order-close>Close</button>
      </header>
      <p class="designer-tab-order-note">This order is stored as <code># @taborder N</code> metadata and does not move controls in source or change z-order. Use ↑/↓ or Home/End to navigate; Ctrl/Cmd+↑/↓ changes TabOrder.</p>
      <div id="designerTabOrderList" class="designer-tab-order-list" role="list" aria-label="Independent TabOrder"></div>
      <footer><button type="button" class="secondary small" data-tab-order-reset>Reset to source order</button></footer>
    </section>`;
  doc.body.appendChild(dialog);
  installStyles();

  button.addEventListener('click', () => {
    render(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    requestAnimationFrame(() => focusRow(dialog.querySelector('.designer-tab-order-row')));
  });
  dialog.querySelector('[data-tab-order-close]')?.addEventListener('click', () => dialog.close?.());
  dialog.querySelector('[data-tab-order-reset]')?.addEventListener('click', () => resetOrder(dialog));
  dialog.addEventListener('click', event => handleClick(event, dialog));
  dialog.addEventListener('keydown', event => handleKeydown(event, dialog));
  code.addEventListener('input', () => { if (dialog.open) render(dialog); });
  code.addEventListener('change', () => { if (dialog.open) render(dialog); });
}

function render(dialog, options = {}) {
  const list = dialog.querySelector('#designerTabOrderList');
  if (!list) return;
  const focusedSelector = options.preserveFocus ? rowSelector(doc.activeElement?.closest?.('.designer-tab-order-row')) : null;
  let controls = [];
  try {
    controls = listDesignerTabOrder(code.value, activeFormIndex());
  } catch (error) {
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

  if (focusedSelector) {
    const row = findRow(dialog, focusedSelector);
    if (row) focusRow(row);
  }
}

function handleClick(event, dialog) {
  const actionButton = event.target?.closest?.('[data-tab-order-action]');
  if (!actionButton) return;
  event.preventDefault();
  const row = actionButton.closest('.designer-tab-order-row');
  const selector = rowSelector(row);
  if (!selector) return;
  const action = actionButton.dataset.tabOrderAction;
  if (action === 'select') {
    selectControl(selector);
    return;
  }
  moveControl(selector, action, dialog);
}

function handleKeydown(event, dialog) {
  if (event.defaultPrevented || event.isComposing || event.altKey) return;
  const row = event.target?.closest?.('.designer-tab-order-row');
  if (!row || !dialog.contains(row)) return;
  const commandKey = event.ctrlKey || event.metaKey;
  if (commandKey && !event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    const selector = rowSelector(row);
    if (!selector) return;
    event.preventDefault();
    event.stopPropagation();
    moveControl(selector, event.key === 'ArrowUp' ? 'earlier' : 'later', dialog);
    return;
  }
  if (commandKey || event.shiftKey || !NAVIGATION_KEYS.has(event.key)) return;
  const rows = [...dialog.querySelectorAll('.designer-tab-order-row')];
  const index = rows.indexOf(row);
  if (index < 0) return;
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? rows.length - 1
      : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)));
  event.preventDefault();
  event.stopPropagation();
  focusRow(rows[nextIndex]);
}

function moveControl(selector, direction, dialog) {
  try {
    const result = reorderDesignerTabOrder(code.value, selector, direction);
    if (!result.moved) {
      focusRow(findRow(dialog, selector));
      return;
    }
    setSource(result.source);
    queueMicrotask(() => {
      render(dialog);
      selectControl({ windowIndex: result.control.windowIndex, controlIndex: result.control.controlIndex }, { focus: false });
      focusRow(findRow(dialog, result.control));
    });
  } catch (error) {
    showError(dialog, error);
  }
}

function resetOrder(dialog) {
  try {
    const source = clearDesignerTabOrder(code.value, activeFormIndex());
    setSource(source);
    queueMicrotask(() => render(dialog));
  } catch (error) {
    showError(dialog, error);
  }
}

function selectControl(selector, options = {}) {
  let control = null;
  try {
    control = listDesignerControls(code.value).find(item =>
      item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex
    ) ?? null;
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

function rowSelector(row) {
  const selector = {
    windowIndex: Number(row?.dataset.windowIndex),
    controlIndex: Number(row?.dataset.controlIndex)
  };
  return Number.isInteger(selector.windowIndex) && Number.isInteger(selector.controlIndex) ? selector : null;
}

function findRow(dialog, selector) {
  if (!selector) return null;
  return dialog.querySelector(`.designer-tab-order-row[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
}

function focusRow(row) {
  if (!row) return;
  const list = row.closest('#designerTabOrderList');
  for (const item of list?.querySelectorAll?.('.designer-tab-order-row') ?? []) item.tabIndex = item === row ? 0 : -1;
  row.focus?.({ preventScroll: true });
  row.scrollIntoView?.({ block: 'nearest' });
}

function showError(dialog, error) {
  const list = dialog.querySelector('#designerTabOrderList');
  if (list) list.innerHTML = `<p class="designer-tab-order-error">${escapeHtml(error?.message ?? String(error))}</p>`;
}

function activeFormIndex() {
  const value = Number(doc.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
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

function installStyles() {
  if (doc.querySelector('style[data-patch-tab-order]')) return;
  const style = doc.createElement('style');
  style.dataset.patchTabOrder = '1';
  style.textContent = `
    .designer-tab-order-dialog{width:min(720px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 32px));border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);padding:0;box-shadow:0 18px 60px rgba(0,0,0,.28)}
    .designer-tab-order-dialog::backdrop{background:rgba(0,0,0,.38)}.designer-tab-order-shell{display:grid;gap:10px;padding:14px}.designer-tab-order-shell header,.designer-tab-order-shell footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.designer-tab-order-shell header>div{display:grid;gap:2px}.designer-tab-order-shell header span{font-size:10px;color:var(--muted)}
    .designer-tab-order-note,.designer-tab-order-empty,.designer-tab-order-error{margin:0;font-size:10px;line-height:1.45;color:var(--muted)}.designer-tab-order-error{color:var(--danger,#b42318)}.designer-tab-order-note code{font:10px ui-monospace,SFMono-Regular,Menlo,monospace}
    .designer-tab-order-list{display:grid;gap:5px;max-height:min(560px,calc(100vh - 210px));overflow:auto}.designer-tab-order-row{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px;border:1px solid var(--border);border-radius:8px;background:var(--surface-subtle);outline:none}.designer-tab-order-row:focus{box-shadow:0 0 0 2px var(--focus-ring,#5b9cff)}
    .designer-tab-order-number{display:grid;place-items:center;width:28px;height:24px;border-radius:6px;background:var(--soft);font-size:10px;font-weight:800}.designer-tab-order-row>div{display:grid;gap:1px}.designer-tab-order-row>div span{font-size:9px;color:var(--muted)}.designer-tab-order-actions{display:flex;gap:4px}
  `;
  doc.head.appendChild(style);
}
