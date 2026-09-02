import test from 'node:test';
import assert from 'node:assert/strict';
import { listDesignerControls, removeDesignerControl } from '../src/designer.js';

test('removing a control removes its complete Designer metadata block and preserves the neighbor block', () => {
  const source = `window "Demo" as main size 640, 420:\n  # @layout anchor left top\n  # @taborder 0\n  # @locked\n  button "Delete me" as doomed at 24, 24 size 120, 36\n  # @layout anchor right top\n  # @taborder 1\n  button "Keep me" as keep at 180, 24 size 120, 36\n`;
  const doomed = listDesignerControls(source).find(control => control.id === 'doomed');
  const next = removeDesignerControl(source, doomed);

  assert.doesNotMatch(next, /Delete me|\bdoomed\b|@locked|@taborder 0|anchor left top/);
  assert.match(next, /# @layout anchor right top\n  # @taborder 1\n  button "Keep me" as keep/);
});

test('removing a block control also removes stacked Designer metadata before the whole block', () => {
  const source = `window "Demo" as main size 640, 420:\n  # @layout anchor left right top bottom\n  # @taborder 2\n  # @locked\n  panel as details at 24, 24 size 320, 180:\n    text "Inside"\n    button "Action" as action\n  # @taborder 0\n  input search at 24, 230 size 220, 36\n\nwhen action clicked:\n  show "clicked"\n`;
  const panel = listDesignerControls(source).find(control => control.id === 'details');
  const next = removeDesignerControl(source, panel);

  assert.doesNotMatch(next, /panel as details|Inside|button "Action" as action|when action clicked|@locked|@taborder 2|anchor left right top bottom/);
  assert.match(next, /# @taborder 0\n  input search/);
});
