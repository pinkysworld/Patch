import {
  applyPatchInputMask,
  formatPatchInputMaskDirective,
  formatPatchInputPresentationDirective,
  normalizePatchInputMask,
  normalizePatchInputPresentation,
  parsePatchInputMaskDirective,
  parsePatchInputPresentationDirective,
  patchInputMaskInputMode,
  patchInputMaskPlaceholder
} from './input-presentation.js';

export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.1';
export const PATCH_WINDOW_INPUT_PRESENTATION_FORMAT = 'patch-window-input-presentation';
export const PATCH_WINDOW_INPUT_MASK_VERSION = '0.1';
export const PATCH_WINDOW_INPUT_MASK_FORMAT = 'patch-window-input-mask';

const INPUT_MODE_PREFIX_RE = /^\s*#\s*@input-mode\b/i;
const INPUT_MASK_PREFIX_RE = /^\s*#\s*@input-mask\b/i;
const DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask)\b/i;
const DESIGNER_SELECTION_EVENT = 'patch-designer-selection-change';
const DEFAULT_MASK = '000-000-0000';

export function buildWindowInputPresentationManifest(source, ast) {
  const rows = sourceRows(source);
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
  return readInputPresentationFromRows(sourceRows(source), sourceLine) ?? 'plain';
}

export function setWindowInputPresentation(source, sourceLine, mode) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const normalized = normalizePatchInputPresentation(mode);
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  assertInputLine(rows, lineIndex, 'Input presentation');

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
  const rows = sourceRows(source);
  const ids = [];
  walkControls(ast, node => {
    if (node.control !== 'input' || !node.id) return;
    if ((readInputPresentationFromRows(rows, node.line) ?? 'plain') === 'password') ids.push(node.id);
  });
  return ids;
}

export function buildWindowInputMaskManifest(source, ast) {
  const rows = sourceRows(source);
  const controls = [];
  walkControls(ast, node => {
    const mask = readInputMaskFromRows(rows, node.line);
    if (mask !== null && node.control !== 'input') {
      throw new Error(`# @input-mask belongs only to Input controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control !== 'input' || mask === null) return;
    const mode = readInputPresentationFromRows(rows, node.line) ?? 'plain';
    if (mode === 'password') {
      throw new Error(`Input '${node.id ?? '?'}' cannot combine PasswordEdit and MaskedEdit presentation metadata.`);
    }
    controls.push({ line: node.line ?? null, id: node.id ?? null, mask });
  });
  return validateWindowInputMaskManifest({
    format: PATCH_WINDOW_INPUT_MASK_FORMAT,
    version: PATCH_WINDOW_INPUT_MASK_VERSION,
    controls
  });
}

export function attachWindowInputMasks(ast, manifest) {
  validateWindowInputMaskManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.mask]));
  let attached = 0;
  walkControls(ast, node => {
    if (node.control !== 'input') return;
    const mask = byLine.get(node.line);
    if (mask === undefined) return;
    Object.defineProperty(node, 'inputMask', {
      value: normalizePatchInputMask(mask),
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) {
    throw new Error('Window input mask manifest does not match the compiled MaskedEdit Inputs.');
  }
  return ast;
}

export function validateWindowInputMaskManifest(manifest) {
  if (
    !manifest ||
    manifest.format !== PATCH_WINDOW_INPUT_MASK_FORMAT ||
    manifest.version !== PATCH_WINDOW_INPUT_MASK_VERSION ||
    !Array.isArray(manifest.controls)
  ) {
    throw new Error('Window input mask manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window input mask control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window input mask source line ${control.line} appears more than once.`);
    lines.add(control.line);
    control.mask = normalizePatchInputMask(control.mask);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\w*$/.test(String(control.id))) {
      throw new Error(`Window input mask control id '${control.id}' is invalid.`);
    }
  }
  return manifest;
}

export function readWindowInputMask(source, sourceLine) {
  return readInputMaskFromRows(sourceRows(source), sourceLine);
}

export function setWindowInputMask(source, sourceLine, mask) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  assertInputLine(rows, lineIndex, 'Input mask');

  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!INPUT_MASK_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(`Input mask is declared more than once before source line ${sourceLine}.`);
    parsePatchInputMaskDirective(rows[index]);
    existingIndex = index;
  }

  const clear = mask === null || mask === undefined || String(mask) === '';
  if (clear) {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }

  const normalized = normalizePatchInputMask(mask);
  if ((readInputPresentationFromRows(rows, sourceLine) ?? 'plain') === 'password') {
    throw new Error('MaskedEdit cannot be enabled while Input mode is Password. Change the Input mode to Text first.');
  }
  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const rendered = `${indent}${formatPatchInputMaskDirective(normalized)}`;
  if (existingIndex >= 0) rows[existingIndex] = rendered;
  else rows.splice(lineIndex, 0, rendered);
  return preserveTrailingNewline(original, rows.join('\n'));
}

export function collectWindowInputMasks(source, ast) {
  const rows = sourceRows(source);
  const controls = [];
  walkControls(ast, node => {
    if (node.control !== 'input' || !node.id) return;
    const mask = readInputMaskFromRows(rows, node.line);
    if (mask !== null) controls.push({ id: node.id, line: node.line ?? null, mask });
  });
  return controls;
}

function readInputPresentationFromRows(rows, sourceLine) {
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 1) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!INPUT_MODE_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`Input presentation is declared more than once before source line ${sourceLine}.`);
    found = parsePatchInputPresentationDirective(rows[index]);
  }
  return found;
}

function readInputMaskFromRows(rows, sourceLine) {
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 1) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!INPUT_MASK_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`Input mask is declared more than once before source line ${sourceLine}.`);
    found = parsePatchInputMaskDirective(rows[index]);
  }
  return found;
}

function sourceRows(source) {
  return String(source ?? '').replace(/\r\n/g, '\n').split('\n');
}

function resolveSourceLineIndex(rows, sourceLine) {
  const lineIndex = Number(sourceLine) - 1;
  return Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < rows.length ? lineIndex : -1;
}

function assertInputLine(rows, lineIndex, label) {
  if (lineIndex < 0) throw new Error('Selected Input line is outside the Patch source.');
  if (!/^\s*input\s+[A-Za-z_]\w*(?:\s+at\b|\s*$)/i.test(rows[lineIndex])) {
    throw new Error(`${label} can only be changed on an Input control.`);
  }
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
    ) walkControls(node.body, visit);
  }
}

if (typeof document !== 'undefined') queueMicrotask(installInputPresentationStudio);

let designerApiPromise = null;
let parserApiPromise = null;
let presentationGeneration = 0;
let studioObserver = null;
let syncQueued = false;

function designerApi() {
  designerApiPromise ??= import('./designer.js');
  return designerApiPromise;
}

function parserApi() {
  parserApiPromise ??= import('./parser.js');
  return parserApiPromise;
}

function installInputPresentationStudio() {
  ensurePasswordEditButton();
  ensureMaskedEditButton();
  ensureInputPresentationInspector();
  ensureInputMaskInspector();
  installInputPresentationObservers();
  scheduleInputPresentationSync();

  if (!studioObserver && document.body && !studioSurfaceReady()) {
    studioObserver = new MutationObserver(() => {
      ensurePasswordEditButton();
      ensureMaskedEditButton();
      ensureInputPresentationInspector();
      ensureInputMaskInspector();
      installInputPresentationObservers();
      if (studioSurfaceReady()) {
        studioObserver?.disconnect();
        studioObserver = null;
      }
    });
    studioObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function studioSurfaceReady() {
  return Boolean(
    document.querySelector('#addPasswordEdit') &&
    document.querySelector('#addMaskedEdit') &&
    document.querySelector('#designerInspectorInputPresentationField') &&
    document.querySelector('#designerInspectorInputMaskField')
  );
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

function ensureMaskedEditButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const anchor = toolbar?.querySelector('#addPasswordEdit') ?? toolbar?.querySelector('#addInput');
  if (!toolbar || !anchor || toolbar.querySelector('#addMaskedEdit')) return Boolean(toolbar?.querySelector('#addMaskedEdit'));
  const button = document.createElement('button');
  button.id = 'addMaskedEdit';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Masked';
  button.setAttribute('aria-label', 'Add MaskedEdit');
  button.title = `Add a source-backed MaskedEdit preset using # @input-mask "${DEFAULT_MASK}".`;
  anchor.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addMaskedEditFromStudio);
  return true;
}

async function addPasswordEditFromStudio(event) {
  event?.preventDefault?.();
  await addInputPreset('password');
}

async function addMaskedEditFromStudio(event) {
  event?.preventDefault?.();
  await addInputPreset('masked');
}

async function addInputPreset(kind) {
  const code = document.querySelector('#code');
  if (!code) return;
  try {
    const { addDesignerControl, listDesignerControls } = await designerApi();
    const activeForm = activeFormIndex();
    let next = addDesignerControl(code.value, 'input', { windowIndex: activeForm });
    let input = listDesignerControls(next)
      .filter(control => control.windowIndex === activeForm && control.type === 'input')
      .at(-1);
    if (!input) throw new Error('Designer created an Input but could not locate the new Input preset in Patch source.');
    if (kind === 'password') next = setWindowInputPresentation(next, input.line, 'password');
    else next = setWindowInputMask(next, input.line, DEFAULT_MASK);
    setStudioSource(code, next);
    input = findDesignerInputById(await designerApi(), next, input.id) ?? input;
    requestAnimationFrame(() => {
      const canvas = document.querySelector('#designerCanvas');
      const element = canvas?.querySelector(`.designer-control[data-control-id="${cssEscape(input.id ?? '')}"]`);
      element?.click?.();
      scheduleInputPresentationSync();
    });
  } catch (error) {
    showInputPresentationError(error);
  }
}

function ensureInputPresentationInspector() {
  const form = document.querySelector('#designerInspectorForm');
  if (!form) return false;
  let field = form.querySelector('#designerInspectorInputPresentationField');
  if (!field) {
    field = document.createElement('label');
    field.id = 'designerInspectorInputPresentationField';
    field.className = 'inspector-field';
    field.hidden = true;
    field.innerHTML = `Input mode
      <select id="designerInspectorInputPresentation" aria-describedby="designerInspectorInputPresentationHint">
        <option value="plain">Text</option>
        <option value="password">Password</option>
        <option value="masked">Masked</option>
      </select>
      <small id="designerInspectorInputPresentationHint" class="inspector-hint">Source-backed presentation. Password and Masked are Studio/Web Stage 1; Current Ready native 1.10 fails closed.</small>`;
    form.appendChild(field);
    field.querySelector('#designerInspectorInputPresentation')?.addEventListener('change', applyInputPresentationInspector);
  } else {
    const select = field.querySelector('#designerInspectorInputPresentation');
    if (select && !select.querySelector('option[value="masked"]')) {
      const option = document.createElement('option');
      option.value = 'masked';
      option.textContent = 'Masked';
      select.appendChild(option);
      select.removeEventListener('change', applyInputPresentationInspector);
      select.addEventListener('change', applyInputPresentationInspector);
    }
  }
  return true;
}

function ensureInputMaskInspector() {
  const form = document.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorInputMaskField')) return Boolean(form?.querySelector('#designerInspectorInputMaskField'));
  const field = document.createElement('label');
  field.id = 'designerInspectorInputMaskField';
  field.className = 'inspector-field';
  field.hidden = true;
  field.innerHTML = `Mask
    <input id="designerInspectorInputMask" spellcheck="false" autocomplete="off" aria-describedby="designerInspectorInputMaskHint">
    <small id="designerInspectorInputMaskHint" class="inspector-hint">0 = digit, A = letter, * = alphanumeric. Other characters are inserted literally; \\ escapes a token.</small>`;
  const presentation = form.querySelector('#designerInspectorInputPresentationField');
  (presentation ?? form.lastElementChild)?.insertAdjacentElement('afterend', field);
  const input = field.querySelector('#designerInspectorInputMask');
  input?.addEventListener('change', applyInputMaskInspector);
  input?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyInputMaskInspector();
  });
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
    const api = await designerApi();
    const control = api.listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
    return control?.type === 'input' ? control : null;
  } catch {
    return null;
  }
}

async function syncInputPresentationInspector() {
  const presentationField = document.querySelector('#designerInspectorInputPresentationField');
  const presentationSelect = presentationField?.querySelector('#designerInspectorInputPresentation');
  const maskField = document.querySelector('#designerInspectorInputMaskField');
  const maskInput = maskField?.querySelector('#designerInspectorInputMask');
  if (!presentationField || !presentationSelect || !maskField || !maskInput) return;
  const code = document.querySelector('#code');
  const control = await selectedTopLevelInput();
  presentationField.hidden = !control;
  maskField.hidden = true;
  if (!control || !code) return;
  try {
    const mask = readWindowInputMask(code.value, control.line);
    const mode = readWindowInputPresentation(code.value, control.line);
    const effective = mask ? 'masked' : mode;
    if (document.activeElement !== presentationSelect) presentationSelect.value = effective;
    maskField.hidden = effective !== 'masked';
    if (effective === 'masked' && document.activeElement !== maskInput) maskInput.value = mask ?? DEFAULT_MASK;
  } catch {
    presentationField.hidden = true;
    maskField.hidden = true;
  }
}

async function applyInputPresentationInspector() {
  const code = document.querySelector('#code');
  const select = document.querySelector('#designerInspectorInputPresentation');
  if (!code || !select) return;
  const control = await selectedTopLevelInput();
  if (!control?.id) return;
  try {
    let next = code.value;
    if (select.value === 'password') {
      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));
      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'password'));
    } else if (select.value === 'masked') {
      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'plain'));
      const currentMask = inputMaskById(next, control.id);
      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, currentMask ?? DEFAULT_MASK));
    } else {
      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));
      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'plain'));
    }
    setStudioSource(code, next);
    scheduleInputPresentationSync();
  } catch (error) {
    showInputPresentationError(error);
  }
}

async function applyInputMaskInspector() {
  const code = document.querySelector('#code');
  const input = document.querySelector('#designerInspectorInputMask');
  if (!code || !input) return;
  const control = await selectedTopLevelInput();
  if (!control?.id) return;
  try {
    let next = code.value;
    next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'plain'));
    next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, input.value));
    setStudioSource(code, next);
    scheduleInputPresentationSync();
  } catch (error) {
    showInputPresentationError(error);
  }
}

function mutateInputById(source, id, mutation) {
  const api = designerApiPromise;
  if (!api) throw new Error('Designer input metadata is not ready.');
  const rows = sourceRows(source);
  const line = findInputLineById(rows, id);
  if (line === null) throw new Error(`Cannot find Input '${id}' in Patch source.`);
  return mutation(line);
}

function inputMaskById(source, id) {
  const line = findInputLineById(sourceRows(source), id);
  return line === null ? null : readWindowInputMask(source, line);
}

function findInputLineById(rows, id) {
  const escaped = escapeRegExp(id);
  const pattern = new RegExp(`^\\s*input\\s+${escaped}(?:\\s+at\\b|\\s*$)`, 'i');
  const index = rows.findIndex(row => pattern.test(row));
  return index < 0 ? null : index + 1;
}

function findDesignerInputById(api, source, id) {
  try { return api.listDesignerControls(source).find(item => item.type === 'input' && item.id === id) ?? null; }
  catch { return null; }
}

function installInputPresentationObservers() {
  const code = document.querySelector('#code');
  const canvas = document.querySelector('#designerCanvas');
  const app = document.querySelector('#app');
  if (code?.dataset.patchInputPresentationObserver !== '1') {
    code.dataset.patchInputPresentationObserver = '1';
    code.addEventListener('input', scheduleInputPresentationSync);
    code.addEventListener('change', scheduleInputPresentationSync);
  }
  if (canvas?.dataset.patchInputPresentationObserver !== '1') {
    canvas.dataset.patchInputPresentationObserver = '1';
    canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleInputPresentationSync);
    new MutationObserver(scheduleInputPresentationSync).observe(canvas, { childList: true, subtree: true });
  }
  if (app?.dataset.patchInputPresentationObserver !== '1') {
    app.dataset.patchInputPresentationObserver = '1';
    new MutationObserver(scheduleInputPresentationSync).observe(app, { childList: true, subtree: true });
  }
  const formSelect = document.querySelector('#patchFormSelect');
  if (formSelect?.dataset.patchInputPresentationObserver !== '1') {
    formSelect.dataset.patchInputPresentationObserver = '1';
    formSelect.addEventListener('change', scheduleInputPresentationSync);
  }
}

function scheduleInputPresentationSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncInputPresentationSurfaces();
    syncInputPresentationInspector();
  });
}

async function syncInputPresentationSurfaces() {
  const code = document.querySelector('#code');
  if (!code) return;
  const generation = ++presentationGeneration;
  let passwordIds;
  let masks;
  try {
    const { parse } = await parserApi();
    const ast = parse(code.value);
    passwordIds = new Set(collectWindowPasswordInputIds(code.value, ast));
    masks = new Map(collectWindowInputMasks(code.value, ast).map(control => [control.id, control.mask]));
  } catch {
    return;
  }
  if (generation !== presentationGeneration) return;

  for (const root of [document.querySelector('#designerCanvas'), document.querySelector('#app')]) {
    for (const input of root?.querySelectorAll?.('input.patch-input') ?? []) {
      const id = String(input.placeholder ?? '');
      const password = passwordIds.has(id);
      const mask = masks.get(id) ?? null;
      input.type = password ? 'password' : 'text';
      input.dataset.patchInputPresentation = password ? 'password' : mask ? 'masked' : 'plain';
      if (mask && !password) applyMaskToStudioInput(input, id, mask);
      else clearMaskFromStudioInput(input);
    }
  }
}

function applyMaskToStudioInput(input, id, mask) {
  input.dataset.patchInputMask = mask;
  input.inputMode = patchInputMaskInputMode(mask);
  input.maxLength = patchInputMaskPlaceholder(mask).length;
  input.setAttribute('aria-label', `${id || 'Input'} masked input, pattern ${patchInputMaskPlaceholder(mask)}`);
  const formatted = applyPatchInputMask(mask, input.value);
  if (input.value !== formatted) input.value = formatted;
  if (input.dataset.patchInputMaskBound !== '1') {
    input.dataset.patchInputMaskBound = '1';
    input.addEventListener('input', () => {
      const currentMask = input.dataset.patchInputMask;
      if (!currentMask) return;
      const next = applyPatchInputMask(currentMask, input.value);
      if (next === input.value) return;
      input.value = next;
      try { input.setSelectionRange(next.length, next.length); } catch { /* input may not support selection */ }
    }, true);
  }
}

function clearMaskFromStudioInput(input) {
  delete input.dataset.patchInputMask;
  input.removeAttribute('maxlength');
  input.inputMode = '';
  if (input.dataset.patchInputPresentation === 'plain') input.removeAttribute('aria-label');
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

function showInputPresentationError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).replace(/[^A-Za-z0-9_-]/g, char => `\\${char}`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
