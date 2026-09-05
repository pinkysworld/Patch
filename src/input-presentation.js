export const PATCH_INPUT_PRESENTATION_VERSION = '0.1';
export const PATCH_INPUT_PRESENTATION_DIRECTIVE = 'input-mode';

const MODES = Object.freeze(['plain', 'password']);
const MODE_SET = new Set(MODES);

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
