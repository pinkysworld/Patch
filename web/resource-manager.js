import {
  addStudioProjectResource,
  getStudioProjectFiles,
  getStudioProjectResources,
  removeStudioProjectResource
} from './project-lifecycle.js';
import {
  PATCH_STUDIO_IMAGE_MEDIA_TYPES,
  buildStudioImageResource,
  studioResourceSourceExpression
} from '../src/studio-resources.js';
import {
  addDesignerControl,
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl,
  updateDesignerWindow
} from '../src/designer.js';
import { formControlDefaultSize } from '../src/form-layout.js';
import {
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';

const RESOURCE_DRAG_TYPE = 'application/x-patch-studio-resource';
const FORM_MARGIN = 24;
const DEFAULT_FORM = Object.freeze({ width: 640, height: 420 });
const doc = typeof document === 'undefined' ? null : document;
let chooserResolve = null;
let chooserMode = false;
let installed = false;

if (doc) queueMicrotask(install);

export function openStudioResourceManager() {
  install();
  chooserMode = false;
  render();
  const dialog = managerDialog();
  if (dialog?.open) dialog.close();
  dialog?.show?.();
}

export function chooseStudioImageResource() {
  install();
  if (chooserResolve) return Promise.reject(new Error('A resource chooser is already open.'));
  chooserMode = true;
  render();
  const dialog = managerDialog();
  if (dialog?.open) dialog.close();
  dialog?.showModal?.();
  return new Promise(resolve => { chooserResolve = resolve; });
}

/**
 * Convert a browser drop point into source-backed Form coordinates.
 * Designer Form geometry is expressed in CSS pixels, so no hidden scaling
 * model is introduced here. The placement is clamped to the current Form.
 */
export function resourcePictureDropLayout(point, rect, form, size = formControlDefaultSize('picture')) {
  const width = positiveDimension(form?.width, DEFAULT_FORM.width);
  const height = positiveDimension(form?.height, DEFAULT_FORM.height);
  const pictureWidth = positiveDimension(size?.width, formControlDefaultSize('picture').width);
  const pictureHeight = positiveDimension(size?.height, formControlDefaultSize('picture').height);
  const rawX = Math.round(Number(point?.clientX ?? 0) - Number(rect?.left ?? 0) + Number(point?.scrollLeft ?? 0));
  const rawY = Math.round(Number(point?.clientY ?? 0) - Number(rect?.top ?? 0) + Number(point?.scrollTop ?? 0));
  return Object.freeze({
    x: clamp(rawX, 0, Math.max(0, width - pictureWidth)),
    y: clamp(rawY, 0, Math.max(0, height - pictureHeight)),
    width: pictureWidth,
    height: pictureHeight
  });
}

/**
 * Create a Picture that visibly references an existing project-v4 resource.
 * The ordinary Designer source APIs remain authoritative. For an explicit
 * drop layout, undo any temporary auto-placement growth and grow only as much
 * as the requested final geometry actually requires.
 */
export function placeResourcePictureInSource(source, resourceId, options = {}) {
  const windowIndex = Number.isInteger(options.windowIndex) ? options.windowIndex : 0;
  const sourceExpr = studioResourceSourceExpression(resourceId);
  const beforeWindow = listDesignerWindows(source).find(item => item.windowIndex === windowIndex) ?? null;
  let next = addDesignerControl(source, 'picture', { windowIndex });
  let picture = listDesignerControls(next)
    .filter(control => control.windowIndex === windowIndex && control.type === 'picture')
    .at(-1) ?? null;
  if (!picture) throw new Error('Designer created a Picture but could not locate it in Patch source.');

  const changes = { sourceExpr };
  const layout = options.layout ?? null;
  if (layout) {
    Object.assign(changes, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height
    });
  }
  next = updateDesignerControl(next, picture, changes);
  picture = listDesignerControls(next).find(control =>
    control.windowIndex === windowIndex && control.controlIndex === picture.controlIndex
  ) ?? picture;

  if (layout) {
    const beforeWidth = positiveDimension(beforeWindow?.width, DEFAULT_FORM.width);
    const beforeHeight = positiveDimension(beforeWindow?.height, DEFAULT_FORM.height);
    const desiredWidth = Math.max(beforeWidth, Number(layout.x) + Number(layout.width) + FORM_MARGIN);
    const desiredHeight = Math.max(beforeHeight, Number(layout.y) + Number(layout.height) + FORM_MARGIN);
    const afterWindow = listDesignerWindows(next).find(item => item.windowIndex === windowIndex) ?? null;
    if (afterWindow && (afterWindow.width !== desiredWidth || afterWindow.height !== desiredHeight)) {
      next = updateDesignerWindow(next, windowIndex, { width: desiredWidth, height: desiredHeight });
      picture = listDesignerControls(next).find(control =>
        control.windowIndex === windowIndex && control.controlIndex === picture.controlIndex
      ) ?? picture;
    }
  }

  return Object.freeze({ source: next, picture });
}

function install() {
  if (!doc || installed) return;
  installed = true;
  installStyles();
  installProjectButton();
  installDialog();
  installPictureChooserObserver();
  installDesignerResourceDropTarget();
  window.addEventListener('patch:studio-project-resources-changed', () => {
    updateButton();
    if (managerDialog()?.open) render();
  });
  updateButton();
}

function installProjectButton() {
  const actions = doc.querySelector('.project-actions');
  if (!actions || actions.querySelector('#resourcesProject')) return;
  const button = doc.createElement('button');
  button.id = 'resourcesProject';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = 'Resources';
  button.title = 'Manage project image resources';
  button.addEventListener('click', openStudioResourceManager);
  const recovery = actions.querySelector('#recoverProject');
  actions.insertBefore(button, recovery ?? null);
}

function installDialog() {
  if (doc.querySelector('#studioResourceManager')) return;
  const dialog = doc.createElement('dialog');
  dialog.id = 'studioResourceManager';
  dialog.className = 'studio-resource-manager';
  dialog.setAttribute('aria-labelledby', 'studioResourceManagerTitle');
  dialog.innerHTML = `
    <div class="studio-resource-shell">
      <header>
        <div><h2 id="studioResourceManagerTitle">Project Resources</h2><p id="studioResourceManagerHint">Images are stored inside the Patch project with SHA-256 integrity metadata.</p></div>
        <button id="studioResourceClose" class="secondary small" type="button" aria-label="Close Resources">Close</button>
      </header>
      <div class="studio-resource-actions">
        <button id="studioResourceImport" type="button">+ Add image</button>
        <span id="studioResourceSummary" aria-live="polite"></span>
      </div>
      <input id="studioResourceFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg" hidden>
      <div id="studioResourceList" class="studio-resource-list"></div>
      <p id="studioResourceStatus" class="studio-resource-status" role="status" aria-live="polite"></p>
    </div>`;
  doc.body.appendChild(dialog);

  dialog.querySelector('#studioResourceClose')?.addEventListener('click', () => closeChooser(null));
  dialog.querySelector('#studioResourceImport')?.addEventListener('click', () => dialog.querySelector('#studioResourceFile')?.click());
  dialog.querySelector('#studioResourceFile')?.addEventListener('change', importResourceFile);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeChooser(null);
  });
  dialog.addEventListener('close', () => {
    clearDropHighlight();
    if (chooserResolve) {
      const resolve = chooserResolve;
      chooserResolve = null;
      chooserMode = false;
      resolve(null);
    }
  });
}

function render() {
  const list = doc?.querySelector('#studioResourceList');
  const summary = doc?.querySelector('#studioResourceSummary');
  const title = doc?.querySelector('#studioResourceManagerTitle');
  const hint = doc?.querySelector('#studioResourceManagerHint');
  if (!list || !summary) return;
  let resources = [];
  try { resources = getStudioProjectResources(); }
  catch (error) {
    setStatus(error?.message ?? String(error), true);
    resources = [];
  }
  const bytes = resources.reduce((sum, resource) => sum + resource.size, 0);
  summary.textContent = `${resources.length} image${resources.length === 1 ? '' : 's'} · ${formatBytes(bytes)}`;
  if (title) title.textContent = chooserMode ? 'Choose Picture Resource' : 'Project Resources';
  if (hint) hint.textContent = chooserMode
    ? 'Choose an image stored inside this Patch project.'
    : 'Drag an image onto the active Form, or use Place on Form. The Picture remains ordinary visible Patch source.';
  list.replaceChildren();

  if (!resources.length) {
    const empty = doc.createElement('div');
    empty.className = 'studio-resource-empty';
    empty.innerHTML = '<strong>No project images yet.</strong><span>Add PNG, JPEG, WebP or SVG. The image is stored in the .patchproject bundle.</span>';
    list.appendChild(empty);
    return;
  }

  for (const resource of resources) list.appendChild(resourceRow(resource));
}

function resourceRow(resource) {
  const row = doc.createElement('article');
  row.className = 'studio-resource-row';
  row.dataset.resourceId = resource.id;

  if (!chooserMode) {
    row.draggable = true;
    row.title = `Drag ${resource.id} onto the active Form to create a Picture`;
    row.addEventListener('dragstart', event => {
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(RESOURCE_DRAG_TYPE, resource.id);
      event.dataTransfer.setData('text/plain', studioResourceSourceExpression(resource.id));
      row.classList.add('studio-resource-dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('studio-resource-dragging');
      clearDropHighlight();
    });
  }

  const preview = doc.createElement('img');
  preview.className = 'studio-resource-preview';
  preview.alt = '';
  preview.loading = 'lazy';
  preview.src = `data:${resource.mediaType};base64,${resource.data}`;

  const info = doc.createElement('div');
  info.className = 'studio-resource-info';
  const strong = doc.createElement('strong');
  strong.textContent = resource.id;
  const path = doc.createElement('span');
  path.textContent = resource.path;
  const meta = doc.createElement('small');
  meta.textContent = `${displayMediaType(resource.mediaType)} · ${formatBytes(resource.size)} · SHA-256 ${resource.sha256.slice(0, 12)}…`;
  info.append(strong, path, meta);

  const actions = doc.createElement('div');
  actions.className = 'studio-resource-row-actions';
  if (chooserMode) {
    const use = doc.createElement('button');
    use.type = 'button';
    use.textContent = 'Use';
    use.addEventListener('click', () => closeChooser(resource));
    actions.appendChild(use);
  } else {
    const place = doc.createElement('button');
    place.type = 'button';
    place.className = 'secondary small';
    place.textContent = 'Place on Form';
    place.title = `Create a Picture using ${resource.id} on the active Form`;
    place.addEventListener('click', () => placeResourceOnActiveForm(resource));
    actions.appendChild(place);
  }
  const copy = doc.createElement('button');
  copy.type = 'button';
  copy.className = 'secondary small';
  copy.textContent = 'Copy source';
  copy.title = `Copy ${studioResourceSourceExpression(resource.id)}`;
  copy.addEventListener('click', async () => {
    const expression = studioResourceSourceExpression(resource.id);
    try {
      await navigator.clipboard.writeText(expression);
      setStatus(`Copied ${expression}`);
    } catch {
      setStatus(`Source: ${expression}`);
    }
  });
  actions.appendChild(copy);

  if (!chooserMode) {
    const remove = doc.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary small danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeResource(resource));
    actions.appendChild(remove);
  }

  row.append(preview, info, actions);
  return row;
}

function installDesignerResourceDropTarget() {
  const canvas = doc?.querySelector('#designerCanvas');
  if (!canvas || canvas.dataset.patchResourceDrop === 'true') return;
  canvas.dataset.patchResourceDrop = 'true';
  canvas.addEventListener('dragover', event => {
    if (!hasResourceDrag(event.dataTransfer)) return;
    const body = activeFormBody(canvas);
    if (!body) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    clearDropHighlight();
    body.classList.add('patch-resource-drop-target');
  });
  canvas.addEventListener('dragleave', event => {
    if (!hasResourceDrag(event.dataTransfer)) return;
    const next = event.relatedTarget;
    if (!next || !canvas.contains(next)) clearDropHighlight();
  });
  canvas.addEventListener('drop', event => {
    if (!hasResourceDrag(event.dataTransfer)) return;
    event.preventDefault();
    const resourceId = String(event.dataTransfer?.getData(RESOURCE_DRAG_TYPE) ?? '').trim();
    clearDropHighlight();
    if (!resourceId) return;
    let resource = null;
    try { resource = getStudioProjectResources().find(item => item.id === resourceId) ?? null; }
    catch (error) { setStatus(error?.message ?? String(error), true); return; }
    if (!resource) { setStatus(`Resource ${resourceId} is no longer available.`, true); return; }
    const windowIndex = activeFormIndex();
    const form = currentForm(windowIndex);
    const body = activeFormBody(canvas);
    if (!body || !form) { setStatus('Open a Window Form before placing an image.', true); return; }
    const rect = body.getBoundingClientRect();
    const layout = resourcePictureDropLayout({
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: body.scrollLeft,
      scrollTop: body.scrollTop
    }, rect, form);
    placeResourceOnActiveForm(resource, layout);
  });
}

function hasResourceDrag(dataTransfer) {
  return Boolean(dataTransfer && [...(dataTransfer.types ?? [])].includes(RESOURCE_DRAG_TYPE));
}

function activeFormBody(canvas) {
  const shell = canvas?.querySelectorAll(':scope > .patch-window')?.[activeFormIndex()] ?? null;
  return shell?.querySelector(':scope > .patch-window-body') ?? null;
}

function activeFormIndex() {
  const value = Number(doc?.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function currentForm(windowIndex) {
  const code = doc?.querySelector('#code');
  if (!code) return null;
  try { return listDesignerWindows(code.value).find(item => item.windowIndex === windowIndex) ?? null; }
  catch { return null; }
}

function placeResourceOnActiveForm(resource, layout = null) {
  const code = doc?.querySelector('#code');
  const canvas = doc?.querySelector('#designerCanvas');
  if (!code || !canvas) return;
  const windowIndex = activeFormIndex();
  try {
    const placed = placeResourcePictureInSource(code.value, resource.id, { windowIndex, layout });
    code.value = placed.source;
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    rememberDesignerSelection(canvas, designerSelectionForControl(placed.picture, 'core'), { reason: layout ? 'drop-resource-picture' : 'place-resource-picture' });
    setStatus(`${resource.id} placed as ${placed.picture.id ?? 'Picture'}${layout ? ` at ${layout.x}, ${layout.y}` : ''}.`);
  } catch (error) {
    setStatus(error?.message ?? String(error), true);
  }
}

function clearDropHighlight() {
  for (const body of doc?.querySelectorAll?.('.patch-window-body.patch-resource-drop-target') ?? []) {
    body.classList.remove('patch-resource-drop-target');
  }
}

async function importResourceFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const mediaType = imageMediaType(file);
    const existing = getStudioProjectResources();
    const id = uniqueResourceId(file.name, existing);
    const resource = await buildStudioImageResource({
      id,
      mediaType,
      bytes: await file.arrayBuffer()
    });
    addStudioProjectResource(resource);
    setStatus(`Added ${resource.id} · ${formatBytes(resource.size)}`);
    render();
  } catch (error) {
    setStatus(error?.message ?? String(error), true);
  } finally {
    input.value = '';
  }
}

function removeResource(resource) {
  try {
    const locator = `patch-resource:${resource.id}`;
    const references = getStudioProjectFiles().filter(file => file.content.includes(locator));
    if (references.length) {
      setStatus(`Cannot remove ${resource.id}: referenced by ${references.map(file => file.path).join(', ')}.`, true);
      return;
    }
    removeStudioProjectResource(resource.id);
    setStatus(`Removed ${resource.id}`);
    render();
  } catch (error) {
    setStatus(error?.message ?? String(error), true);
  }
}

function closeChooser(resource) {
  const dialog = managerDialog();
  if (chooserResolve) {
    const resolve = chooserResolve;
    chooserResolve = null;
    chooserMode = false;
    dialog?.close?.();
    resolve(resource);
    return;
  }
  chooserMode = false;
  dialog?.close?.();
}

function installPictureChooserObserver() {
  const attach = () => {
    const field = doc.querySelector('#designerInspectorPictureSourceField');
    if (!field || field.querySelector('#designerPictureChooseResource')) return false;
    const input = field.querySelector('#designerInspectorPictureSource');
    if (!input) return false;
    const actions = doc.createElement('span');
    actions.className = 'designer-picture-resource-actions';
    const choose = doc.createElement('button');
    choose.id = 'designerPictureChooseResource';
    choose.className = 'secondary small';
    choose.type = 'button';
    choose.textContent = 'Choose resource…';
    choose.title = 'Choose an image stored in this Patch project';
    choose.addEventListener('click', chooseResourceForSelectedPicture);
    const manage = doc.createElement('button');
    manage.className = 'secondary small';
    manage.type = 'button';
    manage.textContent = 'Manage';
    manage.addEventListener('click', openStudioResourceManager);
    actions.append(choose, manage);
    input.insertAdjacentElement('afterend', actions);
    const hint = field.querySelector('#designerInspectorPictureSourceHint');
    if (hint) hint.textContent = 'Quoted image source or project resource. Project resources stay in the .patchproject and write a visible patch-resource locator into Patch source.';
    return true;
  };
  if (attach()) return;
  const observer = new MutationObserver(() => {
    if (attach()) observer.disconnect();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
}

async function chooseResourceForSelectedPicture() {
  const code = doc.querySelector('#code');
  const canvas = doc.querySelector('#designerCanvas');
  if (!code || !canvas) return;
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  let control = null;
  try {
    control = listDesignerControls(code.value).find(item => sameLocation(item, selection)) ?? null;
  } catch {
    return;
  }
  if (control?.type !== 'picture') return;
  try {
    const resource = await chooseStudioImageResource();
    if (!resource) return;
    const sourceExpr = studioResourceSourceExpression(resource.id);
    const next = updateDesignerControl(code.value, selection, { sourceExpr });
    code.value = next;
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    const updated = listDesignerControls(next).find(item => sameLocation(item, selection)) ?? control;
    rememberDesignerSelection(canvas, designerSelectionForControl(updated, 'core'), { emit: false });
    setStatus(`Picture now uses ${resource.id}`);
  } catch (error) {
    setStatus(error?.message ?? String(error), true);
  }
}

function sameLocation(control, selection) {
  return control.windowIndex === selection.windowIndex && control.controlIndex === selection.controlIndex;
}

function imageMediaType(file) {
  const declared = String(file.type ?? '').toLowerCase();
  if (PATCH_STUDIO_IMAGE_MEDIA_TYPES.includes(declared)) return declared;
  const name = String(file.name ?? '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.svg')) return 'image/svg+xml';
  throw new Error('Choose a PNG, JPEG, WebP or SVG image.');
}

function uniqueResourceId(filename, resources) {
  const stem = String(filename ?? 'image').replace(/\.[^.]+$/, '');
  const slug = stem.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
  const base = `image.${slug}`;
  const used = new Set(resources.map(resource => resource.id));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function displayMediaType(mediaType) {
  if (mediaType === 'image/jpeg') return 'JPEG';
  if (mediaType === 'image/svg+xml') return 'SVG';
  return mediaType.split('/')[1]?.toUpperCase() ?? mediaType;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function setStatus(message, error = false) {
  const status = doc?.querySelector('#studioResourceStatus');
  if (!status) return;
  status.textContent = String(message ?? '');
  status.classList.toggle('error', Boolean(error));
}

function managerDialog() {
  return doc?.querySelector('#studioResourceManager') ?? null;
}

function updateButton() {
  const button = doc?.querySelector('#resourcesProject');
  if (!button) return;
  let count = 0;
  try { count = getStudioProjectResources().length; } catch { /* project may still be bootstrapping */ }
  button.textContent = count ? `Resources (${count})` : 'Resources';
}

function positiveDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, minimum, maximum) {
  const number = Number.isFinite(value) ? value : minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function installStyles() {
  if (doc.querySelector('style[data-patch-resource-manager]')) return;
  const style = doc.createElement('style');
  style.dataset.patchResourceManager = '1';
  style.textContent = `
    .studio-resource-manager{width:min(780px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 28px));padding:0;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--text);box-shadow:0 28px 80px #0006}
    .studio-resource-manager:not(:modal){position:fixed;inset:72px 18px auto auto;margin:0;z-index:60;width:min(680px,calc(100vw - 36px));max-height:calc(100vh - 92px)}
    .studio-resource-manager::backdrop{background:#0008;backdrop-filter:blur(2px)}
    .studio-resource-shell{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:12px;max-height:inherit;padding:16px}
    .studio-resource-shell>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.studio-resource-shell h2{margin:0;font-size:18px}.studio-resource-shell header p{margin:4px 0 0;color:var(--muted);font-size:12px}
    .studio-resource-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.studio-resource-actions span{color:var(--muted);font-size:11px}
    .studio-resource-list{display:grid;gap:8px;overflow:auto;min-height:120px}.studio-resource-row{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-subtle)}
    .studio-resource-row[draggable="true"]{cursor:grab}.studio-resource-row.studio-resource-dragging{opacity:.58;cursor:grabbing}
    .studio-resource-preview{width:64px;height:52px;object-fit:contain;border-radius:7px;border:1px solid var(--border);background:repeating-conic-gradient(#7772 0 25%,transparent 0 50%) 50%/12px 12px}.studio-resource-info{display:grid;gap:2px;min-width:0}.studio-resource-info strong,.studio-resource-info span,.studio-resource-info small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.studio-resource-info span,.studio-resource-info small{color:var(--muted);font-size:11px}
    .studio-resource-row-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.studio-resource-row-actions .danger{color:var(--danger,#c94c4c)}.studio-resource-empty{display:grid;place-content:center;gap:6px;min-height:160px;text-align:center;color:var(--muted)}.studio-resource-empty strong{color:var(--text)}
    .studio-resource-status{min-height:18px;margin:0;color:var(--muted);font-size:11px}.studio-resource-status.error{color:var(--danger,#d85b5b)}
    .designer-picture-resource-actions{display:flex;gap:5px;margin-top:5px}.designer-picture-resource-actions button{flex:1}
    .patch-window-body.patch-resource-drop-target{outline:2px dashed var(--accent,#6c8cff);outline-offset:-5px;background-image:linear-gradient(#6c8cff12,#6c8cff12)}
    @media(max-width:620px){.studio-resource-manager:not(:modal){inset:64px 8px auto 8px;width:auto}.studio-resource-row{grid-template-columns:52px minmax(0,1fr)}.studio-resource-preview{width:52px;height:46px}.studio-resource-row-actions{grid-column:1/-1;justify-content:flex-start}}
  `;
  doc.head.appendChild(style);
}
