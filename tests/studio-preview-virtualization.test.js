import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATCH_STUDIO_PREVIEW_TABLE_THRESHOLD,
  PATCH_STUDIO_PREVIEW_TREE_THRESHOLD,
  flattenStudioTreePreview,
  resolveStudioPreviewWindow
} from '../web/studio-preview-virtualization.js';

test('large preview windows keep DOM work bounded while retaining total extent', () => {
  const table = resolveStudioPreviewWindow({
    itemCount: 10_000,
    scrollOffset: 160_000,
    viewportSize: 320,
    itemExtent: 32,
    threshold: PATCH_STUDIO_PREVIEW_TABLE_THRESHOLD,
    overscan: 8
  });
  assert.equal(table.virtualized, true);
  assert.ok(table.renderedItems <= 26);
  assert.equal(table.beforeExtent + (table.renderedItems * 32) + table.afterExtent, table.totalExtent);

  const tree = resolveStudioPreviewWindow({
    itemCount: 20_000,
    scrollOffset: 64_000,
    viewportSize: 320,
    itemExtent: 32,
    threshold: PATCH_STUDIO_PREVIEW_TREE_THRESHOLD,
    overscan: 8
  });
  assert.equal(tree.virtualized, true);
  assert.ok(tree.renderedItems <= 26);
});

test('normal previews retain the complete DOM path', () => {
  const window = resolveStudioPreviewWindow({
    itemCount: 40,
    viewportSize: 320,
    threshold: PATCH_STUDIO_PREVIEW_TABLE_THRESHOLD
  });
  assert.equal(window.virtualized, false);
  assert.deepEqual([window.start, window.end, window.renderedItems], [0, 40, 40]);
});

test('tree flattening preserves source order, depth and semantic paths', () => {
  const flat = flattenStudioTreePreview([
    { text: 'src', children: [{ text: 'parser.js' }, { text: 'compiler.js' }] },
    { text: 'README.md' }
  ]);
  assert.deepEqual(flat.map(item => [item.path.join('/'), item.depth]), [
    ['src', 0],
    ['src/parser.js', 1],
    ['src/compiler.js', 1],
    ['README.md', 0]
  ]);
});

test('virtualization is designer-only and runtime selection paths remain unchanged', () => {
  const tableSource = fs.readFileSync('web/table-stage1.js', 'utf8');
  const rendererSource = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  assert.match(tableSource, /!options\.interactive && rows\.length > PATCH_STUDIO_PREVIEW_TABLE_THRESHOLD/);
  assert.match(rendererSource, /!context\.interactive && flatNodes\.length > PATCH_STUDIO_PREVIEW_TREE_THRESHOLD/);
  assert.match(rendererSource, /if \(context\.interactive\) button\.addEventListener\('click'/);
});
