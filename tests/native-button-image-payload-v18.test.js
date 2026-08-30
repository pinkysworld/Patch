import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV18 } from '../src/native-gui-ir-v18.js';
import { inspectNativeGuiPaintImagesV17 } from '../src/sealed-native-gui-v17.js';
import {
  PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_VERSION,
  encodeNativeGuiPayloadV18,
  inspectNativeGuiButtonImagesV18,
  decodeNativeGuiPayloadV18,
  sealNativeGuiRuntimeV18
} from '../src/sealed-native-gui-v18.js';
import { adaptNativeButtonImagesForV18Backend } from '../src/native-button-image-backend-adapter.js';

const SOURCE = `window "Files" as main size 460, 240:
  imagelist as app_images size 20, 18:
    image open from "patch-resource:icons.open"
    image save from "patch-resource:icons.save"
  button "Open" as open_button image app_images.open at 24, 24 size 120, 36
  button "Open again" as open_again image app_images.open at 24, 72 size 140, 36
`;

const OPEN = Object.freeze({
  id: 'icons.open',
  path: 'resources/open.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});
const SAVE = Object.freeze({
  id: 'icons.save',
  path: 'resources/save.jpg',
  mediaType: 'image/jpeg',
  size: 1,
  sha256: '1'.repeat(64),
  data: 'AA=='
});

function build(source = SOURCE) {
  return buildNativeGuiIRV18(compile(source, { name: 'ButtonImagePayload', kind: 'window', entry: 'main.patch' }));
}

test('payload v18 deduplicates Button ImageList assets and references them by asset index', () => {
  const ir = build();
  const adapted = adaptNativeButtonImagesForV18Backend(ir, [OPEN, SAVE]);
  assert.equal(adapted.assetCount, 1);
  assert.equal(adapted.consumerCount, 2);
  assert.equal(adapted.assets[0].resourceId, 'icons.open');
  assert.equal(adapted.assets[0].dataUri, 'data:image/png;base64,AA==');
  assert.deepEqual(adapted.consumers.map(item => item.assetIndex), [0, 0]);

  const payload = encodeNativeGuiPayloadV18(ir, { resources: [OPEN, SAVE] });
  assert.equal(new TextDecoder().decode(payload.subarray(payload.length - 8, payload.length - 4)), 'BIMG');
  const inspected = inspectNativeGuiButtonImagesV18(payload);
  assert.equal(inspected.assets.length, 1);
  assert.equal(inspected.consumers.length, 2);
  assert.equal(inspected.assets[0].resourceId, 'icons.open');
  assert.equal(inspected.consumers[0].resourceId, 'icons.open');
  assert.equal(inspected.consumers[1].assetIndex, 0);
  assert.equal(inspected.consumers[0].logicalWidth, 20);
  assert.equal(inspected.consumers[0].logicalHeight, 18);
});

test('payload v18 retains an independently valid payload-v17 compatibility prefix', () => {
  const payload = encodeNativeGuiPayloadV18(build(), { resources: [OPEN, SAVE] });
  const inspected = inspectNativeGuiButtonImagesV18(payload);
  const v17 = inspectNativeGuiPaintImagesV17(inspected.payloadV17);
  assert.ok(v17.payloadV16.length > 0);
  assert.equal(inspected.consumers.length, 2);
});

test('payload v18 emits an empty BIMG extension when no Button consumes an ImageList', () => {
  const ir = buildNativeGuiIRV18(compile(`window "Plain" as main size 320, 180:
  button "OK" as ok_button at 24, 24 size 100, 36
`, { name: 'Plain', kind: 'window' }));
  const payload = encodeNativeGuiPayloadV18(ir);
  const inspected = inspectNativeGuiButtonImagesV18(payload);
  assert.equal(inspected.assets.length, 0);
  assert.equal(inspected.consumers.length, 0);
  assert.ok(inspected.payloadV17.length > 0);
});

test('payload v18 seals and decodes with footer version 18', () => {
  const sealed = sealNativeGuiRuntimeV18(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), build(), {
    platform: 'windows',
    resources: [OPEN, SAVE]
  });
  assert.equal(PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_VERSION, 18);
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12).getUint32(0, true), 18);
  const payload = decodeNativeGuiPayloadV18(sealed);
  assert.equal(inspectNativeGuiButtonImagesV18(payload).consumers.length, 2);
});

test('payload v18 fails closed on missing and deferred-format Button resources', () => {
  const ir = build();
  assert.throws(
    () => encodeNativeGuiPayloadV18(ir, { resources: [] }),
    error => error?.code === 'NATIVE_BUTTON_IMAGE_RESOURCE_MISSING' && /icons\.open/.test(error.message)
  );
  const svg = { ...OPEN, path: 'resources/open.svg', mediaType: 'image/svg+xml' };
  assert.throws(
    () => encodeNativeGuiPayloadV18(ir, { resources: [svg, SAVE] }),
    /deferred|PNG and JPEG only|native-picture-formats/i
  );
});
