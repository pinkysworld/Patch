import {
  addDesignerControl,
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl,
  updateDesignerWindow
} from '../src/designer.js';
import { listPatchComponents } from '../src/component-registry.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';
import './designer-imagelist.js';

const doc = typeof document === 'undefined' ? null : document;
const designer = doc?.querySelector('#designer') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;

export const DESIGNER_TOOL_CATALOG = Object.freeze(listPatchComponents().map(component => Object.freeze({
  group: component.category,
  type: component.type,
  buttonId: component.buttonId,
  label: component.label
})));

if (doc) queueMicrotask(install);

export function groupedDesignerTools(catalog = DESIGNER_TOOL_CATALOG) {
  const groups = new Map();
  for (const tool of catalog) {
    if (!groups.has(tool.group)) groups.set(tool.group, []);
    groups.get(tool.group).push(tool);
  }
  return [...groups].map(([group, tools]) => ({ group, tools: [...tools] }));
}

export function filterDesignerTools(query, catalog = DESIGNER_TOOL_CATALOG) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return [...catalog];
  return catalog.filter(tool => [tool.label, tool.type, tool.group]
    .some(value => String(value).toLocaleLowerCase().includes(needle)));
}

export function stripDesignerTimerLayout(source, line) {
  const normalized = String(source).replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const index = Number(line) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) return normalized;
  lines[index] = lines[index].replace(/\s+at\s+\d+\s*,\s*\d+\s+size\s+\d+\s*,\s*\d+\s*$/, '');
  const next = lines.join('\n');
  return /\n$/.test(normalized) ? next.replace(/\n?$/, '\n') : next;
}

export function addDesignerTimer(source, options = {}) {
  const windowIndex = Number.isInteger(options.windowIndex) ? options.windowIndex : 0;
  const beforeWindow = listDesignerWindows(source).find(item => item.windowIndex === windowIndex) ?? null;
  let next = addDesignerControl(source, 'timer', { windowIndex });
  let timer = listDesignerControls(next)
    .filter(control => control.windowIndex === windowIndex && control.type === 'timer')
    .at(-1) ?? null;
  if (!timer) throw new Error('Designer created a Timer but could not locate it in Patch source.');

  next = stripDesignerTimerLayout(next, timer.line);
  timer = listDesignerControls(next).find(control =>
    control.windowIndex === windowIndex && control.controlIndex === timer.controlIndex
  ) ?? timer;

  // addDesignerControl uses the visual placement path. A nonvisual Timer must not
  // enlarge an explicitly sized Form merely because its temporary insertion
  // geometry happened to fall below the current visual controls.
  if (beforeWindow?.width && beforeWindow?.height) {
    const afterWindow = listDesignerWindows(next).find(item => item.windowIndex === windowIndex);
    if (afterWindow && (afterWindow.width !== beforeWindow.width || afterWindow.height !== beforeWindow.height)) {
      const changes = {
        titleExpr: beforeWindow.titleExpr,
        width: beforeWindow.width,
        height: beforeWindow.height
      };
      if (beforeWindow.id) changes.id = beforeWindow.id;
      next = updateDesignerWindow(next, windowIndex, changes);
      timer = listDesignerControls(next).find(control =>
        control.windowIndex === windowIndex && control.controlIndex === timer.controlIndex
      ) ?? timer;
    }
  }
  return { source: next, timer };
}

function install() {
  if (!designer || !toolbar || designer.dataset.patchToolboxPicker === 'true') return;
  designer.dataset.patchToolboxPicker = 'true';
  installStylesheet();
  installPictureButton();
  installTimerButton();
  installStatusBarButton();
  installNonvisualTray();
  installTimerInspector();
  installPictureInspector();
  installButtonImageInspector();

  const shell = doc.createElement('div');
  shell.className = 'designer-component-palette';
  shell.setAttribute('aria-label', 'Component palette');

  const searchLabel = doc.createElement('label');
  searchLabel.className = 'designer-component-search';
  searchLabel.innerHTML = '<span>Components</span>';
  const search = doc.createElement('input');
  search.id = 'designerComponentSearch';
  search.type = 'search';
  search.placeholder = 'Search controls…';
  search.autocomplete = 'off';
  search.spellcheck = false;
  search.setAttribute('aria-label', 'Search Designer controls');
  search.title = 'Search the source-backed Component Palette (Ctrl/Cmd+Shift+A)';
  searchLabel.appendChild(search);

  const picker = doc.createElement('label');
  picker.className = 'designer-add-control-picker';
  picker.innerHTML = '<span>Add</span>';
  const select = doc.createElement('select');
  select.id = 'designerAddControl';
  select.setAttribute('aria-label', 'Add control to active Form');
  select.title = 'Add a source-backed control to the active Form';
  picker.appendChild(select);

  const count = doc.createElement('span');
  count.id = 'designerComponentCount';
  count.className = 'designer-component-count';
  count.setAttribute('aria-live', 'polite');

  shell.append(searchLabel, picker, count);

  const context = toolbar.querySelector('.designer-context-group');
  toolbar.insertBefore(shell, context ?? toolbar.firstElementChild?.nextSibling ?? null);

  const render = () => renderToolOptions(select, filterDesignerTools(search.value), count);
  render();

  search.addEventListener('input', render);
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      select.focus();
      return;
    }
    if (event.key !== 'Enter') return;
    const matches = filterDesignerTools(search.value);
    if (matches.length !== 1) return;
    event.preventDefault();
    activateTool(matches[0].buttonId);
    search.select();
  });

  select.addEventListener('change', () => {
    const buttonId = select.value;
    select.value = '';
    if (!buttonId) return;
    activateTool(buttonId);
  });

  doc.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'a') return;
    if (!designer || designer.hidden) return;
    event.preventDefault();
    search.focus();
    search.select();
  });
}

function installPictureButton() {
  if (!toolbar || toolbar.querySelector('#addPicture')) return;
  const button = doc.createElement('button');
  button.id = 'addPicture';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Picture';
  button.setAttribute('aria-label', 'Add Picture');
  button.title = 'Add a source-backed Picture to the active Form';
  toolbar.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    addPictureFromToolbox();
  }, { capture: true });
}

function installTimerButton() {
  if (!toolbar || toolbar.querySelector('#addTimer')) return;
  const button = doc.createElement('button');
  button.id = 'addTimer';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Timer';
  button.setAttribute('aria-label', 'Add Timer');
  button.title = 'Add a nonvisual source-backed Timer to the active Form';
  toolbar.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    addTimerFromToolbox();
  }, { capture: true });
}

function installStatusBarButton() {
  if (!toolbar || toolbar.querySelector('#addStatusbar')) return;
  const button = doc.createElement('button');
  button.id = 'addStatusbar';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ StatusBar';
  button.setAttribute('aria-label', 'Add StatusBar');
  button.title = 'Add a source-backed StatusBar docked to the bottom of the active Form';
  toolbar.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    addStatusBarFromToolbox();
  }, { capture: true });
}

function addPictureFromToolbox() {
  if (!code || !canvas) return;
  try {
    const windowIndex = activeFormIndex();
    const next = addDesignerControl(code.value, 'picture', { windowIndex });
    const picture = listDesignerControls(next)
      .filter(control => control.windowIndex === windowIndex && control.type === 'picture')
      .at(-1) ?? null;
    setSource(next);
    if (picture) {
      rememberDesignerSelection(canvas, designerSelectionForControl(picture, 'core'), { reason: 'add-picture' });
    }
  } catch (error) {
    showToolError(error);
  }
}

function addStatusBarFromToolbox() {
  if (!code || !canvas) return;
  try {
    const windowIndex = activeFormIndex();
    const next = addDesignerControl(code.value, 'statusbar', { windowIndex });
    const statusbar = listDesignerControls(next)
      .find(control => control.windowIndex === windowIndex && control.type === 'statusbar');
    setSource(next);
    if (statusbar) {
      rememberDesignerSelection(canvas, designerSelectionForControl(statusbar, 'core'), { reason: 'add-statusbar' });
    }
  } catch (error) {
    showToolError(error);
  }
}

function addTimerFromToolbox() {
  if (!code || !canvas) return;
  try {
    const windowIndex = activeFormIndex();
    const added = addDesignerTimer(code.value, { windowIndex });
    setSource(added.source);
    rememberDesignerSelection(canvas, designerSelectionForControl(added.timer, 'core'), { reason: 'add-timer' });
    renderNonvisualTray();
    syncTimerInspector();
  } catch (error) {
    showToolError(error);
  }
}

function installNonvisualTray() {
  if (!canvas) return;
  ensureNonvisualTray();
  if (canvas.dataset.patchNonvisualTrayObserver !== 'true') {
    canvas.dataset.patchNonvisualTrayObserver = 'true';
    new MutationObserver(() => {
      if (!canvas.querySelector(':scope > #designerNonvisualTray')) scheduleTimerSync();
    }).observe(canvas, { childList: true });
  }
  code?.addEventListener('input', scheduleTimerSync);
  code?.addEventListener('change', scheduleTimerSync);
  doc.querySelector('#patchFormSelect')?.addEventListener('change', scheduleTimerSync);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleTimerSync);
  renderNonvisualTray();
}

function ensureNonvisualTray() {
  if (!canvas) return null;
  let tray = canvas.querySelector(':scope > #designerNonvisualTray');
  if (tray) return tray;
  tray = doc.createElement('section');
  tray.id = 'designerNonvisualTray';
  tray.className = 'designer-nonvisual-tray';
  tray.setAttribute('aria-label', 'Nonvisual components');
  canvas.appendChild(tray);
  return tray;
}

let timerSyncQueued = false;
function scheduleTimerSync() {
  if (timerSyncQueued) return;
  timerSyncQueued = true;
  queueMicrotask(() => {
    timerSyncQueued = false;
    renderNonvisualTray();
    syncTimerInspector();
  });
}

function renderNonvisualTray() {
  const tray = ensureNonvisualTray();
  if (!tray || !code) return;
  let components = [];
  try {
    const windowIndex = activeFormIndex();
    components = listDesignerControls(code.value)
      .filter(control => control.windowIndex === windowIndex && (control.type === 'timer' || control.type === 'imagelist'));
  } catch {
    tray.innerHTML = '<strong>Nonvisual</strong><span class="designer-nonvisual-empty">Waiting for valid Patch source.</span>';
    return;
  }

  tray.replaceChildren();
  const title = doc.createElement('strong');
  title.textContent = 'Nonvisual';
  title.title = 'Components that participate in the Form but do not occupy canvas geometry';
  tray.appendChild(title);

  if (!components.length) {
    const empty = doc.createElement('span');
    empty.className = 'designer-nonvisual-empty';
    empty.textContent = 'No nonvisual components';
    tray.appendChild(empty);
    return;
  }

  const selection = currentDesignerSelection(canvas);
  for (const component of components) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'designer-nonvisual-component';
    button.dataset.windowIndex = String(component.windowIndex);
    button.dataset.controlIndex = String(component.controlIndex);
    button.dataset.componentType = component.type;
    button.setAttribute('aria-pressed', sameLocation(component, selection) ? 'true' : 'false');
    const isTimer = component.type === 'timer';
    const icon = isTimer ? '◷' : '▤';
    const fallbackName = isTimer ? 'Timer' : 'ImageList';
    const itemCount = component.items?.length ?? 0;
    const detail = isTimer
      ? `${Number(component.interval ?? 1000)} ms`
      : `${component.logicalWidth ?? 16}×${component.logicalHeight ?? 16} · ${itemCount} image${itemCount === 1 ? '' : 's'}`;
    button.innerHTML = `<span class="designer-nonvisual-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(component.id ?? fallbackName)}</span><small>${escapeHtml(detail)}</small>`;
    button.addEventListener('click', () => {
      rememberDesignerSelection(canvas, designerSelectionForControl(component, 'core'), { reason: `nonvisual-${component.type}` });
      syncTimerInspector();
      renderNonvisualTray();
    });
    tray.appendChild(button);
  }
}

function installTimerInspector() {
  const form = doc.querySelector('#designerInspectorForm');
  if (!form) return;
  if (!form.querySelector('#designerInspectorTimerField')) {
    const field = doc.createElement('label');
    field.id = 'designerInspectorTimerField';
    field.className = 'inspector-field';
    field.hidden = true;
    field.innerHTML = 'Interval (ms) <input id="designerInspectorTimerInterval" inputmode="numeric" min="1" max="3600000" step="1" aria-describedby="designerInspectorTimerHint">';
    const hint = doc.createElement('small');
    hint.id = 'designerInspectorTimerHint';
    hint.className = 'inspector-hint';
    hint.textContent = 'Nonvisual Timer. 1 ms to 1 hour. Use Events → OnTick for behavior.';
    field.appendChild(hint);
    const slider = form.querySelector('#designerInspectorSliderFields');
    slider?.insertAdjacentElement('afterend', field);

    const input = field.querySelector('#designerInspectorTimerInterval');
    input?.addEventListener('change', applyTimerInterval);
    input?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applyTimerInterval();
    });
  }
  canvas?.addEventListener(DESIGNER_SELECTION_EVENT, syncTimerInspector);
  code?.addEventListener('input', scheduleTimerSync);
  code?.addEventListener('change', scheduleTimerSync);
  syncTimerInspector();
}

function syncTimerInspector() {
  const field = doc?.querySelector('#designerInspectorTimerField');
  if (!field || !canvas || !code) return;
  const selection = currentDesignerSelection(canvas);
  let control = null;
  try {
    control = selection
      ? listDesignerControls(code.value).find(item => sameLocation(item, selection)) ?? null
      : null;
  } catch {
    control = null;
  }
  const isTimer = control?.type === 'timer';
  field.hidden = !isTimer;
  const geometry = doc.querySelector('[data-form-geometry]');
  if (geometry) geometry.hidden = isTimer || control?.type === 'imagelist';
  if (!isTimer) return;

  const input = field.querySelector('#designerInspectorTimerInterval');
  if (input && doc.activeElement !== input) input.value = String(control.interval ?? 1000);
  const location = doc.querySelector('#designerInspectorLocation');
  if (location && !location.textContent.includes(' ms')) location.textContent += ` · ${control.interval ?? 1000} ms`;
}

function applyTimerInterval() {
  if (!canvas || !code) return;
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  let control = null;
  try {
    control = listDesignerControls(code.value).find(item => sameLocation(item, selection)) ?? null;
  } catch {
    return;
  }
  if (control?.type !== 'timer') return;
  try {
    const interval = doc.querySelector('#designerInspectorTimerInterval')?.value ?? control.interval;
    const next = updateDesignerControl(code.value, selection, { interval });
    setSource(next);
    const updated = listDesignerControls(next).find(item => sameLocation(item, selection)) ?? control;
    rememberDesignerSelection(canvas, designerSelectionForControl(updated, 'core'), { emit: false });
    renderNonvisualTray();
    syncTimerInspector();
  } catch (error) {
    showToolError(error);
  }
}

function installPictureInspector() {
  const form = doc.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorPictureSourceField')) return;
  const field = doc.createElement('label');
  field.id = 'designerInspectorPictureSourceField';
  field.className = 'inspector-field';
  field.hidden = true;
  field.innerHTML = 'Source <input id="designerInspectorPictureSource" spellcheck="false" autocomplete="off" aria-describedby="designerInspectorPictureSourceHint">';
  const hint = doc.createElement('small');
  hint.id = 'designerInspectorPictureSourceHint';
  hint.className = 'inspector-hint';
  hint.textContent = 'Patch expression for the image source, for example "images/logo.png" or a project resource locator.';
  field.appendChild(hint);
  const timer = form.querySelector('#designerInspectorTimerField');
  const slider = form.querySelector('#designerInspectorSliderFields');
  (timer ?? slider)?.insertAdjacentElement('afterend', field);

  const display = doc.createElement('section');
  display.id = 'designerInspectorPictureDisplayFields';
  display.className = 'inspector-field designer-picture-display';
  display.hidden = true;
  display.innerHTML = `
    <label>Fit <select id="designerInspectorPictureFit" aria-label="Picture fit">
      <option value="contain">contain</option>
      <option value="cover">cover</option>
      <option value="fill">fill</option>
      <option value="none">none</option>
    </select></label>
    <label class="designer-picture-check"><input id="designerInspectorPictureProportional" type="checkbox"> Proportional</label>
    <label class="designer-picture-check"><input id="designerInspectorPictureCenter" type="checkbox"> Center</label>
    <label>Opacity <input id="designerInspectorPictureOpacity" type="number" min="0" max="1" step="0.05" inputmode="decimal" aria-label="Picture opacity"></label>
    <label>Description <input id="designerInspectorPictureDescription" spellcheck="true" autocomplete="off" aria-label="Picture accessible description"></label>
    <small class="inspector-hint">Fit, center and opacity are source-backed. Native GUI IR 1.4 keeps the default contain/centered/opaque PictureBox and fail-closes other display values.</small>`;
  field.insertAdjacentElement('afterend', display);

  const input = field.querySelector('#designerInspectorPictureSource');
  input?.addEventListener('change', applyPictureSource);
  input?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyPictureSource();
  });
  display.querySelector('#designerInspectorPictureFit')?.addEventListener('change', applyPictureDisplay);
  display.querySelector('#designerInspectorPictureProportional')?.addEventListener('change', applyPictureDisplay);
  display.querySelector('#designerInspectorPictureCenter')?.addEventListener('change', applyPictureDisplay);
  display.querySelector('#designerInspectorPictureOpacity')?.addEventListener('change', applyPictureDisplay);
  display.querySelector('#designerInspectorPictureDescription')?.addEventListener('change', applyPictureDisplay);
  for (const id of ['designerInspectorPictureOpacity', 'designerInspectorPictureDescription']) {
    display.querySelector(`#${id}`)?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applyPictureDisplay();
    });
  }
  canvas?.addEventListener(DESIGNER_SELECTION_EVENT, syncPictureInspector);
  code?.addEventListener('input', syncPictureInspector);
  code?.addEventListener('change', syncPictureInspector);
  syncPictureInspector();
}

function selectedPictureControl() {
  if (!canvas || !code) return null;
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    return listDesignerControls(code.value).find(item => sameLocation(item, selection)) ?? null;
  } catch {
    return null;
  }
}

function syncPictureInspector() {
  const field = doc?.querySelector('#designerInspectorPictureSourceField');
  const display = doc?.querySelector('#designerInspectorPictureDisplayFields');
  if (!field) return;
  const control = selectedPictureControl();
  const isPicture = control?.type === 'picture';
  field.hidden = !isPicture;
  if (display) display.hidden = !isPicture;
  if (!isPicture) return;
  const input = field.querySelector('#designerInspectorPictureSource');
  if (input && doc.activeElement !== input) input.value = control.sourceExpr ?? '';
  setPictureField('designerInspectorPictureFit', control.fit ?? 'contain');
  setPictureCheckbox('designerInspectorPictureProportional', control.fit !== 'fill');
  setPictureCheckbox('designerInspectorPictureCenter', control.center !== false);
  setPictureField('designerInspectorPictureOpacity', control.opacity ?? 1);
  setPictureField('designerInspectorPictureDescription', control.description ?? '');
}

function setPictureField(id, value) {
  const input = doc?.querySelector(`#${id}`);
  if (!input || doc.activeElement === input) return;
  input.value = value ?? '';
}

function setPictureCheckbox(id, checked) {
  const input = doc?.querySelector(`#${id}`);
  if (!input || doc.activeElement === input) return;
  input.checked = Boolean(checked);
}

function applyPictureSource() {
  applyPictureChanges({ sourceExpr: doc.querySelector('#designerInspectorPictureSource')?.value ?? '' });
}

function applyPictureDisplay(event) {
  const target = event?.currentTarget ?? event?.target;
  const id = target?.id ?? '';
  const changes = {};
  if (id === 'designerInspectorPictureFit') changes.fit = target.value;
  else if (id === 'designerInspectorPictureProportional') changes.proportional = Boolean(target.checked);
  else if (id === 'designerInspectorPictureCenter') changes.center = Boolean(target.checked);
  else if (id === 'designerInspectorPictureOpacity') changes.opacity = target.value;
  else if (id === 'designerInspectorPictureDescription') changes.description = target.value ?? '';
  else {
    changes.fit = doc.querySelector('#designerInspectorPictureFit')?.value ?? 'contain';
    changes.center = Boolean(doc.querySelector('#designerInspectorPictureCenter')?.checked);
    changes.opacity = doc.querySelector('#designerInspectorPictureOpacity')?.value ?? 1;
    changes.description = doc.querySelector('#designerInspectorPictureDescription')?.value ?? '';
  }
  applyPictureChanges(changes);
}

function applyPictureChanges(changes) {
  if (!canvas || !code) return;
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  const control = selectedPictureControl();
  if (control?.type !== 'picture') return;
  try {
    const next = updateDesignerControl(code.value, selection, changes);
    setSource(next);
    const updated = listDesignerControls(next).find(item => sameLocation(item, selection)) ?? control;
    rememberDesignerSelection(canvas, designerSelectionForControl(updated, 'core'), { emit: false });
    syncPictureInspector();
  } catch (error) {
    showToolError(error);
  }
}

function installButtonImageInspector() {
  const form = doc.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorButtonImageField')) return;
  const field = doc.createElement('label');
  field.id = 'designerInspectorButtonImageField';
  field.className = 'inspector-field';
  field.hidden = true;
  field.innerHTML = 'Image <input id="designerInspectorButtonImage" list="designerInspectorButtonImageOptions" spellcheck="false" autocomplete="off" aria-describedby="designerInspectorButtonImageHint">';
  const options = doc.createElement('datalist');
  options.id = 'designerInspectorButtonImageOptions';
  field.appendChild(options);
  const hint = doc.createElement('small');
  hint.id = 'designerInspectorButtonImageHint';
  hint.className = 'inspector-hint';
  hint.textContent = 'ImageList item as list.item, for example app_images.open. Empty clears the binding. Native GUI IR 1.4 fail-closes Button images.';
  field.appendChild(hint);
  const pictureDisplay = form.querySelector('#designerInspectorPictureDisplayFields');
  const picture = form.querySelector('#designerInspectorPictureSourceField');
  (pictureDisplay ?? picture ?? form.lastElementChild)?.insertAdjacentElement('afterend', field);

  const input = field.querySelector('#designerInspectorButtonImage');
  input?.addEventListener('change', applyButtonImage);
  input?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyButtonImage();
  });
  canvas?.addEventListener(DESIGNER_SELECTION_EVENT, syncButtonImageInspector);
  code?.addEventListener('input', syncButtonImageInspector);
  code?.addEventListener('change', syncButtonImageInspector);
  syncButtonImageInspector();
}

function selectedButtonControl() {
  if (!canvas || !code) return null;
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    return listDesignerControls(code.value).find(item => sameLocation(item, selection)) ?? null;
  } catch {
    return null;
  }
}

function syncButtonImageInspector() {
  const field = doc?.querySelector('#designerInspectorButtonImageField');
  if (!field) return;
  const control = selectedButtonControl();
  const isButton = control?.type === 'button';
  field.hidden = !isButton;
  if (!isButton) return;
  const input = field.querySelector('#designerInspectorButtonImage');
  const binding = control.imageListId && control.imageItem ? `${control.imageListId}.${control.imageItem}` : '';
  if (input && doc.activeElement !== input) input.value = binding;
  const datalist = field.querySelector('#designerInspectorButtonImageOptions');
  if (datalist && code) {
    const options = [];
    try {
      for (const item of listDesignerControls(code.value)) {
        if (item.type !== 'imagelist') continue;
        for (const image of item.items ?? []) options.push(`${item.id}.${image.name}`);
      }
    } catch {
      options.length = 0;
    }
    datalist.replaceChildren(...options.map(value => {
      const option = doc.createElement('option');
      option.value = value;
      return option;
    }));
  }
}

function applyButtonImage() {
  if (!canvas || !code) return;
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  const control = selectedButtonControl();
  if (control?.type !== 'button') return;
  try {
    const next = updateDesignerControl(code.value, selection, {
      image: doc.querySelector('#designerInspectorButtonImage')?.value ?? ''
    });
    setSource(next);
    const updated = listDesignerControls(next).find(item => sameLocation(item, selection)) ?? control;
    rememberDesignerSelection(canvas, designerSelectionForControl(updated, 'core'), { emit: false });
    syncButtonImageInspector();
  } catch (error) {
    showToolError(error);
  }
}

function renderToolOptions(select, tools, count) {
  select.replaceChildren();
  const prompt = doc.createElement('option');
  prompt.value = '';
  prompt.textContent = tools.length ? 'Choose…' : 'No matches';
  select.appendChild(prompt);
  for (const { group, tools: grouped } of groupedDesignerTools(tools)) {
    const optgroup = doc.createElement('optgroup');
    optgroup.label = group;
    for (const tool of grouped) {
      const option = doc.createElement('option');
      option.value = tool.buttonId;
      option.textContent = tool.label;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  if (count) count.textContent = `${tools.length}/${DESIGNER_TOOL_CATALOG.length}`;
}

function activateTool(buttonId) {
  const button = doc.getElementById(buttonId);
  if (!button || !toolbar.contains(button) || button.disabled) return false;
  button.click();
  return true;
}

function activeFormIndex() {
  const value = Number(doc?.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function setSource(source) {
  if (!code) return;
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function sameLocation(control, selection) {
  return Boolean(selection && Number(control?.windowIndex) === Number(selection.windowIndex) && Number(control?.controlIndex) === Number(selection.controlIndex));
}

function showToolError(error) {
  const target = doc?.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-designer-toolbox]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-toolbox.css';
  link.dataset.patchDesignerToolbox = '1';
  doc.head.appendChild(link);
}
