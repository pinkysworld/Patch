import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { formControlDefaultLayout } from '../src/form-layout.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { studioProjectFileStem } from '../src/studio-project.js';

test('Studio artifact names are safe, deterministic and never empty', () => {
  assert.equal(studioProjectFileStem('  My App  '), 'My_App');
  assert.equal(studioProjectFileStem('***'), 'PatchApp');
  assert.equal(studioProjectFileStem('___'), 'PatchApp');
  assert.equal(studioProjectFileStem('A  B///C'), 'A_B_C');
  assert.equal(studioProjectFileStem('x'.repeat(100)).length, 64);
});

test('Studio build and project export share one artifact-name normalizer', () => {
  const playground = fs.readFileSync('web/playground.js', 'utf8');
  const lifecycle = fs.readFileSync('web/project-lifecycle.js', 'utf8');
  assert.match(playground, /studioProjectFileStem/);
  assert.match(lifecycle, /studioProjectFileStem/);
  assert.doesNotMatch(playground, /function safeName\s*\(/);
  assert.doesNotMatch(lifecycle, /function safeFileName\s*\(/);
});

test('Change Contract refresh is truly debounced while typing', () => {
  const playground = fs.readFileSync('web/playground.js', 'utf8');
  assert.match(playground, /let changeContractTimer = null/);
  assert.match(playground, /clearTimeout\(changeContractTimer\)/);
  assert.match(playground, /changeContractTimer = setTimeout\(refreshChangeContract, 220\)/);
});

test('Native GUI top-level fallback geometry comes from shared Form defaults', () => {
  const source = `window "Demo":\n  text "Hello"\n  button "Go" as go\n\nwhen go clicked:\n  dialog "Done", "OK"\n`;
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'Demo' }));
  assert.deepEqual(ir.forms[0].controls[0].layout, formControlDefaultLayout('text', 0));
  assert.deepEqual(ir.forms[0].controls[1].layout, formControlDefaultLayout('button', 1));
});

test('Native GUI Tabs page fallback geometry also uses shared Form defaults', () => {
  const source = `window "Demo":\n  tabs as sections:\n    tab "One":\n      text "Hello"\n    tab "Two":\n      button "Go" as go\n\nwhen go clicked:\n  dialog "Done", "OK"\n`;
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'Demo' }));
  const tabs = ir.forms[0].controls[0];
  assert.deepEqual(tabs.layout, formControlDefaultLayout('tabs', 0));
  assert.deepEqual(tabs.pages[0].controls[0].layout, formControlDefaultLayout('text', 0, { x: 12, yStart: 12, yStep: 48 }));
  assert.deepEqual(tabs.pages[1].controls[0].layout, formControlDefaultLayout('button', 0, { x: 12, yStart: 12, yStep: 48 }));
});

test('Native GUI no longer owns a second copied control-size table', () => {
  const nativeGui = fs.readFileSync('src/native-gui-ir.js', 'utf8');
  assert.match(nativeGui, /buildFormLayoutManifest, formControlDefaultLayout/);
  assert.match(nativeGui, /return formControlDefaultLayout\(type, index\);/);
  assert.match(nativeGui, /return formControlDefaultLayout\(type, index, \{ x: 12, yStart: 12, yStep: 48 \}\);/);
  assert.doesNotMatch(nativeGui, /const sizes = \{/);
});
