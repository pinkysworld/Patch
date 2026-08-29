import { parse } from './parser.js?v=9ad29318e93c7c71';
import { listDesignerControls } from './designer.js?v=9ad29318e93c7c71';

const SUPPORTED_TAB_CONTROLS = new Set(['text', 'button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'table', 'tree']);

export function listDesignerTabPageControls(source, selector, pageIndex) {
  const { page } = requireTabsPage(source, selector, pageIndex);
  return (page.body ?? []).map((node, controlIndex) => ({
    controlIndex,
    line: node.line,
    type: node.control,
    id: node.id ?? null,
    textExpr: node.textExpr ?? null,
    options: Array.isArray(node.options) ? [...node.options] : [],
    min: node.control === 'slider' ? node.min : null,
    max: node.control === 'slider' ? node.max : null,
    step: node.control === 'slider' ? node.step : null,
    columns: Array.isArray(node.columns) ? [...node.columns] : [],
    rows: Array.isArray(node.rows) ? node.rows.map(row => [...row]) : [],
    treeNodes: cloneTreeNodes(node.treeNodes ?? [])
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
  const rendered = formatNewNestedControl(controlType, ids).map(line => `${indent}${line}`);
  lines.splice(insertAt, 0, ...rendered);
  return validateAndPreserve(source, lines);
}

export function removeDesignerTabPageControl(source, selector, pageIndex, controlIndex) {
  const context = requireTabsPage(source, selector, pageIndex);
  const controls = context.page.body ?? [];
  if (controls.length <= 1) throw new Error('A tab page needs at least one control.');
  if (!Number.isInteger(controlIndex) || controlIndex < 0 || controlIndex >= controls.length) {
    throw new Error('Tab page control selection is invalid.');
  }

  const nested = controls[controlIndex];
  if (nested.kind !== 'uiControl' || !SUPPORTED_TAB_CONTROLS.has(nested.control)) {
    throw new Error('This nested control is outside the current Tabs Designer editing stage.');
  }

  const lines = normalizeLines(source);
  const start = nested.line - 1;
  const end = nestedControlBlockEnd(lines, context, controlIndex);
  lines.splice(start, end - start);
  if (nested.id) removeEventBlocksForIds(lines, [nested.id]);
  return validateAndPreserve(source, lines);
}

export function updateDesignerTabPageTableData(source, selector, pageIndex, controlIndex, changes = {}) {
  const context = requireNestedControl(source, selector, pageIndex, controlIndex, 'table');
  const nested = context.nested;
  const columns = Object.hasOwn(changes, 'columns')
    ? normalizeExpressions(changes.columns, 'Table columns')
    : [...(nested.columns ?? [])];
  if (!columns.length) throw new Error('A Table needs at least one column.');
  const rows = Object.hasOwn(changes, 'rows')
    ? normalizeRows(changes.rows, columns.length)
    : (nested.rows ?? []).map(row => [...row]);

  const lines = normalizeLines(source);
  const start = nested.line - 1;
  const end = nestedControlBlockEnd(lines, context, controlIndex);
  const indent = indentOf(lines[start]);
  const childIndent = `${indent}  `;
  const idPart = nested.id ? ` as ${nested.id}` : '';
  lines[start] = `${indent}table ${columns.join(', ')}${idPart}:`;
  lines.splice(start + 1, end - start - 1, ...rows.map(row => `${childIndent}row ${row.join(', ')}`));
  return validateAndPreserve(source, lines);
}

export function updateDesignerTabPageTreeNodes(source, selector, pageIndex, controlIndex, treeNodes) {
  const context = requireNestedControl(source, selector, pageIndex, controlIndex, 'tree');
  const nodes = normalizeTreeNodes(treeNodes);
  if (!nodes.length) throw new Error('A TreeView needs at least one node.');

  const lines = normalizeLines(source);
  const start = context.nested.line - 1;
  const end = nestedControlBlockEnd(lines, context, controlIndex);
  const childIndent = `${indentOf(lines[start])}  `;
  lines.splice(start + 1, end - start - 1, ...renderTreeNodes(nodes, childIndent));
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

function requireNestedControl(source, selector, pageIndex, controlIndex, type) {
  const context = requireTabsPage(source, selector, pageIndex);
  const controls = context.page.body ?? [];
  if (!Number.isInteger(controlIndex) || controlIndex < 0 || controlIndex >= controls.length) {
    throw new Error('Tab page control selection is invalid.');
  }
  const nested = controls[controlIndex];
  if (nested.kind !== 'uiControl' || nested.control !== type) {
    const label = type === 'tree' ? 'TreeView' : 'Table';
    throw new Error(`Nested Designer selection is not a ${label}.`);
  }
  return { ...context, nested };
}

function tabPageContentEnd(lines, control, tabsNode, pageIndex) {
  const pages = tabsNode.body ?? [];
  if (pageIndex + 1 < pages.length) return pages[pageIndex + 1].line - 1;
  let end = controlBlockEnd(lines, control.line - 1);
  while (end > pages[pageIndex].line && !lines[end - 1].trim()) end -= 1;
  return end;
}

function nestedControlBlockEnd(lines, context, controlIndex) {
  const controls = context.page.body ?? [];
  if (controlIndex + 1 < controls.length) return controls[controlIndex + 1].line - 1;
  return tabPageContentEnd(lines, context.control, context.tabsNode, context.tabsNode.body.indexOf(context.page));
}

function formatNewNestedControl(type, usedIds) {
  if (type === 'text') return ['text "Text"'];
  if (type === 'button') return [`button "Button" as ${uniqueId('button', usedIds)}`];
  if (type === 'input') return [`input ${uniqueId('input', usedIds)}`];
  if (type === 'checkbox') return [`checkbox "Checkbox" as ${uniqueId('checkbox', usedIds)}`];
  if (type === 'radio') return [`radio "One", "Two" as ${uniqueId('radio', usedIds)}`];
  if (type === 'combo') return [`combo "One", "Two" as ${uniqueId('combo', usedIds)}`];
  if (type === 'listbox') return [`listbox "One", "Two" as ${uniqueId('listbox', usedIds)}`];
  if (type === 'slider') return [`slider 0..100 as ${uniqueId('slider', usedIds)} step 1`];
  if (type === 'table') {
    const id = uniqueId('table', usedIds);
    return [`table "Name", "Value" as ${id}:`, '  row "Item", "Value"'];
  }
  if (type === 'tree') {
    const id = uniqueId('tree', usedIds);
    return [`tree as ${id}:`, '  node "Root"', '    node "Child"'];
  }
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

function normalizeTreeNodes(nodes) {
  if (!Array.isArray(nodes)) throw new Error('TreeView nodes must be an array.');
  return nodes.map(node => {
    if (!node || typeof node !== 'object') throw new Error('TreeView node is invalid.');
    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      children: normalizeTreeNodes(node.children ?? [])
    };
  });
}

function normalizeRows(rows, width) {
  if (!Array.isArray(rows)) throw new Error('Table rows must be an array.');
  return rows.map((row, index) => {
    if (!Array.isArray(row) || row.length !== width) throw new Error(`Table row ${index + 1} must contain exactly ${width} cells.`);
    return row.map((cell, cellIndex) => normalizeExpression(cell, `Table row ${index + 1} cell ${cellIndex + 1}`));
  });
}

function normalizeExpressions(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  return values.map((value, index) => normalizeExpression(value, `${label.slice(0, -1)} ${index + 1}`));
}

function normalizeExpression(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} cannot be empty.`);
  return text;
}

function renderTreeNodes(nodes, indent, depth = 0, out = []) {
  for (const node of nodes) {
    out.push(`${indent}${'  '.repeat(depth)}node ${node.labelExpr}`);
    renderTreeNodes(node.children, indent, depth + 1, out);
  }
  return out;
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

function cloneTreeNodes(nodes) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    children: cloneTreeNodes(node.children ?? [])
  }));
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
