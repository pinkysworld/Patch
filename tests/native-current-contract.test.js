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
  inspectCurrentNativeGuiButtonImages,
  toLegacyV17NativeGuiIR,
  currentNativeContract
} from '../src/native-current-contract.js';
import { validateNativeGuiIRV17 } from '../src/native-gui-ir-v17.js';

const BUTTON_RESOURCE = Object.freeze({
  id: 'icons.open',
  path: 'resources/open.png',
  mediaType: 'image/png',
  size: 70,
  sha256: 'd126901e8b7f82749aee7b7c0ec59838286c9f8d75ffc74147f34ac2b4bad460',
  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg=='
});

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
});

test('current native facade transports ImageList-backed Button images and retains a valid v17 projection', () => {
  const source = fs.readFileSync('examples/button-imagelist-window.patch', 'utf8');
  const compiled = compile(source, { name: 'CurrentButtonImages', kind: 'window' });
  const ir = buildCurrentNativeGuiIR(compiled);
  assert.equal(ir.version, '1.8');

  const payload = encodeCurrentNativeGuiPayload(ir, { resources: [BUTTON_RESOURCE] });
  const inspected = inspectCurrentNativeGuiButtonImages(payload);
  assert.equal(inspected.assets.length, 1);
  assert.equal(inspected.assets[0].resourceId, 'icons.open');
  assert.equal(inspected.consumers.length, 2);
  assert.deepEqual(inspected.consumers.map(item => item.assetIndex), [0, 0]);

  const legacy = toLegacyV17NativeGuiIR(ir);
  assert.equal(legacy.version, '1.7');
  assert.equal(validateNativeGuiIRV17(legacy), legacy);
});
