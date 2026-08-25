import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';

export const PATCH_DESIGNER_PICTURE_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const designer = doc?.querySelector('#designer') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
let syncQueued = false;

if (doc) queueMicrotask(install);

export function listDesignerPictures(source, windowIndex = null) {
  const pictures = listDesignerControls(source).filter(control => control.type === 'picture');
  return Number.isInteger(windowIndex) ? pictures.filter(control => control.windowIndex === windowIndex) : pictures;
}

export function normalizeDesignerPictureSource(value) {
  const source = String(value ?? '').trim();
  return source || '""';
}

function install() {
  if (!designer || !toolbar || !code || !canvas || designer.dataset.patchPictureRad === 'true') return;
  designer.dataset.patchPictureRad = 'true';
  installStylesheet();
  installPictureButton();
  installPictureInspector();
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleSync);
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  scheduleSync();
}

function installPictureButton() {
  if (toolbar.querySelector('#addPicture')) return;
  const button = doc.createElement('button');
  button.id = 'addPicture';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Picture';
  button.setAttribute('aria-label', 'Add PictureBox');
  button.title = 'Add a source-backed PictureBox image control to the active Form';
  toolbar.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    addPictureFromToolbox();
  }, { capture: true });
}

function addPictureFromToolbox() {
  try {
    const windowIndex = Number(doc.querySelector('#patchFormSelect')?.value) || 0;
    const next = addDesignerControl(code.value, 'picture', { windowIndex });
    const picture = listDesignerPictures(next, windowIndex).at(-1) ?? null;
    setSource(next);
    if (picture) rememberDesignerSelection(canvas, designerSelectionForControl(picture, 'core'), { reason: 'add-picture' });
  } catch (error) {
    showInspectorError(error);
  }
}

function installPictureInspector() {
  const form = doc.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorPictureField')) return;
  const field = doc.createElement('label');
  field.id = 'designerInspectorPictureField';
  field.className = 'inspector-field';
  field.hidden = true;
  field.innerHTML = `Image source
    <input id="designerInspectorPictureSource" autocomplete="off" spellcheck="false" placeholder='"images/logo.png" or image_state' aria-describedby="designerInspectorPictureHint">
    <small id="designerInspectorPictureHint" class="inspector-hint">Quoted URL/path or a same-name text state. Images use proportional fit; desktop builds load local image files.</small>`;
  const slider = form.querySelector('#designerInspectorSliderFields');
  slider?.insertAdjacentElement('afterend', field);

  doc.addEventListener('click', interceptInspectorApply, { capture: true });
  doc.addEventListener('keydown', interceptInspectorEnter, { capture: true });
}

function interceptInspectorApply(event) {
  if (!event.target?.closest?.('#designerInspectorApply')) return;
  const control = currentPicture();
  if (!control) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  applyPictureInspector(control);
}

function interceptInspectorEnter(event) {
  if (event.key !== 'Enter' || !['designerInspectorId', 'designerInspectorPictureSource'].includes(event.target?.id)) return;
  const control = currentPicture();
  if (!control) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  applyPictureInspector(control);
}

function applyPictureInspector(control) {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  try {
    const next = updateDesignerControl(code.value, selection, {
      id: doc.querySelector('#designerInspectorId')?.value ?? control.id,
      sourceExpr: normalizeDesignerPictureSource(doc.querySelector('#designerInspectorPictureSource')?.value ?? control.sourceExpr)
    });
    const updated = listDesignerControls(next).find(item => sameLocation(item, selection)) ?? control;
    rememberDesignerSelection(canvas, designerSelectionForControl(updated, 'core'), { emit: false });
    setSource(next);
  } catch (error) {
    showInspectorError(error);
  }
}

function scheduleSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncPictureInspector();
  });
}

function syncPictureInspector() {
  const field = doc?.querySelector('#designerInspectorPictureField');
  if (!field) return;
  const control = currentSelectedControl();
  const isPicture = control?.type === 'picture';
  field.hidden = !isPicture;
  if (!isPicture) return;

  const form = doc.querySelector('#designerInspectorForm');
  const empty = doc.querySelector('#designerInspectorEmpty');
  if (form) form.hidden = false;
  if (empty) empty.hidden = true;

  const type = doc.querySelector('#designerInspectorType');
  const idField = doc.querySelector('#designerInspectorIdField');
  const textField = doc.querySelector('#designerInspectorTextField');
  const optionsField = doc.querySelector('#designerInspectorOptionsField');
  const sliderFields = doc.querySelector('#designerInspectorSliderFields');
  const timerField = doc.querySelector('#designerInspectorTimerField');
  const panelField = doc.querySelector('#designerInspectorPanelField');
  const id = doc.querySelector('#designerInspectorId');
  const source = field.querySelector('#designerInspectorPictureSource');
  const location = doc.querySelector('#designerInspectorLocation');

  if (type) type.textContent = 'PictureBox';
  if (idField) idField.hidden = false;
  if (textField) textField.hidden = true;
  if (optionsField) optionsField.hidden = true;
  if (sliderFields) sliderFields.hidden = true;
  if (timerField) timerField.hidden = true;
  if (panelField) panelField.hidden = true;
  if (id && doc.activeElement !== id) id.value = control.id ?? '';
  if (source && doc.activeElement !== source) source.value = control.sourceExpr ?? '""';
  if (location) location.textContent = `Window ${control.windowIndex + 1} · control ${control.controlIndex + 1} · line ${control.line} · image`;
}

function currentPicture() {
  const control = currentSelectedControl();
  return control?.type === 'picture' ? control : null;
}

function currentSelectedControl() {
  if (!canvas || !code) return null;
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    return listDesignerControls(code.value).find(control => sameLocation(control, selection)) ?? null;
  } catch {
    return null;
  }
}

function sameLocation(control, selection) {
  return Number(control?.windowIndex) === Number(selection?.windowIndex) && Number(control?.controlIndex) === Number(selection?.controlIndex);
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function showInspectorError(error) {
  const target = doc?.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-picture-rad]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-picture.css';
  link.dataset.patchPictureRad = '1';
  doc.head.appendChild(link);
}