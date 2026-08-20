import { parse } from '../src/parser.js';
import { listDesignerWindows } from '../src/designer.js';

export function removeDesignerForm(source, windowIndex) {
  const windows = listDesignerWindows(source);
  if (!Number.isInteger(windowIndex) || windowIndex < 0 || windowIndex >= windows.length) {
    throw new Error('Designer Form selection is invalid.');
  }
  if (windows.length <= 1) throw new Error('Patch Studio keeps at least one Form in a Window project.');

  const ast = parse(String(source));
  const windowNode = requireWindowAst(ast, windowIndex);
  const controlIds = collectWindowControlIds(windowNode);
  const lines = normalizeLines(source);
  const start = windows[windowIndex].line - 1;
  const end = blockEnd(lines, start);
  lines.splice(start, end - start);

  for (const id of controlIds) removeEventBlocks(lines, id);

  const next = validateAndPreserve(source, lines);
  const nextWindows = listDesignerWindows(next);
  const nextWindowIndex = Math.max(0, Math.min(windowIndex, nextWindows.length - 1));
  return { source: next, windowIndex: nextWindowIndex, removedControlIds: [...controlIds] };
}

function requireWindowAst(ast, windowIndex) {
  let current = 0;
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    if (current === windowIndex) return node;
    current += 1;
  }
  throw new Error('Designer Form selection no longer matches Patch AST.');
}

function collectWindowControlIds(windowNode) {
  const ids = [];
  for (const node of windowNode.body ?? []) collectControlIds(node, ids);
  return ids;
}

function collectControlIds(node, out) {
  if (!node || typeof node !== 'object') return;
  if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) out.push(node.id);
  if (node.kind === 'tabs') {
    for (const page of node.body ?? []) {
      for (const child of page.body ?? []) collectControlIds(child, out);
    }
  }
}

function removeEventBlocks(lines, id) {
  const header = new RegExp(`^(\\s*)when\\s+${escapeRegExp(id)}\\s+([^:\\s]+)\\s*:\\s*$`);
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
    lines.splice(index, end - index);
  }
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
