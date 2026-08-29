import { normalizePatchShape, PATCH_SHAPE_DEFAULTS } from './shape-control.js?v=9ad29318e93c7c71';

export const PATCH_SHAPE_SOURCE_VERSION = '0.1';

const PATCH_NAME = /^[A-Za-z_]\w*$/;
const PROPERTY_NAMES = new Set(['fill', 'stroke', 'stroke-width', 'radius', 'opacity']);

export class PatchShapeSourceError extends Error {
  constructor(message, code = 'SHAPE_SOURCE_INVALID') {
    super(message);
    this.name = 'PatchShapeSourceError';
    this.code = code;
  }
}

/**
 * Parse the core Shape declaration, before an optional Designer `at ... size ...`
 * suffix is handled by the shared Window layout parser.
 *
 * Canonical syntax:
 * shape rounded as card fill #dbeafe stroke #2563eb stroke-width 2 radius 12 opacity 1
 *
 * Properties are optional for hand-written source and may appear in any order.
 * Formatting always writes the complete normalized declaration.
 */
export function parsePatchShapeDeclaration(value) {
  const source = String(value ?? '').trim();
  const match = source.match(/^shape\s+(rectangle|rounded|ellipse|line)\s+as\s+([A-Za-z_]\w*)(?:\s+(.*))?$/i);
  if (!match) {
    throw new PatchShapeSourceError(
      "Shape syntax is 'shape <rectangle|rounded|ellipse|line> as <name>' followed by optional style properties.",
      'SHAPE_SOURCE_SYNTAX'
    );
  }

  const id = match[2];
  const values = { ...PATCH_SHAPE_DEFAULTS, kind: match[1].toLowerCase() };
  const seen = new Set();
  const rest = String(match[3] ?? '').trim();
  if (rest) {
    const tokens = rest.split(/\s+/);
    for (let index = 0; index < tokens.length;) {
      const property = tokens[index++].toLowerCase();
      if (!PROPERTY_NAMES.has(property)) {
        throw new PatchShapeSourceError(`Unknown Shape property '${property}'.`, 'SHAPE_SOURCE_PROPERTY');
      }
      if (seen.has(property)) {
        throw new PatchShapeSourceError(`Shape property '${property}' appears more than once.`, 'SHAPE_SOURCE_DUPLICATE_PROPERTY');
      }
      seen.add(property);
      if (index >= tokens.length) {
        throw new PatchShapeSourceError(`Shape property '${property}' needs a value.`, 'SHAPE_SOURCE_VALUE');
      }
      const raw = tokens[index++];
      if (property === 'fill') values.fill = raw;
      else if (property === 'stroke') values.stroke = raw;
      else if (property === 'stroke-width') values.strokeWidth = numberValue(raw, 'stroke-width');
      else if (property === 'radius') values.cornerRadius = numberValue(raw, 'radius');
      else if (property === 'opacity') values.opacity = numberValue(raw, 'opacity');
    }
  }

  let shape;
  try {
    shape = normalizePatchShape(values);
  } catch (error) {
    throw new PatchShapeSourceError(error?.message ?? String(error), error?.code ?? 'SHAPE_SOURCE_STYLE');
  }
  return Object.freeze({ id, ...shape });
}

export function formatPatchShapeDeclaration(input = {}) {
  const id = String(input.id ?? '').trim();
  if (!PATCH_NAME.test(id)) {
    throw new PatchShapeSourceError(`'${id || '?'}' is not a valid Patch Shape name.`, 'SHAPE_SOURCE_ID');
  }
  let shape;
  try {
    shape = normalizePatchShape(input);
  } catch (error) {
    throw new PatchShapeSourceError(error?.message ?? String(error), error?.code ?? 'SHAPE_SOURCE_STYLE');
  }
  return [
    'shape', shape.kind,
    'as', id,
    'fill', shape.fill,
    'stroke', shape.stroke,
    'stroke-width', formatNumber(shape.strokeWidth),
    'radius', formatNumber(shape.cornerRadius),
    'opacity', formatNumber(shape.opacity)
  ].join(' ');
}

export function updatePatchShapeDeclaration(source, changes = {}) {
  const current = parsePatchShapeDeclaration(source);
  return formatPatchShapeDeclaration({ ...current, ...changes });
}

function numberValue(value, property) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new PatchShapeSourceError(`Shape ${property} must be a finite number.`, 'SHAPE_SOURCE_NUMBER');
  }
  return number;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new PatchShapeSourceError('Shape numeric property is not finite.', 'SHAPE_SOURCE_NUMBER');
  return String(number);
}
