import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
const restore = fs.readFileSync('web/project-config-restore.js', 'utf8');

test('ScrollBox browser source and Showcase payload are packaged by the public Studio build', () => {
  assert.match(buildSite, /'panel-scroll\.js'/);
  assert.match(buildSite, /'studio-showcase-project\.js'/);
  assert.match(restore, /from '\.\/studio-showcase-project\.js'/);
});

test('ScrollBox browser source and Showcase payload are precached for offline Studio', () => {
  assert.match(serviceWorker, /'\.\/studio-showcase-project\.js'/);
  assert.match(serviceWorker, /'\.\.\/src\/panel-scroll\.js'/);
});
