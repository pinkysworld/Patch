import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_BUTTON_IMAGE_BINDING_VERSION,
  PatchButtonImageError,
  collectWindowImageLists,
  formatButtonImageBinding,
  formatPatchButtonDeclaration,
  nativeButtonImageUnsupportedMessage,
  parseButtonImageBinding,
  parsePatchButtonDeclaration,
  resolveButtonImageBinding
} from '../src/button-image.js';

test('Button image bindings parse and format as ImageList.item', () => {
  assert.equal(PATCH_BUTTON_IMAGE_BINDING_VERSION, '1.0');
  assert.deepEqual(parseButtonImageBinding('app_images.open'), { imageListId: 'app_images', imageItem: 'open' });
  assert.equal(formatButtonImageBinding({ imageListId: 'app_images', imageItem: 'open' }), 'app_images.open');
  assert.equal(parseButtonImageBinding(''), null);
  assert.equal(parseButtonImageBinding('   '), null);
  assert.throws(
    () => parseButtonImageBinding('app_images'),
    error => error instanceof PatchButtonImageError && /ImageList\.item/.test(error.message)
  );
});

test('Button declaration codec round-trips optional image bindings and omits them by default', () => {
  assert.deepEqual(parsePatchButtonDeclaration('button "Open" as open_button'), {
    id: 'open_button',
    textExpr: '"Open"',
    imageListId: null,
    imageItem: null
  });
  assert.deepEqual(parsePatchButtonDeclaration('button "Open" as open_button image app_images.open'), {
    id: 'open_button',
    textExpr: '"Open"',
    imageListId: 'app_images',
    imageItem: 'open'
  });
  assert.equal(formatPatchButtonDeclaration({ id: 'open_button', textExpr: '"Open"' }), 'button "Open" as open_button');
  assert.equal(
    formatPatchButtonDeclaration({ id: 'open_button', textExpr: '"Open"', imageListId: 'app_images', imageItem: 'open' }),
    'button "Open" as open_button image app_images.open'
  );
});

test('Button image resolution is Form-scoped and names the missing list or item', () => {
  const lists = collectWindowImageLists([
    {
      kind: 'uiControl',
      control: 'imagelist',
      id: 'app_images',
      logicalWidth: 16,
      logicalHeight: 16,
      items: [{ name: 'open', sourceExpr: '"patch-resource:icons.open"', resourceId: 'icons.open' }]
    }
  ]);
  assert.deepEqual(resolveButtonImageBinding(lists, { imageListId: 'app_images', imageItem: 'open' }), {
    imageListId: 'app_images',
    imageItem: 'open',
    sourceExpr: '"patch-resource:icons.open"',
    resourceId: 'icons.open',
    width: 16,
    height: 16
  });
  assert.throws(
    () => resolveButtonImageBinding(lists, { imageListId: 'missing', imageItem: 'open' }, 4),
    /line 4: Button image missing.open refers to ImageList 'missing'/
  );
  assert.throws(
    () => resolveButtonImageBinding(lists, { imageListId: 'app_images', imageItem: 'save' }, 5),
    /line 5: Button image app_images.save refers to ImageList item 'save'/
  );
});

test('native GUI 1.4 reports Button image bindings instead of silently dropping them', () => {
  assert.equal(nativeButtonImageUnsupportedMessage({ imageListId: null, imageItem: null }), null);
  assert.match(
    nativeButtonImageUnsupportedMessage({ imageListId: 'app_images', imageItem: 'open' }, 3),
    /line 3: native GUI 1.4 Button does not transport image app_images.open/
  );
});
