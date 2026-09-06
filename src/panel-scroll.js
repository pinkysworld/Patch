export const PATCH_PANEL_SCROLL_VERSION = '0.1';
export const PATCH_PANEL_SCROLL_DIRECTIVE = 'panel-scroll';
export const PATCH_WINDOW_PANEL_SCROLL_VERSION = '0.1';
export const PATCH_WINDOW_PANEL_SCROLL_FORMAT = 'patch-window-panel-scroll';

const PANEL_SCROLL_PREFIX_RE = /^\s*#\s*@panel-scroll\b/i;
const PANEL_SCROLL_RE = /^\s*#\s*@panel-scroll\s+(auto)\s*$/i;
const COMMENT_RE = /^\s*#/;
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
  const claimedDirectiveLines = new Set();
  walkWindowControls(ast, node => {
    if (!(node.kind === 'uiControl' && node.control === 'panel')) return;
    const record = readPanelLocalScrollFromRows(rows, node.line);
    if (record.directiveLine !== null) claimedDirectiveLines.add(record.directiveLine);
    controls.push({ line: node.line ?? null, id: node.id ?? null, mode: record.mode ?? 'none' });
  });

  for (let index = 0; index < rows.length; index += 1) {
    if (!PANEL_SCROLL_PREFIX_RE.test(rows[index])) continue;
    parsePatchPanelScrollDirective(rows[index]);
    if (!claimedDirectiveLines.has(index + 1)) {
      throw new Error(`# @panel-scroll belongs inside a Panel block header, directly after the Panel declaration (source line ${index + 1}).`);
    }
  }

  return validateWindowPanelScrollManifest({
    format: PATCH_WINDOW_PANEL_SCROLL_FORMAT,
    version: PATCH_WINDOW_PANEL_SCROLL_VERSION,
    controls
  });
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
  return readPanelLocalScrollFromRows(sourceRows(source), sourceLine).mode ?? 'none';
}

export function setWindowPanelScroll(source, sourceLine, mode) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected Panel line is outside the Patch source.');
  if (!/^\s*panel\b/i.test(rows[lineIndex])) throw new Error('Panel scroll metadata can only be attached to a Panel declaration.');

  const normalized = normalizePatchPanelScroll(mode);
  const record = readPanelLocalScrollFromRows(rows, sourceLine);
  if (normalized === 'none') {
    if (record.directiveLine !== null) rows.splice(record.directiveLine - 1, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }

  const indent = `${/^\s*/.exec(rows[lineIndex])?.[0] ?? ''}  `;
  const directive = `${indent}${formatPatchPanelScrollDirective(normalized)}`;
  if (record.directiveLine !== null) rows[record.directiveLine - 1] = directive;
  else rows.splice(lineIndex + 1, 0, directive);
  return preserveTrailingNewline(original, rows.join('\n'));
}

function readPanelLocalScrollFromRows(rows, sourceLine) {
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) return { mode: null, directiveLine: null };
  const baseIndent = indentOf(rows[lineIndex]).length;
  let mode = null;
  let directiveLine = null;

  for (let index = lineIndex + 1; index < rows.length; index += 1) {
    const line = rows[index];
    if (!line.trim()) continue;
    const indent = indentOf(line).length;
    if (indent <= baseIndent) break;
    if (!COMMENT_RE.test(line)) break;
    if (!PANEL_SCROLL_PREFIX_RE.test(line)) continue;
    if (mode !== null) throw new Error(`Panel scroll metadata appears more than once inside Panel on source line ${lineIndex + 1}.`);
    mode = parsePatchPanelScrollDirective(line);
    directiveLine = index + 1;
  }
  return { mode, directiveLine };
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
function indentOf(line) { return /^\s*/.exec(String(line ?? ''))?.[0] ?? ''; }

function resolveSourceLineIndex(rows, sourceLine) {
  const line = Number(sourceLine);
  if (!Number.isInteger(line) || line < 1 || line > rows.length) return -1;
  return line - 1;
}

function preserveTrailingNewline(original, next) {
  return original.endsWith('\n') && !next.endsWith('\n') ? `${next}\n` : (!original.endsWith('\n') && next.endsWith('\n') ? next.slice(0, -1) : next);
}
