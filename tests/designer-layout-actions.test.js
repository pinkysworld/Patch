import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { listDesignerControls, listDesignerWindows, updateDesignerControl } from '../src/designer.js';
import {
  effectiveDesignerControlLayout,
  centeredDesignerControlPosition,
  defaultDesignerControlSize,
  autoPlaceDesignerControl
} from '../web/designer-layout-actions.js';

test('single-control centering derives deterministic Form-relative source geometry', () => {
  const control = { type: 'button', controlIndex: 0, x: 30, y: 50, width: 120, height: 36 };
  const form = { width: 640, height: 420 };
  assert.deepEqual(centeredDesignerControlPosition(control, form, 'horizontal'), { x: 260, y: 50 });
  assert.deepEqual(centeredDesignerControlPosition(control, form, 'vertical'), { x: 30, y: 192 });
  assert.deepEqual(centeredDesignerControlPosition(control, form, 'both'), { x: 260, y: 192 });
});

test('centering and effective layout use normal source-backed defaults when geometry is absent', () => {
  const control = { type: 'input', controlIndex: 2 };
  assert.deepEqual(effectiveDesignerControlLayout(control), { x: 24, y: 120, width: 220, height: 36 });
  assert.deepEqual(centeredDesignerControlPosition(control, {}, 'horizontal'), { x: 210, y: 120 });
  assert.deepEqual(centeredDesignerControlPosition(control, {}, 'vertical'), { x: 24, y: 192 });
});

test('Default size follows the shared professional control-size table for special controls too', () => {
  assert.deepEqual(defaultDesignerControlSize({ type: 'button' }), { width: 120, height: 36 });
  assert.deepEqual(defaultDesignerControlSize({ type: 'table' }), { width: 400, height: 180 });
  assert.deepEqual(defaultDesignerControlSize({ type: 'tree' }), { width: 300, height: 220 });
  assert.deepEqual(defaultDesignerControlSize({ type: 'tabs' }), { width: 420, height: 240 });
});

test('Auto place finds a non-overlapping standard column position', () => {
  const controls = [
    { type: 'button', windowIndex: 0, controlIndex: 0, x: 24, y: 24, width: 120, height: 36 },
    { type: 'button', windowIndex: 0, controlIndex: 1, x: 24, y: 72, width: 120, height: 36 },
    { type: 'input', windowIndex: 0, controlIndex: 2, x: 300, y: 24, width: 220, height: 36 }
  ];
  assert.deepEqual(autoPlaceDesignerControl(controls[2], controls), { x: 24, y: 120 });
});

test('computed layout actions remain ordinary parseable Patch source edits and preserve action order', () => {
  const source = `window "Main" as main size 640, 420:\n  button "Save" as save at 30, 50 size 180, 50\n`;
  const control = listDesignerControls(source)[0];
  const form = listDesignerWindows(source)[0];

  // Center H acts on the control's current 180px width, then Default size changes only dimensions.
  const centeredCurrentSize = centeredDesignerControlPosition(control, form, 'horizontal');
  const resized = defaultDesignerControlSize(control);
  const centeredThenResized = updateDesignerControl(source, control, { ...centeredCurrentSize, ...resized });
  assert.doesNotThrow(() => parse(centeredThenResized));
  assert.match(centeredThenResized, /button "Save" as save at 230, 50 size 120, 36/);

  // If the user presses Default size first and Center H second, centering uses the new 120px width.
  const resizedOnly = updateDesignerControl(source, control, resized);
  const resizedControl = listDesignerControls(resizedOnly)[0];
  const centeredDefaultSize = centeredDesignerControlPosition(resizedControl, listDesignerWindows(resizedOnly)[0], 'horizontal');
  const resizedThenCentered = updateDesignerControl(resizedOnly, resizedControl, centeredDefaultSize);
  assert.doesNotThrow(() => parse(resizedThenCentered));
  assert.match(resizedThenCentered, /button "Save" as save at 260, 50 size 120, 36/);
});

test('Designer layout action UI delegates only to source-backed Designer mutations', () => {
  const module = fs.readFileSync('web/designer-layout-actions.js', 'utf8');
  const css = fs.readFileSync('web/designer-layout-actions.css', 'utf8');
  assert.match(module, /currentDesignerSelection/);
  assert.match(module, /updateDesignerControl\(code\.value, selection, changes\)/);
  assert.match(module, /updateDesignerWindow\(source, selection\.windowIndex, \{ width, height \}\)/);
  assert.match(module, /patchCenterControlHorizontal/);
  assert.match(module, /patchCenterControlVertical/);
  assert.match(module, /patchDefaultControlSize/);
  assert.match(module, /patchAutoPlaceControl/);
  assert.match(module, /designer-multi-selected/);
  assert.doesNotMatch(module, /localStorage|sessionStorage|Change History/);
  assert.match(css, /designer-control-layout-actions/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test('public Studio, docs and offline PWA package single-control layout actions', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  const docs = fs.readFileSync('web/docs.html', 'utf8');
  const layoutDocs = fs.readFileSync('docs/STUDIO_LAYOUT_ACTIONS.md', 'utf8');
  assert.match(workspace, /import '\.\/designer-layout-actions\.js'/);
  assert.match(buildSite, /designer-layout-actions\.js/);
  assert.match(buildSite, /designer-layout-actions\.css/);
  assert.match(sw, /'\.\/designer-layout-actions\.js'/);
  assert.match(sw, /'\.\/designer-layout-actions\.css'/);
  assert.match(docs, /docs\/STUDIO_LAYOUT_ACTIONS\.md/);
  assert.match(docs, /Bring to front \/ Send to back/);
  assert.match(layoutDocs, /does not change Patch syntax, Change IR \*\*0\.10\*\*/);
  assert.match(layoutDocs, /does not silently combine layout operations/);
});
