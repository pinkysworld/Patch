import {
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection,
  selectDesignerElement
} from './designer-selection.js';
import { duplicateDesignerControl } from './designer-control-duplicate-model.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const inspectorForm = document.querySelector('#designerInspectorForm');
let button = null;

queueMicrotask(install);

function install() {
  if (!inspectorForm || !canvas || !code) return;
  const actions = inspectorForm.querySelector('.inspector-actions');
  if (!actions) return;
  button = actions.querySelector('[data-designer-duplicate-control]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.dataset.designerDuplicateControl = '1';
    button.textContent = 'Duplicate';
    button.title = 'Duplicate the selected source-backed control';
    const deleteButton = actions.querySelector('#designerInspectorDelete');
    actions.insertBefore(button, deleteButton ?? null);
    button.addEventListener('click', duplicateSelectedControl);
  }
  canvas.addEventListener('patch-designer-selection-change', syncButton);
  code.addEventListener('input', syncButton);
  code.addEventListener('change', syncButton);
  new MutationObserver(syncButton).observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  syncButton();
}

function syncButton() {
  if (!button) return;
  const selection = currentDesignerSelection(canvas);
  const multi = canvas.querySelectorAll('.designer-control.designer-multi-selected').length;
  button.disabled = !selection || multi > 1;
  button.title = multi > 1
    ? 'Duplicate currently supports one primary control at a time; clear the multi-selection first.'
    : 'Duplicate the selected source-backed control';
}

function duplicateSelectedControl(event) {
  event?.preventDefault?.();
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  if (canvas.querySelectorAll('.designer-control.designer-multi-selected').length > 1) {
    return showError(new Error('Duplicate currently supports one selected control at a time.'));
  }

  try {
    const result = duplicateDesignerControl(code.value, selection);
    const nextSelection = designerSelectionForControl(result.control);
    if (!nextSelection) throw new Error('Duplicated control selection could not be created.');
    code.value = result.source;
    rememberDesignerSelection(canvas, nextSelection, { emit: false, reason: 'duplicate-control' });
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    focusDuplicatedControl(nextSelection);
  } catch (error) {
    showError(error);
  }
}

function focusDuplicatedControl(selection) {
  requestAnimationFrame(() => {
    const element = canvas.querySelector(`.designer-control[data-window-index="${selection.windowIndex}"][data-control-index="${selection.controlIndex}"]`);
    if (!element) return;
    selectDesignerElement(canvas, element, selection, { reason: 'duplicate-control' });
    element.focus?.({ preventScroll: true });
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}
