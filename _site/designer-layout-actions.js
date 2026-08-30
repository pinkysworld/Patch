import {
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl,
  updateDesignerWindow
} from './src/designer.js?v=868f0784ca7f3972';
import { formControlDefaultSize } from './src/form-layout.js?v=868f0784ca7f3972';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js?v=868f0784ca7f3972';
import { reorderDesignerControl } from './designer-z-order-model.js?v=868f0784ca7f3972';

const CONTROL_MARGIN = 24;
const CONTROL_GAP = 12;
const DEFAULT_FORM = Object.freeze({ width: 640, height: 420 });
const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
let surface = null;

if (doc) {
  installStylesheet();
  queueMicrotask(install);
}

export function effectiveDesignerControlLayout(control) {
  if (!control) return null;
  const defaults = formControlDefaultSize(control.type);
  const index = Number.isInteger(control.controlIndex) ? control.controlIndex : 0;
  return {
    x: Number.isInteger(control.x) ? control.x : CONTROL_MARGIN,
    y: Number.isInteger(control.y) ? control.y : CONTROL_MARGIN + index * 48,
    width: Number.isInteger(control.width) ? control.width : defaults.width,
    height: Number.isInteger(control.height) ? control.height : defaults.height
  };
}

export function centeredDesignerControlPosition(control, windowModel, axis = 'both') {
  const layout = effectiveDesignerControlLayout(control);
  if (!layout) return null;
  const formWidth = Number.isInteger(windowModel?.width) ? windowModel.width : DEFAULT_FORM.width;
  const formHeight = Number.isInteger(windowModel?.height) ? windowModel.height : DEFAULT_FORM.height;
  const result = { x: layout.x, y: layout.y };
  if (axis === 'horizontal' || axis === 'both') {
    result.x = Math.max(0, Math.round((formWidth - layout.width) / 2));
  }
  if (axis === 'vertical' || axis === 'both') {
    result.y = Math.max(0, Math.round((formHeight - layout.height) / 2));
  }
  return result;
}

export function defaultDesignerControlSize(control) {
  if (!control) return null;
  const size = formControlDefaultSize(control.type);
  return { width: size.width, height: size.height };
}

export function autoPlaceDesignerControl(control, controls = []) {
  const layout = effectiveDesignerControlLayout(control);
  if (!layout) return null;
  const siblings = controls
    .filter(item => Number(item?.windowIndex) === Number(control.windowIndex) && !sameLocation(item, control))
    .map(effectiveDesignerControlLayout)
    .filter(Boolean);
  let candidate = { x: CONTROL_MARGIN, y: CONTROL_MARGIN, width: layout.width, height: layout.height };

  for (let pass = 0; pass <= siblings.length; pass += 1) {
    const conflicts = siblings.filter(other => rectanglesOverlap(candidate, other, CONTROL_GAP));
    if (!conflicts.length) return { x: candidate.x, y: candidate.y };
    candidate = {
      ...candidate,
      y: Math.max(...conflicts.map(other => other.y + other.height + CONTROL_GAP))
    };
  }
  return { x: candidate.x, y: candidate.y };
}

function install() {
  if (!code || !canvas) return;
  const inspector = doc.querySelector('#designerInspector');
  const form = inspector?.querySelector('#designerInspectorForm');
  if (!inspector || !form) {
    const observer = new MutationObserver(() => {
      const nextForm = doc.querySelector('#designerInspectorForm');
      if (!nextForm) return;
      observer.disconnect();
      install();
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    return;
  }
  if (form.querySelector('#designerControlLayoutActions')) {
    surface = form.querySelector('#designerControlLayoutActions');
    syncLayoutActions();
    return;
  }

  surface = doc.createElement('section');
  surface.id = 'designerControlLayoutActions';
  surface.className = 'designer-control-layout-actions';
  surface.setAttribute('aria-label', 'Selected control layout');
  surface.innerHTML = `
    <div class="designer-control-layout-heading">
      <strong>Layout</strong>
      <span>source-backed</span>
    </div>
    <div class="designer-control-layout-buttons">
      <button id="patchCenterControlHorizontal" class="secondary small" type="button" title="Center the selected control horizontally in its Form">Center H</button>
      <button id="patchCenterControlVertical" class="secondary small" type="button" title="Center the selected control vertically in its Form">Center V</button>
      <button id="patchDefaultControlSize" class="secondary small" type="button" title="Restore the selected control's standard Designer size">Default size</button>
      <button id="patchAutoPlaceControl" class="secondary small" type="button" title="Move the selected control to the first non-overlapping standard position">Auto place</button>
      <button id="patchBringControlFront" class="secondary small" type="button" title="Bring the selected control to the front of its Form">Bring to front</button>
      <button id="patchMoveControlForward" class="secondary small" type="button" title="Move the selected control one step forward in source-backed z-order">Move forward</button>
      <button id="patchMoveControlBackward" class="secondary small" type="button" title="Move the selected control one step backward in source-backed z-order">Move backward</button>
      <button id="patchSendControlBack" class="secondary small" type="button" title="Send the selected control to the back of its Form">Send to back</button>
    </div>
    <p id="designerControlLayoutStatus" class="designer-control-layout-status" role="status" aria-live="polite"></p>`;

  const state = form.querySelector('#designerInspectorState');
  if (state) state.insertAdjacentElement('afterend', surface);
  else form.prepend(surface);

  surface.querySelector('#patchCenterControlHorizontal')?.addEventListener('click', () => applyLayoutAction('center-horizontal'));
  surface.querySelector('#patchCenterControlVertical')?.addEventListener('click', () => applyLayoutAction('center-vertical'));
  surface.querySelector('#patchDefaultControlSize')?.addEventListener('click', () => applyLayoutAction('default-size'));
  surface.querySelector('#patchAutoPlaceControl')?.addEventListener('click', () => applyLayoutAction('auto-place'));
  surface.querySelector('#patchBringControlFront')?.addEventListener('click', () => applyLayoutAction('front'));
  surface.querySelector('#patchMoveControlForward')?.addEventListener('click', () => applyLayoutAction('forward'));
  surface.querySelector('#patchMoveControlBackward')?.addEventListener('click', () => applyLayoutAction('backward'));
  surface.querySelector('#patchSendControlBack')?.addEventListener('click', () => applyLayoutAction('back'));

  canvas.addEventListener(DESIGNER_SELECTION_EVENT, syncLayoutActions);
  code.addEventListener('input', syncLayoutActions);
  code.addEventListener('change', syncLayoutActions);
  syncLayoutActions();
}

function syncLayoutActions() {
  if (!surface || !canvas || !code) return;
  const selection = currentDesignerSelection(canvas);
  const selectedCount = canvas.querySelectorAll('.designer-control.designer-multi-selected').length;
  const available = Boolean(selection) && selectedCount <= 1;
  for (const button of surface.querySelectorAll('button')) button.disabled = !available;
  surface.classList.toggle('is-disabled', !available);
  const status = surface.querySelector('#designerControlLayoutStatus');
  if (!status) return;
  if (!selection) status.textContent = 'Select one control to use Form-relative layout actions.';
  else if (selectedCount > 1) status.textContent = 'Use the multi-select alignment tools for grouped controls.';
  else if (!status.dataset.actionMessage) status.textContent = 'Center, size, place or change z-order without creating hidden layout state.';
}

function applyLayoutAction(action) {
  const status = surface?.querySelector('#designerControlLayoutStatus');
  try {
    const selection = currentDesignerSelection(canvas);
    if (!selection) return;
    const controls = listDesignerControls(code.value);
    const control = controls.find(item => sameLocation(item, selection));
    const windowModel = listDesignerWindows(code.value).find(item => item.windowIndex === selection.windowIndex);
    if (!control || !windowModel) throw new Error('Designer selection no longer matches Patch source.');

    let message;
    if (['front', 'back', 'forward', 'backward'].includes(action)) {
      const result = reorderDesignerControl(code.value, selection, action);
      code.value = result.source;
      if (result.control) {
        rememberDesignerSelection(canvas, designerSelectionForControl(result.control), { emit: false, reason: 'z-order' });
      }
      code.dispatchEvent(new Event('input', { bubbles: true }));
      code.dispatchEvent(new Event('change', { bubbles: true }));
      const movedMessages = {
        front: 'Brought to front in visible Patch source.',
        back: 'Sent to back in visible Patch source.',
        forward: 'Moved one step forward in visible Patch source.',
        backward: 'Moved one step backward in visible Patch source.'
      };
      const boundaryMessages = {
        front: 'Control is already at the front.',
        back: 'Control is already at the back.',
        forward: 'Control is already at the front boundary.',
        backward: 'Control is already at the back boundary.'
      };
      message = result.moved ? movedMessages[action] : boundaryMessages[action];
      if (status) {
        status.dataset.actionMessage = 'true';
        status.textContent = message;
        setTimeout(() => {
          if (!status) return;
          delete status.dataset.actionMessage;
          syncLayoutActions();
        }, 1400);
      }
      return;
    }

    let changes;
    if (action === 'center-horizontal') {
      changes = centeredDesignerControlPosition(control, windowModel, 'horizontal');
      message = 'Centered horizontally in visible Patch source.';
    } else if (action === 'center-vertical') {
      changes = centeredDesignerControlPosition(control, windowModel, 'vertical');
      message = 'Centered vertically in visible Patch source.';
    } else if (action === 'default-size') {
      changes = defaultDesignerControlSize(control);
      message = 'Restored the standard Designer size in visible Patch source.';
    } else if (action === 'auto-place') {
      changes = autoPlaceDesignerControl(control, controls);
      message = 'Moved to the first non-overlapping standard position in visible Patch source.';
    } else {
      throw new Error(`Unknown Designer layout action '${action}'.`);
    }

    let next = updateDesignerControl(code.value, selection, changes);
    next = growFormForSelectedControl(next, selection);
    setSource(next);
    if (status) {
      status.dataset.actionMessage = 'true';
      status.textContent = message;
      setTimeout(() => {
        if (!status) return;
        delete status.dataset.actionMessage;
        syncLayoutActions();
      }, 1400);
    }
  } catch (error) {
    if (status) {
      status.dataset.actionMessage = 'true';
      status.textContent = error?.message ?? String(error);
    }
    const target = doc.querySelector('#designerInspectorError');
    if (target) {
      target.textContent = error?.message ?? String(error);
      target.hidden = false;
    }
  }
}

function growFormForSelectedControl(source, selection) {
  const control = listDesignerControls(source).find(item => sameLocation(item, selection));
  const windowModel = listDesignerWindows(source).find(item => item.windowIndex === selection.windowIndex);
  if (!control || !windowModel) return source;
  const layout = effectiveDesignerControlLayout(control);
  const currentWidth = windowModel.width ?? DEFAULT_FORM.width;
  const currentHeight = windowModel.height ?? DEFAULT_FORM.height;
  const width = Math.max(currentWidth, layout.x + layout.width + CONTROL_MARGIN);
  const height = Math.max(currentHeight, layout.y + layout.height + CONTROL_MARGIN);
  if (width === currentWidth && height === currentHeight) return source;
  return updateDesignerWindow(source, selection.windowIndex, { width, height });
}

function rectanglesOverlap(left, right, gap = 0) {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y;
}

function sameLocation(left, right) {
  return Number(left?.windowIndex) === Number(right?.windowIndex)
    && Number(left?.controlIndex) === Number(right?.controlIndex);
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-designer-layout-actions]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-layout-actions.css';
  link.dataset.patchDesignerLayoutActions = '1';
  doc.head.appendChild(link);
}
