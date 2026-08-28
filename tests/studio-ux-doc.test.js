import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync('docs/STUDIO_UX.md', 'utf8');

test('Studio UX notes retain the source-backed workspace and visible-scrollbar goals', () => {
  assert.match(doc, /single project source of truth/i);
  assert.match(doc, /visible scroll/i);
  assert.match(doc, /overlay scrollbars/i);
  assert.match(doc, /small, predictable controls/i);
  assert.match(doc, /workspace is first|visually dominant/i);
  assert.match(doc, /Ln · Col/i);
  assert.match(doc, /status bar stays visible/i);
  assert.match(doc, /Editor tabs/i);
  assert.match(doc, /project bundle v4/i);
});
