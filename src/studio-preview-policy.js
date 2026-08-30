export const PATCH_STUDIO_PREVIEW_POLICY_VERSION = 'studio-preview-policy/0.1';
export const PATCH_STUDIO_DESIGNER_TABLE_ROW_LIMIT = 120;
export const PATCH_STUDIO_DESIGNER_TREE_NODE_LIMIT = 200;

const LIMITS = Object.freeze({
  table: PATCH_STUDIO_DESIGNER_TABLE_ROW_LIMIT,
  tree: PATCH_STUDIO_DESIGNER_TREE_NODE_LIMIT
});

export function createStudioDesignerPreviewPlan(kind, total) {
  if (!Object.hasOwn(LIMITS, kind)) throw new Error(`Unknown Studio preview kind '${kind}'.`);
  if (!Number.isInteger(total) || total < 0) throw new Error('Studio preview total must be a non-negative integer.');
  const limit = LIMITS[kind];
  const rendered = Math.min(total, limit);
  return Object.freeze({
    version: PATCH_STUDIO_PREVIEW_POLICY_VERSION,
    kind,
    total,
    limit,
    rendered,
    omitted: total - rendered,
    truncated: total > rendered
  });
}
