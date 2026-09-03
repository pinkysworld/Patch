import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const core = fs.readFileSync('web/designer-core-selection.js', 'utf8');

test('public Studio packages every Designer clipboard module imported by the shared command path', () => {
  assert.match(core, /from '\.\/designer-control-clipboard-model\.js'/);
  assert.match(core, /from '\.\/designer-control-clipboard-guard\.js'/);
  assert.match(buildSite, /'designer-control-clipboard-model\.js'/);
  assert.match(buildSite, /'designer-control-clipboard-guard\.js'/);
});

test('clipboard packaging stays inside the explicit fail-closed browser module allowlist', () => {
  assert.match(buildSite, /const SITE_WEB_MODULE_FILES = \[/);
  assert.match(buildSite, /validateGeneratedModuleClosure\(\)/);
  assert.match(buildSite, /validateGeneratedModuleRevisions\(\)/);
  assert.doesNotMatch(buildSite, /readdirSync\(sourceWeb/);
});
