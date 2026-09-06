export const PATCH_SLIDER_PRESENTATION_VERSION = '0.1';
export const PATCH_SLIDER_PRESENTATION_DIRECTIVE = 'slider-mode';
export const PATCH_WINDOW_SLIDER_PRESENTATION_VERSION = '0.1';
export const PATCH_WINDOW_SLIDER_PRESENTATION_FORMAT = 'patch-window-slider-presentation';

const MODES = Object.freeze(['plain', 'progress']);
const MODE_SET = new Set(MODES);
const MODE_PREFIX_RE = /^\s*#\s*@slider-mode\b/i;
const DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode)\b/i;

const PLAIN_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'supported',
  macos: 'supported',
  linux: 'supported',
  freebsd: 'unsupported'
});

const PROGRESS_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'unsupported',
  macos: 'unsupported',
  linux: 'unsupported',
  freebsd: 'unsupported'
});

export function patchSliderPresentationModes() {
  return [...MODES];
}

export function normalizePatchSliderPresentation(mode) {
  const normalized = String(mode ?? 'plain').trim().toLowerCase() || 'plain';
  if (!MODE_SET.has(normalized)) {
    throw new Error(`Unsupported Slider presentation '${mode}'. Use plain or progress.`);
  }
  return normalized;
}

export function parsePatchSliderPresentationDirective(line) {
  const text = String(line ?? '');
  if (!MODE_PREFIX_RE.test(text)) return null;
  const match = text.match(/^\s*#\s*@slider-mode\s+(plain|progress)\s*$/i);
  if (!match) throw new Error(`Invalid # @slider-mode directive '${text.trim()}'. Use '# @slider-mode progress'.`);
  return normalizePatchSliderPresentation(match[1]);
}

export function formatPatchSliderPresentationDirective(mode) {
  const normalized = normalizePatchSliderPresentation(mode);
  return normalized === 'plain' ? null : `# @slider-mode ${normalized}`;
}

export function patchSliderPresentationTargetSupport(mode) {
  return normalizePatchSliderPresentation(mode) === 'progress' ? PROGRESS_TARGETS : PLAIN_TARGETS;
}

export function assertPatchSliderPresentationTarget(mode, target) {
  const normalizedMode = normalizePatchSliderPresentation(mode);
  const normalizedTarget = String(target ?? '').trim().toLowerCase();
  const support = patchSliderPresentationTargetSupport(normalizedMode)[normalizedTarget];
  if (support !== 'supported') {
    throw new Error(
      `Slider presentation '${normalizedMode}' is not supported on '${normalizedTarget || 'unknown'}'. ` +
      (normalizedMode === 'progress'
        ? 'ProgressBar Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
        : 'Select a supported Patch target.')
    );
  }
  return true;
}

export function buildWindowSliderPresentationManifest(source, ast) {
  const rows = sourceRows(source);
  const stateTypes = collectStateTypes(ast);
  const controls = [];
  walkControls(ast, node => {
    const mode = readPresentationFromRows(rows, node.line);
    if (mode !== null && node.control !== 'slider') {
      throw new Error(`# @slider-mode belongs only to Slider controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control !== 'slider') return;
    const effective = mode ?? 'plain';
    if (effective === 'progress') {
      const stateType = node.id ? stateTypes.get(node.id) : null;
      if (stateType !== 'number') {
        throw new Error(
          `ProgressBar '${node.id ?? '?'}' needs a matching 'create number ${node.id ?? 'name'} = ...' state declaration so the passive bar has one explicit numeric value source.`
        );
      }
    }
    controls.push({ line: node.line ?? null, id: node.id ?? null, mode: effective });
  });
  return validateWindowSliderPresentationManifest({
    format: PATCH_WINDOW_SLIDER_PRESENTATION_FORMAT,
    version: PATCH_WINDOW_SLIDER_PRESENTATION_VERSION,
    controls
  });
}

export function attachWindowSliderPresentations(ast, manifest) {
  validateWindowSliderPresentationManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.mode]));
  let attached = 0;
  walkControls(ast, node => {
    if (node.control !== 'slider') return;
    const mode = normalizePatchSliderPresentation(byLine.get(node.line) ?? 'plain');
    Object.defineProperty(node, 'sliderPresentation', {
      value: mode,
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) {
    throw new Error('Window Slider presentation manifest does not match the compiled Slider controls.');
  }
  return ast;
}

export function validateWindowSliderPresentationManifest(manifest) {
  if (
    !manifest ||
    manifest.format !== PATCH_WINDOW_SLIDER_PRESENTATION_FORMAT ||
    manifest.version !== PATCH_WINDOW_SLIDER_PRESENTATION_VERSION ||
    !Array.isArray(manifest.controls)
  ) {
    throw new Error('Window Slider presentation manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window Slider presentation control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window Slider presentation source line ${control.line} appears more than once.`);
    lines.add(control.line);
    control.mode = normalizePatchSliderPresentation(control.mode);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\w*$/.test(String(control.id))) {
      throw new Error(`Window Slider presentation control id '${control.id}' is invalid.`);
    }
  }
  return manifest;
}

export function readWindowSliderPresentation(source, sourceLine) {
  return readPresentationFromRows(sourceRows(source), sourceLine) ?? 'plain';
}

export function setWindowSliderPresentation(source, sourceLine, mode) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const normalized = normalizePatchSliderPresentation(mode);
  const lineIndex = resolveLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected Slider line is outside the Patch source.');
  if (!/^\s*slider\b/i.test(rows[lineIndex])) throw new Error('Slider presentation can only be changed on a Slider control.');

  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!MODE_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(`Slider presentation is declared more than once before source line ${sourceLine}.`);
    parsePatchSliderPresentationDirective(rows[index]);
    existingIndex = index;
  }

  const directive = formatPatchSliderPresentationDirective(normalized);
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

export function collectWindowProgressBarIds(ast) {
  const ids = [];
  walkControls(ast, node => {
    if (node.control === 'slider' && node.sliderPresentation === 'progress' && node.id) ids.push(node.id);
  });
  return ids;
}

function readPresentationFromRows(rows, sourceLine) {
  const lineIndex = resolveLineIndex(rows, sourceLine);
  if (lineIndex < 0) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!MODE_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`Slider presentation is declared more than once before source line ${sourceLine}.`);
    found = parsePatchSliderPresentationDirective(rows[index]);
  }
  return found;
}

function sourceRows(source) {
  return String(source ?? '').replace(/\r\n/g, '\n').split('\n');
}

function resolveLineIndex(rows, sourceLine) {
  const number = Number(sourceLine);
  if (!Number.isInteger(number) || number < 1 || number > rows.length) return -1;
  return number - 1;
}

function collectStateTypes(ast) {
  return new Map((ast ?? [])
    .filter(node => node?.kind === 'create' && node.name)
    .map(node => [node.name, node.valueType]));
}

function walkControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl') {
      visit(node);
      if (node.control === 'panel') walkControls(node.body, visit);
      continue;
    }
    if (node?.kind === 'window') walkControls(node.body, visit);
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) walkControls(page.body, visit);
    }
  }
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /\n$/.test(String(original));
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}
