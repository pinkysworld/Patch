import { listDesignerControls } from '../src/designer.js';
import { formControlDefaultSize } from '../src/form-layout.js';
import { snapFormControlAlignment } from './designer-alignment.js';

const canvas = document.querySelector('#designerCanvas');
const code = document.querySelector('#code');
const ALIGNMENT_TOLERANCE = 5;
let verticalGuide = null;
let horizontalGuide = null;

if (canvas && code) {
  canvas.addEventListener('pointerdown', beginAlignmentAssist, { capture: true });
}

function beginAlignmentAssist(event) {
  if (event.target.closest?.('.patch-form-resize-handle')) return;
  const target = event.target.closest?.('.designer-control.designer-selected');
  if (!target || !canvas.contains(target)) return;
  const selector = selectorFromElement(target);
  if (!selector) return;

  const grouped = new Set(
    [...canvas.querySelectorAll('.designer-control.designer-multi-selected')]
      .map(selectorFromElement)
      .filter(Boolean)
      .map(selectorKey)
  );
  const controls = listDesignerControls(code.value);
  const peers = controls
    .filter(item => item.windowIndex === selector.windowIndex && item.controlIndex !== selector.controlIndex)
    .filter(item => !grouped.has(selectorKey(item)))
    .map(effectiveLayout);
  if (!peers.length) return;

  const move = moveEvent => {
    if (moveEvent.altKey) {
      hideGuides();
      return;
    }
    const current = readRenderedLayout(target);
    if (!current) return;
    const snapped = snapFormControlAlignment(current, peers, { tolerance: ALIGNMENT_TOLERANCE });
    target.style.left = `${snapped.x}px`;
    target.style.top = `${snapped.y}px`;
    positionResizeHandle(target, selector);
    showGuides(target.parentElement, snapped.guideX, snapped.guideY);
  };

  const finish = () => cleanup();
  const cancel = () => cleanup();
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    hideGuides();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function effectiveLayout(control) {
  const defaults = formControlDefaultSize(control.type);
  const index = control.controlIndex ?? 0;
  return {
    x: control.x ?? 24,
    y: control.y ?? (24 + index * 48),
    width: control.width ?? defaults.width,
    height: control.height ?? defaults.height
  };
}

function readRenderedLayout(target) {
  const x = parseInt(target.style.left, 10);
  const y = parseInt(target.style.top, 10);
  const width = parseInt(target.style.width, 10);
  const height = parseInt(target.style.height, 10);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function showGuides(body, guideX, guideY) {
  if (!body) return hideGuides();
  const rect = body.getBoundingClientRect();
  if (guideX !== null) {
    verticalGuide ??= createGuide('vertical');
    verticalGuide.style.left = `${rect.left + guideX}px`;
    verticalGuide.style.top = `${rect.top}px`;
    verticalGuide.style.height = `${rect.height}px`;
    verticalGuide.hidden = false;
  } else if (verticalGuide) verticalGuide.hidden = true;

  if (guideY !== null) {
    horizontalGuide ??= createGuide('horizontal');
    horizontalGuide.style.left = `${rect.left}px`;
    horizontalGuide.style.top = `${rect.top + guideY}px`;
    horizontalGuide.style.width = `${rect.width}px`;
    horizontalGuide.hidden = false;
  } else if (horizontalGuide) horizontalGuide.hidden = true;
}

function createGuide(axis) {
  const guide = document.createElement('div');
  guide.className = `patch-alignment-guide is-${axis}`;
  guide.setAttribute('aria-hidden', 'true');
  Object.assign(guide.style, {
    position: 'fixed',
    zIndex: '100',
    pointerEvents: 'none',
    background: 'var(--text)',
    opacity: '.65'
  });
  if (axis === 'vertical') guide.style.width = '1px';
  else guide.style.height = '1px';
  guide.hidden = true;
  document.body.appendChild(guide);
  return guide;
}

function hideGuides() {
  if (verticalGuide) verticalGuide.hidden = true;
  if (horizontalGuide) horizontalGuide.hidden = true;
}

function positionResizeHandle(target, selector) {
  const body = target.parentElement;
  const handle = body?.querySelector(`.patch-form-resize-handle[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
  if (!handle) return;
  const layout = readRenderedLayout(target);
  if (!layout) return;
  handle.style.left = `${layout.x + layout.width - 7}px`;
  handle.style.top = `${layout.y + layout.height - 7}px`;
}

function selectorFromElement(element) {
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  return { windowIndex, controlIndex };
}
function selectorKey(selector) { return `${Number(selector.windowIndex)}:${Number(selector.controlIndex)}`; }
