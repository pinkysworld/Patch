import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';
import { readWindowInputNumber, setWindowInputNumber } from '../src/input-number.js';
import { currentDesignerSelection, designerSelectionForControl, rememberDesignerSelection, DESIGNER_SELECTION_EVENT } from './designer-selection.js';
import { clearDesignerInspectorError, showDesignerInspectorError } from './designer-ux.js';

export const PATCH_DESIGNER_NUMBEREDIT_VERSION = '0.1';
const DEFAULTS = Object.freeze({ min: 0, max: 100, step: 1 });
const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
let queued = false;

if (doc && code && canvas && designer) queueMicrotask(install);

function install() {
  if (designer.dataset.patchNumberEditStage1 === 'true') return;
  designer.dataset.patchNumberEditStage1 = 'true';
  installPaletteButton();
  installInspector();
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleSync);
  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true });
  scheduleSync();
}

function installPaletteButton() {
  const toolbar = doc.querySelector('#designer .designer-toolbar');
  const anchor = toolbar?.querySelector('#addMaskedEdit') ?? toolbar?.querySelector('#addPasswordEdit') ?? toolbar?.querySelector('#addInput');
  if (!toolbar || !anchor || toolbar.querySelector('#addNumberEdit')) return;
  const button = doc.createElement('button');
  button.id = 'addNumberEdit';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ NumberEdit';
  button.setAttribute('aria-label', 'Add NumberEdit');
  button.title = 'Add a bounded number-backed Input using # @input-number metadata.';
  anchor.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addNumberEdit, { capture: true });
}

function installInspector() {
  const form = doc.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorNumberEditField')) return;
  const field = doc.createElement('div');
  field.id = 'designerInspectorNumberEditField';
  field.className = 'inspector-field';
  field.hidden = true;
  field.innerHTML = `
    <div class="designer-panel-editor-heading"><strong>NumberEdit</strong><span class="inspector-hint">source-backed</span></div>
    <label>Mode
      <select id="designerInputNumberMode"><option value="plain">Plain Input</option><option value="number">NumberEdit</option></select>
    </label>
    <div class="inspector-grid-3">
      <label>Min <input id="designerInputNumberMin" type="number" step="any" value="0"></label>
      <label>Max <input id="designerInputNumberMax" type="number" step="any" value="100"></label>
      <label>Step <input id="designerInputNumberStep" type="number" min="0" step="any" value="1"></label>
    </div>
    <button id="designerInputNumberApply" class="secondary" type="button">Apply NumberEdit</button>
    <small class="inspector-hint">NumberEdit requires a same-id create number state. changed(value) is numeric; persistence still needs explicit change.</small>`;
  form.appendChild(field);
  field.querySelector('#designerInputNumberMode')?.addEventListener('change', syncInspectorEnabled);
  field.querySelector('#designerInputNumberApply')?.addEventListener('click', applyInspector);
}

function activeFormIndex() { return Number(doc.querySelector('#patchFormSelect')?.value) || 0; }

function nextNumberEditId(source) {
  let index = 1;
  while (new RegExp(`\\bnumberedit_${index}\\b`).test(source)) index += 1;
  return `numberedit_${index}`;
}

function prependState(source, id) {
  const normalized = String(source).replace(/\r\n/g, '\n');
  return `create number ${id} = 0\n${normalized.startsWith('window ') ? '\n' : ''}${normalized}`;
}

function addNumberEdit(event) {
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  try {
    const windowIndex = activeFormIndex();
    let next = addDesignerControl(code.value, 'input', { windowIndex });
    let input = listDesignerControls(next).filter(control => control.windowIndex === windowIndex && control.type === 'input').at(-1);
    if (!input) throw new Error('Designer did not create the NumberEdit Input.');
    const id = nextNumberEditId(next);
    next = updateDesignerControl(next, { windowIndex, controlIndex: input.controlIndex }, { id });
    input = listDesignerControls(next).find(control => control.windowIndex === windowIndex && control.controlIndex === input.controlIndex);
    next = setWindowInputNumber(next, input.line, DEFAULTS);
    next = prependState(next, id);
    setSource(next);
    clearDesignerInspectorError({ document: doc });
    rememberDesignerSelection(canvas, designerSelectionForControl(input, 'core'), { reason: 'add-numberedit' });
  } catch (error) { showDesignerInspectorError(error, { document: doc }); }
}

function selectedInput() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    return listDesignerControls(code.value).find(control => control.type === 'input' && Number(control.windowIndex) === Number(selection.windowIndex) && Number(control.controlIndex) === Number(selection.controlIndex)) ?? null;
  } catch { return null; }
}

function scheduleSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; syncInspector(); syncCanvas(); });
}

function syncInspector() {
  const field = doc.querySelector('#designerInspectorNumberEditField');
  if (!field) return;
  const input = selectedInput();
  field.hidden = !input;
  if (!input) return;
  let descriptor = null;
  try { descriptor = readWindowInputNumber(code.value, input.line); } catch {}
  field.querySelector('#designerInputNumberMode').value = descriptor ? 'number' : 'plain';
  field.querySelector('#designerInputNumberMin').value = String(descriptor?.min ?? DEFAULTS.min);
  field.querySelector('#designerInputNumberMax').value = String(descriptor?.max ?? DEFAULTS.max);
  field.querySelector('#designerInputNumberStep').value = String(descriptor?.step ?? DEFAULTS.step);
  syncInspectorEnabled();
}

function syncInspectorEnabled() {
  const number = doc.querySelector('#designerInputNumberMode')?.value === 'number';
  for (const id of ['designerInputNumberMin','designerInputNumberMax','designerInputNumberStep']) {
    const element = doc.querySelector(`#${id}`); if (element) element.disabled = !number;
  }
}

function applyInspector() {
  const input = selectedInput();
  if (!input) return;
  try {
    const enabled = doc.querySelector('#designerInputNumberMode')?.value === 'number';
    const descriptor = enabled ? {
      min: Number(doc.querySelector('#designerInputNumberMin')?.value),
      max: Number(doc.querySelector('#designerInputNumberMax')?.value),
      step: Number(doc.querySelector('#designerInputNumberStep')?.value)
    } : null;
    setSource(setWindowInputNumber(code.value, input.line, descriptor));
    clearDesignerInspectorError({ document: doc });
  } catch (error) { showDesignerInspectorError(error, { document: doc }); }
}

function syncCanvas() {
  let controls;
  try { controls = listDesignerControls(code.value).filter(control => control.type === 'input'); } catch { return; }
  const descriptors = new Map();
  for (const control of controls) {
    try {
      const descriptor = readWindowInputNumber(code.value, control.line);
      if (descriptor) descriptors.set(`${control.windowIndex}:${control.controlIndex}`, descriptor);
    } catch {}
  }
  for (const wrapper of canvas.querySelectorAll('.designer-control[data-window-index][data-control-index]')) {
    const descriptor = descriptors.get(`${wrapper.dataset.windowIndex}:${wrapper.dataset.controlIndex}`) ?? null;
    wrapper.classList.toggle('designer-numberedit', Boolean(descriptor));
    const input = wrapper.matches('input') ? wrapper : wrapper.querySelector('input');
    if (!input) continue;
    if (descriptor) {
      input.type = 'number'; input.min = String(descriptor.min); input.max = String(descriptor.max); input.step = String(descriptor.step);
      input.dataset.patchNumberEdit = 'true';
    } else if (input.dataset.patchNumberEdit === 'true') {
      input.type = 'text'; input.removeAttribute('min'); input.removeAttribute('max'); input.removeAttribute('step'); delete input.dataset.patchNumberEdit;
    }
  }
}

function setSource(next) {
  if (typeof next !== 'string' || next === code.value) return;
  code.value = next;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}
