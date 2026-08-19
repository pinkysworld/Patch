import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { updateDesignerWindow } from '../src/designer.js';
import { suggestDesignerFormSize } from '../web/form-designer-workflow.js';

test('Fit controls derives a bounded Form size from source-backed control geometry', () => {
  assert.deepEqual(suggestDesignerFormSize([]), { width: 640, height: 420 });
  assert.deepEqual(suggestDesignerFormSize([
    { type: 'button', controlIndex: 0, x: 24, y: 30, width: 120, height: 36 },
    { type: 'input', controlIndex: 1, x: 260, y: 180, width: 220, height: 36 }
  ]), { width: 504, height: 240 });
});

test('Fit controls uses normal control defaults when explicit geometry is absent', () => {
  const result = suggestDesignerFormSize([
    { type: 'text', controlIndex: 0 },
    { type: 'button', controlIndex: 3 }
  ]);
  assert.ok(result.width >= 320);
  assert.ok(result.height >= 240);
  assert.ok(Number.isInteger(result.width));
  assert.ok(Number.isInteger(result.height));
});

test('suggested Form size remains ordinary parseable Patch source when applied', () => {
  const source = `window "Main" as main size 900, 700:\n  button "Save" as save at 420, 260 size 140, 40`;
  const size = suggestDesignerFormSize([{ type: 'button', controlIndex: 0, x: 420, y: 260, width: 140, height: 40 }]);
  const next = updateDesignerWindow(source, 0, size);
  assert.doesNotThrow(() => parse(next));
  assert.match(next, /size 584, 324:/);
});

test('Form workflow supports active-Form navigation and title activation without hidden app state', () => {
  const source = fs.readFileSync('web/form-designer-workflow.js', 'utf8');
  assert.match(source, /patchPreviousForm/);
  assert.match(source, /patchNextForm/);
  assert.match(source, /Alt\+PageUp/);
  assert.match(source, /Alt\+PageDown/);
  assert.match(source, /patch-window-title/);
  assert.match(source, /designer-active-form/);
  assert.match(source, /updateDesignerWindow\(code\.value, windowIndex, size\)/);
  assert.match(source, /dispatchEvent\(new Event\('change'/);
});

test('public Studio and PWA package active Form workflow JS and CSS', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/form-designer-workflow\.js'/);
  assert.match(buildSite, /'form-designer-workflow\.js'/);
  assert.match(buildSite, /'form-designer-workflow\.css'/);
  assert.match(sw, /'\.\/form-designer-workflow\.js'/);
  assert.match(sw, /'\.\/form-designer-workflow\.css'/);
});
