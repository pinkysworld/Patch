export const PATCH_INPUT_NUMBER_VERSION = '0.1';
export const PATCH_INPUT_NUMBER_DIRECTIVE = 'input-number';
export const PATCH_WINDOW_INPUT_NUMBER_VERSION = '0.1';
export const PATCH_WINDOW_INPUT_NUMBER_FORMAT = 'patch-window-input-number';

const NUMBER = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:e[+-]?\\d+)?';
const PREFIX_RE = /^\s*#\s*@input-number\b/i;
const DIRECTIVE_RE = new RegExp(`^\\s*#\\s*@input-number\\s+min\\s+(${NUMBER})\\s+max\\s+(${NUMBER})\\s+step\\s+(${NUMBER})\\s*$`, 'i');
const METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask|input-number|listbox-mode|slider-mode|panel-mode)\b/i;
const TARGETS = Object.freeze({ studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported' });

export function normalizePatchInputNumber(value) {
  const min = Number(value?.min);
  const max = Number(value?.max);
  const step = Number(value?.step);
  if (![min, max, step].every(Number.isFinite)) throw new Error('NumberEdit min, max and step must be finite numbers.');
  if (!(min < max)) throw new Error('NumberEdit min must be smaller than max.');
  if (!(step > 0)) throw new Error('NumberEdit step must be greater than zero.');
  return Object.freeze({ min, max, step });
}

export function parsePatchInputNumberDirective(line) {
  const text = String(line ?? '');
  if (!PREFIX_RE.test(text)) return null;
  const match = text.match(DIRECTIVE_RE);
  if (!match) throw new Error(`Invalid # @input-number directive '${text.trim()}'. Use '# @input-number min 0 max 100 step 1'.`);
  return normalizePatchInputNumber({ min: match[1], max: match[2], step: match[3] });
}

export function formatPatchInputNumberDirective(value) {
  const number = normalizePatchInputNumber(value);
  return `# @input-number min ${formatNumber(number.min)} max ${formatNumber(number.max)} step ${formatNumber(number.step)}`;
}

export function patchInputNumberTargetSupport() { return TARGETS; }

export function assertPatchInputNumberTarget(target) {
  const normalized = String(target ?? '').trim().toLowerCase();
  if (TARGETS[normalized] !== 'supported') {
    throw new Error(`NumberEdit Stage 1 is not supported on '${normalized || 'unknown'}'. NumberEdit Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.`);
  }
  return true;
}

export function buildWindowInputNumberManifest(source, ast) {
  const rows = sourceRows(source);
  const stateTypes = collectStateTypes(ast);
  const controls = [];
  walkControls(ast, node => {
    const descriptor = readInputNumberFromRows(rows, node.line);
    if (descriptor !== null && node.control !== 'input') {
      throw new Error(`# @input-number belongs only to Input controls, not '${node.control}' on source line ${node.line ?? '?'}.`);
    }
    if (node.control !== 'input' || descriptor === null) return;
    if (!node.id || stateTypes.get(node.id) !== 'number') {
      throw new Error(`NumberEdit '${node.id ?? '?'}' needs a matching 'create number ${node.id ?? 'name'} = ...' state declaration so changed(value) is numeric.`);
    }
    controls.push({ line: node.line ?? null, id: node.id, ...descriptor });
  });
  return validateWindowInputNumberManifest({ format: PATCH_WINDOW_INPUT_NUMBER_FORMAT, version: PATCH_WINDOW_INPUT_NUMBER_VERSION, controls });
}

export function attachWindowInputNumbers(ast, manifest) {
  validateWindowInputNumberManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control]));
  let attached = 0;
  walkControls(ast, node => {
    if (node.control !== 'input') return;
    const record = byLine.get(node.line);
    if (!record) return;
    if (node.inputPresentation === 'password') throw new Error(`Input '${node.id ?? '?'}' cannot combine PasswordEdit and NumberEdit presentation metadata.`);
    if (node.inputMask) throw new Error(`Input '${node.id ?? '?'}' cannot combine MaskedEdit and NumberEdit presentation metadata.`);
    Object.defineProperty(node, 'inputNumber', {
      value: normalizePatchInputNumber(record), enumerable: true, configurable: true, writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) throw new Error('Window NumberEdit manifest does not match the compiled Input controls.');
  return ast;
}

export function validateWindowInputNumberManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_WINDOW_INPUT_NUMBER_FORMAT || manifest.version !== PATCH_WINDOW_INPUT_NUMBER_VERSION || !Array.isArray(manifest.controls)) {
    throw new Error('Window NumberEdit manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window NumberEdit control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Window NumberEdit source line ${control.line} appears more than once.`);
    lines.add(control.line);
    if (!/^[A-Za-z_]\w*$/.test(String(control.id ?? ''))) throw new Error(`Window NumberEdit control id '${control.id}' is invalid.`);
    const normalized = normalizePatchInputNumber(control);
    control.min = normalized.min; control.max = normalized.max; control.step = normalized.step;
  }
  return manifest;
}

export function readWindowInputNumber(source, sourceLine) {
  return readInputNumberFromRows(sourceRows(source), sourceLine);
}

export function setWindowInputNumber(source, sourceLine, value) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= rows.length) throw new Error('Selected Input line is outside the Patch source.');
  if (!/^\s*input\s+[A-Za-z_]\w*(?:\s+at\b|\s*$)/i.test(rows[lineIndex])) throw new Error('NumberEdit metadata can only be changed on an Input control.');
  let existing = -1;
  for (let index = lineIndex - 1; index >= 0 && METADATA_RE.test(rows[index]); index -= 1) {
    if (!PREFIX_RE.test(rows[index])) continue;
    if (existing >= 0) throw new Error(`NumberEdit metadata is declared more than once before source line ${sourceLine}.`);
    parsePatchInputNumberDirective(rows[index]); existing = index;
  }
  const clear = value === null || value === undefined;
  if (clear) {
    if (existing >= 0) rows.splice(existing, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }
  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const rendered = `${indent}${formatPatchInputNumberDirective(value)}`;
  if (existing >= 0) rows[existing] = rendered; else rows.splice(lineIndex, 0, rendered);
  return preserveTrailingNewline(original, rows.join('\n'));
}

function readInputNumberFromRows(rows, sourceLine) {
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 1 || lineIndex >= rows.length) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && METADATA_RE.test(rows[index]); index -= 1) {
    if (!PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`NumberEdit metadata is declared more than once before source line ${sourceLine}.`);
    found = parsePatchInputNumberDirective(rows[index]);
  }
  return found;
}

function collectStateTypes(nodes, out = new Map()) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'create' && node.name) out.set(node.name, node.valueType);
    if (node?.body) collectStateTypes(node.body, out);
    if (node?.thenBody) collectStateTypes(node.thenBody, out);
    if (node?.elseBody) collectStateTypes(node.elseBody, out);
  }
  return out;
}

function walkControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl') visit(node);
    if (node?.kind === 'window' || node?.kind === 'tabs' || node?.kind === 'tabPage' || (node?.kind === 'uiControl' && node.control === 'panel')) walkControls(node.body, visit);
  }
}
function sourceRows(source) { return String(source ?? '').replace(/\r\n/g, '\n').split('\n'); }
function formatNumber(value) { return Number(value).toString(); }
function preserveTrailingNewline(original, text) { return text.replace(/\s+$/, '') + (/\n$/.test(original) ? '\n' : ''); }
