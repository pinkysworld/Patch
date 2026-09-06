export const PATCH_PANEL_SCROLL_VERSION = '0.1';
export const PATCH_PANEL_SCROLL_DIRECTIVE = 'panel-scroll';
export const PATCH_WINDOW_PANEL_SCROLL_VERSION = '0.1';
export const PATCH_WINDOW_PANEL_SCROLL_FORMAT = 'patch-window-panel-scroll';

const PANEL_SCROLL_PREFIX_RE = /^\s*#\s*@panel-scroll\b/i;
const PANEL_SCROLL_RE = /^\s*#\s*@panel-scroll\s+(auto)\s*$/i;
const DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode|panel-mode|panel-scroll)\b/i;
const MODES = Object.freeze(['none', 'auto']);
const MODE_SET = new Set(MODES);
const NONE_TARGETS = Object.freeze({ studio: 'supported', web: 'supported', windows: 'supported', macos: 'supported', linux: 'supported', freebsd: 'unsupported' });
const AUTO_TARGETS = Object.freeze({ studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported' });

export function patchPanelScrollModes() { return [...MODES]; }

export function normalizePatchPanelScroll(mode) {
  const normalized = String(mode ?? 'none').trim().toLowerCase() || 'none';
  if (!MODE_SET.has(normalized)) throw new Error(`Unsupported Panel scroll mode '${mode}'. Use none or auto.`);
  return normalized;
}

export function parsePatchPanelScrollDirective(line) {
  const text = String(line ?? '');
  if (!PANEL_SCROLL_PREFIX_RE.test(text)) return null;
  const match = text.match(PANEL_SCROLL_RE);
  if (!match) throw new Error(`Invalid # @panel-scroll directive '${text.trim()}'. Use '# @panel-scroll auto'.`);
  return normalizePatchPanelScroll(match[1]);
}

export function formatPatchPanelScrollDirective(mode) {
  const normalized = normalizePatchPanelScroll(mode);
  return normalized === 'none' ? null : `# @panel-scroll ${normalized}`;
}

export function patchPanelScrollTargetSupport(mode) {
  return normalizePatchPanelScroll(mode) === 'auto' ? AUTO_TARGETS : NONE_TARGETS;
}

export function assertPatchPanelScrollTarget(mode, target) {
  const normalizedMode = normalizePatchPanelScroll(mode);
  const normalizedTarget = String(target ?? '').trim().toLowerCase();
  if (patchPanelScrollTargetSupport(normalizedMode)[normalizedTarget] !== 'supported') {
    throw new Error(`Panel scroll mode '${normalizedMode}' is not supported on '${normalizedTarget || 'unknown'}'. ` + (normalizedMode === 'auto' ? 'ScrollBox Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.' : 'Select a supported Patch target.'));
  }
  return true;
}

export function buildWindowPanelScrollManifest(source, ast) {
  const rows = sourceRows(source);
  const controls = [];
  walkWindowControls(ast, node => {
    const mode = readWindowPanelScrollFromRows(rows, node.line);
    if (mode !== null && !(node.kind === 'uiControl' && node.control === 'panel')) {
      const type = node.kind === 'tabs' ? 'tabs' : node.control ?? node.kind ?? 'control';
      throw new Error(`# @panel-scroll belongs only to Panel controls, not '${type}' on source line ${node.line ?? '?'}.`);
    }
    if (!(node.kind === 'uiControl' && node.control === 'panel')) return;
    controls.push({ line: node.line ?? null, id: node.id ?? null, mode: mode ?? 'none' });
  });
  return validateWindowPanelScrollManifest({ format: PATCH_WINDOW_PANEL_SCROLL_FORMAT, version: PATCH_WINDOW_PANEL_SCROLL_VERSION, controls });
}

export function attachWindowPanelScroll(ast, manifest) {
  validateWindowPanelScrollManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.mode]));
  let attached = 0;
  walkWindowControls(ast, node => {
    if (!(node.kind === 'uiControl' && node.control === 'panel')) return;
    Object.defineProperty(node, 'panelScroll', {
      value: normalizePatchPanelScroll(byLine.get(node.line) ?? 'none'),
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) throw new Error('Window Panel scroll manifest does not match the compiled Panel controls.');
  return ast;
}

export function validateWindowPanelScrollManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_WINDOW_PANEL_SCROLL_FORMAT || manifest.version !== PATCH_WINDOW_PANEL_SCROLL_VERSION || !Array.isArray(manifest.controls)) {
    throw new Error('Window Panel scroll manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window Panel scroll control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window Panel scroll source line ${control.line} appears more than once.`);
    lines.add(control.line);
    normalizePatchPanelScroll(control.mode);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\w*$/.test(String(control.id))) throw new Error(`Window Panel scroll control id '${control.id}' is invalid.`);
  }
  return manifest;
}

export function readWindowPanelScroll(source, sourceLine) {
  return readWindowPanelScrollFromRows(sourceRows(source), sourceLine) ?? 'none';
}

export function setWindowPanelScroll(source, sourceLine, mode) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected Panel line is outside the Patch source.');
  const normalized = normalizePatchPanelScroll(mode);
  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!PANEL_SCROLL_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(`Panel scroll metadata appears more than once before source line ${lineIndex + 1}.`);
    parsePatchPanelScrollDirective(rows[index]);
    existingIndex = index;
  }
  if (normalized === 'none') {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }
  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const directive = `${indent}${formatPatchPanelScrollDirective(normalized)}`;
  if (existingIndex >= 0) rows[existingIndex] = directive;
  else rows.splice(lineIndex, 0, directive);
  return preserveTrailingNewline(original, rows.join('\n'));
}

function readWindowPanelScrollFromRows(rows, sourceLine) {
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 1) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!PANEL_SCROLL_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`Panel scroll metadata appears more than once before source line ${lineIndex + 1}.`);
    found = parsePatchPanelScrollDirective(rows[index]);
  }
  return found;
}

function walkWindowControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'window') {
      walkWindowControls(node.body, visit);
      continue;
    }
    if (node?.kind === 'uiControl') {
      visit(node);
      if (node.control === 'panel') walkWindowControls(node.body, visit);
      continue;
    }
    if (node?.kind === 'tabs') {
      visit(node);
      for (const page of node.body ?? []) walkWindowControls(page.body, visit);
    }
  }
}

function sourceRows(source) { return String(source ?? '').replace(/\r\n/g, '\n').split('\n'); }

function resolveSourceLineIndex(rows, sourceLine) {
  const line = Number(sourceLine);
  if (!Number.isInteger(line) || line < 1 || line > rows.length) return -1;
  return line - 1;
}

function preserveTrailingNewline(original, next) {
  return original.endsWith('\n') && !next.endsWith('\n') ? `${next}\n` : (!original.endsWith('\n') && next.endsWith('\n') ? next.slice(0, -1) : next);
}
