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
const LISTBOX_DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder|locked|listbox-mode)\b/i;
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
