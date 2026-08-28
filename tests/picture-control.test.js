import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_PICTURE_DISPLAY_DEFAULTS,
  PATCH_PICTURE_DISPLAY_VERSION,
  PATCH_PICTURE_FIT_MODES,
  applyPatchPictureProportional,
  isDefaultPatchPictureDisplay,
  nativePictureDisplayUnsupportedMessage,
  normalizePatchPictureDisplay,
  patchPictureCssStyle
} from '../src/picture-control.js';

test('Picture display defaults are contain, centered and fully opaque', () => {
  assert.equal(PATCH_PICTURE_DISPLAY_VERSION, '0.1');
  assert.deepEqual(PATCH_PICTURE_FIT_MODES, ['contain', 'cover', 'fill', 'none']);
  assert.deepEqual(normalizePatchPictureDisplay({}), {
    fit: 'contain',
    center: true,
    opacity: 1,
    description: '',
    proportional: true
  });
  assert.equal(isDefaultPatchPictureDisplay({}), true);
  assert.deepEqual(PATCH_PICTURE_DISPLAY_DEFAULTS, { fit: 'contain', center: true, opacity: 1, description: '' });
});

test('Picture proportional is derived from fit and maps inspector sugar onto fill/contain', () => {
  assert.equal(normalizePatchPictureDisplay({ fit: 'cover' }).proportional, true);
  assert.equal(normalizePatchPictureDisplay({ fit: 'fill' }).proportional, false);
  assert.equal(applyPatchPictureProportional('cover', true), 'cover');
  assert.equal(applyPatchPictureProportional('fill', true), 'contain');
  assert.equal(applyPatchPictureProportional('cover', false), 'fill');
});

test('Picture CSS maps fit, center and opacity without a second layout model', () => {
  assert.deepEqual(patchPictureCssStyle({ fit: 'cover', center: false, opacity: 0.4 }), {
    objectFit: 'cover',
    objectPosition: '0% 0%',
    opacity: '0.4'
  });
  assert.equal(patchPictureCssStyle({}).objectPosition, '50% 50%');
});

test('native Picture display diagnostic names only non-default fit, center and opacity', () => {
  assert.equal(nativePictureDisplayUnsupportedMessage({ description: 'Logo' }), null);
  assert.match(nativePictureDisplayUnsupportedMessage({ fit: 'cover' }, 4), /line 4:.*fit cover/);
  assert.match(nativePictureDisplayUnsupportedMessage({ center: false, opacity: 0.5 }), /center false, opacity 0\.5/);
  assert.doesNotMatch(nativePictureDisplayUnsupportedMessage({ fit: 'fill', description: 'Hero' }), /description/);
});

test('Picture display normalization fails closed for unknown fit, center and opacity', () => {
  assert.throws(() => normalizePatchPictureDisplay({ fit: 'stretch' }), error => error?.code === 'PICTURE_FIT');
  assert.throws(() => normalizePatchPictureDisplay({ center: 'maybe' }), error => error?.code === 'PICTURE_CENTER');
  assert.throws(() => normalizePatchPictureDisplay({ opacity: 2 }), error => error?.code === 'PICTURE_OPACITY');
});
