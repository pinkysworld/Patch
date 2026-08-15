import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV08 } from '../src/native-gui-ir-v08.js';
import {
  PATCH_SEALED_NATIVE_GUI_TABLE_VERSION,
  encodeNativeGuiPayload,
  sealNativeGuiRuntime,
  decodeNativeGuiPayload
} from '../src/sealed-native-gui.js';

const source = fs.readFileSync('examples/table-native-v09.patch', 'utf8');
const gui = buildNativeGuiIRV08(compile(source, { name: 'SealedTable', kind: 'window' }));

test('sealed payload v9 transports Table columns rows layout and text-list event type', () => {
  assert.equal(PATCH_SEALED_NATIVE_GUI_TABLE_VERSION, 9);
  const payload = encodeNativeGuiPayload(gui, { version: 9 });
  const decoded = readPayloadV9(payload);
  const table = decoded.controls.find(control => control.id === 'people');
  assert.ok(table);
  assert.equal(table.kind, 9);
  assert.deepEqual(table.columns, ['Name', 'Role']);
  assert.deepEqual(table.rows, [['Ada', 'Engineer'], ['Grace', 'Scientist']]);
  assert.deepEqual(table.policy, [1, 7]);
  assert.deepEqual([table.parentTabIndex, table.pageIndex], [-1, -1]);
  assert.deepEqual(decoded.events.find(event => event.control === 'people'), {
    control: 'people', eventKind: 2, valueType: 3, actionKinds: [3]
  });
});

test('Native GUI IR 0.8 is fail-closed on old sealed payload versions', () => {
  assert.throws(() => encodeNativeGuiPayload(gui, { version: 8 }), /requires sealed native GUI payload v9/i);
  assert.throws(() => encodeNativeGuiPayload(gui, { version: 7 }), /requires sealed native GUI payload v9/i);
});

test('payload v9 round-trips through the executable footer without source text', () => {
  const fakePe = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4, 5, 6]);
  const payload = encodeNativeGuiPayload(gui, { version: 9 });
  const sealed = sealNativeGuiRuntime(fakePe, gui, { version: 9 });
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12, 4).getUint32(0, true), 9);
  assert.deepEqual(decodeNativeGuiPayload(sealed), payload);
  const text = new TextDecoder().decode(payload);
  assert.match(text, /Ada/);
  assert.match(text, /Scientist/);
  assert.doesNotMatch(text, /table "Name"/);
});

function readPayloadV9(bytes) {
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u8 = () => view.getUint8(offset++);
  const u32 = () => { const value = view.getUint32(offset, true); offset += 4; return value; };
  const i32 = () => { const value = view.getInt32(offset, true); offset += 4; return value; };
  const f64 = () => { const value = view.getFloat64(offset, true); offset += 8; return value; };
  const text = () => { const length = u32(); const value = new TextDecoder().decode(bytes.subarray(offset, offset + length)); offset += length; return value; };
  const skipValue = type => { if (type === 1) f64(); else if (type === 2) text(); else if (type === 3) u8(); else throw new Error(`bad state type ${type}`); };
  const skipAction = () => {
    const kind = u8();
    if (kind === 1 || kind === 2) text();
    else if (kind === 4) { text(); text(); text(); }
    else if (kind === 5) { text(); text(); text(); text(); }
    else if (kind === 6 || kind === 7) { text(); text(); text(); }
    else if (kind === 3) {
      text(); const stateType = u8(); const opCount = u32();
      for (let o = 0; o < opCount; o += 1) {
        const op = u8(); const valueKind = u8();
        if (op !== 4 && valueKind === 1) skipValue(stateType);
      }
    } else throw new Error(`bad action ${kind}`);
    return kind;
  };

  const stateCount = u32();
  for (let i = 0; i < stateCount; i += 1) { text(); skipValue(u8()); }
  const formCount = u32();
  const controls = [];
  for (let form = 0; form < formCount; form += 1) {
    text(); text(); u32(); u32(); u8();
    const controlCount = u32();
    for (let c = 0; c < controlCount; c += 1) {
      const kind = u8(); const id = text(); text(); text();
      const optionCount = u32(); for (let i = 0; i < optionCount; i += 1) text();
      i32(); i32(); i32(); i32();
      const policy = [u8(), u8()];
      const parentTabIndex = i32(); const pageIndex = i32();
      const columnCount = u32(); const columns = Array.from({ length: columnCount }, () => text());
      const rowCount = u32(); const rows = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => text()));
      controls.push({ kind, id, policy, parentTabIndex, pageIndex, columns, rows });
    }
    const menuCount = u32();
    for (let m = 0; m < menuCount; m += 1) {
      text(); const itemCount = u32(); for (let i = 0; i < itemCount; i += 1) { text(); text(); }
    }
  }
  const eventCount = u32();
  const events = [];
  for (let e = 0; e < eventCount; e += 1) {
    const control = text(); const eventKind = u8(); const valueType = u8(); const actionCount = u32();
    const actionKinds = Array.from({ length: actionCount }, skipAction);
    events.push({ control, eventKind, valueType, actionKinds });
  }
  assert.equal(offset, bytes.length);
  return { controls, events };
}
