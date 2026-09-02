import {
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl,
  updateDesignerWindow
} from '../src/designer.js';
import { formControlDefaultSize } from '../src/form-layout.js';
import {
  readWindowDesignerLock,
  setWindowDesignerLock
} from '../src/window-layout-policy.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';
import { reorderDesignerControl } from './designer-z-order-model.js';

const CONTROL_MARGIN = 24;
const CONTROL_GAP = 12;
const DEFAULT_FORM = Object.freeze({ width: 640, height: 420 });
const LOCK_GUARDED_BUTTONS = new Set([
  'patchApplyGeometry',
  'patchCenterControlHorizontal', 'patchCenterControlVertical', 'patchDefaultControlSize', 'patchAutoPlaceControl',
  'patchBringControlFront', 'patchMoveControlForward', 'patchMoveControlBackward', 'patchSendControlBack',
  'patchAlignLeft', 'patchAlignRight', 'patchAlignTop', 'patchAlignBottom', 'patchAlignHCenter', 'patchAlignVCenter',
  'patchSameWidth', 'patchSameHeight', 'patchDistributeHorizontal', 'patchDistributeVertical'
]);
const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
let surface = null;

if (doc) {
  installStylesheet();
  installLockGuards();
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

export function isDesignerControlLocked(source, control) {
  if (!control || !Number.isInteger(control.line)) return false;
  return readWindowDesignerLock(source, control.line);
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
      <button id="patchToggleControlLock" class="secondary small" type="button" aria-pressed="false" title="Lock or unlock movement and sizing for the selected control">Lock control</button>
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

  surface.querySelector('#patchToggleControlLock')?.addEventListener('click', toggleSelectedControlLock);
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
  let controls = [];
  try { controls = listDesignerControls(code.value); } catch { controls = []; }
  syncLockedDecorations(controls);

  const selection = currentDesignerSelection(canvas);
  const selectedCount = canvas.querySelectorAll('.designer-control.designer-multi-selected').length;
  const available = Boolean(selection) && selectedCount <= 1;
  const control = selection ? controls.find(item => sameLocation(item, selection)) : null;
  const locked = control ? isDesignerControlLocked(code.value, control) : false;
  const lockButton = surface.querySelector('#patchToggleControlLock');
  if (lockButton) {
    lockButton.disabled = !available;
    lockButton.textContent = locked ? 'Unlock control' : 'Lock control';
    lockButton.setAttribute('aria-pressed', locked ? 'true' : 'false');
  }
  for (const button of surface.querySelectorAll('button:not(#patchToggleControlLock)')) button.disabled = !available || locked;
  surface.classList.toggle('is-disabled', !available);
  surface.classList.toggle('is-locked', locked);

  const status = surface.querySelector('#designerControlLayoutStatus');
  if (!status) return;
  if (!selection) status.textContent = 'Select one control to use Form-relative layout actions.';
  else if (selectedCount > 1) status.textContent = 'Use the multi-select alignment tools for grouped controls.';
  else if (locked && !status.dataset.actionMessage) status.textContent = 'Locked: movement, resizing, geometry, z-order and grouped layout changes are blocked.';
  else if (!status.dataset.actionMessage) status.textContent = 'Center, size, place or change z-order without creating hidden layout state.';
}

function toggleSelectedControlLock() {
  const status = surface?.querySelector('#designerControlLayoutStatus');
  try {
    const selection = currentDesignerSelection(canvas);
    if (!selection) return;
    const control = listDesignerControls(code.value).find(item => sameLocation(item, selection));
    if (!control) throw new Error('Designer selection no longer matches Patch source.');
    const wasLocked = isDesignerControlLocked(code.value, control);
    const next = setWindowDesignerLock(code.value, control.line, !wasLocked);
    code.value = next;
    rememberDesignerSelection(canvas, designerSelectionForControl(control), { emit: false, reason: 'control-lock' });
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    if (status) {
      status.dataset.actionMessage = 'true';
      status.textContent = wasLocked ? 'Control unlocked.' : 'Control locked against Designer movement and sizing.';
      setTimeout(() => {
        if (!status) return;
        delete status.dataset.actionMessage;
        syncLayoutActions();
      }, 1400);
    }
  } catch (error) {
    showLayoutError(error);
  }
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
    if (isDesignerControlLocked(code.value, control)) throw new Error('Unlock this control before changing its Designer layout.');

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
    showLayoutError(error);
  }
}

function installLockGuards() {
  if (!doc || doc.documentElement.dataset.patchControlLockGuards === 'true') return;
  doc.documentElement.dataset.patchControlLockGuards = 'true';
  window.addEventListener('pointerdown', guardLockedPointerMutation, { capture: true });
  window.addEventListener('keydown', guardLockedKeyboardMutation, { capture: true });
  window.addEventListener('click', guardLockedButtonMutation, { capture: true });
}

function guardLockedPointerMutation(event) {
  if (!canvas || !code) return;
  const control = event.target?.closest?.('.designer-control.designer-selected');
  const handle = event.target?.closest?.('.patch-form-resize-handle[data-window-index][data-control-index]');
  if (!control && !handle) return;
  if (!hasLockedMutationSelection(selectorFromElement(control ?? handle))) return;
  blockDesignerMutation(event, 'Unlock locked controls before moving or resizing them.');
}

function guardLockedKeyboardMutation(event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const control = event.target?.closest?.('.designer-control.designer-selected');
  if (!control || !canvas?.contains(control)) return;
  if (!hasLockedMutationSelection(selectorFromElement(control))) return;
  blockDesignerMutation(event, 'Unlock locked controls before moving them with the keyboard.');
}

function guardLockedButtonMutation(event) {
  const button = event.target?.closest?.('button[id]');
  if (!button || button.id === 'patchToggleControlLock' || !LOCK_GUARDED_BUTTONS.has(button.id)) return;
  if (!hasLockedMutationSelection(currentDesignerSelection(canvas))) return;
  blockDesignerMutation(event, 'Unlock locked controls before applying layout changes.');
}

function hasLockedMutationSelection(primary) {
  if (!code || !canvas) return false;
  let controls = [];
  try { controls = listDesignerControls(code.value); } catch { return false; }
  const selectors = [];
  if (primary) selectors.push(primary);
  for (const element of canvas.querySelectorAll('.designer-control.designer-multi-selected')) {
    const selector = selectorFromElement(element);
    if (selector && !selectors.some(item => sameLocation(item, selector))) selectors.push(selector);
  }
  return selectors.some(selector => {
    const control = controls.find(item => sameLocation(item, selector));
    return control ? isDesignerControlLocked(code.value, control) : false;
  });
}

function syncLockedDecorations(controls) {
  if (!canvas || !code) return;
  for (const element of canvas.querySelectorAll('.designer-control[data-window-index][data-control-index]')) {
    const selector = selectorFromElement(element);
    const control = selector ? controls.find(item => sameLocation(item, selector)) : null;
    const locked = Boolean(control && isDesignerControlLocked(code.value, control));
    element.classList.toggle('designer-control-locked', locked);
    element.dataset.designerLocked = locked ? 'true' : 'false';
    if (locked) element.setAttribute('aria-description', 'Locked in Patch Designer');
    else element.removeAttribute('aria-description');
  }
  for (const handle of canvas.querySelectorAll('.patch-form-resize-handle[data-window-index][data-control-index]')) {
    const selector = selectorFromElement(handle);
    const control = selector ? controls.find(item => sameLocation(item, selector)) : null;
    handle.classList.toggle('is-designer-locked', Boolean(control && isDesignerControlLocked(code.value, control)));
  }
}

function selectorFromElement(element) {
  if (!element) return null;
  const selector = {
    windowIndex: Number(element.dataset.windowIndex),
    controlIndex: Number(element.dataset.controlIndex)
  };
  return Number.isInteger(selector.windowIndex) && Number.isInteger(selector.controlIndex) ? selector : null;
}

function blockDesignerMutation(event, message) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const status = surface?.querySelector('#designerControlLayoutStatus');
  if (status) {
    status.dataset.actionMessage = 'true';
    status.textContent = message;
    setTimeout(() => {
      if (!status) return;
      delete status.dataset.actionMessage;
      syncLayoutActions();
    }, 1400);
  }
}

function showLayoutError(error) {
  const target = doc.querySelector('#designerInspectorError');
  if (target) {
    target.textContent = error?.message ?? String(error);
    target.hidden = false;
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
