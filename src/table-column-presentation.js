export const PATCH_TABLE_COLUMN_PRESENTATION_VERSION = '0.1';
export const PATCH_TABLE_COLUMN_PRESENTATION_FORMAT = 'patch-table-column-presentation';
export const PATCH_TABLE_COLUMN_PRESENTATION_DIRECTIVE = 'table-columns';

const DIRECTIVE_PREFIX_RE = /^\s*#\s*@table-columns\b/i;
const METADATA_RE = /^\s*#\s*@[A-Za-z][\w-]*\b/;
const ALIGNMENTS = new Set(['left', 'center', 'right']);
const MIN_WIDTH = 40;
const MAX_WIDTH = 2000;

export function normalizeTableColumnPresentation(specs, expectedCount = null) {
  if (!Array.isArray(specs)) throw new Error('Table column presentation must be an array.');
  const normalized = specs.map((spec, index) => {
    if (!spec || typeof spec !== 'object') throw new Error(`Table column ${index + 1} presentation is invalid.`);
    const width = spec.width === null || spec.width === undefined || String(spec.width).toLowerCase() === 'auto'
      ? null
      : Number(spec.width);
    if (width !== null && (!Number.isInteger(width) || width < MIN_WIDTH || width > MAX_WIDTH)) {
      throw new Error(`Table column ${index + 1} width must be auto or an integer from ${MIN_WIDTH} to ${MAX_WIDTH}.`);
    }
    const align = String(spec.align ?? 'left').trim().toLowerCase() || 'left';
    if (!ALIGNMENTS.has(align)) throw new Error(`Table column ${index + 1} alignment must be left, center or right.`);
    return { width, align };
  });
  if (expectedCount !== null && normalized.length !== Number(expectedCount)) {
    throw new Error(`Table column presentation needs exactly ${expectedCount} entr${Number(expectedCount) === 1 ? 'y' : 'ies'} to match the Table columns.`);
  }
  return normalized;
}

export function defaultTableColumnPresentation(count) {
  const size = Number(count);
  if (!Number.isInteger(size) || size < 1) throw new Error('Table column count must be a positive integer.');
  return Array.from({ length: size }, () => ({ width: null, align: 'left' }));
}

export function parseTableColumnPresentationDirective(line, expectedCount = null) {
  const text = String(line ?? '');
  if (!DIRECTIVE_PREFIX_RE.test(text)) return null;
  const match = text.match(/^\s*#\s*@table-columns\s+(.+?)\s*$/i);
  if (!match) throw new Error(`Invalid # @table-columns directive '${text.trim()}'.`);
  const parts = splitSpecs(match[1]);
  const specs = parts.map((part, index) => {
    const item = part.trim().match(/^(auto|\d+)(?::(left|center|right))?$/i);
    if (!item) throw new Error(`Invalid Table column ${index + 1} presentation '${part.trim()}'. Use auto:left, 160:center or 120:right.`);
    return { width: item[1].toLowerCase() === 'auto' ? null : Number(item[1]), align: item[2] ?? 'left' };
  });
  return normalizeTableColumnPresentation(specs, expectedCount);
}

export function formatTableColumnPresentationDirective(specs, expectedCount = null) {
  const normalized = normalizeTableColumnPresentation(specs, expectedCount);
  if (normalized.every(spec => spec.width === null && spec.align === 'left')) return null;
  return `# @table-columns ${normalized.map(spec => `${spec.width === null ? 'auto' : spec.width}:${spec.align}`).join(', ')}`;
}

export function readWindowTableColumnPresentation(source, sourceLine, expectedCount = null) {
  const rows = sourceRows(source);
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected Table line is outside the Patch source.');
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && METADATA_RE.test(rows[index]); index -= 1) {
    if (!DIRECTIVE_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(`Table column presentation is declared more than once before source line ${sourceLine}.`);
    found = parseTableColumnPresentationDirective(rows[index], expectedCount);
  }
  return found;
}

export function setWindowTableColumnPresentation(source, sourceLine, specs, expectedCount = null) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected Table line is outside the Patch source.');
  if (!/^\s*table\b/i.test(rows[lineIndex])) throw new Error('Table column presentation can only be changed on a Table control.');
  const normalized = normalizeTableColumnPresentation(specs, expectedCount);
  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && METADATA_RE.test(rows[index]); index -= 1) {
    if (!DIRECTIVE_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(`Table column presentation is declared more than once before source line ${sourceLine}.`);
    parseTableColumnPresentationDirective(rows[index], expectedCount);
    existingIndex = index;
  }
  const directive = formatTableColumnPresentationDirective(normalized, expectedCount);
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

export function buildWindowTableColumnPresentationManifest(source, ast) {
  const controls = [];
  walkWindowTables(ast, node => {
    const presentation = readWindowTableColumnPresentation(source, node.line, node.columns?.length ?? 0);
    controls.push({
      line: node.line ?? null,
      id: node.id ?? null,
      columns: presentation ? normalizeTableColumnPresentation(presentation, node.columns?.length ?? 0) : null
    });
  });
  return validateWindowTableColumnPresentationManifest({
    format: PATCH_TABLE_COLUMN_PRESENTATION_FORMAT,
    version: PATCH_TABLE_COLUMN_PRESENTATION_VERSION,
    controls
  });
}

export function attachWindowTableColumnPresentations(ast, manifest) {
  validateWindowTableColumnPresentationManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.columns]));
  let attached = 0;
  walkWindowTables(ast, node => {
    const columns = byLine.get(node.line) ?? null;
    Object.defineProperty(node, 'tableColumnPresentation', {
      value: columns ? normalizeTableColumnPresentation(columns, node.columns?.length ?? 0) : null,
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) throw new Error('Table column presentation manifest does not match the compiled Table controls.');
  return ast;
}

export function validateWindowTableColumnPresentationManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_TABLE_COLUMN_PRESENTATION_FORMAT || manifest.version !== PATCH_TABLE_COLUMN_PRESENTATION_VERSION || !Array.isArray(manifest.controls)) {
    throw new Error('Table column presentation manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Table column presentation control line is invalid.');
    if (lines.has(control.line)) throw new Error(`Table column presentation source line ${control.line} appears more than once.`);
    lines.add(control.line);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\w*$/.test(String(control.id))) throw new Error(`Table column presentation id '${control.id}' is invalid.`);
    if (control.columns !== null) control.columns = normalizeTableColumnPresentation(control.columns);
  }
  return manifest;
}

export function tableColumnPresentationTargetSupport(presentation) {
  const advanced = Array.isArray(presentation) && presentation.some(spec => spec.width !== null || spec.align !== 'left');
  return advanced
    ? Object.freeze({ studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported' })
    : Object.freeze({ studio: 'supported', web: 'supported', windows: 'supported', macos: 'supported', linux: 'supported', freebsd: 'unsupported' });
}

function walkWindowTables(ast, visit) {
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node?.kind === 'window') { walk(node.body); continue; }
      if (node?.kind === 'uiControl' && node.control === 'table') visit(node);
      if (node?.kind === 'tabs') for (const page of node.body ?? []) walk(page.body);
      if (node?.kind === 'uiControl' && Array.isArray(node.body)) walk(node.body);
    }
  };
  walk(ast);
}

function splitSpecs(text) {
  return String(text ?? '').split(',').map(part => part.trim()).filter(Boolean);
}

function sourceRows(source) { return String(source ?? '').replace(/\r\n/g, '\n').split('\n'); }

function resolveSourceLineIndex(rows, sourceLine) {
  const line = Number(sourceLine);
  if (!Number.isInteger(line) || line < 1 || line > rows.length) return -1;
  return line - 1;
}

function preserveTrailingNewline(original, text) {
  return original.endsWith('\n') && !text.endsWith('\n') ? `${text}\n` : !original.endsWith('\n') && text.endsWith('\n') ? text.slice(0, -1) : text;
}
