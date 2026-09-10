import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import {
  collectWindowDateInputIds,
  readWindowInputPresentation,
  setWindowInputMask,
  setWindowInputPresentation,
  setWindowNumberEdit
} from '../src/window-input-presentation.js';

const SOURCE = `create text appointment = "2026-09-10"
window "Schedule" as main size 520, 300:
  # @input-mode date
  input appointment at 24, 24 size 220, 36
when appointment changed:
  change appointment:
    set = value
`;

test('DatePicker source mode round-trips as transparent Input presentation metadata', () => {
  const plain = `window "Schedule" as main size 520, 300:\n  input appointment at 24, 24 size 220, 36\n`;
  const date = setWindowInputPresentation(plain, 2, 'date');
  assert.match(date, /  # @input-mode date\n  input appointment/);
  assert.equal(readWindowInputPresentation(date, 3), 'date');
  assert.equal(setWindowInputPresentation(date, 3, 'plain'), plain);
});

test('DatePicker discovery follows Inputs through Tabs and Panels', () => {
  const source = `window "Nested" as main size 620, 420:
  # @input-mode date
  input top_date at 24, 24 size 220, 36
  tabs as pages at 24, 80 size 500, 160:
    tab "Date":
      # @input-mode date
      input tab_date
    tab "Other":
      input ordinary
  panel as dates at 24, 260 size 320, 120:
    # @input-mode date
    input panel_date at 12, 12 size 220, 36
`;
  assert.deepEqual(collectWindowDateInputIds(source, parse(source)), ['top_date', 'tab_date', 'panel_date']);
});

test('DatePicker is mutually exclusive with MaskedEdit and NumberEdit metadata', () => {
  const masked = `window "Bad" as main:\n  # @input-mode date\n  # @input-mask "0000"\n  input appointment\n`;
  assert.throws(() => compile(masked, { kind: 'window' }), /cannot combine DatePicker and MaskedEdit/);

  const numbered = `window "Bad" as main:\n  # @input-mode date\n  # @number-edit\n  input appointment\n`;
  assert.throws(() => compile(numbered, { kind: 'window' }), /cannot combine NumberEdit and DatePicker/);

  const date = `window "Date":\n  # @input-mode date\n  input appointment\n`;
  assert.throws(() => setWindowInputMask(date, 3, '0000'), /Input mode is Date/);
  assert.throws(() => setWindowNumberEdit(date, 3, true), /Input mode is Date/);

  const number = `window "Number":\n  # @number-edit\n  input appointment\n`;
  assert.throws(() => setWindowInputPresentation(number, 3, 'date'), /DatePicker cannot be enabled while NumberEdit is active/);
});

test('DatePicker compile metadata preserves ordinary Input and Change IR 0.10 semantics', () => {
  const compiled = compile(SOURCE, { name: 'Schedule', kind: 'window', entry: 'main.patch' });
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowInputPresentation.version, '0.2');
  assert.equal(input.control, 'input');
  assert.equal(input.inputPresentation, 'date');
});

test('Standalone Window Web renders DatePicker as browser date input while changed(value) stays text', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Schedule', kind: 'window' });
  assert.equal(built.metadata.datePickerStage, 1);
  assert.equal(built.metadata.datePickerVersion, '0.2');
  assert.equal(built.metadata.datePickerMode, 'source-backed-date-input');
  assert.equal(built.metadata.datePickerEventValue, 'iso-date-text');
  assert.match(built.html, /inputPresentation:node\.control==='input'/);
  assert.match(built.html, /control\.inputPresentation==='date'/);
  assert.match(built.html, /el\.type='date'/);
  assert.match(built.html, /dataset\.patchInputPresentation='date'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:el\.value\}\)/);
});

test('Current Ready native rejects DatePicker explicitly while plain Input remains compatible', () => {
  const compiled = compile(SOURCE, { name: 'Schedule', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /DatePicker Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i
  );

  const plain = compile(`create text value = "plain"\nwindow "Plain" as main size 420, 240:\n  input value at 24, 24 size 220, 36\n`, { name: 'Plain', kind: 'window', entry: 'main.patch' });
  assert.equal(buildCurrentNativeGuiIR(plain).version, '1.9');
});

test('Patch Studio exposes DatePicker palette, Inspector and date DOM presentation', () => {
  const studio = fs.readFileSync('src/window-input-presentation.js', 'utf8');
  assert.match(studio, /button\.id = 'addDatePicker'/);
  assert.match(studio, /button\.textContent = '\+ Date'/);
  assert.match(studio, /option value="date">Date<\/option>/);
  assert.match(studio, /input\.type = numberEdit \? 'number' : date \? 'date'/);
  assert.match(studio, /dataset\.patchInputPresentation = numberEdit \? 'number' : date \? 'date'/);
  assert.match(studio, /date input/);
});
