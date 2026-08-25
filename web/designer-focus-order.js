import { listDesignerControls } from '../src/designer.js';
import { reorderDesignerControl } from './designer-z-order-model.js';
import { designerSelectionForControl, selectDesignerElement } from './designer-selection.js';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
const FOCUSABLE_TYPES = new Set(['button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'table', 'tree', 'tabs', 'picture']);

if (doc) queueMicrotask(install);

export function listDesignerFocusOrder(source, windowIndex = 0) {
  return listDesignerControls(source)
    .filter(control => control.windowIndex === Number(windowIndex) && FOCUSABLE_TYPES.has(control.type) && control.id)
    .map((control, index) => ({ ...control, focusIndex: index }));
}

function install() {
  if (!toolbar || !code || !canvas || doc.querySelector('#designerFocusOrder')) return;
  const button = doc.createElement('button');
  button.id = 'designerFocusOrder';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = 'Focus order';
  button.title = 'Inspect and reorder source-backed focus order for the active Form';
  toolbar.appendChild(button);

  const dialog = doc.createElement('dialog');
  dialog.id = 'designerFocusOrderDialog';
  dialog.className = 'designer-focus-order-dialog';
  dialog.setAttribute('aria-labelledby', 'designerFocusOrderTitle');
  dialog.innerHTML = `
    <form method="dialog" class="designer-focus-order-shell">
      <header><div><strong id="designerFocusOrderTitle">Focus Order · Stage 1</strong><span>Source-backed control order</span></div><button value="close" class="secondary small">Close</button></header>
      <p class="designer-focus-order-note">Patch currently derives desktop/web control creation order from visible source order. Moving an item here therefore also moves its source block and may affect z-order. Independent Delphi-style TabOrder metadata is a later contract.</p>
      <div id="designerFocusOrderList" class="designer-focus-order-list"></div>
    </form>`;
  doc.body.appendChild(dialog);
  installStyles();

  button.addEventListener('click', () => {
    render(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });
  dialog.addEventListener('click', event => handleDialogAction(event, dialog));
  code.addEventListener('input', () => { if (dialog.open) render(dialog); });
  code.addEventListener('change', () => { if (dialog.open) render(dialog); });
}

function render(dialog) {
  const list = dialog.querySelector('#designerFocusOrderList');
  if (!list) return;
  let controls = [];
  const form = activeFormIndex();
  try { controls = listDesignerFocusOrder(code.value, form); } catch { controls = []; }
  if (!controls.length) {
    list.innerHTML = '<p class="designer-focus-order-empty">No named focusable controls on this Form.</p>';
    return;
  }
  list.innerHTML = controls.map((control, index) => `
    <div class="designer-focus-order-row" data-window-index="${control.windowIndex}" data-control-index="${control.controlIndex}">
      <span class="designer-focus-order-number">${index + 1}</span>
      <div><strong>${escapeHtml(control.id)}</strong><span>${escapeHtml(displayType(control.type))} · source line ${control.line}</span></div>
      <span class="designer-focus-order-actions">
        <button type="button" class="secondary small" data-focus-action="earlier" ${index === 0 ? 'disabled' : ''} aria-label="Move ${escapeHtml(control.id)} earlier">↑</button>
        <button type="button" class="secondary small" data-focus-action="later" ${index === controls.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(control.id)} later">↓</button>
        <button type="button" class="secondary small" data-focus-action="select">Select</button>
      </span>
    </div>`).join('');
}

function handleDialogAction(event, dialog) {
  const actionButton = event.target?.closest?.('[data-focus-action]');
  if (!actionButton) return;
  event.preventDefault();
  const row = actionButton.closest('.designer-focus-order-row');
  const selector = {
    windowIndex: Number(row?.dataset.windowIndex),
    controlIndex: Number(row?.dataset.controlIndex)
  };
  if (!Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) return;
  const action = actionButton.dataset.focusAction;
  if (action === 'select') {
    selectControl(selector);
    dialog.close?.();
    return;
  }
  const direction = action === 'earlier' ? 'backward' : 'forward';
  try {
    const result = reorderDesignerControl(code.value, selector, direction);
    if (!result.moved) return;
    setSource(result.source);
    queueMicrotask(() => {
      render(dialog);
      selectControl({ windowIndex: result.control.windowIndex, controlIndex: result.control.controlIndex }, { focus: false });
    });
  } catch (error) {
    const list = dialog.querySelector('#designerFocusOrderList');
    if (list) list.innerHTML = `<p class="designer-focus-order-error">${escapeHtml(error?.message ?? String(error))}</p>`;
  }
}

function selectControl(selector, options = {}) {
  let control = null;
  try {
    control = listDesignerControls(code.value).find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex) ?? null;
  } catch { return; }
  if (!control) return;
  const element = canvas.querySelector(`.designer-control[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
  if (!element) return;
  selectDesignerElement(canvas, element, designerSelectionForControl(control), { reason: 'focus-order' });
  element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  if (options.focus !== false) element.focus?.({ preventScroll: true });
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
  if (doc.querySelector('style[data-patch-focus-order]')) return;
  const style = doc.createElement('style');
  style.dataset.patchFocusOrder = '1';
  style.textContent = `
    .designer-focus-order-dialog{width:min(680px,calc(100vw - 32px));max-height:min(720px,calc(100vh - 32px));border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);padding:0;box-shadow:0 18px 60px rgba(0,0,0,.28)}
    .designer-focus-order-dialog::backdrop{background:rgba(0,0,0,.38)}
    .designer-focus-order-shell{display:grid;gap:10px;padding:14px}.designer-focus-order-shell header{display:flex;align-items:center;justify-content:space-between;gap:10px}.designer-focus-order-shell header div{display:grid;gap:2px}.designer-focus-order-shell header span{font-size:10px;color:var(--muted)}
    .designer-focus-order-note,.designer-focus-order-empty,.designer-focus-order-error{margin:0;font-size:10px;line-height:1.45;color:var(--muted)}.designer-focus-order-error{color:var(--danger,#b42318)}
    .designer-focus-order-list{display:grid;gap:5px}.designer-focus-order-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px;border:1px solid var(--border);border-radius:8px;background:var(--surface-subtle)}
    .designer-focus-order-number{display:grid;place-items:center;width:24px;height:24px;border-radius:6px;background:var(--soft);font-size:10px;font-weight:800}.designer-focus-order-row>div{display:grid;gap:1px}.designer-focus-order-row>div span{font-size:9px;color:var(--muted)}.designer-focus-order-actions{display:flex;gap:4px}
  `;
  doc.head.appendChild(style);
}
