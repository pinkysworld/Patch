import { listDesignerControls, listDesignerWindows, updateDesignerControl } from '../src/designer.js';
import { formControlDefaultSize } from '../src/form-layout.js';
import {
  applyDesignerResizePolicy,
  designerLayoutPresetValue,
  parseDesignerLayoutPreset,
  readDesignerLayoutPolicy,
  setDesignerLayoutPolicy
} from './designer-layout-policy.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const toolbar = document.querySelector('.designer-toolbar');
let resizeSnapshot = null;
let syncQueued = false;

if (code && canvas && toolbar) {
  installLayoutControl();
  canvas.addEventListener('pointerdown', captureFormResizeStart, { capture: true });
  canvas.addEventListener('keydown', captureFormResizeStart, { capture: true });
  canvas.addEventListener('click', scheduleSync, { capture: true });
  canvas.addEventListener('keydown', scheduleSync, { capture: true });
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  window.addEventListener('patch:form-resized', applyResizePolicies);
  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  scheduleSync();
}

function installLayoutControl() {
  if (document.querySelector('#patchResponsiveLayout')) return;
  const group = document.createElement('label');
  group.className = 'designer-responsive-layout';
  group.innerHTML = `<span>Resize</span><select id="patchResponsiveLayout" aria-label="Selected control resize policy" title="Source-backed Designer policy used when this Form is resized">
    <option value="fixed">Fixed</option>
    <optgroup label="Anchor">
      <option value="anchor:left+top">Left + Top</option>
      <option value="anchor:right+top">Right + Top</option>
      <option value="anchor:left+bottom">Left + Bottom</option>
      <option value="anchor:right+bottom">Right + Bottom</option>
      <option value="anchor:left+right+top">Stretch Width</option>
      <option value="anchor:left+top+bottom">Stretch Height</option>
      <option value="anchor:left+right+top+bottom">Stretch Both</option>
    </optgroup>
    <optgroup label="Dock">
      <option value="dock:top">Dock Top</option>
      <option value="dock:bottom">Dock Bottom</option>
      <option value="dock:left">Dock Left</option>
      <option value="dock:right">Dock Right</option>
      <option value="dock:fill">Dock Fill</option>
    </optgroup>
  </select>`;
  const formGroup = toolbar.querySelector('.forms-toolbar-group');
  toolbar.insertBefore(group, formGroup ?? null);
  group.querySelector('select').addEventListener('change', event => applyPolicyToSelection(event.target.value));
}

function applyPolicyToSelection(preset) {
  const selectors = selectedSelectors();
  if (!selectors.length) return;
  const policy = parseDesignerLayoutPreset(preset);
  const controls = listDesignerControls(code.value);
  const edits = selectors.map(selector => {
    const control = controls.find(item => sameSelector(item, selector));
    return control ? { selector, line: control.line } : null;
  }).filter(Boolean).sort((a, b) => b.line - a.line);

  let next = code.value;
  for (const edit of edits) next = setDesignerLayoutPolicy(next, edit.line, policy);
  setSource(next);
}

function captureFormResizeStart(event) {
  const handle = event.target.closest?.('.patch-window-resize-handle');
  if (!handle || !canvas.contains(handle)) return;
  const windowIndex = Number(handle.dataset.windowIndex);
  if (!Number.isInteger(windowIndex)) return;
  const form = listDesignerWindows(code.value).find(item => item.windowIndex === windowIndex);
  if (!form) return;
  const controls = listDesignerControls(code.value)
    .filter(item => item.windowIndex === windowIndex)
    .map(item => ({
      selector: { windowIndex: item.windowIndex, controlIndex: item.controlIndex },
      layout: effectiveLayout(item),
      policy: readDesignerLayoutPolicy(code.value, item.line)
    }));
  resizeSnapshot = {
    windowIndex,
    width: form.width ?? 640,
    height: form.height ?? 420,
    controls
  };
}

function applyResizePolicies(event) {
  const detail = event.detail ?? {};
  if (!resizeSnapshot || resizeSnapshot.windowIndex !== detail.windowIndex) return;
  const snapshot = resizeSnapshot;
  resizeSnapshot = null;
  const width = Number(detail.width);
  const height = Number(detail.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  const deltaWidth = width - snapshot.width;
  const deltaHeight = height - snapshot.height;
  if (deltaWidth === 0 && deltaHeight === 0) return;

  let next = code.value;
  for (const item of snapshot.controls) {
    if (item.policy.kind === 'fixed') continue;
    const layout = applyDesignerResizePolicy(item.layout, item.policy, { deltaWidth, deltaHeight, width, height });
    next = updateDesignerControl(next, item.selector, layout);
  }
  if (next !== code.value) setSource(next);
}

function selectedSelectors() {
  const selected = [...canvas.querySelectorAll('.designer-control.designer-multi-selected')]
    .map(selectorFromElement)
    .filter(Boolean);
  if (selected.length) return uniqueSelectors(selected);
  const primary = canvas.querySelector('.designer-control.designer-selected');
  const selector = primary ? selectorFromElement(primary) : null;
  return selector ? [selector] : [];
}

function scheduleSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncLayoutControl();
  });
}

function syncLayoutControl() {
  const select = document.querySelector('#patchResponsiveLayout');
  if (!select) return;
  const selectors = selectedSelectors();
  select.disabled = selectors.length === 0;
  if (!selectors.length) {
    select.value = 'fixed';
    select.title = 'Select a control to set its source-backed Form resize policy.';
    return;
  }
  const controls = listDesignerControls(code.value);
  const values = selectors.map(selector => {
    const control = controls.find(item => sameSelector(item, selector));
    return control ? designerLayoutPresetValue(readDesignerLayoutPolicy(code.value, control.line)) : 'fixed';
  });
  const first = values[0];
  if (values.every(value => value === first) && [...select.options].some(option => option.value === first)) {
    select.value = first;
    select.title = selectors.length > 1 ? `Apply resize policy to ${selectors.length} selected controls.` : 'Source-backed Form resize policy for the selected control.';
  } else {
    select.selectedIndex = -1;
    select.title = `${selectors.length} selected controls use mixed resize policies.`;
  }
}

function effectiveLayout(control) {
  const defaults = formControlDefaultSize(control.type);
  return {
    x: control.x ?? 24,
    y: control.y ?? (24 + (control.controlIndex ?? 0) * 48),
    width: control.width ?? defaults.width,
    height: control.height ?? defaults.height
  };
}
function selectorFromElement(element) {
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  return Number.isInteger(windowIndex) && Number.isInteger(controlIndex) ? { windowIndex, controlIndex } : null;
}
function sameSelector(value, selector) {
  return Number(value.windowIndex) === selector.windowIndex && Number(value.controlIndex) === selector.controlIndex;
}
function uniqueSelectors(selectors) {
  const seen = new Set();
  return selectors.filter(selector => {
    const key = `${selector.windowIndex}:${selector.controlIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}
