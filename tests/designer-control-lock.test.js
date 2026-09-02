import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { listDesignerControls } from '../src/designer.js';
import {
  readWindowDesignerLock,
  readWindowLayoutPolicy,
  readWindowTabOrder,
  setWindowDesignerLock
} from '../src/window-layout-policy.js';
import { reorderDesignerControl } from '../web/designer-z-order-model.js';

test('Designer lock is source-backed metadata that coexists with layout and TabOrder', () => {
  const source = `window "Demo" as main size 640, 420:\n  # @layout anchor left right top\n  # @taborder 2\n  input name at 24, 24 size 220, 36\n`;
  const control = listDesignerControls(source)[0];
  const locked = setWindowDesignerLock(source, control.line, true);
  const lockedControl = listDesignerControls(locked)[0];
  assert.match(locked, /# @layout anchor left right top\n  # @taborder 2\n  # @locked\n  input name/);
  assert.equal(readWindowDesignerLock(locked, lockedControl.line), true);
  assert.equal(readWindowTabOrder(locked, lockedControl.line), 2);
  assert.deepEqual(readWindowLayoutPolicy(locked, lockedControl.line), { kind: 'anchor', edges: ['left', 'right', 'top'] });

  const unlocked = setWindowDesignerLock(locked, lockedControl.line, false);
  const unlockedControl = listDesignerControls(unlocked)[0];
  assert.doesNotMatch(unlocked, /@locked/);
  assert.equal(readWindowDesignerLock(unlocked, unlockedControl.line), false);
  assert.equal(readWindowTabOrder(unlocked, unlockedControl.line), 2);
  assert.deepEqual(readWindowLayoutPolicy(unlocked, unlockedControl.line), { kind: 'anchor', edges: ['left', 'right', 'top'] });
});

test('Designer lock remains runtime-neutral and is not exported as compiler layout capability', () => {
  const plain = `window "Demo" as main size 640, 420:\n  button "Save" as save at 24, 24 size 120, 36\n`;
  const locked = `window "Demo" as main size 640, 420:\n  # @locked\n  button "Save" as save at 24, 24 size 120, 36\n`;
  const plainCompiled = compile(plain);
  const lockedCompiled = compile(locked);

  assert.equal(lockedCompiled.windowLayoutPolicy.windows[0].controls[0].locked, undefined);
  assert.doesNotMatch(JSON.stringify(lockedCompiled.ir), /@locked|"locked"/i);
  assert.deepEqual(stripSourcePositions(lockedCompiled.ir), stripSourcePositions(plainCompiled.ir));
});

test('z-order moves the complete locked layout and TabOrder metadata block with its control', () => {
  const source = `window "Demo" as main size 640, 420:\n  # @layout anchor left top\n  # @taborder 1\n  # @locked\n  button "Back" as back at 24, 24 size 120, 36\n  # @taborder 0\n  button "Front" as front at 24, 76 size 120, 36\n`;
  const moved = reorderDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, 'front');
  assert.equal(moved.moved, true);
  assert.match(moved.source, /# @taborder 0\n  button "Front" as front[\s\S]*# @layout anchor left top\n  # @taborder 1\n  # @locked\n  button "Back" as back/);
  const back = listDesignerControls(moved.source).find(control => control.id === 'back');
  assert.equal(readWindowDesignerLock(moved.source, back.line), true);
  assert.equal(readWindowTabOrder(moved.source, back.line), 1);
});

test('Lock Controls UI blocks Designer mutation surfaces while leaving normal property editing separate', () => {
  const actions = fs.readFileSync('web/designer-layout-actions.js', 'utf8');
  const css = fs.readFileSync('web/designer-layout-actions.css', 'utf8');
  assert.match(actions, /id="patchToggleControlLock"/);
  assert.match(actions, /Lock control/);
  assert.match(actions, /Unlock control/);
  assert.match(actions, /readWindowDesignerLock/);
  assert.match(actions, /setWindowDesignerLock/);
  assert.match(actions, /window\.addEventListener\('pointerdown', guardLockedPointerMutation, \{ capture: true \}\)/);
  assert.match(actions, /window\.addEventListener\('keydown', guardLockedKeyboardMutation, \{ capture: true \}\)/);
  assert.match(actions, /LOCK_GUARDED_BUTTONS/);
  assert.match(actions, /patchApplyGeometry/);
  assert.match(actions, /patchDistributeVertical/);
  assert.match(actions, /Unlock locked controls before moving or resizing them/);
  assert.doesNotMatch(actions, /designerInspectorApply['"]/);
  assert.match(css, /designer-control-locked/);
  assert.match(css, /patch-form-resize-handle\.is-designer-locked/);
});

function stripSourcePositions(value) {
  if (Array.isArray(value)) return value.map(stripSourcePositions);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (['line', 'sourceLine', 'startLine', 'endLine'].includes(key)) continue;
    result[key] = stripSourcePositions(item);
  }
  return result;
}
