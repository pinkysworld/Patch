import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';

const source = fs.readFileSync('examples/listbox-window.patch', 'utf8');
const studioIndex = fs.readFileSync('web/index.html', 'utf8');
const studio = fs.readFileSync('web/playground.js', 'utf8');
const tableStage = fs.readFileSync('web/table-stage1.js', 'utf8');
const formsDesigner = fs.readFileSync('web/forms-designer.js', 'utf8');
const compatibilityBuilder = fs.readFileSync('scripts/build-native-window-template.js', 'utf8');

const multiSource = `create list fruit = ["Banana", "Mango"]

window "Multi ListBox" as main size 520, 340:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruit at 24, 72 size 220, 120

when fruit changed:
  show value
`;

const multiPersistSource = `create list fruit = ["Banana"]

window "Multi ListBox" as main size 520, 340:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruit at 24, 72 size 220, 120

when fruit changed:
  change fruit:
    set = value
`;

test('parser records ListBox options, id and taller source-backed geometry', () => {
  const ast = parse(source);
  const listbox = ast[1].body.find(node => node.control === 'listbox');
  assert.ok(listbox);
  assert.equal(listbox.id, 'fruit');
  assert.deepEqual(listbox.options, ['"Apple"', '"Banana"', '"Cherry"', '"Mango"']);
  assert.deepEqual(listbox.layout, { x: 24, y: 72, width: 220, height: 120 });
});

test('ListBox needs at least two options', () => {
  assert.throws(() => parse('window "Demo":\n  listbox "Only" as choice\n'), /A listbox needs at least two options/);
});

test('compiled Window IR preserves ListBox option expressions and changed event validation', () => {
  const compiled = compile(source, { name: 'ListBoxDemo', kind: 'window' });
  const windowInstruction = compiled.ir.instructions.find(item => item.code === 'WINDOW');
  const listbox = windowInstruction.body.find(item => item.code === 'UI_CONTROL' && item.control === 'listbox');
  assert.deepEqual(listbox.options, ['"Apple"', '"Banana"', '"Cherry"', '"Mango"']);
  assert.equal(validateWindowRuntimeSupport(compiled).events, 1);
});

test('ListBox changed value is transient text until Patch source explicitly changes state', () => {
  const runtime = new PatchInterpreter();
  const initial = runtime.run(source);
  const listbox = initial.ui[0].controls.find(control => control.type === 'listbox');
  assert.deepEqual(listbox.options, ['Apple', 'Banana', 'Cherry', 'Mango']);
  assert.equal(listbox.value, 'Banana');
  const changed = triggerWindowEvent(runtime, 'fruit', 'changed', { value: 'Mango' });
  assert.equal(changed.state.fruit, 'Mango');
  assert.equal(changed.history.at(-1).target, 'fruit');
  assert.throws(() => triggerWindowEvent(runtime, 'fruit', 'changed', { value: true }), /needs a text event-local value/);
});

test('ListBox event-local value does not persist without an explicit change', () => {
  const runtime = new PatchInterpreter();
  runtime.run(`create text fruit = "Banana"\n\nwindow "Demo":\n  listbox "Apple", "Banana", "Cherry" as fruit\n\nwhen fruit changed:\n  show value\n`);
  const result = triggerWindowEvent(runtime, 'fruit', 'changed', { value: 'Cherry' });
  assert.equal(result.state.fruit, 'Banana');
  assert.deepEqual(result.output, ['Cherry']);
});

test('list-backed ListBox exposes a transient text-list changed value', () => {
  const runtime = new PatchInterpreter();
  const initial = runtime.run(multiSource);
  const listbox = initial.ui[0].controls.find(control => control.type === 'listbox');
  assert.deepEqual(listbox.value, ['Banana', 'Mango']);

  const changed = triggerWindowEvent(runtime, 'fruit', 'changed', { value: ['Apple', 'Cherry'] });
  assert.deepEqual(changed.state.fruit, ['Banana', 'Mango']);
  assert.deepEqual(changed.output, ['Apple, Cherry']);
  assert.equal(changed.history.length, 0);
  assert.throws(
    () => triggerWindowEvent(runtime, 'fruit', 'changed', { value: 'Apple' }),
    /needs a text-list event-local value because 'fruit' is list state/
  );
  assert.throws(
    () => triggerWindowEvent(runtime, 'fruit', 'changed', { value: ['Apple', 2] }),
    /needs a text-list event-local value because 'fruit' is list state/
  );
});

test('list-backed ListBox selection persists only through an explicit semantic change', () => {
  const runtime = new PatchInterpreter();
  runtime.run(multiPersistSource);
  const changed = triggerWindowEvent(runtime, 'fruit', 'changed', { value: ['Apple', 'Mango'] });
  assert.deepEqual(changed.state.fruit, ['Apple', 'Mango']);
  assert.deepEqual(changed.history.at(-1).before, ['Banana']);
  assert.deepEqual(changed.history.at(-1).after, ['Apple', 'Mango']);
  assert.equal(changed.history.at(-1).target, 'fruit');
});

test('Designer can add, resize, rename and edit ListBox options in source', () => {
  let edited = addDesignerControl('window "Demo" as main size 480, 320:\n', 'listbox');
  let listbox = listDesignerControls(edited)[0];
  assert.equal(listbox.type, 'listbox');
  assert.equal(listbox.height, 120);
  edited += `\nwhen ${listbox.id} changed:\n  show value\n`;
  edited = updateDesignerControl(edited, listbox, { id: 'fruit', options: ['"Apple"', '"Banana"', '"Cherry"'], x: 40, y: 80, width: 260, height: 140 });
  assert.match(edited, /listbox "Apple", "Banana", "Cherry" as fruit at 40, 80 size 260, 140/);
  assert.match(edited, /when fruit changed:/);
});

test('Patch Studio toolbox and preview expose a real multi-row ListBox', () => {
  assert.match(studioIndex, /id="addListbox"/);
  assert.match(studio, /addControl\('listbox'\)/);
  assert.match(studio, /patch-listbox/);
  assert.match(formsDesigner, /\['#addListbox', 'listbox'\]/);
});

test('Patch Studio upgrades list-backed ListBox to multiple selection and text-list dispatch', () => {
  assert.match(tableStage, /const appListboxSelections = new Map\(\)/);
  assert.match(tableStage, /select\.multiple = true/);
  assert.match(tableStage, /select\.selectedOptions/);
  assert.match(tableStage, /aria-multiselectable/);
  assert.match(tableStage, /patch-studio-table-changed/);
  assert.match(tableStage, /collectListInitials/);
});

test('Standalone Window Web App preserves single-select ListBox string behavior', () => {
  const built = buildStandaloneWebApp(source, { name: 'ListBoxDemo', kind: 'window' });
  assert.equal(built.metadata.version, '0.9');
  assert.equal(built.metadata.listboxMultiSelectStage, undefined);
  assert.match(built.html, /el\.size=Math\.min/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:el\.value\}\)/);
});

test('Standalone Window Web App supports list-backed multi-select ListBox with transient selection state', () => {
  const built = buildStandaloneWebApp(multiPersistSource, { name: 'MultiListBox', kind: 'window' });
  assert.equal(built.metadata.version, '0.9');
  assert.equal(built.metadata.listboxMultiSelectStage, 1);
  assert.equal(built.metadata.listboxMultiSelectMode, 'list-state-text-list');
  assert.match(built.html, /const listboxSelections=new Map\(\)/);
  assert.match(built.html, /el\.multiple=true/);
  assert.match(built.html, /aria-multiselectable/);
  assert.match(built.html, /selectedOptions/);
  assert.match(built.html, /needs a text-list event-local value because it is list state/);
  assert.match(built.html, /listboxSelections\.set\(key,\[\.\.\.value\]\)/);
});

test('compatibility desktop renderer cannot silently omit ComboBox or ListBox', () => {
  assert.match(compatibilityBuilder, /control\.type==='combo'\|\|control\.type==='listbox'/);
  assert.match(compatibilityBuilder, /document\.createElement\('select'\)/);
  assert.match(compatibilityBuilder, /trigger\(control\.id,'changed',\{value:el\.value\}\)/);
  assert.match(compatibilityBuilder, /window-events\.js/);
  assert.match(compatibilityBuilder, /triggerWindowEvent/);
});

test('Native GUI v0.7 carries ListBox options, text binding and changed event semantics', () => {
  const ir = buildNativeGuiIR(compile(source, { name: 'ListBoxDemo', kind: 'window' }));
  assert.equal(ir.version, '0.7');
  assert.deepEqual(ir.states, [{ name: 'fruit', type: 'text', initial: 'Banana' }]);
  const listbox = ir.forms[0].controls.find(control => control.id === 'fruit');
  assert.deepEqual(listbox, { type: 'listbox', id: 'fruit', text: '', binding: 'fruit', options: ['Apple', 'Banana', 'Cherry', 'Mango'], layout: { x: 24, y: 72, width: 220, height: 120 } });
  assert.deepEqual(ir.events, [{ control: 'fruit', event: 'changed', valueType: 'text', form: 'main', actions: [{ kind: 'change', target: 'fruit', stateType: 'text', ops: [{ op: 'set', value: { kind: 'eventValue' } }] }] }]);
});

test('Native GUI v0.7 fails closed for list-backed multi-select ListBox state', () => {
  assert.throws(
    () => buildNativeGuiIR(compile(multiSource, { name: 'MultiListBox', kind: 'window' })),
    /supports number, text and boolean state/
  );
});
