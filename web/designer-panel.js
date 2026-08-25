import {
  DESIGNER_PANEL_CHILD_TYPES,
  addDesignerPanelChild,
  listDesignerPanels,
  moveDesignerPanelChild,
  removeDesignerPanel,
  removeDesignerPanelChild,
  updateDesignerPanel
} from '../src/designer-panel.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';

export const PATCH_DESIGNER_PANEL_UI_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
let queued = false;
let cachedSource = null;
let cachedPanels = [];

if (doc) queueMicrotask(install);

export function panelChildLabel(child) {
  const type = displayType(child?.type);
  const name = child?.id ? ` · ${child.id}` : '';
  return `${Number(child?.childIndex ?? 0) + 1}. ${type}${name}`;
}

function install() {
  if (!designer || !canvas || !code || designer.dataset.patchPanelRad === 'true') return;
  designer.dataset.patchPanelRad = 'true';
  installStyles();
  installInspector();

  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleSync);
  doc.querySelector('#patchFormSelect')?.addEventListener('change', scheduleSync);
  new MutationObserver(records => {
    const panelOnly = records.length > 0 && records.every(record =>
      record.target?.closest?.('.patch-panel-designer-layer')
    );
    if (!panelOnly) scheduleSync();
  }).observe(canvas, { childList: true, subtree: true });

  doc.addEventListener('click', interceptCommonInspector, { capture: true });
  doc.addEventListener('keydown', interceptCommonInspectorEnter, { capture: true });
  canvas.addEventListener('pointerdown', beginPanelPointerEdit, { capture: true });
  scheduleSync();
}

function installInspector() {
  const form = doc.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerPanelEditor')) return;
  const section = doc.createElement('section');
  section.id = 'designerPanelEditor';
  section.className = 'designer-panel-editor';
  section.hidden = true;
  section.innerHTML = `
    <div class="designer-panel-editor-heading">
      <strong>Panel children</strong>
      <span id="designerPanelChildCount" class="inspector-hint"></span>
    </div>
    <p class="inspector-hint">Panel Stage 1 children use source-backed flow layout. Add, reorder or remove children here, then use Source for detailed properties/events.</p>
    <label class="inspector-field">Child
      <select id="designerPanelChildList" size="5" aria-label="Panel children"></select>
    </label>
    <div class="designer-panel-child-add">
      <label>Add <select id="designerPanelChildType" aria-label="Panel child type"></select></label>
      <button id="designerPanelAddChild" class="secondary" type="button">Add child</button>
    </div>
    <div class="designer-panel-child-actions">
      <button id="designerPanelChildEarlier" class="secondary" type="button">Up</button>
      <button id="designerPanelChildLater" class="secondary" type="button">Down</button>
      <button id="designerPanelChildSource" class="secondary" type="button">Source</button>
      <button id="designerPanelChildDelete" class="danger" type="button">Delete child</button>
    </div>`;

  const typePicker = section.querySelector('#designerPanelChildType');
  for (const type of DESIGNER_PANEL_CHILD_TYPES) {
    const option = doc.createElement('option');
    option.value = type;
    option.textContent = displayType(type);
    typePicker.appendChild(option);
  }

  const actions = form.querySelector('.inspector-actions');
  form.insertBefore(section, actions);
  section.querySelector('#designerPanelAddChild').addEventListener('click', addChild);
  section.querySelector('#designerPanelChildEarlier').addEventListener('click', () => moveChild('earlier'));
  section.querySelector('#designerPanelChildLater').addEventListener('click', () => moveChild('later'));
  section.querySelector('#designerPanelChildDelete').addEventListener('click', deleteChild);
  section.querySelector('#designerPanelChildSource').addEventListener('click', revealSelectedChildSource);
  section.querySelector('#designerPanelChildList').addEventListener('change', syncChildActions);
}

function scheduleSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    refreshPanels();
    renderPanelOverlays();
    syncInspector();
  });
}

function refreshPanels() {
  const source = code?.value ?? '';
  if (source === cachedSource) return;
  cachedSource = source;
  try { cachedPanels = listDesignerPanels(source); }
  catch { cachedPanels = []; }
}

function renderPanelOverlays() {
  if (!canvas) return;
  const shells = [...canvas.querySelectorAll('.patch-window')];
  shells.forEach((shell, windowIndex) => {
    const body = shell.querySelector(':scope > .patch-window-body');
    if (!body) return;
    shell.style.position = 'relative';
    let layer = shell.querySelector(':scope > .patch-panel-designer-layer');
    const panels = cachedPanels.filter(panel => panel.windowIndex === windowIndex);
    if (!panels.length) {
      layer?.remove();
      return;
    }
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'patch-panel-designer-layer';
      layer.setAttribute('aria-label', 'Panel design layer');
      shell.appendChild(layer);
    }
    layer.style.left = `${body.offsetLeft}px`;
    layer.style.top = `${body.offsetTop}px`;
    layer.style.width = `${Math.max(body.clientWidth, body.scrollWidth)}px`;
    layer.style.height = `${Math.max(body.clientHeight, body.scrollHeight)}px`;

    const live = new Set(panels.map(panel => String(panel.controlIndex)));
    for (const stale of layer.querySelectorAll(':scope > .patch-panel-designer-control')) {
      if (!live.has(stale.dataset.controlIndex ?? '')) stale.remove();
    }

    for (const panel of panels) {
      let element = layer.querySelector(`:scope > .patch-panel-designer-control[data-control-index="${panel.controlIndex}"]`);
      if (!element) {
        element = doc.createElement('section');
        element.className = 'patch-panel-designer-control designer-control';
        element.tabIndex = 0;
        element.innerHTML = '<div class="patch-panel-designer-caption"></div><div class="patch-panel-designer-body"></div><span class="patch-panel-designer-resize" aria-hidden="true"></span>';
        layer.appendChild(element);
      }
      element.dataset.windowIndex = String(panel.windowIndex);
      element.dataset.controlIndex = String(panel.controlIndex);
      element.dataset.panelId = panel.id ?? '';
      element.setAttribute('aria-label', `Select Panel ${panel.id ?? panel.controlIndex + 1}`);
      const x = panel.x ?? 24;
      const y = panel.y ?? (24 + panel.controlIndex * 48);
      const width = panel.width ?? 280;
      const height = panel.height ?? 160;
      Object.assign(element.style, {
        left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`
      });
      const caption = element.querySelector('.patch-panel-designer-caption');
      caption.textContent = `Panel · ${panel.id ?? `#${panel.controlIndex + 1}`}`;
      const content = element.querySelector('.patch-panel-designer-body');
      renderPanelChildren(content, panel.children);
    }
  });
}

function renderPanelChildren(container, children) {
  container.replaceChildren();
  if (!children.length) {
    const empty = doc.createElement('span');
    empty.className = 'patch-panel-designer-empty';
    empty.textContent = 'Empty Panel · add a flow control in Object Inspector';
    container.appendChild(empty);
    return;
  }
  for (const child of children) {
    const preview = doc.createElement('div');
    preview.className = `patch-panel-child-preview patch-panel-child-${child.type}`;
    preview.textContent = childPreviewText(child);
    preview.title = panelChildLabel(child);
    container.appendChild(preview);
  }
}

function childPreviewText(child) {
  if (child.type === 'text') return expressionPreview(child.textExpr, 'Text');
  if (child.type === 'button') return `Button · ${expressionPreview(child.textExpr, child.id ?? '')}`;
  if (child.type === 'checkbox') return `☐ ${expressionPreview(child.textExpr, child.id ?? 'Checkbox')}`;
  if (child.type === 'input') return `Input · ${child.id ?? ''}`;
  if (child.type === 'slider') return `Slider · ${child.id ?? ''} · ${child.min ?? 0}..${child.max ?? 100}`;
  if (['radio', 'combo', 'listbox'].includes(child.type)) return `${displayType(child.type)} · ${(child.options ?? []).length} options`;
  return panelChildLabel(child);
}

function expressionPreview(expression, fallback) {
  const value = String(expression ?? '').trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value || fallback;
}

function syncInspector() {
  const section = doc.querySelector('#designerPanelEditor');
  if (!section) return;
  const panel = currentPanel();
  section.hidden = !panel;
  if (!panel) return;

  const list = section.querySelector('#designerPanelChildList');
  const previous = Number(list.value);
  list.replaceChildren();
  for (const child of panel.children) {
    const option = doc.createElement('option');
    option.value = String(child.childIndex);
    option.textContent = panelChildLabel(child);
    list.appendChild(option);
  }
  if (panel.children.length) {
    const next = Number.isInteger(previous) && previous >= 0 && previous < panel.children.length ? previous : 0;
    list.value = String(next);
  }
  const count = section.querySelector('#designerPanelChildCount');
  if (count) count.textContent = `${panel.children.length} child${panel.children.length === 1 ? '' : 'ren'}`;

  const idField = doc.querySelector('#designerInspectorIdField');
  const textField = doc.querySelector('#designerInspectorTextField');
  const optionsField = doc.querySelector('#designerInspectorOptionsField');
  const sliderFields = doc.querySelector('#designerInspectorSliderFields');
  const timerField = doc.querySelector('#designerInspectorTimerField');
  if (idField) idField.hidden = false;
  if (textField) textField.hidden = true;
  if (optionsField) optionsField.hidden = true;
  if (sliderFields) sliderFields.hidden = true;
  if (timerField) timerField.hidden = true;
  const type = doc.querySelector('#designerInspectorType');
  if (type) type.textContent = 'Panel';
  const location = doc.querySelector('#designerInspectorLocation');
  if (location) location.textContent = `Window ${panel.windowIndex + 1} · control ${panel.controlIndex + 1} · line ${panel.line} · flow children`;
  const id = doc.querySelector('#designerInspectorId');
  if (id && doc.activeElement !== id) id.value = panel.id ?? '';

  const geometry = doc.querySelector('[data-form-geometry]');
  if (geometry) geometry.hidden = false;
  setGeometryField('#patchControlX', panel.x ?? 24);
  setGeometryField('#patchControlY', panel.y ?? (24 + panel.controlIndex * 48));
  setGeometryField('#patchControlWidth', panel.width ?? 280);
  setGeometryField('#patchControlHeight', panel.height ?? 160);
  syncChildActions();
}

function setGeometryField(selector, value) {
  const field = doc.querySelector(selector);
  if (field && doc.activeElement !== field) field.value = String(value);
}

function syncChildActions() {
  const panel = currentPanel();
  const section = doc?.querySelector('#designerPanelEditor');
  if (!section) return;
  const index = selectedChildIndex(panel);
  const has = panel && index >= 0;
  const earlier = section.querySelector('#designerPanelChildEarlier');
  const later = section.querySelector('#designerPanelChildLater');
  const remove = section.querySelector('#designerPanelChildDelete');
  const source = section.querySelector('#designerPanelChildSource');
  if (earlier) earlier.disabled = !has || index <= 0;
  if (later) later.disabled = !has || index >= panel.children.length - 1;
  if (remove) remove.disabled = !has;
  if (source) source.disabled = !has;
}

function interceptCommonInspector(event) {
  const panel = currentPanel();
  if (!panel) return;
  const target = event.target?.closest?.('button');
  if (!target) return;
  if (target.id === 'designerInspectorApply') {
    stop(event);
    applyPanelIdentity(panel);
  } else if (target.id === 'designerInspectorDelete') {
    stop(event);
    deletePanel(panel);
  } else if (target.id === 'patchApplyGeometry') {
    stop(event);
    applyPanelGeometry(panel);
  }
}

function interceptCommonInspectorEnter(event) {
  if (event.key !== 'Enter') return;
  const panel = currentPanel();
  if (!panel) return;
  if (event.target?.id === 'designerInspectorId') {
    stop(event);
    applyPanelIdentity(panel);
    return;
  }
  if (['patchControlX', 'patchControlY', 'patchControlWidth', 'patchControlHeight'].includes(event.target?.id)) {
    stop(event);
    applyPanelGeometry(panel);
  }
}

function applyPanelIdentity(panel) {
  try {
    const next = updateDesignerPanel(code.value, panel, { id: doc.querySelector('#designerInspectorId')?.value ?? panel.id });
    keepPanelSelection(next, panel);
  } catch (error) { showError(error); }
}

function applyPanelGeometry(panel) {
  try {
    const next = updateDesignerPanel(code.value, panel, {
      x: doc.querySelector('#patchControlX')?.value ?? panel.x,
      y: doc.querySelector('#patchControlY')?.value ?? panel.y,
      width: doc.querySelector('#patchControlWidth')?.value ?? panel.width,
      height: doc.querySelector('#patchControlHeight')?.value ?? panel.height
    });
    keepPanelSelection(next, panel);
  } catch (error) { showError(error); }
}

function deletePanel(panel) {
  try {
    const next = removeDesignerPanel(code.value, panel);
    setSource(next);
  } catch (error) { showError(error); }
}

function addChild() {
  const panel = currentPanel();
  if (!panel) return;
  try {
    const type = doc.querySelector('#designerPanelChildType')?.value;
    const result = addDesignerPanelChild(code.value, panel, type);
    keepPanelSelection(result.source, result.panel);
    scheduleSync();
    queueMicrotask(() => {
      const list = doc.querySelector('#designerPanelChildList');
      if (list && result.panel.children.length) list.value = String(result.panel.children.length - 1);
      syncChildActions();
    });
  } catch (error) { showError(error); }
}

function moveChild(direction) {
  const panel = currentPanel();
  const index = selectedChildIndex(panel);
  if (!panel || index < 0) return;
  try {
    const result = moveDesignerPanelChild(code.value, panel, index, direction);
    if (!result.moved) return;
    keepPanelSelection(result.source, result.panel);
    scheduleSync();
    queueMicrotask(() => {
      const list = doc.querySelector('#designerPanelChildList');
      if (list) list.value = String(direction === 'earlier' ? index - 1 : index + 1);
      syncChildActions();
    });
  } catch (error) { showError(error); }
}

function deleteChild() {
  const panel = currentPanel();
  const index = selectedChildIndex(panel);
  if (!panel || index < 0) return;
  try {
    const result = removeDesignerPanelChild(code.value, panel, index);
    keepPanelSelection(result.source, result.panel);
  } catch (error) { showError(error); }
}

function revealSelectedChildSource() {
  const panel = currentPanel();
  const index = selectedChildIndex(panel);
  const child = panel?.children?.[index];
  if (!child) return;
  revealLine(child.line);
}

function selectedChildIndex(panel) {
  if (!panel?.children?.length) return -1;
  const value = Number(doc?.querySelector('#designerPanelChildList')?.value);
  return Number.isInteger(value) && value >= 0 && value < panel.children.length ? value : 0;
}

function beginPanelPointerEdit(event) {
  const element = event.target?.closest?.('.patch-panel-designer-control');
  if (!element || !canvas.contains(element) || !element.classList.contains('designer-selected')) return;
  const panel = currentPanel();
  if (!panel || panel.controlIndex !== Number(element.dataset.controlIndex) || panel.windowIndex !== Number(element.dataset.windowIndex)) return;
  const resize = Boolean(event.target?.closest?.('.patch-panel-designer-resize'));
  if (!resize && event.target?.closest?.('.patch-panel-child-preview')) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const start = {
    x: panel.x ?? 24,
    y: panel.y ?? (24 + panel.controlIndex * 48),
    width: panel.width ?? 280,
    height: panel.height ?? 160,
    clientX: event.clientX,
    clientY: event.clientY
  };
  element.setPointerCapture?.(event.pointerId);

  const move = moveEvent => {
    const dx = Math.round(moveEvent.clientX - start.clientX);
    const dy = Math.round(moveEvent.clientY - start.clientY);
    if (resize) {
      element.style.width = `${Math.max(40, start.width + dx)}px`;
      element.style.height = `${Math.max(40, start.height + dy)}px`;
    } else {
      element.style.left = `${Math.max(0, start.x + dx)}px`;
      element.style.top = `${Math.max(0, start.y + dy)}px`;
    }
  };
  const cleanup = finishEvent => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    try { element.releasePointerCapture?.(finishEvent?.pointerId); } catch { /* capture may already be released */ }
  };
  const finish = finishEvent => {
    cleanup(finishEvent);
    try {
      const next = updateDesignerPanel(code.value, panel, {
        x: parseInt(element.style.left, 10) || 0,
        y: parseInt(element.style.top, 10) || 0,
        width: parseInt(element.style.width, 10) || start.width,
        height: parseInt(element.style.height, 10) || start.height
      });
      keepPanelSelection(next, panel);
    } catch (error) { showError(error); scheduleSync(); }
  };
  const cancel = cancelEvent => { cleanup(cancelEvent); scheduleSync(); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function currentPanel() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  refreshPanels();
  return cachedPanels.find(panel => panel.windowIndex === selection.windowIndex && panel.controlIndex === selection.controlIndex) ?? null;
}

function keepPanelSelection(source, previous) {
  setSource(source);
  try {
    const updated = listDesignerPanels(source).find(panel =>
      panel.windowIndex === previous.windowIndex && panel.controlIndex === previous.controlIndex
    );
    if (updated) rememberDesignerSelection(canvas, designerSelectionForControl(updated, 'core'), { emit: false });
  } catch { /* source validation is surfaced by the normal Studio diagnostics */ }
  scheduleSync();
}

function setSource(source) {
  code.value = source;
  cachedSource = null;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function revealLine(line) {
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let index = 0; index < line - 1; index += 1) start += lines[index].length + 1;
  const end = start + (lines[line - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function displayType(type) {
  if (type === 'combo') return 'ComboBox';
  if (type === 'listbox') return 'ListBox';
  const value = String(type ?? 'Control');
  return value ? value[0].toUpperCase() + value.slice(1) : 'Control';
}

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function showError(error) {
  const target = doc.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function installStyles() {
  if (doc.querySelector('style[data-patch-panel-rad]')) return;
  const style = doc.createElement('style');
  style.dataset.patchPanelRad = 'true';
  style.textContent = `
.patch-panel-designer-layer{position:absolute;z-index:8;pointer-events:none;overflow:visible}.patch-panel-designer-control{position:absolute;display:grid;grid-template-rows:22px minmax(0,1fr);min-width:40px;min-height:40px;overflow:hidden;border:1px dashed var(--border-strong);border-radius:8px;background:color-mix(in srgb,var(--surface-subtle) 86%,transparent);pointer-events:auto;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--border) 35%,transparent)}.patch-panel-designer-control.designer-selected{outline:2px solid color-mix(in srgb,var(--text) 58%,transparent);outline-offset:2px}.patch-panel-designer-caption{overflow:hidden;padding:3px 7px;border-bottom:1px solid var(--border);background:var(--soft);color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.02em;text-overflow:ellipsis;white-space:nowrap}.patch-panel-designer-body{display:flex;min-width:0;min-height:0;flex-direction:column;align-items:stretch;gap:5px;overflow:auto;padding:7px}.patch-panel-child-preview{flex:0 0 auto;min-height:24px;overflow:hidden;padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.patch-panel-designer-empty{margin:auto;color:var(--muted);font-size:10px;text-align:center}.patch-panel-designer-resize{position:absolute;right:1px;bottom:1px;width:12px;height:12px;border-right:3px solid var(--border-strong);border-bottom:3px solid var(--border-strong);cursor:nwse-resize}.designer-panel-editor{margin:8px 0;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--surface-subtle)}.designer-panel-editor-heading,.designer-panel-child-actions,.designer-panel-child-add{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.designer-panel-editor-heading{justify-content:space-between}.designer-panel-editor #designerPanelChildList{width:100%;min-height:88px;font-size:10px}.designer-panel-child-add label{display:flex;align-items:center;gap:5px;flex:1 1 140px}.designer-panel-child-add select{min-width:110px;flex:1}.designer-panel-child-actions{margin-top:6px}.designer-panel-child-actions button{flex:1 1 auto;min-width:54px}
`;
  doc.head.appendChild(style);
}
