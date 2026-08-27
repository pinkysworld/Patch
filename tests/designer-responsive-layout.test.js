import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import {
  applyDesignerResizePolicy,
  designerLayoutPresetValue,
  parseDesignerLayoutPreset,
  readDesignerLayoutPolicy,
  setDesignerLayoutPolicy
} from '../web/designer-layout-policy.js';
import { designerLayoutInspectorModel } from '../web/designer-responsive-layout.js';

const browserModule = fs.readFileSync('web/designer-responsive-layout.js', 'utf8');
const layoutCss = fs.readFileSync('web/designer-responsive-layout.css', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Designer layout directives remain ordinary parser-transparent Patch comments', () => {
  const source = 'window "Main" as main size 640, 420:\n  # @layout anchor left right top\n  button "Save" as save at 24, 24 size 120, 36\n';
  const ast = parse(source);
  assert.equal(ast[0].kind, 'window');
  assert.equal(ast[0].body[0].kind, 'uiControl');
  assert.deepEqual(readDesignerLayoutPolicy(source, ast[0].body[0].line), { kind: 'anchor', edges: ['left', 'right', 'top'] });
});

test('source-backed policy editor inserts replaces and removes the canonical adjacent directive', () => {
  const base = 'window "Main" as main size 640, 420:\n  button "Save" as save at 24, 24 size 120, 36\n';
  let next = setDesignerLayoutPolicy(base, 2, { kind: 'dock', side: 'bottom' });
  assert.match(next, /  # @layout dock bottom\n  button "Save"/);
  const controlLine = parse(next)[0].body[0].line;
  next = setDesignerLayoutPolicy(next, controlLine, { kind: 'anchor', edges: ['bottom', 'right'] });
  assert.match(next, /  # @layout anchor right bottom\n  button "Save"/);
  next = setDesignerLayoutPolicy(next, parse(next)[0].body[0].line, { kind: 'fixed' });
  assert.equal(next, base);
});

test('Panel uses the same source-backed Anchors and Dock contract as ordinary top-level controls', () => {
  const base = `window "Main" as main size 640, 420:\n  panel as tools at 24, 24 size 280, 160:\n    text "Tools"\n`;
  let next = setDesignerLayoutPolicy(base, parse(base)[0].body[0].line, { kind: 'anchor', edges: ['left', 'right', 'top'] });
  assert.match(next, /# @layout anchor left right top\n  panel as tools/);
  assert.deepEqual(readDesignerLayoutPolicy(next, parse(next)[0].body[0].line), { kind: 'anchor', edges: ['left', 'right', 'top'] });
  next = setDesignerLayoutPolicy(next, parse(next)[0].body[0].line, { kind: 'dock', side: 'fill' });
  assert.match(next, /# @layout dock fill\n  panel as tools/);
  assert.doesNotThrow(() => parse(next));
});

test('anchor resize policies preserve margins or stretch dimensions predictably', () => {
  const layout = { x: 100, y: 60, width: 200, height: 40 };
  assert.deepEqual(
    applyDesignerResizePolicy(layout, { kind: 'anchor', edges: ['right', 'bottom'] }, { deltaWidth: 80, deltaHeight: 50, width: 720, height: 470 }),
    { x: 180, y: 110, width: 200, height: 40 }
  );
  assert.deepEqual(
    applyDesignerResizePolicy(layout, { kind: 'anchor', edges: ['left', 'right', 'top', 'bottom'] }, { deltaWidth: 80, deltaHeight: 50, width: 720, height: 470 }),
    { x: 100, y: 60, width: 280, height: 90 }
  );
});

test('dock policies calculate edge and fill geometry from the resized Form', () => {
  const layout = { x: 100, y: 60, width: 200, height: 40 };
  assert.deepEqual(
    applyDesignerResizePolicy(layout, { kind: 'dock', side: 'bottom' }, { width: 720, height: 470 }),
    { x: 0, y: 430, width: 720, height: 40 }
  );
  assert.deepEqual(
    applyDesignerResizePolicy(layout, { kind: 'dock', side: 'fill' }, { width: 720, height: 470 }),
    { x: 0, y: 0, width: 720, height: 470 }
  );
});

test('Designer preset values round-trip canonical policies', () => {
  for (const value of ['fixed', 'anchor:right+bottom', 'anchor:left+right+top+bottom', 'dock:fill', 'dock:left']) {
    assert.equal(designerLayoutPresetValue(parseDesignerLayoutPreset(value)), value);
  }
});

test('Object Inspector exposes Delphi-style Layout Mode, four Anchors, Dock and presets', () => {
  for (const marker of [
    'PATCH_DESIGNER_LAYOUT_INSPECTOR_VERSION',
    'designerInspectorLayoutSection',
    'designerInspectorLayoutMode',
    'designerInspectorAnchorFields',
    'data-layout-anchor="top"',
    'data-layout-anchor="left"',
    'data-layout-anchor="right"',
    'data-layout-anchor="bottom"',
    'designerInspectorDockSide',
    'anchor:left+right+top',
    'anchor:left+right+top+bottom',
    'dock:fill',
    'source-backed'
  ]) assert.ok(browserModule.includes(marker), marker);
  assert.match(layoutCss, /designer-layout-inspector/);
  assert.match(layoutCss, /designer-anchor-box/);
  assert.match(layoutCss, /anchor-center/);
});

test('Object Inspector preserves shared nonvisual boundaries for Timer and ImageList plus docked StatusBar', () => {
  assert.equal(designerLayoutInspectorModel({ kind: 'fixed' }, 'timer').visible, false);
  assert.equal(designerLayoutInspectorModel({ kind: 'fixed' }, 'imagelist').visible, false);
  assert.deepEqual(designerLayoutInspectorModel({ kind: 'anchor', edges: ['right'] }, 'imagelist'), {
    visible: false,
    locked: true,
    mode: 'fixed',
    anchors: { left: false, right: false, top: false, bottom: false },
    dock: 'top',
    source: 'Nonvisual component'
  });
  assert.match(browserModule, /isNonvisualFormControl/);
  assert.match(browserModule, /type === 'statusbar'/);
  assert.match(browserModule, /kind: 'dock', side: 'bottom'/);
  assert.match(browserModule, /Nonvisual components have no Form resize policy/);
  assert.match(browserModule, /StatusBar remains docked to the bottom/);
});

test('responsive Designer module is syntax-valid source-backed and loaded before Form resize handling', () => {
  execFileSync(process.execPath, ['--check', 'web/designer-layout-policy.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-responsive-layout.js'], { stdio: 'pipe' });
  assert.match(html, /designer-multiselect\.js[\s\S]*designer-responsive-layout\.js[\s\S]*form-window-resize\.js/);
  assert.match(html, /designer-responsive-layout\.css/);
  assert.match(sw, /\.\/designer-layout-policy\.js/);
  assert.match(sw, /\.\/designer-responsive-layout\.js/);
  assert.match(sw, /\.\/designer-responsive-layout\.css/);
  assert.match(browserModule, /patch:form-resized/);
  assert.match(browserModule, /updateDesignerControl/);
  assert.match(browserModule, /setDesignerLayoutPolicy/);
  assert.doesNotMatch(browserModule, /localStorage|sessionStorage/);
});
