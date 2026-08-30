import { listDesignerControls, listDesignerWindows, updateDesignerControl, updateDesignerWindow } from './src/designer.js?v=868f0784ca7f3972';
import { formControlDefaultSize } from './src/form-layout.js?v=868f0784ca7f3972';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const toolbar = document.querySelector('.designer-toolbar');
let selectionKeys = new Set();
let applyQueued = false;
let keyboardSnapshot = null;

if (code && canvas) {
  installAlignmentTools();
  canvas.addEventListener('click', captureSelectionClick, { capture: true });
  canvas.addEventListener('keydown', captureSelectionKey, { capture: true });
  canvas.addEventListener('pointerdown', beginGroupPointerMove, { capture: true });
  new MutationObserver(scheduleSelectionApply).observe(canvas, { childList: true, subtree: true });
  code.addEventListener('input', scheduleSelectionApply);
  code.addEventListener('change', scheduleSelectionApply);
  window.addEventListener('patch:control-moved', moveGroupFromKeyboard);
  scheduleSelectionApply();
}

function captureSelectionClick(event) {
  const control = event.target.closest?.('.designer-control');
  if (!control || !canvas.contains(control)) return;
  const selector = selectorFromElement(control);
  if (!selector) return;
  const additive = event.metaKey || event.ctrlKey || event.shiftKey;
  const primary = primarySelector();

  if (!additive || !primary || primary.windowIndex !== selector.windowIndex) {
    selectionKeys = new Set([selectorKey(selector)]);
    scheduleSelectionApply();
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  toggleSecondary(selector, primary);
}

function captureSelectionKey(event) {
  const control = event.target.closest?.('.designer-control');
  if (!control || !canvas.contains(control)) return;
  const selector = selectorFromElement(control);
  if (!selector) return;

  if ((event.key === 'Enter' || event.key === ' ') && (event.metaKey || event.ctrlKey || event.shiftKey)) {
    const primary = primarySelector();
    if (!primary || primary.windowIndex !== selector.windowIndex) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toggleSecondary(selector, primary);
    return;
  }

  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const primary = primarySelector();
  if (!primary || selectorKey(primary) !== selectorKey(selector)) return;
  const group = selectedSelectors();
  if (group.length < 2) return;
  keyboardSnapshot = snapshotGroup(group, primary);
}

function toggleSecondary(selector, primary) {
  const primaryKey = selectorKey(primary);
  const key = selectorKey(selector);
  if (!selectionKeys.has(primaryKey)) selectionKeys = new Set([primaryKey]);
  if (key === primaryKey) return applySelectionClasses();
  if (selectionKeys.has(key)) selectionKeys.delete(key);
  else selectionKeys.add(key);
  applySelectionClasses();
}

function scheduleSelectionApply() {
  if (applyQueued) return;
  applyQueued = true;
  queueMicrotask(() => {
    applyQueued = false;
    applySelectionClasses();
  });
}

function applySelectionClasses() {
  const primaryElement = canvas.querySelector('.designer-control.designer-selected');
  if (!primaryElement) {
    selectionKeys.clear();
    updateAlignmentTools(0);
    return;
  }
  const primary = selectorFromElement(primaryElement);
  if (!primary) return;
  const primaryKey = selectorKey(primary);
  if (!selectionKeys.has(primaryKey)) selectionKeys = new Set([primaryKey]);

  const controls = [...canvas.querySelectorAll('.designer-control')];
  const live = new Set();
  for (const element of controls) {
    const selector = selectorFromElement(element);
    if (!selector || selector.windowIndex !== primary.windowIndex) {
      element.classList.remove('designer-multi-selected');
      continue;
    }
    const key = selectorKey(selector);
    live.add(key);
    element.classList.toggle('designer-multi-selected', selectionKeys.has(key));
  }
  selectionKeys = new Set([...selectionKeys].filter(key => live.has(key)));
  selectionKeys.add(primaryKey);
  primaryElement.classList.add('designer-multi-selected');
  updateAlignmentTools(selectionKeys.size);
}

function beginGroupPointerMove(event) {
  const primaryElement = event.target.closest?.('.designer-control.designer-selected');
  if (!primaryElement || !canvas.contains(primaryElement)) return;
  const primary = selectorFromElement(primaryElement);
  if (!primary) return;
  const group = selectedSelectors();
  if (group.length < 2) return;

  const snapshot = snapshotGroup(group, primary);
  if (!snapshot || snapshot.secondary.length === 0) return;
  let positions = null;

  const move = () => {
    const rendered = renderedLayout(primaryElement);
    if (!rendered) return;
    const dx = rendered.x - snapshot.primary.layout.x;
    const dy = rendered.y - snapshot.primary.layout.y;
    positions = snapshot.secondary.map(item => ({
      selector: item.selector,
      x: Math.max(0, item.layout.x + dx),
      y: Math.max(0, item.layout.y + dy)
    }));
    for (const item of positions) {
      const element = elementFor(item.selector);
      if (!element) continue;
      element.style.left = `${item.x}px`;
      element.style.top = `${item.y}px`;
    }
  };

  const finish = () => {
    cleanup();
    if (positions?.length) commitGroupLayouts(positions);
  };
  const cancel = () => cleanup();
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function moveGroupFromKeyboard(event) {
  if (!keyboardSnapshot || !event.detail) return;
  const primary = keyboardSnapshot.primary;
  if (event.detail.windowIndex !== primary.selector.windowIndex || event.detail.controlIndex !== primary.selector.controlIndex) {
    keyboardSnapshot = null;
    return;
  }
  const dx = Number(event.detail.x) - primary.layout.x;
  const dy = Number(event.detail.y) - primary.layout.y;
  const positions = keyboardSnapshot.secondary.map(item => ({
    selector: item.selector,
    x: Math.max(0, item.layout.x + dx),
    y: Math.max(0, item.layout.y + dy)
  }));
  keyboardSnapshot = null;
  if (positions.length) commitGroupLayouts(positions);
}

function installAlignmentTools() {
  if (!toolbar || toolbar.querySelector('#patchMultiSelectTools')) return;
  const group = document.createElement('span');
  group.id = 'patchMultiSelectTools';
  group.className = 'designer-multiselect-tools';
  group.innerHTML = `
    <span id="patchSelectionCount" class="designer-selection-count" role="status" aria-live="polite">1 selected</span>
    <button id="patchAlignLeft" class="secondary small" type="button" title="Align selected controls to the primary control's left edge">Left</button>
    <button id="patchAlignRight" class="secondary small" type="button" title="Align selected controls to the primary control's right edge">Right</button>
    <button id="patchAlignTop" class="secondary small" type="button" title="Align selected controls to the primary control's top edge">Top</button>
    <button id="patchAlignBottom" class="secondary small" type="button" title="Align selected controls to the primary control's bottom edge">Bottom</button>
    <button id="patchAlignHCenter" class="secondary small" type="button" title="Align selected controls to the primary control's horizontal center">H center</button>
    <button id="patchAlignVCenter" class="secondary small" type="button" title="Align selected controls to the primary control's vertical center">V center</button>
    <button id="patchSameWidth" class="secondary small" type="button" title="Make selected controls the same width as the primary control">Same W</button>
    <button id="patchSameHeight" class="secondary small" type="button" title="Make selected controls the same height as the primary control">Same H</button>
    <button id="patchDistributeHorizontal" class="secondary small" type="button" title="Distribute three or more selected controls horizontally with equal gaps">Space H</button>
    <button id="patchDistributeVertical" class="secondary small" type="button" title="Distribute three or more selected controls vertically with equal gaps">Space V</button>`;
  const forms = toolbar.querySelector('.forms-toolbar-group');
  toolbar.insertBefore(group, forms ?? null);
  group.querySelector('#patchAlignLeft').addEventListener('click', () => alignSelection('left'));
  group.querySelector('#patchAlignRight').addEventListener('click', () => alignSelection('right'));
  group.querySelector('#patchAlignTop').addEventListener('click', () => alignSelection('top'));
  group.querySelector('#patchAlignBottom').addEventListener('click', () => alignSelection('bottom'));
  group.querySelector('#patchAlignHCenter').addEventListener('click', () => alignSelection('hcenter'));
  group.querySelector('#patchAlignVCenter').addEventListener('click', () => alignSelection('vcenter'));
  group.querySelector('#patchSameWidth').addEventListener('click', () => sizeSelection('width'));
  group.querySelector('#patchSameHeight').addEventListener('click', () => sizeSelection('height'));
  group.querySelector('#patchDistributeHorizontal').addEventListener('click', () => distributeSelection('horizontal'));
  group.querySelector('#patchDistributeVertical').addEventListener('click', () => distributeSelection('vertical'));
  updateAlignmentTools(0);
}

function updateAlignmentTools(count) {
  const group = document.querySelector('#patchMultiSelectTools');
  if (!group) return;
  const displayCount = Math.max(0, count);
  const status = group.querySelector('#patchSelectionCount');
  if (status) status.textContent = `${displayCount} selected`;
  for (const button of group.querySelectorAll('button')) {
    const distribution = button.id === 'patchDistributeHorizontal' || button.id === 'patchDistributeVertical';
    button.disabled = displayCount < (distribution ? 3 : 2);
  }
}

function alignSelection(mode) {
  const primary = primarySelector();
  const group = selectedSelectors();
  if (!primary || group.length < 2) return;
  const controls = listDesignerControls(code.value);
  const primaryControl = controls.find(item => sameSelector(item, primary));
  if (!primaryControl) return;
  const anchor = effectiveLayout(primaryControl);
  const layouts = [];

  for (const selector of group) {
    if (sameSelector(selector, primary)) continue;
    const control = controls.find(item => sameSelector(item, selector));
    if (!control) continue;
    const layout = effectiveLayout(control);
    let x = layout.x;
    let y = layout.y;
    if (mode === 'left') x = anchor.x;
    if (mode === 'right') x = Math.max(0, anchor.x + anchor.width - layout.width);
    if (mode === 'top') y = anchor.y;
    if (mode === 'bottom') y = Math.max(0, anchor.y + anchor.height - layout.height);
    if (mode === 'hcenter') x = Math.max(0, Math.round(anchor.x + anchor.width / 2 - layout.width / 2));
    if (mode === 'vcenter') y = Math.max(0, Math.round(anchor.y + anchor.height / 2 - layout.height / 2));
    layouts.push({ selector, x, y });
  }
  if (layouts.length) commitGroupLayouts(layouts);
}

function sizeSelection(axis) {
  const primary = primarySelector();
  const group = selectedSelectors();
  if (!primary || group.length < 2) return;
  const controls = listDesignerControls(code.value);
  const primaryControl = controls.find(item => sameSelector(item, primary));
  if (!primaryControl) return;
  const anchor = effectiveLayout(primaryControl);
  const layouts = [];
  for (const selector of group) {
    if (sameSelector(selector, primary)) continue;
    const control = controls.find(item => sameSelector(item, selector));
    if (!control) continue;
    layouts.push({
      selector,
      ...(axis === 'width' ? { width: anchor.width } : { height: anchor.height })
    });
  }
  if (layouts.length) commitGroupLayouts(layouts);
}

function distributeSelection(axis) {
  const group = selectedSelectors();
  if (group.length < 3) return;
  const controls = listDesignerControls(code.value);
  const entries = group.map(selector => {
    const control = controls.find(item => sameSelector(item, selector));
    return control ? { selector, layout: effectiveLayout(control) } : null;
  }).filter(Boolean);
  if (entries.length < 3) return;

  const horizontal = axis === 'horizontal';
  entries.sort((left, right) => horizontal
    ? left.layout.x - right.layout.x || left.layout.y - right.layout.y
    : left.layout.y - right.layout.y || left.layout.x - right.layout.x);
  const start = horizontal ? entries[0].layout.x : entries[0].layout.y;
  const end = horizontal
    ? entries.at(-1).layout.x + entries.at(-1).layout.width
    : entries.at(-1).layout.y + entries.at(-1).layout.height;
  const occupied = entries.reduce((sum, item) => sum + (horizontal ? item.layout.width : item.layout.height), 0);
  const gap = Math.max(0, (end - start - occupied) / (entries.length - 1));
  let cursor = start;
  const layouts = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const size = horizontal ? entry.layout.width : entry.layout.height;
    if (index > 0 && index < entries.length - 1) {
      layouts.push({ selector: entry.selector, ...(horizontal ? { x: Math.round(cursor) } : { y: Math.round(cursor) }) });
    }
    cursor += size + gap;
  }
  if (layouts.length) commitGroupLayouts(layouts);
}

function commitGroupLayouts(layouts) {
  try {
    let next = code.value;
    for (const item of layouts) {
      const changes = {};
      for (const key of ['x', 'y', 'width', 'height']) if (Number.isFinite(item[key])) changes[key] = Math.max(0, Math.round(item[key]));
      if (Object.keys(changes).length) next = updateDesignerControl(next, item.selector, changes);
    }
    for (const item of layouts) next = growFormForControl(next, item.selector);
    setSource(next);
  } catch (error) {
    const target = document.querySelector('#designerInspectorError');
    if (target) { target.textContent = error?.message ?? String(error); target.hidden = false; }
  }
}

function snapshotGroup(group, primary) {
  const controls = listDesignerControls(code.value);
  const entries = group.map(selector => {
    const control = controls.find(item => sameSelector(item, selector));
    return control ? { selector, layout: effectiveLayout(control) } : null;
  }).filter(Boolean);
  const primaryEntry = entries.find(item => sameSelector(item.selector, primary));
  if (!primaryEntry) return null;
  return { primary: primaryEntry, secondary: entries.filter(item => !sameSelector(item.selector, primary)) };
}

function selectedSelectors() {
  const primary = primarySelector();
  if (!primary) return [];
  const result = [];
  for (const key of selectionKeys) {
    const selector = parseSelectorKey(key);
    if (selector && selector.windowIndex === primary.windowIndex) result.push(selector);
  }
  if (!result.some(item => sameSelector(item, primary))) result.unshift(primary);
  return result;
}

function primarySelector() {
  const element = canvas.querySelector('.designer-control.designer-selected');
  return element ? selectorFromElement(element) : null;
}
function elementFor(selector) {
  return canvas.querySelector(`.designer-control[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
}
function selectorFromElement(element) {
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  return { windowIndex, controlIndex };
}
function selectorKey(selector) { return `${selector.windowIndex}:${selector.controlIndex}`; }
function parseSelectorKey(key) {
  const [windowIndex, controlIndex] = String(key).split(':').map(Number);
  return Number.isInteger(windowIndex) && Number.isInteger(controlIndex) ? { windowIndex, controlIndex } : null;
}
function sameSelector(value, selector) {
  return Number(value.windowIndex) === selector.windowIndex && Number(value.controlIndex) === selector.controlIndex;
}
function renderedLayout(element) {
  const x = parseInt(element.style.left, 10);
  const y = parseInt(element.style.top, 10);
  const width = parseInt(element.style.width, 10);
  const height = parseInt(element.style.height, 10);
  return [x, y, width, height].every(Number.isFinite) ? { x, y, width, height } : null;
}
function effectiveLayout(control, index = control.controlIndex ?? 0) {
  const defaults = formControlDefaultSize(control.type);
  return {
    x: control.x ?? 24,
    y: control.y ?? (24 + index * 48),
    width: control.width ?? defaults.width,
    height: control.height ?? defaults.height
  };
}
function growFormForControl(source, selector) {
  const control = listDesignerControls(source).find(item => sameSelector(item, selector));
  const form = listDesignerWindows(source).find(item => item.windowIndex === selector.windowIndex);
  if (!control || !form) return source;
  const layout = effectiveLayout(control);
  const width = Math.max(form.width ?? 640, layout.x + layout.width + 24);
  const height = Math.max(form.height ?? 420, layout.y + layout.height + 24);
  if (width === (form.width ?? 640) && height === (form.height ?? 420)) return source;
  return updateDesignerWindow(source, selector.windowIndex, { width, height });
}
function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSelectionApply();
}