import { parse } from './parser.js';

export function addDesignerControl(source, type) {
  const normalized = source.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let windowIndex = lines.findIndex(line => /^\s*window\s+".*"\s*:\s*$/.test(line));

  if (windowIndex < 0) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    windowIndex = lines.length;
    lines.push('window "My App":');
  }

  const baseIndent = indentOf(lines[windowIndex]);
  const childIndent = `${baseIndent}  `;
  let insertAt = windowIndex + 1;
  while (insertAt < lines.length) {
    const line = lines[insertAt];
    if (!line.trim()) { insertAt++; continue; }
    if (indentOf(line).length <= baseIndent.length) break;
    insertAt++;
  }

  const control = makeControl(type, lines);
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
      if (child.kind !== 'uiControl') continue;
      controls.push({
        windowIndex,
        controlIndex,
        line: child.line,
        type: child.control,
        id: child.id ?? null,
        textExpr: child.textExpr ?? null
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
  if (control.type !== 'input' && Object.hasOwn(changes, 'textExpr')) {
    nextTextExpr = String(changes.textExpr ?? '').trim();
    if (!nextTextExpr) throw new Error('Text expression cannot be empty.');
  }

  const indent = indentOf(lines[lineIndex]);
  if (control.type === 'text') lines[lineIndex] = `${indent}text ${nextTextExpr}`;
  else if (control.type === 'button') lines[lineIndex] = `${indent}button ${nextTextExpr} as ${nextId}`;
  else if (control.type === 'input') lines[lineIndex] = `${indent}input ${nextId}`;
  else throw new Error(`Designer cannot edit '${control.type}' controls yet.`);

  if (oldId && nextId !== oldId) renameEventHeaders(lines, oldId, nextId);
  return preserveTrailingNewline(source, lines.join('\n'));
}

export function removeDesignerControl(source, selector) {
  const controls = listDesignerControls(source);
  const control = findControl(controls, selector);
  const lines = normalizeLines(source);
  lines.splice(control.line - 1, 1);
  if (control.id) removeEventBlocks(lines, control.id);
  return tidy(lines.join('\n'));
}

export function renameDesignerButton(source, id, newText) {
  const control = listDesignerControls(source).find(item => item.type === 'button' && item.id === id);
  if (!control) throw new Error(`Cannot find button '${id}' in Patch source.`);
  return updateDesignerControl(source, control, { textExpr: JSON.stringify(String(newText)) });
}

function findControl(controls, selector) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer selection is invalid.');
  }
  const control = controls.find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);
  if (!control) throw new Error('Designer selection no longer exists in Patch source.');
  return control;
}

function validateId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`'${id || '?'}' is not a valid Patch control id.`);
  return id;
}

function renameEventHeaders(lines, oldId, nextId) {
  const escapedId = escapeRegExp(oldId);
  const pattern = new RegExp(`^(\\s*)when\\s+${escapedId}\\s+(clicked|changed|closed)\\s*:\\s*$`);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(pattern);
    if (match) lines[i] = `${match[1]}when ${nextId} ${match[2]}:`;
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

function makeControl(type, lines) {
  if (type === 'text') return 'text "Text"';
  if (type === 'button') return `button "Button" as ${nextId(lines, 'button')}`;
  if (type === 'input') return `input ${nextId(lines, 'input')}`;
  throw new Error(`Designer cannot add '${type}' yet.`);
}

function nextId(lines, base) {
  const text = lines.join('\n');
  let i = 1;
  while (new RegExp(`\\b${base}_${i}\\b`).test(text)) i++;
  return `${base}_${i}`;
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
