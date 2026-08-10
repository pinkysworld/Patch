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
const comboSource = fs.readFileSync('examples/combo-window.patch', 'utf8');
const comboGui = buildNativeGuiIR(compile(comboSource, { name: 'SealedComboTest', kind: 'window', entry: 'combo-window.patch' }));

test('sealed native GUI payload v2 is deterministic and round-trips from a Windows executable overlay', () => {
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 2);
  const payload = encodeNativeGuiPayload(gui);
  const fakePe = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4, 5, 6]);
  const sealed = sealNativeGuiRuntime(fakePe, gui);
  assert.equal(new TextDecoder().decode(sealed.subarray(sealed.length - 20, sealed.length - 12)), PATCH_SEALED_NATIVE_GUI_MAGIC);
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12, 4).getUint32(0, true), PATCH_SEALED_NATIVE_GUI_VERSION);
  assert.deepEqual(decodeNativeGuiPayload(sealed), payload);
  assert.deepEqual(encodeNativeGuiPayload(gui), payload);
});

test('same sealed native GUI payload round-trips from a Linux ELF overlay', () => {
  const payload = encodeNativeGuiPayload(gui);
  const fakeElf = Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 9, 8, 7, 6]);
  const sealed = sealNativeGuiRuntime(fakeElf, gui, { platform: 'linux' });
  assert.deepEqual(decodeNativeGuiPayload(sealed), payload);
  assert.deepEqual(sealed.subarray(0, fakeElf.length), fakeElf);
});

test('same sealed native GUI payload round-trips from a macOS Mach-O overlay', () => {
  const payload = encodeNativeGuiPayload(gui);
  const fakeMachO = Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 12, 0, 0, 1, 7, 6, 5, 4]);
  const sealed = sealNativeGuiRuntime(fakeMachO, gui, { platform: 'macos' });
  assert.deepEqual(decodeNativeGuiPayload(sealed), payload);
  assert.deepEqual(sealed.subarray(0, fakeMachO.length), fakeMachO);
});

test('sealed native GUI v2 serializes ComboBox options and text changed semantics without Patch source', () => {
  const payload = encodeNativeGuiPayload(comboGui);
  const text = new TextDecoder().decode(payload);
  assert.match(text, /size/);
  assert.match(text, /Small/);
  assert.match(text, /Medium/);
  assert.match(text, /Large/);
  assert.doesNotMatch(text, /create text size/);
  assert.doesNotMatch(text, /when size changed/);
  const combo = comboGui.forms[0].controls.find(control => control.id === 'size');
  assert.deepEqual(combo.options, ['Small', 'Medium', 'Large']);
  assert.equal(combo.binding, 'size');
  assert.equal(comboGui.events[0].valueType, 'text');
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

test('sealer rejects a runtime whose binary format does not match the requested platform', () => {
  const fakePe = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4]);
  const fakeElf = Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]);
  const fakeMachO = Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 12, 0, 0, 1]);
  assert.throws(() => sealNativeGuiRuntime(fakePe, gui, { platform: 'linux' }), /not a Linux ELF/);
  assert.throws(() => sealNativeGuiRuntime(fakeElf, gui), /not a Windows PE/);
  assert.throws(() => sealNativeGuiRuntime(fakeElf, gui, { platform: 'macos' }), /not a macOS Mach-O/);
  assert.throws(() => sealNativeGuiRuntime(fakeMachO, gui, { platform: 'plan9' }), /unsupported/);
});
