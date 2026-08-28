import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';
import { normalizeImageListItemName } from '../src/imagelist-control.js';
import { studioResourceSourceExpression } from '../src/studio-resources.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;

if (doc) queueMicrotask(install);

function install() {
  if (!doc || !code || !canvas || !toolbar) return;
  installStylesheet();
  installButton();
  installInspector();
}

function installButton() {
  if (toolbar.querySelector('#addImagelist')) return;
  const button = doc.createElement('button');
  button.id = 'addImagelist';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ ImageList';
  button.setAttribute('aria-label', 'Add ImageList');
  button.title = 'Add a nonvisual source-backed ImageList to the active Form';
  toolbar.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    addImageList();
  }, { capture: true });
}

function addImageList() {
  try {
    const windowIndex = activeFormIndex();
    const next = addDesignerControl(code.value, 'imagelist', { windowIndex });
    const list = listDesignerControls(next)
      .filter(control => control.windowIndex === windowIndex && control.type === 'imagelist')
      .at(-1) ?? null;
    setSource(next);
    if (list) rememberDesignerSelection(canvas, designerSelectionForControl(list, 'core'), { reason: 'add-imagelist' });
  } catch (error) {
    showError(error);
  }
}

function installInspector() {
  const form = doc.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorImageListField')) return;

  const field = doc.createElement('section');
  field.id = 'designerInspectorImageListField';
  field.className = 'inspector-field designer-imagelist-inspector';
  field.hidden = true;
  field.innerHTML = `
    <strong>ImageList</strong>
    <div class="designer-imagelist-size">
      <label>Width <input id="designerImageListWidth" type="number" min="1" max="512" step="1" inputmode="numeric"></label>
      <label>Height <input id="designerImageListHeight" type="number" min="1" max="512" step="1" inputmode="numeric"></label>
    </div>
    <div class="designer-imagelist-actions">
      <button id="designerImageListAdd" class="secondary small" type="button">+ Add image</button>
      <button id="designerImageListManage" class="secondary small" type="button">Resources…</button>
    </div>
    <div id="designerImageListItems" class="designer-imagelist-items" aria-label="ImageList items"></div>
    <small class="inspector-hint">Nonvisual source-backed image collection. Items reference project resources; runtime consumers are a later contract.</small>`;

  const timer = form.querySelector('#designerInspectorTimerField');
  const pictureDisplay = form.querySelector('#designerInspectorPictureDisplayFields');
  const picture = form.querySelector('#designerInspectorPictureSourceField');
  (pictureDisplay ?? picture ?? timer ?? form.lastElementChild)?.insertAdjacentElement('afterend', field);

  for (const id of ['designerImageListWidth', 'designerImageListHeight']) {
    field.querySelector(`#${id}`)?.addEventListener('change', applyLogicalSize);
    field.querySelector(`#${id}`)?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      applyLogicalSize();
    });
  }
  field.querySelector('#designerImageListAdd')?.addEventListener('click', addResourceItem);
  field.querySelector('#designerImageListManage')?.addEventListener('click', openResources);

  canvas.addEventListener(DESIGNER_SELECTION_EVENT, syncInspector);
  code.addEventListener('input', syncInspector);
  code.addEventListener('change', syncInspector);
  window.addEventListener('patch:studio-project-resources-changed', syncInspector);
  syncInspector();
}

function syncInspector() {
  const field = doc?.querySelector('#designerInspectorImageListField');
  if (!field || !code || !canvas) return;
  const selection = currentDesignerSelection(canvas);
  let selected = null;
  try {
    selected = selection
      ? listDesignerControls(code.value).find(item => sameLocation(item, selection)) ?? null
      : null;
  } catch {
    selected = null;
  }
  const control = selected?.type === 'imagelist' ? selected : null;
  const geometry = doc.querySelector('[data-form-geometry]');
  field.hidden = !control;
  if (!control) {
    if (geometry?.dataset.patchImagelistHidden === 'true') {
      geometry.hidden = selected?.type === 'timer';
      delete geometry.dataset.patchImagelistHidden;
    }
    return;
  }

  if (geometry) {
    geometry.hidden = true;
    geometry.dataset.patchImagelistHidden = 'true';
  }
  const width = field.querySelector('#designerImageListWidth');
  const height = field.querySelector('#designerImageListHeight');
  if (width && doc.activeElement !== width) width.value = String(control.logicalWidth ?? 16);
  if (height && doc.activeElement !== height) height.value = String(control.logicalHeight ?? 16);
  renderItems(field.querySelector('#designerImageListItems'), control);
}

function renderItems(root, control) {
  if (!root) return;
  root.replaceChildren();
  const items = control.items ?? [];
  if (!items.length) {
    const empty = doc.createElement('span');
    empty.className = 'designer-imagelist-empty';
    empty.textContent = 'No images yet';
    root.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const row = doc.createElement('div');
    row.className = 'designer-imagelist-item';
    row.dataset.itemIndex = String(index);

    const name = doc.createElement('input');
    name.value = item.name;
    name.setAttribute('aria-label', `Image ${index + 1} name`);
    name.spellcheck = false;
    name.autocomplete = 'off';
    name.addEventListener('change', () => renameItem(index, name.value));
    name.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      renameItem(index, name.value);
    });

    const resource = doc.createElement('code');
    resource.textContent = item.resourceId ?? item.sourceExpr ?? '';
    resource.title = item.sourceExpr ?? '';

    const up = actionButton('↑', 'Move image earlier', () => moveItem(index, -1));
    up.disabled = index === 0;
    const down = actionButton('↓', 'Move image later', () => moveItem(index, 1));
    down.disabled = index === items.length - 1;
    const replace = actionButton('Replace', `Choose another resource for ${item.name}`, () => replaceResourceItem(index));
    const remove = actionButton('Remove', `Remove ${item.name} from ImageList`, () => removeItem(index));
    remove.classList.add('danger');

    row.append(name, resource, up, down, replace, remove);
    root.appendChild(row);
  });
}

function actionButton(text, title, handler) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'secondary small';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', handler);
  return button;
}

function applyLogicalSize() {
  const control = selectedImageList();
  if (!control) return;
  const width = doc.querySelector('#designerImageListWidth')?.value ?? control.logicalWidth;
  const height = doc.querySelector('#designerImageListHeight')?.value ?? control.logicalHeight;
  commit(control, { logicalWidth: width, logicalHeight: height });
}

async function addResourceItem() {
  const control = selectedImageList();
  if (!control) return;
  try {
    const resource = await chooseResource();
    if (!resource) return;
    const items = [...(control.items ?? [])];
    const name = uniqueItemName(resource.id, items);
    items.push({ name, sourceExpr: studioResourceSourceExpression(resource.id) });
    commit(control, { items });
  } catch (error) {
    showError(error);
  }
}

async function replaceResourceItem(index) {
  const control = selectedImageList();
  if (!control) return;
  try {
    const resource = await chooseResource();
    if (!resource) return;
    const items = [...(control.items ?? [])];
    if (!items[index]) return;
    items[index] = { ...items[index], sourceExpr: studioResourceSourceExpression(resource.id) };
    commit(control, { items });
  } catch (error) {
    showError(error);
  }
}

async function chooseResource() {
  const { chooseStudioImageResource } = await import('./resource-manager.js');
  return chooseStudioImageResource();
}

async function openResources() {
  try {
    const { openStudioResourceManager } = await import('./resource-manager.js');
    openStudioResourceManager();
  } catch (error) {
    showError(error);
  }
}

function renameItem(index, value) {
  const control = selectedImageList();
  if (!control) return;
  try {
    const name = normalizeImageListItemName(value);
    const items = [...(control.items ?? [])];
    if (!items[index]) return;
    if (items.some((item, itemIndex) => itemIndex !== index && item.name === name)) {
      throw new Error(`ImageList item '${name}' appears more than once.`);
    }
    items[index] = { ...items[index], name };
    commit(control, { items });
  } catch (error) {
    showError(error);
    syncInspector();
  }
}

function moveItem(index, direction) {
  const control = selectedImageList();
  if (!control) return;
  const items = [...(control.items ?? [])];
  const target = index + direction;
  if (!items[index] || target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  commit(control, { items });
}

function removeItem(index) {
  const control = selectedImageList();
  if (!control) return;
  const items = [...(control.items ?? [])];
  if (!items[index]) return;
  items.splice(index, 1);
  commit(control, { items });
}

function commit(control, changes) {
  try {
    const selection = currentDesignerSelection(canvas);
    if (!selection) return;
    const next = updateDesignerControl(code.value, selection, changes);
    setSource(next);
    const updated = listDesignerControls(next).find(item => sameLocation(item, selection)) ?? control;
    rememberDesignerSelection(canvas, designerSelectionForControl(updated, 'core'), { emit: false });
    syncInspector();
  } catch (error) {
    showError(error);
  }
}

function selectedImageList() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    const control = listDesignerControls(code.value).find(item => sameLocation(item, selection)) ?? null;
    return control?.type === 'imagelist' ? control : null;
  } catch {
    return null;
  }
}

function uniqueItemName(resourceId, items) {
  const tail = String(resourceId ?? 'image').split(/[.\-]/).filter(Boolean).at(-1) ?? 'image';
  let base = tail.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([^A-Za-z_])/, '_$1') || 'image';
  try { base = normalizeImageListItemName(base); }
  catch { base = 'image'; }
  const used = new Set(items.map(item => item.name));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function activeFormIndex() {
  const value = Number(doc?.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function sameLocation(control, selection) {
  return Boolean(selection && Number(control?.windowIndex) === Number(selection.windowIndex) && Number(control?.controlIndex) === Number(selection.controlIndex));
}

function showError(error) {
  const target = doc?.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-designer-imagelist]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-imagelist.css';
  link.dataset.patchDesignerImagelist = '1';
  doc.head.appendChild(link);
}
