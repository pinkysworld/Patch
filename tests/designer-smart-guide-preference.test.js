import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('web/designer-alignment-guides.js', 'utf8');

test('Designer exposes a local-only Smart Guides toggle', () => {
  assert.match(source, /toggleSmartGuides/);
  assert.match(source, /Smart Guides · On/);
  assert.match(source, /Smart Guides · Off/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /patch-studio-smart-guides-v1/);
  assert.match(source, /localStorage\.getItem\(SMART_GUIDES_STORAGE_KEY\)/);
  assert.match(source, /localStorage\.setItem\(SMART_GUIDES_STORAGE_KEY/);
});

test('Smart Guides preference remains design-only and Alt stays a temporary bypass', () => {
  assert.match(source, /if \(!smartGuidesEnabled\) return;/);
  assert.match(source, /!smartGuidesEnabled \|\| moveEvent\.altKey/);
  assert.doesNotMatch(source, /code\.value\s*=/);
  assert.doesNotMatch(source, /dispatchEvent\(new Event\(['"](?:input|change)/);
});
