import { parse } from '../src/parser.js';
import { listDesignerControls, listDesignerWindows } from '../src/designer.js';

const LAYOUT_DIRECTIVE = /^\s*#\s*@layout\b/;

export function reorderDesignerControl(source, selector, direction) {
  const controls = listDesignerControls(source);
  const control = requireControl(controls, selector);
  const siblings = controls.filter(item => item.windowIndex === control.windowIndex);
  const index = siblings.findIndex(item => item.controlIndex === control.controlIndex);
  const nextIndex = targetIndex(index, siblings.length, direction);
  if (nextIndex === index) {
    return { source: String(source), moved: false, control };
  }

  const windows = listDesignerWindows(source);
  const window = windows.find(item => item.windowIndex === control.windowIndex);
  if (!window) throw new Error('Designer form selection no longer exists in Patch source.');

  const lines = normalizeLines(source);
  const ranges = siblings.map(item => controlSourceRange(lines, siblings, item));
  const blocks = ranges.map(range => lines.slice(range.start, range.end));
  const [moved] = blocks.splice(index, 1);
  blocks.splice(nextIndex, 0, moved);

  const bodyStart = ranges[0].start;
  const bodyEnd = ranges[ranges.length - 1].end;
  const nextLines = [...lines.slice(0, bodyStart), ...blocks.flat(), ...lines.slice(bodyEnd)];
  const next = validateAndPreserve(source, nextLines);
  const nextControl = listDesignerControls(next).find(item =>
    item.windowIndex === control.windowIndex && item.controlIndex === nextIndex
  );
  if (!nextControl) throw new Error('Reordered Designer control could not be resolved after source rewrite.');
  return { source: next, moved: true, control: nextControl };
}

export function snapDesignerGrid(value, size = 8) {
  const step = Number(size);
  const number = Number(value);
  if (!(step > 0) || !Number.isFinite(number)) return value;
  return Math.round(number / step) * step;
}

function targetIndex(index, length, direction) {
  if (direction === 'front') return length - 1;
  if (direction === 'back') return 0;
  if (direction === 'forward') return Math.min(length - 1, index + 1);
  if (direction === 'backward') return Math.max(0, index - 1);
  throw new Error(`Unknown Designer z-order direction '${direction}'.`);
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

function controlSourceRange(lines, siblings, control) {
  const localIndex = siblings.findIndex(item => item.controlIndex === control.controlIndex);
  let start = control.line - 1;
  while (start > 0 && LAYOUT_DIRECTIVE.test(lines[start - 1] ?? '')) start -= 1;

  let end;
  if (localIndex + 1 < siblings.length) {
    end = siblings[localIndex + 1].line - 1;
    while (end > start && LAYOUT_DIRECTIVE.test(lines[end - 1] ?? '')) end -= 1;
  } else {
    const baseIndent = indentOf(lines[control.line - 1]).length;
    end = control.line;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
  }
  return { start, end };
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
