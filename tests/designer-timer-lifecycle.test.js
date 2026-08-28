import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import {
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import { buildFormLayoutManifest, isNonvisualFormControl } from '../src/form-layout.js';
import {
  DESIGNER_TOOL_CATALOG,
  addDesignerTimer,
  filterDesignerTools,
  stripDesignerTimerLayout
} from '../web/designer-toolbox.js';

test('Designer event lifecycle includes Timer ticked handlers', () => {
  const source = fs.readFileSync('src/designer.js', 'utf8');
  const matches = source.match(/clicked\|changed\|closed\|ticked/g) ?? [];
  assert.equal(matches.length, 2, 'rename and removal helpers must both recognize ticked');
});

test('Timer is a first-class nonvisual Component Palette entry', () => {
  const timer = DESIGNER_TOOL_CATALOG.find(tool => tool.type === 'timer');
  assert.deepEqual(timer, { group: 'Nonvisual', type: 'timer', buttonId: 'addTimer', label: 'Timer' });
  assert.deepEqual(filterDesignerTools('nonvisual').map(tool => tool.type), ['timer', 'imagelist']);
  assert.equal(isNonvisualFormControl('timer'), true);
  assert.equal(isNonvisualFormControl('imagelist'), true);
  assert.equal(isNonvisualFormControl('button'), false);
});

test('adding a Timer creates source without canvas geometry or Form growth', () => {
  const source = `window "Timers" as main size 420, 120:\n  text "Visible" at 24, 24 size 180, 28\n`;
  const added = addDesignerTimer(source, { windowIndex: 0 });
  assert.match(added.source, /timer as timer_1 interval 1000/);
  assert.doesNotMatch(added.source, /timer as timer_1 interval 1000 at /);
  assert.match(added.source, /window "Timers" as main size 420, 120:/);
  assert.equal(added.timer.type, 'timer');
  assert.equal(added.timer.interval, 1000);
  assert.equal(added.timer.x, null);
  assert.equal(added.timer.y, null);
});

test('Timer interval and id remain ordinary source-backed Designer properties', () => {
  const source = `window "Timers" as main size 420, 240:\n  timer as clock interval 1000\n\nwhen clock ticked:\n  show "tick"\n`;
  const next = updateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, { id: 'heartbeat', interval: 250 });
  assert.match(next, /timer as heartbeat interval 250/);
  assert.match(next, /when heartbeat ticked:/);
  assert.throws(
    () => updateDesignerControl(next, { windowIndex: 0, controlIndex: 0 }, { interval: 0 }),
    /1 to 3600000 milliseconds/
  );
});

test('Timer does not shift visible fallback geometry in the shared Form manifest', () => {
  const source = `window "Timers" as main size 420, 240:\n  button "First" as first\n  timer as clock interval 1000\n  input name\n`;
  const manifest = buildFormLayoutManifest(parse(source));
  assert.equal(manifest.windows.length, 1);
  assert.equal(manifest.windows[0].controls.length, 3);
  assert.deepEqual(manifest.windows[0].controls[0], { x: 24, y: 24, width: 120, height: 36 });
  assert.equal(manifest.windows[0].controls[1], null);
  assert.deepEqual(manifest.windows[0].controls[2], { x: 24, y: 72, width: 220, height: 36 });
  const layoutSource = fs.readFileSync('src/form-layout.js', 'utf8');
  assert.match(layoutSource, /let visualIndex = 0/);
  assert.match(layoutSource, /const el = elements\[visualIndex\]/);
});

test('Timer layout stripping is line-scoped and leaves visible controls untouched', () => {
  const source = `window "Timers":\n  button "Keep" as keep at 24, 24 size 120, 36\n  timer as clock interval 1000 at 24, 72 size 160, 36\n`;
  const next = stripDesignerTimerLayout(source, 3);
  assert.match(next, /button "Keep" as keep at 24, 24 size 120, 36/);
  assert.match(next, /timer as clock interval 1000\n/);
  assert.doesNotMatch(next, /timer as clock interval 1000 at /);
});

test('removing a source-backed Timer also removes its ticked handler', () => {
  const source = `window "Timers" as main size 420, 240:\n  timer as clock interval 1000\n  text "Still here" at 24, 80 size 180, 28\n\nwhen clock ticked:\n  show "tick"\n`;
  const next = removeDesignerControl(source, { windowIndex: 0, controlIndex: 0 });
  assert.doesNotMatch(next, /timer as clock/);
  assert.doesNotMatch(next, /when clock ticked:/);
  assert.match(next, /text "Still here"/);
});

test('Timer tray and Object Inspector property are packaged in the existing toolbox surface', () => {
  const js = fs.readFileSync('web/designer-toolbox.js', 'utf8');
  const css = fs.readFileSync('web/designer-toolbox.css', 'utf8');
  assert.match(js, /designerNonvisualTray/);
  assert.match(js, /designerInspectorTimerInterval/);
  assert.match(js, /Events → OnTick/);
  assert.match(css, /\.designer-nonvisual-tray/);
  assert.match(css, /#designer #addTimer/);
});
