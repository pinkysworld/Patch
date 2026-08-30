import { listDesignerControls, listDesignerWindows, updateDesignerControl } from './src/designer.js?v=868f0784ca7f3972';
import { formControlDefaultSize, isNonvisualFormControl } from './src/form-layout.js?v=868f0784ca7f3972';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection
} from './designer-selection.js?v=868f0784ca7f3972';
import {
  applyDesignerResizePolicy,
  designerLayoutPresetValue,
  formatDesignerLayoutPolicy,
  normalizeDesignerLayoutPolicy,
  parseDesignerLayoutPreset,
  readDesignerLayoutPolicy,
  setDesignerLayoutPolicy
} from './designer-layout-policy.js?v=868f0784ca7f3972';

export const PATCH_DESIGNER_LAYOUT_INSPECTOR_VERSION = '0.2';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const toolbar = document.querySelector('.designer-toolbar');
let resizeSnapshot = null;
let syncQueued = false;

if (code && canvas && toolbar) {
  installLayoutControl();
  installInspectorLayoutEditor();
  canvas.addEventListener('pointerdown', captureFormResizeStart, { capture: true });
  canvas.addEventListener('keydown', captureFormResizeStart, { capture: true });
  canvas.addEventListener('click', scheduleSync, { capture: true });
  canvas.addEventListener('keydown', scheduleSync, { capture: true });
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleSync);
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  window.addEventListener('patch:form-resized', applyResizePolicies);
  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  scheduleSync();
}

export function designerLayoutInspectorModel(policy, controlType = 'button') {
  const type = String(controlType ?? 'button').toLowerCase();
  if (isNonvisualFormControl(type)) {
    return {
      visible: false,
      locked: true,
      mode: 'fixed',
      anchors: { left: false, right: false, top: false, bottom: false },
      dock: 'top',
      source: 'Nonvisual component'
    };
  }
  const normalized = type === 'statusbar'
    ? { kind: 'dock', side: 'bottom' }
    : normalizeDesignerLayoutPolicy(policy);
  const anchorEdges = normalized.kind === 'anchor' ? new Set(normalized.edges) : new Set(['left', 'top']);
  return {
    visible: true,
    locked: type === 'statusbar',
    mode: normalized.kind,
    anchors: {
      left: anchorEdges.has('left'),
      right: anchorEdges.has('right'),
      top: anchorEdges.has('top'),
      bottom: anchorEdges.has('bottom')
    },
    dock: normalized.kind === 'dock' ? normalized.side : 'top',
    source: normalized.kind === 'fixed' ? 'fixed' : `# @layout ${formatDesignerLayoutPolicy(normalized)}`
  };
}

export function designerLayoutPolicyFromInspector(mode, anchors = {}, dock = 'top') {
  const kind = String(mode ?? 'fixed').toLowerCase();
  if (kind === 'fixed') return { kind: 'fixed' };
  if (kind === 'dock') return normalizeDesignerLayoutPolicy({ kind: 'dock', side: dock });
  if (kind === 'anchor') {
    const edges = ['left', 'right', 'top', 'bottom'].filter(edge => Boolean(anchors?.[edge]));
    if (!edges.length) throw new Error('Anchors needs at least one selected edge.');
    return normalizeDesignerLayoutPolicy({ kind: 'anchor', edges });
  }
  throw new Error(`Unknown Object Inspector layout mode '${mode}'.`);
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

function installInspectorLayoutEditor() {
  const form = document.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorLayoutSection')) return;
  const section = document.createElement('fieldset');
  section.id = 'designerInspectorLayoutSection';
  section.className = 'designer-layout-inspector';
  section.hidden = true;
  section.innerHTML = `
    <legend>Layout</legend>
    <label class="designer-layout-mode">Mode
      <select id="designerInspectorLayoutMode" aria-label="Layout mode">
        <option value="fixed">Fixed</option>
        <option value="anchor">Anchors</option>
        <option value="dock">Dock</option>
      </select>
    </label>
    <div id="designerInspectorAnchorFields" class="designer-anchor-fields" hidden>
      <span>Anchors</span>
      <div class="designer-anchor-box" role="group" aria-label="Anchor edges">
        <label class="anchor-top"><input type="checkbox" data-layout-anchor="top">Top</label>
        <label class="anchor-left"><input type="checkbox" data-layout-anchor="left">Left</label>
        <span class="anchor-center" aria-hidden="true">Control</span>
        <label class="anchor-right"><input type="checkbox" data-layout-anchor="right">Right</label>
        <label class="anchor-bottom"><input type="checkbox" data-layout-anchor="bottom">Bottom</label>
      </div>
    </div>
    <label id="designerInspectorDockField" class="designer-layout-dock" hidden>Dock
      <select id="designerInspectorDockSide" aria-label="Dock side">
        <option value="top">Top</option>
        <option value="bottom">Bottom</option>
        <option value="left">Left</option>
        <option value="right">Right</option>
        <option value="fill">Fill</option>
      </select>
    </label>
    <div class="designer-layout-presets" aria-label="Layout presets">
      <button type="button" class="secondary small" data-layout-preset="anchor:left+top">Top Left</button>
      <button type="button" class="secondary small" data-layout-preset="anchor:left+right+top">Stretch W</button>
      <button type="button" class="secondary small" data-layout-preset="anchor:left+right+top+bottom">Stretch Both</button>
      <button type="button" class="secondary small" data-layout-preset="dock:fill">Fill</button>
    </div>
    <small id="designerInspectorLayoutSource" class="inspector-hint">fixed</small>`;

  const error = form.querySelector('#designerInspectorError');
  form.insertBefore(section, error ?? form.querySelector('.inspector-actions') ?? null);

  section.querySelector('#designerInspectorLayoutMode')?.addEventListener('change', applyInspectorPolicy);
  section.querySelector('#designerInspectorDockSide')?.addEventListener('change', applyInspectorPolicy);
  for (const checkbox of section.querySelectorAll('[data-layout-anchor]')) checkbox.addEventListener('change', applyInspectorPolicy);
  for (const button of section.querySelectorAll('[data-layout-preset]')) {
    button.addEventListener('click', () => applyInspectorPreset(button.dataset.layoutPreset));
  }
}

function applyPolicyToSelection(preset) {
  const selectors = selectedSelectors();
  if (!selectors.length) return;
  const policy = parseDesignerLayoutPreset(preset);
  const controls = listDesignerControls(code.value);
  const edits = selectors.map(selector => {
    const control = controls.find(item => sameSelector(item, selector));
    return control ? { selector, line: control.line, type: control.type } : null;
  }).filter(Boolean)
    .filter(edit => !isNonvisualFormControl(edit.type) && edit.type !== 'statusbar')
    .sort((a, b) => b.line - a.line);

  let next = code.value;
  for (const edit of edits) next = setDesignerLayoutPolicy(next, edit.line, policy);
  if (next !== code.value) setSource(next);
  else scheduleSync();
}

function applyInspectorPreset(preset) {
  const control = currentInspectorControl();
  if (!control || isNonvisualFormControl(control.type) || control.type === 'statusbar') return;
  try {
    const next = setDesignerLayoutPolicy(code.value, control.line, parseDesignerLayoutPreset(preset));
    setSource(next);
  } catch (error) {
    showLayoutError(error);
    scheduleSync();
  }
}

function applyInspectorPolicy() {
  const control = currentInspectorControl();
  if (!control || isNonvisualFormControl(control.type) || control.type === 'statusbar') return;
  const section = document.querySelector('#designerInspectorLayoutSection');
  if (!section) return;
  try {
    const mode = section.querySelector('#designerInspectorLayoutMode')?.value ?? 'fixed';
    const anchors = {};
    for (const checkbox of section.querySelectorAll('[data-layout-anchor]')) anchors[checkbox.dataset.layoutAnchor] = checkbox.checked;
    const dock = section.querySelector('#designerInspectorDockSide')?.value ?? 'top';
    const policy = designerLayoutPolicyFromInspector(mode, anchors, dock);
    const next = setDesignerLayoutPolicy(code.value, control.line, policy);
    setSource(next);
  } catch (error) {
    showLayoutError(error);
    scheduleSync();
  }
}

function captureFormResizeStart(event) {
  const handle = event.target.closest?.('.patch-window-resize-handle');
  if (!handle || !canvas.contains(handle)) return;
  const windowIndex = Number(handle.dataset.windowIndex);
  if (!Number.isInteger(windowIndex)) return;
  const form = listDesignerWindows(code.value).find(item => item.windowIndex === windowIndex);
  if (!form) return;
  const controls = listDesignerControls(code.value)
    .filter(item => item.windowIndex === windowIndex && !isNonvisualFormControl(item.type))
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

function currentInspectorControl() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    return listDesignerControls(code.value).find(control => sameSelector(control, selection)) ?? null;
  } catch {
    return null;
  }
}

function scheduleSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncLayoutControl();
    syncLayoutInspector();
  });
}

function syncLayoutControl() {
  const select = document.querySelector('#patchResponsiveLayout');
  if (!select) return;
  const selectors = selectedSelectors();
  select.disabled = selectors.length === 0;
  if (!selectors.length) {
    select.value = 'fixed';
    select.title = 'Select a visual control to set its source-backed Form resize policy.';
    return;
  }
  const controls = listDesignerControls(code.value);
  const selectedControls = selectors.map(selector => controls.find(item => sameSelector(item, selector))).filter(Boolean);
  if (selectedControls.some(control => isNonvisualFormControl(control.type))) {
    select.value = 'fixed';
    select.disabled = true;
    select.title = 'Nonvisual components have no Form resize policy.';
    return;
  }
  if (selectedControls.length === 1 && selectedControls[0].type === 'statusbar') {
    select.value = 'dock:bottom';
    select.disabled = true;
    select.title = 'StatusBar remains docked to the bottom.';
    return;
  }
  const values = selectedControls.map(control => designerLayoutPresetValue(readDesignerLayoutPolicy(code.value, control.line)));
  const first = values[0];
  if (values.length && values.every(value => value === first) && [...select.options].some(option => option.value === first)) {
    select.value = first;
    select.disabled = false;
    select.title = selectors.length > 1 ? `Apply resize policy to ${selectors.length} selected controls.` : 'Source-backed Form resize policy for the selected control.';
  } else {
    select.selectedIndex = -1;
    select.disabled = false;
    select.title = `${selectors.length} selected controls use mixed resize policies.`;
  }
}

function syncLayoutInspector() {
  const section = document.querySelector('#designerInspectorLayoutSection');
  if (!section) return;
  const control = currentInspectorControl();
  if (!control) {
    section.hidden = true;
    return;
  }
  const policy = readDesignerLayoutPolicy(code.value, control.line);
  const model = designerLayoutInspectorModel(policy, control.type);
  section.hidden = !model.visible;
  if (!model.visible) return;

  const mode = section.querySelector('#designerInspectorLayoutMode');
  const anchorFields = section.querySelector('#designerInspectorAnchorFields');
  const dockField = section.querySelector('#designerInspectorDockField');
  const dock = section.querySelector('#designerInspectorDockSide');
  const source = section.querySelector('#designerInspectorLayoutSource');
  if (mode) mode.value = model.mode;
  if (anchorFields) anchorFields.hidden = model.mode !== 'anchor';
  if (dockField) dockField.hidden = model.mode !== 'dock';
  if (dock) dock.value = model.dock;
  for (const checkbox of section.querySelectorAll('[data-layout-anchor]')) {
    checkbox.checked = Boolean(model.anchors[checkbox.dataset.layoutAnchor]);
  }
  if (source) source.textContent = model.locked
    ? `${model.source} · fixed by component contract`
    : `${model.source} · source-backed`;
  for (const field of section.querySelectorAll('select,input,button')) field.disabled = model.locked;
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
  return Number(value.windowIndex) === Number(selector.windowIndex) && Number(value.controlIndex) === Number(selector.controlIndex);
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
function showLayoutError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}