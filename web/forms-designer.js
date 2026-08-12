import {
  addDesignerControl,
  addDesignerWindow,
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl,
  updateDesignerWindow
} from '../src/designer.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const appView = document.querySelector('#app');
const toolbar = document.querySelector('.designer-toolbar');
let activeForm = 0;
let scheduled = false;
let pendingReveal = null;

installStylesheet();
installCheckboxTool();
const formTools = installFormTools();
installGeometryInspector();
interceptToolbox();
installDragAndResize();
observe(canvas);
observe(appView);
code?.addEventListener('input', scheduleApply);
code?.addEventListener('change', scheduleApply);
scheduleApply();

function installCheckboxTool() {
  if (!toolbar || toolbar.querySelector('#addCheckbox')) return;
  const button = document.createElement('button');
  button.id = 'addCheckbox';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Checkbox';
  toolbar.appendChild(button);
}

function installFormTools() {
  if (!toolbar) return null;
  const group = document.createElement('span');
  group.className = 'forms-toolbar-group';
  group.innerHTML = `
    <label>Form <select id="patchFormSelect" aria-label="Active form"></select></label>
    <button id="patchAddForm" class="secondary small" type="button">+ Form</button>
    <label>Name <input id="patchFormName" spellcheck="false" aria-label="Form name"></label>
    <label>Title <input id="patchFormTitle" spellcheck="false" aria-label="Form title expression"></label>
    <label>W <input id="patchFormWidth" inputmode="numeric" aria-label="Form width"></label>
    <label>H <input id="patchFormHeight" inputmode="numeric" aria-label="Form height"></label>
    <button id="patchApplyForm" class="secondary small" type="button">Apply form</button>`;
  toolbar.appendChild(group);

  const select = group.querySelector('#patchFormSelect');
  const id = group.querySelector('#patchFormName');
  const title = group.querySelector('#patchFormTitle');
  const width = group.querySelector('#patchFormWidth');
  const height = group.querySelector('#patchFormHeight');
  const add = group.querySelector('#patchAddForm');
  const apply = group.querySelector('#patchApplyForm');

  select.addEventListener('change', () => {
    activeForm = Number(select.value) || 0;
    syncFormTools();
    revealTarget(canvas?.querySelectorAll('.patch-window')[activeForm], 'smooth');
  });
  add.addEventListener('click', () => {
    try {
      const next = addDesignerWindow(code.value);
      activeForm = Math.max(0, listDesignerWindows(next).length - 1);
      pendingReveal = { kind: 'form', windowIndex: activeForm };
      setSource(next);
    } catch (error) { showDesignerError(error); }
  });
  apply.addEventListener('click', applyFormProperties);
  for (const input of [id, title, width, height]) {
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); applyFormProperties(); }
    });
  }
  return { group, select, id, title, width, height, add, apply };
}

function applyFormProperties() {
  try {
    const windows = listDesignerWindows(code.value);
    if (!windows.length) return;
    activeForm = Math.min(activeForm, windows.length - 1);
    const changes = {
      titleExpr: formTools.title.value,
      width: formTools.width.value,
      height: formTools.height.value
    };
    if (formTools.id.value.trim()) changes.id = formTools.id.value;
    const next = updateDesignerWindow(code.value, activeForm, changes);
    setSource(next);
  } catch (error) { showDesignerError(error); }
}

function interceptToolbox() {
  const buttons = [
    ['#addText', 'text'],
    ['#addButton', 'button'],
    ['#addInput', 'input'],
    ['#addCheckbox', 'checkbox'],
    ['#addCombo', 'combo'],
    ['#addListbox', 'listbox'],
    ['#addTabs', 'tabs']
  ];
  for (const [selector, type] of buttons) {
    const button = document.querySelector(selector);
    if (!button) continue;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        const next = addDesignerControl(code.value, type, { windowIndex: activeForm });
        const controls = listDesignerControls(next).filter(item => item.windowIndex === activeForm);
        const added = controls[controls.length - 1];
        pendingReveal = added
          ? { kind: 'control', windowIndex: added.windowIndex, controlIndex: added.controlIndex }
          : { kind: 'form', windowIndex: activeForm };
        setSource(next);
      } catch (error) { showDesignerError(error); }
    }, { capture: true });
  }
}

function installGeometryInspector() {
  const inspectorForm = document.querySelector('#designerInspectorForm');
  if (!inspectorForm || inspectorForm.querySelector('[data-form-geometry]')) return;
  const section = document.createElement('div');
  section.className = 'forms-geometry-grid';
  section.dataset.formGeometry = '1';
  section.innerHTML = `
    <strong>Layout</strong>
    <label>X <input id="patchControlX" inputmode="numeric"></label>
    <label>Y <input id="patchControlY" inputmode="numeric"></label>
    <label>W <input id="patchControlWidth" inputmode="numeric"></label>
    <label>H <input id="patchControlHeight" inputmode="numeric"></label>
    <button id="patchApplyGeometry" class="secondary" type="button">Apply layout</button>`;
  const actions = inspectorForm.querySelector('.inspector-actions');
  inspectorForm.insertBefore(section, actions);
  section.querySelector('#patchApplyGeometry').addEventListener('click', applySelectedGeometry);
  for (const input of section.querySelectorAll('input')) {
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); applySelectedGeometry(); }
    });
  }
}

function applySelectedGeometry() {
  const selected = canvas?.querySelector('.designer-control.designer-selected');
  if (!selected) return;
  const selector = selectorFromElement(selected);
  if (!selector) return;
  const fields = geometryFields();
  try {
    let next = updateDesignerControl(code.value, selector, {
      x: fields.x.value,
      y: fields.y.value,
      width: fields.width.value,
      height: fields.height.value
    });
    next = growFormForControl(next, selector);
    pendingReveal = { kind: 'control', ...selector };
    setSource(next);
  } catch (error) { showDesignerError(error); }
}

function installDragAndResize() {
  if (!canvas) return;
  canvas.addEventListener('pointerdown', event => {
    const handle = event.target.closest?.('.patch-form-resize-handle');
    if (handle) {
      event.preventDefault();
      event.stopPropagation();
      beginPointerEdit(event, handle, 'resize');
      return;
    }
    const control = event.target.closest?.('.designer-control.designer-selected');
    if (!control || !canvas.contains(control)) return;
    event.preventDefault();
    event.stopPropagation();
    beginPointerEdit(event, control, 'move');
  }, { capture: true });
}

function beginPointerEdit(event, element, mode) {
  const selector = selectorFromElement(element);
  if (!selector) return;
  const controls = listDesignerControls(code.value);
  const control = controls.find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);
  if (!control) return;
  const startLayout = effectiveLayout(control);
  const startX = event.clientX;
  const startY = event.clientY;
  const target = canvas.querySelector(`.designer-control[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
  if (!target) return;
  element.setPointerCapture?.(event.pointerId);

  const move = moveEvent => {
    const dx = Math.round(moveEvent.clientX - startX);
    const dy = Math.round(moveEvent.clientY - startY);
    if (mode === 'move') {
      target.style.left = `${Math.max(0, startLayout.x + dx)}px`;
      target.style.top = `${Math.max(0, startLayout.y + dy)}px`;
      positionResizeHandle(target, selector);
    } else {
      target.style.width = `${Math.max(16, startLayout.width + dx)}px`;
      target.style.height = `${Math.max(16, startLayout.height + dy)}px`;
      positionResizeHandle(target, selector);
    }
  };

  const finish = finishEvent => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    const left = parseInt(target.style.left, 10);
    const top = parseInt(target.style.top, 10);
    const width = parseInt(target.style.width, 10);
    const height = parseInt(target.style.height, 10);
    try {
      let next = updateDesignerControl(code.value, selector, {
        x: Number.isFinite(left) ? left : startLayout.x,
        y: Number.isFinite(top) ? top : startLayout.y,
        width: Number.isFinite(width) ? width : startLayout.width,
        height: Number.isFinite(height) ? height : startLayout.height
      });
      next = growFormForControl(next, selector);
      pendingReveal = { kind: 'control', ...selector };
      setSource(next);
    } catch (error) { showDesignerError(error); }
    element.releasePointerCapture?.(finishEvent.pointerId);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
}

function observe(target) {
  if (!target) return;
  new MutationObserver(scheduleApply).observe(target, { childList: true, subtree: true });
}

function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try {
      syncFormTools();
      applyLayouts(canvas, true);
      applyLayouts(appView, false);
      syncGeometryInspector();
      revealPendingDesignerTarget();
    } catch { /* normal while source is temporarily invalid */ }
  });
}

function syncFormTools() {
  if (!formTools) return;
  const windows = listDesignerWindows(code.value);
  if (!windows.length) {
    formTools.select.innerHTML = '<option value="0">No forms</option>';
    for (const input of [formTools.id, formTools.title, formTools.width, formTools.height]) input.value = '';
    return;
  }
  activeForm = Math.min(activeForm, windows.length - 1);
  formTools.select.innerHTML = windows.map(item => {
    const title = displayTitle(item.titleExpr, item.windowIndex);
    const suffix = item.id ? ` · ${item.id}` : '';
    return `<option value="${item.windowIndex}">${escapeHtml(title + suffix)}</option>`;
  }).join('');
  formTools.select.value = String(activeForm);
  const current = windows[activeForm];
  formTools.id.value = current.id ?? '';
  formTools.title.value = current.titleExpr;
  formTools.width.value = String(current.width ?? 640);
  formTools.height.value = String(current.height ?? 420);
}

function applyLayouts(container, designer) {
  if (!container) return;
  const windows = listDesignerWindows(code.value);
  const controls = listDesignerControls(code.value);
  const shells = [...container.querySelectorAll('.patch-window')];
  let selectedForm = null;

  shells.forEach((shell, windowIndex) => {
    const model = windows.find(item => item.windowIndex === windowIndex);
    const body = shell.querySelector('.patch-window-body');
    if (!model || !body) return;
    if (model.width) {
      shell.style.width = `${model.width}px`;
      shell.style.maxWidth = '100%';
    }
    if (model.height) body.style.minHeight = `${model.height}px`;

    const windowControls = controls.filter(item => item.windowIndex === windowIndex);
    const elements = [...body.children].filter(el => !el.classList.contains('patch-form-resize-handle'));
    elements.forEach((el, controlIndex) => {
      el.dataset.windowIndex = String(windowIndex);
      el.dataset.controlIndex = String(controlIndex);
    });

    const sourceHasLayout = Boolean(
      model.width || model.height ||
      windowControls.some(item => item.x !== null || item.y !== null || item.width !== null || item.height !== null)
    );
    if (!designer && !sourceHasLayout) return;

    body.classList.add('patch-form-layout');
    windowControls.forEach((control, controlIndex) => {
      const el = elements[controlIndex];
      if (!el) return;
      const layout = effectiveLayout(control, controlIndex);
      el.classList.add('patch-form-positioned');
      Object.assign(el.style, {
        position: 'absolute',
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        maxWidth: 'none',
        margin: '0'
      });
      if (designer && el.classList.contains('designer-selected')) {
        selectedForm = windowIndex;
        addResizeHandle(body, el, { windowIndex, controlIndex });
      }
    });
  });

  if (designer && selectedForm !== null && selectedForm !== activeForm) {
    activeForm = selectedForm;
    syncFormTools();
  }
}

function addResizeHandle(body, target, selector) {
  let handle = body.querySelector('.patch-form-resize-handle');
  if (!handle) {
    handle = document.createElement('span');
    handle.className = 'patch-form-resize-handle';
    body.appendChild(handle);
  }
  handle.dataset.windowIndex = String(selector.windowIndex);
  handle.dataset.controlIndex = String(selector.controlIndex);
  positionResizeHandle(target, selector);
}

function positionResizeHandle(target, selector) {
  const body = target.parentElement;
  const handle = body?.querySelector(`.patch-form-resize-handle[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
  if (!handle) return;
  const x = parseInt(target.style.left, 10) || 0;
  const y = parseInt(target.style.top, 10) || 0;
  const width = parseInt(target.style.width, 10) || target.offsetWidth;
  const height = parseInt(target.style.height, 10) || target.offsetHeight;
  handle.style.left = `${x + width - 7}px`;
  handle.style.top = `${y + height - 7}px`;
}

function syncGeometryInspector() {
  const selected = canvas?.querySelector('.designer-control.designer-selected');
  const fields = geometryFields();
  if (!selected || !fields.x) return;
  const selector = selectorFromElement(selected);
  if (!selector) return;
  const control = listDesignerControls(code.value).find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);
  if (!control) return;
  const layout = effectiveLayout(control, control.controlIndex);
  fields.x.value = String(layout.x);
  fields.y.value = String(layout.y);
  fields.width.value = String(layout.width);
  fields.height.value = String(layout.height);
}

function geometryFields() {
  return {
    x: document.querySelector('#patchControlX'),
    y: document.querySelector('#patchControlY'),
    width: document.querySelector('#patchControlWidth'),
    height: document.querySelector('#patchControlHeight')
  };
}

function effectiveLayout(control, index = control.controlIndex ?? 0) {
  const defaults = control.type === 'text'
    ? { width: 200, height: 30 }
    : control.type === 'listbox'
      ? { width: 220, height: 120 }
      : control.type === 'tabs'
        ? { width: 420, height: 240 }
        : control.type === 'radio'
          ? { width: 220, height: 84 }
          : (control.type === 'input' || control.type === 'checkbox' || control.type === 'combo')
            ? { width: 220, height: 36 }
            : { width: 120, height: 36 };
  return {
    x: control.x ?? 24,
    y: control.y ?? (24 + index * 48),
    width: control.width ?? defaults.width,
    height: control.height ?? defaults.height
  };
}

function growFormForControl(source, selector) {
  const control = listDesignerControls(source).find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);
  const form = listDesignerWindows(source).find(item => item.windowIndex === selector.windowIndex);
  if (!control || !form) return source;
  const layout = effectiveLayout(control, control.controlIndex);
  const width = Math.max(form.width ?? 640, layout.x + layout.width + 24);
  const height = Math.max(form.height ?? 420, layout.y + layout.height + 24);
  if (width === (form.width ?? 640) && height === (form.height ?? 420)) return source;
  return updateDesignerWindow(source, selector.windowIndex, { width, height });
}

function revealPendingDesignerTarget() {
  if (!pendingReveal || !canvas) return;
  let target = null;
  if (pendingReveal.kind === 'control') {
    target = canvas.querySelector(`.designer-control[data-window-index="${pendingReveal.windowIndex}"][data-control-index="${pendingReveal.controlIndex}"]`);
  } else {
    target = canvas.querySelectorAll('.patch-window')[pendingReveal.windowIndex] ?? null;
  }
  if (!target) return;
  pendingReveal = null;
  revealTarget(target, 'smooth');
}

function revealTarget(target, behavior = 'auto') {
  if (!target) return;
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior });
}

function selectorFromElement(element) {
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  return { windowIndex, controlIndex };
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleApply();
}

function showDesignerError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (target) { target.textContent = error?.message ?? String(error); target.hidden = false; }
}

function displayTitle(expr, index) {
  const text = String(expr ?? '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
  return text || `Form ${index + 1}`;
}

function installStylesheet() {
  if (document.querySelector('link[data-patch-forms-designer]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './forms-designer.css';
  link.dataset.patchFormsDesigner = '1';
  document.head.appendChild(link);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}