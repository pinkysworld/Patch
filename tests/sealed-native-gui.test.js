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
const gui = buildNativeGuiIR(compile(source, { name: 'SealedTest', kind: 'window', entry: 'forms-navigation.patch' }));
const comboGui = buildNativeGuiIR(compile(fs.readFileSync('examples/combo-window.patch', 'utf8'), { name: 'SealedComboTest', kind: 'window' }));
const listboxGui = buildNativeGuiIR(compile(fs.readFileSync('examples/listbox-window.patch', 'utf8'), { name: 'SealedListBoxTest', kind: 'window' }));
const tabsGui = buildNativeGuiIR(compile(fs.readFileSync('examples/tabs-window.patch', 'utf8'), { name: 'SealedTabsTest', kind: 'window' }));

test('sealed native GUI payload v4 is deterministic and round-trips from a Windows executable overlay', () => {
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 4);
  const payload = encodeNativeGuiPayload(gui);
  const fakePe = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4, 5, 6]);
  const sealed = sealNativeGuiRuntime(fakePe, gui);
  assert.equal(new TextDecoder().decode(sealed.subarray(sealed.length - 20, sealed.length - 12)), PATCH_SEALED_NATIVE_GUI_MAGIC);
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12, 4).getUint32(0, true), 4);
  assert.deepEqual(decodeNativeGuiPayload(sealed), payload);
  assert.deepEqual(encodeNativeGuiPayload(gui), payload);
});

test('same v4 payload round-trips from Linux ELF and macOS Mach-O overlays', () => {
  const payload = encodeNativeGuiPayload(gui);
  const fakeElf = Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 9, 8, 7, 6]);
  const fakeMachO = Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 12, 0, 0, 1, 7, 6, 5, 4]);
  assert.deepEqual(decodeNativeGuiPayload(sealNativeGuiRuntime(fakeElf, gui, { platform: 'linux' })), payload);
  assert.deepEqual(decodeNativeGuiPayload(sealNativeGuiRuntime(fakeMachO, gui, { platform: 'macos' })), payload);
});

test('sealed native GUI v4 serializes ComboBox and ListBox option semantics without Patch source', () => {
  for (const [selectionGui, expected] of [[comboGui, ['Small', 'Medium', 'Large']], [listboxGui, ['Apple', 'Banana', 'Cherry', 'Mango']]]) {
    const payload = encodeNativeGuiPayload(selectionGui);
    const text = new TextDecoder().decode(payload);
    for (const option of expected) assert.match(text, new RegExp(option));
    assert.equal(selectionGui.events[0].valueType, 'text');
  }
});

test('sealed native GUI v4 encodes Tabs kind 7 with page titles and parent/page metadata', () => {
  const controls = readPayloadControls(encodeNativeGuiPayload(tabsGui));
  const tabs = controls.find(control => control.id === 'settings');
  const name = controls.find(control => control.id === 'name');
  const notifications = controls.find(control => control.id === 'notifications');
  const reset = controls.find(control => control.id === 'reset_name');
  assert.ok(tabs);
  assert.equal(tabs.kind, 7);
  assert.deepEqual(tabs.options, ['General', 'Advanced']);
  assert.deepEqual([tabs.parentTabIndex, tabs.pageIndex], [-1, -1]);
  assert.deepEqual([name.parentTabIndex, name.pageIndex], [tabs.index, 0]);
  assert.deepEqual([notifications.parentTabIndex, notifications.pageIndex], [tabs.index, 1]);
  assert.deepEqual([reset.parentTabIndex, reset.pageIndex], [tabs.index, 1]);
  assert.equal(tabsGui.states.some(state => state.name === 'settings'), false);
  const text = new TextDecoder().decode(encodeNativeGuiPayload(tabsGui));
  assert.doesNotMatch(text, /when settings changed/);
});

test('sealed payload contains forms, controls, events and state without Patch source', () => {
  const text = new TextDecoder().decode(encodeNativeGuiPayload(gui));
  assert.match(text, /Main/);
  assert.match(text, /Settings/);
  assert.match(text, /open_settings/);
  assert.match(text, /notifications/);
  assert.doesNotMatch(text, /create boolean notifications/);
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

function readPayloadControls(bytes) {
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u8 = () => view.getUint8(offset++);
  const u32 = () => { const value = view.getUint32(offset, true); offset += 4; return value; };
  const i32 = () => { const value = view.getInt32(offset, true); offset += 4; return value; };
  const f64 = () => { const value = view.getFloat64(offset, true); offset += 8; return value; };
  const text = () => { const length = u32(); const value = new TextDecoder().decode(bytes.subarray(offset, offset + length)); offset += length; return value; };
  const skipValue = type => { if (type === 1) f64(); else if (type === 2) text(); else if (type === 3) u8(); else throw new Error(`bad state type ${type}`); };

  const stateCount = u32();
  for (let i = 0; i < stateCount; i += 1) { text(); skipValue(u8()); }
  const forms = u32();
  const controls = [];
  for (let f = 0; f < forms; f += 1) {
    text(); text(); u32(); u32(); u8();
    const count = u32();
    for (let c = 0; c < count; c += 1) {
      const kind = u8();
      const id = text();
      text(); text();
      const optionCount = u32();
      const options = Array.from({ length: optionCount }, () => text());
      i32(); i32(); i32(); i32();
      const parentTabIndex = i32();
      const pageIndex = i32();
      controls.push({ index: controls.length, kind, id, options, parentTabIndex, pageIndex });
    }
  }
  return controls;
}
