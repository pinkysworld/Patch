import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_NATIVE_PICTURE_FORMAT_POLICY,
  PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
  PATCH_NATIVE_PICTURE_MEDIA_TYPES,
  PATCH_NATIVE_PICTURE_READY_MEDIA_TYPES,
  PATCH_NATIVE_PICTURE_DEFERRED_MEDIA_TYPES,
  NativePictureFormatError,
  nativePictureMediaTypeStatus,
  inspectNativePictureSourceFormat,
  assertNativePictureMediaTypeAllowed,
  assertNativePictureSourceFormat
} from '../src/native-picture-format-policy.js';
import { currentNativeContract } from '../src/native-current-contract.js';

test('native Picture format policy 1.0 is independent of Native GUI IR 1.4', () => {
  assert.equal(PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID, 'native-picture-formats/1.0');
  assert.equal(PATCH_NATIVE_PICTURE_FORMAT_POLICY.id, 'native-picture-formats/1.0');
  assert.equal(PATCH_NATIVE_PICTURE_FORMAT_POLICY.version, '1.0');
  assert.equal(PATCH_NATIVE_PICTURE_FORMAT_POLICY.nativeGuiIR, '1.4');
  assert.equal(PATCH_NATIVE_PICTURE_FORMAT_POLICY.payload, 14);
  assert.equal(PATCH_NATIVE_PICTURE_FORMAT_POLICY.runtime, '1.5');
  assert.deepEqual(PATCH_NATIVE_PICTURE_READY_MEDIA_TYPES, ['image/png', 'image/jpeg']);
  assert.deepEqual(PATCH_NATIVE_PICTURE_DEFERRED_MEDIA_TYPES, ['image/webp', 'image/svg+xml']);
  assert.equal(PATCH_NATIVE_PICTURE_MEDIA_TYPES, PATCH_NATIVE_PICTURE_READY_MEDIA_TYPES);
  assert.deepEqual(PATCH_NATIVE_PICTURE_FORMAT_POLICY.studioWeb, [
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'
  ]);
  assert.deepEqual(currentNativeContract(), {
    id: 'native-gui-1.4/payload-14/runtime-1.5',
    guiIr: '1.4',
    payload: 14,
    runtime: '1.5',
    runtimeTags: currentNativeContract().runtimeTags
  });
  assert.equal('pictureFormats' in currentNativeContract(), false);
});

test('native Picture media-type status distinguishes Ready, deferred and unsupported', () => {
  assert.equal(nativePictureMediaTypeStatus('image/png'), 'ready');
  assert.equal(nativePictureMediaTypeStatus('image/jpeg'), 'ready');
  assert.equal(nativePictureMediaTypeStatus('IMAGE/PNG'), 'ready');
  assert.equal(nativePictureMediaTypeStatus('image/webp'), 'deferred');
  assert.equal(nativePictureMediaTypeStatus('image/svg+xml'), 'deferred');
  assert.equal(nativePictureMediaTypeStatus('image/gif'), 'unsupported');
  assert.equal(nativePictureMediaTypeStatus(''), 'empty');
  assert.equal(assertNativePictureMediaTypeAllowed('image/jpeg'), 'ready');
  assert.throws(
    () => assertNativePictureMediaTypeAllowed('image/webp'),
    error => error instanceof NativePictureFormatError
      && error.code === 'NATIVE_PICTURE_FORMAT_DEFERRED'
      && error.policy === 'native-picture-formats/1.0'
      && /deferred by native-picture-formats\/1\.0/.test(error.message)
  );
  assert.throws(
    () => assertNativePictureMediaTypeAllowed('image/gif'),
    error => error instanceof NativePictureFormatError
      && error.code === 'NATIVE_PICTURE_FORMAT'
      && /outside native-picture-formats\/1\.0/.test(error.message)
  );
});

test('native Picture source inspection classifies data URIs, deferred paths and opaque PNG paths', () => {
  assert.deepEqual(inspectNativePictureSourceFormat(''), {
    kind: 'empty', source: '', mediaType: null, status: 'empty'
  });
  assert.equal(inspectNativePictureSourceFormat('patch-resource:app.logo').status, 'resource');
  assert.equal(inspectNativePictureSourceFormat('data:image/png;base64,AA==').status, 'ready');
  assert.equal(inspectNativePictureSourceFormat('data:image/jpeg;base64,AA==').mediaType, 'image/jpeg');
  assert.equal(inspectNativePictureSourceFormat('data:image/webp;base64,AA==').status, 'deferred');
  assert.equal(inspectNativePictureSourceFormat('data:image/svg+xml;utf8,<svg/>').status, 'deferred');
  assert.equal(inspectNativePictureSourceFormat('data:image/gif;base64,AA==').status, 'unsupported');
  assert.equal(inspectNativePictureSourceFormat('data:not-an-image').status, 'unsupported');
  assert.equal(inspectNativePictureSourceFormat('images/photo.webp').status, 'deferred');
  assert.equal(inspectNativePictureSourceFormat('icons/mark.svg?cache=1').mediaType, 'image/svg+xml');
  assert.deepEqual(inspectNativePictureSourceFormat('images/photo.png'), {
    kind: 'opaque', source: 'images/photo.png', mediaType: null, status: 'opaque'
  });
  assert.equal(assertNativePictureSourceFormat('data:image/png;base64,AA==').status, 'ready');
  assert.equal(assertNativePictureSourceFormat('images/photo.png').status, 'opaque');
  assert.throws(
    () => assertNativePictureSourceFormat('data:image/webp;base64,AA==', { controlId: 'logo' }),
    error => error instanceof NativePictureFormatError
      && error.code === 'NATIVE_PICTURE_FORMAT_DEFERRED'
      && /Native Picture 'logo'/.test(error.message)
      && /Win32, AppKit and GTK/.test(error.message)
  );
  assert.throws(
    () => assertNativePictureSourceFormat('brand.svg'),
    error => error.code === 'NATIVE_PICTURE_FORMAT_DEFERRED' && /image\/svg\+xml/.test(error.message)
  );
});
