import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import {
  PATCH_NUMBEREDIT_DIRECTIVE,
  PATCH_NUMBEREDIT_FORMAT,
  PATCH_NUMBEREDIT_VERSION,
  buildWindowNumberEditManifest,
  collectWindowNumberEditInputIds,
  readWindowNumberEdit,
  setWindowNumberEdit,
  validateWindowNumberEditManifest
} from '../src/numberedit.js';

test('NumberEdit source contract is versioned and shares the browser-safe input presentation implementation', () => {
  assert.equal(PATCH_NUMBEREDIT_VERSION, '0.1');
  assert.equal(PATCH_NUMBEREDIT_FORMAT, 'patch-numberedit-presentation');
  assert.equal(PATCH_NUMBEREDIT_DIRECTIVE, 'number-edit');

  const compiler = fs.readFileSync('src/compiler.js', 'utf8');
  const contract = fs.readFileSync('src/numberedit.js', 'utf8');
  assert.equal(compiler.includes("./numberedit.js"), false);
  assert.match(compiler, /buildWindowNumberEditManifest/);
  assert.match(contract, /from '\.\/window-input-presentation\.js'/);
});

test('NumberEdit setter round-trips transparent source metadata', () => {
  const plain = `window "Quantity" as main size 420, 220:\n  input quantity at 24, 24 size 180, 36\n`;
  const enabled = setWindowNumberEdit(plain, 2, true);
  assert.match(enabled, /  # @number-edit\n  input quantity/);
  assert.equal(readWindowNumberEdit(enabled, 3), true);
  assert.equal(setWindowNumberEdit(enabled, 3, false), plain);
  assert.throws(
    () => setWindowNumberEdit('window "Bad":\n  button "No" as no\n', 2, true),
    /only be changed on an Input control/
  );
});

test('NumberEdit manifest follows Inputs through Tabs and Panels', () => {
  const source = `window "Nested" as main size 620, 420:\n  # @number-edit\n  input top_value at 24, 24 size 180, 36\n  tabs as pages at 24, 80 size 500, 160:\n    tab "One":\n      # @number-edit\n      input tab_value\n    tab "Two":\n      input ordinary\n  panel as group at 24, 260 size 320, 120:\n    # @number-edit\n    input panel_value at 12, 12 size 180, 36\n`;
  const ast = parse(source);
  const manifest = buildWindowNumberEditManifest(source, ast);
  assert.deepEqual(collectWindowNumberEditInputIds(source, ast), ['top_value', 'tab_value', 'panel_value']);
  assert.deepEqual(manifest.controls.map(control => control.id), ['top_value', 'tab_value', 'panel_value']);
  assert.equal(validateWindowNumberEditManifest(manifest), manifest);
});

test('NumberEdit metadata rejects wrong controls, malformed directives and conflicting Input presentations', () => {
  const wrongControl = `window "Bad" as main:\n  # @number-edit\n  button "No" as no\n`;
  assert.throws(
    () => buildWindowNumberEditManifest(wrongControl, parse(wrongControl)),
    /belongs only to Input controls/
  );

  const malformed = `window "Bad" as main:\n  # @number-edit 1\n  input quantity\n`;
  assert.throws(
    () => buildWindowNumberEditManifest(malformed, parse(malformed)),
    /Invalid # @number-edit directive/
  );

  const password = `window "Bad" as main:\n  # @input-mode password\n  # @number-edit\n  input quantity\n`;
  assert.throws(
    () => compile(password, { kind: 'window' }),
    /cannot combine NumberEdit and PasswordEdit/
  );

  const masked = `window "Bad" as main:\n  # @input-mask "000"\n  # @number-edit\n  input quantity\n`;
  assert.throws(
    () => compile(masked, { kind: 'window' }),
    /cannot combine NumberEdit and MaskedEdit/
  );
});

test('compiler activates NumberEdit without changing Change IR 0.10', () => {
  const source = `create text quantity = "12"\nwindow "Quantity" as main size 420, 220:\n  # @number-edit\n  input quantity at 24, 24 size 180, 36\n`;
  const compiled = compile(source, { name: 'Quantity', kind: 'window', entry: 'main.patch' });
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(input.control, 'input');
  assert.equal(input.numberEdit, true);
  assert.equal(compiled.windowNumberEdit.controls.length, 1);
  assert.equal(compiled.windowNumberEdit.controls[0].id, 'quantity');
  assert.equal(compiled.ir.version, '0.10');
  const lowered = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.code === 'UI_CONTROL');
  assert.equal(lowered.control, 'input');
  assert.equal(Object.prototype.hasOwnProperty.call(lowered, 'numberEdit'), false);
});

test('Standalone Window Web renders NumberEdit as a numeric spinner but keeps changed(value) text-based', () => {
  const source = `create text quantity = "12"\nwindow "Quantity" as main size 420, 220:\n  # @number-edit\n  input quantity at 24, 24 size 180, 36\n\nwhen quantity changed:\n  change quantity:\n    set = value\n`;
  const built = buildStandaloneWebApp(source, { name: 'Quantity', kind: 'window' });
  assert.equal(built.metadata.numberEditStage, 1);
  assert.equal(built.metadata.numberEditVersion, '0.1');
  assert.equal(built.metadata.numberEditMode, 'source-backed-number-input');
  assert.equal(built.metadata.numberEditEventValue, 'text');
  assert.match(built.html, /numberEdit:node\.control==='input'&&node\.numberEdit===true/);
  assert.match(built.html, /el\.type='number'/);
  assert.match(built.html, /el\.step='any'/);
  assert.match(built.html, /el\.inputMode='decimal'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:el\.value\}\)/);
});

test('Current Ready native fails closed for NumberEdit while plain Input remains native-compatible', () => {
  const numberSource = `create text quantity = "12"\nwindow "Quantity" as main size 420, 220:\n  # @number-edit\n  input quantity at 24, 24 size 180, 36\n`;
  const compiled = compile(numberSource, { name: 'Quantity', kind: 'window' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /NumberEdit Stage 1.*Studio\/Web only.*Current Ready native 1\.10.*numeric-input presentation contract/i
  );

  const plain = compile(`create text quantity = "12"\nwindow "Quantity" as main:\n  input quantity\n`, { name: 'Plain', kind: 'window' });
  assert.doesNotThrow(() => buildCurrentNativeGuiIR(plain));
});

test('Patch Studio exposes a NumberEdit preset and Inspector mode', () => {
  const source = fs.readFileSync('src/window-input-presentation.js', 'utf8');
  assert.match(source, /id = 'addNumberEdit'/);
  assert.match(source, /textContent = '\+ Number'/);
  assert.match(source, /option value="number">Number<\/option>/);
  assert.match(source, /input\.type = numberEdit \? 'number'/);
  assert.match(source, /input\.step = 'any'/);
  assert.match(source, /input\.inputMode = 'decimal'/);
  assert.match(source, /changed\(value\) stays text-based/);
});
