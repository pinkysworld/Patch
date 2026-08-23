import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { PATCH_NATIVE_GUI_IR_VERSION } from '../src/native-gui-ir.js';
import {
  PATCH_FROZEN_NATIVE_CONTRACT_ID,
  PATCH_FROZEN_NATIVE_GUI_IR_VERSION,
  PATCH_FROZEN_NATIVE_PAYLOAD_VERSION,
  PATCH_FROZEN_NATIVE_RUNTIME_VERSION,
  PATCH_FROZEN_NATIVE_RUNTIME_TAGS,
  buildFrozenNativeGuiIR,
  validateFrozenNativeGuiIR,
  encodeFrozenNativeGuiPayload,
  frozenNativeContract
} from '../src/native-frozen-contract.js';

test('frozen native facade pins the TreeView contract to IR 1.2 / payload 12 / runtime 1.3', () => {
  assert.equal(PATCH_FROZEN_NATIVE_CONTRACT_ID, 'native-gui-1.2/payload-12/runtime-1.3');
  assert.equal(PATCH_FROZEN_NATIVE_GUI_IR_VERSION, '1.2');
  assert.equal(PATCH_FROZEN_NATIVE_PAYLOAD_VERSION, 12);
  assert.equal(PATCH_FROZEN_NATIVE_RUNTIME_VERSION, '1.3');
  assert.deepEqual(PATCH_FROZEN_NATIVE_RUNTIME_TAGS, {
    windows: 'native-win32-runtime-v1.3',
    macos: 'native-macos-runtime-v1.3',
    linux: 'native-linux-runtime-v1.3'
  });
  assert.deepEqual(frozenNativeContract(), {
    id: 'native-gui-1.2/payload-12/runtime-1.3', guiIr: '1.2', payload: 12, runtime: '1.3', runtimeTags: PATCH_FROZEN_NATIVE_RUNTIME_TAGS
  });
});

test('unversioned native-gui-ir.js remains the historical IR 0.7 base, not the current or frozen product contract', () => {
  assert.equal(PATCH_NATIVE_GUI_IR_VERSION, '0.7');
  assert.notEqual(PATCH_NATIVE_GUI_IR_VERSION, PATCH_FROZEN_NATIVE_GUI_IR_VERSION);
});

test('frozen native facade builds and encodes a TreeView Window without enabling Slider', () => {
  const source = fs.readFileSync('examples/treeview-window.patch', 'utf8');
  const compiled = compile(source, { name: 'FrozenNative', kind: 'window' });
  const ir = buildFrozenNativeGuiIR(compiled);
  assert.equal(ir.version, '1.2');
  assert.equal(validateFrozenNativeGuiIR(ir), ir);
  const payload = encodeFrozenNativeGuiPayload(ir);
  assert.ok(payload instanceof Uint8Array);
  assert.ok(payload.byteLength > 0);
  assert.equal(JSON.stringify(ir).includes('slider'), false);
});
