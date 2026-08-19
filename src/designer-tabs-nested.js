import { parse } from './parser.js';
import { listDesignerControls } from './designer.js';

const SUPPORTED_TAB_CONTROLS = new Set(['text', 'button', 'input', 'checkbox', 'radio', 'combo', 'listbox']);

export function listDesignerTabPageControls(source, selector, pageIndex) {
  const { page } = requireTabsPage(source, selector, pageIndex);
  return (page.body ?? []).map((node, controlIndex) => ({
    controlIndex,
    line: node.line,
    type: node.control,
    id: node.id ?? null,
    textExpr: node.textExpr ?? null,
    options: Array.isArray(node.options) ? [...node.options] : []
  }));
}

export function addDesignerTabPageControl(source, selector, pageIndex, type) {
  const controlType = String(type ?? '').trim().toLowerCase();
  if (!SUPPORTED_TAB_CONTROLS.has(controlType)) {
    throw new Error(`Tabs Designer cannot add '${controlType || 'unknown'}' controls in this stage.`);
  }

  const { page, tabsNode, control, ast } = requireTabsPage(source, selector, pageIndex);
  const lines = normalizeLines(source);
  const insertAt = tabPageContentEnd(lines, control, tabsNode, pageIndex);
  const indent = `${indentOf(lines[page.line - 1])}  `;
  const ids = new Set(collectAllControlIds(ast));
  const line = formatNewNestedControl(controlType, ids);
  lines.splice(insertAt, 0, `${indent}${line}`);
  return validateAndPreserve(source, lines);
}

export function removeDesignerTabPageControl(source, selector, pageIndex, controlIndex) {
  const { page } = requireTabsPage(source, selector, pageIndex);
  const controls = page.body ?? [];
  if (controls.length <= 1) throw new Error('A tab page needs at least one control.');
  if (!Number.isInteger(controlIndex) || controlIndex < 0 || controlIndex >= controls.length) {
    throw new Error('Tab page control selection is invalid.');
  }

  const nested = controls[controlIndex];
  if (nested.kind !== 'uiControl' || !SUPPORTED_TAB_CONTROLS.has(nested.control)) {
    throw new Error('This nested control is outside the current Tabs Designer editing stage.');
  }

  const lines = normalizeLines(source);
  lines.splice(nested.line - 1, 1);
  if (nested.id) removeEventBlocksForIds(lines, [nested.id]);
  return validateAndPreserve(source, lines);
}

export function supportedDesignerTabControlTypes() {
  return [...SUPPORTED_TAB_CONTROLS];
}

function requireTabsPage(source, selector, pageIndex) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer selection is invalid.');
  }
  const selected = listDesignerControls(source).find(item =>
    item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex
  );
  if (!selected || selected.type !== 'tabs') throw new Error('Designer selection is not Tabs.');

  const ast = parse(source);
  let windowIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    if (windowIndex === selector.windowIndex) {
      let controlIndex = 0;
      for (const child of node.body ?? []) {
        if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
        if (controlIndex === selector.controlIndex) {
          if (child.kind !== 'tabs') throw new Error('Designer selection is not Tabs.');
          if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= (child.body ?? []).length) {
            throw new Error('Tab page selection is invalid.');
          }
          return { ast, control: selected, tabsNode: child, page: child.body[pageIndex] };
        }
        controlIndex += 1;
      }
    }
    windowIndex += 1;
  }
  throw new Error('Designer Tabs selection no longer matches Patch source.');
}

function tabPageContentEnd(lines, control, tabsNode, pageIndex) {
  const pages = tabsNode.body ?? [];
  if (pageIndex + 1 < pages.length) return pages[pageIndex + 1].line - 1;
  let end = controlBlockEnd(lines, control.line - 1);
  while (end > pages[pageIndex].line && !lines[end - 1].trim()) end -= 1;
  return end;
}

function formatNewNestedControl(type, usedIds) {
  if (type === 'text') return 'text "Text"';
  if (type === 'button') return `button "Button" as ${uniqueId('button', usedIds)}`;
  if (type === 'input') return `input ${uniqueId('input', usedIds)}`;
  if (type === 'checkbox') return `checkbox "Checkbox" as ${uniqueId('checkbox', usedIds)}`;
  if (type === 'radio') return `radio "One", "Two" as ${uniqueId('radio', usedIds)}`;
  if (type === 'combo') return `combo "One", "Two" as ${uniqueId('combo', usedIds)}`;
  if (type === 'listbox') return `listbox "One", "Two" as ${uniqueId('listbox', usedIds)}`;
  throw new Error(`Unsupported nested control '${type}'.`);
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
  }
  return out;
}

function removeEventBlocksForIds(lines, ids) {
  if (!ids?.length) return;
  const names = new Set(ids);
  for (let index = 0; index < lines.length;) {
    const match = lines[index].match(/^(\s*)when\s+([A-Za-z_]\w*)\s+([^:\s]+)\s*:\s*$/);
    if (!match || !names.has(match[2])) {
      index += 1;
      continue;
    }
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

function controlBlockEnd(lines, lineIndex) {
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
