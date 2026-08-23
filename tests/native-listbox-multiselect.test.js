import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV11, toV10Compatible } from '../src/native-gui-ir-v11.js';
import { buildNativeGuiPlan } from '../src/native-gui-build-plan.js';
import { adaptNativeListsForV11Backend } from '../src/native-list-backend-adapter.js';
import { emitWin32GuiCppV12 } from '../src/win32-gui-v12.js';
import { emitAppKitGuiObjCppV12 } from '../src/appkit-gui-v12.js';
import { emitGtkGuiCppV12 } from '../src/gtk-gui-v12.js';

const source = fs.readFileSync('examples/listbox-multiselect-native.patch', 'utf8');

test('Native GUI IR 1.1 preserves persistent list state and multi-select ListBox semantics', () => {
  const ir = buildNativeGuiIRV11(compile(source, { name: 'NativeMulti', kind: 'window' }));
  assert.equal(ir.version, '1.1');
  assert.deepEqual(ir.states.find(state => state.name === 'fruits'), {
    name: 'fruits', type: 'list', initial: ['Banana', 'Mango']
  });
  const control = ir.forms[0].controls.find(item => item.id === 'fruits');
  assert.equal(control.type, 'listbox');
  assert.equal(control.selectionMode, 'multiple');
  const event = ir.events.find(item => item.control === 'fruits');
  assert.equal(event.event, 'changed');
  assert.equal(event.valueType, 'text-list');
  assert.deepEqual(event.actions[0], {
    kind: 'change', target: 'fruits', stateType: 'list', ops: [{ op: 'set', value: { kind: 'eventValue' } }]
  });
});

test('text-backed ListBox remains single-select and does not require Slider', () => {
  const scalar = fs.readFileSync('examples/listbox-window.patch', 'utf8');
  const compiled = compile(scalar, { name: 'ScalarList', kind: 'window' });
  const plan = buildNativeGuiPlan(compiled);
  assert.equal(plan.tier, 'tree-v13');
  assert.equal(plan.gui.version, '1.2');
  assert.equal(plan.features.slider, false);
});

test('Native GUI build plan uses the frozen TreeView contract for list state', () => {
  const plan = buildNativeGuiPlan(compile(source, { name: 'NativeMulti', kind: 'window' }));
  assert.equal(plan.tier, 'tree-v13');
  assert.equal(plan.gui.version, '1.2');
  assert.equal(plan.features.listState, true);
  assert.equal(plan.features.listBackedListBox, true);
});

test('Native GUI 1.1 list actions keep set/add/remove/clear explicit', () => {
  const actionSource = `create list choices = ["A"]\nwindow "Actions" as main:\n  button "Change" as change_button\n\nwhen change_button clicked:\n  change choices:\n    set = ["A", "B"]\n    add "C"\n    remove "A"\n    clear\n`;
  const ir = buildNativeGuiIRV11(compile(actionSource, { name: 'ListActions', kind: 'window' }));
  const action = ir.events[0].actions[0];
  assert.deepEqual(action, {
    kind: 'change',
    target: 'choices',
    stateType: 'list',
    ops: [
      { op: 'set', value: { kind: 'literal', value: ['A', 'B'] } },
      { op: 'add', value: { kind: 'literal', value: 'C' } },
      { op: 'remove', value: { kind: 'literal', value: 'A' } },
      { op: 'clear' }
    ]
  });
});

test('Native GUI 1.1 rejects non-literal list initialization and list interpolation', () => {
  assert.throws(
    () => buildNativeGuiIRV11(compile('create list choices = value\nwindow "Bad":\n  text "Bad"\n', { name: 'BadInit', kind: 'window' })),
    /must be a literal list of quoted text/i
  );
  assert.throws(
    () => buildNativeGuiIRV11(compile('create list choices = ["A"]\nwindow "{choices}":\n  text "Bad"\n', { name: 'BadInterpolation', kind: 'window' })),
    /does not interpolate list state 'choices'/i
  );
});

test('Table text-list semantics remain intact when a project also has native list state', () => {
  const mixed = `create list choices = ["A"]\ncreate text status = "idle"\nwindow "Mixed":\n  listbox "A", "B" as choices\n  table "Name", "Role" as people:\n    row "Ada", "Engineer"\n    row "Grace", "Scientist"\n\nwhen choices changed:\n  change choices:\n    set = value\n\nwhen people changed:\n  change status:\n    set = "selected"\n`;
  const ir = buildNativeGuiIRV11(compile(mixed, { name: 'Mixed', kind: 'window' }));
  assert.equal(ir.events.find(event => event.control === 'choices').valueType, 'text-list');
  assert.equal(ir.events.find(event => event.control === 'people').valueType, 'text-list');
  const compatible = toV10Compatible(ir);
  assert.equal(compatible.events.find(event => event.control === 'choices').valueType, 'text');
  assert.equal(compatible.events.find(event => event.control === 'people').valueType, 'text-list');
  const adapted = adaptNativeListsForV11Backend(ir);
  assert.deepEqual(adapted.events.map(event => event.control), ['choices']);
});

test('Win32 backend 1.2 emits vector list state and real extended multi-selection', () => {
  const ir = buildNativeGuiIRV11(compile(source, { name: 'NativeMulti', kind: 'window' }));
  const cpp = emitWin32GuiCppV12(ir);
  for (const marker of [
    'backend 1.2', 'std::vector<std::wstring> patch_state_fruits', 'LBS_EXTENDEDSEL',
    'LB_GETSELCOUNT', 'LB_GETSELITEMS', 'LB_SETSEL', 'ListBoxTexts', 'SetListBoxSelections',
    'Event_0(ListBoxTexts(controlHwnd))', 'LBN_SELCHANGE'
  ]) assert.ok(cpp.includes(marker), marker);
});

test('AppKit backend 1.2 emits NSArray list state and allows multiple selection', () => {
  const ir = buildNativeGuiIRV11(compile(source, { name: 'NativeMulti', kind: 'window' }));
  const cpp = emitAppKitGuiObjCppV12(ir);
  for (const marker of [
    'backend 1.2', 'NSArray<NSString *> *patch_state_fruits', 'allowsMultipleSelection = YES',
    'selectedRowIndexes', 'PatchSelectedListValues', 'SetListSelections',
    'Event_0(PatchSelectedListValues((NSTableView *)sender))'
  ]) assert.ok(cpp.includes(marker), marker);
});

test('GTK backend 1.2 emits vector list state and GTK multiple selection', () => {
  const ir = buildNativeGuiIRV11(compile(source, { name: 'NativeMulti', kind: 'window' }));
  const cpp = emitGtkGuiCppV12(ir);
  for (const marker of [
    'backend 1.2', 'std::vector<std::string> patch_state_fruits', 'GTK_SELECTION_MULTIPLE',
    'selected-rows-changed', 'gtk_list_box_get_selected_rows', 'ListBoxTexts', 'SetListSelections',
    'OnListMultiChanged'
  ]) assert.ok(cpp.includes(marker), marker);
});
