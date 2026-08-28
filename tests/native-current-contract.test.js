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
  currentNativeContract
} from '../src/native-current-contract.js';

test('current native facade pins the product contract to IR 1.6 / payload 16 / runtime 1.7', () => {
  assert.equal(PATCH_CURRENT_NATIVE_CONTRACT_ID, 'native-gui-1.6/payload-16/runtime-1.7');
  assert.equal(PATCH_CURRENT_NATIVE_GUI_IR_VERSION, '1.6');
  assert.equal(PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, 16);
  assert.equal(PATCH_CURRENT_NATIVE_RUNTIME_VERSION, '1.7');
  assert.deepEqual(PATCH_CURRENT_NATIVE_RUNTIME_TAGS, {
    windows: 'native-win32-runtime-v1.7',
    macos: 'native-macos-runtime-v1.7',
    linux: 'native-linux-runtime-v1.7'
  });
  assert.deepEqual(currentNativeContract(), {
    id: 'native-gui-1.6/payload-16/runtime-1.7', guiIr: '1.6', payload: 16, runtime: '1.7', runtimeTags: PATCH_CURRENT_NATIVE_RUNTIME_TAGS
  });
});

test('current native facade builds and encodes a Slider-capable Window on IR 1.6', () => {
  const source = fs.readFileSync('examples/slider-window.patch', 'utf8');
  const compiled = compile(source, { name: 'CurrentNative', kind: 'window' });
  const ir = buildCurrentNativeGuiIR(compiled);
  assert.equal(ir.version, '1.6');
  assert.equal(validateCurrentNativeGuiIR(ir), ir);
  const payload = encodeCurrentNativeGuiPayload(ir);
  assert.ok(payload instanceof Uint8Array);
  assert.ok(payload.byteLength > 0);
});
