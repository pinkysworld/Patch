import { duplicateDesignerForm } from './designer-form-duplicate-model.js';

const code = document.querySelector('#code');
const toolbar = document.querySelector('#designer .designer-toolbar');
let pendingWindowIndex = null;

queueMicrotask(install);

function install() {
  const group = toolbar?.querySelector('.forms-toolbar-group');
  const select = group?.querySelector('#patchFormSelect');
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
  if (group.querySelector('#patchDuplicateForm')) return;

  const button = document.createElement('button');
  button.id = 'patchDuplicateForm';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = 'Duplicate Form';
  button.title = 'Duplicate the active source-backed Form';
  add.insertAdjacentElement('afterend', button);
  button.addEventListener('click', () => duplicateActiveForm(select));
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
  const button = toolbar?.querySelector('#patchDuplicateForm');
  const select = toolbar?.querySelector('#patchFormSelect');
  if (!button || !select) return;
  button.disabled = select.options.length === 0;
}

function duplicateActiveForm(select) {
  const windowIndex = Number(select.value);
  if (!Number.isInteger(windowIndex)) return;
  try {
    const result = duplicateDesignerForm(code.value, windowIndex);
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
