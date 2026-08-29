import { normalizeImageListId, normalizeImageListItemName } from './imagelist-control.js?v=9ad29318e93c7c71';

export const PATCH_BUTTON_IMAGE_BINDING_VERSION = '1.0';

const PATCH_NAME = /^[A-Za-z_]\w*$/;

export class PatchButtonImageError extends Error {
  constructor(message, code = 'BUTTON_IMAGE_INVALID') {
    super(message);
    this.name = 'PatchButtonImageError';
    this.code = code;
  }
}

/**
 * Parse `list.item` ImageList bindings used by Button.
 *
 * Canonical syntax:
 * button "Open" as open_button image app_images.open
 */
export function parseButtonImageBinding(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  if (!match) {
    throw new PatchButtonImageError(
      "Button image binding must be ImageList.item such as app_images.open.",
      'BUTTON_IMAGE_SYNTAX'
    );
  }
  try {
    return Object.freeze({
      imageListId: normalizeImageListId(match[1]),
      imageItem: normalizeImageListItemName(match[2])
    });
  } catch (error) {
    throw new PatchButtonImageError(error?.message ?? String(error), error?.code ?? 'BUTTON_IMAGE_INVALID');
  }
}

export function formatButtonImageBinding(input) {
  if (!input) return '';
  const listId = String(input.imageListId ?? '').trim();
  const item = String(input.imageItem ?? '').trim();
  if (!listId && !item) return '';
  const binding = parseButtonImageBinding(`${listId}.${item}`);
  return `${binding.imageListId}.${binding.imageItem}`;
}

export function parsePatchButtonDeclaration(value) {
  const source = String(value ?? '').trim();
  const match = source.match(/^button\s+(.+?)\s+as\s+([A-Za-z_]\w*)(?:\s+image\s+(.+))?\s*$/i);
  if (!match) {
    throw new PatchButtonImageError(
      "Button syntax is 'button \"Label\" as <name>' or 'button \"Label\" as <name> image list.item'.",
      'BUTTON_SOURCE_SYNTAX'
    );
  }
  const textExpr = String(match[1]).trim();
  if (!textExpr) {
    throw new PatchButtonImageError('Button text cannot be empty.', 'BUTTON_SOURCE_TEXT');
  }
  const id = match[2];
  if (!PATCH_NAME.test(id)) {
    throw new PatchButtonImageError(`'${id}' is not a valid Patch Button name.`, 'BUTTON_SOURCE_ID');
  }
  let binding = null;
  if (match[3] !== undefined) {
    const rest = String(match[3]).trim();
    if (!rest) {
      throw new PatchButtonImageError("Button 'image' needs an ImageList.item binding.", 'BUTTON_IMAGE_VALUE');
    }
    binding = parseButtonImageBinding(rest);
  }
  return freezeButton({
    textExpr,
    id,
    imageListId: binding?.imageListId ?? null,
    imageItem: binding?.imageItem ?? null
  });
}

export function formatPatchButtonDeclaration(input = {}) {
  const parsed = freezeButton(input);
  const parts = ['button', parsed.textExpr, 'as', parsed.id];
  if (parsed.imageListId && parsed.imageItem) {
    parts.push('image', `${parsed.imageListId}.${parsed.imageItem}`);
  }
  return parts.join(' ');
}

export function collectWindowImageLists(nodes) {
  const lists = new Map();
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl' && node.control === 'imagelist' && node.id) {
      lists.set(node.id, node);
    }
  }
  return lists;
}

export function resolveButtonImageBinding(lists, binding, line = null) {
  if (!binding?.imageListId || !binding?.imageItem) return null;
  const list = lists instanceof Map ? lists.get(binding.imageListId) : lists?.[binding.imageListId];
  const where = line == null ? 'Button' : `line ${line}: Button`;
  if (!list) {
    throw new PatchButtonImageError(
      `${where} image ${binding.imageListId}.${binding.imageItem} refers to ImageList '${binding.imageListId}' that is not defined on this Form.`,
      'BUTTON_IMAGE_LIST_MISSING'
    );
  }
  const item = (list.items ?? []).find(entry => entry.name === binding.imageItem);
  if (!item) {
    throw new PatchButtonImageError(
      `${where} image ${binding.imageListId}.${binding.imageItem} refers to ImageList item '${binding.imageItem}' that is not in '${binding.imageListId}'.`,
      'BUTTON_IMAGE_ITEM_MISSING'
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

export function nativeButtonImageUnsupportedMessage(node, line = null) {
  if (!node?.imageListId || !node?.imageItem) return null;
  const where = line == null ? 'native GUI Button' : `line ${line}: native GUI Button`;
  return `${where} does not transport image ${node.imageListId}.${node.imageItem}. ImageList consumers remain fail-closed on desktop until a versioned native contract transports them.`;
}

export function hasButtonImageBinding(node) {
  return Boolean(node?.imageListId && node?.imageItem);
}

function freezeButton(input) {
  const id = String(input.id ?? '').trim();
  if (!PATCH_NAME.test(id)) {
    throw new PatchButtonImageError(`'${id || '?'}' is not a valid Patch Button name.`, 'BUTTON_SOURCE_ID');
  }
  const textExpr = String(input.textExpr ?? '').trim();
  if (!textExpr) {
    throw new PatchButtonImageError('Button text cannot be empty.', 'BUTTON_SOURCE_TEXT');
  }
  let imageListId = trimOrNull(input.imageListId);
  let imageItem = trimOrNull(input.imageItem);
  if (imageListId || imageItem) {
    const binding = parseButtonImageBinding(`${imageListId ?? ''}.${imageItem ?? ''}`);
    imageListId = binding.imageListId;
    imageItem = binding.imageItem;
  }
  return Object.freeze({
    id,
    textExpr,
    imageListId,
    imageItem
  });
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}
