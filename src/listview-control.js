import { normalizeImageListId, normalizeImageListItemName } from './imagelist-control.js';

export const PATCH_LISTVIEW_VERSION = '0.1';
export const PATCH_LISTVIEW_MODES = Object.freeze(['icons', 'details']);

export class PatchListViewError extends Error {
  constructor(message, code = 'LISTVIEW_INVALID') {
    super(message);
    this.name = 'PatchListViewError';
    this.code = code;
  }
}

export function normalizeListViewMode(value) {
  const mode = String(value ?? '').trim().toLowerCase();
  if (!PATCH_LISTVIEW_MODES.includes(mode)) {
    throw new PatchListViewError(
      `ListView mode must be one of: ${PATCH_LISTVIEW_MODES.join(', ')}.`,
      'LISTVIEW_MODE'
    );
  }
  return mode;
}

export function parseListViewImageBinding(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  if (!match) {
    throw new PatchListViewError(
      'ListView item image binding must be ImageList.item such as file_icons.folder.',
      'LISTVIEW_IMAGE_SYNTAX'
    );
  }
  try {
    return Object.freeze({
      imageListId: normalizeImageListId(match[1]),
      imageItem: normalizeImageListItemName(match[2])
    });
  } catch (error) {
    throw new PatchListViewError(error?.message ?? String(error), error?.code ?? 'LISTVIEW_IMAGE');
  }
}

export function normalizeListViewDetail(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

export function parseListViewDetailLiteral(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const source = String(value).trim();
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new PatchListViewError(
      'ListView item detail must be a quoted text literal such as detail "Source folder".',
      'LISTVIEW_DETAIL_SYNTAX'
    );
  }
  if (typeof parsed !== 'string' || !parsed.trim()) {
    throw new PatchListViewError('ListView item detail must be non-empty quoted text.', 'LISTVIEW_DETAIL');
  }
  return parsed;
}

export function parsePatchListViewItemDeclaration(value) {
  const source = String(value ?? '').trim();
  const match = source.match(/^item\s+(.+?)(?:\s+image\s+([A-Za-z_]\w*\.[A-Za-z_]\w*))?(?:\s+detail\s+("(?:\\.|[^"\\])*"))?\s*$/i);
  if (!match) {
    throw new PatchListViewError(
      'ListView item syntax is item <label> [image list.item] [detail "text"].',
      'LISTVIEW_ITEM_SOURCE_SYNTAX'
    );
  }
  const labelExpr = String(match[1] ?? '').trim();
  if (!labelExpr) throw new PatchListViewError('ListView item label cannot be empty.', 'LISTVIEW_ITEM_LABEL');
  const binding = parseListViewImageBinding(match[2]);
  const detail = parseListViewDetailLiteral(match[3]);
  return Object.freeze({
    labelExpr,
    imageListId: binding?.imageListId ?? null,
    imageItem: binding?.imageItem ?? null,
    ...(detail ? { detail } : {})
  });
}

export function formatPatchListViewItemDeclaration(input = {}) {
  const labelExpr = String(input.labelExpr ?? '').trim();
  if (!labelExpr) throw new PatchListViewError('ListView item label cannot be empty.', 'LISTVIEW_ITEM_LABEL');
  const binding = input.imageListId || input.imageItem
    ? parseListViewImageBinding(`${String(input.imageListId ?? '').trim()}.${String(input.imageItem ?? '').trim()}`)
    : null;
  const detail = normalizeListViewDetail(input.detail);
  return `item ${labelExpr}${binding ? ` image ${binding.imageListId}.${binding.imageItem}` : ''}${detail ? ` detail ${JSON.stringify(detail)}` : ''}`;
}

export function normalizeListViewItems(items) {
  if (!Array.isArray(items) || !items.length) throw new PatchListViewError('ListView needs at least one item.');
  return items.map(item => {
    if (!item || typeof item !== 'object') throw new PatchListViewError('ListView item is invalid.');
    const labelExpr = String(item.labelExpr ?? '').trim();
    if (!labelExpr) throw new PatchListViewError('ListView item label cannot be empty.', 'LISTVIEW_ITEM_LABEL');
    const binding = item.imageListId || item.imageItem
      ? parseListViewImageBinding(`${String(item.imageListId ?? '').trim()}.${String(item.imageItem ?? '').trim()}`)
      : null;
    const detail = normalizeListViewDetail(item.detail);
    return {
      labelExpr,
      ...(binding ? { imageListId: binding.imageListId, imageItem: binding.imageItem } : {}),
      ...(detail ? { detail } : {})
    };
  });
}

export function visitListViewItemImages(items, visit) {
  for (const item of items ?? []) {
    if (item?.imageListId && item?.imageItem) visit(item);
  }
}

export function resolveListViewItemImageBinding(lists, item, line = null) {
  if (!item?.imageListId || !item?.imageItem) return null;
  const list = lists instanceof Map ? lists.get(item.imageListId) : lists?.[item.imageListId];
  const where = line == null ? 'ListView item' : `line ${line}: ListView item`;
  if (!list) {
    throw new PatchListViewError(
      `${where} image ${item.imageListId}.${item.imageItem} refers to ImageList '${item.imageListId}' that is not defined on this Form.`,
      'LISTVIEW_IMAGE_LIST_MISSING'
    );
  }
  const image = (list.items ?? []).find(entry => entry.name === item.imageItem);
  if (!image) {
    throw new PatchListViewError(
      `${where} image ${item.imageListId}.${item.imageItem} refers to ImageList item '${item.imageItem}' that is not in '${item.imageListId}'.`,
      'LISTVIEW_IMAGE_ITEM_MISSING'
    );
  }
  return Object.freeze({
    imageListId: item.imageListId,
    imageItem: item.imageItem,
    sourceExpr: image.sourceExpr,
    resourceId: image.resourceId ?? null,
    width: Number(list.logicalWidth) || 16,
    height: Number(list.logicalHeight) || 16
  });
}
