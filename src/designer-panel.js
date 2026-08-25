import { parse } from './parser.js';
import {
  addDesignerWindow,
  listDesignerControls,
  listDesignerWindows,
  updateDesignerWindow
} from './designer.js';
import { formControlDefaultSize } from './form-layout.js';

export const PATCH_DESIGNER_PANEL_VERSION = '0.1';
export const DESIGNER_PANEL_CHILD_TYPES = Object.freeze([
  'text', 'button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider'
]);

const DEFAULT_WINDOW = Object.freeze({ width: 640, height: 420 });
const PANEL_DEFAULT = Object.freeze({ width: 280, height: 160 });
const CONTROL_MARGIN = 24;
const CONTROL_GAP = 12;

export function listDesignerPanels(source) {
  const ast = parse(source);
  const panels = [];
  let windowIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    let controlIndex = 0;
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
      if (child.kind === 'uiControl' && child.control === 'panel') {
        panels.push({
          windowIndex,
          controlIndex,
          line: child.line,
          id: child.id ?? null,
          x: child.layout?.x ?? null,
          y: child.layout?.y ?? null,
          width: child.layout?.width ?? null,
          height: child.layout?.height ?? null,
          children: (child.body ?? []).map((nested, childIndex) => panelChildModel(nested, childIndex))
        });
      }
      controlIndex += 1;
    }
    windowIndex += 1;
  }
  return panels;
}

export function addDesignerPanel(source, options = {}) {
  let normalized = normalizeSource(source);
  let windows = listDesignerWindows(normalized);
  if (!windows.length) {
    normalized = addDesignerWindow(normalized, { titleExpr: '"My App"' });
    windows = listDesignerWindows(normalized);
  }

  const windowIndex = Number.isInteger(options.windowIndex) ? options.windowIndex : 0;
  let target = windows.find(item => item.windowIndex === windowIndex);
  if (!target) throw new Error(`Designer cannot find form ${windowIndex + 1}.`);

  const existing = listDesignerControls(normalized).filter(control => control.windowIndex === windowIndex);
  const layout = nextPanelLayout(existing);
  const currentHeight = target.height ?? DEFAULT_WINDOW.height;
  const requiredHeight = layout.y + layout.height + CONTROL_MARGIN;
  if (requiredHeight > currentHeight) {
    normalized = updateDesignerWindow(normalized, windowIndex, {
      ...(target.id ? { id: target.id } : {}),
      titleExpr: target.titleExpr,
      width: target.width ?? DEFAULT_WINDOW.width,
      height: requiredHeight
    });
    target = listDesignerWindows(normalized).find(item => item.windowIndex === windowIndex);
  }

  const lines = linesOf(normalized);
  const windowLineIndex = target.line - 1;
  const baseIndent = indentOf(lines[windowLineIndex]);
  const childIndent = `${baseIndent}  `;
  const id = nextId(lines, 'panel');
  let insertAt = windowBlockEnd(lines, windowLineIndex);

  const statusbar = listDesignerControls(normalized)
    .find(control => control.windowIndex === windowIndex && control.type === 'statusbar');
  if (statusbar) {
    insertAt = statusbar.line - 1;
    if (insertAt > windowLineIndex && /^\s*#\s*@layout\b/.test(lines[insertAt - 1] ?? '')) insertAt -= 1;
  }

  lines.splice(insertAt, 0,
    `${childIndent}panel as ${id} at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}:`
  );
  const next = tidy(lines.join('\n'));
  parse(next);
  const panel = listDesignerPanels(next).find(item => item.windowIndex === windowIndex && item.id === id);
  if (!panel) throw new Error('Designer created a Panel but could not locate it in Patch source.');
  return { source: next, panel };
}

export function updateDesignerPanel(source, selector, changes = {}) {
  const panel = findPanel(source, selector);
  const lines = linesOf(source);
  const lineIndex = panel.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) throw new Error('Panel selection no longer matches Patch source.');

  const id = Object.hasOwn(changes, 'id') ? validateId(changes.id) : panel.id;
  if (!id) throw new Error('Panel needs a Patch id.');
  if (id !== panel.id && idExistsOutsideLine(lines, id, lineIndex)) {
    throw new Error(`Control id '${id}' is already used in this Patch window project.`);
  }

  const x = coordinate(Object.hasOwn(changes, 'x') ? changes.x : (panel.x ?? CONTROL_MARGIN), 'x');
  const y = coordinate(Object.hasOwn(changes, 'y') ? changes.y : (panel.y ?? CONTROL_MARGIN), 'y');
  const width = dimension(Object.hasOwn(changes, 'width') ? changes.width : (panel.width ?? PANEL_DEFAULT.width), 'width');
  const height = dimension(Object.hasOwn(changes, 'height') ? changes.height : (panel.height ?? PANEL_DEFAULT.height), 'height');
  const indent = indentOf(lines[lineIndex]);
  lines[lineIndex] = `${indent}panel as ${id} at ${x}, ${y} size ${width}, ${height}:`;
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  return next;
}

export function removeDesignerPanel(source, selector) {
  const panel = findPanel(source, selector);
  const lines = linesOf(source);
  const lineIndex = panel.line - 1;
  const baseIndent = indentOf(lines[lineIndex]).length;
  let end = lineIndex + 1;
  while (end < lines.length) {
    if (!lines[end].trim()) { end += 1; continue; }
    if (indentOf(lines[end]).length <= baseIndent) break;
    end += 1;
  }
  const childIds = panel.children.map(child => child.id).filter(Boolean);
  const directive = layoutDirectiveBefore(lines, lineIndex);
  const start = directive >= 0 ? directive : lineIndex;
  lines.splice(start, end - start);
  for (const id of childIds) removeEventBlocks(lines, id);
  const next = tidy(lines.join('\n'));
  parse(next);
  return next;
}

export function addDesignerPanelChild(source, selector, type) {
  const normalizedType = String(type ?? '').toLowerCase();
  if (!DESIGNER_PANEL_CHILD_TYPES.includes(normalizedType)) {
    throw new Error(`Panel Stage 1 cannot add '${type}'. Choose ${DESIGNER_PANEL_CHILD_TYPES.join(', ')}.`);
  }
  const panel = findPanel(source, selector);
  const lines = linesOf(source);
  const panelLine = panel.line - 1;
  const panelIndent = indentOf(lines[panelLine]);
  const childIndent = `${panelIndent}  `;
  const insertAt = panelBlockEnd(lines, panelLine);
  const control = makePanelChild(normalizedType, lines);
  lines.splice(insertAt, 0, `${childIndent}${control}`);
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  return {
    source: next,
    panel: findPanel(next, { windowIndex: panel.windowIndex, controlIndex: panel.controlIndex })
  };
}

export function removeDesignerPanelChild(source, selector, childIndex) {
  const panel = findPanel(source, selector);
  const index = childSelection(childIndex, panel.children.length);
  const child = panel.children[index];
  const lines = linesOf(source);
  lines.splice(child.line - 1, 1);
  if (child.id) removeEventBlocks(lines, child.id);
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  return {
    source: next,
    panel: findPanel(next, { windowIndex: panel.windowIndex, controlIndex: panel.controlIndex })
  };
}

export function moveDesignerPanelChild(source, selector, childIndex, direction) {
  const panel = findPanel(source, selector);
  const index = childSelection(childIndex, panel.children.length);
  const delta = direction === 'earlier' ? -1 : direction === 'later' ? 1 : 0;
  if (!delta) throw new Error("Panel child direction must be 'earlier' or 'later'.");
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= panel.children.length) return { source, panel, moved: false };

  const lines = linesOf(source);
  const a = panel.children[index].line - 1;
  const b = panel.children[targetIndex].line - 1;
  [lines[a], lines[b]] = [lines[b], lines[a]];
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  return {
    source: next,
    panel: findPanel(next, { windowIndex: panel.windowIndex, controlIndex: panel.controlIndex }),
    moved: true
  };
}

function findPanel(source, selector) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Panel selection is invalid.');
  }
  const panel = listDesignerPanels(source).find(item =>
    item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex
  );
  if (!panel) throw new Error('Panel selection no longer exists in Patch source.');
  return panel;
}

function panelChildModel(node, childIndex) {
  return {
    childIndex,
    line: node.line,
    type: node.control,
    id: node.id ?? null,
    textExpr: node.textExpr ?? null,
    options: Array.isArray(node.options) ? [...node.options] : null,
    min: node.control === 'slider' ? node.min : null,
    max: node.control === 'slider' ? node.max : null,
    step: node.control === 'slider' ? node.step : null
  };
}

function nextPanelLayout(existing) {
  let y = CONTROL_MARGIN;
  let visualIndex = 0;
  for (const control of existing) {
    if (control.type === 'timer' || control.type === 'statusbar') continue;
    const defaults = formControlDefaultSize(control.type);
    const currentY = control.y ?? (CONTROL_MARGIN + visualIndex * 48);
    const currentHeight = control.height ?? defaults.height;
    y = Math.max(y, currentY + currentHeight + CONTROL_GAP);
    visualIndex += 1;
  }
  return { x: CONTROL_MARGIN, y, width: PANEL_DEFAULT.width, height: PANEL_DEFAULT.height };
}

function makePanelChild(type, lines) {
  if (type === 'text') return 'text "Text"';
  if (type === 'button') return `button "Button" as ${nextId(lines, 'button')}`;
  if (type === 'input') return `input ${nextId(lines, 'input')}`;
  if (type === 'checkbox') return `checkbox "Checkbox" as ${nextId(lines, 'checkbox')}`;
  if (type === 'radio') return `radio "Option 1", "Option 2", "Option 3" as ${nextId(lines, 'radio')}`;
  if (type === 'combo') return `combo "Option 1", "Option 2", "Option 3" as ${nextId(lines, 'combo')}`;
  if (type === 'listbox') return `listbox "Option 1", "Option 2", "Option 3" as ${nextId(lines, 'listbox')}`;
  if (type === 'slider') return `slider 0..100 as ${nextId(lines, 'slider')} step 1`;
  throw new Error(`Panel Stage 1 cannot add '${type}'.`);
}

function windowBlockEnd(lines, windowLineIndex) {
  const baseIndent = indentOf(lines[windowLineIndex]).length;
  let end = windowLineIndex + 1;
  while (end < lines.length) {
    if (!lines[end].trim()) { end += 1; continue; }
    if (indentOf(lines[end]).length <= baseIndent) break;
    end += 1;
  }
  return end;
}

function panelBlockEnd(lines, panelLineIndex) {
  const baseIndent = indentOf(lines[panelLineIndex]).length;
  let end = panelLineIndex + 1;
  while (end < lines.length) {
    if (!lines[end].trim()) { end += 1; continue; }
    if (indentOf(lines[end]).length <= baseIndent) break;
    end += 1;
  }
  return end;
}

function layoutDirectiveBefore(lines, lineIndex) {
  let index = lineIndex - 1;
  while (index >= 0 && !lines[index].trim()) index -= 1;
  return index >= 0 && /^\s*#\s*@layout\b/.test(lines[index]) ? index : -1;
}

function removeEventBlocks(lines, id) {
  const escaped = escapeRegExp(id);
  const pattern = new RegExp(`^(\\s*)when\\s+${escaped}\\s+(clicked|changed|closed|ticked)\\s*:\\s*$`);
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
}

function idExistsOutsideLine(lines, id, excludedLine) {
  const escaped = escapeRegExp(id);
  const pattern = new RegExp(`\\b(?:as\\s+)?${escaped}\\b`);
  return lines.some((line, index) => index !== excludedLine && pattern.test(line));
}

function nextId(lines, base) {
  const text = lines.join('\n');
  let index = 1;
  while (new RegExp(`\\b${escapeRegExp(base)}_${index}\\b`).test(text)) index += 1;
  return `${base}_${index}`;
}

function childSelection(value, count) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error('Panel child selection is invalid.');
  return index;
}

function validateId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`'${id || '?'}' is not a valid Patch name.`);
  return id;
}

function coordinate(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`Panel ${name} must be a whole number zero or greater.`);
  return number;
}

function dimension(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 40) throw new Error(`Panel ${name} must be a whole number of at least 40.`);
  return number;
}

function normalizeSource(source) {
  return String(source).replace(/\r\n/g, '\n');
}

function linesOf(source) {
  return normalizeSource(source).split('\n');
}

function indentOf(line) {
  return String(line ?? '').match(/^\s*/)?.[0] ?? '';
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /(?:\r?\n)$/.test(String(original));
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}

function tidy(text) {
  return text.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
