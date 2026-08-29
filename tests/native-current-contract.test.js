import test from 'node:test';
import assert from 'node:assert/strict';
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
  inspectCurrentNativeGuiImageLists,
  currentNativeContract
} from '../src/native-current-contract.js';
import { resolveNativePictureResources } from '../src/native-picture-resources.js';

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg==';

test('current native facade pins the product contract to IR 1.8 / payload 18 / runtime 1.9', () => {
  assert.equal(PATCH_CURRENT_NATIVE_CONTRACT_ID, 'native-gui-1.8/payload-18/runtime-1.9');
  assert.equal(PATCH_CURRENT_NATIVE_GUI_IR_VERSION, '1.8');
  assert.equal(PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, 18);
  assert.equal(PATCH_CURRENT_NATIVE_RUNTIME_VERSION, '1.9');
  assert.deepEqual(PATCH_CURRENT_NATIVE_RUNTIME_TAGS, {
    windows: 'native-win32-runtime-v1.9',
    macos: 'native-macos-runtime-v1.9',
    linux: 'native-linux-runtime-v1.9'
  });
  assert.deepEqual(currentNativeContract(), {
    id: 'native-gui-1.8/payload-18/runtime-1.9', guiIr: '1.8', payload: 18, runtime: '1.9', runtimeTags: PATCH_CURRENT_NATIVE_RUNTIME_TAGS
  });
});

test('current native facade builds and encodes a Slider-capable Window on IR 1.8', () => {
  const source = fs.readFileSync('examples/slider-window.patch', 'utf8');
  const compiled = compile(source, { name: 'CurrentNative', kind: 'window' });
  const ir = buildCurrentNativeGuiIR(compiled);
  assert.equal(ir.version, '1.8');
  assert.equal(validateCurrentNativeGuiIR(ir), ir);
  const payload = encodeCurrentNativeGuiPayload(ir);
  assert.ok(payload instanceof Uint8Array);
  assert.ok(payload.byteLength > 0);
  assert.equal(inspectCurrentNativeGuiImageLists(payload).imageLists.length, 0);
});

test('current native facade carries ImageList Button images after project-resource resolution', () => {
  const source = fs.readFileSync('examples/imagelist-window.patch', 'utf8');
  const compiled = compile(source, { name: 'CurrentImageList', kind: 'window' });
  const ir = buildCurrentNativeGuiIR(compiled);
  const resource = {
    id: 'icons.open',
    path: 'resources/open.png',
    mediaType: 'image/png',
    size: Buffer.from(TINY_PNG, 'base64').length,
    sha256: '0'.repeat(64),
    data: TINY_PNG
  };
  const resolved = resolveNativePictureResources(ir, [resource]).ir;
  const payload = encodeCurrentNativeGuiPayload(resolved);
  const inspected = inspectCurrentNativeGuiImageLists(payload);
  assert.equal(inspected.imageLists.length, 1);
  assert.equal(inspected.buttons.length, 1);
  assert.equal(inspected.buttons[0].id, 'open_button');
  assert.equal(inspected.buttons[0].imageListId, 'icons');
  assert.equal(inspected.buttons[0].imageItem, 'open');
});
