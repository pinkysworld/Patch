import { listDesignerControls, listDesignerWindows } from '../src/designer.js';
import { reorderDesignerControl } from './designer-z-order-model.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  selectDesignerElement
} from './designer-selection.js';

export const STUDIO_LAYERS_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
const FOCUSABLE_TYPES = new Set(['button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'table', 'tree', 'tabs', 'picture']);
const FOCUS_ORDER_NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End']);
const LAYER_NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End']);

if (doc) queueMicrotask(install);

export function listDesignerFocusOrder(source, windowIndex = 0) {
  return listDesignerControls(source)
    .filter(control => control.windowIndex === Number(windowIndex) && FOCUSABLE_TYPES.has(control.type) && control.id)
    .map((control, index) => ({ ...control, focusIndex: index }));
}

export function reorderDesignerFocusOrder(source, selector, direction) {
  const controls = listDesignerControls(source);
  const current = controls.find(control =>
    control.windowIndex === selector?.windowIndex && control.controlIndex === selector?.controlIndex
  );
  if (!current || !FOCUSABLE_TYPES.has(current.type) || !current.id) {
    throw new Error('Focus Order selection must be a named focusable Designer control.');
  }
  if (direction !== 'earlier' && direction !== 'later') {
    throw new Error(`Unknown Focus Order direction '${direction}'.`);
  }

  const focusable = controls.filter(control =>
    control.windowIndex === current.windowIndex && FOCUSABLE_TYPES.has(control.type) && control.id
  );
  const focusIndex = focusable.findIndex(control => control.controlIndex === current.controlIndex);
  const targetFocusIndex = direction === 'earlier' ? focusIndex - 1 : focusIndex + 1;
  if (focusIndex < 0 || targetFocusIndex < 0 || targetFocusIndex >= focusable.length) {
    return { source: String(source), moved: false, control: current };
  }

  const targetControlIndex = focusable[targetFocusIndex].controlIndex;
  const zDirection = direction === 'earlier' ? 'backward' : 'forward';
  let nextSource = String(source);
  let active = current;
  while (active.controlIndex !== targetControlIndex) {
    const result = reorderDesignerControl(nextSource, {
      windowIndex: active.windowIndex,
      controlIndex: active.controlIndex
    }, zDirection);
    if (!result.moved) break;
    nextSource = result.source;
    active = result.control;
  }
  return { source: nextSource, moved: nextSource !== String(source), control: active };
}

export function buildDesignerLayerTree(source) {
  const windows = listDesignerWindows(source);
  const controls = listDesignerControls(source);
  return windows.map(window => ({
    ...window,
    controls: controls
      .filter(control => control.windowIndex === window.windowIndex)
      .map(control => ({ ...control }))
  }));
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
      <p class="designer-focus-order-note">Patch currently derives desktop/web control creation order from visible source order. Moving an item here therefore also moves its source block and may affect z-order. Independent Delphi-style TabOrder metadata is a later contract. Use ↑/↓ or Home/End to navigate the list; Ctrl/Cmd+↑/↓ reorders the focused control.</p>
      <div id="designerFocusOrderList" class="designer-focus-order-list" role="list" aria-label="Focusable controls in source order"></div>
    </form>`;
  doc.body.appendChild(dialog);
  installStyles();
  installLayers();

  button.addEventListener('click', () => {
    render(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    requestAnimationFrame(() => focusDesignerFocusOrderRow(dialog.querySelector('.designer-focus-order-row')));
  });
  dialog.addEventListener('click', event => handleDialogAction(event, dialog));
  dialog.addEventListener('keydown', event => handleFocusOrderKeydown(event, dialog));
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
    <div class="designer-focus-order-row" role="listitem" tabindex="${index === 0 ? '0' : '-1'}" data-window-index="${control.windowIndex}" data-control-index="${control.controlIndex}">
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
  const selector = focusOrderSelector(row);
  if (!selector) return;
  const action = actionButton.dataset.focusAction;
  if (action === 'select') {
    selectControl(selector);
    dialog.close?.();
    return;
  }
  moveFocusOrderControl(selector, action, dialog);
}

function handleFocusOrderKeydown(event, dialog) {
  if (event.defaultPrevented || event.isComposing || event.altKey) return;
  const row = event.target?.closest?.('.designer-focus-order-row');
  if (!row || !dialog.contains(row)) return;
  const commandKey = event.ctrlKey || event.metaKey;

  if (commandKey && !event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    const selector = focusOrderSelector(row);
    if (!selector) return;
    event.preventDefault();
    event.stopPropagation();
    moveFocusOrderControl(selector, event.key === 'ArrowUp' ? 'earlier' : 'later', dialog);
    return;
  }

  if (commandKey || event.shiftKey || !FOCUS_ORDER_NAVIGATION_KEYS.has(event.key)) return;
  const rows = [...dialog.querySelectorAll('.designer-focus-order-row')];
  const index = rows.indexOf(row);
  if (index < 0) return;
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? rows.length - 1
      : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)));
  event.preventDefault();
  event.stopPropagation();
  focusDesignerFocusOrderRow(rows[nextIndex]);
}

function moveFocusOrderControl(selector, direction, dialog) {
  try {
    const result = reorderDesignerFocusOrder(code.value, selector, direction);
    if (!result.moved) {
      focusDesignerFocusOrderRow(focusOrderRow(dialog, result.control));
      return;
    }
    setSource(result.source);
    queueMicrotask(() => {
      render(dialog);
      selectControl({ windowIndex: result.control.windowIndex, controlIndex: result.control.controlIndex }, { focus: false });
      focusDesignerFocusOrderRow(focusOrderRow(dialog, result.control));
    });
  } catch (error) {
    const list = dialog.querySelector('#designerFocusOrderList');
    if (list) list.innerHTML = `<p class="designer-focus-order-error">${escapeHtml(error?.message ?? String(error))}</p>`;
  }
}

function focusOrderSelector(row) {
  const selector = {
    windowIndex: Number(row?.dataset.windowIndex),
    controlIndex: Number(row?.dataset.controlIndex)
  };
  return Number.isInteger(selector.windowIndex) && Number.isInteger(selector.controlIndex) ? selector : null;
}

function focusOrderRow(dialog, control) {
  if (!control) return null;
  return dialog.querySelector(`.designer-focus-order-row[data-window-index="${control.windowIndex}"][data-control-index="${control.controlIndex}"]`);
}

function focusDesignerFocusOrderRow(row) {
  if (!row) return;
  const list = row.closest('#designerFocusOrderList');
  for (const item of list?.querySelectorAll?.('.designer-focus-order-row') ?? []) item.tabIndex = item === row ? 0 : -1;
  row.focus?.({ preventScroll: true });
  row.scrollIntoView?.({ block: 'nearest' });
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

function installLayers() {
  if (doc.querySelector('#designerLayers')) return;
  const button = doc.createElement('button');
  button.id = 'designerLayers';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = 'Layers';
  button.title = 'Open the source-backed Forms and Controls object tree';
  button.setAttribute('aria-haspopup', 'dialog');
  toolbar.appendChild(button);

  const dialog = doc.createElement('dialog');
  dialog.id = 'designerLayersDialog';
  dialog.className = 'designer-layers-dialog';
  dialog.setAttribute('aria-labelledby', 'designerLayersTitle');
  dialog.innerHTML = `
    <section class="designer-layers-shell">
      <header>
        <div><strong id="designerLayersTitle">Layers · Object Tree</strong><span>Derived from visible Patch source</span></div>
        <button type="button" class="secondary small" data-layers-close>Close</button>
      </header>
      <p class="designer-layers-note">Forms and top-level controls are listed in source order. Selecting an item reuses the canonical Designer selection. Container-child visualization remains a later stage.</p>
      <div id="designerLayersList" class="designer-layers-list" role="tree" aria-label="Patch Forms and controls"></div>
    </section>`;
  doc.body.appendChild(dialog);

  button.addEventListener('click', () => {
    if (dialog.open) {
      dialog.close?.();
      return;
    }
    renderLayers(dialog);
    if (typeof dialog.show === 'function') dialog.show();
    else dialog.setAttribute('open', '');
    requestAnimationFrame(() => focusPreferredLayerRow(dialog));
  });
  dialog.querySelector('[data-layers-close]')?.addEventListener('click', () => dialog.close?.());
  dialog.addEventListener('click', event => handleLayerClick(event, dialog));
  dialog.addEventListener('keydown', event => handleLayerKeydown(event, dialog));
  dialog.addEventListener('close', () => button.focus?.({ preventScroll: true }));
  code.addEventListener('input', () => { if (dialog.open) renderLayers(dialog); });
  code.addEventListener('change', () => { if (dialog.open) renderLayers(dialog); });
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, () => { if (dialog.open) renderLayers(dialog, { preserveFocus: true }); });
  doc.addEventListener('change', event => {
    if (event.target?.id === 'patchFormSelect' && dialog.open) renderLayers(dialog, { preserveFocus: true });
  });
}

function renderLayers(dialog, options = {}) {
  const list = dialog.querySelector('#designerLayersList');
  if (!list) return;
  const focused = options.preserveFocus ? layerRowIdentity(doc.activeElement?.closest?.('[data-layer-row]')) : null;
  let tree = [];
  try { tree = buildDesignerLayerTree(code.value); }
  catch {
    list.innerHTML = '<p class="designer-layers-empty">The object tree is unavailable while Patch source is invalid.</p>';
    return;
  }
  if (!tree.length) {
    list.innerHTML = '<p class="designer-layers-empty">No Forms in the current Patch project.</p>';
    return;
  }

  const activeForm = activeFormIndex();
  const selection = currentDesignerSelection(canvas);
  const rows = [];
  for (const form of tree) {
    rows.push(layerRowHtml({
      kind: 'form',
      windowIndex: form.windowIndex,
      label: form.id ? `Form ${form.windowIndex + 1} · ${form.id}` : `Form ${form.windowIndex + 1}`,
      detail: form.titleExpr || 'Window',
      level: 1,
      active: form.windowIndex === activeForm,
      selected: false
    }));
    for (const control of form.controls) {
      const selected = selection?.windowIndex === control.windowIndex && selection?.controlIndex === control.controlIndex;
      rows.push(layerRowHtml({
        kind: 'control',
        windowIndex: control.windowIndex,
        controlIndex: control.controlIndex,
        label: controlLabel(control),
        detail: `${displayType(control.type)} · source line ${control.line}`,
        level: 2,
        active: form.windowIndex === activeForm,
        selected
      }));
    }
  }
  list.innerHTML = rows.join('');

  const rowElements = [...list.querySelectorAll('[data-layer-row]')];
  const preferred = focused ? rowElements.find(row => layerRowIdentity(row) === focused) : null;
  const selectedRow = rowElements.find(row => row.dataset.layerSelected === 'true');
  const activeFormRow = rowElements.find(row => row.dataset.layerKind === 'form' && row.dataset.layerActive === 'true');
  const roving = preferred ?? selectedRow ?? activeFormRow ?? rowElements[0];
  setRovingLayerRow(list, roving, { focus: Boolean(preferred) });
}

function layerRowHtml({ kind, windowIndex, controlIndex = null, label, detail, level, active, selected }) {
  const controlAttr = Number.isInteger(controlIndex) ? ` data-control-index="${controlIndex}"` : '';
  return `
    <button type="button" class="designer-layer-row${selected ? ' is-selected' : ''}" role="treeitem" aria-level="${level}" aria-selected="${selected ? 'true' : 'false'}" tabindex="-1" data-layer-row data-layer-kind="${kind}" data-window-index="${windowIndex}"${controlAttr} data-layer-active="${active ? 'true' : 'false'}" data-layer-selected="${selected ? 'true' : 'false'}">
      <span class="designer-layer-glyph" aria-hidden="true">${kind === 'form' ? '▣' : '◇'}</span>
      <span class="designer-layer-copy"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></span>
    </button>`;
}

function handleLayerClick(event, dialog) {
  const row = event.target?.closest?.('[data-layer-row]');
  if (!row || !dialog.contains(row)) return;
  event.preventDefault();
  activateLayerRow(row, dialog);
}

function handleLayerKeydown(event, dialog) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  const row = event.target?.closest?.('[data-layer-row]');
  if (!row || !dialog.contains(row)) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activateLayerRow(row, dialog);
    return;
  }
  if (!LAYER_NAVIGATION_KEYS.has(event.key)) return;

  const rows = [...dialog.querySelectorAll('[data-layer-row]')];
  const index = rows.indexOf(row);
  if (index < 0) return;
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? rows.length - 1
      : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)));
  event.preventDefault();
  event.stopPropagation();
  setRovingLayerRow(dialog.querySelector('#designerLayersList'), rows[nextIndex], { focus: true });
}

function activateLayerRow(row, dialog) {
  const windowIndex = Number(row.dataset.windowIndex);
  if (!Number.isInteger(windowIndex)) return;
  const formSelect = doc.querySelector('#patchFormSelect');
  const switchForm = () => {
    if (!formSelect || Number(formSelect.value) === windowIndex) return false;
    formSelect.value = String(windowIndex);
    formSelect.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  if (row.dataset.layerKind === 'form') {
    switchForm();
    renderLayers(dialog, { preserveFocus: true });
    return;
  }

  const controlIndex = Number(row.dataset.controlIndex);
  if (!Number.isInteger(controlIndex)) return;
  let control = null;
  try {
    control = listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
  } catch { return; }
  if (!control) return;

  const changedForm = switchForm();
  const select = attempts => {
    const element = canvas.querySelector(`.designer-control[data-window-index="${windowIndex}"][data-control-index="${controlIndex}"]`);
    if (!element) {
      if (attempts > 0) requestAnimationFrame(() => select(attempts - 1));
      return;
    }
    const selection = designerSelectionForControl(control);
    if (!selection) return;
    selectDesignerElement(canvas, element, selection, { reason: 'layers-object-tree' });
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    renderLayers(dialog, { preserveFocus: true });
  };
  if (changedForm) requestAnimationFrame(() => select(2));
  else select(0);
}

function focusPreferredLayerRow(dialog) {
  const list = dialog.querySelector('#designerLayersList');
  if (!list) return;
  const row = list.querySelector('[data-layer-selected="true"]')
    ?? list.querySelector('[data-layer-kind="form"][data-layer-active="true"]')
    ?? list.querySelector('[data-layer-row]');
  setRovingLayerRow(list, row, { focus: true });
}

function setRovingLayerRow(list, row, options = {}) {
  if (!list || !row) return;
  for (const item of list.querySelectorAll('[data-layer-row]')) item.tabIndex = item === row ? 0 : -1;
  if (options.focus) {
    row.focus?.({ preventScroll: true });
    row.scrollIntoView?.({ block: 'nearest' });
  }
}

function layerRowIdentity(row) {
  if (!row?.dataset?.layerKind) return '';
  return `${row.dataset.layerKind}:${row.dataset.windowIndex ?? ''}:${row.dataset.controlIndex ?? ''}`;
}

function controlLabel(control) {
  if (control.id) return control.id;
  if (control.textExpr) return `${displayType(control.type)} ${control.textExpr}`;
  return `${displayType(control.type)} ${control.controlIndex + 1}`;
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
  if (type === 'paintbox') return 'PaintBox';
  if (type === 'imagelist') return 'ImageList';
  if (type === 'statusbar') return 'StatusBar';
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
    .designer-focus-order-list{display:grid;gap:5px}.designer-focus-order-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px;border:1px solid var(--border);border-radius:8px;background:var(--surface-subtle);outline:none}.designer-focus-order-row:focus{box-shadow:0 0 0 2px var(--focus-ring,#5b9cff)}
    .designer-focus-order-number{display:grid;place-items:center;width:24px;height:24px;border-radius:6px;background:var(--soft);font-size:10px;font-weight:800}.designer-focus-order-row>div{display:grid;gap:1px}.designer-focus-order-row>div span{font-size:9px;color:var(--muted)}.designer-focus-order-actions{display:flex;gap:4px}
    .designer-layers-dialog{width:min(430px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 28px));margin:76px 20px auto auto;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);padding:0;box-shadow:0 18px 60px rgba(0,0,0,.24)}
    .designer-layers-shell{display:grid;gap:10px;padding:12px}.designer-layers-shell header{display:flex;align-items:center;justify-content:space-between;gap:10px}.designer-layers-shell header>div{display:grid;gap:2px}.designer-layers-shell header span{font-size:10px;color:var(--muted)}
    .designer-layers-note,.designer-layers-empty{margin:0;font-size:10px;line-height:1.45;color:var(--muted)}.designer-layers-list{display:grid;gap:3px;max-height:min(560px,calc(100vh - 190px));overflow:auto}
    .designer-layer-row{width:100%;display:grid;grid-template-columns:20px minmax(0,1fr);align-items:center;gap:6px;text-align:left;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--text);padding:6px 7px}.designer-layer-row[aria-level="2"]{padding-left:24px}.designer-layer-row:hover{background:var(--surface-subtle)}.designer-layer-row:focus{outline:none;border-color:var(--focus-ring,#5b9cff);box-shadow:0 0 0 1px var(--focus-ring,#5b9cff)}.designer-layer-row.is-selected{background:var(--soft);border-color:var(--border)}
    .designer-layer-glyph{font-size:11px;color:var(--muted)}.designer-layer-copy{min-width:0;display:grid;gap:1px}.designer-layer-copy strong,.designer-layer-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.designer-layer-copy strong{font-size:11px}.designer-layer-copy span{font-size:9px;color:var(--muted)}
  `;
  doc.head.appendChild(style);
}
