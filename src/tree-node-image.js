import { normalizeImageListId, normalizeImageListItemName } from './imagelist-control.js';

export const PATCH_TREE_NODE_IMAGE_VERSION = '0.1';

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
      'TreeView node image binding must be ImageList.item such as app_images.folder.',
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

export function normalizeTreeNodeImageBinding(input = {}) {
  const listId = trimOrNull(input.imageListId);
  const item = trimOrNull(input.imageItem);
  if (!listId && !item) return Object.freeze({ imageListId: null, imageItem: null });
  if (!listId || !item) {
    throw new PatchTreeNodeImageError(
      'TreeView node image needs both an ImageList name and item name.',
      'TREE_NODE_IMAGE_INCOMPLETE'
    );
  }
  return parseTreeNodeImageBinding(`${listId}.${item}`);
}

export function formatTreeNodeImageBinding(input) {
  const binding = normalizeTreeNodeImageBinding(input);
  return binding.imageListId ? `${binding.imageListId}.${binding.imageItem}` : '';
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
  if (!labelExpr) throw new PatchTreeNodeImageError('TreeView node label cannot be empty.', 'TREE_NODE_SOURCE_LABEL');
  const binding = match[2] ? parseTreeNodeImageBinding(match[2]) : null;
  return Object.freeze({
    labelExpr,
    imageListId: binding?.imageListId ?? null,
    imageItem: binding?.imageItem ?? null
  });
}

export function formatPatchTreeNodeDeclaration(input = {}) {
  const labelExpr = String(input.labelExpr ?? '').trim();
  if (!labelExpr) throw new PatchTreeNodeImageError('TreeView node label cannot be empty.', 'TREE_NODE_SOURCE_LABEL');
  const binding = normalizeTreeNodeImageBinding(input);
  return `node ${labelExpr}${binding.imageListId ? ` image ${binding.imageListId}.${binding.imageItem}` : ''}`;
}

export function hasTreeNodeImageBinding(nodes) {
  for (const node of nodes ?? []) {
    if (node?.imageListId && node?.imageItem) return true;
    if (hasTreeNodeImageBinding(node?.children)) return true;
  }
  return false;
}

export function countTreeNodeImageBindings(nodes) {
  let count = 0;
  for (const node of nodes ?? []) {
    if (node?.imageListId && node?.imageItem) count += 1;
    count += countTreeNodeImageBindings(node?.children);
  }
  return count;
}

export function resolveTreeNodeImageBinding(lists, binding, line = null) {
  if (!binding?.imageListId || !binding?.imageItem) return null;
  const list = lists instanceof Map ? lists.get(binding.imageListId) : lists?.[binding.imageListId];
  const where = line == null ? 'TreeView node' : `line ${line}: TreeView node`;
  if (!list) {
    throw new PatchTreeNodeImageError(
      `${where} image ${binding.imageListId}.${binding.imageItem} refers to ImageList '${binding.imageListId}' that is not defined on this Form.`,
      'TREE_NODE_IMAGE_LIST_MISSING'
    );
  }
  const item = (list.items ?? []).find(entry => entry.name === binding.imageItem);
  if (!item) {
    throw new PatchTreeNodeImageError(
      `${where} image ${binding.imageListId}.${binding.imageItem} refers to ImageList item '${binding.imageItem}' that is not in '${binding.imageListId}'.`,
      'TREE_NODE_IMAGE_ITEM_MISSING'
    );
  }
  return Object.freeze({
    imageListId: binding.imageListId,
    imageItem: binding.imageItem,
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
