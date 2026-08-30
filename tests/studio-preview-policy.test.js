import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_PREVIEW_POLICY_VERSION,
  PATCH_STUDIO_DESIGNER_TABLE_ROW_LIMIT,
  PATCH_STUDIO_DESIGNER_TREE_NODE_LIMIT,
  createStudioDesignerPreviewPlan
} from '../src/studio-preview-policy.js';

test('Studio preview policy is versioned and bounds large Designer Table/Tree previews', () => {
  assert.equal(PATCH_STUDIO_PREVIEW_POLICY_VERSION, 'studio-preview-policy/0.1');
  assert.equal(PATCH_STUDIO_DESIGNER_TABLE_ROW_LIMIT, 120);
  assert.equal(PATCH_STUDIO_DESIGNER_TREE_NODE_LIMIT, 200);

  assert.deepEqual(createStudioDesignerPreviewPlan('table', 1500), {
    version: PATCH_STUDIO_PREVIEW_POLICY_VERSION,
    kind: 'table',
    total: 1500,
    limit: 120,
    rendered: 120,
    omitted: 1380,
    truncated: true
  });
  assert.deepEqual(createStudioDesignerPreviewPlan('tree', 1500), {
    version: PATCH_STUDIO_PREVIEW_POLICY_VERSION,
    kind: 'tree',
    total: 1500,
    limit: 200,
    rendered: 200,
    omitted: 1300,
    truncated: true
  });
});

test('small previews remain complete and invalid inputs fail closed', () => {
  assert.equal(createStudioDesignerPreviewPlan('table', 4).truncated, false);
  assert.equal(createStudioDesignerPreviewPlan('tree', 11).rendered, 11);
  assert.throws(() => createStudioDesignerPreviewPlan('unknown', 1), /Unknown Studio preview kind/);
  assert.throws(() => createStudioDesignerPreviewPlan('table', -1), /non-negative integer/);
  assert.throws(() => createStudioDesignerPreviewPlan('tree', 1.5), /non-negative integer/);
});
