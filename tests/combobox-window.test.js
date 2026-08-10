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

const source = fs.readFileSync('examples/combo-window.patch', 'utf8');
const studioIndex = fs.readFileSync('web/index.html', 'utf8');
const studio = fs.readFileSync('web/playground.js', 'utf8');
const formsDesigner = fs.readFileSync('web/forms-designer.js', 'utf8');

test('parser records ComboBox options, id and source-backed geometry', () => {
  const ast = parse(source);
  const combo = ast[1].body.find(node => node.control === 'combo');
  assert.ok(combo);
  assert.equal(combo.id, 'size');
  assert.deepEqual(combo.options, ['"Small"', '"Medium"', '"Large"']);
  assert.deepEqual(combo.layout, { x: 24, y: 72, width: 220, height: 36 });
});

test('ComboBox needs at least two options', () => {
  assert.throws(
    () => parse('window "Demo":\n  combo "Only" as choice\n'),
    /A combo needs at least two options/
  );
});

test('compiled Window IR preserves ComboBox option expressions', () => {
  const compiled = compile(source, { name: 'ComboDemo', kind: 'window' });
  const windowInstruction = compiled.ir.instructions.find(item => item.code === 'WINDOW');
  const combo = windowInstruction.body.find(item => item.code === 'UI_CONTROL' && item.control === 'combo');
  assert.deepEqual(combo.options, ['"Small"', '"Medium"', '"Large"']);
  assert.equal(validateWindowRuntimeSupport(compiled).events, 1);
});

test('ComboBox changed value is transient text until Patch source explicitly changes state', () => {
  const runtime = new PatchInterpreter();
  const initial = runtime.run(source);
  const combo = initial.ui[0].controls.find(control => control.type === 'combo');
  assert.deepEqual(combo.options, ['Small', 'Medium', 'Large']);
  assert.equal(combo.value, 'Medium');

  const changed = triggerWindowEvent(runtime, 'size', 'changed', { value: 'Large' });
  assert.equal(changed.state.size, 'Large');
  assert.equal(changed.history.at(-1).target, 'size');

  assert.throws(
    () => triggerWindowEvent(runtime, 'size', 'changed', { value: true }),
    /needs a text event-local value/
  );
});

test('ComboBox event-local value does not persist without an explicit change', () => {
  const runtime = new PatchInterpreter();
  runtime.run(`create text size = "Medium"\n\nwindow "Demo":\n  combo "Small", "Medium", "Large" as size\n\nwhen size changed:\n  show value\n`);
  const result = triggerWindowEvent(runtime, 'size', 'changed', { value: 'Large' });
  assert.equal(result.state.size, 'Medium');
  assert.deepEqual(result.output, ['Large']);
});

test('Designer can add, move, rename and edit ComboBox options in source', () => {
  let edited = addDesignerControl('window "Demo" as main size 480, 240:\n', 'combo');
  let combo = listDesignerControls(edited)[0];
  assert.equal(combo.type, 'combo');
  assert.deepEqual(combo.options, ['"Option 1"', '"Option 2"', '"Option 3"']);

  edited += `\nwhen ${combo.id} changed:\n  show value\n`;
  edited = updateDesignerControl(edited, combo, {
    id: 'size',
    options: ['"Small"', '"Medium"', '"Large"'],
    x: 40,
    y: 80,
    width: 260,
    height: 38
  });
  combo = listDesignerControls(edited)[0];
  assert.equal(combo.id, 'size');
  assert.deepEqual(combo.options, ['"Small"', '"Medium"', '"Large"']);
  assert.match(edited, /combo "Small", "Medium", "Large" as size at 40, 80 size 260, 38/);
  assert.match(edited, /when size changed:/);
});

test('Patch Studio toolbox and preview expose source-backed ComboBox editing', () => {
  assert.match(studioIndex, /id="addCombo"/);
  assert.match(studio, /addControl\('combo'\)/);
  assert.match(studio, /control\.type === 'combo'/);
  assert.match(studio, /document\.createElement\('select'\)/);
  assert.match(studio, /designerInspectorOptions/);
  assert.match(studio, /changes\.options = splitOptionExpressions/);
  assert.match(formsDesigner, /\['#addCombo', 'combo'\]/);
  assert.match(formsDesigner, /control\.type === 'combo'/);
});

test('Standalone Window Web App renders ComboBox and emits a text changed payload', () => {
  const built = buildStandaloneWebApp(source, { name: 'ComboDemo', kind: 'window' });
  assert.equal(built.metadata.version, '0.8');
  assert.match(built.html, /document\.createElement\('select'\)/);
  assert.match(built.html, /node\.options\.map\(uiOption\)/);
  assert.match(built.html, /type==='combo'\|\|type==='listbox'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:el\.value\}\)/);
  assert.match(built.html, /Small/);
  assert.match(built.html, /Medium/);
  assert.match(built.html, /Large/);
});

test('native GUI v0.3 carries ComboBox options, text binding and changed event semantics', () => {
  const compiled = compile(source, { name: 'ComboDemo', kind: 'window' });
  const ir = buildNativeGuiIR(compiled);
  assert.equal(ir.version, '0.3');
  assert.deepEqual(ir.states, [{ name: 'size', type: 'text', initial: 'Medium' }]);
  const combo = ir.forms[0].controls.find(control => control.id === 'size');
  assert.deepEqual(combo, {
    type: 'combo',
    id: 'size',
    text: '',
    binding: 'size',
    options: ['Small', 'Medium', 'Large'],
    layout: { x: 24, y: 72, width: 220, height: 36 }
  });
  assert.deepEqual(ir.events, [{
    control: 'size',
    event: 'changed',
    valueType: 'text',
    actions: [{
      kind: 'change',
      target: 'size',
      stateType: 'text',
      ops: [{ op: 'set', value: { kind: 'eventValue' } }]
    }]
  }]);
});