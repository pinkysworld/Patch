import { parse } from '../src/parser.js';
import {
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl
} from '../src/designer.js';

export function duplicateDesignerControl(source, selector, options = {}) {
  const controls = listDesignerControls(source);
  const control = requireControl(controls, selector);
  const windows = listDesignerWindows(source);
  const window = windows.find(item => item.windowIndex === control.windowIndex);
  if (!window) throw new Error('Designer form selection no longer exists in Patch source.');

  const ast = parse(String(source));
  const astControl = requireAstControl(ast, control.windowIndex, control.controlIndex);
  const lines = normalizeLines(source);
  const windowControls = controls.filter(item => item.windowIndex === control.windowIndex);
  const localIndex = windowControls.findIndex(item => item.controlIndex === control.controlIndex);
  const start = control.line - 1;
  const end = localIndex + 1 < windowControls.length
    ? windowControls[localIndex + 1].line - 1
    : blockEnd(lines, window.line - 1);
  const copied = lines.slice(start, end);
  const usedIds = new Set(collectAllControlIds(ast));
  const idMap = new Map();
  const duplicatedHandlers = [];

  for (const record of collectControlIdRecords(astControl)) {
    const nextId = uniqueId(controlPrefix(record.type), usedIds);
    idMap.set(record.id, nextId);
    const relativeLine = record.line - 1 - start;
    rewriteControlIdAt(copied, relativeLine, record, nextId);
    for (const event of eventBlocksForId(lines, record.id)) {
      duplicatedHandlers.push(rewriteEventTarget(event.lines, record.id, nextId));
    }
  }

  lines.splice(end, 0, ...copied);
  if (duplicatedHandlers.length) appendEventBlocks(lines, duplicatedHandlers);
  let next = validateAndPreserve(source, lines);
  let duplicate = listDesignerControls(next).find(item =>
    item.windowIndex === control.windowIndex && item.controlIndex === control.controlIndex + 1
  );
  if (!duplicate) throw new Error('Duplicated Designer control could not be resolved after source rewrite.');

  if (options.offset !== false && Number.isInteger(control.x) && Number.isInteger(control.y)) {
    const x = offsetAxis(control.x, control.width, window.width ?? 640, Number(options.offsetPixels) || 16);
    const y = offsetAxis(control.y, control.height, window.height ?? 420, Number(options.offsetPixels) || 16);
    if (x !== control.x || y !== control.y) {
      next = updateDesignerControl(next, duplicate, { x, y });
      duplicate = listDesignerControls(next).find(item =>
        item.windowIndex === control.windowIndex && item.controlIndex === control.controlIndex + 1
      ) ?? duplicate;
    }
  }

  return {
    source: next,
    control: duplicate,
    idMap: Object.fromEntries(idMap)
  };
}

function requireControl(controls, selector) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer selection is invalid.');
  }
  const control = controls.find(item =>
    item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex
  );
  if (!control) throw new Error('Designer control selection no longer exists in Patch source.');
  return control;
}

function requireAstControl(ast, windowIndex, controlIndex) {
  let currentWindow = 0;
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    if (currentWindow === windowIndex) {
      let currentControl = 0;
      for (const child of node.body ?? []) {
        if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
        if (currentControl === controlIndex) return child;
        currentControl += 1;
      }
    }
    currentWindow += 1;
  }
  throw new Error('Designer control selection no longer matches Patch AST.');
}

function collectControlIdRecords(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) {
    out.push({
      id: node.id,
      line: node.line,
      type: node.kind === 'tabs' ? 'tabs' : node.control
    });
  }
  if (node.kind === 'tabs') {
    for (const page of node.body ?? []) {
      for (const child of page.body ?? []) collectControlIdRecords(child, out);
    }
  }
  if (node.kind === 'uiControl' && node.control === 'panel') {
    for (const child of node.body ?? []) collectControlIdRecords(child, out);
  }
  return out;
}

function collectAllControlIds(ast, out = []) {
  for (const node of ast ?? []) {
    if (node.kind === 'window') collectNodeIds(node.body, out);
  }
  return out;
}

function collectNodeIds(nodes = [], out = []) {
  for (const node of nodes ?? []) {
    if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) out.push(node.id);
    if (node.kind === 'tabs') {
      for (const page of node.body ?? []) collectNodeIds(page.body, out);
    }
    if (node.kind === 'uiControl' && node.control === 'panel') collectNodeIds(node.body, out);
  }
  return out;
}

function rewriteControlIdAt(lines, index, record, newId) {
  const line = lines[index];
  if (typeof line !== 'string') throw new Error('Control source line could not be located safely.');
  const oldId = escapeRegExp(record.id);
  if (record.type === 'input') {
    const pattern = new RegExp(`^(\\s*input\\s+)${oldId}(\\b)`);
    if (!pattern.test(line)) throw new Error('Input id could not be rewritten safely.');
    lines[index] = line.replace(pattern, `$1${newId}$2`);
    return;
  }
  const pattern = new RegExp(`\\bas\\s+${oldId}\\b`);
  if (!pattern.test(line)) throw new Error('Control id could not be rewritten safely.');
  lines[index] = line.replace(pattern, `as ${newId}`);
}

function eventBlocksForId(lines, id) {
  const escaped = escapeRegExp(id);
  const header = new RegExp(`^(\\s*)when\\s+${escaped}\\s+([^:\\s]+)\\s*:\\s*$`);
  const out = [];
  for (let index = 0; index < lines.length;) {
    const match = lines[index].match(header);
    if (!match) { index += 1; continue; }
    const baseIndent = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    out.push({ lines: lines.slice(index, end) });
    index = end;
  }
  return out;
}

function rewriteEventTarget(lines, oldId, newId) {
  const next = [...lines];
  const pattern = new RegExp(`^(\\s*when\\s+)${escapeRegExp(oldId)}(\\s+)`);
  if (!pattern.test(next[0] ?? '')) throw new Error('Control event handler could not be duplicated safely.');
  next[0] = next[0].replace(pattern, `$1${newId}$2`);
  return next;
}

function appendEventBlocks(lines, blocks) {
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  for (const block of blocks) {
    lines.push('', ...block);
    while (lines.length && !lines.at(-1).trim()) lines.pop();
  }
}

function offsetAxis(position, size, limit, offset) {
  if (!Number.isInteger(position)) return position;
  const delta = Math.max(1, Math.round(Math.abs(offset || 16)));
  const extent = Number.isInteger(size) && size > 0 ? size : 0;
  const maximum = Math.max(0, Math.round(Number(limit) || 0) - extent);
  if (position + delta <= maximum) return position + delta;
  if (position - delta >= 0) return position - delta;
  return Math.max(0, Math.min(maximum, position));
}

function controlPrefix(type) {
  return type || 'control';
}

function uniqueId(prefix, usedIds) {
  let index = 1;
  let candidate = `${prefix}_${index}`;
  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function blockEnd(lines, lineIndex) {
  const baseIndent = indentOf(lines[lineIndex]).length;
  let end = lineIndex + 1;
  while (end < lines.length) {
    if (!lines[end].trim()) { end += 1; continue; }
    if (indentOf(lines[end]).length <= baseIndent) break;
    end += 1;
  }
  return end;
}

function validateAndPreserve(original, lines) {
  const text = preserveTrailingNewline(original, lines.join('\n'));
  parse(text);
  return text;
}

function normalizeLines(source) {
  return String(source).replace(/\r\n/g, '\n').split('\n');
}

function indentOf(line) {
  return line.match(/^\s*/)?.[0] ?? '';
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /(?:\r?\n)$/.test(String(original));
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
