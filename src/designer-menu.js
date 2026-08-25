import { parse } from './parser.js';

export const PATCH_DESIGNER_MENU_MODEL_VERSION = '0.1';

export function listDesignerMenus(source, windowIndex = null) {
  const ast = parse(source);
  const menus = [];
  let formIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    let menuIndex = 0;
    for (const child of node.body ?? []) {
      if (child.kind !== 'menu') continue;
      const menu = {
        windowIndex: formIndex,
        menuIndex,
        line: child.line,
        titleExpr: child.titleExpr,
        entries: (child.body ?? []).map((entry, entryIndex) => ({
          windowIndex: formIndex,
          menuIndex,
          entryIndex,
          line: entry.line,
          kind: entry.kind === 'menuSeparator' ? 'separator' : 'item',
          id: entry.id ?? null,
          textExpr: entry.textExpr ?? null,
          enabledState: entry.enabledState ?? null,
          checkedState: entry.checkedState ?? null,
          shortcutExpr: entry.shortcutExpr ?? null
        }))
      };
      menus.push(menu);
      menuIndex += 1;
    }
    formIndex += 1;
  }
  return Number.isInteger(windowIndex)
    ? menus.filter(menu => menu.windowIndex === windowIndex)
    : menus;
}

export function addDesignerMenu(source, windowIndex = 0, options = {}) {
  const normalized = String(source).replace(/\r\n/g, '\n');
  const ast = parse(normalized);
  const windows = ast.filter(node => node.kind === 'window');
  const window = windows[windowIndex];
  if (!window) throw new Error(`Menu Designer cannot find Form ${windowIndex + 1}.`);

  const menus = listDesignerMenus(normalized, windowIndex);
  const lines = normalizeLines(normalized);
  const windowLine = window.line - 1;
  const windowIndent = indentOf(lines[windowLine]);
  const menuIndent = `${windowIndent}  `;
  const itemIndent = `${menuIndent}  `;
  const titleExpr = cleanExpression(options.titleExpr ?? JSON.stringify(menus.length === 0 ? 'File' : `Menu ${menus.length + 1}`), 'Menu caption');
  const id = uniqueId(lines, options.id ?? 'menu_item');
  const textExpr = cleanExpression(options.textExpr ?? JSON.stringify('New item'), 'Menu item caption');
  const block = [
    `${menuIndent}menu ${titleExpr}:`,
    `${itemIndent}${formatMenuItem({ id, textExpr })}`
  ];

  let insertAt = windowLine + 1;
  if (menus.length) {
    const last = menus.at(-1);
    insertAt = blockEnd(lines, last.line - 1);
  }
  lines.splice(insertAt, 0, ...block);
  const next = tidy(lines.join('\n'));
  parse(next);
  return { source: next, menu: listDesignerMenus(next, windowIndex).at(-1) };
}

export function updateDesignerMenu(source, selector, changes = {}) {
  const menu = findMenu(listDesignerMenus(source), selector);
  const lines = normalizeLines(source);
  const lineIndex = menu.line - 1;
  const indent = indentOf(lines[lineIndex]);
  const titleExpr = Object.hasOwn(changes, 'titleExpr')
    ? cleanExpression(changes.titleExpr, 'Menu caption')
    : menu.titleExpr;
  lines[lineIndex] = `${indent}menu ${titleExpr}:`;
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  return next;
}

export function addDesignerMenuItem(source, selector, options = {}) {
  const menu = findMenu(listDesignerMenus(source), selector);
  const lines = normalizeLines(source);
  const menuLine = menu.line - 1;
  const indent = `${indentOf(lines[menuLine])}  `;
  const textExpr = cleanExpression(options.textExpr ?? JSON.stringify('New item'), 'Menu item caption');
  const id = uniqueId(lines, options.id ?? 'menu_item');
  const item = {
    id,
    textExpr,
    enabledState: optionalId(options.enabledState, 'enabled state'),
    checkedState: optionalId(options.checkedState, 'checked state'),
    shortcutExpr: optionalExpression(options.shortcutExpr)
  };
  lines.splice(blockEnd(lines, menuLine), 0, `${indent}${formatMenuItem(item)}`);
  const next = tidy(lines.join('\n'));
  parse(next);
  const updated = findMenu(listDesignerMenus(next), selector);
  return { source: next, item: updated.entries.at(-1) };
}

export function updateDesignerMenuItem(source, selector, changes = {}) {
  const menus = listDesignerMenus(source);
  const { menu, entry } = findEntry(menus, selector);
  if (entry.kind !== 'item') throw new Error('A menu separator has no editable item properties.');
  const lines = normalizeLines(source);
  const lineIndex = entry.line - 1;
  const indent = indentOf(lines[lineIndex]);
  const id = Object.hasOwn(changes, 'id') ? validateId(changes.id) : entry.id;
  if (id !== entry.id && sourceIdExists(lines, id, lineIndex)) {
    throw new Error(`Menu item id '${id}' is already used in this Patch project.`);
  }
  const textExpr = Object.hasOwn(changes, 'textExpr')
    ? cleanExpression(changes.textExpr, 'Menu item caption')
    : entry.textExpr;
  const enabledState = Object.hasOwn(changes, 'enabledState')
    ? optionalId(changes.enabledState, 'enabled state')
    : entry.enabledState;
  const checkedState = Object.hasOwn(changes, 'checkedState')
    ? optionalId(changes.checkedState, 'checked state')
    : entry.checkedState;
  const shortcutExpr = Object.hasOwn(changes, 'shortcutExpr')
    ? optionalExpression(changes.shortcutExpr)
    : entry.shortcutExpr;

  lines[lineIndex] = `${indent}${formatMenuItem({ id, textExpr, enabledState, checkedState, shortcutExpr })}`;
  if (entry.id && id !== entry.id) renameClickedHandler(lines, entry.id, id);
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  const nextMenu = findMenu(listDesignerMenus(next), menu);
  return { source: next, item: nextMenu.entries.find(item => item.id === id) ?? null };
}

export function insertDesignerMenuSeparator(source, selector, afterEntryIndex) {
  const menu = findMenu(listDesignerMenus(source), selector);
  const index = Number(afterEntryIndex);
  if (!Number.isInteger(index) || index < 0 || index >= menu.entries.length - 1) {
    throw new Error('Select an item that has another clickable item after it.');
  }
  const before = menu.entries[index];
  const after = menu.entries[index + 1];
  if (before.kind !== 'item' || after.kind !== 'item') {
    throw new Error('A separator can only be inserted between two clickable items.');
  }
  const lines = normalizeLines(source);
  const insertAt = after.line - 1;
  lines.splice(insertAt, 0, `${indentOf(lines[before.line - 1])}separator`);
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  return next;
}

export function moveDesignerMenuItem(source, selector, direction) {
  const { menu, entry } = findEntry(listDesignerMenus(source), selector);
  if (entry.kind !== 'item') return { source, moved: false };
  if (!['earlier', 'later'].includes(direction)) throw new Error(`Unknown Menu Designer move '${direction}'.`);
  const clickable = menu.entries.filter(item => item.kind === 'item');
  const current = clickable.findIndex(item => item.entryIndex === entry.entryIndex);
  const targetIndex = current + (direction === 'earlier' ? -1 : 1);
  if (current < 0 || targetIndex < 0 || targetIndex >= clickable.length) return { source, moved: false };
  const target = clickable[targetIndex];
  const lines = normalizeLines(source);
  const a = entry.line - 1;
  const b = target.line - 1;
  [lines[a], lines[b]] = [lines[b], lines[a]];
  const next = preserveTrailingNewline(source, lines.join('\n'));
  parse(next);
  const nextMenu = findMenu(listDesignerMenus(next), menu);
  const moved = nextMenu.entries.find(item => item.kind === 'item' && item.id === entry.id) ?? null;
  return { source: next, moved: true, item: moved };
}

export function removeDesignerMenuEntry(source, selector) {
  const { menu, entry } = findEntry(listDesignerMenus(source), selector);
  const lines = normalizeLines(source);
  if (entry.kind === 'separator') {
    lines.splice(entry.line - 1, 1);
  } else {
    const clickable = menu.entries.filter(item => item.kind === 'item');
    if (clickable.length <= 1) throw new Error('A menu needs at least one clickable item. Delete the menu instead.');
    const previous = menu.entries[entry.entryIndex - 1] ?? null;
    const nextEntry = menu.entries[entry.entryIndex + 1] ?? null;
    const removeLines = [entry.line - 1];
    if (previous?.kind === 'separator') removeLines.push(previous.line - 1);
    else if (nextEntry?.kind === 'separator') removeLines.push(nextEntry.line - 1);
    removeLines.sort((a, b) => b - a).forEach(index => lines.splice(index, 1));
    if (entry.id) removeClickedHandler(lines, entry.id);
  }
  const next = tidy(lines.join('\n'));
  parse(next);
  return next;
}

export function removeDesignerMenu(source, selector) {
  const menu = findMenu(listDesignerMenus(source), selector);
  const lines = normalizeLines(source);
  const start = menu.line - 1;
  const end = blockEnd(lines, start);
  lines.splice(start, end - start);
  for (const entry of menu.entries) {
    if (entry.kind === 'item' && entry.id) removeClickedHandler(lines, entry.id);
  }
  const next = tidy(lines.join('\n'));
  parse(next);
  return next;
}

export function ensureDesignerMenuItemHandler(source, selector) {
  const { entry } = findEntry(listDesignerMenus(source), selector);
  if (entry.kind !== 'item' || !entry.id) throw new Error('Menu Designer needs a named clickable item for an OnClick handler.');
  const existing = findClickedHandler(source, entry.id);
  if (existing) return { source, created: false, handler: existing };
  const suffix = /\n$/.test(String(source)) ? '' : '\n';
  const next = `${source}${suffix}\nwhen ${entry.id} clicked:\n  show ${JSON.stringify(`${entry.id} clicked`)}\n`;
  parse(next);
  return { source: next, created: true, handler: findClickedHandler(next, entry.id) };
}

export function findClickedHandler(source, id) {
  const escaped = escapeRegExp(validateId(id));
  const pattern = new RegExp(`^\\s*when\\s+${escaped}\\s+clicked\\s*:\\s*$`, 'm');
  const match = pattern.exec(String(source));
  if (!match) return null;
  const before = String(source).slice(0, match.index);
  return {
    line: before.split('\n').length,
    start: match.index + match[0].search(/\S/),
    end: match.index + match[0].length,
    id
  };
}

function findMenu(menus, selector) {
  const windowIndex = Number(selector?.windowIndex ?? selector?.window ?? selector);
  const menuIndex = Number(selector?.menuIndex ?? 0);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(menuIndex)) throw new Error('Menu Designer selection is invalid.');
  const menu = menus.find(item => item.windowIndex === windowIndex && item.menuIndex === menuIndex);
  if (!menu) throw new Error('Menu Designer selection no longer exists in Patch source.');
  return menu;
}

function findEntry(menus, selector) {
  const menu = findMenu(menus, selector);
  const entryIndex = Number(selector?.entryIndex);
  if (!Number.isInteger(entryIndex)) throw new Error('Menu Designer item selection is invalid.');
  const entry = menu.entries.find(item => item.entryIndex === entryIndex);
  if (!entry) throw new Error('Menu Designer item selection no longer exists in Patch source.');
  return { menu, entry };
}

function formatMenuItem(item) {
  const parts = [`item ${item.textExpr} as ${item.id}`];
  if (item.enabledState) parts.push(`enabled ${item.enabledState}`);
  if (item.checkedState) parts.push(`checked ${item.checkedState}`);
  if (item.shortcutExpr) parts.push(`shortcut ${item.shortcutExpr}`);
  return parts.join(' ');
}

function cleanExpression(value, label) {
  const expression = String(value ?? '').trim();
  if (!expression) throw new Error(`${label} cannot be empty.`);
  return expression;
}

function optionalExpression(value) {
  const expression = String(value ?? '').trim();
  return expression || null;
}

function optionalId(value, label) {
  const id = String(value ?? '').trim();
  if (!id) return null;
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`Menu item ${label} '${id}' is not a valid Patch name.`);
  return id;
}

function validateId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`'${id || '?'}' is not a valid Patch name.`);
  return id;
}

function uniqueId(lines, preferred) {
  const base = validateId(preferred);
  if (!sourceIdExists(lines, base)) return base;
  let index = 1;
  while (sourceIdExists(lines, `${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function sourceIdExists(lines, id, exceptLine = -1) {
  const pattern = new RegExp(`\\bas\\s+${escapeRegExp(id)}\\b`);
  return lines.some((line, index) => index !== exceptLine && pattern.test(line));
}

function renameClickedHandler(lines, oldId, nextId) {
  const pattern = new RegExp(`^(\\s*)when\\s+${escapeRegExp(oldId)}\\s+clicked\\s*:\\s*$`);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (match) lines[index] = `${match[1]}when ${nextId} clicked:`;
  }
}

function removeClickedHandler(lines, id) {
  const pattern = new RegExp(`^(\\s*)when\\s+${escapeRegExp(id)}\\s+clicked\\s*:\\s*$`);
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

function tidy(text) {
  return text.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
