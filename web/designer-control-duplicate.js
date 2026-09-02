import { currentDesignerSelection } from './designer-selection.js';
import {
  DESIGNER_CONTROL_COMMANDS,
  dispatchDesignerControlCommand
} from './designer-core-selection.js';

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
  dispatchDesignerControlCommand(DESIGNER_CONTROL_COMMANDS.DUPLICATE, { origin: 'inspector-duplicate' });
}
