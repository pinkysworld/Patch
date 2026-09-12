export const PATCH_WINDOW_BUTTON_PRESENTATION_VERSION = '0.1';
export const PATCH_WINDOW_BUTTON_PRESENTATION_FORMAT = 'patch-window-button-presentation';

const BUTTON_MODE_PREFIX_RE = /^\s*#\s*@button-mode\b/i;
const METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask|number-edit|listbox-mode|slider-mode|panel-mode|button-mode)\b/i;
const DESIGNER_SELECTION_EVENT = 'patch-designer-selection-change';

export function normalizePatchButtonPresentation(mode) {
  const normalized = String(mode ?? 'plain').trim().toLowerCase() || 'plain';
  if (normalized !== 'plain' && normalized !== 'link') {
    throw new Error(`Button presentation mode '${mode}' is unsupported. Use plain or link.`);
  }
  return normalized;
}

export function parsePatchButtonPresentationDirective(line) {
  const text = String(line ?? '');
  if (!BUTTON_MODE_PREFIX_RE.test(text)) return null;
  const match = text.match(/^\s*#\s*@button-mode\s+(plain|link)\s*$/i);
  if (!match) throw new Error(`Invalid # @button-mode directive: ${text.trim()}. Use exactly '# @button-mode link'.`);
  return normalizePatchButtonPresentation(match[1]);
}

export function formatPatchButtonPresentationDirective(mode) {
  const normalized = normalizePatchButtonPresentation(mode);
  return normalized === 'plain' ? null : `# @button-mode ${normalized}`;
}

export function buildWindowButtonPresentationManifest(source, ast) {
  const rows = sourceRows(source);
  const controls = [];
  walkControls(ast, node => {
    const mode = readButtonPresentationFromRows(rows, node.line);
    if (mode !== null && node.control !== 'button') {
      throw new Error(`# @button-mode belongs only to Button controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control === 'button') controls.push({ line: node.line ?? null, id: node.id ?? null, mode: mode ?? 'plain' });
  });
  return validateWindowButtonPresentationManifest({
    format: PATCH_WINDOW_BUTTON_PRESENTATION_FORMAT,
    version: PATCH_WINDOW_BUTTON_PRESENTATION_VERSION,
    controls
  });
}

export function attachWindowButtonPresentations(ast, manifest) {
  validateWindowButtonPresentationManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.mode]));
  let attached = 0;
  walkControls(ast, node => {
    if (node.control !== 'button') return;
    Object.defineProperty(node, 'buttonPresentation', {
      value: normalizePatchButtonPresentation(byLine.get(node.line) ?? 'plain'),
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) throw new Error('Window button presentation manifest does not match compiled Button controls.');
  return ast;
}

export function validateWindowButtonPresentationManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_WINDOW_BUTTON_PRESENTATION_FORMAT || manifest.version !== PATCH_WINDOW_BUTTON_PRESENTATION_VERSION || !Array.isArray(manifest.controls)) {
    throw new Error('Window button presentation manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window button presentation control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window button presentation source line ${control.line} appears more than once.`);
    lines.add(control.line);
    control.mode = normalizePatchButtonPresentation(control.mode);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\w*$/.test(String(control.id))) throw new Error(`Window button presentation id '${control.id}' is invalid.`);
  }
  return manifest;
}

export function readWindowButtonPresentation(source, sourceLine) {
  return readButtonPresentationFromRows(sourceRows(source), sourceLine) ?? 'plain';
}

export function setWindowButtonPresentation(source, sourceLine, mode) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const normalized = normalizePatchButtonPresentation(mode);
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= rows.length || !/^\s*button\b/i.test(rows[lineIndex])) {
    throw new Error('Button presentation can only be changed on a Button control.');
  }
  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && METADATA_RE.test(rows[index]); index -= 1) {
    if (!BUTTON_MODE_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(`Button presentation is declared more than once before source line ${sourceLine}.`);
    parsePatchButtonPresentationDirective(rows[index]);
    existingIndex = index;
  }
  const directive = formatPatchButtonPresentationDirective(normalized);
  if (!directive) {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }
  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const rendered = `${indent}${directive}`;
  if (existingIndex >= 0) rows[existingIndex] = rendered;
  else rows.splice(lineIndex, 0, rendered);
  return preserveTrailingNewline(original, rows.join('\n'));
}

export function collectWindowLinkLabelIds(source, ast) {
  const rows = sourceRows(source);
  const ids = [];
  walkControls(ast, node => {
    if (node.control !== 'button' || !node.id) return;
    if ((readButtonPresentationFromRows(rows, node.line) ?? 'plain') === 'link') ids.push(node.id);
  });
  return ids;
}

function readButtonPresentationFromRows(rows, sourceLine) {
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 1 || lineIndex >= rows.length) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && METADATA_RE.test(rows[index]); index -= 1) {
    if (!BUTTON_MODE_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`Button presentation is declared more than once before source line ${sourceLine}.`);
    found = parsePatchButtonPresentationDirective(rows[index]);
  }
  return found;
}

function sourceRows(source) { return String(source ?? '').replace(/\r\n/g, '\n').split('\n'); }
function preserveTrailingNewline(original, text) { return text.replace(/\s+$/, '') + (/\n$/.test(String(original)) ? '\n' : ''); }
function walkControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl') visit(node);
    if (node.kind === 'window' || node.kind === 'tabPage' || node.kind === 'tabs' || (node.kind === 'uiControl' && node.control === 'panel')) walkControls(node.body, visit);
  }
}

if (typeof document !== 'undefined') queueMicrotask(installLinkLabelStudio);
let designerApiPromise = null;
let observer = null;
let syncQueued = false;
function designerApi() { designerApiPromise ??= import('./designer.js'); return designerApiPromise; }

function installLinkLabelStudio() {
  ensureLinkLabelButton();
  ensureLinkLabelInspector();
  installObservers();
  scheduleInspectorSync();
  if (!observer && document.body && !studioReady()) {
    observer = new MutationObserver(() => {
      ensureLinkLabelButton();
      ensureLinkLabelInspector();
      installObservers();
      if (studioReady()) { observer.disconnect(); observer = null; }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
function studioReady() { return Boolean(document.querySelector('#addLinkLabel') && document.querySelector('#designerInspectorButtonPresentationField')); }
function ensureLinkLabelButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const anchor = toolbar?.querySelector('#addButton');
  if (!toolbar || !anchor || toolbar.querySelector('#addLinkLabel')) return Boolean(toolbar?.querySelector('#addLinkLabel'));
  const button = document.createElement('button');
  button.id = 'addLinkLabel'; button.className = 'secondary small'; button.type = 'button'; button.textContent = '+ LinkLabel';
  button.setAttribute('aria-label', 'Add LinkLabel');
  button.title = 'Add a source-backed LinkLabel. It remains a Button, uses # @button-mode link and keeps the ordinary clicked event.';
  anchor.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addLinkLabelFromStudio);
  return true;
}
async function addLinkLabelFromStudio(event) {
  event?.preventDefault?.();
  const code = document.querySelector('#code'); if (!code) return;
  try {
    const api = await designerApi();
    const windowIndex = activeFormIndex();
    let next = api.addDesignerControl(code.value, 'button', { windowIndex });
    const control = api.listDesignerControls(next).filter(item => item.windowIndex === windowIndex && item.type === 'button').at(-1);
    if (!control) throw new Error('Designer created a Button but could not locate the LinkLabel preset.');
    next = setWindowButtonPresentation(next, control.line, 'link');
    setStudioSource(code, next);
    requestAnimationFrame(() => document.querySelector('#designerCanvas')?.querySelector(`.designer-control[data-control-id="${cssEscape(control.id ?? '')}"]`)?.click?.());
  } catch (error) { showError(error); }
}
function ensureLinkLabelInspector() {
  const form = document.querySelector('#designerInspectorForm'); if (!form) return false;
  if (form.querySelector('#designerInspectorButtonPresentationField')) return true;
  const field = document.createElement('label');
  field.id = 'designerInspectorButtonPresentationField'; field.className = 'inspector-field'; field.hidden = true;
  field.innerHTML = `Button mode<select id="designerInspectorButtonPresentation"><option value="plain">Button</option><option value="link">LinkLabel</option></select><small class="inspector-hint">Source-backed presentation. LinkLabel keeps the ordinary Button clicked event and has no implicit navigation.</small>`;
  form.appendChild(field);
  field.querySelector('select')?.addEventListener('change', applyInspector);
  return true;
}
async function selectedTopLevelButton() {
  const canvas = document.querySelector('#designerCanvas'); const code = document.querySelector('#code');
  const element = canvas?.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!canvas || !code || !element) return null;
  const windowIndex = Number(element.dataset.windowIndex); const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  try { const control = (await designerApi()).listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex); return control?.type === 'button' ? control : null; } catch { return null; }
}
async function syncInspector() {
  const field = document.querySelector('#designerInspectorButtonPresentationField'); const select = field?.querySelector('select'); const code = document.querySelector('#code');
  if (!field || !select) return; const control = await selectedTopLevelButton(); field.hidden = !control; if (!control || !code) return;
  try { if (document.activeElement !== select) select.value = readWindowButtonPresentation(code.value, control.line); } catch { field.hidden = true; }
}
async function applyInspector() {
  const code = document.querySelector('#code'); const select = document.querySelector('#designerInspectorButtonPresentation'); if (!code || !select) return;
  const control = await selectedTopLevelButton(); if (!control) return;
  try { setStudioSource(code, setWindowButtonPresentation(code.value, control.line, select.value)); } catch (error) { showError(error); }
}
function installObservers() {
  const code = document.querySelector('#code'); const canvas = document.querySelector('#designerCanvas');
  if (code?.dataset.patchButtonPresentationObserver !== '1') { code.dataset.patchButtonPresentationObserver = '1'; code.addEventListener('input', scheduleInspectorSync); code.addEventListener('change', scheduleInspectorSync); }
  if (canvas?.dataset.patchButtonPresentationObserver !== '1') { canvas.dataset.patchButtonPresentationObserver = '1'; canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleInspectorSync); new MutationObserver(scheduleInspectorSync).observe(canvas, { childList: true, subtree: true }); }
}
function scheduleInspectorSync() { if (syncQueued) return; syncQueued = true; queueMicrotask(() => { syncQueued = false; syncInspector(); }); }
function activeFormIndex() { const value = Number(document.querySelector('#patchFormSelect')?.value); return Number.isInteger(value) && value >= 0 ? value : 0; }
function setStudioSource(code, source) { code.value = source; code.dispatchEvent(new Event('input', { bubbles: true })); code.dispatchEvent(new Event('change', { bubbles: true })); }
function showError(error) { const target = document.querySelector('#designerInspectorError'); if (!target) return; target.textContent = error?.message ?? String(error); target.hidden = false; }
function cssEscape(value) { return globalThis.CSS?.escape ? globalThis.CSS.escape(String(value)) : String(value).replace(/[^A-Za-z0-9_-]/g, char => `\\${char}`); }
