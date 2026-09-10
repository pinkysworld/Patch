export const PATCH_NUMBEREDIT_VERSION = '0.1';
export const PATCH_NUMBEREDIT_FORMAT = 'patch-numberedit-presentation';
export const PATCH_NUMBEREDIT_DIRECTIVE = 'number-edit';

const NUMBEREDIT_RE = /^\s*#\s*@number-edit\s*$/i;
const NUMBEREDIT_PREFIX_RE = /^\s*#\s*@number-edit\b/i;
const DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask|number-edit)\b/i;

/**
 * Dormant source-backed presentation contract for NumberEdit Stage 1.
 *
 * This module deliberately does not change compiler or target behavior yet.
 * Target activation must be explicit and fail closed until Studio, Web and
 * native target policies have adopted the contract.
 */
export function buildWindowNumberEditManifest(source, ast) {
  const rows = sourceRows(source);
  const controls = [];
  walkControls(ast, node => {
    const enabled = readNumberEditFromRows(rows, node.line);
    if (enabled && node.control !== 'input') {
      throw new Error(`# @number-edit belongs only to Input controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control === 'input' && enabled) controls.push({ line: node.line ?? null, id: node.id ?? null });
  });
  return validateWindowNumberEditManifest({
    format: PATCH_NUMBEREDIT_FORMAT,
    version: PATCH_NUMBEREDIT_VERSION,
    controls
  });
}

export function validateWindowNumberEditManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_NUMBEREDIT_FORMAT || manifest.version !== PATCH_NUMBEREDIT_VERSION || !Array.isArray(manifest.controls)) {
    throw new Error('Window NumberEdit manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window NumberEdit control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window NumberEdit source line ${control.line} appears more than once.`);
    lines.add(control.line);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\w*$/.test(String(control.id))) {
      throw new Error(`Window NumberEdit control id '${control.id}' is invalid.`);
    }
  }
  return manifest;
}

export function readWindowNumberEdit(source, sourceLine) {
  return readNumberEditFromRows(sourceRows(source), sourceLine);
}

export function setWindowNumberEdit(source, sourceLine, enabled = true) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  assertInputLine(rows, lineIndex);

  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!NUMBEREDIT_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(`NumberEdit is declared more than once before source line ${sourceLine}.`);
    assertNumberEditDirective(rows[index], sourceLine);
    existingIndex = index;
  }

  if (!enabled) {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }
  if (existingIndex >= 0) return original;

  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  rows.splice(lineIndex, 0, `${indent}# @number-edit`);
  return preserveTrailingNewline(original, rows.join('\n'));
}

export function collectWindowNumberEditInputIds(source, ast) {
  const rows = sourceRows(source);
  const ids = [];
  walkControls(ast, node => {
    if (node.control === 'input' && node.id && readNumberEditFromRows(rows, node.line)) ids.push(node.id);
  });
  return ids;
}

function readNumberEditFromRows(rows, sourceLine) {
  if (!Number.isInteger(sourceLine) || sourceLine < 1 || sourceLine > rows.length) return false;
  const lineIndex = sourceLine - 1;
  let found = false;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!NUMBEREDIT_PREFIX_RE.test(rows[index])) continue;
    if (found) throw new Error(`NumberEdit is declared more than once before source line ${sourceLine}.`);
    assertNumberEditDirective(rows[index], sourceLine);
    found = true;
  }
  return found;
}

function assertNumberEditDirective(row, sourceLine) {
  if (!NUMBEREDIT_RE.test(row)) {
    throw new Error(`Invalid # @number-edit directive before source line ${sourceLine}. Use exactly '# @number-edit'.`);
  }
}

function resolveSourceLineIndex(rows, sourceLine) {
  const index = Number(sourceLine) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) throw new Error(`Source line ${sourceLine} is invalid.`);
  return index;
}

function assertInputLine(rows, lineIndex) {
  if (!/^\s*input\s+[A-Za-z_]\w*\b/i.test(rows[lineIndex] ?? '')) {
    throw new Error(`NumberEdit can only be changed on an Input control at source line ${lineIndex + 1}.`);
  }
}

function sourceRows(source) {
  return String(source ?? '').replace(/\r\n/g, '\n').split('\n');
}

function preserveTrailingNewline(original, next) {
  return original.endsWith('\n') && !next.endsWith('\n') ? `${next}\n` : next;
}

function walkControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl') {
      visit(node);
      if (node.control === 'panel') walkControls(node.body, visit);
      continue;
    }
    if (node?.kind === 'window') walkControls(node.body, visit);
    if (node?.kind === 'tabs') for (const page of node.body ?? []) walkControls(page.body, visit);
  }
}
