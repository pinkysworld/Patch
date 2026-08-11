import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent, PATCH_WINDOW_EVENTS_VERSION } from '../src/window-events.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { encodeNativeGuiPayload, PATCH_SEALED_NATIVE_GUI_VERSION } from '../src/sealed-native-gui.js';
import { emitWin32GuiCpp } from '../src/win32-gui.js';
import { emitAppKitGuiObjCpp } from '../src/appkit-gui.js';
import { emitGtkGuiCpp } from '../src/gtk-gui.js';

const source = fs.readFileSync('examples/radio-window.patch', 'utf8');

test('parser records grouped Radio options, binding id and source-backed geometry', () => {
  const ast = parse(source);
  const radio = ast.find(node => node.kind === 'window').body.find(node => node.control === 'radio');
  assert.ok(radio);
  assert.equal(radio.id, 'mode');
  assert.deepEqual(radio.options, ['"Basic"', '"Advanced"', '"Expert"']);
  assert.deepEqual(radio.layout, { x: 24, y: 72, width: 240, height: 90 });
  assert.throws(() => parse('window "Demo":\n  radio "Only" as mode\n'), /radio group needs at least two options/i);
});

test('Change IR keeps Radio in UI_CONTROL and advertises ui.radio without changing IR 0.10', () => {
  const compiled = compile(source, { kind: 'window', name: 'RadioDemo' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.radio'));
  const window = compiled.ir.instructions.find(item => item.code === 'WINDOW');
  const radio = window.body.find(item => item.code === 'UI_CONTROL' && item.control === 'radio');
  assert.deepEqual(radio.options, ['"Basic"', '"Advanced"', '"Expert"']);
  assert.equal(validateWindowRuntimeSupport(compiled).events, 1);
});

test('Radio changed value is transient text and persists only through explicit Patch change', () => {
  const runtime = new PatchInterpreter();
  const initial = runtime.run(source);
  const radio = initial.ui[0].controls.find(control => control.type === 'radio');
  assert.deepEqual(radio.options, ['Basic', 'Advanced', 'Expert']);
  assert.equal(radio.value, 'Basic');
  const changed = triggerWindowEvent(runtime, 'mode', 'changed', { value: 'Expert' });
  assert.equal(changed.state.mode, 'Expert');
  assert.equal(changed.history.at(-1).target, 'mode');
  assert.throws(() => triggerWindowEvent(runtime, 'mode', 'changed', { value: true }), /needs a text event-local value/);
});

test('Window event adapter v0.5 type-checks controls nested inside Tabs recursively', () => {
  assert.equal(PATCH_WINDOW_EVENTS_VERSION, '0.5');
  const nested = `create text mode = "A"\n\nwindow "Nested" as main:\n  tabs as settings:\n    tab "One":\n      radio "A", "B" as mode\n    tab "Two":\n      text "Two"\n\nwhen mode changed:\n  change mode:\n    set = value\n`;
  const runtime = new PatchInterpreter();
  runtime.run(nested);
  assert.throws(() => triggerWindowEvent(runtime, 'mode', 'changed', { value: false }), /radio 'mode' needs a text event-local value/);
  assert.equal(triggerWindowEvent(runtime, 'mode', 'changed', { value: 'B' }).state.mode, 'B');
});

test('Designer can add, resize, rename and edit Radio options in source', () => {
  let edited = addDesignerControl('window "Demo" as main size 480, 300:\n', 'radio');
  let radio = listDesignerControls(edited)[0];
  assert.equal(radio.type, 'radio');
  assert.equal(radio.height, 84);
  assert.deepEqual(radio.options, ['"Option 1"', '"Option 2"', '"Option 3"']);
  edited += `\nwhen ${radio.id} changed:\n  show value\n`;
  edited = updateDesignerControl(edited, radio, {
    id: 'mode', options: ['"Basic"', '"Advanced"', '"Expert"'], x: 40, y: 80, width: 260, height: 96
  });
  radio = listDesignerControls(edited)[0];
  assert.equal(radio.id, 'mode');
  assert.deepEqual(radio.options, ['"Basic"', '"Advanced"', '"Expert"']);
  assert.match(edited, /radio "Basic", "Advanced", "Expert" as mode at 40, 80 size 260, 96/);
  assert.match(edited, /when mode changed:/);
});

test('Native GUI IR v0.5 carries Radio options, text binding and changed event semantics', () => {
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'RadioDemo' }));
  assert.equal(ir.version, '0.5');
  assert.deepEqual(ir.states, [{ name: 'mode', type: 'text', initial: 'Basic' }]);
  const radio = ir.forms[0].controls.find(control => control.id === 'mode');
  assert.equal(radio.type, 'radio');
  assert.equal(radio.binding, 'mode');
  assert.deepEqual(radio.options, ['Basic', 'Advanced', 'Expert']);
  assert.equal(ir.events[0].valueType, 'text');
  assert.deepEqual(ir.events[0].actions[0].ops, [{ op: 'set', value: { kind: 'eventValue' } }]);
});

test('sealed native GUI payload v5 contains Radio kind/options without Patch source', () => {
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'RadioDemo' }));
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 5);
  const payload = encodeNativeGuiPayload(ir);
  const text = new TextDecoder().decode(payload);
  assert.match(text, /Basic/);
  assert.match(text, /Advanced/);
  assert.match(text, /Expert/);
  assert.doesNotMatch(text, /when mode changed/);
});

test('all three AOT backends emit real native Radio groups', () => {
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'RadioDemo' }));
  const win = emitWin32GuiCpp(ir);
  const mac = emitAppKitGuiObjCpp(ir);
  const gtk = emitGtkGuiCpp(ir);
  assert.match(win, /BS_AUTORADIOBUTTON/);
  assert.match(win, /gRadioItems/);
  assert.match(mac, /NSButtonTypeRadio/);
  assert.match(mac, /gRadioItems/);
  assert.match(gtk, /gtk_radio_button_new_with_label/);
  assert.match(gtk, /OnRadioToggled/);
});
