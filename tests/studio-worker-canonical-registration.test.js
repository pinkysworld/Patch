import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync('web/studio-bootstrap.js', 'utf8');
const playground = fs.readFileSync('web/playground.js', 'utf8');
const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');

test('Studio bootstrap is the single service-worker registration owner', () => {
  assert.match(bootstrap, /navigator\.serviceWorker\.register\(`\.\/sw\.js\?v=\$\{encodeURIComponent\(siteRevision\)\}`/);
  assert.match(bootstrap, /scope: '\.\/'/);
  assert.match(bootstrap, /updateViaCache: 'none'/);
  assert.match(bootstrap, /await registration\.update\(\)/);
  assert.doesNotMatch(playground, /serviceWorker\.register/);
  assert.doesNotMatch(accessibility, /serviceWorker\.register/);
});

test('single-owner bootstrap keeps revision-bound activation recovery', () => {
  assert.match(bootstrap, /document\.currentScript\?\.src/);
  assert.match(bootstrap, /searchParams\.get\('v'\)/);
  assert.match(bootstrap, /patch-studio-sw-reload-guard/);
  assert.match(bootstrap, /addEventListener\('controllerchange'/);
  assert.match(bootstrap, /window\.location\.reload\(\)/);
  assert.doesNotMatch(bootstrap, /Object\.defineProperty\(navigator\.serviceWorker, 'register'/);
});
