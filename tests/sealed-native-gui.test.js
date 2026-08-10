import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import {
  PATCH_SEALED_NATIVE_GUI_MAGIC,
  PATCH_SEALED_NATIVE_GUI_VERSION,
  encodeNativeGuiPayload,
  sealNativeGuiRuntime,
  decodeNativeGuiPayload
} from '../src/sealed-native-gui.js';

const source = fs.readFileSync('examples/forms-navigation.patch', 'utf8');
const compiled = compile(source, { name: 'SealedTest', kind: 'window', entry: 'forms-navigation.patch' });
const gui = buildNativeGuiIR(compiled);

test('sealed native GUI payload is deterministic and round-trips from an executable overlay', () => {
  const payload = encodeNativeGuiPayload(gui);
  const fakePe = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4, 5, 6]);
  const sealed = sealNativeGuiRuntime(fakePe, gui);
  assert.equal(new TextDecoder().decode(sealed.subarray(sealed.length - 20, sealed.length - 12)), PATCH_SEALED_NATIVE_GUI_MAGIC);
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12, 4).getUint32(0, true), PATCH_SEALED_NATIVE_GUI_VERSION);
  assert.deepEqual(decodeNativeGuiPayload(sealed), payload);
  assert.deepEqual(encodeNativeGuiPayload(gui), payload);
});

test('sealed native GUI payload contains forms, controls, events and state without Patch source', () => {
  const payload = encodeNativeGuiPayload(gui);
  assert.ok(payload.length > 64);
  const text = new TextDecoder().decode(payload);
  assert.match(text, /Main/);
  assert.match(text, /Settings/);
  assert.match(text, /open_settings/);
  assert.match(text, /notifications/);
  assert.doesNotMatch(text, /create boolean notifications/);
  assert.doesNotMatch(text, /when open_settings clicked/);
});

test('sealer rejects an already sealed runtime template', () => {
  const fakePe = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4]);
  const sealed = sealNativeGuiRuntime(fakePe, gui);
  assert.throws(() => sealNativeGuiRuntime(sealed, gui), /already sealed/);
});
