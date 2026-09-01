import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import {
  PATCH_CURRENT_NATIVE_CONTRACT_ID,
  PATCH_CURRENT_NATIVE_GUI_IR_VERSION,
  PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,
  PATCH_CURRENT_NATIVE_RUNTIME_VERSION,
  PATCH_CURRENT_NATIVE_RUNTIME_TAGS,
  buildCurrentNativeGuiIR,
  validateCurrentNativeGuiIR,
  encodeCurrentNativeGuiPayload,
  inspectCurrentNativeGuiButtonImages,
  inspectCurrentNativeGuiWindowIcons,
  currentNativeHasButtonImage,
  currentNativeHasWindowIcon,
  toLegacyV18NativeGuiIR,
  toLegacyV17NativeGuiIR,
  currentNativeContract
} from '../src/native-current-contract.js';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkYGD4z0ABYKJE86gBowaMGjCYDAAATUABH+w/WFYAAAAASUVORK5CYII=';

function resource(id) {
  const bytes = Buffer.from(PNG_BASE64, 'base64');
  return Object.freeze({
    id,
    path: `resources/${id.replaceAll('.', '-')}.png`,
    mediaType: 'image/png',
    size: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    data: PNG_BASE64
  });
}

test('current native facade pins the product contract to IR 1.9 / payload 19 / runtime 1.10', () => {
  assert.equal(PATCH_CURRENT_NATIVE_CONTRACT_ID, 'native-gui-1.9/payload-19/runtime-1.10');
  assert.equal(PATCH_CURRENT_NATIVE_GUI_IR_VERSION, '1.9');
  assert.equal(PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, 19);
  assert.equal(PATCH_CURRENT_NATIVE_RUNTIME_VERSION, '1.10');
  assert.deepEqual(PATCH_CURRENT_NATIVE_RUNTIME_TAGS, {
    windows: 'native-win32-runtime-v1.10',
    macos: 'native-macos-runtime-v1.10',
    linux: 'native-linux-runtime-v1.10'
  });
  assert.deepEqual(currentNativeContract(), {
    id: 'native-gui-1.9/payload-19/runtime-1.10', guiIr: '1.9', payload: 19, runtime: '1.10', runtimeTags: PATCH_CURRENT_NATIVE_RUNTIME_TAGS
  });
});

test('current native facade builds and encodes a Slider-capable Window on IR 1.9', () => {
  const source = fs.readFileSync('examples/slider-window.patch', 'utf8');
  const compiled = compile(source, { name: 'CurrentNative', kind: 'window' });
  const ir = buildCurrentNativeGuiIR(compiled);
  assert.equal(ir.version, '1.9');
  assert.equal(validateCurrentNativeGuiIR(ir), ir);
  const payload = encodeCurrentNativeGuiPayload(ir);
  assert.ok(payload instanceof Uint8Array);
  assert.ok(payload.byteLength > 0);
  assert.deepEqual(inspectCurrentNativeGuiWindowIcons(payload).assets, []);
});

test('current facade carries Button ImageList and Window icon resources while legacy projections remove only newer metadata', () => {
  const source = fs.readFileSync('examples/window-icons-native.patch', 'utf8');
  const compiled = compile(source, { name: 'CurrentNativeIcons', kind: 'window' });
  const ir = buildCurrentNativeGuiIR(compiled);
  assert.equal(currentNativeHasButtonImage(ir), true);
  assert.equal(currentNativeHasWindowIcon(ir), true);

  const resources = [resource('app.icon'), resource('about.icon'), resource('icons.open')];
  const payload = encodeCurrentNativeGuiPayload(ir, { resources });
  const icons = inspectCurrentNativeGuiWindowIcons(payload);
  const buttons = inspectCurrentNativeGuiButtonImages(payload);
  assert.equal(icons.assets.length, 2);
  assert.equal(icons.consumers.length, 2);
  assert.equal(icons.applicationIcon?.resourceId, 'app.icon');
  assert.equal(buttons.assets.length, 1);
  assert.equal(buttons.consumers.length, 1);
  assert.equal(buttons.consumers[0].resourceId, 'icons.open');

  const v18 = toLegacyV18NativeGuiIR(ir);
  assert.equal(v18.version, '1.8');
  assert.equal(currentNativeHasWindowIcon(v18), false);
  assert.equal(currentNativeHasButtonImage(v18), true);

  const v17 = toLegacyV17NativeGuiIR(ir);
  assert.equal(v17.version, '1.7');
  assert.equal(currentNativeHasWindowIcon(v17), false);
  assert.equal(currentNativeHasButtonImage(v17), false);
});
