export const PATCH_INPUT_PRESENTATION_VERSION = '0.1';
export const PATCH_INPUT_PRESENTATION_DIRECTIVE = 'input-mode';
export const PATCH_INPUT_MASK_VERSION = '0.1';
export const PATCH_INPUT_MASK_DIRECTIVE = 'input-mask';
export const PATCH_INPUT_MASK_MAX_LENGTH = 128;
export const PATCH_LISTBOX_PRESENTATION_VERSION = '0.1';
export const PATCH_LISTBOX_PRESENTATION_DIRECTIVE = 'listbox-mode';

const MODES = Object.freeze(['plain', 'password']);
const MODE_SET = new Set(MODES);
const LISTBOX_MODES = Object.freeze(['plain', 'checked']);
const LISTBOX_MODE_SET = new Set(LISTBOX_MODES);
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
  if (!/^\s*#\s*@listbox-mode\b/i.test(text)) return null;
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

function maskCharMatches(kind, char) {
  if (kind === 'digit') return /^[0-9]$/.test(char);
  if (kind === 'letter') return /^[A-Za-z]$/.test(char);
  return /^[A-Za-z0-9]$/.test(char);
}
