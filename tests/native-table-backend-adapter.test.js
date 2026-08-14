import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { validateNativeGuiIR } from '../src/native-gui-ir.js';
import { buildNativeGuiIRV08 } from '../src/native-gui-ir-v08.js';
import {
  adaptNativeTablesForLegacyBackend,
  tableEventIndexById
} from '../src/native-table-backend-adapter.js';

const source = `create text status = "idle"

window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"

when people changed:
  change status:
    set = "selected"
`;

test('Table backend adapter keeps Native GUI IR 0.8 immutable and produces valid private v0.7 shadows', () => {
  const ir = buildNativeGuiIRV08(compile(source, { kind: 'window', name: 'People' }));
  const before = structuredClone(ir);
  const adapted = adaptNativeTablesForLegacyBackend(ir);

  assert.deepEqual(ir, before);
  assert.equal(adapted.ir.version, '0.8');
  assert.equal(adapted.legacyIr.version, '0.7');
  assert.equal(validateNativeGuiIR(adapted.legacyIr), adapted.legacyIr);
  assert.equal(adapted.tables.length, 1);

  const table = adapted.tables[0];
  assert.equal(table.id, 'people');
  assert.deepEqual(table.columns, ['Name', 'Role']);
  assert.deepEqual(table.rows, [['Ada', 'Engineer'], ['Grace', 'Scientist']]);
  assert.equal(table.nativeIndex, 0);

  const shadow = adapted.legacyIr.forms[0].controls[0];
  assert.equal(shadow.type, 'listbox');
  assert.equal(shadow.id, 'people');
  assert.equal(shadow.binding, table.shadowState);
  assert.deepEqual(shadow.options, ['__patch_table_row_0', '__patch_table_row_1']);
  assert.ok(adapted.legacyIr.states.some(state => state.name === table.shadowState && state.type === 'text'));

  const event = adapted.legacyIr.events.find(item => item.control === 'people');
  assert.equal(event.valueType, 'text');
  assert.equal(adapted.ir.events.find(item => item.control === 'people').valueType, 'text-list');
  assert.equal(tableEventIndexById(adapted.ir).get('people'), 0);
});

test('Table backend adapter preserves flattened index and parent metadata', () => {
  const ir = buildNativeGuiIRV08(compile(source, { kind: 'window', name: 'People' }));
  const adapted = adaptNativeTablesForLegacyBackend(ir);
  assert.equal(adapted.controls[0].nativeIndex, adapted.tables[0].nativeIndex);
  assert.equal(adapted.controls[0].formIndex, adapted.tables[0].formIndex);
  assert.equal(adapted.controls[0].parentTabIndex, -1);
  assert.equal(adapted.controls[0].pageIndex, -1);
});
