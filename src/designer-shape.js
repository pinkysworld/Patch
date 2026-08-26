import { parse } from './parser.js';
import {
  addDesignerWindow,
  listDesignerControls,
  listDesignerWindows,
  removeDesignerControl,
  updateDesignerWindow
} from './designer.js';
import { formControlDefaultSize } from './form-layout.js';
import { formatPatchShapeDeclaration, parsePatchShapeDeclaration } from './shape-source.js';

export const PATCH_DESIGNER_SHAPE_VERSION = '0.1';

const DEFAULT_WINDOW = Object.freeze({ width: 640, height: 420 });
const MARGIN = 24;
const GAP = 12;

export function listDesignerShapes(source) {
  const normalized = String(source ?? '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  return listDesignerControls(normalized)
    .filter(control => control.type === 'shape')
    .map(control => {
      const line = lines[control.line - 1] ?? '';
      const core = stripLayout(line.trim());
      const shape = parsePatchShapeDeclaration(core);
      return Object.freeze({
        ...control,
        shapeKind: shape.kind,
        fill: shape.fill,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth,
        cornerRadius: shape.cornerRadius,
        opacity: shape.opacity
      });
    });
}

export function addDesignerShape(source, options = {}) {
  let normalized = String(source ?? '').replace(/\r\n/g, '\n');
  let windows = listDesignerWindows(normalized);
  if (!windows.length) {
    normalized = addDesignerWindow(normalized, { titleExpr: '"My App"' });
    windows = listDesignerWindows(normalized);
  }

  const windowIndex = Number.isInteger(options.windowIndex) ? options.windowIndex : 0;
  let target = windows.find(window => window.windowIndex === windowIndex);
  if (!target) throw new Error(`Designer cannot find form ${windowIndex + 1}.`);

  const controls = listDesignerControls(normalized);
  const existing = controls.filter(control => control.windowIndex === windowIndex);
  const layout = nextShapeLayout(existing, options);
  const requiredHeight = layout.y + layout.height + MARGIN;
  if (requiredHeight > (target.height ?? DEFAULT_WINDOW.height)) {
    const changes = {
      titleExpr: target.titleExpr,
      width: target.width ?? DEFAULT_WINDOW.width,
      height: requiredHeight
    };
    if (target.id) changes.id = target.id;
    normalized = updateDesignerWindow(normalized, windowIndex, changes);
    windows = listDesignerWindows(normalized);
    target = windows.find(window => window.windowIndex === windowIndex);
  }

  const id = options.id === undefined ? nextShapeId(listDesignerControls(normalized)) : validId(options.id);
  if (listDesignerControls(normalized).some(control => control.id === id)) {
    throw new Error(`Control id '${id}' is already used in this Patch window project.`);
  }
  const declaration = formatPatchShapeDeclaration({
    id,
    kind: options.shapeKind ?? options.kind,
    fill: options.fill,
    stroke: options.stroke,
    strokeWidth: options.strokeWidth,
    cornerRadius: options.cornerRadius,
    opacity: options.opacity
  });
  const next = insertIntoWindow(normalized, target, `${declaration} at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}`);
  parse(next);
  const shape = listDesignerShapes(next).find(item => item.windowIndex === windowIndex && item.id === id);
  if (!shape) throw new Error('Designer created a Shape but could not locate it in Patch source.');
  return Object.freeze({ source: next, shape });
}

export function updateDesignerShape(source, selector, changes = {}) {
  const shapes = listDesignerShapes(source);
  const current = findShape(shapes, selector);
  const allControls = listDesignerControls(source);
  const id = Object.hasOwn(changes, 'id') ? validId(changes.id) : current.id;
  if (id !== current.id && allControls.some(control => control.id === id)) {
    throw new Error(`Control id '${id}' is already used in this Patch window project.`);
  }

  const declaration = formatPatchShapeDeclaration({
    id,
    kind: Object.hasOwn(changes, 'shapeKind') ? changes.shapeKind : current.shapeKind,
    fill: Object.hasOwn(changes, 'fill') ? changes.fill : current.fill,
    stroke: Object.hasOwn(changes, 'stroke') ? changes.stroke : current.stroke,
    strokeWidth: Object.hasOwn(changes, 'strokeWidth') ? changes.strokeWidth : current.strokeWidth,
    cornerRadius: Object.hasOwn(changes, 'cornerRadius') ? changes.cornerRadius : current.cornerRadius,
    opacity: Object.hasOwn(changes, 'opacity') ? changes.opacity : current.opacity
  });
  const layout = shapeLayout(current, changes);
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const index = current.line - 1;
  if (index < 0 || index >= lines.length) throw new Error('Designer Shape selection no longer matches Patch source.');
  const indent = lines[index].match(/^\s*/)?.[0] ?? '';
  lines[index] = `${indent}${declaration}${layout ? ` at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}` : ''}`;
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  const shape = listDesignerShapes(next).find(item => item.windowIndex === current.windowIndex && item.id === id);
  if (!shape) throw new Error('Designer updated a Shape but could not locate it in Patch source.');
  return Object.freeze({ source: next, shape });
}

export function removeDesignerShape(source, selector) {
  const current = findShape(listDesignerShapes(source), selector);
  return removeDesignerControl(source, current);
}

function nextShapeLayout(existing, options) {
  const defaults = formControlDefaultSize('shape');
  let y = MARGIN;
  let visualIndex = 0;
  for (const control of existing) {
    if (control.type === 'timer') continue;
    const currentDefaults = formControlDefaultSize(control.type);
    const currentY = control.y ?? (MARGIN + visualIndex * 48);
    const currentHeight = control.height ?? currentDefaults.height;
    y = Math.max(y, currentY + currentHeight + GAP);
    visualIndex += 1;
  }
  return {
    x: coordinate(options.x ?? MARGIN, 'x'),
    y: coordinate(options.y ?? y, 'y'),
    width: dimension(options.width ?? defaults.width, 'width'),
    height: dimension(options.height ?? defaults.height, 'height')
  };
}

function shapeLayout(current, changes) {
  const touched = ['x', 'y', 'width', 'height'].some(key => Object.hasOwn(changes, key));
  const existing = current.x !== null || current.y !== null || current.width !== null || current.height !== null;
  if (!touched && !existing) return null;
  const defaults = formControlDefaultSize('shape');
  return {
    x: coordinate(Object.hasOwn(changes, 'x') ? changes.x : (current.x ?? MARGIN), 'x'),
    y: coordinate(Object.hasOwn(changes, 'y') ? changes.y : (current.y ?? MARGIN), 'y'),
    width: dimension(Object.hasOwn(changes, 'width') ? changes.width : (current.width ?? defaults.width), 'width'),
    height: dimension(Object.hasOwn(changes, 'height') ? changes.height : (current.height ?? defaults.height), 'height')
  };
}

function insertIntoWindow(source, window, controlLine) {
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const windowLine = window.line - 1;
  if (windowLine < 0 || windowLine >= lines.length) throw new Error('Designer form selection no longer matches Patch source.');
  const baseIndent = indentOf(lines[windowLine]);
  const childIndent = `${baseIndent}  `;
  let insertAt = windowLine + 1;
  let scan = insertAt;
  while (scan < lines.length) {
    const line = lines[scan];
    if (!line.trim()) { scan += 1; continue; }
    if (indentOf(line).length <= baseIndent.length) break;
    insertAt = scan + 1;
    scan += 1;
  }
  lines.splice(insertAt, 0, `${childIndent}${controlLine}`);
  return tidy(lines.join('\n'));
}

function findShape(shapes, selector) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer Shape selection is invalid.');
  }
  const shape = shapes.find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);
  if (!shape) throw new Error('Designer Shape selection no longer exists in Patch source.');
  return shape;
}

function nextShapeId(controls) {
  const used = new Set(controls.map(control => control.id).filter(Boolean));
  for (let index = 1; index < 100000; index += 1) {
    const id = `shape_${index}`;
    if (!used.has(id)) return id;
  }
  throw new Error('Designer could not allocate a Shape id.');
}

function validId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`'${id || '?'}' is not a valid Patch name.`);
  return id;
}

function stripLayout(line) {
  return String(line).replace(/\s+at\s+-?\d+\s*,\s*-?\d+(?:\s+size\s+\d+\s*,\s*\d+)?\s*$/, '');
}

function coordinate(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`Shape ${name} must be a whole number zero or greater.`);
  return number;
}

function dimension(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 16) throw new Error(`Shape ${name} must be a whole number of at least 16.`);
  return number;
}

function indentOf(line) {
  return String(line).match(/^\s*/)?.[0] ?? '';
}

function preserveTrailingNewline(original, next) {
  return /\n$/.test(String(original ?? '')) ? `${next.replace(/\n+$/, '')}\n` : next;
}

function tidy(source) {
  return `${String(source).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '')}\n`;
}
