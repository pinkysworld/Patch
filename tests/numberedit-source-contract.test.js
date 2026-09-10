import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
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

test('NumberEdit source contract is versioned and dormant', () => {
  assert.equal(PATCH_NUMBEREDIT_VERSION, '0.1');
  assert.equal(PATCH_NUMBEREDIT_FORMAT, 'patch-numberedit-presentation');
  assert.equal(PATCH_NUMBEREDIT_DIRECTIVE, 'number-edit');

  const compiler = fs.readFileSync('src/compiler.js', 'utf8');
  assert.equal(compiler.includes("./numberedit.js"), false);
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

test('NumberEdit metadata rejects wrong controls and malformed directives', () => {
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
});

test('dormant NumberEdit metadata cannot silently change current target behavior', () => {
  const source = `create text quantity = "12"\nwindow "Quantity" as main size 420, 220:\n  # @number-edit\n  input quantity at 24, 24 size 180, 36\n`;
  const compiled = compile(source, { name: 'Quantity', kind: 'window', entry: 'main.patch' });
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(input.control, 'input');
  assert.equal(Object.prototype.hasOwnProperty.call(input, 'numberEdit'), false);
  assert.equal(compiled.ir.version, '0.10');
});
