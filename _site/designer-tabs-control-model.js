import { parse } from './src/parser.js?v=868f0784ca7f3972';
import { listDesignerTabPages } from './src/designer-data.js?v=868f0784ca7f3972';
import { listDesignerTabPageControls } from './src/designer-tabs-nested.js?v=868f0784ca7f3972';

const SUPPORTED_TYPES = new Set(['text', 'button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'table', 'tree']);

export function moveDesignerTabPageControl(source, selector, pageIndex, controlIndex, direction) {
  const context = pageContext(source, selector, pageIndex);
  const control = requireControl(context.controls, controlIndex);
  requireSupported(control);
  const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  if (!delta) throw new Error("Tab page control direction must be 'up' or 'down'.");
  const target = controlIndex + delta;
  if (target < 0 || target >= context.controls.length) return { source: String(source), controlIndex };

  const lines = normalizeLines(source);
  const firstIndex = Math.min(controlIndex, target);
  const secondIndex = Math.max(controlIndex, target);
  const first = controlBlock(lines, context, firstIndex);
  const second = controlBlock(lines, context, secondIndex);
  const replacement = controlIndex < target
    ? [...second.lines, ...first.lines]
    : [...second.lines, ...first.lines];
  lines.splice(first.start, second.end - first.start, ...replacement);
  const next = validateAndPreserve(source, lines);
  return { source: next, controlIndex: target };
}

export function duplicateDesignerTabPageControl(source, selector, pageIndex, controlIndex) {
  const context = pageContext(source, selector, pageIndex);
  const control = requireControl(context.controls, controlIndex);
  requireSupported(control);
  const lines = normalizeLines(source);
  const block = controlBlock(lines, context, controlIndex);
  let copied = [...block.lines];
  let newId = null;
  let handlers = [];

  if (control.id) {
    const ast = parse(String(source));
    const used = new Set(collectAllControlIds(ast));
    newId = uniqueId(controlPrefix(control.type), used);
    copied = rewriteControlId(copied, control, newId);
    handlers = eventBlocksForId(lines, control.id).map(event => rewriteEventTarget(event.lines, control.id, newId));
  }

  lines.splice(block.end, 0, ...copied);
  if (handlers.length) appendEventBlocks(lines, handlers);
  const next = validateAndPreserve(source, lines);
  return { source: next, controlIndex: controlIndex + 1, id: newId };
}

export function designerTabPageControlActionAvailability(source, selector, pageIndex, controlIndex) {
  const context = pageContext(source, selector, pageIndex);
  const control = requireControl(context.controls, controlIndex);
  requireSupported(control);
  return {
    up: controlIndex > 0,
    down: controlIndex < context.controls.length - 1,
    duplicate: true
  };
}

function pageContext(source, selector, pageIndex) {
  const pages = listDesignerTabPages(source, selector);
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) throw new Error('Tab page selection is invalid.');
  const controls = listDesignerTabPageControls(source, selector, pageIndex);
  if (!controls.length) throw new Error('A tab page needs at least one control.');
  return { source: String(source), selector, pageIndex, page: pages[pageIndex], controls };
}

function requireControl(controls, controlIndex) {
  if (!Number.isInteger(controlIndex) || controlIndex < 0 || controlIndex >= controls.length) {
    throw new Error('Tab page control selection is invalid.');
  }
  return controls[controlIndex];
}

function requireSupported(control) {
  if (!control || !SUPPORTED_TYPES.has(control.type)) throw new Error('This nested control is outside the current Tabs Designer editing stage.');
}

function controlBlock(lines, context, controlIndex) {
  const control = context.controls[controlIndex];
  const start = control.line - 1;
  const end = controlIndex + 1 < context.controls.length
    ? context.controls[controlIndex + 1].line - 1
    : pageBlockEnd(lines, context.page.line - 1);
  return { start, end, lines: lines.slice(start, end) };
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

function rewriteControlId(lines, control, newId) {
  const next = [...lines];
  const oldId = escapeRegExp(control.id);
  const index = next.findIndex(line => line.trim());
  if (index < 0) throw new Error('Nested control source block is empty.');
  if (control.type === 'input') {
    const pattern = new RegExp(`^(\\s*input\\s+)${oldId}(\\b)`);
    if (!pattern.test(next[index])) throw new Error('Nested Input id could not be rewritten safely.');
    next[index] = next[index].replace(pattern, `$1${newId}$2`);
    return next;
  }
  const pattern = new RegExp(`\\bas\\s+${oldId}\\b`);
  if (!pattern.test(next[index])) throw new Error('Nested control id could not be rewritten safely.');
  next[index] = next[index].replace(pattern, `as ${newId}`);
  return next;
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
    out.push({ start: index, end, lines: lines.slice(index, end) });
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
  if (type === 'combo') return 'combo';
  return type || 'control';
}

function uniqueId(prefix, usedIds) {
  let index = 1;
  let candidate = `${prefix}_${index}`;
  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
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
