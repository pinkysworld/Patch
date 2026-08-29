import { parse } from './src/parser.js?v=9ad29318e93c7c71';
import { listDesignerTabPages } from './src/designer-data.js?v=9ad29318e93c7c71';
import { listDesignerTabPageControls } from './src/designer-tabs-nested.js?v=9ad29318e93c7c71';

export function duplicateDesignerTabPage(source, selector, pageIndex) {
  const pages = listDesignerTabPages(source, selector);
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error('Tab page selection is invalid.');
  }

  const controls = listDesignerTabPageControls(source, selector, pageIndex);
  if (!controls.length) throw new Error('A tab page needs at least one control.');
  const lines = normalizeLines(source);
  const start = pages[pageIndex].line - 1;
  const end = pageIndex + 1 < pages.length
    ? pages[pageIndex + 1].line - 1
    : pageBlockEnd(lines, start);
  const copied = lines.slice(start, end);
  const usedIds = new Set(collectAllControlIds(parse(String(source))));
  const idMap = new Map();
  const duplicatedHandlers = [];

  for (const control of controls) {
    if (!control.id) continue;
    const nextId = uniqueId(controlPrefix(control.type), usedIds);
    idMap.set(control.id, nextId);
    const relativeLine = control.line - 1 - start;
    rewriteControlIdAt(copied, relativeLine, control, nextId);
    for (const event of eventBlocksForId(lines, control.id)) {
      duplicatedHandlers.push(rewriteEventTarget(event.lines, control.id, nextId));
    }
  }

  lines.splice(end, 0, ...copied);
  if (duplicatedHandlers.length) appendEventBlocks(lines, duplicatedHandlers);
  const next = validateAndPreserve(source, lines);
  return {
    source: next,
    pageIndex: pageIndex + 1,
    idMap: Object.fromEntries(idMap)
  };
}

function rewriteControlIdAt(lines, index, control, newId) {
  const line = lines[index];
  if (typeof line !== 'string') throw new Error('Nested control source line could not be located safely.');
  const oldId = escapeRegExp(control.id);
  if (control.type === 'input') {
    const pattern = new RegExp(`^(\\s*input\\s+)${oldId}(\\b)`);
    if (!pattern.test(line)) throw new Error('Nested Input id could not be rewritten safely.');
    lines[index] = line.replace(pattern, `$1${newId}$2`);
    return;
  }
  const pattern = new RegExp(`\\bas\\s+${oldId}\\b`);
  if (!pattern.test(line)) throw new Error('Nested control id could not be rewritten safely.');
  lines[index] = line.replace(pattern, `as ${newId}`);
}

function pageBlockEnd(lines, pageLineIndex) {
  const baseIndent = indentOf(lines[pageLineIndex]).length;
  let end = pageLineIndex + 1;
  while (end < lines.length) {
    if (!lines[end].trim()) { end += 1; continue; }
    if (indentOf(lines[end]).length <= baseIndent) break;
    end += 1;
  }
  return end;
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
  if (!pattern.test(next[0] ?? '')) throw new Error('Nested control event handler could not be duplicated safely.');
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

function collectAllControlIds(ast, out = []) {
  for (const node of ast ?? []) {
    if (node.kind === 'window') collectNodeIds(node.body, out);
  }
  return out;
}

function collectNodeIds(nodes = [], out = []) {
  for (const node of nodes ?? []) {
    if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) out.push(node.id);
    if (node.kind === 'tabs') for (const page of node.body ?? []) collectNodeIds(page.body, out);
  }
  return out;
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
