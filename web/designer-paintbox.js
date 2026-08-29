import {
  addDesignerPaintBox,
  listDesignerPaintBoxes,
  removeDesignerPaintBox,
  updateDesignerPaintBox
} from '../src/designer-paintbox.js';
import { formControlDefaultLayout } from '../src/form-layout.js';
import {
  DESIGNER_SELECTION_EVENT,
  clearDesignerSelection,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';

export const PATCH_DESIGNER_PAINTBOX_STUDIO_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
const inspector = doc?.querySelector('#designerInspector') ?? null;
let queued = false;

if (doc) queueMicrotask(install);

function install() {
  if (!code || !canvas || !designer || !toolbar || !inspector || designer.dataset.patchPaintboxStudio === 'true') return;
  designer.dataset.patchPaintboxStudio = 'true';
  installStyles();
  const add = installAddButton();
  const fields = installInspector();

  add.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const windowIndex = Number(doc.querySelector('#patchFormSelect')?.value) || 0;
      const result = addDesignerPaintBox(code.value, { windowIndex });
      setSource(result.source);
      rememberDesignerSelection(canvas, designerSelectionForControl(result.paintbox, 'core'), { reason: 'add-paintbox' });
      scheduleSync();
    } catch (error) {
      showError(error);
    }
  }, { capture: true });

  fields.querySelector('#designerPaintboxApply')?.addEventListener('click', applyInspector);
  fields.querySelector('#designerPaintboxDelete')?.addEventListener('click', deleteSelected);
  fields.querySelector('#designerPaintboxSource')?.addEventListener('click', revealSource);
  for (const input of fields.querySelectorAll('input')) {
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applyInspector();
    });
  }

  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleSync);
  doc.querySelector('#patchFormSelect')?.addEventListener('change', scheduleSync);
  doc.addEventListener('pointerdown', interceptPaintBoxPointer, { capture: true });
  new MutationObserver(mutations => {
    if (mutations.every(paintBoxOnlyMutation)) return;
    scheduleSync();
  }).observe(canvas, { childList: true, subtree: true });
  scheduleSync();
}

function installAddButton() {
  let button = toolbar.querySelector('#addPaintbox');
  if (button) return button;
  button = doc.createElement('button');
  button.id = 'addPaintbox';
  button.type = 'button';
  button.className = 'secondary small';
  button.textContent = '+ PaintBox';
  button.setAttribute('aria-label', 'Add PaintBox');
  button.title = 'Add a source-backed PaintBox drawing surface to the active Form';
  toolbar.appendChild(button);
  return button;
}

function installInspector() {
  const form = inspector.querySelector('#designerInspectorForm');
  let section = form?.querySelector('#designerPaintboxInspectorFields');
  if (section) return section;
  section = doc.createElement('section');
  section.id = 'designerPaintboxInspectorFields';
  section.className = 'designer-paintbox-inspector';
  section.hidden = true;
  section.innerHTML = `
    <strong>PaintBox</strong>
    <label class="inspector-field">Name <input id="designerPaintboxId" spellcheck="false" autocomplete="off"></label>
    <div class="forms-geometry-grid designer-paintbox-geometry">
      <strong>Layout</strong>
      <label>X <input id="designerPaintboxX" inputmode="numeric"></label>
      <label>Y <input id="designerPaintboxY" inputmode="numeric"></label>
      <label>W <input id="designerPaintboxWidth" inputmode="numeric"></label>
      <label>H <input id="designerPaintboxHeight" inputmode="numeric"></label>
    </div>
    <p class="inspector-hint">PaintBox Stage 1 is source-backed authoring. OnPaint accepts only draw, if and repeat; builds remain capability-gated until renderer support lands.</p>
    <div class="inspector-actions designer-paintbox-actions">
      <button id="designerPaintboxApply" type="button">Apply PaintBox</button>
      <button id="designerPaintboxSource" class="secondary" type="button">Source</button>
      <button id="designerPaintboxDelete" class="danger" type="button">Delete</button>
    </div>`;
  const genericActions = form?.querySelector(':scope > .inspector-actions');
  form?.insertBefore(section, genericActions ?? null);
  return section;
}

function scheduleSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    try {
      renderPaintBoxes();
      syncInspector();
    } catch {
      // Visible source is allowed to be temporarily invalid while typing.
    }
  });
}

function renderPaintBoxes() {
  for (const old of canvas.querySelectorAll('.patch-paintbox-designer-control')) old.remove();
  const bodies = [...canvas.querySelectorAll('.patch-window-body')];
  if (!bodies.length) return;
  const selection = currentDesignerSelection(canvas);
  const materializedValue = canvas.dataset.patchDesignerMaterializedForm;
  const materializedWindow = materializedValue === undefined ? null : Number(materializedValue);
  for (const paintbox of listDesignerPaintBoxes(code.value)) {
    if (Number.isInteger(materializedWindow) && paintbox.windowIndex !== materializedWindow) continue;
    const body = bodies[paintbox.windowIndex];
    if (!body) continue;
    const fallback = formControlDefaultLayout('paintbox', paintbox.controlIndex);
    const layout = {
      x: paintbox.x ?? fallback.x,
      y: paintbox.y ?? fallback.y,
      width: paintbox.width ?? fallback.width,
      height: paintbox.height ?? fallback.height
    };
    const element = doc.createElement('div');
    element.className = 'designer-control patch-paintbox-designer-control';
    if (sameLocation(paintbox, selection)) element.classList.add('designer-selected', 'patch-paintbox-selected');
    element.dataset.windowIndex = String(paintbox.windowIndex);
    element.dataset.controlIndex = String(paintbox.controlIndex);
    element.dataset.paintboxId = paintbox.id ?? '';
    element.tabIndex = 0;
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', `PaintBox ${paintbox.id}`);
    Object.assign(element.style, {
      position: 'absolute',
      left: `${layout.x}px`,
      top: `${layout.y}px`,
      width: `${layout.width}px`,
      height: `${layout.height}px`,
      margin: '0',
      maxWidth: 'none'
    });

    const label = doc.createElement('span');
    label.className = 'patch-paintbox-label';
    label.textContent = paintbox.id ? `PaintBox · ${paintbox.id}` : 'PaintBox';
    element.appendChild(label);
    if (sameLocation(paintbox, selection)) {
      const handle = doc.createElement('span');
      handle.className = 'patch-paintbox-resize-handle';
      handle.setAttribute('aria-hidden', 'true');
      element.appendChild(handle);
    }
    body.style.position = 'relative';
    body.appendChild(element);
  }
}

function syncInspector() {
  const form = inspector.querySelector('#designerInspectorForm');
  const section = form?.querySelector('#designerPaintboxInspectorFields');
  if (!form || !section) return;
  const paintbox = selectedPaintBox();
  section.hidden = !paintbox;
  const genericActions = form.querySelector(':scope > .inspector-actions');
  if (genericActions) genericActions.hidden = Boolean(paintbox);
  if (!paintbox) return;

  for (const id of [
    'designerInspectorIdField', 'designerInspectorTextField', 'designerInspectorOptionsField',
    'designerInspectorSliderFields', 'designerInspectorTimerField', 'designerInspectorPictureSourceField',
    'designerInspectorPictureDisplayFields',
    'designerShapeInspectorFields'
  ]) {
    const field = form.querySelector(`#${id}`);
    if (field && field !== section) field.hidden = true;
  }
  const genericGeometry = form.querySelector('[data-form-geometry]');
  if (genericGeometry) genericGeometry.hidden = true;
  const type = form.querySelector('#designerInspectorType');
  if (type) type.textContent = 'PaintBox';
  const location = form.querySelector('#designerInspectorLocation');
  if (location) location.textContent = `Window ${paintbox.windowIndex + 1} · control ${paintbox.controlIndex + 1} · line ${paintbox.line}`;

  const fallback = formControlDefaultLayout('paintbox', paintbox.controlIndex);
  setField('designerPaintboxId', paintbox.id);
  setField('designerPaintboxX', paintbox.x ?? fallback.x);
  setField('designerPaintboxY', paintbox.y ?? fallback.y);
  setField('designerPaintboxWidth', paintbox.width ?? fallback.width);
  setField('designerPaintboxHeight', paintbox.height ?? fallback.height);
}

function applyInspector() {
  const paintbox = selectedPaintBox();
  if (!paintbox) return;
  try {
    const result = updateDesignerPaintBox(code.value, paintbox, {
      id: fieldValue('designerPaintboxId'),
      x: fieldValue('designerPaintboxX'),
      y: fieldValue('designerPaintboxY'),
      width: fieldValue('designerPaintboxWidth'),
      height: fieldValue('designerPaintboxHeight')
    });
    setSource(result.source);
    rememberDesignerSelection(canvas, designerSelectionForControl(result.paintbox, 'core'), { emit: false });
    scheduleSync();
  } catch (error) {
    showError(error);
  }
}

function deleteSelected() {
  const paintbox = selectedPaintBox();
  if (!paintbox) return;
  try {
    const next = removeDesignerPaintBox(code.value, paintbox);
    clearDesignerSelection(canvas, { reason: 'delete-paintbox' });
    setSource(next);
    scheduleSync();
  } catch (error) {
    showError(error);
  }
}

function revealSource() {
  const paintbox = selectedPaintBox();
  if (!paintbox) return;
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let index = 0; index < paintbox.line - 1; index += 1) start += lines[index].length + 1;
  const end = start + (lines[paintbox.line - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function interceptPaintBoxPointer(event) {
  const element = event.target?.closest?.('.patch-paintbox-designer-control');
  if (!element || !canvas.contains(element)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  const paintbox = listDesignerPaintBoxes(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex);
  if (!paintbox) return;
  rememberDesignerSelection(canvas, designerSelectionForControl(paintbox, 'core'), { reason: 'paintbox-pointer' });

  const fallback = formControlDefaultLayout('paintbox', paintbox.controlIndex);
  const start = {
    x: paintbox.x ?? fallback.x,
    y: paintbox.y ?? fallback.y,
    width: paintbox.width ?? fallback.width,
    height: paintbox.height ?? fallback.height
  };
  const resize = Boolean(event.target?.closest?.('.patch-paintbox-resize-handle'));
  const startX = event.clientX;
  const startY = event.clientY;
  element.setPointerCapture?.(event.pointerId);

  const move = moveEvent => {
    const dx = Math.round(moveEvent.clientX - startX);
    const dy = Math.round(moveEvent.clientY - startY);
    if (resize) {
      element.style.width = `${Math.max(16, start.width + dx)}px`;
      element.style.height = `${Math.max(16, start.height + dy)}px`;
    } else {
      element.style.left = `${Math.max(0, start.x + dx)}px`;
      element.style.top = `${Math.max(0, start.y + dy)}px`;
    }
  };
  const cleanup = finishEvent => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    if (element.releasePointerCapture && element.hasPointerCapture?.(finishEvent?.pointerId)) {
      try { element.releasePointerCapture(finishEvent.pointerId); } catch { /* capture may already be gone */ }
    }
  };
  const finish = finishEvent => {
    cleanup(finishEvent);
    const changes = resize
      ? { width: parseInt(element.style.width, 10), height: parseInt(element.style.height, 10) }
      : { x: parseInt(element.style.left, 10), y: parseInt(element.style.top, 10) };
    try {
      const result = updateDesignerPaintBox(code.value, paintbox, changes);
      setSource(result.source);
      rememberDesignerSelection(canvas, designerSelectionForControl(result.paintbox, 'core'), { emit: false });
      scheduleSync();
    } catch (error) {
      showError(error);
      scheduleSync();
    }
  };
  const cancel = cancelEvent => {
    cleanup(cancelEvent);
    scheduleSync();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function selectedPaintBox() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    return listDesignerPaintBoxes(code.value).find(item => sameLocation(item, selection)) ?? null;
  } catch {
    return null;
  }
}

function sameLocation(control, selection) {
  return Boolean(selection && Number(control?.windowIndex) === Number(selection.windowIndex) && Number(control?.controlIndex) === Number(selection.controlIndex));
}

function setField(id, value) {
  const input = doc.querySelector(`#${id}`);
  if (input && doc.activeElement !== input) input.value = String(value ?? '');
}

function fieldValue(id) {
  return doc.querySelector(`#${id}`)?.value ?? '';
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function showError(error) {
  const target = doc.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function paintBoxOnlyMutation(mutation) {
  const nodes = [...mutation.addedNodes, ...mutation.removedNodes].filter(node => node.nodeType === 1);
  return nodes.length > 0 && nodes.every(node => node.classList?.contains('patch-paintbox-designer-control'));
}

function installStyles() {
  if (doc.querySelector('style[data-patch-paintbox-studio]')) return;
  const style = doc.createElement('style');
  style.dataset.patchPaintboxStudio = '1';
  style.textContent = `
.patch-paintbox-designer-control{box-sizing:border-box;border:1px solid var(--border-strong);border-radius:6px;background-color:var(--surface);background-image:linear-gradient(45deg,color-mix(in srgb,var(--muted) 8%,transparent) 25%,transparent 25%),linear-gradient(-45deg,color-mix(in srgb,var(--muted) 8%,transparent) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,color-mix(in srgb,var(--muted) 8%,transparent) 75%),linear-gradient(-45deg,transparent 75%,color-mix(in srgb,var(--muted) 8%,transparent) 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;display:grid;place-items:center;cursor:move;overflow:hidden}
.patch-paintbox-designer-control.patch-paintbox-selected{outline:2px solid color-mix(in srgb,var(--text) 65%,transparent);outline-offset:2px}
.patch-paintbox-label{padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:color-mix(in srgb,var(--surface) 90%,transparent);color:var(--muted);font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none}
.patch-paintbox-resize-handle{position:absolute;right:0;bottom:0;width:14px;height:14px;border-left:1px solid var(--border-strong);border-top:1px solid var(--border-strong);background:var(--soft);cursor:nwse-resize}
.designer-paintbox-inspector{display:grid;gap:8px}.designer-paintbox-inspector[hidden]{display:none}.designer-paintbox-geometry{margin:0}.designer-paintbox-actions{display:flex;gap:6px;flex-wrap:wrap}
`;
  doc.head.appendChild(style);
}
