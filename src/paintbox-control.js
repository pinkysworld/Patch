export const PATCH_PAINTBOX_STAGE_VERSION = '0.1';
export const PATCH_PAINTBOX_OPERATIONS = Object.freeze(['clear', 'line', 'rectangle', 'ellipse', 'text']);

const OPERATION_SET = new Set(PATCH_PAINTBOX_OPERATIONS);
const HEX_COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
const PATCH_NAME = /^[A-Za-z_]\w*$/;

export class PatchPaintBoxError extends Error {
  constructor(message, code = 'PAINTBOX_INVALID') {
    super(message);
    this.name = 'PatchPaintBoxError';
    this.code = code;
  }
}

/**
 * Normalize one ephemeral PaintBox drawing command.
 *
 * Paint commands describe output only. They never carry mutable canvas state;
 * persistent application data remains ordinary Patch state changed through
 * explicit `change` blocks.
 */
export function normalizePatchPaintCommand(input = {}) {
  const operation = String(input.operation ?? '').trim().toLowerCase();
  if (!OPERATION_SET.has(operation)) {
    throw new PatchPaintBoxError(
      `PaintBox operation '${operation || '?'}' is not supported. Use clear, line, rectangle, ellipse or text.`,
      'PAINTBOX_OPERATION'
    );
  }

  if (operation === 'clear') {
    return freezeCommand({ operation, color: paintColor(input.color ?? '#ffffff', 'clear color', true) });
  }

  if (operation === 'line') {
    return freezeCommand({
      operation,
      x1: coordinate(input.x1, 'x1'),
      y1: coordinate(input.y1, 'y1'),
      x2: coordinate(input.x2, 'x2'),
      y2: coordinate(input.y2, 'y2'),
      stroke: paintColor(input.stroke ?? '#000000', 'stroke', false),
      strokeWidth: boundedNumber(input.strokeWidth ?? 1, 'stroke width', 0, 64)
    });
  }

  if (operation === 'rectangle' || operation === 'ellipse') {
    return freezeCommand({
      operation,
      x: coordinate(input.x, 'x'),
      y: coordinate(input.y, 'y'),
      width: positiveNumber(input.width, 'width'),
      height: positiveNumber(input.height, 'height'),
      fill: paintColor(input.fill ?? 'transparent', 'fill', true),
      stroke: paintColor(input.stroke ?? '#000000', 'stroke', false),
      strokeWidth: boundedNumber(input.strokeWidth ?? 1, 'stroke width', 0, 64)
    });
  }

  const textExpr = String(input.textExpr ?? '').trim();
  if (!textExpr) throw new PatchPaintBoxError('PaintBox text needs a Patch text expression.', 'PAINTBOX_TEXT');
  return freezeCommand({
    operation,
    textExpr,
    x: coordinate(input.x, 'x'),
    y: coordinate(input.y, 'y'),
    color: paintColor(input.color ?? '#000000', 'text color', false),
    fontSize: boundedNumber(input.fontSize ?? 14, 'font size', 1, 512)
  });
}

export function normalizePatchPaintProgram(commands = []) {
  if (!Array.isArray(commands)) throw new PatchPaintBoxError('PaintBox program must be a list of draw commands.', 'PAINTBOX_PROGRAM');
  return Object.freeze(commands.map(command => normalizePatchPaintCommand(command)));
}

/** Parse one canonical source-visible `draw ...` line. */
export function parsePatchPaintCommand(source) {
  const text = String(source ?? '').trim();
  let match;

  if ((match = text.match(/^draw\s+clear\s+(transparent|#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/))) {
    return normalizePatchPaintCommand({ operation: 'clear', color: match[1] });
  }

  if ((match = text.match(/^draw\s+line\s+([^,]+)\s*,\s*([^\s]+)\s+to\s+([^,]+)\s*,\s*([^\s]+)\s+stroke\s+(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)\s+width\s+([^\s]+)$/))) {
    return normalizePatchPaintCommand({
      operation: 'line', x1: match[1], y1: match[2], x2: match[3], y2: match[4], stroke: match[5], strokeWidth: match[6]
    });
  }

  if ((match = text.match(/^draw\s+(rectangle|ellipse)\s+([^,]+)\s*,\s*([^\s]+)\s+size\s+([^,]+)\s*,\s*([^\s]+)\s+fill\s+(transparent|#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)\s+stroke\s+(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)\s+width\s+([^\s]+)$/))) {
    return normalizePatchPaintCommand({
      operation: match[1], x: match[2], y: match[3], width: match[4], height: match[5],
      fill: match[6], stroke: match[7], strokeWidth: match[8]
    });
  }

  if ((match = text.match(/^draw\s+text\s+(.+?)\s+at\s+([^,]+)\s*,\s*([^\s]+)\s+color\s+(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)\s+size\s+([^\s]+)$/))) {
    return normalizePatchPaintCommand({
      operation: 'text', textExpr: match[1], x: match[2], y: match[3], color: match[4], fontSize: match[5]
    });
  }

  throw new PatchPaintBoxError(
    `I do not understand PaintBox command '${text}'. Use draw clear, line, rectangle, ellipse or text.`,
    'PAINTBOX_SYNTAX'
  );
}

export function formatPatchPaintCommand(command) {
  const normalized = normalizePatchPaintCommand(command);
  switch (normalized.operation) {
    case 'clear':
      return `draw clear ${normalized.color}`;
    case 'line':
      return `draw line ${numberText(normalized.x1)}, ${numberText(normalized.y1)} to ${numberText(normalized.x2)}, ${numberText(normalized.y2)} stroke ${normalized.stroke} width ${numberText(normalized.strokeWidth)}`;
    case 'rectangle':
    case 'ellipse':
      return `draw ${normalized.operation} ${numberText(normalized.x)}, ${numberText(normalized.y)} size ${numberText(normalized.width)}, ${numberText(normalized.height)} fill ${normalized.fill} stroke ${normalized.stroke} width ${numberText(normalized.strokeWidth)}`;
    case 'text':
      return `draw text ${normalized.textExpr} at ${numberText(normalized.x)}, ${numberText(normalized.y)} color ${normalized.color} size ${numberText(normalized.fontSize)}`;
    default:
      throw new PatchPaintBoxError(`Cannot format PaintBox operation '${normalized.operation}'.`, 'PAINTBOX_FORMAT');
  }
}

export function validatePatchPaintBoxId(value) {
  const id = String(value ?? '').trim();
  if (!PATCH_NAME.test(id)) throw new PatchPaintBoxError(`'${id || '?'}' is not a valid PaintBox name.`, 'PAINTBOX_NAME');
  return id;
}

function freezeCommand(command) {
  return Object.freeze({ ...command });
}

function coordinate(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new PatchPaintBoxError(`PaintBox ${name} must be a finite number.`, 'PAINTBOX_COORDINATE');
  return number;
}

function positiveNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new PatchPaintBoxError(`PaintBox ${name} must be greater than zero.`, 'PAINTBOX_SIZE');
  return number;
}

function boundedNumber(value, name, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new PatchPaintBoxError(`PaintBox ${name} must be a finite number from ${min} to ${max}.`, 'PAINTBOX_RANGE');
  }
  return number;
}

function paintColor(value, name, allowTransparent) {
  const color = String(value ?? '').trim().toLowerCase();
  if (allowTransparent && color === 'transparent') return color;
  if (!HEX_COLOR.test(color)) {
    throw new PatchPaintBoxError(`PaintBox ${name} must be a six- or eight-digit hex color${allowTransparent ? ' or transparent' : ''}.`, 'PAINTBOX_COLOR');
  }
  return color;
}

function numberText(value) {
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(number);
}
