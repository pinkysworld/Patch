import { normalizeImageListId, normalizeImageListItemName } from './imagelist-control.js';

export const PATCH_TREE_NODE_PRESENTATION_VERSION = '0.1';
export const PATCH_TREE_NODE_HINT_VERSION = '0.1';

export class PatchTreeNodePresentationError extends Error {
  constructor(message, code = 'TREE_NODE_PRESENTATION_INVALID') {
    super(message);
    this.name = 'PatchTreeNodePresentationError';
    this.code = code;
  }
}

export function parseTreeNodeImageBinding(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  if (!match) {
    throw new PatchTreeNodePresentationError(
      'TreeView node image binding must be ImageList.item such as tree_icons.folder.',
      'TREE_NODE_IMAGE_SYNTAX'
    );
  }
  try {
    return Object.freeze({
      imageListId: normalizeImageListId(match[1]),
      imageItem: normalizeImageListItemName(match[2])
    });
  } catch (error) {
    throw new PatchTreeNodePresentationError(error?.message ?? String(error), error?.code ?? 'TREE_NODE_IMAGE');
  }
}

export function formatTreeNodeImageBinding(input) {
  if (!input) return '';
  const list = trimOrNull(input.imageListId);
  const item = trimOrNull(input.imageItem);
  if (!list && !item) return '';
  if (!list || !item) {
    throw new PatchTreeNodePresentationError('TreeView node image needs both ImageList and item names.', 'TREE_NODE_IMAGE');
  }
  const binding = parseTreeNodeImageBinding(`${list}.${item}`);
  return `${binding.imageListId}.${binding.imageItem}`;
}

export function normalizeTreeNodeHint(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

export function parseTreeNodeHintLiteral(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const source = String(value).trim();
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new PatchTreeNodePresentationError(
      'TreeView node hint must be a quoted text literal such as hint "Open source folder".',
      'TREE_NODE_HINT_SYNTAX'
    );
  }
  if (typeof parsed !== 'string' || !parsed.trim()) {
    throw new PatchTreeNodePresentationError(
      'TreeView node hint must be non-empty quoted text.',
      'TREE_NODE_HINT'
    );
  }
  return parsed;
}

export function formatTreeNodeHint(value) {
  const hint = normalizeTreeNodeHint(value);
  return hint ? JSON.stringify(hint) : '';
}

export function parsePatchTreeNodeDeclaration(value) {
  const source = String(value ?? '').trim();
  const match = source.match(/^node\s+(.+?)(?:\s+image\s+([A-Za-z_]\w*\.[A-Za-z_]\w*))?(?:\s+hint\s+("(?:\\.|[^"\\])*"))?\s*$/i);
  if (!match) {
    throw new PatchTreeNodePresentationError(
      'TreeView node syntax is node <label> [image list.item] [hint "text"].',
      'TREE_NODE_SOURCE_SYNTAX'
    );
  }
  const labelExpr = String(match[1] ?? '').trim();
  if (!labelExpr) throw new PatchTreeNodePresentationError('TreeView node label cannot be empty.', 'TREE_NODE_LABEL');
  const binding = parseTreeNodeImageBinding(match[2]);
  const hint = parseTreeNodeHintLiteral(match[3]);
  return Object.freeze({
    labelExpr,
    imageListId: binding?.imageListId ?? null,
    imageItem: binding?.imageItem ?? null,
    ...(hint ? { hint } : {})
  });
}

export function formatPatchTreeNodeDeclaration(input = {}) {
  const labelExpr = String(input.labelExpr ?? '').trim();
  if (!labelExpr) throw new PatchTreeNodePresentationError('TreeView node label cannot be empty.', 'TREE_NODE_LABEL');
  const image = formatTreeNodeImageBinding(input);
  const hint = formatTreeNodeHint(input.hint);
  return `node ${labelExpr}${image ? ` image ${image}` : ''}${hint ? ` hint ${hint}` : ''}`;
}

export function treeNodeHasImage(node) {
  return Boolean(node?.imageListId && node?.imageItem);
}

export function treeNodeHasHint(node) {
  return Boolean(normalizeTreeNodeHint(node?.hint));
}

export function countTreeNodeImages(nodes) {
  let count = 0;
  for (const node of nodes ?? []) {
    if (treeNodeHasImage(node)) count += 1;
    count += countTreeNodeImages(node.children);
  }
  return count;
}

export function countTreeNodeHints(nodes) {
  let count = 0;
  for (const node of nodes ?? []) {
    if (treeNodeHasHint(node)) count += 1;
    count += countTreeNodeHints(node.children);
  }
  return count;
}

export function visitTreeNodeImages(nodes, visit) {
  for (const node of nodes ?? []) {
    if (treeNodeHasImage(node)) visit(node);
    visitTreeNodeImages(node.children, visit);
  }
}

export function resolveTreeNodeImageBinding(lists, node, line = null) {
  if (!treeNodeHasImage(node)) return null;
  const list = lists instanceof Map ? lists.get(node.imageListId) : lists?.[node.imageListId];
  const where = line == null ? 'TreeView node' : `line ${line}: TreeView node`;
  if (!list) {
    throw new PatchTreeNodePresentationError(
      `${where} image ${node.imageListId}.${node.imageItem} refers to ImageList '${node.imageListId}' that is not defined on this Form.`,
      'TREE_NODE_IMAGE_LIST_MISSING'
    );
  }
  const item = (list.items ?? []).find(entry => entry.name === node.imageItem);
  if (!item) {
    throw new PatchTreeNodePresentationError(
      `${where} image ${node.imageListId}.${node.imageItem} refers to ImageList item '${node.imageItem}' that is not in '${node.imageListId}'.`,
      'TREE_NODE_IMAGE_ITEM_MISSING'
    );
  }
  return Object.freeze({
    imageListId: node.imageListId,
    imageItem: node.imageItem,
    sourceExpr: item.sourceExpr,
    resourceId: item.resourceId ?? null,
    width: Number(list.logicalWidth) || 16,
    height: Number(list.logicalHeight) || 16
  });
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}
