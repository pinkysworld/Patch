export const PATCH_PANEL_SPLIT_VERSION = '0.1';
export const PATCH_PANEL_SPLIT_DIRECTIVE = 'panel-split';
export const PATCH_PANEL_SPLIT_BREAK_DIRECTIVE = 'panel-split-break';
export const PATCH_WINDOW_PANEL_SPLIT_VERSION = '0.1';
export const PATCH_WINDOW_PANEL_SPLIT_FORMAT = 'patch-window-panel-split';
export const PATCH_PANEL_SPLIT_RATIO_MIN = 10;
export const PATCH_PANEL_SPLIT_RATIO_MAX = 90;

const PANEL_SPLIT_PREFIX_RE = /^\s*#\s*@panel-split\b/i;
const PANEL_SPLIT_RE = /^\s*#\s*@panel-split\s+(vertical|horizontal)\s+(\d{1,3})\s*$/i;
const PANEL_SPLIT_BREAK_RE = /^\s*#\s*@panel-split-break\s*$/i;
const COMMENT_RE = /^\s*#/;
const ORIENTATIONS = Object.freeze(['vertical', 'horizontal']);
const ORIENTATION_SET = new Set(ORIENTATIONS);
const PLAIN_TARGETS = Object.freeze({ studio: 'supported', web: 'supported', windows: 'supported', macos: 'supported', linux: 'supported', freebsd: 'unsupported' });
const SPLIT_TARGETS = Object.freeze({ studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported' });

export function patchPanelSplitOrientations() { return [...ORIENTATIONS]; }

export function normalizePatchPanelSplit(value) {
  if (value === null || value === undefined || value === false || value === 'none') return null;
  const orientation = String(value.orientation ?? '').trim().toLowerCase();
  const ratio = Number(value.ratio);
  if (!ORIENTATION_SET.has(orientation)) throw new Error(`Unsupported Panel split orientation '${value.orientation}'. Use vertical or horizontal.`);
  if (!Number.isInteger(ratio) || ratio < PATCH_PANEL_SPLIT_RATIO_MIN || ratio > PATCH_PANEL_SPLIT_RATIO_MAX) {
    throw new Error(`Panel split ratio must be a whole percent from ${PATCH_PANEL_SPLIT_RATIO_MIN} to ${PATCH_PANEL_SPLIT_RATIO_MAX}.`);
  }
  return Object.freeze({ orientation, ratio });
}

export function parsePatchPanelSplitDirective(line) {
  const text = String(line ?? '');
  if (!PANEL_SPLIT_PREFIX_RE.test(text) || PANEL_SPLIT_BREAK_RE.test(text)) return null;
  const match = text.match(PANEL_SPLIT_RE);
  if (!match) throw new Error(`Invalid # @panel-split directive '${text.trim()}'. Use '# @panel-split vertical 50' or '# @panel-split horizontal 50'.`);
  return normalizePatchPanelSplit({ orientation: match[1], ratio: Number(match[2]) });
}

export function formatPatchPanelSplitDirective(value) {
  const split = normalizePatchPanelSplit(value);
  return split ? `# @panel-split ${split.orientation} ${split.ratio}` : null;
}

export function patchPanelSplitTargetSupport(value) {
  return normalizePatchPanelSplit(value) ? SPLIT_TARGETS : PLAIN_TARGETS;
}

export function assertPatchPanelSplitTarget(value, target) {
  const split = normalizePatchPanelSplit(value);
  const normalizedTarget = String(target ?? '').trim().toLowerCase();
  if (patchPanelSplitTargetSupport(split)[normalizedTarget] !== 'supported') {
    throw new Error(`Panel split is not supported on '${normalizedTarget || 'unknown'}'. ` + (split ? 'SplitContainer Stage 1 is Studio/Web only until a new explicit native containment/runtime contract is promoted.' : 'Select a supported Patch target.'));
  }
  return true;
}

export function buildWindowPanelSplitManifest(source, ast) {
  const rows = sourceRows(source);
  const controls = [];
  const claimed = new Set();

  walkWindowControls(ast, node => {
    if (!(node.kind === 'uiControl' && node.control === 'panel')) return;
    const record = readPanelSplitFromRows(rows, node);
    if (record.directiveLine !== null) claimed.add(record.directiveLine);
    if (record.breakLine !== null) claimed.add(record.breakLine);
    controls.push({
      line: node.line ?? null,
      id: node.id ?? null,
      split: record.split,
      breakLine: record.breakLine,
      children: record.children
    });
  });

  for (let index = 0; index < rows.length; index += 1) {
    const line = rows[index];
    if (!PANEL_SPLIT_PREFIX_RE.test(line)) continue;
    if (PANEL_SPLIT_BREAK_RE.test(line)) {
      if (!claimed.has(index + 1)) throw new Error(`# @panel-split-break belongs directly inside a SplitContainer Panel block (source line ${index + 1}).`);
      continue;
    }
    parsePatchPanelSplitDirective(line);
    if (!claimed.has(index + 1)) throw new Error(`# @panel-split belongs inside a Panel block header, directly after the Panel declaration (source line ${index + 1}).`);
  }

  return validateWindowPanelSplitManifest({
    format: PATCH_WINDOW_PANEL_SPLIT_FORMAT,
    version: PATCH_WINDOW_PANEL_SPLIT_VERSION,
    controls
  });
}

export function attachWindowPanelSplits(ast, manifest) {
  validateWindowPanelSplitManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control]));
  let attached = 0;
  walkWindowControls(ast, node => {
    if (!(node.kind === 'uiControl' && node.control === 'panel')) return;
    const record = byLine.get(node.line);
    const split = record?.split ? normalizePatchPanelSplit(record.split) : null;
    Object.defineProperty(node, 'panelSplit', {
      value: split,
      enumerable: true,
      configurable: true,
      writable: false
    });
    const paneByLine = new Map((record?.children ?? []).map(child => [child.line, child.pane]));
    for (const child of node.body ?? []) {
      if (!split || !paneByLine.has(child.line)) continue;
      Object.defineProperty(child, 'splitPane', {
        value: paneByLine.get(child.line),
        enumerable: true,
        configurable: true,
        writable: false
      });
    }
    attached += 1;
  });
  if (attached !== manifest.controls.length) throw new Error('Window Panel split manifest does not match the compiled Panel controls.');
  return ast;
}

export function validateWindowPanelSplitManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_WINDOW_PANEL_SPLIT_FORMAT || manifest.version !== PATCH_WINDOW_PANEL_SPLIT_VERSION || !Array.isArray(manifest.controls)) {
    throw new Error('Window Panel split manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window Panel split control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window Panel split source line ${control.line} appears more than once.`);
    lines.add(control.line);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\w*$/.test(String(control.id))) throw new Error(`Window Panel split control id '${control.id}' is invalid.`);
    const split = normalizePatchPanelSplit(control.split);
    if (!split) {
      if (control.breakLine !== null || (control.children ?? []).some(child => child.pane !== null)) throw new Error('Plain Panel cannot carry SplitContainer pane metadata.');
      continue;
    }
    if (!Number.isInteger(control.breakLine) || control.breakLine <= control.line) throw new Error(`SplitContainer '${control.id ?? '?'}' needs one # @panel-split-break marker.`);
    if (!Array.isArray(control.children) || control.children.length < 2) throw new Error(`SplitContainer '${control.id ?? '?'}' needs at least one child in each pane.`);
    const panes = new Set();
    for (const child of control.children) {
      if (!Number.isInteger(child?.line) || child.line <= control.line) throw new Error('SplitContainer child line is invalid.');
      if (![1, 2].includes(child.pane)) throw new Error('SplitContainer child pane must be 1 or 2.');
      panes.add(child.pane);
    }
    if (!panes.has(1) || !panes.has(2)) throw new Error(`SplitContainer '${control.id ?? '?'}' needs at least one child in each pane.`);
  }
  return manifest;
}

export function readWindowPanelSplit(source, sourceLine) {
  const rows = sourceRows(source);
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) return null;
  const fakeNode = { line: sourceLine, body: [] };
  return readPanelSplitHeader(rows, fakeNode).split;
}

export function setWindowPanelSplit(source, sourceLine, value) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected Panel line is outside the Patch source.');
  if (!/^\s*panel\b/i.test(rows[lineIndex])) throw new Error('Panel split metadata can only be attached to a Panel declaration.');
  const current = readPanelSplitHeader(rows, { line: sourceLine, body: [] });
  const split = normalizePatchPanelSplit(value);
  if (!split) {
    if (current.directiveLine !== null) rows.splice(current.directiveLine - 1, 1);
    const baseIndent = indentOf(rows[lineIndex]).length;
    const breakIndex = rows.findIndex((line, index) => index > lineIndex && indentOf(line).length === baseIndent + 2 && PANEL_SPLIT_BREAK_RE.test(line));
    if (breakIndex >= 0) rows.splice(breakIndex, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }
  if (current.directiveLine === null) throw new Error('Convert a Panel to SplitContainer through the dedicated Studio action so its explicit pane boundary is created atomically.');
  rows[current.directiveLine - 1] = `${indentOf(rows[current.directiveLine - 1])}${formatPatchPanelSplitDirective(split)}`;
  return preserveTrailingNewline(original, rows.join('\n'));
}

function readPanelSplitFromRows(rows, node) {
  const header = readPanelSplitHeader(rows, node);
  const baseIndent = indentOf(rows[(node.line ?? 1) - 1]).length;
  let breakLine = null;
  const blockEnd = panelBlockEnd(rows, (node.line ?? 1) - 1, baseIndent);
  for (let index = (node.line ?? 1); index < blockEnd; index += 1) {
    const line = rows[index];
    if (indentOf(line).length !== baseIndent + 2 || !PANEL_SPLIT_BREAK_RE.test(line)) continue;
    if (breakLine !== null) throw new Error(`SplitContainer Panel on source line ${node.line} has more than one # @panel-split-break marker.`);
    breakLine = index + 1;
  }
  if (!header.split && breakLine !== null) throw new Error(`# @panel-split-break requires # @panel-split in the same Panel header (source line ${breakLine}).`);
  if (header.split && breakLine === null) throw new Error(`SplitContainer Panel '${node.id ?? '?'}' needs one # @panel-split-break marker between its two panes.`);

  const children = [];
  for (const child of node.body ?? []) {
    if (!Number.isInteger(child?.line)) continue;
    if (header.split && child.layout) throw new Error(`SplitContainer Stage 1 supports flow-layout children only. Remove positioned layout from '${child.id ?? child.control ?? child.kind ?? 'child'}' or use a plain Panel.`);
    children.push({
      line: child.line,
      id: child.id ?? null,
      type: child.kind === 'tabs' ? 'tabs' : (child.control ?? child.kind ?? 'control'),
      pane: header.split ? (child.line < breakLine ? 1 : 2) : null
    });
  }
  return { ...header, breakLine, children };
}

function readPanelSplitHeader(rows, node) {
  const lineIndex = resolveSourceLineIndex(rows, node.line);
  if (lineIndex < 0) return { split: null, directiveLine: null };
  const baseIndent = indentOf(rows[lineIndex]).length;
  let split = null;
  let directiveLine = null;
  for (let index = lineIndex + 1; index < rows.length; index += 1) {
    const line = rows[index];
    if (!line.trim()) continue;
    const indent = indentOf(line).length;
    if (indent <= baseIndent) break;
    if (!COMMENT_RE.test(line)) break;
    if (PANEL_SPLIT_BREAK_RE.test(line)) break;
    if (!PANEL_SPLIT_PREFIX_RE.test(line)) continue;
    if (split !== null) throw new Error(`Panel split metadata appears more than once inside Panel on source line ${lineIndex + 1}.`);
    split = parsePatchPanelSplitDirective(line);
    directiveLine = index + 1;
  }
  return { split, directiveLine };
}

function panelBlockEnd(rows, lineIndex, baseIndent) {
  let index = lineIndex + 1;
  while (index < rows.length) {
    if (!rows[index].trim()) { index += 1; continue; }
    if (indentOf(rows[index]).length <= baseIndent) break;
    index += 1;
  }
  return index;
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
