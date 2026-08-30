import { parse } from './parser.js?v=868f0784ca7f3972';
import { formatPatchButtonDeclaration, parseButtonImageBinding } from './button-image.js?v=868f0784ca7f3972';

export const PATCH_DESIGNER_PANEL_MODEL_VERSION = '0.1';
export const PANEL_CHILD_TYPES = Object.freeze([
  'text', 'button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider'
]);

export function listDesignerPanels(source, windowIndex = null) {
  const ast = parse(source);
  const panels = [];
  let formIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    let panelIndex = 0;
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' || child.control !== 'panel') continue;
      panels.push({
        windowIndex: formIndex,
        panelIndex,
        line: child.line,
        id: child.id,
        x: child.layout?.x ?? null,
        y: child.layout?.y ?? null,
        width: child.layout?.width ?? null,
        height: child.layout?.height ?? null,
        children: (child.body ?? []).map((nested, childIndex) => panelChild(nested, formIndex, panelIndex, childIndex))
      });
      panelIndex += 1;
    }
    formIndex += 1;
  }
  return Number.isInteger(windowIndex)
    ? panels.filter(panel => panel.windowIndex === windowIndex)
    : panels;
}

export function addDesignerPanelChild(source, selector, type) {
  if (!PANEL_CHILD_TYPES.includes(type)) {
    throw new Error(`Panel Stage 1 cannot add '${type}'. Use Text, Button, Input, Checkbox, Radio, ComboBox, ListBox or Slider.`);
  }
  const panel = findPanel(listDesignerPanels(source), selector);
  const lines = normalizeLines(source);
  const panelLine = panel.line - 1;
  const indent = `${indentOf(lines[panelLine])}  `;
  const declaration = makeChildDeclaration(lines, type);
  lines.splice(blockEnd(lines, panelLine), 0, `${indent}${declaration}`);
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  const updated = findPanel(listDesignerPanels(next), panel);
  return { source: next, child: updated.children.at(-1) };
}

export function updateDesignerPanelChild(source, selector, changes = {}) {
  const { panel, child } = findChild(listDesignerPanels(source), selector);
  const lines = normalizeLines(source);
  const lineIndex = child.line - 1;
  const indent = indentOf(lines[lineIndex]);
  const oldId = child.id;
  let id = oldId;
  if (child.type !== 'text' && Object.hasOwn(changes, 'id')) {
    id = validateId(changes.id);
    if (id !== oldId && sourceIdExists(lines, id, lineIndex)) {
      throw new Error(`Panel child id '${id}' is already used in this Patch project.`);
    }
  }

  let textExpr = child.textExpr;
  if (['text', 'button', 'checkbox'].includes(child.type) && Object.hasOwn(changes, 'textExpr')) {
    textExpr = requiredExpression(changes.textExpr, 'Panel child text expression');
  }

  let options = child.options;
  if (['radio', 'combo', 'listbox'].includes(child.type) && Object.hasOwn(changes, 'options')) {
    options = normalizeOptions(changes.options, child.type);
  }

  let min = child.min;
  let max = child.max;
  let step = child.step;
  if (child.type === 'slider') {
    min = finiteNumber(Object.hasOwn(changes, 'min') ? changes.min : min, 'Slider minimum');
    max = finiteNumber(Object.hasOwn(changes, 'max') ? changes.max : max, 'Slider maximum');
    step = finiteNumber(Object.hasOwn(changes, 'step') ? changes.step : step, 'Slider step');
    if (!(min < max)) throw new Error('Slider minimum must be smaller than its maximum.');
    if (!(step > 0)) throw new Error('Slider step must be greater than zero.');
  }

  let imageListId = child.imageListId;
  let imageItem = child.imageItem;
  if (child.type === 'button') {
    if (Object.hasOwn(changes, 'imageListId')) imageListId = changes.imageListId;
    if (Object.hasOwn(changes, 'imageItem')) imageItem = changes.imageItem;
    if (Object.hasOwn(changes, 'image')) {
      const binding = parseButtonImageBinding(changes.image);
      imageListId = binding?.imageListId ?? null;
      imageItem = binding?.imageItem ?? null;
    }
  }

  lines[lineIndex] = `${indent}${formatChild({ type: child.type, id, textExpr, options, min, max, step, imageListId, imageItem })}`;
  if (oldId && id !== oldId) renameEventHeaders(lines, oldId, id);
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  const nextPanel = findPanel(listDesignerPanels(next), panel);
  return { source: next, child: nextPanel.children.find(item => item.id === id) ?? nextPanel.children[child.childIndex] ?? null };
}

export function moveDesignerPanelChild(source, selector, direction) {
  if (!['earlier', 'later'].includes(direction)) throw new Error(`Unknown Panel child move '${direction}'.`);
  const { panel, child } = findChild(listDesignerPanels(source), selector);
  const targetIndex = child.childIndex + (direction === 'earlier' ? -1 : 1);
  if (targetIndex < 0 || targetIndex >= panel.children.length) return { source, moved: false, child };
  const target = panel.children[targetIndex];
  const lines = normalizeLines(source);
  const a = child.line - 1;
  const b = target.line - 1;
  [lines[a], lines[b]] = [lines[b], lines[a]];
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  const nextPanel = findPanel(listDesignerPanels(next), panel);
  const moved = child.id
    ? nextPanel.children.find(item => item.id === child.id)
    : nextPanel.children[targetIndex];
  return { source: next, moved: true, child: moved };
}

export function removeDesignerPanelChild(source, selector) {
  const { panel, child } = findChild(listDesignerPanels(source), selector);
  const lines = normalizeLines(source);
  lines.splice(child.line - 1, 1);
  if (child.id) removeEventBlocks(lines, child.id);
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  return next;
}

export function duplicateDesignerPanelChild(source, selector) {
  const { panel, child } = findChild(listDesignerPanels(source), selector);
  const lines = normalizeLines(source);
  const lineIndex = child.line - 1;
  let declaration = lines[lineIndex].trim();
  let nextId = null;
  if (child.id) {
    nextId = uniqueId(lines, child.id.replace(/_\d+$/, '') || child.type);
    declaration = replaceDeclarationId(declaration, child.id, nextId);
  }
  lines.splice(lineIndex + 1, 0, `${indentOf(lines[lineIndex])}${declaration}`);
  let next = preserveTrailingNewline(source, lines.join('\n'));
  if (child.id && nextId) next = duplicateEventBlock(next, child.id, nextId);
  parse(next);
  const nextPanel = findPanel(listDesignerPanels(next), panel);
  const duplicated = nextId
    ? nextPanel.children.find(item => item.id === nextId)
    : nextPanel.children[child.childIndex + 1];
  return { source: next, child: duplicated };
}

function panelChild(node, windowIndex, panelIndex, childIndex) {
  const item = {
    windowIndex,
    panelIndex,
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
  if (node.control === 'button' && (node.imageListId || node.imageItem)) {
    item.imageListId = node.imageListId ?? null;
    item.imageItem = node.imageItem ?? null;
  }
  return item;
}

function makeChildDeclaration(lines, type) {
  if (type === 'text') return 'text "Text"';
  if (type === 'button') return formatPatchButtonDeclaration({ id: uniqueId(lines, 'panel_button'), textExpr: '"Button"' });
  if (type === 'input') return `input ${uniqueId(lines, 'panel_input')}`;
  if (type === 'checkbox') return `checkbox "Checkbox" as ${uniqueId(lines, 'panel_checkbox')}`;
  if (type === 'radio') return `radio "Option 1", "Option 2", "Option 3" as ${uniqueId(lines, 'panel_radio')}`;
  if (type === 'combo') return `combo "Option 1", "Option 2", "Option 3" as ${uniqueId(lines, 'panel_combo')}`;
  if (type === 'listbox') return `listbox "Option 1", "Option 2", "Option 3" as ${uniqueId(lines, 'panel_listbox')}`;
  if (type === 'slider') return `slider 0..100 as ${uniqueId(lines, 'panel_slider')} step 1`;
  throw new Error(`Panel Stage 1 cannot add '${type}'.`);
}

function formatChild(child) {
  if (child.type === 'text') return `text ${child.textExpr}`;
  if (child.type === 'button') {
    return formatPatchButtonDeclaration({
      id: child.id,
      textExpr: child.textExpr,
      imageListId: child.imageListId,
      imageItem: child.imageItem
    });
  }
  if (child.type === 'input') return `input ${child.id}`;
  if (child.type === 'checkbox') return `checkbox ${child.textExpr} as ${child.id}`;
  if (child.type === 'radio') return `radio ${(child.options ?? []).join(', ')} as ${child.id}`;
  if (child.type === 'combo') return `combo ${(child.options ?? []).join(', ')} as ${child.id}`;
  if (child.type === 'listbox') return `listbox ${(child.options ?? []).join(', ')} as ${child.id}`;
  if (child.type === 'slider') return `slider ${formatNumber(child.min)}..${formatNumber(child.max)} as ${child.id} step ${formatNumber(child.step)}`;
  throw new Error(`Panel Designer cannot edit '${child.type}'.`);
}

function findPanel(panels, selector) {
  const windowIndex = Number(selector?.windowIndex ?? selector?.window ?? selector);
  const panelIndex = Number(selector?.panelIndex ?? 0);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(panelIndex)) throw new Error('Panel Designer selection is invalid.');
  const panel = panels.find(item => item.windowIndex === windowIndex && item.panelIndex === panelIndex);
  if (!panel) throw new Error('Panel Designer selection no longer exists in Patch source.');
  return panel;
}

function findChild(panels, selector) {
  const panel = findPanel(panels, selector);
  const childIndex = Number(selector?.childIndex);
  if (!Number.isInteger(childIndex)) throw new Error('Panel child selection is invalid.');
  const child = panel.children.find(item => item.childIndex === childIndex);
  if (!child) throw new Error('Panel child selection no longer exists in Patch source.');
  return { panel, child };
}

function normalizeOptions(value, type) {
  if (!Array.isArray(value)) throw new Error(`${type} options must be a list.`);
  const options = value.map(item => String(item ?? '').trim()).filter(Boolean);
  if (options.length < 2) throw new Error(`${type} needs at least two options.`);
  return options;
}

function requiredExpression(value, label) {
  const expression = String(value ?? '').trim();
  if (!expression) throw new Error(`${label} cannot be empty.`);
  return expression;
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
  return number;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(number);
}

function validateId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`'${id || '?'}' is not a valid Patch name.`);
  return id;
}

function uniqueId(lines, base) {
  const clean = validateId(base);
  if (!sourceIdExists(lines, clean)) return clean;
  let index = 1;
  while (sourceIdExists(lines, `${clean}_${index}`)) index += 1;
  return `${clean}_${index}`;
}

function sourceIdExists(lines, id, exceptLine = -1) {
  const pattern = new RegExp(`\\b(?:as\\s+)?${escapeRegExp(id)}\\b`);
  return lines.some((line, index) => index !== exceptLine && pattern.test(line));
}

function renameEventHeaders(lines, oldId, nextId) {
  const pattern = new RegExp(`^(\\s*)when\\s+${escapeRegExp(oldId)}\\s+(clicked|changed)\\s*:\\s*$`);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (match) lines[index] = `${match[1]}when ${nextId} ${match[2]}:`;
  }
}

function removeEventBlocks(lines, id) {
  const pattern = new RegExp(`^(\\s*)when\\s+${escapeRegExp(id)}\\s+(clicked|changed)\\s*:\\s*$`);
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

function duplicateEventBlock(source, oldId, nextId) {
  const lines = normalizeLines(source);
  const pattern = new RegExp(`^(\\s*)when\\s+${escapeRegExp(oldId)}\\s+(clicked|changed)\\s*:\\s*$`);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (!match) continue;
    const baseIndent = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    const block = lines.slice(index, end);
    block[0] = `${match[1]}when ${nextId} ${match[2]}:`;
    lines.splice(end, 0, '', ...block);
    break;
  }
  return preserveTrailingNewline(source, lines.join('\n'));
}

function replaceDeclarationId(text, oldId, nextId) {
  if (/^input\s+/.test(text)) return text.replace(new RegExp(`^(input\\s+)${escapeRegExp(oldId)}\\b`), `$1${nextId}`);
  return text.replace(new RegExp(`\\bas\\s+${escapeRegExp(oldId)}\\b`), `as ${nextId}`);
}

function blockEnd(lines, start) {
  const baseIndent = indentOf(lines[start]).length;
  let end = start + 1;
  while (end < lines.length) {
    if (!lines[end].trim()) { end += 1; continue; }
    if (indentOf(lines[end]).length <= baseIndent) break;
    end += 1;
  }
  return end;
}

function normalizeLines(source) {
  return String(source).replace(/\r\n/g, '\n').split('\n');
}

function indentOf(line) {
  return String(line ?? '').match(/^\s*/)?.[0] ?? '';
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /(?:\r?\n)$/.test(String(original));
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
