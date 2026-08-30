import {
  addDesignerShape,
  listDesignerShapes,
  removeDesignerShape,
  updateDesignerShape
} from './src/designer-shape.js?v=868f0784ca7f3972';
import { formControlDefaultLayout } from './src/form-layout.js?v=868f0784ca7f3972';
import { patchShapeSvgDescriptor } from './src/shape-control.js?v=868f0784ca7f3972';
import {
  DESIGNER_SELECTION_EVENT,
  clearDesignerSelection,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js?v=868f0784ca7f3972';
import './designer-data-editor.js?v=868f0784ca7f3972';
import './designer-tabs-nested.js?v=868f0784ca7f3972';
import './designer-tabs-control-actions.js?v=868f0784ca7f3972';
import './designer-tabs-page-duplicate.js?v=868f0784ca7f3972';
import './designer-control-duplicate.js?v=868f0784ca7f3972';
import './designer-form-duplicate.js?v=868f0784ca7f3972';
import './designer-form-delete.js?v=868f0784ca7f3972';
import './designer-table-actions.js?v=868f0784ca7f3972';
import './designer-tree-duplicate.js?v=868f0784ca7f3972';
import './designer-structure-ux.js?v=868f0784ca7f3972';
import './designer-ux.js?v=868f0784ca7f3972';
import './designer-event-inspector.js?v=868f0784ca7f3972';
import './designer-focus-order.js?v=868f0784ca7f3972';
import './designer-layout-actions.js?v=868f0784ca7f3972';
import './form-designer-workflow.js?v=868f0784ca7f3972';
import './designer-menu-designer.js?v=868f0784ca7f3972';
import './designer-panel.js?v=868f0784ca7f3972';
import './designer-ui-namespace.js?v=868f0784ca7f3972';
import './designer-toolbox.js?v=868f0784ca7f3972';
import './designer-statusbar.js?v=868f0784ca7f3972';
import './resource-manager.js?v=868f0784ca7f3972';

const STORAGE_KEY = 'patch-studio-designer-properties-v1';
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 480;
const BULK_WINDOW_SAMPLES = new Set(['workshopDesk', 'listboxMultiWindow']);
const SVG_NS = 'http://www.w3.org/2000/svg';

markCompilerBrand();
installBulkSampleLoadGuard();
queueMicrotask(install);

function markCompilerBrand() {
  // Keep a stable runtime marker for diagnostics and production browser smoke tests.
  // The visible mark itself is the shared compiler-oriented icon.svg used by the
  // browser favicon, PWA/Offline Studio manifest and Studio header.
  const mark = document.querySelector('.brand-mark');
  if (mark) mark.dataset.patchBrandMark = 'compiler-p-v1';
}

function installBulkSampleLoadGuard() {
  const sample = document.querySelector('#sample');
  const code = document.querySelector('#code');
  const root = document.documentElement;
  if (!sample || !code || root.dataset.patchSampleBatchGuard === 'true') return;
  root.dataset.patchSampleBatchGuard = 'true';

  let bulkSampleLoad = false;
  document.addEventListener('change', event => {
    if (event.target === sample && BULK_WINDOW_SAMPLES.has(sample.value)) {
      bulkSampleLoad = true;
      queueMicrotask(() => { bulkSampleLoad = false; });
      return;
    }

    // beta35-studio historically dispatched both input and change for a complete
    // source replacement. Input already schedules persistence, parsing and Designer
    // refresh. Let the following project-kind change perform the one immediate
    // refresh and suppress only the redundant source change pass. This keeps a
    // large showcase from rendering and compiling the same program several times
    // synchronously while preserving the normal public DOM synchronization path.
    if (bulkSampleLoad && event.target === code) event.stopImmediatePropagation();
  }, { capture: true });
}

function install() {
  const surface = document.querySelector('#designer .designer-surface');
  const inspector = document.querySelector('#designerInspector');
  const toolbar = document.querySelector('#designer .designer-toolbar');
  if (!surface || !inspector || !toolbar) {
    const observer = new MutationObserver(() => {
      const nextSurface = document.querySelector('#designer .designer-surface');
      const nextInspector = document.querySelector('#designerInspector');
      const nextToolbar = document.querySelector('#designer .designer-toolbar');
      if (!nextSurface || !nextInspector || !nextToolbar) return;
      observer.disconnect();
      install();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return;
  }

  installShapeStudio(inspector, toolbar);
  if (surface.dataset.patchWorkspaceEnhanced === 'true') return;
  surface.dataset.patchWorkspaceEnhanced = 'true';

  const state = loadState();
  const persist = changes => {
    Object.assign(state, changes);
    saveState(state);
  };
  setWidth(surface, state.width ?? DEFAULT_WIDTH);

  const toggle = document.createElement('button');
  toggle.id = 'designerPropertiesToggle';
  toggle.type = 'button';
  toggle.className = 'secondary small designer-properties-toggle';
  toggle.textContent = 'Object Inspector';
  toggle.title = 'Show or hide the source-backed Object Inspector';
  toolbar.appendChild(toggle);

  const dock = document.createElement('button');
  dock.id = 'designerInspectorDock';
  dock.type = 'button';
  dock.className = 'secondary small designer-inspector-dock';
  toolbar.appendChild(dock);

  const handle = document.createElement('span');
  handle.className = 'designer-inspector-resize';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.tabIndex = 0;
  handle.title = 'Drag to resize Object Inspector. Double-click to reset.';
  inspector.prepend(handle);

  const setCollapsed = collapsed => {
    surface.classList.toggle('designer-properties-collapsed', collapsed);
    toggle.setAttribute('aria-pressed', collapsed ? 'false' : 'true');
    toggle.textContent = collapsed ? 'Show Inspector' : 'Object Inspector';
    persist({ width: currentWidth(surface), collapsed });
  };

  const setDockBelow = dockBelow => {
    surface.classList.toggle('designer-inspector-bottom', dockBelow);
    dock.setAttribute('aria-pressed', dockBelow ? 'true' : 'false');
    dock.textContent = dockBelow ? 'Inspector right' : 'Inspector below';
    dock.title = dockBelow
      ? 'Dock the Object Inspector to the right on wide screens'
      : 'Dock the Object Inspector below the Designer to give the canvas more width';
    handle.setAttribute('aria-hidden', dockBelow ? 'true' : 'false');
    persist({ dockBelow });
  };

  setCollapsed(Boolean(state.collapsed));
  setDockBelow(state.dockBelow === true);

  toggle.addEventListener('click', () => {
    setCollapsed(!surface.classList.contains('designer-properties-collapsed'));
  });

  dock.addEventListener('click', () => {
    setDockBelow(!surface.classList.contains('designer-inspector-bottom'));
  });

  handle.addEventListener('dblclick', () => {
    setWidth(surface, DEFAULT_WIDTH);
    persist({ width: DEFAULT_WIDTH, collapsed: false });
    setCollapsed(false);
  });

  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? DEFAULT_WIDTH
      : currentWidth(surface) + (event.key === 'ArrowLeft' ? 20 : -20);
    setWidth(surface, next);
    persist({ width: currentWidth(surface), collapsed: false });
  });

  handle.addEventListener('pointerdown', event => {
    if (surface.classList.contains('designer-properties-collapsed') || surface.classList.contains('designer-inspector-bottom')) return;
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    surface.classList.add('designer-properties-resizing');

    const release = pointerId => {
      if (pointerId === undefined || !handle.releasePointerCapture) return;
      if (handle.hasPointerCapture?.(pointerId) === false) return;
      try { handle.releasePointerCapture(pointerId); } catch { /* capture may already be gone after pointercancel */ }
    };
    const cleanup = finishEvent => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      surface.classList.remove('designer-properties-resizing');
      release(finishEvent?.pointerId);
    };
    const move = moveEvent => {
      const rect = surface.getBoundingClientRect();
      setWidth(surface, rect.right - moveEvent.clientX);
    };
    const finish = finishEvent => {
      cleanup(finishEvent);
      persist({ width: currentWidth(surface), collapsed: false });
    };
    const cancel = cancelEvent => {
      cleanup(cancelEvent);
      setWidth(surface, state.width ?? DEFAULT_WIDTH);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  });
}

function installShapeStudio(inspector, toolbar) {
  const canvas = document.querySelector('#designerCanvas');
  const code = document.querySelector('#code');
  const form = inspector.querySelector('#designerInspectorForm');
  if (!canvas || !code || !form || canvas.dataset.patchShapeStudio === 'true') return;
  canvas.dataset.patchShapeStudio = 'true';
  installShapeStyles();

  let add = toolbar.querySelector('#addShape');
  if (!add) {
    add = document.createElement('button');
    add.id = 'addShape';
    add.className = 'secondary small';
    add.type = 'button';
    add.textContent = '+ Shape';
    add.setAttribute('aria-label', 'Add Shape');
    add.title = 'Add a source-backed Shape to the active Form';
    toolbar.appendChild(add);
  }

  const shapeFields = createShapeInspectorFields();
  const genericActions = form.querySelector(':scope > .inspector-actions');
  form.insertBefore(shapeFields, genericActions ?? null);

  const schedule = makeShapeScheduler(() => {
    renderDesignerShapes(canvas, code);
    syncShapeInspector(canvas, code, form, shapeFields, genericActions);
  });

  add.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const windowIndex = Number(document.querySelector('#patchFormSelect')?.value) || 0;
      const result = addDesignerShape(code.value, { windowIndex });
      setShapeSource(code, result.source);
      rememberDesignerSelection(canvas, designerSelectionForControl(result.shape, 'core'), { reason: 'add-shape' });
      schedule();
    } catch (error) {
      showShapeError(error);
    }
  }, { capture: true });

  shapeFields.querySelector('#designerShapeApply')?.addEventListener('click', () => applyShapeInspector(canvas, code, schedule));
  shapeFields.querySelector('#designerShapeDelete')?.addEventListener('click', () => deleteShapeInspector(canvas, code, schedule));
  shapeFields.querySelector('#designerShapeSource')?.addEventListener('click', () => revealSelectedShapeSource(canvas, code));
  for (const input of shapeFields.querySelectorAll('input, select')) {
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applyShapeInspector(canvas, code, schedule);
    });
  }

  canvas.addEventListener(DESIGNER_SELECTION_EVENT, schedule);
  code.addEventListener('input', schedule);
  code.addEventListener('change', schedule);
  canvas.addEventListener('pointerdown', event => beginShapePointerEdit(event, canvas, code, schedule), { capture: true });
  new MutationObserver(mutations => {
    if (mutations.every(shapeOnlyMutation)) return;
    schedule();
  }).observe(canvas, { childList: true, subtree: true });
  schedule();
}

function createShapeInspectorFields() {
  const section = document.createElement('section');
  section.id = 'designerShapeInspectorFields';
  section.className = 'designer-shape-inspector';
  section.hidden = true;

  const heading = document.createElement('strong');
  heading.textContent = 'Shape';
  section.appendChild(heading);

  section.appendChild(shapeInputField('Name', 'designerShapeId', { autocomplete: 'off', spellcheck: false }));
  section.appendChild(shapeKindField());

  const styleGrid = document.createElement('div');
  styleGrid.className = 'designer-shape-style-grid';
  styleGrid.append(
    shapeInputField('Fill', 'designerShapeFill', { autocomplete: 'off', spellcheck: false }),
    shapeInputField('Stroke', 'designerShapeStroke', { autocomplete: 'off', spellcheck: false }),
    shapeInputField('Stroke W', 'designerShapeStrokeWidth', { inputMode: 'decimal' }),
    shapeInputField('Radius', 'designerShapeRadius', { inputMode: 'decimal' }),
    shapeInputField('Opacity', 'designerShapeOpacity', { inputMode: 'decimal' })
  );
  section.appendChild(styleGrid);

  const geometry = document.createElement('div');
  geometry.className = 'forms-geometry-grid designer-shape-geometry';
  const geometryHeading = document.createElement('strong');
  geometryHeading.textContent = 'Layout';
  geometry.append(
    geometryHeading,
    shapeInputField('X', 'designerShapeX', { inputMode: 'numeric' }),
    shapeInputField('Y', 'designerShapeY', { inputMode: 'numeric' }),
    shapeInputField('W', 'designerShapeWidth', { inputMode: 'numeric' }),
    shapeInputField('H', 'designerShapeHeight', { inputMode: 'numeric' })
  );
  section.appendChild(geometry);

  const hint = document.createElement('p');
  hint.className = 'inspector-hint';
  hint.textContent = 'Designer-only Shape Stage 1. Web and native build targets remain capability-gated until their renderer slices land.';
  section.appendChild(hint);

  const actions = document.createElement('div');
  actions.className = 'inspector-actions designer-shape-actions';
  actions.append(
    shapeButton('designerShapeApply', 'Apply Shape'),
    shapeButton('designerShapeSource', 'Source', 'secondary'),
    shapeButton('designerShapeDelete', 'Delete', 'danger')
  );
  section.appendChild(actions);
  return section;
}

function shapeInputField(labelText, id, options = {}) {
  const label = document.createElement('label');
  if (options.inspector !== false) label.className = 'inspector-field';
  label.appendChild(document.createTextNode(`${labelText} `));
  const input = document.createElement('input');
  input.id = id;
  if (options.autocomplete !== undefined) input.autocomplete = options.autocomplete;
  if (options.spellcheck !== undefined) input.spellcheck = options.spellcheck;
  if (options.inputMode) input.inputMode = options.inputMode;
  label.appendChild(input);
  return label;
}

function shapeKindField() {
  const label = document.createElement('label');
  label.className = 'inspector-field';
  label.appendChild(document.createTextNode('Kind '));
  const select = document.createElement('select');
  select.id = 'designerShapeKind';
  for (const [value, text] of [
    ['rectangle', 'Rectangle'],
    ['rounded', 'Rounded rectangle'],
    ['ellipse', 'Ellipse'],
    ['line', 'Line']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }
  label.appendChild(select);
  return label;
}

function shapeButton(id, text, className = '') {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.textContent = text;
  if (className) button.className = className;
  return button;
}

function makeShapeScheduler(sync) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      try { sync(); } catch { /* normal while visible source is temporarily invalid */ }
    });
  };
}

function shapeOnlyMutation(mutation) {
  const nodes = [...mutation.addedNodes, ...mutation.removedNodes].filter(node => node.nodeType === 1);
  return nodes.length > 0 && nodes.every(node => node.classList?.contains('patch-shape-designer-control'));
}

function renderDesignerShapes(canvas, code) {
  const bodies = [...canvas.querySelectorAll('.patch-window-body')];
  for (const existing of canvas.querySelectorAll('.patch-shape-designer-control')) existing.remove();
  if (!bodies.length) return;

  const shapes = listDesignerShapes(code.value);
  const selection = currentDesignerSelection(canvas);
  const materializedValue = canvas.dataset.patchDesignerMaterializedForm;
  const materializedWindow = materializedValue === undefined ? null : Number(materializedValue);
  for (const shape of shapes) {
    if (Number.isInteger(materializedWindow) && shape.windowIndex !== materializedWindow) continue;
    const body = bodies[shape.windowIndex];
    if (!body) continue;
    const fallback = formControlDefaultLayout('shape', shape.controlIndex);
    const layout = {
      x: shape.x ?? fallback.x,
      y: shape.y ?? fallback.y,
      width: shape.width ?? fallback.width,
      height: shape.height ?? fallback.height
    };
    const descriptor = patchShapeSvgDescriptor({
      kind: shape.shapeKind,
      fill: shape.fill,
      stroke: shape.stroke,
      strokeWidth: shape.strokeWidth,
      cornerRadius: shape.cornerRadius,
      opacity: shape.opacity
    });
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('designer-control', 'patch-shape-designer-control');
    if (sameShapeLocation(shape, selection)) svg.classList.add('designer-selected');
    svg.dataset.windowIndex = String(shape.windowIndex);
    svg.dataset.controlIndex = String(shape.controlIndex);
    svg.dataset.patchShapeKind = shape.shapeKind;
    svg.setAttribute('viewBox', descriptor.viewBox);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${shape.shapeKind} Shape ${shape.id}`);
    svg.tabIndex = 0;
    Object.assign(svg.style, {
      position: 'absolute',
      left: `${layout.x}px`,
      top: `${layout.y}px`,
      width: `${layout.width}px`,
      height: `${layout.height}px`,
      margin: '0',
      maxWidth: 'none'
    });

    const primitive = document.createElementNS(SVG_NS, descriptor.element);
    for (const [name, value] of Object.entries(descriptor.attributes)) {
      primitive.setAttribute(svgAttributeName(name), String(value));
    }
    primitive.classList.add('patch-shape-primitive');
    svg.appendChild(primitive);

    if (sameShapeLocation(shape, selection)) {
      const handle = document.createElementNS(SVG_NS, 'rect');
      handle.classList.add('patch-shape-resize-handle');
      handle.setAttribute('x', '88');
      handle.setAttribute('y', '88');
      handle.setAttribute('width', '12');
      handle.setAttribute('height', '12');
      handle.setAttribute('rx', '2');
      handle.setAttribute('aria-hidden', 'true');
      svg.appendChild(handle);
    }
    body.classList.add('patch-form-layout');
    body.appendChild(svg);
  }
}

function svgAttributeName(name) {
  if (name === 'strokeWidth') return 'stroke-width';
  if (name === 'vectorEffect') return 'vector-effect';
  return name;
}

function syncShapeInspector(canvas, code, form, shapeFields, genericActions) {
  const shape = selectedShape(canvas, code);
  shapeFields.hidden = !shape;
  if (genericActions) genericActions.hidden = Boolean(shape);
  if (!shape) return;

  for (const id of [
    'designerInspectorIdField', 'designerInspectorTextField', 'designerInspectorOptionsField',
    'designerInspectorSliderFields', 'designerInspectorTimerField', 'designerInspectorPictureSourceField',
    'designerInspectorPictureDisplayFields'
  ]) {
    const field = form.querySelector(`#${id}`);
    if (field) field.hidden = true;
  }
  const genericGeometry = form.querySelector('[data-form-geometry]');
  if (genericGeometry) genericGeometry.hidden = true;
  setShapeField('designerShapeId', shape.id);
  setShapeField('designerShapeKind', shape.shapeKind);
  setShapeField('designerShapeFill', shape.fill);
  setShapeField('designerShapeStroke', shape.stroke);
  setShapeField('designerShapeStrokeWidth', shape.strokeWidth);
  setShapeField('designerShapeRadius', shape.cornerRadius);
  setShapeField('designerShapeOpacity', shape.opacity);
  const fallback = formControlDefaultLayout('shape', shape.controlIndex);
  setShapeField('designerShapeX', shape.x ?? fallback.x);
  setShapeField('designerShapeY', shape.y ?? fallback.y);
  setShapeField('designerShapeWidth', shape.width ?? fallback.width);
  setShapeField('designerShapeHeight', shape.height ?? fallback.height);
}

function setShapeField(id, value) {
  const field = document.querySelector(`#${id}`);
  if (field && document.activeElement !== field) field.value = String(value ?? '');
}

function applyShapeInspector(canvas, code, schedule) {
  const shape = selectedShape(canvas, code);
  if (!shape) return;
  try {
    const result = updateDesignerShape(code.value, shape, {
      id: shapeValue('designerShapeId'),
      shapeKind: shapeValue('designerShapeKind'),
      fill: shapeValue('designerShapeFill'),
      stroke: shapeValue('designerShapeStroke'),
      strokeWidth: shapeValue('designerShapeStrokeWidth'),
      cornerRadius: shapeValue('designerShapeRadius'),
      opacity: shapeValue('designerShapeOpacity'),
      x: shapeValue('designerShapeX'),
      y: shapeValue('designerShapeY'),
      width: shapeValue('designerShapeWidth'),
      height: shapeValue('designerShapeHeight')
    });
    setShapeSource(code, result.source);
    rememberDesignerSelection(canvas, designerSelectionForControl(result.shape, 'core'), { emit: false });
    schedule();
  } catch (error) {
    showShapeError(error);
  }
}

function deleteShapeInspector(canvas, code, schedule) {
  const shape = selectedShape(canvas, code);
  if (!shape) return;
  try {
    const next = removeDesignerShape(code.value, shape);
    clearDesignerSelection(canvas, { reason: 'delete-shape' });
    setShapeSource(code, next);
    schedule();
  } catch (error) {
    showShapeError(error);
  }
}

function revealSelectedShapeSource(canvas, code) {
  const shape = selectedShape(canvas, code);
  if (!shape) return;
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let index = 0; index < shape.line - 1; index += 1) start += lines[index].length + 1;
  const end = start + (lines[shape.line - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function selectedShape(canvas, code) {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    return listDesignerShapes(code.value).find(shape => sameShapeLocation(shape, selection)) ?? null;
  } catch {
    return null;
  }
}

function sameShapeLocation(shape, selection) {
  return Boolean(selection && Number(shape.windowIndex) === Number(selection.windowIndex) && Number(shape.controlIndex) === Number(selection.controlIndex));
}

function shapeValue(id) {
  return document.querySelector(`#${id}`)?.value ?? '';
}

function beginShapePointerEdit(event, canvas, code, schedule) {
  const element = event.target?.closest?.('.patch-shape-designer-control');
  if (!element || !canvas.contains(element)) return;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return;
  const shape = listDesignerShapes(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex);
  if (!shape) return;

  event.preventDefault();
  event.stopPropagation();
  rememberDesignerSelection(canvas, designerSelectionForControl(shape, 'core'), { reason: 'shape-pointer' });
  const fallback = formControlDefaultLayout('shape', shape.controlIndex);
  const start = {
    x: shape.x ?? fallback.x,
    y: shape.y ?? fallback.y,
    width: shape.width ?? fallback.width,
    height: shape.height ?? fallback.height
  };
  const resize = Boolean(event.target?.closest?.('.patch-shape-resize-handle'));
  const startX = event.clientX;
  const startY = event.clientY;
  element.setPointerCapture?.(event.pointerId);

  const move = moveEvent => {
    const dx = Math.round(moveEvent.clientX - startX);
    const dy = Math.round(moveEvent.clientY - startY);
    if (resize) {
      element.style.width = `${Math.max(16, start.width + dx)}px`;
      element.style.height = `${Math.max(16, start.height + dy)}px`;
    } else {
      element.style.left = `${Math.max(0, start.x + dx)}px`;
      element.style.top = `${Math.max(0, start.y + dy)}px`;
    }
  };
  const cleanup = finishEvent => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    if (element.releasePointerCapture && element.hasPointerCapture?.(finishEvent?.pointerId)) {
      try { element.releasePointerCapture(finishEvent.pointerId); } catch { /* capture may already be gone */ }
    }
  };
  const finish = finishEvent => {
    cleanup(finishEvent);
    const changes = resize
      ? { width: parseInt(element.style.width, 10), height: parseInt(element.style.height, 10) }
      : { x: parseInt(element.style.left, 10), y: parseInt(element.style.top, 10) };
    try {
      const result = updateDesignerShape(code.value, shape, changes);
      setShapeSource(code, result.source);
      rememberDesignerSelection(canvas, designerSelectionForControl(result.shape, 'core'), { emit: false });
      schedule();
    } catch (error) {
      showShapeError(error);
      schedule();
    }
  };
  const cancel = cancelEvent => {
    cleanup(cancelEvent);
    schedule();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function setShapeSource(code, source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function showShapeError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function installShapeStyles() {
  if (document.querySelector('#patchDesignerShapeStyles')) return;
  const style = document.createElement('style');
  style.id = 'patchDesignerShapeStyles';
  style.textContent = `
    .patch-shape-designer-control { cursor: move; overflow: visible; touch-action: none; }
    .patch-shape-designer-control .patch-shape-primitive { pointer-events: none; }
    .patch-shape-designer-control.designer-selected { outline: 2px solid currentColor; outline-offset: 3px; }
    .patch-shape-resize-handle { fill: Canvas; stroke: currentColor; stroke-width: 1.5; vector-effect: non-scaling-stroke; cursor: nwse-resize; pointer-events: all; }
    .designer-shape-inspector { display: grid; gap: 10px; margin-top: 10px; }
    .designer-shape-inspector[hidden] { display: none; }
    .designer-shape-style-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .designer-shape-style-grid label { display: grid; gap: 4px; }
    #designer #addShape { top: 491px; }
    #designer #addShape::before { content: "◇"; }
    #designer #addStatusbar { top: 525px; }
    #designer #addTimer { top: 559px; }
    @media (max-width: 760px) { .designer-shape-style-grid { grid-template-columns: 1fr; } }
    @media (forced-colors: active) { .patch-shape-resize-handle { fill: Canvas; stroke: CanvasText; } }
  `;
  document.head.appendChild(style);
}

function setWidth(surface, value) {
  const rect = surface.getBoundingClientRect();
  const available = rect.width > 0 ? Math.max(MIN_WIDTH, rect.width - 420) : MAX_WIDTH;
  const max = Math.min(MAX_WIDTH, available);
  const width = Math.max(MIN_WIDTH, Math.min(max, Math.round(Number(value) || DEFAULT_WIDTH)));
  surface.style.setProperty('--designer-inspector-width', `${width}px`);
}

function currentWidth(surface) {
  const value = getComputedStyle(surface).getPropertyValue('--designer-inspector-width');
  return Math.round(parseFloat(value) || DEFAULT_WIDTH);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      width: Number.isFinite(Number(parsed.width)) ? Number(parsed.width) : DEFAULT_WIDTH,
      collapsed: parsed.collapsed === true,
      dockBelow: parsed.dockBelow === true
    };
  } catch {
    return { width: DEFAULT_WIDTH, collapsed: false, dockBelow: false };
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage can be unavailable */ }
}