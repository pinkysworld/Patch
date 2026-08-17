import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV11 } from '../src/native-gui-ir-v11.js';
import { encodeNativeGuiPayload } from '../src/sealed-native-gui.js';
import {
  PATCH_SEALED_NATIVE_GUI_MENU_VERSION,
  encodeNativeGuiPayloadV11,
  sealNativeGuiRuntimeV11,
  decodeNativeGuiPayloadV11
} from '../src/sealed-native-gui-v11.js';

const menuSource = fs.readFileSync('examples/menu-state-window.patch', 'utf8');

function reader(bytes) {
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u8 = () => bytes[offset++];
  const u32 = () => { const value = view.getUint32(offset, true); offset += 4; return value; };
  const i32 = () => { const value = view.getInt32(offset, true); offset += 4; return value; };
  const text = () => { const length = u32(); const value = new TextDecoder().decode(bytes.subarray(offset, offset + length)); offset += length; return value; };
  const skipTyped = type => {
    if (type === 1) offset += 8;
    else if (type === 2) text();
    else if (type === 3) offset += 1;
    else if (type === 4) { const count = u32(); for (let i = 0; i < count; i += 1) text(); }
    else throw new Error(`type ${type}`);
  };
  return { u8, u32, i32, text, skipTyped, get offset() { return offset; } };
}

function skipToMenus(r) {
  const stateCount = r.u32();
  for (let i = 0; i < stateCount; i += 1) { r.text(); const type = r.u8(); r.skipTyped(type); }
  assert.equal(r.u32(), 1);
  r.text(); r.text(); r.u32(); r.u32(); r.u8();
  const controls = r.u32();
  for (let i = 0; i < controls; i += 1) {
    r.u8(); r.text(); r.text(); r.text();
    const options = r.u32(); for (let o = 0; o < options; o += 1) r.text();
    r.i32(); r.i32(); r.i32(); r.i32(); r.u8(); r.u8(); r.i32(); r.i32();
    const columns = r.u32(); for (let c = 0; c < columns; c += 1) r.text();
    const rows = r.u32(); for (let row = 0; row < rows; row += 1) for (let c = 0; c < columns; c += 1) r.text();
  }
}

test('payload v11 structurally preserves separator shortcut enabled and checked metadata', () => {
  const ir = buildNativeGuiIRV11(compile(menuSource, { name: 'SealedMenu', kind: 'window' }));
  const bytes = encodeNativeGuiPayloadV11(ir);
  const r = reader(bytes);
  skipToMenus(r);

  assert.equal(r.u32(), 1);
  assert.equal(r.text(), 'Actions');
  assert.equal(r.u32(), 4);

  assert.equal(r.u8(), 1);
  assert.equal(r.text(), 'enable_advanced');
  assert.equal(r.text(), 'Enable advanced');
  assert.equal(r.u8(), 0);
  assert.equal(r.text(), '');
  assert.equal(r.text(), '');

  assert.equal(r.u8(), 1);
  assert.equal(r.text(), 'advanced_action');
  assert.equal(r.text(), 'Advanced action');
  assert.equal(r.u8(), 1);
  assert.equal(r.u8(), 1, 'Primary modifier');
  assert.equal(r.text(), 'E');
  assert.equal(r.text(), 'advanced');
  assert.equal(r.text(), '');

  assert.equal(r.u8(), 2, 'separator entry');

  assert.equal(r.u8(), 1);
  assert.equal(r.text(), 'pin_item');
  assert.equal(r.text(), 'Pinned');
  assert.equal(r.u8(), 1);
  assert.equal(r.u8(), 1, 'Primary modifier');
  assert.equal(r.text(), 'P');
  assert.equal(r.text(), '');
  assert.equal(r.text(), 'pinned');
});

test('frozen payload v10 still fails closed for decorated menus', () => {
  const ir = buildNativeGuiIRV11(compile(menuSource, { name: 'SealedMenu', kind: 'window' }));
  assert.throws(() => encodeNativeGuiPayload(ir, { version: 10 }), /v10 does not yet encode Menu separators, shortcuts or source-backed MenuItem state/i);
});

test('payload v11 composes menu metadata with list-state IR 1.1', () => {
  const source = `create boolean enabled = true\ncreate list choices = ["A", "C"]\nwindow "Combined" as main:\n  listbox ["A", "B", "C"] as choices\n  menu "Actions":\n    item "Apply" as apply_item shortcut "Primary+A" enabled enabled\n    separator\n    item "Reset" as reset_item\n\nwhen choices changed:\n  change choices:\n    set = value\n`;
  const ir = buildNativeGuiIRV11(compile(source, { name: 'Combined', kind: 'window' }));
  const bytes = encodeNativeGuiPayloadV11(ir);
  assert.ok(bytes.length > 0);
  assert.match(new TextDecoder().decode(bytes), /choices/);
});

test('payload v11 footer round-trip preserves exact bytes and version', () => {
  const ir = buildNativeGuiIRV11(compile(menuSource, { name: 'SealedMenu', kind: 'window' }));
  const runtime = Uint8Array.of(0x4d, 0x5a, 0, 0, 0, 0, 0, 0);
  const sealed = sealNativeGuiRuntimeV11(runtime, ir, { platform: 'windows' });
  assert.deepEqual(decodeNativeGuiPayloadV11(sealed), encodeNativeGuiPayloadV11(ir));
  const footer = new DataView(sealed.buffer, sealed.byteOffset + sealed.byteLength - 20, 20);
  assert.equal(footer.getUint32(8, true), PATCH_SEALED_NATIVE_GUI_MENU_VERSION);
});
