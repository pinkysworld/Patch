import { listDesignerControls, listDesignerWindows, updateDesignerControl, updateDesignerWindow } from './src/designer.js?v=9ad29318e93c7c71';
import { formControlDefaultSize } from './src/form-layout.js?v=9ad29318e93c7c71';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const MIN_FORM_WIDTH = 240;
const MIN_FORM_HEIGHT = 160;
const DEFAULT_FORM_WIDTH = 640;
const DEFAULT_FORM_HEIGHT = 420;
let decorateQueued = false;
let scrollFrame = 0;

if (code && canvas) {
  new MutationObserver(scheduleDecorate).observe(canvas, { childList: true, subtree: true });
  code.addEventListener('input', scheduleDecorate);
  code.addEventListener('change', scheduleDecorate);
  canvas.addEventListener('pointerdown', beginResizeFromPointer, { capture: true });
  canvas.addEventListener('keydown', resizeFromKeyboard, { capture: true });
  canvas.addEventListener('keydown', moveControlFromKeyboard, { capture: true });
  scheduleDecorate();
}

function scheduleDecorate() {
  if (decorateQueued) return;
  decorateQueued = true;
  queueMicrotask(() => {
    decorateQueued = false;
    try { decorateWindows(); } catch { /* source may be temporarily invalid while typing */ }
  });
}

function decorateWindows() {
  const windows = listDesignerWindows(code.value);
  const shells = [...canvas.querySelectorAll('.patch-window')];
  shells.forEach((shell, windowIndex) => {
    const model = windows.find(item => item.windowIndex === windowIndex);
    const body = shell.querySelector('.patch-window-body');
    if (!model || !body) return;

    const width = clampSize(model.width ?? DEFAULT_FORM_WIDTH, MIN_FORM_WIDTH);
    const height = clampSize(model.height ?? DEFAULT_FORM_HEIGHT, MIN_FORM_HEIGHT);
    shell.classList.add('patch-window-resizable');
    shell.dataset.windowIndex = String(windowIndex);
    shell.style.width = `${width}px`;
    shell.style.maxWidth = 'none';
    body.style.minHeight = `${height}px`;

    let handle = shell.querySelector(':scope > .patch-window-resize-handle');
    if (!handle) {
      handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'patch-window-resize-handle';
      handle.title = 'Drag to resize this form';
      shell.appendChild(handle);
    }
    handle.dataset.windowIndex = String(windowIndex);
    handle.setAttribute('aria-label', `Resize form ${displayTitle(model, windowIndex)}. Use arrow keys; hold Shift for larger steps.`);
  });
}

function beginResizeFromPointer(event) {
  const handle = event.target.closest?.('.patch-window-resize-handle');
  if (!handle || !canvas.contains(handle)) return;
  const windowIndex = Number(handle.dataset.windowIndex);
  if (!Number.isInteger(windowIndex)) return;

  const model = listDesignerWindows(code.value).find(item => item.windowIndex === windowIndex);
  const shell = handle.closest('.patch-window');
  const body = shell?.querySelector('.patch-window-body');
  if (!model || !shell || !body) return;

  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = clampSize(model.width ?? DEFAULT_FORM_WIDTH, MIN_FORM_WIDTH);
  const startHeight = clampSize(model.height ?? DEFAULT_FORM_HEIGHT, MIN_FORM_HEIGHT);
  let nextWidth = startWidth;
  let nextHeight = startHeight;
  handle.setPointerCapture?.(event.pointerId);
  handle.classList.add('is-resizing');

  const move = moveEvent => {
    nextWidth = Math.max(MIN_FORM_WIDTH, startWidth + Math.round(moveEvent.clientX - startX));
    nextHeight = Math.max(MIN_FORM_HEIGHT, startHeight + Math.round(moveEvent.clientY - startY));
    applyVisualSize(shell, body, nextWidth, nextHeight, windowIndex);
    keepGripVisible(handle);
  };

  const finish = finishEvent => {
    cleanup();
    commitWindowSize(windowIndex, nextWidth, nextHeight);
    handle.releasePointerCapture?.(finishEvent.pointerId);
  };

  const cancel = cancelEvent => {
    cleanup();
    applyVisualSize(shell, body, startWidth, startHeight, windowIndex);
    handle.releasePointerCapture?.(cancelEvent.pointerId);
    scheduleDecorate();
  };

  const cleanup = () => {
    handle.classList.remove('is-resizing');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function resizeFromKeyboard(event) {
  const handle = event.target.closest?.('.patch-window-resize-handle');
  if (!handle || !canvas.contains(handle)) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const windowIndex = Number(handle.dataset.windowIndex);
  const model = listDesignerWindows(code.value).find(item => item.windowIndex === windowIndex);
  if (!model) return;

  event.preventDefault();
  event.stopPropagation();
  const step = event.shiftKey ? 20 : 10;
  let width = clampSize(model.width ?? DEFAULT_FORM_WIDTH, MIN_FORM_WIDTH);
  let height = clampSize(model.height ?? DEFAULT_FORM_HEIGHT, MIN_FORM_HEIGHT);
  if (event.key === 'ArrowLeft') width = Math.max(MIN_FORM_WIDTH, width - step);
  if (event.key === 'ArrowRight') width += step;
  if (event.key === 'ArrowUp') height = Math.max(MIN_FORM_HEIGHT, height - step);
  if (event.key === 'ArrowDown') height += step;
  commitWindowSize(windowIndex, width, height);
}

function moveControlFromKeyboard(event) {
  const element = event.target.closest?.('.designer-control.designer-selected');
  if (!element || !canvas.contains(element)) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return;
  const control = listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex);
  if (!control) return;

  event.preventDefault();
  event.stopPropagation();
  const step = event.shiftKey ? 10 : 1;
  const layout = effectiveControlLayout(control, controlIndex);
  let x = layout.x;
  let y = layout.y;
  if (event.key === 'ArrowLeft') x = Math.max(0, x - step);
  if (event.key === 'ArrowRight') x += step;
  if (event.key === 'ArrowUp') y = Math.max(0, y - step);
  if (event.key === 'ArrowDown') y += step;
  commitControlPosition(element, windowIndex, controlIndex, x, y);
}

function commitControlPosition(element, windowIndex, controlIndex, x, y) {
  try {
    let next = updateDesignerControl(code.value, { windowIndex, controlIndex }, { x, y });
    next = growWindowForControl(next, windowIndex, controlIndex);
    code.value = next;
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    syncControlGeometry(windowIndex, controlIndex, x, y);
    window.dispatchEvent(new CustomEvent('patch:control-moved', {
      detail: { windowIndex, controlIndex, x, y }
    }));
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    scheduleDecorate();
  } catch {
    scheduleDecorate();
  }
}

function growWindowForControl(source, windowIndex, controlIndex) {
  const control = listDesignerControls(source).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex);
  const model = listDesignerWindows(source).find(item => item.windowIndex === windowIndex);
  if (!control || !model) return source;
  const layout = effectiveControlLayout(control, controlIndex);
  const width = Math.max(model.width ?? DEFAULT_FORM_WIDTH, layout.x + layout.width + 24);
  const height = Math.max(model.height ?? DEFAULT_FORM_HEIGHT, layout.y + layout.height + 24);
  if (width === (model.width ?? DEFAULT_FORM_WIDTH) && height === (model.height ?? DEFAULT_FORM_HEIGHT)) return source;
  return updateDesignerWindow(source, windowIndex, { width, height });
}

function effectiveControlLayout(control, controlIndex) {
  const defaults = formControlDefaultSize(control.type);
  return {
    x: control.x ?? 24,
    y: control.y ?? (24 + controlIndex * 48),
    width: control.width ?? defaults.width,
    height: control.height ?? defaults.height
  };
}

function commitWindowSize(windowIndex, width, height) {
  try {
    const next = updateDesignerWindow(code.value, windowIndex, { width, height });
    code.value = next;
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    syncToolbar(windowIndex, width, height);
    window.dispatchEvent(new CustomEvent('patch:form-resized', {
      detail: { windowIndex, width, height }
    }));
    scheduleDecorate();
  } catch {
    scheduleDecorate();
  }
}

function applyVisualSize(shell, body, width, height, windowIndex) {
  shell.style.width = `${width}px`;
  shell.style.maxWidth = 'none';
  body.style.minHeight = `${height}px`;
  syncToolbar(windowIndex, width, height);
}

function syncToolbar(windowIndex, width, height) {
  const select = document.querySelector('#patchFormSelect');
  if (Number(select?.value) !== windowIndex) return;
  const widthInput = document.querySelector('#patchFormWidth');
  const heightInput = document.querySelector('#patchFormHeight');
  if (widthInput) widthInput.value = String(width);
  if (heightInput) heightInput.value = String(height);
}

function syncControlGeometry(windowIndex, controlIndex, x, y) {
  const selected = canvas.querySelector(`.designer-control.designer-selected[data-window-index="${windowIndex}"][data-control-index="${controlIndex}"]`);
  if (!selected) return;
  const xInput = document.querySelector('#patchControlX');
  const yInput = document.querySelector('#patchControlY');
  if (xInput) xInput.value = String(x);
  if (yInput) yInput.value = String(y);
}

function keepGripVisible(handle) {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    handle.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

function clampSize(value, minimum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.round(number)) : minimum;
}

function displayTitle(model, windowIndex) {
  const raw = String(model.titleExpr ?? '').trim();
  return raw.replace(/^['"]|['"]$/g, '') || model.id || String(windowIndex + 1);
}
