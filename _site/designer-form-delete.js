import { removeDesignerForm } from './designer-form-delete-model.js?v=868f0784ca7f3972';

const code = document.querySelector('#code');
const toolbar = document.querySelector('#designer .designer-toolbar');
let pendingWindowIndex = null;

queueMicrotask(install);

function install() {
  const group = toolbar?.querySelector('.forms-toolbar-group');
  const select = group?.querySelector('#patchFormSelect');
  const duplicate = group?.querySelector('#patchDuplicateForm');
  const add = group?.querySelector('#patchAddForm');
  if (!group || !select || !add || !code) {
    if (!toolbar) return;
    const observer = new MutationObserver(() => {
      const nextGroup = toolbar.querySelector('.forms-toolbar-group');
      if (!nextGroup?.querySelector('#patchFormSelect') || !nextGroup?.querySelector('#patchAddForm')) return;
      observer.disconnect();
      install();
    });
    observer.observe(toolbar, { childList: true, subtree: true });
    return;
  }
  if (group.querySelector('#patchDeleteForm')) return;

  const button = document.createElement('button');
  button.id = 'patchDeleteForm';
  button.className = 'danger small';
  button.type = 'button';
  button.textContent = 'Delete Form';
  button.title = 'Delete the active source-backed Form and its control handlers';
  (duplicate ?? add).insertAdjacentElement('afterend', button);
  button.addEventListener('click', () => deleteActiveForm(select));
  select.addEventListener('change', syncButton);
  code.addEventListener('input', syncButton);
  code.addEventListener('change', syncButton);
  new MutationObserver(() => {
    syncButton();
    activatePendingForm();
  }).observe(select, { childList: true });
  syncButton();
}

function syncButton() {
  const button = toolbar?.querySelector('#patchDeleteForm');
  const select = toolbar?.querySelector('#patchFormSelect');
  if (!button || !select) return;
  button.disabled = select.options.length <= 1;
  button.title = select.options.length <= 1
    ? 'Patch Studio keeps at least one Form in a Window project.'
    : 'Delete the active source-backed Form and its control handlers';
}

function deleteActiveForm(select) {
  const windowIndex = Number(select.value);
  if (!Number.isInteger(windowIndex)) return;
  const option = select.options[windowIndex];
  const label = option?.textContent?.trim() || `Form ${windowIndex + 1}`;
  if (!window.confirm(`Delete ${label}? This removes its source-backed controls and their event handlers.`)) return;
  try {
    const result = removeDesignerForm(code.value, windowIndex);
    pendingWindowIndex = result.windowIndex;
    setSource(result.source);
    queueMicrotask(activatePendingForm);
    requestAnimationFrame(activatePendingForm);
  } catch (error) {
    showError(error);
  }
}

function activatePendingForm() {
  if (!Number.isInteger(pendingWindowIndex)) return;
  const select = toolbar?.querySelector('#patchFormSelect');
  if (!select?.querySelector(`option[value="${pendingWindowIndex}"]`)) return;
  const index = pendingWindowIndex;
  pendingWindowIndex = null;
  select.value = String(index);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  requestAnimationFrame(() => {
    const shell = document.querySelectorAll('#designerCanvas .patch-window')[index];
    shell?.querySelector('.patch-window-title')?.focus?.({ preventScroll: true });
    shell?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}
