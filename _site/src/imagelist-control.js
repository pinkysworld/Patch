export const PATCH_IMAGELIST_STAGE = 1;
export const PATCH_IMAGELIST_MAX_ITEMS = 256;
export const PATCH_IMAGELIST_MIN_LOGICAL_SIZE = 1;
export const PATCH_IMAGELIST_MAX_LOGICAL_SIZE = 512;

const PATCH_NAME = /^[A-Za-z_]\w*$/;
const RESOURCE_ID = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const RESOURCE_PREFIX = 'patch-resource:';

export class PatchImageListError extends Error {
  constructor(message, code = 'PATCH_IMAGELIST_INVALID') {
    super(message);
    this.name = 'PatchImageListError';
    this.code = code;
  }
}

export function normalizeImageListId(value) {
  const id = String(value ?? '').trim();
  if (!PATCH_NAME.test(id)) {
    throw new PatchImageListError(`ImageList name '${id || '?'}' is not a valid Patch name.`, 'PATCH_IMAGELIST_ID');
  }
  return id;
}

export function normalizeImageListItemName(value) {
  const name = String(value ?? '').trim();
  if (!PATCH_NAME.test(name)) {
    throw new PatchImageListError(`ImageList item name '${name || '?'}' is not a valid Patch name.`, 'PATCH_IMAGELIST_ITEM_NAME');
  }
  return name;
}

export function normalizeImageListLogicalSize(widthValue, heightValue) {
  return Object.freeze({
    width: logicalDimension(widthValue, 'width'),
    height: logicalDimension(heightValue, 'height')
  });
}

export function normalizeImageListResourceExpression(value) {
  const expression = String(value ?? '').trim();
  let locator;
  try {
    locator = JSON.parse(expression);
  } catch {
    throw new PatchImageListError(
      'ImageList resources must use a quoted project locator such as "patch-resource:icons.open".',
      'PATCH_IMAGELIST_RESOURCE'
    );
  }
  if (typeof locator !== 'string' || !locator.startsWith(RESOURCE_PREFIX)) {
    throw new PatchImageListError(
      'ImageList resources must use a patch-resource locator.',
      'PATCH_IMAGELIST_RESOURCE'
    );
  }
  const resourceId = locator.slice(RESOURCE_PREFIX.length);
  if (!RESOURCE_ID.test(resourceId)) {
    throw new PatchImageListError(
      `ImageList resource id '${resourceId || '?'}' is invalid.`,
      'PATCH_IMAGELIST_RESOURCE'
    );
  }
  return Object.freeze({
    resourceId,
    locator: `${RESOURCE_PREFIX}${resourceId}`,
    sourceExpr: JSON.stringify(`${RESOURCE_PREFIX}${resourceId}`)
  });
}

export function normalizeImageListItems(value) {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new PatchImageListError('ImageList items must be an array.');
  if (value.length > PATCH_IMAGELIST_MAX_ITEMS) {
    throw new PatchImageListError(
      `ImageList contains more than ${PATCH_IMAGELIST_MAX_ITEMS} images.`,
      'PATCH_IMAGELIST_TOO_MANY_ITEMS'
    );
  }
  const names = new Set();
  const items = value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new PatchImageListError('Each ImageList item must have a name and resource source.');
    }
    const name = normalizeImageListItemName(item.name);
    if (names.has(name)) {
      throw new PatchImageListError(`ImageList item '${name}' appears more than once.`, 'PATCH_IMAGELIST_DUPLICATE_ITEM');
    }
    names.add(name);
    const resource = normalizeImageListResourceExpression(item.sourceExpr);
    return Object.freeze({ name, sourceExpr: resource.sourceExpr, resourceId: resource.resourceId });
  });
  return Object.freeze(items);
}

export function normalizeImageListDefinition(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PatchImageListError('ImageList definition must be an object.');
  }
  const id = normalizeImageListId(value.id);
  const size = normalizeImageListLogicalSize(value.width, value.height);
  const items = normalizeImageListItems(value.items);
  return Object.freeze({ id, width: size.width, height: size.height, items });
}

export function formatPatchImageListSource(value, options = {}) {
  const list = normalizeImageListDefinition(value);
  const indent = String(options.indent ?? '');
  const childIndent = `${indent}  `;
  const lines = [`${indent}imagelist as ${list.id} size ${list.width}, ${list.height}:`];
  for (const item of list.items) {
    lines.push(`${childIndent}image ${item.name} from ${item.sourceExpr}`);
  }
  return lines.join('\n');
}

function logicalDimension(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < PATCH_IMAGELIST_MIN_LOGICAL_SIZE || number > PATCH_IMAGELIST_MAX_LOGICAL_SIZE) {
    throw new PatchImageListError(
      `ImageList logical ${label} must be a whole number from ${PATCH_IMAGELIST_MIN_LOGICAL_SIZE} to ${PATCH_IMAGELIST_MAX_LOGICAL_SIZE}.`,
      'PATCH_IMAGELIST_SIZE'
    );
  }
  return number;
}
