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
const radioGui = buildNativeGuiIR(compile(fs.readFileSync('examples/radio-window.patch', 'utf8'), { name: 'SealedRadioTest', kind: 'window' }));
const menuGui = buildNativeGuiIR(compile(fs.readFileSync('examples/menu-dialog-window.patch', 'utf8'), { name: 'SealedMenuDialogTest', kind: 'window' }));
const resultGui = buildNativeGuiIR(compile(fs.readFileSync('examples/result-dialog-window.patch', 'utf8'), { name: 'SealedResultDialogTest', kind: 'window' }));
const responsiveGui = buildNativeGuiIR(compile(`window "Responsive" size 640, 420:
  # @layout anchor left right top
  button "Save" as save at 24, 24 size 120, 36
  # @layout dock bottom
  text "Status" at 24, 380 size 200, 30
`, { name: 'SealedResponsiveTest', kind: 'window' }));

test('sealed native GUI payload v8 is deterministic and round-trips from a Windows executable overlay', () => {
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 8);
  const payload = encodeNativeGuiPayload(gui);
  const fakePe = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4, 5, 6]);
  const sealed = sealNativeGuiRuntime(fakePe, gui);
  assert.equal(new TextDecoder().decode(sealed.subarray(sealed.length - 20, sealed.length - 12)), PATCH_SEALED_NATIVE_GUI_MAGIC);
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12, 4).getUint32(0, true), 8);
  assert.deepEqual(decodeNativeGuiPayload(sealed), payload);
  assert.deepEqual(encodeNativeGuiPayload(gui), payload);
});

test('same v8 payload round-trips from Linux ELF and macOS Mach-O overlays', () => {
  const payload = encodeNativeGuiPayload(gui);
  const fakeElf = Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 9, 8, 7, 6]);
  const fakeMachO = Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 12, 0, 0, 1, 7, 6, 5, 4]);
  assert.deepEqual(decodeNativeGuiPayload(sealNativeGuiRuntime(fakeElf, gui, { platform: 'linux' })), payload);
  assert.deepEqual(decodeNativeGuiPayload(sealNativeGuiRuntime(fakeMachO, gui, { platform: 'macos' })), payload);
});

test('sealed native GUI v8 serializes responsive anchor and dock policies compactly', () => {
  const controls = readPayload(encodeNativeGuiPayload(responsiveGui)).controls;
  assert.deepEqual(controls.map(control => control.layoutPolicy), [
    { kind: 1, value: 7 },
    { kind: 2, value: 4 }
  ]);
});

test('sealed native GUI v8 serializes ComboBox, ListBox and Radio option semantics without Patch source', () => {
  for (const [selectionGui, expected] of [
    [comboGui, ['Small', 'Medium', 'Large']],
    [listboxGui, ['Apple', 'Banana', 'Cherry', 'Mango']],
    [radioGui, ['Basic', 'Advanced', 'Expert']]
  ]) {
    const payload = encodeNativeGuiPayload(selectionGui);
    const text = new TextDecoder().decode(payload);
    for (const option of expected) assert.match(text, new RegExp(option));
    assert.equal(selectionGui.events[0].valueType, 'text');
  }
});

test('sealed native GUI v8 keeps Tabs kind 7 and Radio kind 8', () => {
  const controls = readPayload(encodeNativeGuiPayload(tabsGui)).controls;
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

  const radio = readPayload(encodeNativeGuiPayload(radioGui)).controls.find(control => control.id === 'mode');
  assert.ok(radio);
  assert.equal(radio.kind, 8);
  assert.deepEqual(radio.options, ['Basic', 'Advanced', 'Expert']);
});

test('sealed native GUI v8 serializes structural menus and informational dialog action kind 4', () => {
  const decoded = readPayload(encodeNativeGuiPayload(menuGui));
  assert.deepEqual(decoded.menus, [{ form: 'main', title: 'Help', items: [{ id: 'about_item', text: 'About' }] }]);
  assert.deepEqual(decoded.events, [{
    control: 'about_item', eventKind: 1, valueType: 0,
    actions: [{ kind: 4, form: 'main', title: 'About Patch', message: 'Native menus and informational dialogs' }]
  }]);
});

test('sealed native GUI v8 structurally encodes result events and action kinds 5/6/7', () => {
  const decoded = readPayload(encodeNativeGuiPayload(resultGui));
  const resetClick = decoded.events.find(event => event.control === 'reset_button');
  const openClick = decoded.events.find(event => event.control === 'open_button');
  const saveClick = decoded.events.find(event => event.control === 'save_button');
  const confirmed = decoded.events.find(event => event.control === 'reset_confirm' && event.eventKind === 3);
  const chosen = decoded.events.find(event => event.control === 'open_result' && event.eventKind === 4);
  const cancelled = decoded.events.find(event => event.control === 'open_result' && event.eventKind === 5);

  assert.deepEqual(resetClick.actions, [{
    kind: 5, form: 'main', id: 'reset_confirm', title: 'Reset selection?', message: 'Clear the selected path?'
  }]);
  assert.deepEqual(openClick.actions, [{ kind: 6, form: 'main', id: 'open_result', title: 'Open Patch file' }]);
  assert.deepEqual(saveClick.actions, [{ kind: 7, form: 'main', id: 'save_result', title: 'Save Patch file' }]);
  assert.equal(confirmed.valueType, 0);
  assert.equal(chosen.valueType, 2);
  assert.equal(cancelled.valueType, 0);
  assert.deepEqual(chosen.actions, [{ kind: 3, target: 'selected_path', ops: [{ op: 1, valueKind: 2 }] }]);
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

function readPayload(bytes) {
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
  const menus = [];
  for (let f = 0; f < forms; f += 1) {
    const formId = text(); text(); u32(); u32(); u8();
    const count = u32();
    for (let c = 0; c < count; c += 1) {
      const kind = u8(); const id = text(); text(); text();
      const optionCount = u32(); const options = Array.from({ length: optionCount }, () => text());
      i32(); i32(); i32(); i32();
      const layoutPolicy = { kind: u8(), value: u8() };
      const parentTabIndex = i32(); const pageIndex = i32();
      controls.push({ index: controls.length, kind, id, options, layoutPolicy, parentTabIndex, pageIndex });
    }
    const menuCount = u32();
    for (let m = 0; m < menuCount; m += 1) {
      const title = text(); const itemCount = u32(); const items = [];
      for (let i = 0; i < itemCount; i += 1) items.push({ id: text(), text: text() });
      menus.push({ form: formId, title, items });
    }
  }
  const eventCount = u32();
  const events = [];
  for (let e = 0; e < eventCount; e += 1) {
    const control = text(); const eventKind = u8(); const valueType = u8(); const actionCount = u32(); const actions = [];
    for (let a = 0; a < actionCount; a += 1) {
      const kind = u8();
      if (kind === 1 || kind === 2) actions.push({ kind, form: text() });
      else if (kind === 4) actions.push({ kind, form: text(), title: text(), message: text() });
      else if (kind === 5) actions.push({ kind, form: text(), id: text(), title: text(), message: text() });
      else if (kind === 6 || kind === 7) actions.push({ kind, form: text(), id: text(), title: text() });
      else if (kind === 3) {
        const target = text(); const stateType = u8(); const opCount = u32(); const ops = [];
        for (let o = 0; o < opCount; o += 1) {
          const op = u8(); const valueKind = u8();
          if (op !== 4 && valueKind === 1) skipValue(stateType);
          ops.push({ op, valueKind });
        }
        actions.push({ kind, target, ops });
      } else throw new Error(`bad action ${kind}`);
    }
    events.push({ control, eventKind, valueType, actions });
  }
  assert.equal(offset, bytes.length);
  return { controls, menus, events };
}
