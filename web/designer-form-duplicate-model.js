import { parse } from '../src/parser.js';
import { listDesignerWindows } from '../src/designer.js';

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
  const usedControlIds = new Set(collectAllControlIds(ast));
  const controlIdMap = new Map();
  const duplicatedHandlers = [];
  let formId = window.id ?? null;

  if (window.id) {
    formId = uniqueId('form', usedFormIds);
    rewriteAsIdAt(copied, 0, window.id, formId, 'Form');
  }

  for (const record of collectWindowControlIdRecords(windowNode)) {
    const nextId = uniqueId(controlPrefix(record.type), usedControlIds);
    controlIdMap.set(record.id, nextId);
    const relativeLine = record.line - 1 - start;
    rewriteControlIdAt(copied, relativeLine, record, nextId);
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

function collectWindowControlIdRecords(windowNode, out = []) {
  for (const node of windowNode.body ?? []) collectControlIdRecords(node, out);
  return out;
}

function collectControlIdRecords(node, out) {
  if (!node || typeof node !== 'object') return out;
  if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) {
    out.push({
      id: node.id,
      line: node.line,
      type: node.kind === 'tabs' ? 'tabs' : node.control
    });
  }
  if (node.kind === 'tabs') {
    for (const page of node.body ?? []) {
      for (const child of page.body ?? []) collectControlIdRecords(child, out);
    }
  }
  return out;
}

function collectAllControlIds(ast, out = []) {
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    for (const child of node.body ?? []) collectNodeIds(child, out);
  }
  return out;
}

function collectNodeIds(node, out) {
  if (!node || typeof node !== 'object') return;
  if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) out.push(node.id);
  if (node.kind === 'tabs') {
    for (const page of node.body ?? []) for (const child of page.body ?? []) collectNodeIds(child, out);
  }
}

function rewriteControlIdAt(lines, index, record, newId) {
  const line = lines[index];
  if (typeof line !== 'string') throw new Error('Control source line could not be located safely.');
  if (record.type === 'input') {
    const pattern = new RegExp(`^(\\s*input\\s+)${escapeRegExp(record.id)}(\\b)`);
    if (!pattern.test(line)) throw new Error('Input id could not be rewritten safely.');
    lines[index] = line.replace(pattern, `$1${newId}$2`);
    return;
  }
  rewriteAsIdAt(lines, index, record.id, newId, 'Control');
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
  if (!pattern.test(next[0] ?? '')) throw new Error('Control event handler could not be duplicated safely.');
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
