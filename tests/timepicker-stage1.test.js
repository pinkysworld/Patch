import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import {
  collectWindowTimeInputIds,
  readWindowInputPresentation,
  setWindowInputMask,
  setWindowInputPresentation,
  setWindowNumberEdit
} from '../src/window-input-presentation.js';

const SOURCE = `create text appointment_time = "09:30"
window "Schedule" as main size 520, 300:
  # @input-mode time
  input appointment_time at 24, 24 size 220, 36
when appointment_time changed:
  change appointment_time:
    set = value
`;

test('TimePicker source mode round-trips as transparent Input presentation metadata', () => {
  const plain = `window "Schedule" as main size 520, 300:\n  input appointment_time at 24, 24 size 220, 36\n`;
  const time = setWindowInputPresentation(plain, 2, 'time');
  assert.match(time, /  # @input-mode time\n  input appointment_time/);
  assert.equal(readWindowInputPresentation(time, 3), 'time');
  assert.equal(setWindowInputPresentation(time, 3, 'plain'), plain);
});

test('TimePicker discovery follows Inputs through Tabs and Panels', () => {
  const source = `window "Nested" as main size 620, 420:
  # @input-mode time
  input top_time at 24, 24 size 220, 36
  tabs as pages at 24, 80 size 500, 160:
    tab "Time":
      # @input-mode time
      input tab_time
    tab "Other":
      input ordinary
  panel as times at 24, 260 size 320, 120:
    # @input-mode time
    input panel_time at 12, 12 size 220, 36
`;
  assert.deepEqual(collectWindowTimeInputIds(source, parse(source)), ['top_time', 'tab_time', 'panel_time']);
});

test('TimePicker is mutually exclusive with MaskedEdit and NumberEdit metadata', () => {
  const masked = `window "Bad" as main:\n  # @input-mode time\n  # @input-mask "00:00"\n  input appointment_time\n`;
  assert.throws(() => compile(masked, { kind: 'window' }), /cannot combine TimePicker and MaskedEdit/);

  const numbered = `window "Bad" as main:\n  # @input-mode time\n  # @number-edit\n  input appointment_time\n`;
  assert.throws(() => compile(numbered, { kind: 'window' }), /cannot combine NumberEdit and TimePicker/);

  const time = `window "Time":\n  # @input-mode time\n  input appointment_time\n`;
  assert.throws(() => setWindowInputMask(time, 3, '00:00'), /Input mode is Time/);
  assert.throws(() => setWindowNumberEdit(time, 3, true), /Input mode is Time/);

  const number = `window "Number":\n  # @number-edit\n  input appointment_time\n`;
  assert.throws(() => setWindowInputPresentation(number, 3, 'time'), /TimePicker cannot be enabled while NumberEdit is active/);
});

test('TimePicker compile metadata preserves ordinary Input and Change IR 0.10 semantics', () => {
  const compiled = compile(SOURCE, { name: 'Schedule', kind: 'window', entry: 'main.patch' });
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowInputPresentation.version, '0.3');
  assert.equal(input.control, 'input');
  assert.equal(input.inputPresentation, 'time');
});

test('Standalone Window Web renders TimePicker as browser time input while changed(value) stays text', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Schedule', kind: 'window' });
  assert.equal(built.metadata.timePickerStage, 1);
  assert.equal(built.metadata.timePickerVersion, '0.3');
  assert.equal(built.metadata.timePickerMode, 'source-backed-time-input');
  assert.equal(built.metadata.timePickerEventValue, 'local-time-text');
  assert.match(built.html, /control\.inputPresentation==='time'/);
  assert.match(built.html, /el\.type='time'/);
  assert.match(built.html, /dataset\.patchInputPresentation='time'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:el\.value\}\)/);
});

test('Current Ready native rejects TimePicker explicitly while plain Input remains compatible', () => {
  const compiled = compile(SOURCE, { name: 'Schedule', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /TimePicker Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i
  );

  const plain = compile(`create text value = "plain"\nwindow "Plain" as main size 420, 240:\n  input value at 24, 24 size 220, 36\n`, { name: 'Plain', kind: 'window', entry: 'main.patch' });
  assert.equal(buildCurrentNativeGuiIR(plain).version, '1.9');
});

test('Patch Studio exposes TimePicker palette, Inspector and time DOM presentation', () => {
  const studio = fs.readFileSync('src/window-input-presentation.js', 'utf8');
  assert.match(studio, /button\.id = 'addTimePicker'/);
  assert.match(studio, /button\.textContent = '\+ Time'/);
  assert.match(studio, /option value="time">Time<\/option>/);
  assert.match(studio, /date \? 'date' : time \? 'time'/);
  assert.match(studio, /time input/);
});
