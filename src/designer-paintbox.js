import { parse } from './parser.js';
import {
  addDesignerWindow,
  listDesignerControls,
  listDesignerWindows,
  removeDesignerControl,
  updateDesignerWindow
} from './designer.js';
import { formControlDefaultSize } from './form-layout.js';

export const PATCH_DESIGNER_PAINTBOX_VERSION = '0.1';

const DEFAULT_WINDOW = Object.freeze({ width: 640, height: 420 });
const MARGIN = 24;
const GAP = 12;

export function listDesignerPaintBoxes(source) {
  return listDesignerControls(source)
    .filter(control => control.type === 'paintbox')
    .map(control => Object.freeze({ ...control }));
}

export function addDesignerPaintBox(source, options = {}) {
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
  const layout = nextPaintBoxLayout(existing, options);
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

  const id = options.id === undefined ? nextPaintBoxId(listDesignerControls(normalized)) : validId(options.id);
  if (listDesignerControls(normalized).some(control => control.id === id)) {
    throw new Error(`Control id '${id}' is already used in this Patch window project.`);
  }

  const declaration = `paintbox as ${id} at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}`;
  const next = insertIntoWindow(normalized, target, declaration);
  parse(next);
  const paintbox = listDesignerPaintBoxes(next).find(item => item.windowIndex === windowIndex && item.id === id);
  if (!paintbox) throw new Error('Designer created a PaintBox but could not locate it in Patch source.');
  return Object.freeze({ source: next, paintbox });
}

export function updateDesignerPaintBox(source, selector, changes = {}) {
  const paintboxes = listDesignerPaintBoxes(source);
  const current = findPaintBox(paintboxes, selector);
  const controls = listDesignerControls(source);
  const id = Object.hasOwn(changes, 'id') ? validId(changes.id) : current.id;
  if (id !== current.id && controls.some(control => control.id === id)) {
    throw new Error(`Control id '${id}' is already used in this Patch window project.`);
  }

  const layout = paintBoxLayout(current, changes);
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const index = current.line - 1;
  if (index < 0 || index >= lines.length) throw new Error('Designer PaintBox selection no longer matches Patch source.');
  const indent = lines[index].match(/^\s*/)?.[0] ?? '';
  lines[index] = `${indent}paintbox as ${id}${layout ? ` at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}` : ''}`;
  if (id !== current.id) renamePaintEvent(lines, current.id, id);

  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  const paintbox = listDesignerPaintBoxes(next).find(item => item.windowIndex === current.windowIndex && item.id === id);
  if (!paintbox) throw new Error('Designer updated a PaintBox but could not locate it in Patch source.');
  return Object.freeze({ source: next, paintbox });
}

export function removeDesignerPaintBox(source, selector) {
  const current = findPaintBox(listDesignerPaintBoxes(source), selector);
  let next = removeDesignerControl(source, current);
  if (current.id) next = removePaintEvents(next, current.id);
  parse(next);
  return next;
}

function nextPaintBoxLayout(existing, options) {
  const defaults = formControlDefaultSize('paintbox');
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

function paintBoxLayout(current, changes) {
  const touched = ['x', 'y', 'width', 'height'].some(key => Object.hasOwn(changes, key));
  const existing = current.x !== null || current.y !== null || current.width !== null || current.height !== null;
  if (!touched && !existing) return null;
  const defaults = formControlDefaultSize('paintbox');
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

function renamePaintEvent(lines, oldId, nextId) {
  const pattern = new RegExp(`^(\\s*)when\\s+${escapeRegExp(oldId)}\\s+paint\\s*:\\s*$`);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (match) lines[index] = `${match[1]}when ${nextId} paint:`;
  }
}

function removePaintEvents(source, id) {
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const pattern = new RegExp(`^(\\s*)when\\s+${escapeRegExp(id)}\\s+paint\\s*:\\s*$`);
  for (let index = 0; index < lines.length;) {
    const match = lines[index].match(pattern);
    if (!match) { index += 1; continue; }
    const baseIndent = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    lines.splice(index, end - index);
  }
  return tidy(lines.join('\n'));
}

function findPaintBox(paintboxes, selector) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer PaintBox selection is invalid.');
  }
  const paintbox = paintboxes.find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);
  if (!paintbox) throw new Error('Designer PaintBox selection no longer exists in Patch source.');
  return paintbox;
}

function nextPaintBoxId(controls) {
  const used = new Set(controls.map(control => control.id).filter(Boolean));
  for (let index = 1; index < 100000; index += 1) {
    const id = `paintbox_${index}`;
    if (!used.has(id)) return id;
  }
  throw new Error('Designer could not allocate a PaintBox id.');
}

function validId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`'${id || '?'}' is not a valid Patch name.`);
  return id;
}

function coordinate(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`PaintBox ${name} must be a whole number zero or greater.`);
  return number;
}

function dimension(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 16) throw new Error(`PaintBox ${name} must be a whole number of at least 16.`);
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

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
