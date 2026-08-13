import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { listDesignerControls, updateDesignerControl } from '../src/designer.js';

const moduleSource = fs.readFileSync('web/designer-multiselect.js', 'utf8');
const css = fs.readFileSync('web/designer-multiselect.css', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Designer multi-select module is syntax-valid and ordered after snapping before keyboard commits', () => {
  execFileSync(process.execPath, ['--check', 'web/designer-multiselect.js'], { stdio: 'pipe' });
  assert.match(html, /designer-alignment-guides\.js[\s\S]*designer-multiselect\.js[\s\S]*form-window-resize\.js/);
  assert.match(html, /designer-multiselect\.css/);
  assert.match(sw, /\.\/designer-multiselect\.js/);
  assert.match(sw, /\.\/designer-multiselect\.css/);
});

test('Designer multi-select supports additive pointer and keyboard selection without hidden Patch state', () => {
  for (const marker of [
    'event.metaKey || event.ctrlKey || event.shiftKey',
    "event.key === 'Enter' || event.key === ' '",
    'event.stopImmediatePropagation()',
    'designer-multi-selected',
    'selectionKeys = new Set()'
  ]) assert.ok(moduleSource.includes(marker), marker);
  assert.doesNotMatch(moduleSource, /localStorage|sessionStorage/);
  assert.doesNotMatch(moduleSource, /aria-selected/);
});

test('group movement and alignment remain source-backed', () => {
  for (const marker of [
    "window.addEventListener('patch:control-moved'",
    "window.addEventListener('pointermove'",
    'updateDesignerControl',
    'growFormForControl',
    "alignSelection('left')",
    "alignSelection('top')",
    "alignSelection('hcenter')",
    "alignSelection('vcenter')"
  ]) assert.ok(moduleSource.includes(marker), marker);

  let source = 'window "Main" as main size 640, 420:\n  button "One" as one at 24, 24 size 120, 36\n  button "Two" as two at 180, 80 size 120, 36\n';
  source = updateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, { x: 64, y: 54 });
  source = updateDesignerControl(source, { windowIndex: 0, controlIndex: 1 }, { x: 220, y: 110 });
  const controls = listDesignerControls(source);
  assert.deepEqual(controls.map(control => [control.x, control.y]), [[64, 54], [220, 110]]);
});

test('multi-select presentation distinguishes primary and secondary controls and disables unavailable commands', () => {
  assert.match(css, /designer-multi-selected:not\(\.designer-selected\)/);
  assert.match(css, /outline-style: dashed/);
  assert.match(css, /designer-multiselect-tools/);
  assert.match(css, /button:disabled/);
  assert.match(moduleSource, /button\.disabled = displayCount < 2/);
});
