import { parse } from './parser.js?v=868f0784ca7f3972';
import { listDesignerControls } from './designer.js?v=868f0784ca7f3972';

export function updateDesignerTreeNodes(source, selector, treeNodes) {
  const control = requireControl(source, selector, 'tree');
  const nodes = normalizeTreeNodes(treeNodes);
  if (!nodes.length) throw new Error('A TreeView needs at least one node.');

  const lines = normalizeLines(source);
  const lineIndex = control.line - 1;
  const end = controlBlockEnd(lines, lineIndex);
  const childIndent = `${indentOf(lines[lineIndex])}  `;
  const rendered = renderTreeNodes(nodes, childIndent);
  lines.splice(lineIndex + 1, end - lineIndex - 1, ...rendered);
  return validateAndPreserve(source, lines);
}

export function updateDesignerTableData(source, selector, changes = {}) {
  const control = requireControl(source, selector, 'table');
  const columns = Object.hasOwn(changes, 'columns')
    ? normalizeExpressions(changes.columns, 'Table columns')
    : [...(control.columns ?? [])];
  if (!columns.length) throw new Error('A Table needs at least one column.');

  const rows = Object.hasOwn(changes, 'rows')
    ? normalizeRows(changes.rows, columns.length)
    : (control.rows ?? []).map(row => [...row]);

  const lines = normalizeLines(source);
  const lineIndex = control.line - 1;
  const end = controlBlockEnd(lines, lineIndex);
  const indent = indentOf(lines[lineIndex]);
  const childIndent = `${indent}  `;
  lines[lineIndex] = `${indent}${formatTableHeader(control, columns)}`;
  lines.splice(lineIndex + 1, end - lineIndex - 1, ...rows.map(row => `${childIndent}row ${row.join(', ')}`));
  return validateAndPreserve(source, lines);
}

export function listDesignerTabPages(source, selector) {
  const { tabsNode } = requireTabsAst(source, selector);
  return (tabsNode.body ?? []).map((page, pageIndex) => ({
    pageIndex,
    line: page.line,
    titleExpr: page.titleExpr,
    controlIds: collectControlIds(page.body)
  }));
}

export function addDesignerTabPage(source, selector, titleExpr = null) {
  const { control, tabsNode } = requireTabsAst(source, selector);
  const pages = tabsNode.body ?? [];
  const title = normalizeExpression(titleExpr ?? JSON.stringify(`Page ${pages.length + 1}`), 'Tab page title');
  const lines = normalizeLines(source);
  const lineIndex = control.line - 1;
  const blockEnd = controlBlockEnd(lines, lineIndex);
  let insertAt = blockEnd;
  while (insertAt > lineIndex + 1 && !lines[insertAt - 1].trim()) insertAt -= 1;
  const pageIndent = `${indentOf(lines[lineIndex])}  `;
  const bodyIndent = `${pageIndent}  `;
  lines.splice(insertAt, 0,
    `${pageIndent}tab ${title}:`,
    `${bodyIndent}text ${title}`
  );
  return validateAndPreserve(source, lines);
}

export function renameDesignerTabPage(source, selector, pageIndex, titleExpr) {
  const { tabsNode } = requireTabsAst(source, selector);
  const page = requireTabPage(tabsNode, pageIndex);
  const title = normalizeExpression(titleExpr, 'Tab page title');
  const lines = normalizeLines(source);
  const lineIndex = page.line - 1;
  lines[lineIndex] = `${indentOf(lines[lineIndex])}tab ${title}:`;
  return validateAndPreserve(source, lines);
}

export function moveDesignerTabPage(source, selector, pageIndex, direction) {
  const { control, tabsNode } = requireTabsAst(source, selector);
  requireTabPage(tabsNode, pageIndex);
  const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  if (!delta) throw new Error("Tab page direction must be 'up' or 'down'.");
  const target = pageIndex + delta;
  if (target < 0 || target >= tabsNode.body.length) return source;

  const lines = normalizeLines(source);
  const blocks = tabPageBlocks(lines, control, tabsNode);
  [blocks[pageIndex], blocks[target]] = [blocks[target], blocks[pageIndex]];
  const start = blocks.reduce((minimum, block) => Math.min(minimum, block.originalStart), Infinity);
  const end = Math.max(...blocks.map(block => block.originalEnd));
  const replacement = blocks.flatMap(block => block.lines);
  lines.splice(start, end - start, ...replacement);
  return validateAndPreserve(source, lines);
}

export function removeDesignerTabPage(source, selector, pageIndex) {
  const { control, tabsNode } = requireTabsAst(source, selector);
  const pages = tabsNode.body ?? [];
  if (pages.length <= 2) throw new Error('Tabs needs at least two tab pages.');
  const page = requireTabPage(tabsNode, pageIndex);
  const lines = normalizeLines(source);
  const blocks = tabPageBlocks(lines, control, tabsNode);
  const block = blocks[pageIndex];
  lines.splice(block.originalStart, block.originalEnd - block.originalStart);
  removeEventBlocksForIds(lines, collectControlIds(page.body));
  return validateAndPreserve(source, lines);
}

export function addTreeRoot(nodes, labelExpr = '"New node"') {
  const next = normalizeTreeNodes(nodes);
  next.push(makeTreeNode(labelExpr));
  return { nodes: next, path: [next.length - 1] };
}

export function addTreeChild(nodes, path, labelExpr = '"New child"') {
  const next = normalizeTreeNodes(nodes);
  const target = treeNodeAt(next, path);
  target.children.push(makeTreeNode(labelExpr));
  return { nodes: next, path: [...path, target.children.length - 1] };
}

export function renameTreeNode(nodes, path, labelExpr) {
  const next = normalizeTreeNodes(nodes);
  treeNodeAt(next, path).labelExpr = normalizeExpression(labelExpr, 'Tree node label');
  return { nodes: next, path: [...path] };
}

export function removeTreeNode(nodes, path) {
  const next = normalizeTreeNodes(nodes);
  const { siblings, index } = treeLocation(next, path);
  siblings.splice(index, 1);
  if (!next.length) throw new Error('A TreeView needs at least one node.');
  const fallback = Math.max(0, Math.min(index, siblings.length - 1));
  const nextPath = siblings.length ? [...path.slice(0, -1), fallback] : parentFallbackPath(next, path.slice(0, -1));
  return { nodes: next, path: nextPath };
}

export function moveTreeNode(nodes, path, direction) {
  const next = normalizeTreeNodes(nodes);
  const { siblings, index } = treeLocation(next, path);
  const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  if (!delta) throw new Error("Tree node direction must be 'up' or 'down'.");
  const target = index + delta;
  if (target < 0 || target >= siblings.length) return { nodes: next, path: [...path] };
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  return { nodes: next, path: [...path.slice(0, -1), target] };
}

export function indentTreeNode(nodes, path) {
  const next = normalizeTreeNodes(nodes);
  const { siblings, index } = treeLocation(next, path);
  if (index === 0) return { nodes: next, path: [...path] };
  const [node] = siblings.splice(index, 1);
  const parent = siblings[index - 1];
  parent.children.push(node);
  return { nodes: next, path: [...path.slice(0, -1), index - 1, parent.children.length - 1] };
}

export function outdentTreeNode(nodes, path) {
  const next = normalizeTreeNodes(nodes);
  if (path.length < 2) return { nodes: next, path: [...path] };

  const parentPath = path.slice(0, -1);
  const parentLocation = treeLocation(next, parentPath);
  const parent = parentLocation.siblings[parentLocation.index];
  const childIndex = path[path.length - 1];
  if (!Number.isInteger(childIndex) || childIndex < 0 || childIndex >= parent.children.length) throw new Error('Tree node selection is invalid.');
  const [node] = parent.children.splice(childIndex, 1);
  parentLocation.siblings.splice(parentLocation.index + 1, 0, node);
  return { nodes: next, path: [...parentPath.slice(0, -1), parentLocation.index + 1] };
}

export function treeNodeAt(nodes, path) {
  if (!Array.isArray(path) || !path.length) throw new Error('Tree node selection is invalid.');
  let siblings = nodes;
  let node = null;
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0 || index >= siblings.length) throw new Error('Tree node selection is invalid.');
    node = siblings[index];
    siblings = node.children;
  }
  return node;
}

export function flattenTreeNodes(nodes, path = [], out = []) {
  (nodes ?? []).forEach((node, index) => {
    const nextPath = [...path, index];
    out.push({ path: nextPath, depth: nextPath.length - 1, labelExpr: node.labelExpr });
    flattenTreeNodes(node.children, nextPath, out);
  });
  return out;
}

function requireControl(source, selector, type) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer selection is invalid.');
  }
  const control = listDesignerControls(source).find(item =>
    item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex
  );
  if (!control || control.type !== type) {
    const label = type === 'tree' ? 'TreeView' : type === 'tabs' ? 'Tabs' : 'Table';
    throw new Error(`Designer selection is not a ${label}.`);
  }
  return control;
}

function requireTabsAst(source, selector) {
  const control = requireControl(source, selector, 'tabs');
  const ast = parse(source);
  let windowIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    if (windowIndex === control.windowIndex) {
      let controlIndex = 0;
      for (const child of node.body ?? []) {
        if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
        if (controlIndex === control.controlIndex) {
          if (child.kind !== 'tabs') throw new Error('Designer selection is not Tabs.');
          return { control, tabsNode: child };
        }
        controlIndex += 1;
      }
    }
    windowIndex += 1;
  }
  throw new Error('Designer Tabs selection no longer matches Patch source.');
}

function requireTabPage(tabsNode, pageIndex) {
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= (tabsNode.body ?? []).length) {
    throw new Error('Tab page selection is invalid.');
  }
  return tabsNode.body[pageIndex];
}

function tabPageBlocks(lines, control, tabsNode) {
  const tabsLineIndex = control.line - 1;
  let contentEnd = controlBlockEnd(lines, tabsLineIndex);
  while (contentEnd > tabsLineIndex + 1 && !lines[contentEnd - 1].trim()) contentEnd -= 1;
  const starts = (tabsNode.body ?? []).map(page => page.line - 1);
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : contentEnd;
    return { originalStart: start, originalEnd: end, lines: lines.slice(start, end) };
  });
}

function collectControlIds(nodes = [], out = []) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl' && node.id) out.push(node.id);
    if (node.kind === 'tabs') {
      for (const page of node.body ?? []) collectControlIds(page.body, out);
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

function makeTreeNode(labelExpr) {
  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), children: [] };
}

function treeLocation(nodes, path) {
  if (!Array.isArray(path) || !path.length) throw new Error('Tree node selection is invalid.');
  let siblings = nodes;
  for (let depth = 0; depth < path.length - 1; depth += 1) {
    const index = path[depth];
    if (!Number.isInteger(index) || index < 0 || index >= siblings.length) throw new Error('Tree node selection is invalid.');
    siblings = siblings[index].children;
  }
  const index = path[path.length - 1];
  if (!Number.isInteger(index) || index < 0 || index >= siblings.length) throw new Error('Tree node selection is invalid.');
  return { siblings, index };
}

function parentFallbackPath(nodes, path) {
  if (!path.length) return [0];
  try {
    treeNodeAt(nodes, path);
    return path;
  } catch {
    return [0];
  }
}

function renderTreeNodes(nodes, indent, depth = 0, out = []) {
  for (const node of nodes) {
    out.push(`${indent}${'  '.repeat(depth)}node ${node.labelExpr}`);
    renderTreeNodes(node.children, indent, depth + 1, out);
  }
  return out;
}

function formatTableHeader(control, columns) {
  const idPart = control.id ? ` as ${control.id}` : '';
  const hasLayout = [control.x, control.y, control.width, control.height].every(Number.isInteger);
  const layoutPart = hasLayout ? ` at ${control.x}, ${control.y} size ${control.width}, ${control.height}` : '';
  return `table ${columns.join(', ')}${idPart}${layoutPart}:`;
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
  listDesignerControls(text);
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
