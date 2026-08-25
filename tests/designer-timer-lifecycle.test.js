import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { removeDesignerControl } from '../src/designer.js';

test('Designer event lifecycle includes Timer ticked handlers before visual authoring lands', () => {
  const source = fs.readFileSync('src/designer.js', 'utf8');
  const matches = source.match(/clicked\|changed\|closed\|ticked/g) ?? [];
  assert.equal(matches.length, 2, 'rename and removal helpers must both recognize ticked');
});

test('removing a source-backed Timer also removes its ticked handler', () => {
  const source = `window "Timers" as main size 420, 240:\n  timer as clock interval 1000 at 24, 24 size 180, 36\n  text "Still here" at 24, 80 size 180, 28\n\nwhen clock ticked:\n  show "tick"\n`;
  const next = removeDesignerControl(source, { windowIndex: 0, controlIndex: 0 });
  assert.doesNotMatch(next, /timer as clock/);
  assert.doesNotMatch(next, /when clock ticked:/);
  assert.match(next, /text "Still here"/);
});
