import {
  formatPatchInputMaskDirective,
  normalizePatchInputMask,
  parsePatchInputMaskDirective
} from './input-presentation.js';
import { readWindowInputPresentation } from './window-input-presentation.js';

export const PATCH_WINDOW_INPUT_MASK_VERSION = '0.1';
export const PATCH_WINDOW_INPUT_MASK_FORMAT = 'patch-window-input-mask';

const INPUT_MASK_PREFIX_RE = /^\s*#\s*@input-mask\b/i;
const DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask)\b/i;

export function buildWindowInputMaskManifest(source, ast) {
  const rows = sourceRows(source);
  const controls = [];
  walkControls(ast, node => {
    const mask = readInputMaskFromRows(rows, node.line);
    if (mask !== null && node.control !== 'input') {
      throw new Error(`# @input-mask belongs only to Input controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control !== 'input' || mask === null) return;
    if (readWindowInputPresentation(source, node.line) === 'password') {
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
  if (lineIndex < 0) throw new Error('Selected Input line is outside the Patch source.');
  if (!/^\s*input\s+[A-Za-z_]\w*(?:\s+at\b|\s*$)/i.test(rows[lineIndex])) {
    throw new Error('Input mask can only be changed on an Input control.');
  }

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
  if (readWindowInputPresentation(original, sourceLine) === 'password') {
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
