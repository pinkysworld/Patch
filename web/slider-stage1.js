import { addDesignerControl, listDesignerControls } from '../src/designer.js';
import { parse } from '../src/parser.js';
import {
  buildWindowSliderPresentationManifest,
  readWindowSliderPresentation,
  setWindowSliderPresentation
} from '../src/window-layout-policy.js';
import {
  clearDesignerInspectorError,
  showDesignerInspectorError
} from './designer-selection.js';

const code = document.querySelector('#code');
const addSlider = document.querySelector('#addSlider');
let progressSyncQueued = false;
let progressGeneration = 0;

installStyles();
installProgressBarStudio();

addSlider?.addEventListener('click', event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!code) return;
  try {
    const activeForm = Number(document.querySelector('#patchFormSelect')?.value) || 0;
    setSource(addDesignerControl(code.value, 'slider', { windowIndex: activeForm }));
  } catch (error) {
    showDesignerInspectorError(error, { document });
  }
}, { capture: true });

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  clearDesignerInspectorError({ document });
}

function installStyles() {
  if (document.querySelector('style[data-patch-slider-stage1]')) return;
  const style = document.createElement('style');
  style.dataset.patchSliderStage1 = '1';
  style.textContent = `
.patch-slider{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;min-width:180px;padding:4px 2px;color:inherit}
.patch-slider input[type="range"]{width:100%;min-width:0;accent-color:currentColor}
.patch-slider output{min-width:3.5em;text-align:right;font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit}
.designer-control.patch-slider{cursor:pointer}
.designer-control.patch-slider input[type="range"]{pointer-events:none}
.patch-slider.patch-progressbar-studio{grid-template-columns:minmax(0,1fr) auto;gap:8px 10px}
.patch-slider.patch-progressbar-studio progress{width:100%;min-width:0;height:18px;accent-color:currentColor}
.patch-slider.patch-progressbar-studio .patch-progressbar-value{min-width:4.5em;text-align:right;font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
.patch-slider.patch-progressbar-studio>.patch-progressbar-source,.patch-slider.patch-progressbar-studio>output:not(.patch-progressbar-value){position:absolute!important;width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;margin:-1px!important;padding:0!important;border:0!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;overflow:hidden!important;white-space:nowrap!important;opacity:0!important;pointer-events:none!important}
.patch-slider.patch-progressbar-studio.designer-control{cursor:pointer}
.patch-slider.patch-scrollbar-studio{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;min-width:180px;padding:4px 2px}
.patch-slider.patch-scrollbar-studio input[type="range"]{grid-column:1;width:100%;height:16px;margin:0;padding:0;border:0;border-radius:999px;background:#e4e4e7;appearance:none;-webkit-appearance:none}
.patch-slider.patch-scrollbar-studio input[type="range"]::-webkit-slider-thumb{width:48px;height:14px;border:1px solid #71717a;border-radius:999px;background:#a1a1aa;-webkit-appearance:none}
.patch-slider.patch-scrollbar-studio input[type="range"]::-moz-range-thumb{width:48px;height:14px;border:1px solid #71717a;border-radius:999px;background:#a1a1aa}
.patch-slider.patch-scrollbar-studio input[type="range"]::-moz-range-track{height:16px;border:0;border-radius:999px;background:#e4e4e7}
.patch-slider.patch-scrollbar-studio>output,.patch-slider.patch-scrollbar-studio>.patch-slider-range{position:absolute!important;width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;margin:-1px!important;padding:0!important;border:0!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;overflow:hidden!important;white-space:nowrap!important}
@media(prefers-color-scheme:dark){.patch-slider.patch-scrollbar-studio input[type="range"]{background:#3f3f46}.patch-slider.patch-scrollbar-studio input[type="range"]::-webkit-slider-thumb,.patch-slider.patch-scrollbar-studio input[type="range"]::-moz-range-thumb{border-color:#a1a1aa;background:#71717a}}
@media(forced-colors:active){.patch-slider.patch-progressbar-studio progress{forced-color-adjust:auto}.patch-slider.patch-scrollbar-studio input[type="range"]{forced-color-adjust:auto}}
`;
  document.head.appendChild(style);
}

function installProgressBarStudio() {
  ensureProgressBarButton();
  ensureProgressBarInspector();
  installProgressBarObservers();
  scheduleProgressBarSync();

  const body = document.body;
  if (!body || body.dataset.patchProgressbarInstallObserver === '1') return;
  body.dataset.patchProgressbarInstallObserver = '1';
  const observer = new MutationObserver(() => {
    ensureProgressBarButton();
    ensureProgressBarInspector();
    installProgressBarObservers();
    if (document.querySelector('#addProgressBar') && document.querySelector('#addScrollBar') && document.querySelector('#designerInspectorSliderPresentationField')) observer.disconnect();
  });
  observer.observe(body, { childList: true, subtree: true });
}

function ensureProgressBarButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const sliderButton = toolbar?.querySelector('#addSlider');
  if (!toolbar || !sliderButton) return false;
  if (toolbar.querySelector('#addProgressBar') && toolbar.querySelector('#addScrollBar')) return true;
  const button = toolbar.querySelector('#addProgressBar') ?? document.createElement('button');
  button.id = 'addProgressBar';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Progress';
  button.setAttribute('aria-label', 'Add ProgressBar');
  button.title = 'Add a passive source-backed ProgressBar preset. It remains Slider state/range semantics and uses # @slider-mode progress.';
  if (!button.isConnected) {
    sliderButton.insertAdjacentElement('afterend', button);
    button.addEventListener('click', addProgressBarFromStudio);
  }
  let scroll = toolbar.querySelector('#addScrollBar');
  if (!scroll) {
    scroll = document.createElement('button');
    scroll.id = 'addScrollBar';
    scroll.className = 'secondary small';
    scroll.type = 'button';
    scroll.textContent = '+ ScrollBar';
    scroll.setAttribute('aria-label', 'Add ScrollBar');
    scroll.title = 'Add an interactive source-backed ScrollBar preset. It remains Slider changed(value) semantics and uses # @slider-mode scrollbar.';
    button.insertAdjacentElement('afterend', scroll);
    scroll.addEventListener('click', addScrollBarFromStudio);
  }
  return true;
}

function addProgressBarFromStudio(event) {
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  if (!code) return;
  try {
    const windowIndex = activeFormIndex();
    let next = addDesignerControl(code.value, 'slider', { windowIndex });
    let added = listDesignerControls(next)
      .filter(control => control.windowIndex === windowIndex && control.type === 'slider')
      .at(-1);
    if (!added?.id) throw new Error('Designer created a Slider but could not locate its source-backed id.');
    next = ensureProgressNumberState(next, added.id, added.min ?? 0);
    const line = findSliderLineById(next, added.id);
    next = setWindowSliderPresentation(next, line, 'progress');
    setSource(next);
    added = listDesignerControls(next).find(control => control.id === added.id && control.type === 'slider') ?? added;
    requestAnimationFrame(() => {
      document.querySelector(`#designerCanvas .designer-control[data-window-index="${added.windowIndex}"][data-control-index="${added.controlIndex}"]`)?.click?.();
      scheduleProgressBarSync();
    });
  } catch (error) {
    showDesignerInspectorError(error, { document });
  }
}

function addScrollBarFromStudio(event) {
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  if (!code) return;
  try {
    const windowIndex = activeFormIndex();
    let next = addDesignerControl(code.value, 'slider', { windowIndex });
    const added = listDesignerControls(next).filter(control => control.windowIndex === windowIndex && control.type === 'slider').at(-1);
    if (!added?.id) throw new Error('Designer created a Slider but could not locate its source-backed id.');
    const line = findSliderLineById(next, added.id);
    next = setWindowSliderPresentation(next, line, 'scrollbar');
    setSource(next);
    requestAnimationFrame(() => {
      document.querySelector(`#designerCanvas .designer-control[data-window-index="${added.windowIndex}"][data-control-index="${added.controlIndex}"]`)?.click?.();
      scheduleProgressBarSync();
    });
  } catch (error) {
    showDesignerInspectorError(error, { document });
  }
}

function ensureProgressBarInspector() {
  const form = document.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorSliderPresentationField')) return Boolean(form?.querySelector('#designerInspectorSliderPresentationField'));
  const field = document.createElement('label');
  field.id = 'designerInspectorSliderPresentationField';
  field.className = 'inspector-field';
  field.hidden = true;
  field.innerHTML = `Slider mode
    <select id="designerInspectorSliderPresentation" aria-describedby="designerInspectorSliderPresentationHint">
      <option value="plain">Slider</option>
      <option value="progress">ProgressBar</option>
      <option value="scrollbar">ScrollBar</option>
    </select>
    <small id="designerInspectorSliderPresentationHint" class="inspector-hint">ProgressBar is a passive source-backed number-state presentation. ScrollBar stays interactive with ordinary Slider changed(value). Both presentations are Studio/Web and fail closed on Current Ready native 1.10.</small>`;
  form.appendChild(field);
  field.querySelector('#designerInspectorSliderPresentation')?.addEventListener('change', applyProgressBarInspector);
  return true;
}

function selectedTopLevelSlider() {
  const canvas = document.querySelector('#designerCanvas');
  const element = canvas?.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!canvas || !code || !element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  try {
    const control = listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
    return control?.type === 'slider' ? control : null;
  } catch {
    return null;
  }
}

function syncProgressBarInspector() {
  const field = document.querySelector('#designerInspectorSliderPresentationField');
  const select = field?.querySelector('#designerInspectorSliderPresentation');
  if (!field || !select) return;
  const control = selectedTopLevelSlider();
  field.hidden = !control;
  if (!control || !code) return;
  try {
    const mode = readWindowSliderPresentation(code.value, control.line);
    if (document.activeElement !== select) select.value = mode;
  } catch {
    field.hidden = true;
  }
}

function applyProgressBarInspector() {
  const select = document.querySelector('#designerInspectorSliderPresentation');
  const control = selectedTopLevelSlider();
  if (!code || !select || !control?.id) return;
  try {
    let next = code.value;
    if (select.value === 'progress') next = ensureProgressNumberState(next, control.id, control.min ?? 0);
    const line = findSliderLineById(next, control.id);
    next = setWindowSliderPresentation(next, line, select.value);
    setSource(next);
    scheduleProgressBarSync();
  } catch (error) {
    showDesignerInspectorError(error, { document });
    scheduleProgressBarSync();
  }
}

function ensureProgressNumberState(source, id, initialValue = 0) {
  const ast = parse(source);
  const existing = ast.find(node => node.kind === 'create' && node.name === id);
  if (existing) {
    if (existing.valueType !== 'number') {
      throw new Error(`ProgressBar '${id}' needs number state, but '${id}' is already declared as ${existing.valueType}.`);
    }
    return source;
  }
  const initial = Number.isFinite(Number(initialValue)) ? Number(initialValue) : 0;
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  return `create number ${id} = ${formatNumber(initial)}\n\n${original.replace(/^\n+/, '')}`;
}

function findSliderLineById(source, id) {
  const escaped = escapeRegExp(id);
  const pattern = new RegExp(`^\\s*slider\\b.*\\bas\\s+${escaped}(?:\\s+step\\b|\\s+at\\b|\\s*$)`, 'i');
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const index = rows.findIndex(row => pattern.test(row));
  if (index < 0) throw new Error(`Cannot find Slider '${id}' in Patch source.`);
  return index + 1;
}

function installProgressBarObservers() {
  if (code?.dataset.patchProgressbarObserver !== '1') {
    code.dataset.patchProgressbarObserver = '1';
    code.addEventListener('input', scheduleProgressBarSync);
    code.addEventListener('change', scheduleProgressBarSync);
  }
  for (const root of [document.querySelector('#designerCanvas'), document.querySelector('#app')]) {
    if (!root || root.dataset.patchProgressbarObserver === '1') continue;
    root.dataset.patchProgressbarObserver = '1';
    new MutationObserver(scheduleProgressBarSync).observe(root, { childList: true, subtree: true });
  }
  const canvas = document.querySelector('#designerCanvas');
  if (canvas?.dataset.patchProgressbarSelectionObserver !== '1') {
    canvas.dataset.patchProgressbarSelectionObserver = '1';
    canvas.addEventListener('patch-designer-selection-change', scheduleProgressBarSync);
  }
  const formSelect = document.querySelector('#patchFormSelect');
  if (formSelect?.dataset.patchProgressbarObserver !== '1') {
    formSelect.dataset.patchProgressbarObserver = '1';
    formSelect.addEventListener('change', scheduleProgressBarSync);
  }
}

function scheduleProgressBarSync() {
  if (progressSyncQueued) return;
  progressSyncQueued = true;
  queueMicrotask(() => {
    progressSyncQueued = false;
    syncProgressBarSurfaces();
    syncProgressBarInspector();
  });
}

function syncProgressBarSurfaces() {
  if (!code) return;
  const currentGeneration = ++progressGeneration;
  let progressIds;
  try {
    const ast = parse(code.value);
    const manifest = buildWindowSliderPresentationManifest(code.value, ast);
    progressIds = new Set(manifest.controls.filter(control => control.mode === 'progress').map(control => control.id).filter(Boolean));
    var scrollBarIds = new Set(manifest.controls.filter(control => control.mode === 'scrollbar').map(control => control.id).filter(Boolean));
  } catch {
    return;
  }
  if (currentGeneration !== progressGeneration) return;

  for (const root of [document.querySelector('#designerCanvas'), document.querySelector('#app')]) {
    if (!root) continue;
    for (const slider of [...root.querySelectorAll('.patch-slider')]) {
      const id = sliderId(slider);
      if (!id) continue;
      if (progressIds.has(id)) renderProgressPresentation(slider, id, root.id === 'app');
      else if (scrollBarIds.has(id)) renderScrollBarPresentation(slider, id, root.id === 'app');
      else restoreSliderPresentation(slider, root.id === 'app');
    }
  }
}

function sliderId(slider) {
  const key = String(slider?.dataset?.patchControlKey ?? '');
  if (key.startsWith('id:')) return key.slice(3);
  const input = slider?.querySelector?.('input[type="range"]');
  const label = String(input?.getAttribute?.('aria-label') ?? '');
  return label.endsWith(' slider') ? label.slice(0, -7) : '';
}

function renderProgressPresentation(slider, id, interactiveRoot) {
  slider.classList.add('patch-progressbar-studio');
  slider.dataset.patchSliderPresentation = 'progress';
  const input = slider.querySelector('input[type="range"]');
  if (!input) return;
  input.classList.add('patch-progressbar-source');
  input.disabled = true;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  let meter = slider.querySelector('progress.patch-progressbar-meter');
  if (!meter) {
    meter = document.createElement('progress');
    meter.className = 'patch-progressbar-meter';
    slider.prepend(meter);
  }
  const min = finiteNumber(input.min, 0);
  const max = finiteNumber(input.max, 100);
  const raw = finiteNumber(input.value, min);
  const value = Math.min(max, Math.max(min, raw));
  meter.min = min;
  meter.max = max;
  meter.value = value;
  meter.setAttribute('aria-label', `${id} progress`);
  meter.setAttribute('aria-valuetext', `${formatNumber(value)} of ${formatNumber(max)}`);

  let output = slider.querySelector('.patch-progressbar-value');
  if (!output) {
    output = document.createElement('output');
    output.className = 'patch-progressbar-value';
    slider.appendChild(output);
  }
  output.textContent = `${formatNumber(value)} / ${formatNumber(max)}`;
  output.value = formatNumber(value);
  if (interactiveRoot) slider.setAttribute('aria-label', `${id} ProgressBar`);
}

function renderScrollBarPresentation(slider, id, interactiveRoot) {
  restoreSliderPresentation(slider, interactiveRoot);
  slider.classList.add('patch-scrollbar-studio');
  slider.dataset.patchSliderPresentation = 'scrollbar';
  const input = slider.querySelector('input[type=\"range\"]');
  if (!input) return;
  input.disabled = !interactiveRoot;
  input.removeAttribute('aria-hidden');
  input.setAttribute('aria-label', `${id} scrollbar`);
  input.setAttribute('aria-roledescription', 'scroll bar');
  if (interactiveRoot) input.removeAttribute('tabindex'); else input.tabIndex = -1;
}

function restoreSliderPresentation(slider, interactiveRoot) {
  if (!slider.classList.contains('patch-progressbar-studio') && !slider.classList.contains('patch-scrollbar-studio')) return;
  slider.classList.remove('patch-progressbar-studio', 'patch-scrollbar-studio');
  delete slider.dataset.patchSliderPresentation;
  slider.querySelector('progress.patch-progressbar-meter')?.remove();
  slider.querySelector('.patch-progressbar-value')?.remove();
  const input = slider.querySelector('input[type="range"]');
  if (input) {
    input.classList.remove('patch-progressbar-source');
    input.removeAttribute('aria-hidden');
    input.removeAttribute('aria-roledescription');
    input.removeAttribute('tabindex');
    input.disabled = !interactiveRoot;
  }
  slider.removeAttribute('aria-label');
}

function activeFormIndex() {
  const value = Number(document.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value) {
  return Object.is(Number(value), -0) ? '0' : String(Number(value));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
