import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_IMAGELIST_MAX_ITEMS,
  PATCH_IMAGELIST_MAX_INLINE_SOURCE_CHARS,
  PATCH_IMAGELIST_STAGE,
  formatPatchImageListSource,
  normalizeImageListDefinition,
  normalizeImageListItems,
  normalizeImageListLogicalSize,
  normalizeImageListResourceExpression
} from '../src/imagelist-control.js';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/6F3+WQAAAABJRU5ErkJggg==';

test('ImageList Stage 1 normalizes logical size and static project resource items', () => {
  assert.equal(PATCH_IMAGELIST_STAGE, 1);
  const list = normalizeImageListDefinition({
    id: 'app_images',
    width: 16,
    height: 20,
    items: [
      { name: 'open', sourceExpr: '"patch-resource:icons.open"' },
      { name: 'save', sourceExpr: '"patch-resource:icons.save"' }
    ]
  });
  assert.equal(list.id, 'app_images');
  assert.equal(list.width, 16);
  assert.equal(list.height, 20);
  assert.deepEqual(list.items.map(item => ({ name: item.name, resourceId: item.resourceId })), [
    { name: 'open', resourceId: 'icons.open' },
    { name: 'save', resourceId: 'icons.save' }
  ]);
  assert.equal(Object.isFrozen(list), true);
  assert.equal(Object.isFrozen(list.items), true);
});

test('ImageList source formatting is deterministic and resource-backed', () => {
  const source = formatPatchImageListSource({
    id: 'toolbar_images',
    width: 24,
    height: 24,
    items: [
      { name: 'new_file', sourceExpr: '"patch-resource:toolbar.new"' },
      { name: 'open_file', sourceExpr: '"patch-resource:toolbar.open"' }
    ]
  }, { indent: '  ' });
  assert.equal(source, [
    '  imagelist as toolbar_images size 24, 24:',
    '    image new_file from "patch-resource:toolbar.new"',
    '    image open_file from "patch-resource:toolbar.open"'
  ].join('\n'));
});

test('ImageList may start empty and later receive resources through Designer', () => {
  const items = normalizeImageListItems([]);
  assert.deepEqual(items, []);
  assert.equal(formatPatchImageListSource({ id: 'images', width: 16, height: 16, items: [] }), 'imagelist as images size 16, 16:');
});

test('ImageList source accepts canonical project resources and bounded inline PNG/JPEG data', () => {
  assert.deepEqual(normalizeImageListResourceExpression('"patch-resource:app.logo"'), {
    resourceId: 'app.logo',
    locator: 'patch-resource:app.logo',
    sourceExpr: '"patch-resource:app.logo"'
  });
  const inline = normalizeImageListResourceExpression(JSON.stringify(TINY_PNG));
  assert.match(inline.resourceId, /^inline-[0-9a-f]{8}$/);
  assert.equal(inline.locator, TINY_PNG);
  assert.equal(inline.sourceExpr, JSON.stringify(TINY_PNG));
  assert.throws(() => normalizeImageListResourceExpression('"https://example.test/icon.png"'), /patch-resource locator or bounded inline PNG\/JPEG/);
  assert.throws(() => normalizeImageListResourceExpression('dynamic_icon'), /quoted project locator or bounded inline PNG\/JPEG/);
  assert.throws(() => normalizeImageListResourceExpression('"patch-resource:../escape"'), /resource id/);
  assert.throws(
    () => normalizeImageListResourceExpression(JSON.stringify(`data:image/png;base64,${'A'.repeat(PATCH_IMAGELIST_MAX_INLINE_SOURCE_CHARS)}`)),
    /exceeds/
  );
});

test('ImageList rejects duplicate names, unsafe names and excessive items', () => {
  assert.throws(() => normalizeImageListItems([
    { name: 'open', sourceExpr: '"patch-resource:icons.open"' },
    { name: 'open', sourceExpr: '"patch-resource:icons.open2"' }
  ]), /appears more than once/);
  assert.throws(() => normalizeImageListItems([
    { name: 'not-valid!', sourceExpr: '"patch-resource:icons.open"' }
  ]), /not a valid Patch name/);
  assert.throws(() => normalizeImageListItems(Array.from({ length: PATCH_IMAGELIST_MAX_ITEMS + 1 }, (_, index) => ({
    name: `image_${index}`,
    sourceExpr: '"patch-resource:icons.open"'
  }))), /more than/);
});

test('ImageList logical dimensions stay bounded and platform-neutral', () => {
  assert.deepEqual(normalizeImageListLogicalSize(1, 512), { width: 1, height: 512 });
  assert.throws(() => normalizeImageListLogicalSize(0, 16), /from 1 to 512/);
  assert.throws(() => normalizeImageListLogicalSize(16.5, 16), /whole number/);
  assert.throws(() => normalizeImageListLogicalSize(16, 513), /from 1 to 512/);
});
