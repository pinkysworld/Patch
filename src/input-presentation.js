export const PATCH_INPUT_PRESENTATION_VERSION = '0.1';
export const PATCH_INPUT_PRESENTATION_DIRECTIVE = 'input-mode';
export const PATCH_INPUT_MASK_VERSION = '0.1';
export const PATCH_INPUT_MASK_DIRECTIVE = 'input-mask';
export const PATCH_INPUT_MASK_MAX_LENGTH = 128;
export const PATCH_LISTBOX_PRESENTATION_VERSION = '0.1';
export const PATCH_LISTBOX_PRESENTATION_DIRECTIVE = 'listbox-mode';
export const PATCH_WINDOW_LISTBOX_PRESENTATION_VERSION = '0.1';
export const PATCH_WINDOW_LISTBOX_PRESENTATION_FORMAT = 'patch-window-listbox-presentation';

const MODES = Object.freeze(['plain', 'password']);
const MODE_SET = new Set(MODES);
const LISTBOX_MODES = Object.freeze(['plain', 'checked']);
const LISTBOX_MODE_SET = new Set(LISTBOX_MODES);
const LISTBOX_MODE_PREFIX_RE = /^\s*#\s*@listbox-mode\b/i;
const LISTBOX_DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask|listbox-mode)\b/i;
const MASK_TOKEN_KINDS = Object.freeze({
  '0': 'digit',
  A: 'letter',
  '*': 'alphanumeric'
});

const PASSWORD_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'unsupported',
  macos: 'unsupported',
  linux: 'unsupported',
  freebsd: 'unsupported'
});

const PLAIN_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'supported',
  macos: 'supported',
  linux: 'supported',
  freebsd: 'unsupported'
});

const MASK_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'unsupported',
  macos: 'unsupported',
  linux: 'unsupported',
  freebsd: 'unsupported'
});

const CHECKED_LISTBOX_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'unsupported',
  macos: 'unsupported',
  linux: 'unsupported',
  freebsd: 'unsupported'
});

export function patchInputPresentationModes() {
  return [...MODES];
}

export function normalizePatchInputPresentation(mode) {
  const normalized = String(mode ?? 'plain').trim().toLowerCase() || 'plain';
  if (!MODE_SET.has(normalized)) {
    throw new Error(`Unsupported input presentation '${mode}'. Use plain or password.`);
  }
  return normalized;
}

export function parsePatchInputPresentationDirective(line) {
  const text = String(line ?? '');
  if (!/^\s*#\s*@input-mode\b/i.test(text)) return null;
  const match = text.match(/^\s*#\s*@input-mode\s+(plain|password)\s*$/i);
  if (!match) throw new Error(`Invalid # @input-mode directive '${text.trim()}'. Use '# @input-mode password'.`);
  return normalizePatchInputPresentation(match[1]);
}

export function formatPatchInputPresentationDirective(mode) {
  const normalized = normalizePatchInputPresentation(mode);
  return normalized === 'plain' ? null : `# @input-mode ${normalized}`;
}

export function patchInputDomType(mode) {
  return normalizePatchInputPresentation(mode) === 'password' ? 'password' : 'text';
}

export function patchInputPresentationTargetSupport(mode) {
  return normalizePatchInputPresentation(mode) === 'password' ? PASSWORD_TARGETS : PLAIN_TARGETS;
}

export function assertPatchInputPresentationTarget(mode, target) {
  const normalizedMode = normalizePatchInputPresentation(mode);
  const normalizedTarget = String(target ?? '').trim().toLowerCase();
  const support = patchInputPresentationTargetSupport(normalizedMode)[normalizedTarget];
  if (support !== 'supported') {
    throw new Error(
      `Input presentation '${normalizedMode}' is not supported on '${normalizedTarget || 'unknown'}'. ` +
      (normalizedMode === 'password'
        ? 'PasswordEdit Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
        : 'Select a supported Patch target.')
    );
  }
  return true;
}

export function patchListboxPresentationModes() {
  return [...LISTBOX_MODES];
}

export function normalizePatchListboxPresentation(mode) {
  const normalized = String(mode ?? 'plain').trim().toLowerCase() || 'plain';
  if (!LISTBOX_MODE_SET.has(normalized)) {
    throw new Error(`Unsupported ListBox presentation '${mode}'. Use plain or checked.`);
  }
  return normalized;
}

export function parsePatchListboxPresentationDirective(line) {
  const text = String(line ?? '');
  if (!LISTBOX_MODE_PREFIX_RE.test(text)) return null;
  const match = text.match(/^\s*#\s*@listbox-mode\s+(plain|checked)\s*$/i);
  if (!match) throw new Error(`Invalid # @listbox-mode directive '${text.trim()}'. Use '# @listbox-mode checked'.`);
  return normalizePatchListboxPresentation(match[1]);
}

export function formatPatchListboxPresentationDirective(mode) {
  const normalized = normalizePatchListboxPresentation(mode);
  return normalized === 'plain' ? null : `# @listbox-mode ${normalized}`;
}

export function patchListboxPresentationTargetSupport(mode) {
  return normalizePatchListboxPresentation(mode) === 'checked' ? CHECKED_LISTBOX_TARGETS : PLAIN_TARGETS;
}

export function assertPatchListboxPresentationTarget(mode, target) {
  const normalizedMode = normalizePatchListboxPresentation(mode);
  const normalizedTarget = String(target ?? '').trim().toLowerCase();
  const support = patchListboxPresentationTargetSupport(normalizedMode)[normalizedTarget];
  if (support !== 'supported') {
    throw new Error(
      `ListBox presentation '${normalizedMode}' is not supported on '${normalizedTarget || 'unknown'}'. ` +
      (normalizedMode === 'checked'
        ? 'CheckedListBox Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
        : 'Select a supported Patch target.')
    );
  }
  return true;
}

export function buildWindowListboxPresentationManifest(source, ast) {
  const rows = patchPresentationSourceRows(source);
  const stateTypes = collectPatchStateTypes(ast);
  const controls = [];
  walkPatchPresentationControls(ast, node => {
    const mode = readPatchListboxPresentationFromRows(rows, node.line);
    if (mode !== null && node.control !== 'listbox') {
      throw new Error(`# @listbox-mode belongs only to ListBox controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control !== 'listbox') return;
    const effective = mode ?? 'plain';
    if (effective === 'checked') {
      const stateType = node.id ? stateTypes.get(node.id) : null;
      if (stateType !== 'list') {
        throw new Error(`CheckedListBox '${node.id ?? '?'}' needs a matching 'create list ${node.id ?? 'name'} = [...]' state declaration so changed(value) is a text list.`);
      }
    }
    controls.push({ line: node.line ?? null, id: node.id ?? null, mode: effective });
  });
  return validateWindowListboxPresentationManifest({
    format: PATCH_WINDOW_LISTBOX_PRESENTATION_FORMAT,
    version: PATCH_WINDOW_LISTBOX_PRESENTATION_VERSION,
    controls
  });
}

export function attachWindowListboxPresentations(ast, manifest) {
  validateWindowListboxPresentationManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.mode]));
  let attached = 0;
  walkPatchPresentationControls(ast, node => {
    if (node.control !== 'listbox') return;
    const mode = normalizePatchListboxPresentation(byLine.get(node.line) ?? 'plain');
    Object.defineProperty(node, 'listboxPresentation', {
      value: mode,
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) {
    throw new Error('Window ListBox presentation manifest does not match the compiled ListBox controls.');
  }
  return ast;
}

export function validateWindowListboxPresentationManifest(manifest) {
  if (
    !manifest ||
    manifest.format !== PATCH_WINDOW_LISTBOX_PRESENTATION_FORMAT ||
    manifest.version !== PATCH_WINDOW_LISTBOX_PRESENTATION_VERSION ||
    !Array.isArray(manifest.controls)
  ) {
    throw new Error('Window ListBox presentation manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window ListBox presentation control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window ListBox presentation source line ${control.line} appears more than once.`);
    lines.add(control.line);
    control.mode = normalizePatchListboxPresentation(control.mode);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\w*$/.test(String(control.id))) {
      throw new Error(`Window ListBox presentation control id '${control.id}' is invalid.`);
    }
  }
  return manifest;
}

export function readWindowListboxPresentation(source, sourceLine) {
  return readPatchListboxPresentationFromRows(patchPresentationSourceRows(source), sourceLine) ?? 'plain';
}

export function setWindowListboxPresentation(source, sourceLine, mode) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const normalized = normalizePatchListboxPresentation(mode);
  const lineIndex = resolvePatchPresentationLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected ListBox line is outside the Patch source.');
  if (!/^\s*listbox\b/i.test(rows[lineIndex])) throw new Error('ListBox presentation can only be changed on a ListBox control.');

  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && LISTBOX_DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!LISTBOX_MODE_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(`ListBox presentation is declared more than once before source line ${sourceLine}.`);
    parsePatchListboxPresentationDirective(rows[index]);
    existingIndex = index;
  }

  const directive = formatPatchListboxPresentationDirective(normalized);
  if (!directive) {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preservePatchPresentationTrailingNewline(original, rows.join('\n'));
  }
  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const rendered = `${indent}${directive}`;
  if (existingIndex >= 0) rows[existingIndex] = rendered;
  else rows.splice(lineIndex, 0, rendered);
  return preservePatchPresentationTrailingNewline(original, rows.join('\n'));
}

export function collectWindowCheckedListboxIds(ast) {
  const ids = [];
  walkPatchPresentationControls(ast, node => {
    if (node.control === 'listbox' && node.listboxPresentation === 'checked' && node.id) ids.push(node.id);
  });
  return ids;
}

export function normalizePatchInputMask(mask) {
  const normalized = String(mask ?? '');
  if (!normalized.length) throw new Error('MaskedEdit needs a non-empty input mask.');
  if (normalized.length > PATCH_INPUT_MASK_MAX_LENGTH) {
    throw new Error(`MaskedEdit input masks can contain at most ${PATCH_INPUT_MASK_MAX_LENGTH} characters.`);
  }
  if (/[\r\n\u0000-\u001f\u007f]/.test(normalized)) throw new Error('MaskedEdit input masks cannot contain control characters.');
  const slots = compilePatchInputMask(normalized);
  if (!slots.some(slot => slot.kind !== 'literal')) {
    throw new Error("MaskedEdit input masks need at least one token: '0', 'A' or '*'.");
  }
  return normalized;
}

export function parsePatchInputMaskDirective(line) {
  const text = String(line ?? '');
  if (!/^\s*#\s*@input-mask\b/i.test(text)) return null;
  const match = text.match(/^\s*#\s*@input-mask\s+(.+?)\s*$/i);
  if (!match) throw new Error(`Invalid # @input-mask directive '${text.trim()}'. Use '# @input-mask "000-000"'.`);
  let value;
  try { value = JSON.parse(match[1]); }
  catch { throw new Error(`Invalid # @input-mask directive '${text.trim()}'. The mask must be a quoted string.`); }
  if (typeof value !== 'string') throw new Error(`Invalid # @input-mask directive '${text.trim()}'. The mask must be a quoted string.`);
  return normalizePatchInputMask(value);
}

export function formatPatchInputMaskDirective(mask) {
  return `# @input-mask ${JSON.stringify(normalizePatchInputMask(mask))}`;
}

export function compilePatchInputMask(mask) {
  const text = String(mask ?? '');
  const slots = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') {
      if (index + 1 >= text.length) throw new Error('MaskedEdit input mask cannot end with an escape character.');
      slots.push(Object.freeze({ kind: 'literal', char: text[++index] }));
      continue;
    }
    const kind = MASK_TOKEN_KINDS[char];
    slots.push(Object.freeze(kind ? { kind, token: char } : { kind: 'literal', char }));
  }
  return Object.freeze(slots);
}

export function patchInputMaskPlaceholder(mask) {
  return compilePatchInputMask(normalizePatchInputMask(mask))
    .map(slot => slot.kind === 'literal' ? slot.char : '_')
    .join('');
}

export function patchInputMaskInputMode(mask) {
  const tokenKinds = new Set(compilePatchInputMask(normalizePatchInputMask(mask))
    .filter(slot => slot.kind !== 'literal')
    .map(slot => slot.kind));
  return tokenKinds.size === 1 && tokenKinds.has('digit') ? 'numeric' : 'text';
}

export function applyPatchInputMask(mask, value) {
  const normalized = normalizePatchInputMask(mask);
  const slots = compilePatchInputMask(normalized);
  const literalChars = new Set(slots.filter(slot => slot.kind === 'literal').map(slot => slot.char));
  const raw = [...String(value ?? '')].filter(char => !literalChars.has(char));
  const out = [];
  let sourceIndex = 0;
  let filled = 0;
  const tokenCount = slots.filter(slot => slot.kind !== 'literal').length;

  const nextMatching = kind => {
    while (sourceIndex < raw.length) {
      const char = raw[sourceIndex++];
      if (maskCharMatches(kind, char)) return char;
    }
    return null;
  };

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (slot.kind !== 'literal') {
      const char = nextMatching(slot.kind);
      if (char === null) break;
      out.push(char);
      filled += 1;
      continue;
    }

    const hasFutureToken = slots.slice(index + 1).some(candidate => candidate.kind !== 'literal');
    const shouldShow = filled === 0
      ? raw.length > sourceIndex
      : hasFutureToken
        ? raw.length > sourceIndex
        : filled === tokenCount;
    if (shouldShow) out.push(slot.char);
  }
  return out.join('');
}

export function patchInputMaskTargetSupport() {
  return MASK_TARGETS;
}

export function assertPatchInputMaskTarget(target) {
  const normalizedTarget = String(target ?? '').trim().toLowerCase();
  if (MASK_TARGETS[normalizedTarget] !== 'supported') {
    throw new Error(
      `MaskedEdit Stage 1 is not supported on '${normalizedTarget || 'unknown'}'. ` +
      'MaskedEdit Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
    );
  }
  return true;
}

function readPatchListboxPresentationFromRows(rows, sourceLine) {
  const lineIndex = resolvePatchPresentationLineIndex(rows, sourceLine);
  if (lineIndex < 1) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && LISTBOX_DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!LISTBOX_MODE_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`ListBox presentation is declared more than once before source line ${sourceLine}.`);
    found = parsePatchListboxPresentationDirective(rows[index]);
  }
  return found;
}

function collectPatchStateTypes(nodes, out = new Map()) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'create' && node.name) out.set(node.name, node.valueType);
    if (node?.kind === 'if') {
      collectPatchStateTypes(node.thenBody, out);
      collectPatchStateTypes(node.elseBody, out);
    } else if (node?.body && node.kind !== 'window' && node.kind !== 'tabs' && node.kind !== 'tabPage' && !(node.kind === 'uiControl' && node.control === 'panel')) {
      collectPatchStateTypes(node.body, out);
    }
  }
  return out;
}

function walkPatchPresentationControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl') visit(node);
    if (
      node?.kind === 'window' ||
      node?.kind === 'tabPage' ||
      node?.kind === 'tabs' ||
      (node?.kind === 'uiControl' && node.control === 'panel')
    ) walkPatchPresentationControls(node.body, visit);
  }
}

function patchPresentationSourceRows(source) {
  return String(source ?? '').replace(/\r\n/g, '\n').split('\n');
}

function resolvePatchPresentationLineIndex(rows, sourceLine) {
  const lineIndex = Number(sourceLine) - 1;
  return Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < rows.length ? lineIndex : -1;
}

function preservePatchPresentationTrailingNewline(original, text) {
  const hasNewline = /\n$/.test(String(original));
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}

function maskCharMatches(kind, char) {
  if (kind === 'digit') return /^[0-9]$/.test(char);
  if (kind === 'letter') return /^[A-Za-z]$/.test(char);
  return /^[A-Za-z0-9]$/.test(char);
}

if (typeof document !== 'undefined') queueMicrotask(installCheckedListboxStudio);

let checkedDesignerApiPromise = null;
let checkedParserApiPromise = null;
let checkedStudioObserver = null;
let checkedSyncQueued = false;
let checkedGeneration = 0;

function checkedDesignerApi() {
  checkedDesignerApiPromise ??= import('./designer.js');
  return checkedDesignerApiPromise;
}

function checkedParserApi() {
  checkedParserApiPromise ??= import('./parser.js');
  return checkedParserApiPromise;
}

function installCheckedListboxStudio() {
  ensureCheckedListboxStyles();
  ensureCheckedListboxButton();
  ensureCheckedListboxInspector();
  installCheckedListboxObservers();
  scheduleCheckedListboxSync();

  if (!checkedStudioObserver && document.body && !checkedListboxStudioReady()) {
    checkedStudioObserver = new MutationObserver(() => {
      ensureCheckedListboxButton();
      ensureCheckedListboxInspector();
      installCheckedListboxObservers();
      if (checkedListboxStudioReady()) {
        checkedStudioObserver.disconnect();
        checkedStudioObserver = null;
      }
    });
    checkedStudioObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function checkedListboxStudioReady() {
  return Boolean(
    document.querySelector('#addCheckedListbox') &&
    document.querySelector('#designerInspectorListboxPresentationField')
  );
}

function ensureCheckedListboxStyles() {
  if (document.querySelector('style[data-patch-checked-listbox-stage1]')) return;
  const style = document.createElement('style');
  style.dataset.patchCheckedListboxStage1 = '1';
  style.textContent = `
.patch-checked-listbox-studio{display:flex;flex-direction:column;gap:4px;min-width:220px;min-height:72px;margin:0;padding:8px 10px;border:1px solid var(--border-strong,#d4d4d8);border-radius:9px;background:var(--surface,#fff);color:var(--text,#18181b);overflow:auto;box-sizing:border-box}
.patch-checked-listbox-studio>legend{padding:0 4px;font-size:11px;font-weight:700;color:var(--muted,#52525b)}
.patch-checked-listbox-option{display:flex;align-items:center;gap:8px;min-height:28px;cursor:pointer}
.patch-checked-listbox-option input{width:18px;height:18px;min-width:18px;margin:0;padding:0}
.patch-checked-listbox-source{position:absolute!important;width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;margin:-1px!important;padding:0!important;border:0!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;overflow:hidden!important;white-space:nowrap!important;opacity:0!important;pointer-events:none!important}
.patch-checked-listbox-studio.designer-control{cursor:pointer}
@media(forced-colors:active){.patch-checked-listbox-studio{border:1px solid CanvasText;background:Canvas;color:CanvasText}}
`;
  document.head.appendChild(style);
}

function ensureCheckedListboxButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const listboxButton = toolbar?.querySelector('#addListbox');
  if (!toolbar || !listboxButton || toolbar.querySelector('#addCheckedListbox')) return Boolean(toolbar?.querySelector('#addCheckedListbox'));
  const button = document.createElement('button');
  button.id = 'addCheckedListbox';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Checked List';
  button.setAttribute('aria-label', 'Add CheckedListBox');
  button.title = 'Add a source-backed CheckedListBox preset. It remains a list-backed ListBox and uses # @listbox-mode checked.';
  listboxButton.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addCheckedListboxFromStudio);
  return true;
}

async function addCheckedListboxFromStudio(event) {
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  const code = document.querySelector('#code');
  if (!code) return;
  try {
    const api = await checkedDesignerApi();
    const windowIndex = checkedActiveFormIndex();
    let next = api.addDesignerControl(code.value, 'listbox', { windowIndex });
    let added = api.listDesignerControls(next)
      .filter(control => control.windowIndex === windowIndex && control.type === 'listbox')
      .at(-1);
    if (!added?.id) throw new Error('Designer created a ListBox but could not locate its source-backed id.');
    next = await ensureCheckedListState(next, added.id);
    const line = findListboxLineById(next, added.id);
    next = setWindowListboxPresentation(next, line, 'checked');
    setCheckedStudioSource(code, next);
    added = api.listDesignerControls(next).find(control => control.id === added.id && control.type === 'listbox') ?? added;
    requestAnimationFrame(() => {
      const element = document.querySelector(`#designerCanvas .designer-control[data-window-index="${added.windowIndex}"][data-control-index="${added.controlIndex}"]`);
      element?.click?.();
      scheduleCheckedListboxSync();
    });
  } catch (error) {
    showCheckedListboxError(error);
  }
}

function ensureCheckedListboxInspector() {
  const form = document.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerInspectorListboxPresentationField')) return Boolean(form?.querySelector('#designerInspectorListboxPresentationField'));
  const field = document.createElement('label');
  field.id = 'designerInspectorListboxPresentationField';
  field.className = 'inspector-field';
  field.hidden = true;
  field.innerHTML = `ListBox mode
    <select id="designerInspectorListboxPresentation" aria-describedby="designerInspectorListboxPresentationHint">
      <option value="plain">ListBox</option>
      <option value="checked">CheckedListBox</option>
    </select>
    <small id="designerInspectorListboxPresentationHint" class="inspector-hint">CheckedListBox is a source-backed list-state presentation. Stage 1 is Studio/Web; Current Ready native 1.10 fails closed.</small>`;
  form.appendChild(field);
  field.querySelector('#designerInspectorListboxPresentation')?.addEventListener('change', applyCheckedListboxInspector);
  return true;
}

async function selectedTopLevelListbox() {
  const canvas = document.querySelector('#designerCanvas');
  const code = document.querySelector('#code');
  const element = canvas?.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!canvas || !code || !element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  try {
    const api = await checkedDesignerApi();
    const control = api.listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
    return control?.type === 'listbox' ? control : null;
  } catch {
    return null;
  }
}

async function syncCheckedListboxInspector() {
  const field = document.querySelector('#designerInspectorListboxPresentationField');
  const select = field?.querySelector('#designerInspectorListboxPresentation');
  if (!field || !select) return;
  const code = document.querySelector('#code');
  const control = await selectedTopLevelListbox();
  field.hidden = !control;
  if (!control || !code) return;
  try {
    const mode = readWindowListboxPresentation(code.value, control.line);
    if (document.activeElement !== select) select.value = mode;
  } catch {
    field.hidden = true;
  }
}

async function applyCheckedListboxInspector() {
  const code = document.querySelector('#code');
  const select = document.querySelector('#designerInspectorListboxPresentation');
  if (!code || !select) return;
  const control = await selectedTopLevelListbox();
  if (!control?.id) return;
  try {
    let next = code.value;
    if (select.value === 'checked') next = await ensureCheckedListState(next, control.id);
    const line = findListboxLineById(next, control.id);
    next = setWindowListboxPresentation(next, line, select.value);
    setCheckedStudioSource(code, next);
    scheduleCheckedListboxSync();
  } catch (error) {
    showCheckedListboxError(error);
    scheduleCheckedListboxSync();
  }
}

async function ensureCheckedListState(source, id) {
  const { parse } = await checkedParserApi();
  const ast = parse(source);
  const existing = ast.find(node => node.kind === 'create' && node.name === id);
  if (existing) {
    if (existing.valueType !== 'list') {
      throw new Error(`CheckedListBox '${id}' needs list state, but '${id}' is already declared as ${existing.valueType}.`);
    }
    return source;
  }
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  return `create list ${id} = []\n\n${original.replace(/^\n+/, '')}`;
}

function findListboxLineById(source, id) {
  const escaped = escapeCheckedRegExp(id);
  const pattern = new RegExp(`^\\s*listbox\\b.*\\bas\\s+${escaped}(?:\\s+at\\b|\\s*$)`, 'i');
  const rows = patchPresentationSourceRows(source);
  const index = rows.findIndex(row => pattern.test(row));
  if (index < 0) throw new Error(`Cannot find ListBox '${id}' in Patch source.`);
  return index + 1;
}

function installCheckedListboxObservers() {
  const code = document.querySelector('#code');
  const canvas = document.querySelector('#designerCanvas');
  const app = document.querySelector('#app');
  if (code?.dataset.patchCheckedListboxObserver !== '1') {
    code.dataset.patchCheckedListboxObserver = '1';
    code.addEventListener('input', scheduleCheckedListboxSync);
    code.addEventListener('change', scheduleCheckedListboxSync);
  }
  for (const root of [canvas, app]) {
    if (!root || root.dataset.patchCheckedListboxObserver === '1') continue;
    root.dataset.patchCheckedListboxObserver = '1';
    new MutationObserver(scheduleCheckedListboxSync).observe(root, { childList: true, subtree: true });
  }
  if (canvas?.dataset.patchCheckedListboxSelectionObserver !== '1') {
    canvas.dataset.patchCheckedListboxSelectionObserver = '1';
    canvas.addEventListener('patch-designer-selection-change', scheduleCheckedListboxSync);
  }
  const formSelect = document.querySelector('#patchFormSelect');
  if (formSelect?.dataset.patchCheckedListboxObserver !== '1') {
    formSelect.dataset.patchCheckedListboxObserver = '1';
    formSelect.addEventListener('change', scheduleCheckedListboxSync);
  }
}

function scheduleCheckedListboxSync() {
  if (checkedSyncQueued) return;
  checkedSyncQueued = true;
  queueMicrotask(() => {
    checkedSyncQueued = false;
    syncCheckedListboxSurfaces();
    syncCheckedListboxInspector();
  });
}

async function syncCheckedListboxSurfaces() {
  const code = document.querySelector('#code');
  if (!code) return;
  const generation = ++checkedGeneration;
  let checkedIds;
  try {
    const { parse } = await checkedParserApi();
    const ast = parse(code.value);
    const manifest = buildWindowListboxPresentationManifest(code.value, ast);
    checkedIds = new Set(manifest.controls.filter(control => control.mode === 'checked').map(control => control.id).filter(Boolean));
  } catch {
    return;
  }
  if (generation !== checkedGeneration) return;

  for (const root of [document.querySelector('#designerCanvas'), document.querySelector('#app')]) {
    if (!root) continue;
    for (const wrapper of [...root.querySelectorAll('.patch-checked-listbox-studio')]) {
      const select = wrapper.querySelector('select.patch-listbox');
      const id = wrapper.dataset.patchCheckedListboxId || checkedListboxIdFromSelect(select);
      if (!select || !id || !checkedIds.has(id)) unwrapCheckedListbox(select, wrapper);
    }
    for (const select of [...root.querySelectorAll('select.patch-listbox')]) {
      const id = checkedListboxIdFromSelect(select);
      if (!id) continue;
      if (checkedIds.has(id)) wrapCheckedListbox(select, id);
      else {
        const wrapper = select.closest('.patch-checked-listbox-studio');
        if (wrapper) unwrapCheckedListbox(select, wrapper);
      }
    }
  }
}

function checkedListboxIdFromSelect(select) {
  if (!select) return '';
  if (select.dataset.patchCheckedListboxId) return select.dataset.patchCheckedListboxId;
  const key = String(select.dataset.patchControlKey ?? select.closest('.patch-checked-listbox-studio')?.dataset.patchControlKey ?? '');
  return key.startsWith('id:') ? key.slice(3) : '';
}

function wrapCheckedListbox(select, id) {
  const existing = select.closest('.patch-checked-listbox-studio');
  if (existing) {
    syncCheckedListboxChecks(existing, select);
    return existing;
  }

  const wrapper = document.createElement('fieldset');
  wrapper.className = 'patch-checked-listbox-studio';
  wrapper.dataset.patchCheckedListboxId = id;
  if (select.dataset.patchControlKey) {
    wrapper.dataset.patchControlKey = select.dataset.patchControlKey;
    delete select.dataset.patchControlKey;
  }
  if (select.__patchControlFingerprint !== undefined) wrapper.__patchControlFingerprint = select.__patchControlFingerprint;

  if (select.classList.contains('designer-control')) {
    wrapper.classList.add('designer-control');
    wrapper.dataset.windowIndex = select.dataset.windowIndex ?? '';
    wrapper.dataset.controlIndex = select.dataset.controlIndex ?? '';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('aria-label', `Select checked ListBox control ${id}`);
    select.classList.remove('designer-control');
    delete select.dataset.windowIndex;
    delete select.dataset.controlIndex;
  }

  const legend = document.createElement('legend');
  legend.textContent = id;
  const options = document.createElement('div');
  options.className = 'patch-checked-listbox-options';
  wrapper.append(legend, options);
  select.before(wrapper);
  wrapper.appendChild(select);
  select.classList.add('patch-checked-listbox-source');
  select.dataset.patchCheckedListboxId = id;
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  rebuildCheckedListboxOptions(wrapper, select);
  return wrapper;
}

function rebuildCheckedListboxOptions(wrapper, select) {
  const optionsRoot = wrapper.querySelector('.patch-checked-listbox-options');
  if (!optionsRoot) return;
  optionsRoot.replaceChildren();
  for (const option of [...select.options]) {
    const label = document.createElement('label');
    label.className = 'patch-checked-listbox-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = option.value;
    input.checked = option.selected;
    input.disabled = select.disabled;
    const text = document.createElement('span');
    text.textContent = option.textContent || option.value;
    label.append(input, text);
    if (!select.disabled) {
      input.addEventListener('change', () => {
        option.selected = input.checked;
        select.dataset.patchRenderedSelection = JSON.stringify([...select.selectedOptions].map(item => item.value));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    optionsRoot.appendChild(label);
  }
}

function syncCheckedListboxChecks(wrapper, select) {
  const inputs = [...wrapper.querySelectorAll('.patch-checked-listbox-option input[type="checkbox"]')];
  if (inputs.length !== select.options.length) {
    rebuildCheckedListboxOptions(wrapper, select);
    return;
  }
  inputs.forEach((input, index) => {
    const option = select.options[index];
    if (!option || input.value !== option.value) {
      rebuildCheckedListboxOptions(wrapper, select);
      return;
    }
    input.checked = option.selected;
    input.disabled = select.disabled;
  });
}

function unwrapCheckedListbox(select, wrapper) {
  if (!wrapper) return;
  if (!select) {
    wrapper.remove();
    return;
  }
  if (wrapper.dataset.patchControlKey) select.dataset.patchControlKey = wrapper.dataset.patchControlKey;
  if (wrapper.__patchControlFingerprint !== undefined) select.__patchControlFingerprint = wrapper.__patchControlFingerprint;
  if (wrapper.classList.contains('designer-control')) {
    select.classList.add('designer-control');
    select.dataset.windowIndex = wrapper.dataset.windowIndex ?? '';
    select.dataset.controlIndex = wrapper.dataset.controlIndex ?? '';
  }
  select.classList.remove('patch-checked-listbox-source');
  delete select.dataset.patchCheckedListboxId;
  select.removeAttribute('aria-hidden');
  select.removeAttribute('tabindex');
  wrapper.before(select);
  wrapper.remove();
}

function checkedActiveFormIndex() {
  const value = Number(document.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function setCheckedStudioSource(code, source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function showCheckedListboxError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function escapeCheckedRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
