import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import {
  addDesignerControl,
  addDesignerWindow,
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl,
  updateDesignerWindow
} from '../src/designer.js';
import {
  PATCH_FORM_CONTROL_DEFAULTS,
  buildFormLayoutManifest,
  formControlDefaultLayout
} from '../src/form-layout.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

test('shared Form defaults cover every source-backed Studio control', () => {
  assert.deepEqual(Object.keys(PATCH_FORM_CONTROL_DEFAULTS), [
    'text', 'button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'table', 'tree', 'tabs'
  ]);
  assert.deepEqual(formControlDefaultLayout('radio', 2), { x: 24, y: 120, width: 220, height: 84 });
  assert.deepEqual(formControlDefaultLayout('table', 1), { x: 24, y: 72, width: 400, height: 180 });
  assert.deepEqual(formControlDefaultLayout('tree', 1), { x: 24, y: 72, width: 300, height: 220 });
  assert.deepEqual(formControlDefaultLayout('tabs', 1), { x: 24, y: 72, width: 420, height: 240 });
});

test('parser keeps optional source-backed form and control geometry', () => {
  const ast = parse(`window "Main" size 640, 420:\n  text "Hello" at 24, 20 size 180, 30\n  button "Save" as save_button at 24, 64 size 120, 36\n`);
  assert.equal(ast.length, 1);
  assert.equal(ast[0].kind, 'window');
  assert.equal(ast[0].width, 640);
  assert.equal(ast[0].height, 420);
  assert.deepEqual(ast[0].body[0].layout, { x: 24, y: 20, width: 180, height: 30 });
  assert.deepEqual(ast[0].body[1].layout, { x: 24, y: 64, width: 120, height: 36 });
});

test('empty forms are valid, auto-named, and can receive controls later', () => {
  let source = addDesignerWindow('', { titleExpr: '"Main Form"', width: 700, height: 460 });
  assert.equal(parse(source)[0].body.length, 0);
  assert.equal(parse(source)[0].id, 'form_1');
  source = addDesignerControl(source, 'button', { windowIndex: 0 });
  assert.match(source, /window "Main Form" as form_1 size 700, 460:/);
  assert.match(source, /button "Button" as button_1 at 24, 24 size 120, 36/);
});

test('designer targets the selected form instead of always form one', () => {
  let source = `window "First" size 500, 300:\n\nwindow "Second" size 600, 400:\n`;
  source = addDesignerControl(source, 'input', { windowIndex: 1 });
  const windows = listDesignerWindows(source);
  const controls = listDesignerControls(source);
  assert.equal(windows.length, 2);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].windowIndex, 1);
  assert.match(source, /window "Second" size 600, 400:\n  input input_1 at 24, 24 size 220, 36/);
});

test('designer rewrites form and control properties directly in Patch source', () => {
  let source = `window "Old" size 500, 300:\n  button "Go" as go_button at 10, 20 size 100, 30\n`;
  source = updateDesignerWindow(source, 0, { titleExpr: '"Dashboard"', width: 720, height: 480 });
  source = updateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, { x: 40, y: 55, width: 140, height: 44 });
  assert.match(source, /window "Dashboard" size 720, 480:/);
  assert.match(source, /button "Go" as go_button at 40, 55 size 140, 44/);
});

test('legacy flow-layout Window syntax remains valid without changing its AST shape', () => {
  const source = `window "Legacy":\n  text "Hello"\n  input name_input\n`;
  const ast = parse(source);
  const controls = listDesignerControls(source);
  assert.equal(Object.hasOwn(ast[0], 'width'), false);
  assert.equal(Object.hasOwn(ast[0], 'height'), false);
  assert.equal(Object.hasOwn(ast[0], 'id'), false);
  assert.equal(Object.hasOwn(ast[0].body[0], 'layout'), false);
  assert.equal(listDesignerWindows(source)[0].width, null);
  assert.equal(listDesignerWindows(source)[0].id, null);
  assert.equal(controls[0].x, null);
  assert.equal(controls[1].width, null);
});

test('a sized or positioned form deterministically places legacy controls too', () => {
  const ast = parse(`window "Mixed" size 500, 300:\n  text "First"\n  button "Go" as go at 200, 80 size 100, 36\n  input name_input\n`);
  const manifest = buildFormLayoutManifest(ast);
  assert.deepEqual(manifest.windows[0].controls, [
    { x: 24, y: 24, width: 200, height: 30 },
    { x: 200, y: 80, width: 100, height: 36 },
    { x: 24, y: 120, width: 220, height: 36 }
  ]);
});

test('a pure legacy flow form stays flow-layout in the exported manifest', () => {
  const manifest = buildFormLayoutManifest(parse(`window "Legacy":\n  text "Hello"\n  input name_input\n`));
  assert.deepEqual(manifest.windows[0].controls, [null, null]);
});

test('Standalone Window Web build embeds source-backed form layout manifest', () => {
  const source = `window "Layout App" size 640, 420:\n  text "Hello" at 24, 20 size 180, 30\n  button "Go" as go_button at 24, 64 size 120, 36\n\nwhen go_button clicked:\n  show 1\n`;
  const built = buildStandaloneWebApp(source, { name: 'LayoutApp', kind: 'window' });
  assert.equal(built.metadata.formLayoutVersion, '0.1');
  assert.match(built.html, /patch-source-backed-form-layout/);
  assert.match(built.html, /data-patch-form-layout/);
  assert.match(built.html, /patchApplyFormLayout/);
  assert.match(built.html, /"width":640/);
  assert.match(built.html, /"x":24,"y":64,"width":120,"height":36/);
});