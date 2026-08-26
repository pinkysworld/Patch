export const PATCH_SHAPE_STAGE_VERSION = '0.1';
export const PATCH_SHAPE_KINDS = Object.freeze(['rectangle', 'rounded', 'ellipse', 'line']);

export const PATCH_SHAPE_DEFAULTS = Object.freeze({
  kind: 'rectangle',
  fill: '#dbeafe',
  stroke: '#2563eb',
  strokeWidth: 2,
  cornerRadius: 12,
  opacity: 1
});

const KINDS = new Set(PATCH_SHAPE_KINDS);
const HEX_COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

export class PatchShapeError extends Error {
  constructor(message, code = 'SHAPE_INVALID') {
    super(message);
    this.name = 'PatchShapeError';
    this.code = code;
  }
}

export function normalizePatchShape(input = {}) {
  const kind = String(input.kind ?? PATCH_SHAPE_DEFAULTS.kind).toLowerCase();
  if (!KINDS.has(kind)) {
    throw new PatchShapeError(`Shape kind '${kind}' is not supported. Use rectangle, rounded, ellipse or line.`, 'SHAPE_KIND');
  }
  const fill = normalizeColor(input.fill ?? PATCH_SHAPE_DEFAULTS.fill, 'fill', true);
  const stroke = normalizeColor(input.stroke ?? PATCH_SHAPE_DEFAULTS.stroke, 'stroke', false);
  const strokeWidth = finiteRange(input.strokeWidth ?? PATCH_SHAPE_DEFAULTS.strokeWidth, 'stroke width', 0, 64);
  const opacity = finiteRange(input.opacity ?? PATCH_SHAPE_DEFAULTS.opacity, 'opacity', 0, 1);
  const cornerRadius = kind === 'rounded'
    ? finiteRange(input.cornerRadius ?? PATCH_SHAPE_DEFAULTS.cornerRadius, 'corner radius', 0, 4096)
    : 0;
  return Object.freeze({ kind, fill: kind === 'line' ? 'transparent' : fill, stroke, strokeWidth, cornerRadius, opacity });
}

export function patchShapeSvgDescriptor(input = {}) {
  const shape = normalizePatchShape(input);
  const common = Object.freeze({
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    opacity: shape.opacity
  });
  if (shape.kind === 'ellipse') {
    return Object.freeze({ element: 'ellipse', attributes: Object.freeze({ ...common, cx: '50%', cy: '50%', rx: '49%', ry: '49%' }) });
  }
  if (shape.kind === 'line') {
    return Object.freeze({ element: 'line', attributes: Object.freeze({ ...common, x1: '0%', y1: '50%', x2: '100%', y2: '50%' }) });
  }
  return Object.freeze({
    element: 'rect',
    attributes: Object.freeze({ ...common, x: 1, y: 1, width: 'calc(100% - 2px)', height: 'calc(100% - 2px)', rx: shape.kind === 'rounded' ? shape.cornerRadius : 0, ry: shape.kind === 'rounded' ? shape.cornerRadius : 0 })
  });
}

export function patchShapeCssStyle(input = {}) {
  const shape = normalizePatchShape(input);
  return Object.freeze({
    backgroundColor: shape.kind === 'line' ? 'transparent' : shape.fill,
    borderColor: shape.stroke,
    borderWidth: `${shape.strokeWidth}px`,
    borderStyle: shape.kind === 'line' ? 'none' : 'solid',
    borderRadius: shape.kind === 'ellipse' ? '50%' : (shape.kind === 'rounded' ? `${shape.cornerRadius}px` : '0'),
    opacity: String(shape.opacity)
  });
}

function normalizeColor(value, name, allowTransparent) {
  const color = String(value ?? '').trim();
  if (allowTransparent && color === 'transparent') return color;
  if (!HEX_COLOR.test(color)) {
    throw new PatchShapeError(`Shape ${name} must be a six- or eight-digit hex color${allowTransparent ? ' or transparent' : ''}.`, 'SHAPE_COLOR');
  }
  return color.toLowerCase();
}

function finiteRange(value, name, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new PatchShapeError(`Shape ${name} must be a finite number from ${min} to ${max}.`, 'SHAPE_RANGE');
  }
  return number;
}
