export const DESIGNER_INSPECTOR_STATUS_VERSION = '0.1';

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
