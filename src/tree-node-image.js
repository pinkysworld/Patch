import { normalizeImageListId, normalizeImageListItemName } from './imagelist-control.js';

export const PATCH_TREE_NODE_IMAGE_VERSION = '0.1';
export const PATCH_TREE_NODE_IMAGE_FORMAT = 'patch-tree-node-image';

export class PatchTreeNodeImageError extends Error {
  constructor(message, code = 'TREE_NODE_IMAGE_INVALID') {
    super(message);
    this.name = 'PatchTreeNodeImageError';
    this.code = code;
  }
}

export function parseTreeNodeImageBinding(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  if (!match) {
    throw new PatchTreeNodeImageError(
      'TreeView node image binding must be ImageList.item such as tree_images.folder.',
      'TREE_NODE_IMAGE_SYNTAX'
    );
  }
  try {
    return Object.freeze({
      imageListId: normalizeImageListId(match[1]),
      imageItem: normalizeImageListItemName(match[2])
    });
  } catch (error) {
    throw new PatchTreeNodeImageError(error?.message ?? String(error), error?.code ?? 'TREE_NODE_IMAGE_INVALID');
  }
}

export function parsePatchTreeNodeDeclaration(value) {
  const source = String(value ?? '').trim();
  const match = source.match(/^node\s+(.+?)(?:\s+image\s+([A-Za-z_]\w*\.[A-Za-z_]\w*))?\s*$/i);
  if (!match) {
    throw new PatchTreeNodeImageError(
      'TreeView node syntax is node <label> or node <label> image ImageList.item.',
      'TREE_NODE_SOURCE_SYNTAX'
    );
  }
  const labelExpr = String(match[1] ?? '').trim();
  if (!labelExpr) throw new PatchTreeNodeImageError('TreeView node label cannot be empty.', 'TREE_NODE_LABEL');
  const binding = match[2] ? parseTreeNodeImageBinding(match[2]) : null;
  return Object.freeze({
    labelExpr,
    imageListId: binding?.imageListId ?? null,
    imageItem: binding?.imageItem ?? null
  });
}

export function formatPatchTreeNodeDeclaration(node = {}) {
  const labelExpr = String(node.labelExpr ?? '').trim();
  if (!labelExpr) throw new PatchTreeNodeImageError('TreeView node label cannot be empty.', 'TREE_NODE_LABEL');
  let text = `node ${labelExpr}`;
  if (node.imageListId || node.imageItem) {
    const binding = parseTreeNodeImageBinding(`${String(node.imageListId ?? '').trim()}.${String(node.imageItem ?? '').trim()}`);
    text += ` image ${binding.imageListId}.${binding.imageItem}`;
  }
  return text;
}

export function resolveTreeNodeImageBinding(lists, node, line = null) {
  if (!node?.imageListId || !node?.imageItem) return null;
  const list = lists instanceof Map ? lists.get(node.imageListId) : lists?.[node.imageListId];
  const where = line == null ? 'TreeView node' : `line ${line}: TreeView node`;
  if (!list) {
    throw new PatchTreeNodeImageError(
      `${where} image ${node.imageListId}.${node.imageItem} refers to ImageList '${node.imageListId}' that is not defined on this Form.`,
      'TREE_NODE_IMAGE_LIST_MISSING'
    );
  }
  const item = (list.items ?? []).find(entry => entry.name === node.imageItem);
  if (!item) {
    throw new PatchTreeNodeImageError(
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

export function hasTreeNodeImage(node) {
  return Boolean(node?.imageListId && node?.imageItem);
}

export function countTreeNodeImages(nodes) {
  let count = 0;
  walkTreeNodes(nodes, node => { if (hasTreeNodeImage(node)) count += 1; });
  return count;
}

export function walkTreeNodes(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node);
    walkTreeNodes(node.children, visit);
  }
}
