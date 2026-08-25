import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('web/designer-event-inspector.js', 'utf8');

test('Object Inspector reuses parsed controls until visible Patch source changes', () => {
  assert.match(source, /let cachedSource = null/);
  assert.match(source, /let cachedControls = \[\]/);
  assert.match(source, /if \(source === cachedSource\) return cachedControls/);
  assert.match(source, /cachedControls = listDesignerControls\(source\)/);
});

test('Object Inspector coalesces source selection and observer sync into one microtask', () => {
  assert.match(source, /let syncQueued = false/);
  assert.match(source, /function scheduleSync\(\)/);
  assert.match(source, /queueMicrotask\(\(\) => \{/);
  assert.match(source, /addEventListener\(DESIGNER_SELECTION_EVENT, scheduleSync\)/);
  assert.match(source, /code\.addEventListener\('input', scheduleSync\)/);
  assert.match(source, /new MutationObserver\(scheduleSync\)/);
});

test('Object picker avoids replacing option DOM when control identity is unchanged', () => {
  assert.match(source, /let cachedPickerSignature = null/);
  assert.match(source, /if \(signature !== cachedPickerSignature\)/);
  assert.match(source, /select\.replaceChildren\(\)/);
});
