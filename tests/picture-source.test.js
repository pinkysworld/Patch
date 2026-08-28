import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_PICTURE_SOURCE_VERSION,
  formatPatchPictureDeclaration,
  parsePatchPictureDeclaration,
  updatePatchPictureDeclaration
} from '../src/picture-source.js';

test('Picture source codec parses concise declarations using canonical defaults', () => {
  assert.equal(PATCH_PICTURE_SOURCE_VERSION, '0.1');
  assert.deepEqual(parsePatchPictureDeclaration('picture as logo'), {
    id: 'logo',
    sourceExpr: null,
    textExpr: null,
    legacyCaption: false,
    fit: 'contain',
    center: true,
    opacity: 1,
    description: '',
    proportional: true
  });
});

test('Picture source codec keeps from-expressions intact and accepts display properties in any order', () => {
  assert.deepEqual(
    parsePatchPictureDeclaration('picture as hero from "images/hero.png" opacity 0.5 description "Hero" fit cover center false'),
    {
      id: 'hero',
      sourceExpr: '"images/hero.png"',
      textExpr: '"Hero"',
      legacyCaption: false,
      fit: 'cover',
      center: false,
      opacity: 0.5,
      description: 'Hero',
      proportional: true
    }
  );
});

test('Picture source formatter omits canonical defaults so existing Picture lines stay stable', () => {
  assert.equal(formatPatchPictureDeclaration({ id: 'picture_1' }), 'picture as picture_1');
  assert.equal(
    formatPatchPictureDeclaration({ id: 'logo', sourceExpr: '"patch-resource:app.logo"' }),
    'picture as logo from "patch-resource:app.logo"'
  );
  assert.equal(
    formatPatchPictureDeclaration({
      id: 'hero',
      sourceExpr: '"images/hero.png"',
      fit: 'cover',
      center: false,
      opacity: 0.5,
      description: 'Hero'
    }),
    'picture as hero from "images/hero.png" fit cover center false opacity 0.5 description "Hero"'
  );
});

test('legacy caption Picture remains a caption form until display properties are added', () => {
  const parsed = parsePatchPictureDeclaration('picture "Preview" as preview');
  assert.equal(parsed.legacyCaption, true);
  assert.equal(parsed.description, 'Preview');
  assert.equal(parsed.textExpr, '"Preview"');
  assert.equal(formatPatchPictureDeclaration(parsed), 'picture "Preview" as preview');
  assert.equal(
    updatePatchPictureDeclaration('picture "Preview" as preview', { fit: 'cover' }),
    'picture as preview fit cover description "Preview"'
  );
});

test('Picture source fails closed for unknown, duplicate or unquoted description properties', () => {
  assert.throws(() => parsePatchPictureDeclaration('image as x'), error => error?.code === 'PICTURE_SOURCE_SYNTAX');
  assert.throws(() => parsePatchPictureDeclaration('picture as x stretch true'), error => error?.code === 'PICTURE_SOURCE_PROPERTY');
  assert.throws(() => parsePatchPictureDeclaration('picture as x fit cover fit fill'), error => error?.code === 'PICTURE_SOURCE_DUPLICATE_PROPERTY');
  assert.throws(() => parsePatchPictureDeclaration('picture as x description Logo'), error => error?.code === 'PICTURE_SOURCE_DESCRIPTION');
  assert.throws(() => parsePatchPictureDeclaration('picture as x from'), error => error?.code === 'PICTURE_SOURCE_VALUE');
  assert.throws(() => formatPatchPictureDeclaration({ id: 'not-valid!' }), error => error?.code === 'PICTURE_SOURCE_ID');
});
