import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('web/index.html', 'utf8');
const sync = fs.readFileSync('web/studio-dom-sync.js', 'utf8');
const playground = fs.readFileSync('web/playground.js', 'utf8');

// This regression protects the v2 canonical project store from programmatic Designer/sample edits
// that historically updated only playground.js's legacy patchStudio.project compatibility key.
test('Studio programmatic source and kind mutations are normalized into shared DOM signals', () => {
  assert.match(sync, /const code = document\.querySelector\('#code'\)/);
  assert.match(sync, /const projectKind = document\.querySelector\('#projectKind'\)/);
  assert.match(sync, /queueMicrotask/);
  assert.match(sync, /code\.dispatchEvent\(new Event\('input'/);
  assert.match(sync, /code\.dispatchEvent\(new Event\('change'/);
  assert.match(sync, /projectKind\.dispatchEvent\(new Event\('change'/);
  assert.match(sync, /sourceSignals === beforeSourceSignals/);
  assert.match(sync, /kindSignals === beforeKindSignals/);
});

test('Studio loads the DOM sync bridge after playground and Designer mutation modules', () => {
  const playgroundIndex = html.indexOf('./playground.js');
  const tableIndex = html.indexOf('./table-stage1.js');
  const syncIndex = html.indexOf('./studio-dom-sync.js');
  assert.ok(playgroundIndex > 0);
  assert.ok(tableIndex > playgroundIndex);
  assert.ok(syncIndex > tableIndex);
});

test('legacy playground persistence remains only a compatibility surface behind the canonical sync bridge', () => {
  assert.match(playground, /patchStudio\.project/);
  assert.match(sync, /document\.addEventListener\(type, captureProgrammaticMutation/);
});
