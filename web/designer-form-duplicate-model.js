import { parse } from '../src/parser.js';
import { listDesignerWindows } from '../src/designer.js';
import { listDesignerUiNamespace } from './designer-ui-namespace.js';

export function duplicateDesignerForm(source, windowIndex) {
  const windows = listDesignerWindows(source);
  if (!Number.isInteger(windowIndex) || windowIndex < 0 || windowIndex >= windows.length) {
    throw new Error('Designer Form selection is invalid.');
  }

  const ast = parse(String(source));
  const windowNode = requireWindowAst(ast, windowIndex);
  const window = windows[windowIndex];
  const lines = normalizeLines(source);
  const start = window.line - 1;
  const end = blockEnd(lines, start);
  const copied = lines.slice(start, end);
  const usedFormIds = new Set(windows.map(item => item.id).filter(Boolean));
  // Form duplication must reserve the same effective UI/event namespace used by
  // the Inspector: core/nested Controls, MenuItems and result-dialog targets.
  const usedUiIds = new Set(listDesignerUiNamespace(source).map(record => record.id));
  const controlIdMap = new Map();
  const duplicatedHandlers = [];
  let formId = window.id ?? null;

  if (window.id) {
    formId = uniqueId('form', usedFormIds);
    rewriteAsIdAt(copied, 0, window.id, formId, 'Form');
  }

  for (const record of collectWindowUiIdRecords(windowNode)) {
    const nextId = uniqueId(controlPrefix(record.type), usedUiIds);
    controlIdMap.set(record.id, nextId);
    const relativeLine = record.line - 1 - start;
    rewriteUiIdAt(copied, relativeLine, record, nextId);
    for (const event of eventBlocksForId(lines, record.id)) {
      duplicatedHandlers.push(rewriteEventTarget(event.lines, record.id, nextId));
    }
  }

  lines.splice(end, 0, ...copied);
  if (duplicatedHandlers.length) appendEventBlocks(lines, duplicatedHandlers);
  const next = validateAndPreserve(source, lines);
  const nextWindows = listDesignerWindows(next);
  const duplicate = nextWindows[windowIndex + 1];
  if (!duplicate) throw new Error('Duplicated Form could not be resolved after source rewrite.');

  return {
    source: next,
    windowIndex: windowIndex + 1,
    form: duplicate,
    formId,
    controlIdMap: Object.fromEntries(controlIdMap)
  };
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

function collectWindowUiIdRecords(windowNode, out = []) {
  for (const node of windowNode.body ?? []) collectUiIdRecords(node, out);
  return out;
}

function collectUiIdRecords(node, out) {
  if (!node || typeof node !== 'object') return out;
  if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) {
    out.push({
      id: node.id,
      line: node.line,
      type: node.kind === 'tabs' ? 'tabs' : node.control
    });
  } else if (node.kind === 'menu') {
    for (const item of node.body ?? []) {
      if (item.kind === 'menuItem' && item.id) {
        out.push({ id: item.id, line: item.line, type: 'menuItem' });
      }
    }
  }

  if (node.kind === 'tabs') {
    for (const page of node.body ?? []) {
      for (const child of page.body ?? []) collectUiIdRecords(child, out);
    }
  }
  if (node.kind === 'uiControl' && node.control === 'panel') {
    for (const child of node.body ?? []) collectUiIdRecords(child, out);
  }
  return out;
}

function rewriteUiIdAt(lines, index, record, newId) {
  const line = lines[index];
  if (typeof line !== 'string') throw new Error('UI source line could not be located safely.');
  if (record.type === 'input') {
    const pattern = new RegExp(`^(\\s*input\\s+)${escapeRegExp(record.id)}(\\b)`);
    if (!pattern.test(line)) throw new Error('Input id could not be rewritten safely.');
    lines[index] = line.replace(pattern, `$1${newId}$2`);
    return;
  }
  rewriteAsIdAt(lines, index, record.id, newId, record.type === 'menuItem' ? 'MenuItem' : 'Control');
}

function rewriteAsIdAt(lines, index, oldId, newId, label) {
  const line = lines[index];
  if (typeof line !== 'string') throw new Error(`${label} source line could not be located safely.`);
  const pattern = new RegExp(`\\bas\\s+${escapeRegExp(oldId)}\\b`);
  if (!pattern.test(line)) throw new Error(`${label} id could not be rewritten safely.`);
  lines[index] = line.replace(pattern, `as ${newId}`);
}

function eventBlocksForId(lines, id) {
  const header = new RegExp(`^(\\s*)when\\s+${escapeRegExp(id)}\\s+([^:\\s]+)\\s*:\\s*$`);
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
  if (!pattern.test(next[0] ?? '')) throw new Error('UI event handler could not be duplicated safely.');
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

function controlPrefix(type) {
  if (type === 'menuItem') return 'menu_item';
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
