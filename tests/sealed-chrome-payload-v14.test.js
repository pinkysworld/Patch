import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV14, hasNativeChromeStage1 } from '../src/native-gui-ir-v14.js';
import { encodeNativeGuiPayloadV14, inspectNativeGuiChromeV14, sealNativeGuiRuntimeV14 } from '../src/sealed-native-gui-v14.js';
import { currentNativeContract } from '../src/native-current-contract.js';

const chromeSource = readFileSync('examples/chrome-window.patch', 'utf8');

test('current native contract is IR 1.4 / payload 14 / runtime 1.5', () => {
  const contract = currentNativeContract();
  assert.equal(contract.id, 'native-gui-1.4/payload-14/runtime-1.5');
  assert.equal(contract.payload, 14);
  assert.equal(contract.runtime, '1.5');
});

test('payload v14 records Chrome Stage 1 metadata for runtime v1.5', () => {
  const ir = buildNativeGuiIRV14(compile(chromeSource, { name: 'Desk', kind: 'window' }));
  assert.equal(hasNativeChromeStage1(ir), true);
  const payload = encodeNativeGuiPayloadV14(ir);
  assert.equal(new TextDecoder().decode(payload.subarray(payload.length - 8, payload.length - 4)), 'PCHC');
  const inspected = inspectNativeGuiChromeV14(payload);
  assert.deepEqual(inspected.chrome.map(item => item.type), ['panel', 'picture', 'timer', 'statusbar']);
  assert.equal(inspected.chrome.find(item => item.id === 'clock').interval, 1000);
  const sealed = sealNativeGuiRuntimeV14(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), ir, { platform: 'windows' });
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12).getUint32(0, true), 14);
});
