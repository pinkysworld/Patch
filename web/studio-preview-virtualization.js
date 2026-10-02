export const PATCH_STUDIO_PREVIEW_VIRTUALIZATION_VERSION = '0.1';
export const PATCH_STUDIO_PREVIEW_TABLE_THRESHOLD = 240;
export const PATCH_STUDIO_PREVIEW_TREE_THRESHOLD = 300;
export const PATCH_STUDIO_PREVIEW_OVERSCAN = 8;
export const PATCH_STUDIO_PREVIEW_TABLE_ROW_HEIGHT = 32;
export const PATCH_STUDIO_PREVIEW_TREE_ROW_HEIGHT = 32;
export const PATCH_STUDIO_PREVIEW_DEFAULT_VIEWPORT = 320;

export function resolveStudioPreviewWindow({
  itemCount,
  scrollOffset = 0,
  viewportSize = PATCH_STUDIO_PREVIEW_DEFAULT_VIEWPORT,
  itemExtent = PATCH_STUDIO_PREVIEW_TABLE_ROW_HEIGHT,
  threshold = PATCH_STUDIO_PREVIEW_TABLE_THRESHOLD,
  overscan = PATCH_STUDIO_PREVIEW_OVERSCAN
}) {
  const count = normalizeNonNegativeInteger(itemCount, 'itemCount');
  const extent = normalizePositiveNumber(itemExtent, 'itemExtent');
  const viewport = normalizePositiveNumber(viewportSize, 'viewportSize');
  const extra = normalizeNonNegativeInteger(overscan, 'overscan');
  const limit = normalizeNonNegativeInteger(threshold, 'threshold');
  if (count <= limit) {
    return Object.freeze({
      virtualized: false,
      start: 0,
      end: count,
      renderedItems: count,
      beforeExtent: 0,
      afterExtent: 0,
      totalExtent: count * extent
    });
  }

  const offset = Math.max(0, Number(scrollOffset) || 0);
  const visibleItems = Math.max(1, Math.ceil(viewport / extent));
  const anchor = Math.min(count - 1, Math.floor(offset / extent));
  const start = Math.max(0, anchor - extra);
  const end = Math.min(count, start + visibleItems + (extra * 2));
  return Object.freeze({
    virtualized: true,
    start,
    end,
    renderedItems: end - start,
    beforeExtent: start * extent,
    afterExtent: (count - end) * extent,
    totalExtent: count * extent
  });
}

export function flattenStudioTreePreview(nodes) {
  const entries = [];
  const root = Array.isArray(nodes) ? nodes : [];
  const stack = [];
  for (let index = root.length - 1; index >= 0; index -= 1) {
    stack.push({ node: root[index], path: [], depth: 0 });
  }
  while (stack.length) {
    const current = stack.pop();
    const text = String(current.node?.text ?? '');
    const path = [...current.path, text];
    entries.push(Object.freeze({ node: current.node, path: Object.freeze(path), depth: current.depth }));
    const children = Array.isArray(current.node?.children) ? current.node.children : [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], path, depth: current.depth + 1 });
    }
  }
  return Object.freeze(entries);
}

function normalizeNonNegativeInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`${name} must be a non-negative integer.`);
  return number;
}

function normalizePositiveNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${name} must be a positive number.`);
  return number;
}
