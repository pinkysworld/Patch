import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV19, toV18CompatibleV19 } from '../src/native-gui-ir-v19.js';
import { adaptNativeWindowIconsForV19Backend } from '../src/native-window-icon-backend-adapter.js';
import { encodeNativeGuiPayloadV18, inspectNativeGuiButtonImagesV18 } from '../src/sealed-native-gui-v18.js';
import {
  PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_VERSION,
  encodeNativeGuiPayloadV19,
  inspectNativeGuiWindowIconsV19,
  inspectNativeGuiButtonImagesV19,
  decodeNativeGuiPayloadV19,
  sealNativeGuiRuntimeV19
} from '../src/sealed-native-gui-v19.js';

const SOURCE = `window "Files" as main size 460, 240 icon "patch-resource:app.icon":
  imagelist as app_images size 20, 18:
    image open from "patch-resource:icons.open"
  button "Open" as open_button image app_images.open at 24, 24 size 120, 36

window "Settings" as settings size 420, 220 icon "patch-resource:app.icon":
  text "Settings"

window "About" as about size 360, 200 icon "patch-resource:about.icon":
  text "About"
`;

const APP_ICON = Object.freeze({
  id: 'app.icon',
  path: 'resources/app.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});
const ABOUT_ICON = Object.freeze({
  id: 'about.icon',
  path: 'resources/about.jpg',
  mediaType: 'image/jpeg',
  size: 1,
  sha256: '1'.repeat(64),
  data: 'AA=='
});
const OPEN = Object.freeze({
  id: 'icons.open',
  path: 'resources/open.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '2'.repeat(64),
  data: 'AA=='
});
const RESOURCES = Object.freeze([APP_ICON, ABOUT_ICON, OPEN]);

function build(source = SOURCE) {
  return buildNativeGuiIRV19(compile(source, { name: 'WindowIconPayload', kind: 'window', entry: 'main.patch' }));
}

test('payload v19 deduplicates Window icon assets and preserves application/Form consumers', () => {
  const ir = build();
  const adapted = adaptNativeWindowIconsForV19Backend(ir, RESOURCES);
  assert.equal(adapted.assetCount, 2);
  assert.equal(adapted.consumerCount, 3);
  assert.equal(adapted.applicationIcon.formId, 'main');
  assert.deepEqual(adapted.consumers.map(item => ({
    formId: item.formId,
    resourceId: item.resourceId,
    assetIndex: item.assetIndex,
    application: item.application
  })), [
    { formId: 'main', resourceId: 'app.icon', assetIndex: 0, application: true },
    { formId: 'settings', resourceId: 'app.icon', assetIndex: 0, application: false },
    { formId: 'about', resourceId: 'about.icon', assetIndex: 1, application: false }
  ]);

  const payload = encodeNativeGuiPayloadV19(ir, { resources: RESOURCES });
  assert.equal(new TextDecoder().decode(payload.subarray(payload.length - 8, payload.length - 4)), 'WICO');
  const inspected = inspectNativeGuiWindowIconsV19(payload);
  assert.equal(inspected.assets.length, 2);
  assert.equal(inspected.consumers.length, 3);
  assert.equal(inspected.assets[0].resourceId, 'app.icon');
  assert.equal(inspected.assets[0].dataUri, 'data:image/png;base64,AA==');
  assert.equal(inspected.applicationIcon.formId, 'main');
  assert.deepEqual(inspected.consumers.map(item => item.assetIndex), [0, 0, 1]);
});

test('payload v19 retains an exact independently valid payload-v18 compatibility prefix', () => {
  const ir = build();
  const payload = encodeNativeGuiPayloadV19(ir, { resources: RESOURCES });
  const inspected = inspectNativeGuiWindowIconsV19(payload);
  const expectedV18 = encodeNativeGuiPayloadV18(toV18CompatibleV19(ir), { resources: RESOURCES });
  assert.deepEqual(inspected.payloadV18, expectedV18);
  const buttons = inspectNativeGuiButtonImagesV18(inspected.payloadV18);
  assert.equal(buttons.assets.length, 1);
  assert.equal(buttons.consumers.length, 1);
  assert.equal(buttons.assets[0].resourceId, 'icons.open');
  assert.equal(inspectNativeGuiButtonImagesV19(payload).consumers[0].controlId, 'open_button');
});

test('payload v19 emits an empty WICO extension when no Form declares an icon', () => {
  const ir = build(`window "Plain" as main size 320, 180:
  button "OK" as ok_button at 24, 24 size 100, 36
`);
  const payload = encodeNativeGuiPayloadV19(ir);
  const inspected = inspectNativeGuiWindowIconsV19(payload);
  assert.equal(inspected.assets.length, 0);
  assert.equal(inspected.consumers.length, 0);
  assert.equal(inspected.applicationIcon, null);
  assert.ok(inspected.payloadV18.length > 0);
});

test('payload v19 seals and decodes with footer version 19', () => {
  const sealed = sealNativeGuiRuntimeV19(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), build(), {
    platform: 'windows',
    resources: RESOURCES
  });
  assert.equal(PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_VERSION, 19);
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12).getUint32(0, true), 19);
  const payload = decodeNativeGuiPayloadV19(sealed);
  const inspected = inspectNativeGuiWindowIconsV19(payload);
  assert.equal(inspected.consumers.length, 3);
  assert.equal(inspected.applicationIcon.resourceId, 'app.icon');
});

test('payload v19 fails closed on missing and deferred-format Window icon resources', () => {
  const ir = build();
  assert.throws(
    () => encodeNativeGuiPayloadV19(ir, { resources: [ABOUT_ICON, OPEN] }),
    error => error?.code === 'NATIVE_WINDOW_ICON_RESOURCE_MISSING' && /app\.icon/.test(error.message)
  );
  const svg = { ...APP_ICON, path: 'resources/app.svg', mediaType: 'image/svg+xml' };
  assert.throws(
    () => encodeNativeGuiPayloadV19(ir, { resources: [svg, ABOUT_ICON, OPEN] }),
    /deferred|PNG and JPEG only|native-picture-formats/i
  );
});
