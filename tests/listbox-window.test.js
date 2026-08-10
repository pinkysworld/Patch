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
const formsDesigner = fs.readFileSync('web/forms-designer.js', 'utf8');

test('parser records ListBox options, id and taller source-backed geometry', () => {
  const ast = parse(source);
  const listbox = ast[1].body.find(node => node.control === 'listbox');
  assert.ok(listbox);
  assert.equal(listbox.id, 'fruit');
  assert.deepEqual(listbox.options, ['"Apple"', '"Banana"', '"Cherry"', '"Mango"']);
  assert.deepEqual(listbox.layout, { x: 24, y: 72, width: 220, height: 120 });
});

test('ListBox needs at least two options', () => {
  assert.throws(
    () => parse('window "Demo":\n  listbox "Only" as choice\n'),
    /A listbox needs at least two options/
  );
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
  assert.throws(
    () => triggerWindowEvent(runtime, 'fruit', 'changed', { value: true }),
    /needs a text event-local value/
  );
});

test('ListBox event-local value does not persist without an explicit change', () => {
  const runtime = new PatchInterpreter();
  runtime.run(`create text fruit = "Banana"\n\nwindow "Demo":\n  listbox "Apple", "Banana", "Cherry" as fruit\n\nwhen fruit changed:\n  show value\n`);
  const result = triggerWindowEvent(runtime, 'fruit', 'changed', { value: 'Cherry' });
  assert.equal(result.state.fruit, 'Banana');
  assert.deepEqual(result.output, ['Cherry']);
});

test('Designer can add, resize, rename and edit ListBox options in source', () => {
  let edited = addDesignerControl('window "Demo" as main size 480, 320:\n', 'listbox');
  let listbox = listDesignerControls(edited)[0];
  assert.equal(listbox.type, 'listbox');
  assert.deepEqual(listbox.options, ['"Option 1"', '"Option 2"', '"Option 3"']);
  assert.equal(listbox.width, 220);
  assert.equal(listbox.height, 120);

  edited += `\nwhen ${listbox.id} changed:\n  show value\n`;
  edited = updateDesignerControl(edited, listbox, {
    id: 'fruit',
    options: ['"Apple"', '"Banana"', '"Cherry"'],
    x: 40,
    y: 80,
    width: 260,
    height: 140
  });
  listbox = listDesignerControls(edited)[0];
  assert.equal(listbox.id, 'fruit');
  assert.deepEqual(listbox.options, ['"Apple"', '"Banana"', '"Cherry"']);
  assert.match(edited, /listbox "Apple", "Banana", "Cherry" as fruit at 40, 80 size 260, 140/);
  assert.match(edited, /when fruit changed:/);
});

test('Patch Studio toolbox and preview expose a real multi-row ListBox', () => {
  assert.match(studioIndex, /id="addListbox"/);
  assert.match(studio, /addControl\('listbox'\)/);
  assert.match(studio, /control\.type === 'listbox'/);
  assert.match(studio, /el\.size = Math\.min/);
  assert.match(studio, /patch-listbox/);
  assert.match(studio, /\['combo', 'listbox'\]\.includes\(selected\.type\)/);
  assert.match(formsDesigner, /\['#addListbox', 'listbox'\]/);
  assert.match(formsDesigner, /control\.type === 'listbox'/);
});

test('Standalone Window Web App renders ListBox and emits a text changed payload', () => {
  const built = buildStandaloneWebApp(source, { name: 'ListBoxDemo', kind: 'window' });
  assert.equal(built.metadata.version, '0.7');
  assert.match(built.html, /type==='combo'\|\|control\.type==='listbox'/);
  assert.match(built.html, /el\.size=Math\.min/);
  assert.match(built.html, /type==='combo'\|\|type==='listbox'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:el\.value\}\)/);
  assert.match(built.html, /Apple/);
  assert.match(built.html, /Banana/);
  assert.match(built.html, /Cherry/);
});

test('Native GUI v0.2 fails closed on ListBox until native parity is implemented', () => {
  const compiled = compile(source, { name: 'ListBoxDemo', kind: 'window' });
  assert.throws(
    () => buildNativeGuiIR(compiled),
    /native GUI v0\.2 does not support 'listbox' controls yet/
  );
});
