import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV11 } from '../src/native-gui-ir-v11.js';
import {
  PATCH_SEALED_NATIVE_GUI_LIST_VERSION,
  encodeNativeGuiPayload,
  sealNativeGuiRuntime,
  decodeNativeGuiPayload
} from '../src/sealed-native-gui.js';

const source = fs.readFileSync('examples/listbox-multiselect-native.patch', 'utf8');

function reader(bytes) {
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u8 = () => bytes[offset++];
  const u32 = () => { const value = view.getUint32(offset, true); offset += 4; return value; };
  const i32 = () => { const value = view.getInt32(offset, true); offset += 4; return value; };
  const text = () => { const length = u32(); const value = new TextDecoder().decode(bytes.subarray(offset, offset + length)); offset += length; return value; };
  const skipPolicy = () => { u8(); u8(); };
  return { u8, u32, i32, text, skipPolicy, get offset() { return offset; } };
}

test('sealed payload v10 encodes persistent list state and text-list eventValue explicitly', () => {
  const ir = buildNativeGuiIRV11(compile(source, { name: 'SealedMulti', kind: 'window' }));
  const bytes = encodeNativeGuiPayload(ir, { version: PATCH_SEALED_NATIVE_GUI_LIST_VERSION });
  const r = reader(bytes);

  assert.equal(r.u32(), 1);
  assert.equal(r.text(), 'fruits');
  assert.equal(r.u8(), 4, 'state type 4 is persistent text-list');
  assert.equal(r.u32(), 2);
  assert.deepEqual([r.text(), r.text()], ['Banana', 'Mango']);

  assert.equal(r.u32(), 1);
  assert.equal(r.text(), 'main');
  assert.equal(r.text(), 'Fruit Picker');
  r.u32(); r.u32(); r.u8();
  const controlCount = r.u32();
  let listboxSeen = false;
  for (let index = 0; index < controlCount; index += 1) {
    const kind = r.u8();
    const id = r.text();
    r.text();
    const binding = r.text();
    const optionCount = r.u32();
    const options = Array.from({ length: optionCount }, () => r.text());
    r.i32(); r.i32(); r.i32(); r.i32(); r.skipPolicy(); r.i32(); r.i32();
    const columns = r.u32();
    for (let c = 0; c < columns; c += 1) r.text();
    const rows = r.u32();
    for (let row = 0; row < rows; row += 1) for (let c = 0; c < columns; c += 1) r.text();
    if (id === 'fruits') {
      listboxSeen = true;
      assert.equal(kind, 6);
      assert.equal(binding, 'fruits');
      assert.deepEqual(options, ['Apple', 'Banana', 'Cherry', 'Mango']);
    }
  }
  assert.equal(listboxSeen, true);
  assert.equal(r.u32(), 0, 'no menus');

  assert.equal(r.u32(), 1);
  assert.equal(r.text(), 'fruits');
  assert.equal(r.u8(), 2, 'changed event');
  assert.equal(r.u8(), 3, 'text-list event value');
  assert.equal(r.u32(), 1);
  assert.equal(r.u8(), 3, 'change action');
  assert.equal(r.text(), 'fruits');
  assert.equal(r.u8(), 4, 'change target is list state');
  assert.equal(r.u32(), 1);
  assert.equal(r.u8(), 1, 'set');
  assert.equal(r.u8(), 2, 'eventValue');
  assert.equal(r.offset, bytes.length);
});

test('sealed payload v10 keeps set/add/remove/clear list literals structurally distinct', () => {
  const actionSource = `create list choices = ["A"]\nwindow "Actions" as main:\n  button "Change" as change_button\n\nwhen change_button clicked:\n  change choices:\n    set = ["A", "B"]\n    add "C"\n    remove "A"\n    clear\n`;
  const ir = buildNativeGuiIRV11(compile(actionSource, { name: 'ListActions', kind: 'window' }));
  const bytes = encodeNativeGuiPayload(ir, { version: 10 });
  assert.ok(bytes.length > 0);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes('choices'));
  assert.ok(text.includes('A'));
  assert.ok(text.includes('B'));
  assert.ok(text.includes('C'));
});

test('sealed v10 requires IR 1.1 and older payload versions fail closed for list state', () => {
  const ir = buildNativeGuiIRV11(compile(source, { name: 'SealedMulti', kind: 'window' }));
  assert.throws(() => encodeNativeGuiPayload(ir, { version: 9 }), /IR 1\.1 requires.*v10/i);
  assert.throws(() => encodeNativeGuiPayload(ir, { version: 8 }), /IR 1\.1 requires.*v10/i);
});

test('sealed v10 footer round-trip preserves exact list payload bytes', () => {
  const ir = buildNativeGuiIRV11(compile(source, { name: 'SealedMulti', kind: 'window' }));
  const runtime = Uint8Array.of(0x4d, 0x5a, 0, 0, 0, 0, 0, 0);
  const sealed = sealNativeGuiRuntime(runtime, ir, { platform: 'windows', version: 10 });
  const decoded = decodeNativeGuiPayload(sealed);
  assert.deepEqual(decoded, encodeNativeGuiPayload(ir, { version: 10 }));
  const footer = new DataView(sealed.buffer, sealed.byteOffset + sealed.byteLength - 20, 20);
  assert.equal(footer.getUint32(8, true), 10);
});
