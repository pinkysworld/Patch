import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync('docs/STUDIO_UX.md', 'utf8');

test('Studio UX notes retain the source-backed and visible-scrollbar goals', () => {
  assert.match(doc, /source as the single source of truth/i);
  assert.match(doc, /visible scroll/i);
  assert.match(doc, /macOS browsers/i);
  assert.match(doc, /compact icon buttons/i);
  assert.match(doc, /workspace-first|visually dominant/i);
  assert.match(doc, /Ln · Col/i);
  assert.match(doc, /status bar stays visible/i);
  assert.match(doc, /Editor tabs/i);
});
