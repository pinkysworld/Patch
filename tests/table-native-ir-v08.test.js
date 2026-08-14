import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR, PATCH_NATIVE_GUI_IR_VERSION } from '../src/native-gui-ir.js';
import {
  PATCH_NATIVE_GUI_IR_V08_VERSION,
  buildNativeGuiIRV08,
  validateNativeGuiIRV08,
  flattenNativeGuiControlsV08
} from '../src/native-gui-ir-v08.js';

const source = `create text status = "idle"

window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"

when people changed:
  change status as "remember selection":
    set "selected"
`;

test('stable Native GUI IR entry point remains v0.7 and fails closed for Table', () => {
  const compiled = compile(source, { kind: 'window', name: 'PeopleTable' });
  assert.equal(PATCH_NATIVE_GUI_IR_VERSION, '0.7');
  assert.throws(() => buildNativeGuiIR(compiled), /does not support 'table' controls yet/i);
});

test('opt-in Native GUI IR 0.8 preserves Table columns rows layout and transient event type', () => {
  const compiled = compile(source, { kind: 'window', name: 'PeopleTable' });
  const ir = buildNativeGuiIRV08(compiled);
  assert.equal(PATCH_NATIVE_GUI_IR_V08_VERSION, '0.8');
  assert.equal(ir.version, '0.8');
  assert.equal(ir.states.some(state => state.name.startsWith('__patch_table_v08_')), false);

  const table = ir.forms[0].controls[0];
  assert.equal(table.type, 'table');
  assert.equal(table.id, 'people');
  assert.deepEqual(table.columns, ['Name', 'Role']);
  assert.deepEqual(table.rows, [['Ada', 'Engineer'], ['Grace', 'Scientist']]);
  assert.deepEqual(table.layout, { x: 24, y: 64, width: 440, height: 180, policy: { kind: 'fixed' } });

  const event = ir.events.find(item => item.control === 'people');
  assert.equal(event.event, 'changed');
  assert.equal(event.valueType, 'text-list');
  assert.deepEqual(event.actions, [{
    kind: 'change',
    target: 'status',
    stateType: 'text',
    ops: [{ op: 'set', value: { kind: 'literal', value: 'selected' } }]
  }]);

  const flattened = flattenNativeGuiControlsV08(ir);
  assert.equal(flattened[0].type, 'table');
  assert.deepEqual(flattened[0].rows[1], ['Grace', 'Scientist']);
  assert.equal(validateNativeGuiIRV08(ir), ir);
});

test('Native GUI IR 0.8 rejects scalar assignment from list-valued Table event value', () => {
  const invalid = source.replace('set "selected"', 'set value');
  const compiled = compile(invalid, { kind: 'window', name: 'PeopleTable' });
  assert.throws(
    () => buildNativeGuiIRV08(compiled),
    /Table row value is list-valued and cannot be assigned to scalar native state yet/i
  );
});

test('Native GUI IR 0.8 does not imply persistent native list state', () => {
  const withListState = source.replace('create text status = "idle"', 'create list status = []');
  const compiled = compile(withListState, { kind: 'window', name: 'PeopleTable' });
  assert.throws(
    () => buildNativeGuiIRV08(compiled),
    /supports number, text and boolean state/i
  );
});

test('Native GUI IR 0.8 validator rejects malformed Table row width and event type', () => {
  const ir = buildNativeGuiIRV08(compile(source, { kind: 'window', name: 'PeopleTable' }));
  const badRows = structuredClone(ir);
  badRows.forms[0].controls[0].rows[0] = ['Ada'];
  assert.throws(() => validateNativeGuiIRV08(badRows), /has invalid rows/i);

  const badEvent = structuredClone(ir);
  badEvent.events.find(item => item.control === 'people').valueType = 'text';
  assert.throws(() => validateNativeGuiIRV08(badEvent), /must be changed with text-list value/i);
});