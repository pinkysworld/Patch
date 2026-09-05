import {
  normalizePatchInputPresentation,
  parsePatchInputPresentationDirective
} from './input-presentation.js';

export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.1';
export const PATCH_WINDOW_INPUT_PRESENTATION_FORMAT = 'patch-window-input-presentation';

const INPUT_MODE_PREFIX_RE = /^\s*#\s*@input-mode\b/i;
const DESIGNER_METADATA_RE = /^\s*#\s*@(?:layout|taborder|locked|input-mode)\b/i;

export function buildWindowInputPresentationManifest(source, ast) {
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const controls = [];
  walkControls(ast, node => {
    const mode = readInputPresentationFromRows(rows, node.line);
    if (mode !== null && node.control !== 'input') {
      throw new Error(`# @input-mode belongs only to Input controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control === 'input') controls.push({ line: node.line ?? null, mode: mode ?? 'plain' });
  });
  return validateWindowInputPresentationManifest({
    format: PATCH_WINDOW_INPUT_PRESENTATION_FORMAT,
    version: PATCH_WINDOW_INPUT_PRESENTATION_VERSION,
    controls
  });
}

export function attachWindowInputPresentations(ast, manifest) {
  validateWindowInputPresentationManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.mode]));
  let attached = 0;
  walkControls(ast, node => {
    if (node.control !== 'input') return;
    const mode = normalizePatchInputPresentation(byLine.get(node.line) ?? 'plain');
    Object.defineProperty(node, 'inputPresentation', {
      value: mode,
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) {
    throw new Error('Window input presentation manifest does not match the compiled Input controls.');
  }
  return ast;
}

export function validateWindowInputPresentationManifest(manifest) {
  if (
    !manifest ||
    manifest.format !== PATCH_WINDOW_INPUT_PRESENTATION_FORMAT ||
    manifest.version !== PATCH_WINDOW_INPUT_PRESENTATION_VERSION ||
    !Array.isArray(manifest.controls)
  ) {
    throw new Error('Window input presentation manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window input presentation control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window input presentation source line ${control.line} appears more than once.`);
    lines.add(control.line);
    control.mode = normalizePatchInputPresentation(control.mode);
  }
  return manifest;
}

export function readWindowInputPresentation(source, sourceLine) {
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  return readInputPresentationFromRows(rows, sourceLine) ?? 'plain';
}

function readInputPresentationFromRows(rows, sourceLine) {
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 1 || lineIndex >= rows.length) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && DESIGNER_METADATA_RE.test(rows[index]); index -= 1) {
    if (!INPUT_MODE_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`Input presentation is declared more than once before source line ${sourceLine}.`);
    found = parsePatchInputPresentationDirective(rows[index]);
  }
  return found;
}

function walkControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl') visit(node);
    if (node.kind === 'window' || node.kind === 'panel' || node.kind === 'tabPage' || node.kind === 'tabs') {
      walkControls(node.body, visit);
    }
  }
}
