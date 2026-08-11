import { parse } from './parser.js';

const DEFAULT_WINDOW = { width: 640, height: 420 };
const CONTROL_DEFAULTS = {
  text: { width: 200, height: 30 },
  button: { width: 120, height: 36 },
  input: { width: 220, height: 36 },
  checkbox: { width: 220, height: 36 },
  radio: { width: 220, height: 84 },
  combo: { width: 220, height: 36 },
  listbox: { width: 220, height: 120 },
  tabs: { width: 420, height: 240 }
};

export function addDesignerWindow(source, options = {}) {
  const lines = normalizeLines(source);
  if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
  const windows = listDesignerWindows(source);
  const titleExpr = String(options.titleExpr ?? JSON.stringify(`Form ${windows.length + 1}`)).trim();
  if (!titleExpr) throw new Error('Window title expression cannot be empty.');
  const width = windowDimension(options.width ?? DEFAULT_WINDOW.width, 'width');
  const height = windowDimension(options.height ?? DEFAULT_WINDOW.height, 'height');
  const id = Object.hasOwn(options, 'id') ? validateId(options.id) : nextFormId(lines);
  if (windows.some(item => item.id === id)) throw new Error(`Form name '${id}' is already used.`);
  lines.push(`window ${titleExpr} as ${id} size ${width}, ${height}:`);
  return tidy(lines.join('\n'));
}

export function listDesignerWindows(source) {
  const ast = parse(source);
  const windows = [];
  let windowIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    windows.push({
      windowIndex,
      line: node.line,
      id: node.id ?? null,
      titleExpr: node.titleExpr,
      width: node.width ?? null,
      height: node.height ?? null
    });
    windowIndex += 1;
  }
  return windows;
}

export function updateDesignerWindow(source, selector, changes = {}) {
  const windows = listDesignerWindows(source);
  const window = findWindow(windows, selector);
  const lines = normalizeLines(source);
  const lineIndex = window.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) throw new Error('Designer window selection no longer matches Patch source.');
  const indent = indentOf(lines[lineIndex]);
  const titleExpr = Object.hasOwn(changes, 'titleExpr') ? String(changes.titleExpr ?? '').trim() : window.titleExpr;
  if (!titleExpr) throw new Error('Window title expression cannot be empty.');
  const width = windowDimension(Object.hasOwn(changes, 'width') ? changes.width : (window.width ?? DEFAULT_WINDOW.width), 'width');
  const height = windowDimension(Object.hasOwn(changes, 'height') ? changes.height : (window.height ?? DEFAULT_WINDOW.height), 'height');
  let id = window.id;
  if (Object.hasOwn(changes, 'id')) {
    id = validateId(changes.id);
    if (id !== window.id && windows.some(item => item.id === id)) throw new Error(`Form name '${id}' is already used.`);
  }
  const idPart = id ? ` as ${id}` : '';
  lines[lineIndex] = `${indent}window ${titleExpr}${idPart} size ${width}, ${height}:`;
  if (window.id && id && window.id !== id) renameFormActions(lines, window.id, id);
  return preserveTrailingNewline(source, lines.join('\n'));
}

export function addDesignerControl(source, type, options = {}) {
  let normalized = String(source).replace(/\r\n/g, '\n');
  let windows = listDesignerWindows(normalized);
  if (!windows.length) {
    normalized = addDesignerWindow(normalized, { titleExpr: '"My App"' });
    windows = listDesignerWindows(normalized);
  }

  const requestedWindow = Number.isInteger(options.windowIndex) ? options.windowIndex : 0;
  const targetWindow = windows.find(item => item.windowIndex === requestedWindow);
  if (!targetWindow) throw new Error(`Designer cannot find form ${requestedWindow + 1}.`);

  const lines = normalizeLines(normalized);
  const windowIndex = targetWindow.line - 1;
  const baseIndent = indentOf(lines[windowIndex]);
  const childIndent = `${baseIndent}  `;
  let insertAt = windowIndex + 1;
  let scan = insertAt;
  while (scan < lines.length) {
    const line = lines[scan];
    if (!line.trim()) { scan += 1; continue; }
    if (indentOf(line).length <= baseIndent.length) break;
    insertAt = scan + 1;
    scan += 1;
  }

  const existing = listDesignerControls(normalized).filter(item => item.windowIndex === requestedWindow);
  if (type === 'tabs') {
    const defaults = CONTROL_DEFAULTS.tabs;
    const layout = { x: 24, y: 24 + (existing.length * 48), width: defaults.width, height: defaults.height };
    const id = nextId(lines, 'tabs');
    lines.splice(insertAt, 0,
      `${childIndent}${formatControl('tabs', id, null, layout)}`,
      `${childIndent}  tab "General":`,
      `${childIndent}    text "General"`,
      `${childIndent}  tab "Advanced":`,
      `${childIndent}    text "Advanced"`
    );
    return tidy(lines.join('\n'));
  }

  const control = makeControl(type, lines, existing.length);
  lines.splice(insertAt, 0, `${childIndent}${control}`);
  return tidy(lines.join('\n'));
}

export function listDesignerControls(source) {
  const ast = parse(source);
  const controls = [];
  let windowIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    let controlIndex = 0;
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
      controls.push({
        windowIndex,
        controlIndex,
        line: child.line,
        type: child.kind === 'tabs' ? 'tabs' : child.control,
        id: child.id ?? null,
        textExpr: child.textExpr ?? null,
        options: Array.isArray(child.options) ? [...child.options] : null,
        pages: child.kind === 'tabs' ? (child.body ?? []).map(page => page.titleExpr) : null,
        x: child.layout?.x ?? null,
        y: child.layout?.y ?? null,
        width: child.layout?.width ?? null,
        height: child.layout?.height ?? null
      });
      controlIndex += 1;
    }
    windowIndex += 1;
  }
  return controls;
}

export function updateDesignerControl(source, selector, changes = {}) {
  const controls = listDesignerControls(source);
  const control = findControl(controls, selector);
  const lines = normalizeLines(source);
  const lineIndex = control.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) throw new Error('Designer selection no longer matches Patch source.');

  const oldId = control.id;
  let nextId = oldId;
  if (control.type !== 'text' && Object.hasOwn(changes, 'id')) {
    nextId = validateId(changes.id);
    if (nextId !== oldId && controls.some(item => item.id === nextId)) {
      throw new Error(`Control id '${nextId}' is already used in this Patch window project.`);
    }
  }

  let nextTextExpr = control.textExpr;
  if (['text', 'button', 'checkbox'].includes(control.type) && Object.hasOwn(changes, 'textExpr')) {
    nextTextExpr = String(changes.textExpr ?? '').trim();
    if (!nextTextExpr) throw new Error('Text expression cannot be empty.');
  }

  let nextOptions = control.options;
  if (['combo', 'listbox', 'radio'].includes(control.type) && Object.hasOwn(changes, 'options')) {
    const label = control.type === 'radio' ? 'radio group' : control.type;
    if (!Array.isArray(changes.options) || changes.options.length < 2) throw new Error(`A ${label} needs at least two options.`);
    nextOptions = changes.options.map(option => String(option ?? '').trim()).filter(Boolean);
    if (nextOptions.length < 2) throw new Error(`A ${label} needs at least two options.`);
  }

  const layout = normalizeControlLayout(control, changes);
  const indent = indentOf(lines[lineIndex]);
  lines[lineIndex] = `${indent}${formatControl(control.type, nextId, nextTextExpr, layout, nextOptions)}`;

  if (oldId && nextId !== oldId && control.type !== 'tabs') renameEventHeaders(lines, oldId, nextId);
  return preserveTrailingNewline(source, lines.join('\n'));
}

export function removeDesignerControl(source, selector) {
  const controls = listDesignerControls(source);
  const control = findControl(controls, selector);
  const lines = normalizeLines(source);
  const lineIndex = control.line - 1;
  if (control.type === 'tabs') {
    const baseIndent = indentOf(lines[lineIndex]).length;
    let end = lineIndex + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    lines.splice(lineIndex, end - lineIndex);
  } else {
    lines.splice(lineIndex, 1);
    if (control.id) removeEventBlocks(lines, control.id);
  }
  return tidy(lines.join('\n'));
}

export function renameDesignerButton(source, id, newText) {
  const control = listDesignerControls(source).find(item => item.type === 'button' && item.id === id);
  if (!control) throw new Error(`Cannot find button '${id}' in Patch source.`);
  return updateDesignerControl(source, control, { textExpr: JSON.stringify(String(newText)) });
}

function findWindow(windows, selector) {
  const windowIndex = Number.isInteger(selector) ? selector : selector?.windowIndex;
  if (!Number.isInteger(windowIndex)) throw new Error('Designer window selection is invalid.');
  const window = windows.find(item => item.windowIndex === windowIndex);
  if (!window) throw new Error('Designer window selection no longer exists in Patch source.');
  return window;
}

function findControl(controls, selector) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer selection is invalid.');
  }
  const control = controls.find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);
  if (!control) throw new Error('Designer window selection no longer exists in Patch source.');
  return control;
}

function validateId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`'${id || '?'}' is not a valid Patch name.`);
  return id;
}

function normalizeControlLayout(control, changes) {
  const defaults = CONTROL_DEFAULTS[control.type] ?? { width: 120, height: 36 };
  const touched = ['x','y','width','height'].some(key => Object.hasOwn(changes, key));
  const existing = control.x !== null || control.y !== null || control.width !== null || control.height !== null;
  if (!touched && !existing) return null;
  return {
    x: coordinate(Object.hasOwn(changes, 'x') ? changes.x : (control.x ?? 24), 'x'),
    y: coordinate(Object.hasOwn(changes, 'y') ? changes.y : (control.y ?? 24), 'y'),
    width: controlDimension(Object.hasOwn(changes, 'width') ? changes.width : (control.width ?? defaults.width), 'width'),
    height: controlDimension(Object.hasOwn(changes, 'height') ? changes.height : (control.height ?? defaults.height), 'height')
  };
}

function coordinate(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`Control ${name} must be a whole number zero or greater.`);
  return number;
}

function controlDimension(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 16) throw new Error(`Control ${name} must be a whole number of at least 16.`);
  return number;
}

function windowDimension(value, name) {
  const number = Number(value);
  const minimum = name === 'width' ? 120 : 80;
  if (!Number.isInteger(number) || number < minimum) throw new Error(`Window ${name} must be a whole number of at least ${minimum}.`);
  return number;
}

function renameEventHeaders(lines, oldId, nextId) {
  const escapedId = escapeRegExp(oldId);
  const pattern = new RegExp(`^(\\s*)when\\s+${escapedId}\\s+(clicked|changed|closed)\\s*:\\s*$`);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(pattern);
    if (match) lines[i] = `${match[1]}when ${nextId} ${match[2]}:`;
  }
}

function renameFormActions(lines, oldId, nextId) {
  const escapedId = escapeRegExp(oldId);
  const pattern = new RegExp(`^(\\s*)(open|close)\\s+${escapedId}\\s*$`);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(pattern);
    if (match) lines[i] = `${match[1]}${match[2]} ${nextId}`;
  }
}

function removeEventBlocks(lines, id) {
  const escapedId = escapeRegExp(id);
  const pattern = new RegExp(`^(\\s*)when\\s+${escapedId}\\s+(clicked|changed|closed)\\s*:\\s*$`);
  for (let i = 0; i < lines.length;) {
    const match = lines[i].match(pattern);
    if (!match) { i += 1; continue; }
    const baseIndent = match[1].length;
    let end = i + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    lines.splice(i, end - i);
  }
}

function makeControl(type, lines, index) {
  const defaults = CONTROL_DEFAULTS[type];
  if (!defaults) throw new Error(`Designer cannot add '${type}' yet.`);
  const layout = { x: 24, y: 24 + (index * 48), width: defaults.width, height: defaults.height };
  if (type === 'text') return formatControl(type, null, '"Text"', layout);
  if (type === 'button') return formatControl(type, nextId(lines, 'button'), '"Button"', layout);
  if (type === 'input') return formatControl(type, nextId(lines, 'input'), null, layout);
  if (type === 'checkbox') return formatControl(type, nextId(lines, 'checkbox'), '"Checkbox"', layout);
  if (type === 'radio') return formatControl(type, nextId(lines, 'radio'), null, layout, ['"Option 1"', '"Option 2"', '"Option 3"']);
  if (type === 'combo') return formatControl(type, nextId(lines, 'combo'), null, layout, ['"Option 1"', '"Option 2"', '"Option 3"']);
  if (type === 'listbox') return formatControl(type, nextId(lines, 'listbox'), null, layout, ['"Option 1"', '"Option 2"', '"Option 3"']);
  throw new Error(`Designer cannot add '${type}' yet.`);
}

function formatControl(type, id, textExpr, layout, options = null) {
  let core;
  if (type === 'text') core = `text ${textExpr}`;
  else if (type === 'button') core = `button ${textExpr} as ${id}`;
  else if (type === 'input') core = `input ${id}`;
  else if (type === 'checkbox') core = `checkbox ${textExpr} as ${id}`;
  else if (type === 'radio') core = `radio ${(options ?? []).join(', ')} as ${id}`;
  else if (type === 'combo') core = `combo ${(options ?? []).join(', ')} as ${id}`;
  else if (type === 'listbox') core = `listbox ${(options ?? []).join(', ')} as ${id}`;
  else if (type === 'tabs') core = `tabs as ${id}`;
  else throw new Error(`Designer cannot edit '${type}' controls yet.`);
  if (!layout) return type === 'tabs' ? `${core}:` : core;
  const positioned = `${core} at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}`;
  return type === 'tabs' ? `${positioned}:` : positioned;
}

function nextId(lines, base) {
  const text = lines.join('\n');
  let i = 1;
  while (new RegExp(`\\b${base}_${i}\\b`).test(text)) i++;
  return `${base}_${i}`;
}

function nextFormId(lines) {
  const text = lines.join('\n');
  let i = 1;
  while (new RegExp(`\\bas\\s+form_${i}\\b`).test(text)) i++;
  return `form_${i}`;
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

function tidy(text) {
  return text.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
