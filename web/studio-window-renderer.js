import { pictureResourceDataUri } from '../src/webapp.js';
import { getRuntimeSelection, runtimeSelectionKey, setRuntimeSelection } from './studio-runtime-selection-state.js';
import { PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL, resolveStudioRuntimeRenderMode } from './studio-runtime-render-policy.js';
import { getStudioProjectResources } from './project-lifecycle.js';

export const PATCH_STUDIO_WINDOW_RENDERER_VERSION = '0.2';

function runtimeWindowKey(model, windowIndex) {
  return String(model?.id ?? `window${windowIndex + 1}`);
}

function runtimeControlKey(control, context) {
  return runtimeSelectionKey(control, context);
}

function runtimeWindowFingerprint(model) {
  return JSON.stringify(model ?? null);
}

const RUNTIME_CORE_CONTROL_TYPES = new Set([
  'tabs', 'panel', 'text', 'button', 'input', 'memo', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'picture', 'tree'
]);

function runtimeControlFingerprint(control) {
  return JSON.stringify(control ?? null);
}

function runtimeSpecializedControlsFingerprint(model) {
  return JSON.stringify((model?.controls ?? []).filter(control => !RUNTIME_CORE_CONTROL_TYPES.has(control?.type)));
}

function runtimeWindowTitleFingerprint(model) {
  return JSON.stringify([model?.title ?? '', model?.icon ?? null]);
}

function syncRuntimeWindowTitle(title, model) {
  const fingerprint = runtimeWindowTitleFingerprint(model);
  if (title.__patchWindowTitleFingerprint === fingerprint) return;
  title.replaceChildren();
  if (model.icon) {
    const img = document.createElement('img');
    img.className = 'patch-window-icon';
    img.alt = '';
    img.width = 16;
    img.height = 16;
    try {
      img.src = pictureResourceDataUri(model.icon, getStudioProjectResources());
    } catch {
      img.src = model.icon;
    }
    title.appendChild(img);
  }
  title.append(model.title);
  title.__patchWindowTitleFingerprint = fingerprint;
}

function runtimeCoreControlContext(container, windows, tabSelections, model, windowIndex, controlIndex, dispatch) {
  return {
    interactive: true,
    container,
    windows,
    tabSelections,
    materialization: null,
    windowIndex,
    controlIndex,
    controlPath: String(controlIndex),
    windowId: model.id,
    topLevel: true,
    dispatch
  };
}

function reconcileRuntimeCoreControls(container, shell, windows, model, windowIndex, tabSelections, dispatch) {
  const body = shell.querySelector(':scope > .patch-window-body');
  if (!body) return null;
  const expected = [];
  (model.controls ?? []).forEach((control, controlIndex) => {
    if (!RUNTIME_CORE_CONTROL_TYPES.has(control?.type)) return;
    const context = runtimeCoreControlContext(container, windows, tabSelections, model, windowIndex, controlIndex, dispatch);
    expected.push({ control, context, key: runtimeControlKey(control, context) });
  });
  const rendered = [...body.children].filter(child => child.dataset.patchControlKey);
  if (rendered.length !== expected.length) return null;
  for (let index = 0; index < expected.length; index += 1) {
    if (rendered[index].dataset.patchControlKey !== expected[index].key) return null;
  }

  let reusedControls = 0;
  const replacements = [];
  for (let index = 0; index < expected.length; index += 1) {
    const existingElement = rendered[index];
    const { control, context } = expected[index];
    const fingerprint = runtimeControlFingerprint(control);
    if (existingElement.__patchControlFingerprint === fingerprint) {
      reusedControls += 1;
      continue;
    }
    const nextElement = createControlElement(control, context);
    if (!nextElement) return null;
    replacements.push({ existingElement, nextElement });
  }
  for (const { existingElement, nextElement } of replacements) existingElement.replaceWith(nextElement);
  return { reusedControls, replacedControls: replacements.length };
}

function reconcileRuntimeWindowShell(container, shell, windows, model, windowIndex, tabSelections, dispatch) {
  if (model.visible === false || shell.dataset.patchRenderDetail !== 'full') return null;
  const title = shell.querySelector(':scope > .patch-window-title');
  if (!title) return null;
  const specializedFingerprint = runtimeSpecializedControlsFingerprint(model);
  if (shell.__patchRuntimeSpecializedFingerprint !== specializedFingerprint) return null;
  const stats = reconcileRuntimeCoreControls(container, shell, windows, model, windowIndex, tabSelections, dispatch);
  if (!stats) return null;
  syncRuntimeWindowTitle(title, model);
  shell.hidden = false;
  shell.dataset.patchWindowId = model.id ?? `window${windowIndex + 1}`;
  shell.dataset.patchWindowKey = runtimeWindowKey(model, windowIndex);
  shell.dataset.patchRenderDetail = 'full';
  shell.__patchWindowFingerprint = runtimeWindowFingerprint(model);
  shell.__patchRuntimeSpecializedFingerprint = specializedFingerprint;
  return stats;
}

function createWindowShell(container, windows, model, windowIndex, interactive, materialization, tabSelections, dispatch) {
  const shell = document.createElement('section');
  shell.className = 'patch-window';
  const deferHiddenForm = Boolean(interactive && model.visible === false);
  const deferDesignerForm = Boolean(!interactive && materialization?.modes?.[windowIndex] === 'shell');
  const deferForm = deferHiddenForm || deferDesignerForm;
  const windowKey = runtimeWindowKey(model, windowIndex);
  shell.hidden = deferForm;
  shell.dataset.patchWindowId = model.id ?? `window${windowIndex + 1}`;
  shell.dataset.patchWindowKey = windowKey;
  shell.dataset.patchRenderDetail = deferForm ? 'deferred' : 'full';
  shell.__patchWindowFingerprint = runtimeWindowFingerprint(model);
  shell.__patchRuntimeSpecializedFingerprint = runtimeSpecializedControlsFingerprint(model);
  if (!interactive) shell.dataset.patchDesignerMaterialization = deferDesignerForm ? 'shell' : 'full';
  const title = document.createElement('div');
  title.className = 'patch-window-title';
  syncRuntimeWindowTitle(title, model);
  const body = document.createElement('div');
  body.className = 'patch-window-body';
  if (!deferForm) {
    model.controls.forEach((control, controlIndex) => {
      const el = createControlElement(control, {
        interactive,
        container,
        windows,
        tabSelections,
        materialization,
        windowIndex,
        controlIndex,
        controlPath: String(controlIndex),
        windowId: model.id,
        topLevel: true,
        dispatch
      });
      if (!el) return;
      if (!interactive && control.type !== 'tree') decorateDesignerControl(el, windowIndex, controlIndex, control);
      body.appendChild(el);
    });
  }
  shell.append(title, body);
  return shell;
}

function renderWindows(container, windows, interactive, options = {}, dispatch) {
  const tabSelections = container.__patchTabSelections ??= new Map();
  const materialization = interactive ? null : options.materialization ?? null;
  container.innerHTML = '';
  if (interactive) container.dataset.patchRuntimeReconcile = 'full';
  if (materialization) container.dataset.patchDesignerMaterializedForm = String(materialization.activeIndex);
  if (!windows?.length) {
    container.innerHTML = '<p class="empty-preview">No Patch window is defined.</p>';
    return;
  }
  windows.forEach((model, windowIndex) => {
    container.appendChild(createWindowShell(container, windows, model, windowIndex, interactive, materialization, tabSelections, dispatch));
  });
}

function runtimeFocusableElements(root) {
  const selector = 'input, select, textarea, button, [tabindex]';
  const items = [];
  if (root.matches?.(selector)) items.push(root);
  for (const item of root.querySelectorAll?.(selector) ?? []) if (!items.includes(item)) items.push(item);
  return items;
}

function findRuntimeControlByKey(container, key) {
  for (const control of container.querySelectorAll('[data-patch-control-key]')) {
    if (control.dataset.patchControlKey === key) return control;
  }
  return null;
}

function captureRuntimeTransientState(container) {
  const state = {
    containerScrollTop: container.scrollTop,
    containerScrollLeft: container.scrollLeft,
    windows: new Map(),
    controls: new Map(),
    multiSelections: new Map(),
    focus: null
  };
  for (const shell of container.querySelectorAll(':scope > .patch-window')) {
    const key = shell.dataset.patchWindowKey ?? shell.dataset.patchWindowId ?? '';
    const body = shell.querySelector(':scope > .patch-window-body');
    state.windows.set(key, {
      shellTop: shell.scrollTop,
      shellLeft: shell.scrollLeft,
      bodyTop: body?.scrollTop ?? 0,
      bodyLeft: body?.scrollLeft ?? 0
    });
  }
  for (const control of container.querySelectorAll('[data-patch-control-key]')) {
    const key = control.dataset.patchControlKey;
    if (!key) continue;
    if (control.scrollTop || control.scrollLeft) state.controls.set(key, { top: control.scrollTop, left: control.scrollLeft });
    const select = control.matches?.('select[multiple]') ? control : control.querySelector?.('select[multiple]');
    if (select) {
      state.multiSelections.set(key, {
        selected: [...select.selectedOptions].map(option => option.value),
        rendered: select.dataset.patchRenderedSelection ?? ''
      });
    }
  }
  const active = document.activeElement;
  if (active && container.contains(active)) {
    const control = active.closest?.('[data-patch-control-key]');
    if (control && container.contains(control)) {
      const focusables = runtimeFocusableElements(control);
      const focusIndex = focusables.indexOf(active);
      state.focus = {
        key: control.dataset.patchControlKey,
        focusIndex,
        selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
        selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
        selectionDirection: typeof active.selectionDirection === 'string' ? active.selectionDirection : null
      };
    }
  }
  return state;
}

function restoreRuntimeTransientState(container, state) {
  if (!state) return;
  container.scrollTop = state.containerScrollTop;
  container.scrollLeft = state.containerScrollLeft;
  for (const shell of container.querySelectorAll(':scope > .patch-window')) {
    const key = shell.dataset.patchWindowKey ?? shell.dataset.patchWindowId ?? '';
    const saved = state.windows.get(key);
    if (!saved) continue;
    shell.scrollTop = saved.shellTop;
    shell.scrollLeft = saved.shellLeft;
    const body = shell.querySelector(':scope > .patch-window-body');
    if (body) {
      body.scrollTop = saved.bodyTop;
      body.scrollLeft = saved.bodyLeft;
    }
  }
  for (const [key, saved] of state.controls) {
    const control = findRuntimeControlByKey(container, key);
    if (!control) continue;
    control.scrollTop = saved.top;
    control.scrollLeft = saved.left;
  }
  for (const [key, saved] of state.multiSelections) {
    const control = findRuntimeControlByKey(container, key);
    if (!control) continue;
    const select = control.matches?.('select[multiple]') ? control : control.querySelector?.('select[multiple]');
    if (!select || select.dataset.patchRenderedSelection !== saved.rendered) continue;
    const allowed = new Set([...select.options].map(option => option.value));
    const selected = new Set(saved.selected.filter(value => allowed.has(value)));
    for (const option of select.options) option.selected = selected.has(option.value);
  }
  if (!state.focus?.key) return;
  const control = findRuntimeControlByKey(container, state.focus.key);
  if (!control) return;
  const focusables = runtimeFocusableElements(control);
  const target = focusables[state.focus.focusIndex] ?? focusables[0] ?? control;
  target.focus?.({ preventScroll: true });
  if (state.focus.selectionStart !== null && typeof target.setSelectionRange === 'function') {
    const length = String(target.value ?? '').length;
    const start = Math.min(state.focus.selectionStart, length);
    const end = Math.min(state.focus.selectionEnd ?? start, length);
    try { target.setSelectionRange(start, end, state.focus.selectionDirection ?? 'none'); } catch { /* unsupported input type */ }
  }
}

function reconcileRuntimeWindows(container, windows, dispatch) {
  const tabSelections = container.__patchTabSelections ??= new Map();
  if (!windows?.length) {
    container.innerHTML = '<p class="empty-preview">No Patch window is defined.</p>';
    container.dataset.patchRuntimeReconcile = 'keyed-control-v2';
    container.dataset.patchRuntimeReusedForms = '0';
    container.dataset.patchRuntimeReplacedForms = '0';
    container.dataset.patchRuntimeReconciledForms = '0';
    container.dataset.patchRuntimeReusedControls = '0';
    container.dataset.patchRuntimeReplacedControls = '0';
    return;
  }
  const transient = captureRuntimeTransientState(container);
  const existing = new Map();
  for (const shell of container.querySelectorAll(':scope > .patch-window')) {
    const key = shell.dataset.patchWindowKey ?? shell.dataset.patchWindowId ?? '';
    if (key) existing.set(key, shell);
  }
  const desired = [];
  let reusedForms = 0;
  let replacedForms = 0;
  let reconciledForms = 0;
  let reusedControls = 0;
  let replacedControls = 0;
  windows.forEach((model, windowIndex) => {
    const key = runtimeWindowKey(model, windowIndex);
    const fingerprint = runtimeWindowFingerprint(model);
    const detail = model.visible === false ? 'deferred' : 'full';
    let shell = existing.get(key) ?? null;
    if (!shell || shell.dataset.patchRenderDetail !== detail) {
      shell?.remove();
      shell = createWindowShell(container, windows, model, windowIndex, true, null, tabSelections, dispatch);
      replacedForms += 1;
    } else if (shell.__patchWindowFingerprint === fingerprint) {
      reusedForms += 1;
    } else {
      const controlStats = reconcileRuntimeWindowShell(container, shell, windows, model, windowIndex, tabSelections, dispatch);
      if (controlStats) {
        reusedForms += 1;
        reconciledForms += 1;
        reusedControls += controlStats.reusedControls;
        replacedControls += controlStats.replacedControls;
      } else {
        shell.remove();
        shell = createWindowShell(container, windows, model, windowIndex, true, null, tabSelections, dispatch);
        replacedForms += 1;
      }
    }
    existing.delete(key);
    desired.push(shell);
  });
  for (const stale of existing.values()) stale.remove();
  desired.forEach((shell, index) => {
    const current = container.querySelectorAll(':scope > .patch-window')[index] ?? null;
    if (current !== shell) container.insertBefore(shell, current);
  });
  container.dataset.patchRuntimeReconcile = 'keyed-control-v2';
  container.dataset.patchRuntimeReusedForms = String(reusedForms);
  container.dataset.patchRuntimeReplacedForms = String(replacedForms);
  container.dataset.patchRuntimeReconciledForms = String(reconciledForms);
  container.dataset.patchRuntimeReusedControls = String(reusedControls);
  container.dataset.patchRuntimeReplacedControls = String(replacedControls);
  restoreRuntimeTransientState(container, transient);
}

function renderRuntimeWindowsAfterEvent(container, windows, dispatch) {
  const mode = resolveStudioRuntimeRenderMode(globalThis.location?.search ?? '');
  container.dataset.patchRuntimeRenderMode = mode;
  if (mode !== PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL) {
    reconcileRuntimeWindows(container, windows, dispatch);
    container.dataset.patchRuntimeRenderMode = mode;
    return;
  }

  const transient = captureRuntimeTransientState(container);
  renderWindows(container, windows, true, {}, dispatch);
  const models = Array.isArray(windows) ? windows : [];
  const rebuiltControls = models.reduce((count, model) => count + (model?.controls?.length ?? 0), 0);
  container.dataset.patchRuntimeRenderMode = mode;
  container.dataset.patchRuntimeReconcile = 'full-fallback-v1';
  container.dataset.patchRuntimeReusedForms = '0';
  container.dataset.patchRuntimeReplacedForms = String(models.length);
  container.dataset.patchRuntimeReconciledForms = '0';
  container.dataset.patchRuntimeReusedControls = '0';
  container.dataset.patchRuntimeReplacedControls = String(rebuiltControls);
  restoreRuntimeTransientState(container, transient);
}

function createControlElement(control, context) {
  let el;
  if (control.type === 'tabs') {
    el = createTabsElement(control, context);
  } else if (control.type === 'panel') {
    el = context.interactive ? createPanelElement(control, context) : null;
  } else if (control.type === 'text') {
    el = document.createElement('p');
    el.className = 'patch-text';
    el.textContent = control.text;
  } else if (control.type === 'button') {
    el = document.createElement('button');
    el.className = 'patch-button';
    el.type = 'button';
    if (control.imageSource) {
      const img = document.createElement('img');
      img.className = 'patch-button-image';
      img.alt = '';
      img.width = control.imageWidth || 16;
      img.height = control.imageHeight || 16;
      try {
        img.src = pictureResourceDataUri(control.imageSource, getStudioProjectResources());
      } catch {
        img.src = control.imageSource;
      }
      el.appendChild(img);
    }
    el.append(control.text);
    if (context.interactive) el.addEventListener('click', () => context.dispatch(control.id, 'clicked'));
  } else if (control.type === 'input') {
    el = document.createElement('input');
    el.className = 'patch-input';
    el.value = control.value ?? '';
    el.placeholder = control.id ?? '';
    if (context.interactive) el.addEventListener('input', () => context.dispatch(control.id, 'changed', { value: el.value }));
    else el.readOnly = true;
  } else if (control.type === 'memo') {
    el = document.createElement('textarea');
    el.className = 'patch-input patch-memo';
    el.value = control.value ?? '';
    el.placeholder = control.id ?? '';
    el.wrap = 'soft';
    if (context.interactive) el.addEventListener('input', () => context.dispatch(control.id, 'changed', { value: el.value }));
    else el.readOnly = true;
  } else if (control.type === 'checkbox') {
    el = document.createElement('label');
    el.className = 'patch-checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = control.value === true;
    const text = document.createElement('span');
    text.textContent = control.text;
    el.append(input, text);
    if (context.interactive) input.addEventListener('change', () => context.dispatch(control.id, 'changed', { value: input.checked }));
    else input.disabled = true;
  } else if (control.type === 'radio') {
    el = document.createElement('div');
    el.className = 'patch-radio';
    const groupName = `patch-radio-${context.windowId ?? context.windowIndex}-${control.id ?? context.controlIndex}`;
    for (const option of control.options ?? []) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = groupName;
      input.value = option;
      input.checked = String(control.value ?? '') === String(option);
      const text = document.createElement('span');
      text.textContent = option;
      label.append(input, text);
      el.appendChild(label);
      if (context.interactive) {
        input.addEventListener('change', () => {
          if (input.checked) context.dispatch(control.id, 'changed', { value: input.value });
        });
      } else input.disabled = true;
    }
  } else if (control.type === 'combo' || control.type === 'listbox') {
    el = document.createElement('select');
    el.className = control.type === 'listbox' ? 'patch-input patch-listbox' : 'patch-input patch-combo';
    const multi = control.type === 'listbox' && Array.isArray(control.value);
    if (control.type === 'listbox') {
      el.size = Math.min(8, Math.max(2, (control.options ?? []).length));
      if (multi) {
        el.multiple = true;
        el.setAttribute('aria-multiselectable', 'true');
      }
    }
    for (const option of control.options ?? []) {
      const item = document.createElement('option');
      item.value = option;
      item.textContent = option;
      if (multi) item.selected = control.value.includes(option);
      el.appendChild(item);
    }
    if (!multi) el.value = String(control.value ?? '');
    if (multi) el.dataset.patchRenderedSelection = JSON.stringify([...el.selectedOptions].map(item => item.value));
    if (context.interactive) {
      el.addEventListener('change', () => {
        const value = multi ? [...el.selectedOptions].map(item => item.value) : el.value;
        context.dispatch(control.id, 'changed', { value });
      });
    } else el.disabled = true;
  } else if (control.type === 'slider') {
    el = document.createElement('label');
    el.className = 'patch-slider';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(control.min ?? 0);
    input.max = String(control.max ?? 100);
    input.step = String(control.step ?? 1);
    input.value = String(Number.isFinite(Number(control.value)) ? control.value : (control.min ?? 0));
    input.setAttribute('aria-label', control.id ? `${control.id} slider` : 'Slider');
    const value = document.createElement('output');
    value.textContent = input.value;
    value.htmlFor = input.id || '';
    input.addEventListener('input', () => { value.textContent = input.value; });
    if (context.interactive) input.addEventListener('change', () => context.dispatch(control.id, 'changed', { value: Number(input.value) }));
    else input.disabled = true;
    el.append(input, value);
  } else if (control.type === 'picture') {
    el = document.createElement('img');
    el.className = 'patch-picture';
    el.alt = control.text || control.description || control.id || '';
    if (control.description || control.text) el.setAttribute('aria-label', control.description || control.text);
    el.style.objectFit = control.fit || 'contain';
    el.style.objectPosition = control.center === false ? '0% 0%' : '50% 50%';
    el.style.opacity = String(Number.isFinite(Number(control.opacity)) ? control.opacity : 1);
    el.style.maxWidth = '100%';
    el.style.maxHeight = '100%';
    if (control.source) el.src = pictureResourceDataUri(control.source, getStudioProjectResources());
    if (context.interactive && control.id) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      const activate = () => context.dispatch(control.id, 'clicked');
      el.addEventListener('click', activate);
      el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
    }
  } else if (control.type === 'tree') {
    el = createTreeElement(control, context);
  }
  if (el) {
    el.dataset.patchControlKey = runtimeControlKey(control, context);
    el.__patchControlFingerprint = runtimeControlFingerprint(control);
  }
  return el ?? null;
}

function applyPanelChildLayout(element, layout) {
  if (!element || !layout) return;
  Object.assign(element.style, {
    position: 'absolute',
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    ...(layout.width !== null ? { width: `${layout.width}px` } : {}),
    ...(layout.height !== null ? { height: `${layout.height}px` } : {}),
    margin: '0',
    maxWidth: 'none',
    boxSizing: 'border-box'
  });
  element.dataset.patchPanelChildLayout = 'relative';
}

function createPanelElement(control, context) {
  const panel = document.createElement('section');
  panel.className = 'patch-panel patch-panel-runtime';
  panel.dataset.patchPanelRuntime = 'true';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', control.id ? `Panel ${control.id}` : 'Panel');

  const title = document.createElement('div');
  title.className = 'patch-panel-title';
  title.textContent = control.id || 'Panel';
  const surface = document.createElement('div');
  surface.className = 'patch-panel-surface';
  const flow = document.createElement('div');
  flow.className = 'patch-panel-flow';
  const positioned = document.createElement('div');
  positioned.className = 'patch-panel-positioned';

  const basePath = String(context.controlPath ?? context.controlIndex ?? 'panel');
  (control.controls ?? []).forEach((nested, nestedIndex) => {
    const nestedElement = createControlElement(nested, {
      ...context,
      controlIndex: nestedIndex,
      controlPath: `${basePath}.panel${nestedIndex}`,
      topLevel: false
    });
    if (!nestedElement) return;
    if (nested.panelLayout) {
      applyPanelChildLayout(nestedElement, nested.panelLayout);
      positioned.appendChild(nestedElement);
    } else {
      nestedElement.dataset.patchPanelChildLayout = 'flow';
      flow.appendChild(nestedElement);
    }
  });
  surface.append(flow, positioned);
  panel.append(title, surface);
  return panel;
}

function createTreeElement(control, context) {
  const root = document.createElement('ul');
  root.className = 'patch-tree';
  root.setAttribute('role', 'tree');
  root.dataset.patchRuntimeSelectionKind = 'tree';
  const key = runtimeControlKey(control, context);
  const rememberedPath = getRuntimeSelection(context.container, 'tree', key);
  const samePath = path => Array.isArray(rememberedPath)
    && path.length === rememberedPath.length
    && path.every((part, index) => part === rememberedPath[index]);
  const selectPath = selectedPath => {
    setRuntimeSelection(context.container, 'tree', key, selectedPath);
    const encoded = JSON.stringify(selectedPath);
    for (const current of root.querySelectorAll('.patch-tree-node')) {
      const selected = current.dataset.patchTreePath === encoded;
      current.setAttribute('aria-selected', selected ? 'true' : 'false');
      current.closest('[role="treeitem"]')?.setAttribute('aria-selected', selected ? 'true' : 'false');
    }
  };
  const renderNodes = (nodes, path = []) => {
    const fragment = document.createDocumentFragment();
    for (const node of nodes ?? []) {
      const item = document.createElement('li');
      item.setAttribute('role', 'treeitem');
      const selectedPath = [...path, node.text];
      const selected = samePath(selectedPath);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'patch-tree-node';
      button.textContent = node.text;
      button.dataset.patchTreePath = JSON.stringify(selectedPath);
      button.setAttribute('aria-label', selectedPath.join(' / '));
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (context.interactive) button.addEventListener('click', () => {
        selectPath(selectedPath);
        context.dispatch(control.id, 'changed', { value: selectedPath });
      });
      else button.disabled = true;
      item.appendChild(button);
      if (node.children?.length) {
        const group = document.createElement('ul');
        group.setAttribute('role', 'group');
        group.appendChild(renderNodes(node.children, selectedPath));
        item.appendChild(group);
      }
      fragment.appendChild(item);
    }
    return fragment;
  };
  root.appendChild(renderNodes(control.nodes));
  return root;
}

function renderTabsPanel(panel, page, context, pageIndex) {
  panel.replaceChildren();
  (page?.controls ?? []).forEach((nested, nestedIndex) => {
    const basePath = String(context.controlPath ?? context.controlIndex ?? 'tabs');
    const nestedEl = createControlElement(nested, {
      ...context,
      controlIndex: nestedIndex,
      controlPath: `${basePath}.tab${pageIndex}.${nestedIndex}`,
      topLevel: false
    });
    if (nestedEl) panel.appendChild(nestedEl);
  });
}

function createTabsElement(control, context) {
  const root = document.createElement('div');
  root.className = 'patch-tabs';
  root.dataset.tabsId = control.id ?? '';
  const pages = control.pages ?? [];
  const key = `${context.windowId}:${control.id ?? context.controlIndex}`;
  let selected = context.tabSelections.get(key) ?? 0;
  if (!Number.isInteger(selected) || selected < 0 || selected >= pages.length) selected = 0;
  context.tabSelections.set(key, selected);

  const list = document.createElement('div');
  list.className = 'patch-tabs-list';
  list.setAttribute('role', 'tablist');
  const panel = document.createElement('div');
  panel.className = 'patch-tab-panel';
  panel.setAttribute('role', 'tabpanel');
  pages.forEach((page, pageIndex) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'patch-tab-button';
    button.textContent = page.title;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', pageIndex === selected ? 'true' : 'false');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      context.tabSelections.set(key, pageIndex);
      for (const [index, tab] of [...list.querySelectorAll('.patch-tab-button')].entries()) {
        tab.setAttribute('aria-selected', index === pageIndex ? 'true' : 'false');
      }
      renderTabsPanel(panel, pages[pageIndex], context, pageIndex);
      button.focus({ preventScroll: true });
    });
    list.appendChild(button);
  });

  renderTabsPanel(panel, pages[selected], context, selected);
  root.append(list, panel);
  return root;
}

function decorateDesignerControl(el, windowIndex, controlIndex, control) {
  el.classList.add('designer-control');
  el.dataset.windowIndex = String(windowIndex);
  el.dataset.controlIndex = String(controlIndex);
  if (!['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) el.tabIndex = 0;
  el.setAttribute('aria-label', `Select ${control.type} control ${control.id ?? controlIndex + 1}`);
}

export function createStudioWindowRenderer({ dispatch } = {}) {
  if (typeof dispatch !== 'function') throw new TypeError('Studio Window renderer requires a dispatch callback.');

  return Object.freeze({
    version: PATCH_STUDIO_WINDOW_RENDERER_VERSION,
    renderInitial(container, windows) {
      renderWindows(container, windows, true, {}, dispatch);
      container.dataset.patchRuntimeRenderMode = resolveStudioRuntimeRenderMode(globalThis.location?.search ?? '');
    },
    renderAfterEvent(container, windows) {
      renderRuntimeWindowsAfterEvent(container, windows, dispatch);
    },
    renderDesigner(container, windows, options = {}) {
      renderWindows(container, windows, false, options, dispatch);
    }
  });
}
