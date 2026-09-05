import {
  formatPatchInputPresentationDirective,
  normalizePatchInputPresentation,
  parsePatchInputPresentationDirective
} from './input-presentation.js';

export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.1';
export const PATCH_WINDOW_INPUT_PRESENTATION_FORMAT = 'patch-window-input-presentation';

const INPUT_MODE_PREFIX_RE = /^\s*#\s*@input-mode\b/i;
const DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode)\b/i;
const DESIGNER_SELECTION_EVENT = 'patch-designer-selection-change';

export function buildWindowInputPresentationManifest(source, ast) {
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const controls = [];
  walkControls(ast, node => {
    const mode = readInputPresentationFromRows(rows, node.line);
    if (mode !== null && node.control !== 'input') {
      throw new Error(`# @input-mode belongs only to Input controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control === 'input') controls.push({ line: node.line ?? null, mode: mode ?? 'plain' });
  });
  return validateWindowInputPresentationManifest({
    format: PATCH_WINDOW_INPUT_PRESENTATION_FORMAT,
    version: PATCH_WINDOW_INPUT_PRESENTATION_VERSION,
    controls
  });
}

export function attachWindowInputPresentations(ast, manifest) {
  validateWindowInputPresentationManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.mode]));
  let attached = 0;
  walkControls(ast, node => {
    if (node.control !== 'input') return;
    const mode = normalizePatchInputPresentation(byLine.get(node.line) ?? 'plain');
    Object.defineProperty(node, 'inputPresentation', {
      value: mode,
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) {
    throw new Error('Window input presentation manifest does not match the compiled Input controls.');
  }
  return ast;
}

export function validateWindowInputPresentationManifest(manifest) {
  if (
    !manifest ||
    manifest.format !== PATCH_WINDOW_INPUT_PRESENTATION_FORMAT ||
    manifest.version !== PATCH_WINDOW_INPUT_PRESENTATION_VERSION ||
    !Array.isArray(manifest.controls)
  ) {
    throw new Error('Window input presentation manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window input presentation control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window input presentation source line ${control.line} appears more than once.`);
    lines.add(control.line);
    control.mode = normalizePatchInputPresentation(control.mode);
  }
  return manifest;
}

export function readWindowInputPresentation(source, sourceLine) {
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  return readInputPresentationFromRows(rows, sourceLine) ?? 'plain';
}

export function setWindowInputPresentation(source, sourceLine, mode) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const normalized = normalizePatchInputPresentation(mode);
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected Input line is outside the Patch source.');
  if (!/^\s*input\s+[A-Za-z_]\w*(?:\s+at\b|\s*$)/i.test(rows[lineIndex])) {
    throw new Error('Input presentation can only be changed on an Input control.');
  }

  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!INPUT_MODE_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(`Input presentation is declared more than once before source line ${sourceLine}.`);
    parsePatchInputPresentationDirective(rows[index]);
    existingIndex = index;
  }

  const directive = formatPatchInputPresentationDirective(normalized);
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

export function collectWindowPasswordInputIds(source, ast) {
  const ids = [];
  walkControls(ast, node => {
    if (node.control !== 'input' || !node.id) return;
    if (readWindowInputPresentation(source, node.line) === 'password') ids.push(node.id);
  });
  return ids;
}

function readInputPresentationFromRows(rows, sourceLine) {
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 1 || lineIndex >= rows.length) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!INPUT_MODE_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`Input presentation is declared more than once before source line ${sourceLine}.`);
    found = parsePatchInputPresentationDirective(rows[index]);
  }
  return found;
}

function resolveSourceLineIndex(rows, sourceLine) {
  const lineIndex = Number(sourceLine) - 1;
  return Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < rows.length ? lineIndex : -1;
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /\n$/.test(String(original));
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}

function walkControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl') visit(node);
    if (
      node.kind === 'window' ||
      node.kind === 'tabPage' ||
      node.kind === 'tabs' ||
      (node.kind === 'uiControl' && node.control === 'panel')
    ) {
      walkControls(node.body, visit);
    }
  }
}

if (typeof document !== 'undefined') queueMicrotask(installPasswordEditStudio);

let designerApiPromise = null;
let parserApiPromise = null;
let maskGeneration = 0;
let studioObserver = null;

function designerApi() {
  designerApiPromise ??= import('./designer.js');
  return designerApiPromise;
}

function parserApi() {
  parserApiPromise ??= import('./parser.js');
  return parserApiPromise;
}

function installPasswordEditStudio() {
  ensurePasswordEditButton();
  ensurePasswordEditInspector();
  installPasswordEditObservers();
  schedulePasswordEditSync();

  if (!studioObserver && document.body && (!document.querySelector('#addPasswordEdit') || !document.querySelector('#designerInspectorInputPresentationField'))) {
    studioObserver = new MutationObserver(() => {
      ensurePasswordEditButton();
      ensurePasswordEditInspector();
      if (document.querySelector('#addPasswordEdit') && document.querySelector('#designerInspectorInputPresentationField')) {
        studioObserver?.disconnect();
        studioObserver = null;
      }
    });
    studioObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function ensurePasswordEditButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const inputButton = toolbar?.querySelector('#addInput');
  if (!toolbar || !inputButton || toolbar.querySelector('#addPasswordEdit')) return Boolean(toolbar?.querySelector('#addPasswordEdit'));
  const button = document.createElement('button');
  button.id = 'addPasswordEdit';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Password';
  button.setAttribute('aria-label', 'Add PasswordEdit');
  button.title = 'Add a source-backed PasswordEdit preset. It remains an Input and uses # @input-mode password.';
  inputButton.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addPasswordEditFromStudio);
  return true;
}

async function addPasswordEditFromStudio(event) {
  event?.preventDefault?.();
  const code = document.querySelector('#code');
  if (!code) return;
  try {
    const { addDesignerControl, listDesignerControls } = await designerApi();
    const activeForm = activeFormIndex();
    let next = addDesignerControl(code.value, 'input', { windowIndex: activeForm });
    const input = listDesignerControls(next)
      .filter(control => control.windowIndex === activeForm && control.type === 'input')
      .at(-1);
    if (!input) throw new Error('Designer created an Input but could not locate the PasswordEdit preset in Patch source.');
    next = setWindowInputPresentation(next, input.line, 'password');
    setStudioSource(code, next);
    requestAnimationFrame(() => {
      const canvas = document.querySelector('#designerCanvas');
      const element = canvas?.querySelector(`.designer-control[data-control-id="${cssEscape(input.id ?? '')}"]`);
      element?.click?.();
      schedulePasswordEditSync();
    });
  } catch (error) {
    showPasswordEditError(error);
  }
}

function ensurePasswordEditInspector() {
  const form = document.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorInputPresentationField')) return Boolean(form?.querySelector('#designerInspectorInputPresentationField'));
  const field = document.createElement('label');
  field.id = 'designerInspectorInputPresentationField';
  field.className = 'inspector-field';
  field.hidden = true;
  field.innerHTML = `Input mode
    <select id="designerInspectorInputPresentation" aria-describedby="designerInspectorInputPresentationHint">
      <option value="plain">Text</option>
      <option value="password">Password</option>
    </select>
    <small id="designerInspectorInputPresentationHint" class="inspector-hint">Source-backed presentation only. Password is masked in Studio and Standalone Web; Current Ready native 1.10 fails closed.</small>`;
  form.appendChild(field);
  field.querySelector('#designerInspectorInputPresentation')?.addEventListener('change', applyPasswordEditInspector);
  return true;
}

async function selectedTopLevelInput() {
  const canvas = document.querySelector('#designerCanvas');
  const code = document.querySelector('#code');
  const element = canvas?.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!canvas || !code || !element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  try {
    const { listDesignerControls } = await designerApi();
    const control = listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
    return control?.type === 'input' ? control : null;
  } catch {
    return null;
  }
}

async function syncPasswordEditInspector() {
  const field = document.querySelector('#designerInspectorInputPresentationField');
  const select = field?.querySelector('#designerInspectorInputPresentation');
  if (!field || !select) return;
  const code = document.querySelector('#code');
  const control = await selectedTopLevelInput();
  field.hidden = !control;
  if (!control || !code || document.activeElement === select) return;
  try {
    select.value = readWindowInputPresentation(code.value, control.line);
  } catch {
    field.hidden = true;
  }
}

async function applyPasswordEditInspector() {
  const code = document.querySelector('#code');
  const select = document.querySelector('#designerInspectorInputPresentation');
  if (!code || !select) return;
  const control = await selectedTopLevelInput();
  if (!control) return;
  try {
    const next = setWindowInputPresentation(code.value, control.line, select.value);
    setStudioSource(code, next);
    schedulePasswordEditSync();
  } catch (error) {
    showPasswordEditError(error);
  }
}

function installPasswordEditObservers() {
  const code = document.querySelector('#code');
  const canvas = document.querySelector('#designerCanvas');
  const app = document.querySelector('#app');
  if (code?.dataset.patchPasswordEditObserver !== '1') {
    code.dataset.patchPasswordEditObserver = '1';
    code.addEventListener('input', schedulePasswordEditSync);
    code.addEventListener('change', schedulePasswordEditSync);
  }
  if (canvas?.dataset.patchPasswordEditObserver !== '1') {
    canvas.dataset.patchPasswordEditObserver = '1';
    canvas.addEventListener(DESIGNER_SELECTION_EVENT, schedulePasswordEditSync);
    new MutationObserver(schedulePasswordEditSync).observe(canvas, { childList: true, subtree: true });
  }
  if (app?.dataset.patchPasswordEditObserver !== '1') {
    app.dataset.patchPasswordEditObserver = '1';
    new MutationObserver(schedulePasswordEditSync).observe(app, { childList: true, subtree: true });
  }
  const formSelect = document.querySelector('#patchFormSelect');
  if (formSelect?.dataset.patchPasswordEditObserver !== '1') {
    formSelect.dataset.patchPasswordEditObserver = '1';
    formSelect.addEventListener('change', schedulePasswordEditSync);
  }
}

let syncQueued = false;
function schedulePasswordEditSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncPasswordEditMasks();
    syncPasswordEditInspector();
  });
}

async function syncPasswordEditMasks() {
  const code = document.querySelector('#code');
  if (!code) return;
  const generation = ++maskGeneration;
  let ids;
  try {
    const { parse } = await parserApi();
    ids = new Set(collectWindowPasswordInputIds(code.value, parse(code.value)));
  } catch {
    return;
  }
  if (generation !== maskGeneration) return;
  for (const root of [document.querySelector('#designerCanvas'), document.querySelector('#app')]) {
    for (const input of root?.querySelectorAll?.('input.patch-input') ?? []) {
      const password = ids.has(String(input.placeholder ?? ''));
      input.type = password ? 'password' : 'text';
      input.dataset.patchInputPresentation = password ? 'password' : 'plain';
    }
  }
}

function activeFormIndex() {
  const value = Number(document.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function setStudioSource(code, source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function showPasswordEditError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).replace(/[^A-Za-z0-9_-]/g, char => `\\${char}`);
}
