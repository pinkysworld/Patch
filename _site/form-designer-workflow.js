import {
  listDesignerControls,
  listDesignerWindows,
  updateDesignerWindow
} from './src/designer.js?v=868f0784ca7f3972';
import { formControlDefaultSize } from './src/form-layout.js?v=868f0784ca7f3972';
import { DESIGNER_SELECTION_EVENT, currentDesignerSelection } from './designer-selection.js?v=868f0784ca7f3972';

const DEFAULT_FORM_WIDTH = 640;
const DEFAULT_FORM_HEIGHT = 420;
const MIN_FIT_WIDTH = 320;
const MIN_FIT_HEIGHT = 240;
const FIT_PADDING = 24;

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
let queued = false;
let cachedSource = null;
let cachedWindows = [];
let cachedControls = [];

if (doc) {
  installStylesheet();
  queueMicrotask(install);
}

export function suggestDesignerFormSize(controls, options = {}) {
  const padding = positiveInteger(options.padding, FIT_PADDING);
  const minWidth = positiveInteger(options.minWidth, MIN_FIT_WIDTH);
  const minHeight = positiveInteger(options.minHeight, MIN_FIT_HEIGHT);
  const items = Array.isArray(controls) ? controls : [];
  if (!items.length) return { width: DEFAULT_FORM_WIDTH, height: DEFAULT_FORM_HEIGHT };

  let right = 0;
  let bottom = 0;
  for (const control of items) {
    const index = Number.isInteger(Number(control?.controlIndex)) ? Number(control.controlIndex) : 0;
    const defaults = formControlDefaultSize(control?.type);
    const x = finiteOr(control?.x, 24);
    const y = finiteOr(control?.y, 24 + index * 48);
    const width = Math.max(16, finiteOr(control?.width, defaults.width));
    const height = Math.max(16, finiteOr(control?.height, defaults.height));
    right = Math.max(right, x + width);
    bottom = Math.max(bottom, y + height);
  }
  return {
    width: Math.max(minWidth, Math.ceil(right + padding)),
    height: Math.max(minHeight, Math.ceil(bottom + padding))
  };
}

function install() {
  if (!designer || !canvas || !toolbar || !code) return;
  if (designer.dataset.patchFormWorkflow === 'true') return;
  designer.dataset.patchFormWorkflow = 'true';

  toolbar.addEventListener('change', event => {
    if (event.target?.id === 'patchFormSelect') scheduleSync();
  });
  canvas.addEventListener('click', activateFormFromTitle);
  canvas.addEventListener('keydown', activateFormFromTitleKey);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, followSelectedControlForm);
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  doc.addEventListener('keydown', navigateFormsByKeyboard, { capture: true });

  new MutationObserver(scheduleSync).observe(designer, { childList: true, subtree: true });
  scheduleSync();
}

function scheduleSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    try {
      installFormNavigation();
      installFormSizingActions();
      syncActiveFormPresentation();
    } catch {
      // Source may be temporarily invalid while the editor is being changed.
    }
  });
}

function installFormNavigation() {
  const group = toolbar.querySelector('.forms-toolbar-group');
  const select = group?.querySelector('#patchFormSelect');
  const label = select?.closest('label');
  if (!group || !select || !label) return;
  if (!group.querySelector('#patchPreviousForm')) {
    const previous = navigationButton('patchPreviousForm', '‹', 'Previous Form (Alt+PageUp)');
    label.insertAdjacentElement('beforebegin', previous);
    previous.addEventListener('click', () => activateRelativeForm(-1));
  }
  if (!group.querySelector('#patchNextForm')) {
    const next = navigationButton('patchNextForm', '›', 'Next Form (Alt+PageDown)');
    label.insertAdjacentElement('afterend', next);
    next.addEventListener('click', () => activateRelativeForm(1));
  }
}

function installFormSizingActions() {
  const panel = toolbar.querySelector('.designer-form-settings-panel');
  if (!panel || panel.dataset.patchFormSizing === 'true') return;
  panel.dataset.patchFormSizing = 'true';

  const actions = doc.createElement('div');
  actions.className = 'designer-form-size-actions';
  actions.innerHTML = `
    <button id="patchFitFormControls" class="secondary" type="button">Fit controls</button>
    <button id="patchDefaultFormSize" class="secondary" type="button">Default 640×420</button>
    <span id="patchFormActionStatus" class="designer-form-action-status" role="status" aria-live="polite"></span>`;
  panel.appendChild(actions);
  actions.querySelector('#patchFitFormControls').addEventListener('click', fitActiveFormToControls);
  actions.querySelector('#patchDefaultFormSize').addEventListener('click', resetActiveFormSize);
}

function syncActiveFormPresentation() {
  const windows = safeWindows();
  const active = activeFormIndex(windows.length);
  const shells = [...canvas.querySelectorAll('.patch-window')];
  shells.forEach((shell, index) => {
    const isActive = index === active;
    shell.classList.toggle('designer-active-form', isActive);
    shell.dataset.formIndex = String(index);
    const title = shell.querySelector(':scope > .patch-window-title');
    if (!title) return;
    title.dataset.formIndex = String(index);
    title.tabIndex = 0;
    title.setAttribute('role', 'button');
    title.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    title.title = isActive ? `Active Form ${index + 1}` : `Activate Form ${index + 1}`;
  });

  const previous = toolbar.querySelector('#patchPreviousForm');
  const next = toolbar.querySelector('#patchNextForm');
  if (previous) previous.disabled = windows.length < 2 || active <= 0;
  if (next) next.disabled = windows.length < 2 || active >= windows.length - 1;

  const fit = toolbar.querySelector('#patchFitFormControls');
  const reset = toolbar.querySelector('#patchDefaultFormSize');
  if (fit) fit.disabled = windows.length === 0;
  if (reset) reset.disabled = windows.length === 0;
}

function activateFormFromTitle(event) {
  const title = event.target?.closest?.('.patch-window-title');
  if (!title || !canvas.contains(title)) return;
  const index = Number(title.dataset.formIndex);
  if (!Number.isInteger(index)) return;
  event.preventDefault();
  activateForm(index, { focusCanvas: false });
}

function activateFormFromTitleKey(event) {
  if (!['Enter', ' '].includes(event.key)) return;
  const title = event.target?.closest?.('.patch-window-title');
  if (!title || !canvas.contains(title)) return;
  const index = Number(title.dataset.formIndex);
  if (!Number.isInteger(index)) return;
  event.preventDefault();
  activateForm(index, { focusCanvas: false });
}

function followSelectedControlForm() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return scheduleSync();
  const select = toolbar.querySelector('#patchFormSelect');
  if (!select || Number(select.value) === selection.windowIndex) return scheduleSync();
  activateForm(selection.windowIndex, { reveal: false, focusCanvas: false });
}

function navigateFormsByKeyboard(event) {
  if (!event.altKey || !['PageUp', 'PageDown'].includes(event.key)) return;
  if (!designer?.contains(doc.activeElement)) return;
  if (doc.activeElement?.matches?.('input, textarea, [contenteditable="true"]')) return;
  const windows = safeWindows();
  if (windows.length < 2) return;
  event.preventDefault();
  activateRelativeForm(event.key === 'PageUp' ? -1 : 1);
}

function activateRelativeForm(delta) {
  const windows = safeWindows();
  if (!windows.length) return;
  const current = activeFormIndex(windows.length);
  const next = Math.max(0, Math.min(windows.length - 1, current + delta));
  if (next === current) return;
  activateForm(next);
}

function activateForm(index, options = {}) {
  const select = toolbar.querySelector('#patchFormSelect');
  const shells = canvas.querySelectorAll('.patch-window');
  if (!select || !Number.isInteger(index) || index < 0 || index >= shells.length) return;
  select.value = String(index);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  syncActiveFormPresentation();
  const shell = shells[index];
  if (options.reveal !== false) shell?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });
  if (options.focusCanvas !== false) shell?.querySelector('.patch-window-title')?.focus?.({ preventScroll: true });
}

function fitActiveFormToControls() {
  const windows = safeWindows();
  if (!windows.length) return;
  const index = activeFormIndex(windows.length);
  const controls = safeControls().filter(control => control.windowIndex === index);
  const size = suggestDesignerFormSize(controls);
  applyFormSize(index, size, `Fit active Form to ${size.width}×${size.height}.`);
}

function resetActiveFormSize() {
  const windows = safeWindows();
  if (!windows.length) return;
  const index = activeFormIndex(windows.length);
  applyFormSize(index, { width: DEFAULT_FORM_WIDTH, height: DEFAULT_FORM_HEIGHT }, 'Restored active Form to 640×420.');
}

function applyFormSize(windowIndex, size, message) {
  try {
    const next = updateDesignerWindow(code.value, windowIndex, size);
    setSource(next);
    const status = toolbar.querySelector('#patchFormActionStatus');
    if (status) status.textContent = message;
  } catch (error) {
    const status = toolbar.querySelector('#patchFormActionStatus');
    if (status) status.textContent = error?.message ?? String(error);
    const target = doc.querySelector('#designerInspectorError');
    if (target) {
      target.textContent = error?.message ?? String(error);
      target.hidden = false;
    }
  }
}

function activeFormIndex(count) {
  if (count <= 0) return 0;
  const select = toolbar.querySelector('#patchFormSelect');
  return Math.max(0, Math.min(Number(select?.value) || 0, count - 1));
}

function refreshSourceSnapshot() {
  const source = code?.value ?? '';
  if (source === cachedSource) return;
  cachedSource = source;
  try { cachedWindows = listDesignerWindows(source); } catch { cachedWindows = []; }
  try { cachedControls = listDesignerControls(source); } catch { cachedControls = []; }
}

function safeWindows() {
  refreshSourceSnapshot();
  return cachedWindows;
}

function safeControls() {
  refreshSourceSnapshot();
  return cachedControls;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function navigationButton(id, text, title) {
  const button = doc.createElement('button');
  button.id = id;
  button.className = 'secondary small designer-form-nav';
  button.type = 'button';
  button.textContent = text;
  button.title = title;
  button.setAttribute('aria-label', title);
  return button;
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-form-workflow]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './form-designer-workflow.css';
  link.dataset.patchFormWorkflow = '1';
  doc.head.appendChild(link);
}
