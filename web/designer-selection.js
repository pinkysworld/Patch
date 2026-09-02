const selectionState = new WeakMap();
const installedBridges = new WeakSet();

export const DESIGNER_SELECTION_EVENT = 'patch-designer-selection-change';
export const DESIGNER_INSPECTOR_STATUS_VERSION = '0.1';

export function normalizeDesignerSelection(selection) {
  if (!selection || typeof selection !== 'object') return null;
  const windowIndex = Number(selection.windowIndex);
  const controlIndex = Number(selection.controlIndex);
  const adapter = String(selection.adapter ?? '').trim();
  if (!Number.isInteger(windowIndex) || windowIndex < 0) return null;
  if (!Number.isInteger(controlIndex) || controlIndex < 0) return null;
  if (!adapter) return null;
  const normalized = { windowIndex, controlIndex, adapter };
  const id = String(selection.id ?? '').trim();
  if (id) normalized.id = id;
  return normalized;
}

export function designerSelectionForControl(control, adapter = null) {
  if (!control || typeof control !== 'object') return null;
  const resolvedAdapter = String(adapter ?? '').trim() || (
    control.type === 'table' ? 'table' : control.type === 'tree' ? 'tree' : 'core'
  );
  return normalizeDesignerSelection({
    windowIndex: control.windowIndex,
    controlIndex: control.controlIndex,
    adapter: resolvedAdapter,
    id: control.id ?? ''
  });
}

export function sameDesignerSelection(left, right) {
  const a = normalizeDesignerSelection(left);
  const b = normalizeDesignerSelection(right);
  return Boolean(
    a && b &&
    a.windowIndex === b.windowIndex &&
    a.controlIndex === b.controlIndex &&
    a.adapter === b.adapter
  );
}

export function currentDesignerSelection(canvas, adapter = null) {
  if (!canvas) return null;
  const current = selectionState.get(canvas) ?? null;
  if (!current) return null;
  if (adapter && current.adapter !== adapter) return null;
  return { ...current };
}

export function rememberDesignerSelection(canvas, selection, options = {}) {
  if (!canvas) return null;
  const normalized = normalizeDesignerSelection(selection);
  if (!normalized) return clearDesignerSelection(canvas, options);
  const previous = selectionState.get(canvas) ?? null;
  selectionState.set(canvas, normalized);
  if (options.element) selectDesignerElement(canvas, options.element, normalized, { ...options, emit: false });
  if (options.emit !== false && !sameDesignerSelection(previous, normalized)) {
    emitSelection(canvas, normalized, options.reason ?? 'adapter');
  }
  return { ...normalized };
}

export function selectDesignerElement(canvas, element, selection, options = {}) {
  if (!canvas || !element) return null;
  const normalized = normalizeDesignerSelection(selection);
  if (!normalized) return null;
  const previous = selectionState.get(canvas) ?? null;
  selectionState.set(canvas, normalized);
  decorateDesignerAdapterElement(canvas, element, normalized);
  for (const current of canvas.querySelectorAll?.('.designer-control.designer-selected') ?? []) {
    if (current !== element) current.classList.remove('designer-selected');
  }
  element.classList.add('designer-selected');
  if (options.emit !== false && !sameDesignerSelection(previous, normalized)) {
    emitSelection(canvas, normalized, options.reason ?? 'adapter');
  }
  return { ...normalized };
}

export function decorateDesignerAdapterElement(canvas, element, selection) {
  const normalized = normalizeDesignerSelection(selection);
  if (!canvas || !element || !normalized) return null;
  element.dataset.patchDesignerAdapter = normalized.adapter;
  element.dataset.windowIndex = String(normalized.windowIndex);
  element.dataset.controlIndex = String(normalized.controlIndex);
  if (normalized.id) element.dataset.controlId = normalized.id;
  else delete element.dataset.controlId;
  const selected = selectionState.get(canvas) ?? null;
  if (sameDesignerSelection(selected, normalized) && (selected?.id ?? '') !== (normalized.id ?? '')) {
    selectionState.set(canvas, normalized);
  }
  element.classList.toggle('designer-selected', sameDesignerSelection(selected, normalized));
  return normalized;
}

export function restoreDesignerAdapterSelection(canvas, adapter, findElement, options = {}) {
  const selection = currentDesignerSelection(canvas, adapter);
  if (!selection) return null;
  const element = typeof findElement === 'function' ? findElement(selection) : null;
  if (!element) {
    const sourceStillLive = typeof options.isLive === 'function' && options.isLive(selection);
    if (sourceStillLive) return null;
    clearDesignerSelection(canvas, { adapter, reason: 'missing-control' });
    return null;
  }
  selectDesignerElement(canvas, element, selection, { emit: false, reason: 'restore' });
  return element;
}

export function clearDesignerSelection(canvas, options = {}) {
  if (!canvas) return null;
  const current = selectionState.get(canvas) ?? null;
  if (!current) return null;
  if (options.adapter && current.adapter !== options.adapter) return { ...current };
  selectionState.delete(canvas);
  for (const element of canvas.querySelectorAll?.('[data-patch-designer-adapter].designer-selected') ?? []) {
    element.classList.remove('designer-selected');
  }
  if (options.emit !== false) emitSelection(canvas, null, options.reason ?? 'clear');
  return null;
}

export function installDesignerSelectionBridge(canvas) {
  if (!canvas || installedBridges.has(canvas)) return;
  installedBridges.add(canvas);

  const clearForCanvasSelection = event => {
    const control = event.target?.closest?.('.designer-control');
    if (control) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    clearDesignerSelection(canvas, { reason: 'canvas' });
  };

  canvas.addEventListener('click', clearForCanvasSelection, { capture: true });
  canvas.addEventListener('keydown', clearForCanvasSelection, { capture: true });
}

export function designerInspectorErrorMessage(error) {
  if (typeof error === 'string') return error;
  return error?.message ?? String(error ?? 'Designer action failed');
}

export function showDesignerInspectorError(error, options = {}) {
  const target = designerInspectorErrorTarget(options);
  if (!target) return false;
  target.textContent = designerInspectorErrorMessage(error);
  target.hidden = false;
  target.dataset.state = 'invalid';
  return true;
}

export function clearDesignerInspectorError(options = {}) {
  const target = designerInspectorErrorTarget(options);
  if (!target) return false;
  target.textContent = '';
  target.hidden = true;
  delete target.dataset.state;
  return true;
}

export function designerInspectorErrorTarget(options = {}) {
  const doc = options.document ?? globalThis.document;
  const selector = options.selector ?? '#designerInspectorError';
  return doc?.querySelector?.(selector) ?? null;
}

function emitSelection(canvas, selection, reason) {
  const detail = {
    selection: selection ? { ...selection } : null,
    reason: String(reason ?? 'adapter')
  };
  if (typeof CustomEvent === 'function') {
    canvas.dispatchEvent(new CustomEvent(DESIGNER_SELECTION_EVENT, { bubbles: false, detail }));
    return;
  }
  const event = typeof Event === 'function' ? new Event(DESIGNER_SELECTION_EVENT) : { type: DESIGNER_SELECTION_EVENT };
  event.detail = detail;
  canvas.dispatchEvent?.(event);
}
