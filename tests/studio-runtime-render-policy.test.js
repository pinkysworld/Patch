import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL,
  PATCH_STUDIO_RUNTIME_RENDER_MODE_INCREMENTAL,
  PATCH_STUDIO_RUNTIME_RENDER_POLICY_VERSION,
  PATCH_STUDIO_RUNTIME_RENDER_QUERY_KEY,
  resolveStudioRuntimeRenderMode
} from '../web/studio-runtime-render-policy.js';

test('Studio runtime render policy defaults to keyed incremental reconciliation', () => {
  assert.equal(PATCH_STUDIO_RUNTIME_RENDER_POLICY_VERSION, '0.1');
  assert.equal(PATCH_STUDIO_RUNTIME_RENDER_QUERY_KEY, 'patch-runtime-render');
  assert.equal(resolveStudioRuntimeRenderMode(''), PATCH_STUDIO_RUNTIME_RENDER_MODE_INCREMENTAL);
  assert.equal(resolveStudioRuntimeRenderMode('?other=full'), PATCH_STUDIO_RUNTIME_RENDER_MODE_INCREMENTAL);
});

test('Studio runtime render policy accepts only the explicit full fallback value', () => {
  assert.equal(resolveStudioRuntimeRenderMode('?patch-runtime-render=full'), PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL);
  assert.equal(resolveStudioRuntimeRenderMode('?x=1&patch-runtime-render=full&y=2'), PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL);
  assert.equal(resolveStudioRuntimeRenderMode('?patch-runtime-render=FULL'), PATCH_STUDIO_RUNTIME_RENDER_MODE_INCREMENTAL);
  assert.equal(resolveStudioRuntimeRenderMode('?patch-runtime-render=keyed-control-v2'), PATCH_STUDIO_RUNTIME_RENDER_MODE_INCREMENTAL);
  assert.equal(resolveStudioRuntimeRenderMode('?patch-runtime-render=unknown'), PATCH_STUDIO_RUNTIME_RENDER_MODE_INCREMENTAL);
});
