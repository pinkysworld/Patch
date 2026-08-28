import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import { reorderDesignerControl, snapDesignerGrid } from '../web/designer-z-order-model.js';

const source = `window "Stack" as main size 640, 420:
  # @layout anchor left top
  button "Back" as back_btn at 24, 24 size 120, 36
  text "Title" at 24, 72 size 200, 28
  button "Front" as front_btn at 24, 120 size 120, 36
`;

test('Bring to front and Send to back reorder complete source-backed control blocks', () => {
  const first = listDesignerControls(source)[0];
  const front = reorderDesignerControl(source, first, 'front');
  assert.equal(front.moved, true);
  assert.doesNotThrow(() => parse(front.source));
  const afterFront = listDesignerControls(front.source).map(item => item.id ?? item.type);
  assert.deepEqual(afterFront, ['text', 'front_btn', 'back_btn']);
  assert.match(front.source, /# @layout anchor left top\n  button "Back" as back_btn/);

  const last = listDesignerControls(front.source).at(-1);
  const back = reorderDesignerControl(front.source, last, 'back');
  assert.deepEqual(listDesignerControls(back.source).map(item => item.id ?? item.type), ['back_btn', 'text', 'front_btn']);
});

test('Move forward and Move backward perform one deterministic z-order step', () => {
  const controls = listDesignerControls(source);
  const forward = reorderDesignerControl(source, controls[0], 'forward');
  assert.equal(forward.moved, true);
  assert.deepEqual(listDesignerControls(forward.source).map(item => item.id ?? item.type), ['text', 'back_btn', 'front_btn']);

  const movedBackButton = listDesignerControls(forward.source)[1];
  const backward = reorderDesignerControl(forward.source, movedBackButton, 'backward');
  assert.equal(backward.moved, true);
  assert.equal(backward.source, source);
});

test('z-order no-ops at the already-front or already-back edge', () => {
  const controls = listDesignerControls(source);
  const unchangedFront = reorderDesignerControl(source, controls[2], 'front');
  const unchangedBack = reorderDesignerControl(source, controls[0], 'back');
  const unchangedForward = reorderDesignerControl(source, controls[2], 'forward');
  const unchangedBackward = reorderDesignerControl(source, controls[0], 'backward');
  assert.equal(unchangedFront.moved, false);
  assert.equal(unchangedBack.moved, false);
  assert.equal(unchangedForward.moved, false);
  assert.equal(unchangedBackward.moved, false);
});

test('grid snap and complete z-order controls ship in the public Studio', () => {
  assert.equal(snapDesignerGrid(13, 8), 16);
  assert.equal(snapDesignerGrid(10, 8), 8);
  execFileSync(process.execPath, ['--check', 'web/designer-z-order-model.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-layout-actions.js'], { stdio: 'pipe' });
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  const layout = fs.readFileSync('web/designer-layout-actions.js', 'utf8');
  assert.match(build, /designer-z-order-model\.js/);
  assert.match(sw, /'\.\/designer-z-order-model\.js'/);
  assert.match(layout, /patchBringControlFront/);
  assert.match(layout, /patchMoveControlForward/);
  assert.match(layout, /patchMoveControlBackward/);
  assert.match(layout, /patchSendControlBack/);
  assert.match(layout, /applyLayoutAction\('forward'\)/);
  assert.match(layout, /applyLayoutAction\('backward'\)/);
  assert.match(layout, /let message;\s*if \(\['front', 'back', 'forward', 'backward'\]/s);
  assert.match(layout, /reorderDesignerControl/);
});
