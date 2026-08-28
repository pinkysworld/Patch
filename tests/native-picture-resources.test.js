import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import {
  buildCurrentNativeGuiIR,
  sealCurrentNativeGuiRuntime,
  decodeCurrentNativeGuiPayload,
  inspectCurrentNativeGuiChrome
} from '../src/native-current-contract.js';
import {
  PATCH_NATIVE_PICTURE_MEDIA_TYPES,
  PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
  resolveNativePictureResources,
  nativePictureResourceDataUri
} from '../src/native-picture-resources.js';
import { NativePictureFormatError } from '../src/native-picture-format-policy.js';

const RESOURCE = Object.freeze({
  id: 'app.logo',
  path: 'resources/logo.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});

const SOURCE = `window "Photos" as main size 420, 260:\n  picture as logo from "patch-resource:app.logo" at 24, 24 size 180, 120\n`;

function nativeIr(source = SOURCE) {
  return buildCurrentNativeGuiIR(compile(source, { name: 'Photos', kind: 'window', entry: 'main.patch' }));
}

test('native Picture resource resolver clones IR and embeds deterministic data URI', () => {
  const input = nativeIr();
  const before = JSON.stringify(input);
  const resolved = resolveNativePictureResources(input, [RESOURCE]);
  assert.equal(resolved.resolvedCount, 1);
  assert.equal(resolved.resourceCount, 1);
  assert.equal(resolved.policy, 'native-picture-formats/1.0');
  assert.deepEqual(resolved.resolved[0], {
    control: 'logo',
    resourceId: 'app.logo',
    mediaType: 'image/png',
    size: 1,
    sha256: '0'.repeat(64),
    policy: 'native-picture-formats/1.0'
  });
  const picture = resolved.ir.forms[0].controls.find(control => control.type === 'picture');
  assert.equal(picture.source, 'data:image/png;base64,AA==');
  assert.equal(JSON.stringify(input), before);
  assert.equal(nativePictureResourceDataUri(RESOURCE), 'data:image/png;base64,AA==');
  assert.deepEqual(PATCH_NATIVE_PICTURE_MEDIA_TYPES, ['image/png', 'image/jpeg']);
  assert.equal(PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID, 'native-picture-formats/1.0');
});

test('current native seal contract carries resolved Picture bytes through payload v14', () => {
  const input = nativeIr();
  const runtime = new Uint8Array([0x4d, 0x5a]);
  const sealed = sealCurrentNativeGuiRuntime(runtime, input, { platform: 'windows', resources: [RESOURCE] });
  const payload = decodeCurrentNativeGuiPayload(sealed);
  const chrome = inspectCurrentNativeGuiChrome(payload).chrome;
  const picture = chrome.find(item => item.type === 'picture');
  assert.ok(picture);
  assert.equal(picture.id, 'logo');
  assert.equal(picture.source, 'data:image/png;base64,AA==');
  assert.equal(input.forms[0].controls.find(control => control.type === 'picture').source, 'patch-resource:app.logo');
});

test('current native sealing fails closed for missing logical Picture resources', () => {
  const input = nativeIr();
  assert.throws(
    () => sealCurrentNativeGuiRuntime(new Uint8Array([0x4d, 0x5a]), input, { platform: 'windows' }),
    error => error?.code === 'NATIVE_PICTURE_RESOURCE_MISSING' && /app\.logo/.test(error.message)
  );
});

test('native Picture project resources reject WebP and SVG before sealing for cross-host parity', () => {
  for (const mediaType of ['image/webp', 'image/svg+xml']) {
    const extension = mediaType === 'image/webp' ? 'webp' : 'svg';
    const resource = { ...RESOURCE, path: `resources/logo.${extension}`, mediaType };
    assert.throws(
      () => resolveNativePictureResources(nativeIr(), [resource]),
      error => error?.code === 'NATIVE_PICTURE_RESOURCE_FORMAT'
        && error?.policy === 'native-picture-formats/1.0'
        && /PNG and JPEG/.test(error.message)
        && /deferred by native-picture-formats\/1\.0/.test(error.message)
    );
  }
});

test('native Picture JPEG project resources remain Ready under format policy 1.0', () => {
  const resource = { ...RESOURCE, path: 'resources/logo.jpg', mediaType: 'image/jpeg' };
  const resolved = resolveNativePictureResources(nativeIr(), [resource]);
  assert.equal(resolved.resolved[0].mediaType, 'image/jpeg');
  assert.equal(resolved.ir.forms[0].controls.find(control => control.type === 'picture').source, 'data:image/jpeg;base64,AA==');
});

test('ordinary native Picture PNG paths remain unchanged', () => {
  const source = `window "Remote":\n  picture as photo from "images/photo.png"\n`;
  const ir = nativeIr(source);
  const resolved = resolveNativePictureResources(ir, []);
  assert.equal(resolved.resolvedCount, 0);
  assert.equal(resolved.policy, 'native-picture-formats/1.0');
  assert.equal(resolved.ir.forms[0].controls.find(control => control.type === 'picture').source, 'images/photo.png');
});

test('native Picture data-URI and path sources fail closed for deferred WebP and SVG', () => {
  const cases = [
    ['data:image/webp;base64,AA==', 'NATIVE_PICTURE_FORMAT_DEFERRED', /image\/webp/],
    ['data:image/svg+xml;base64,AA==', 'NATIVE_PICTURE_FORMAT_DEFERRED', /image\/svg\+xml/],
    ['data:image/gif;base64,AA==', 'NATIVE_PICTURE_FORMAT', /image\/gif/],
    ['images/photo.webp', 'NATIVE_PICTURE_FORMAT_DEFERRED', /image\/webp/],
    ['icons/mark.svg', 'NATIVE_PICTURE_FORMAT_DEFERRED', /image\/svg\+xml/]
  ];
  for (const [from, code, pattern] of cases) {
    const source = `window "Remote":\n  picture as photo from "${from}"\n`;
    assert.throws(
      () => resolveNativePictureResources(nativeIr(source), []),
      error => error instanceof NativePictureFormatError
        && error.code === code
        && error.policy === 'native-picture-formats/1.0'
        && pattern.test(error.message)
    );
  }
});

test('native Picture PNG and JPEG data URIs remain Ready without IR mutation', () => {
  for (const mediaType of ['image/png', 'image/jpeg']) {
    const from = `data:${mediaType};base64,AA==`;
    const ir = nativeIr(`window "Remote":\n  picture as photo from "${from}"\n`);
    const before = JSON.stringify(ir);
    const resolved = resolveNativePictureResources(ir, []);
    assert.equal(resolved.resolvedCount, 0);
    assert.equal(resolved.ir.forms[0].controls.find(control => control.type === 'picture').source, from);
    assert.equal(JSON.stringify(ir), before);
  }
});

test('current native sealing fails closed for deferred Picture data URIs', () => {
  const ir = nativeIr(`window "Remote":\n  picture as photo from "data:image/webp;base64,AA=="\n`);
  assert.throws(
    () => sealCurrentNativeGuiRuntime(new Uint8Array([0x4d, 0x5a]), ir, { platform: 'linux' }),
    error => error instanceof NativePictureFormatError
      && error.code === 'NATIVE_PICTURE_FORMAT_DEFERRED'
      && /native-picture-formats\/1\.0/.test(error.message)
  );
});
