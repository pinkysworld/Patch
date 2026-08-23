import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync('web/studio-bootstrap.js', 'utf8');
const playground = fs.readFileSync('web/playground.js', 'utf8');

test('bootstrap canonicalizes legacy local worker registrations to the published revision', () => {
  assert.match(bootstrap, /const originalRegister = navigator\.serviceWorker\.register\.bind\(navigator\.serviceWorker\)/);
  assert.match(bootstrap, /Object\.defineProperty\(navigator\.serviceWorker, 'register'/);
  assert.match(bootstrap, /requested\.origin === canonicalWorker\.origin/);
  assert.match(bootstrap, /requested\.pathname === canonicalWorker\.pathname/);
  assert.match(bootstrap, /return originalRegister\(canonicalWorkerUrl/);
  assert.match(bootstrap, /updateViaCache: 'none'/);
  assert.match(bootstrap, /scope: options\?\.scope \?\? '\.\/'/);
});

test('legacy playground registration cannot request an unversioned public worker after bootstrap', () => {
  assert.match(playground, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(bootstrap, /const canonicalWorkerUrl = siteRevision/);
  assert.match(bootstrap, /`\.\/sw\.js\?v=\$\{encodeURIComponent\(siteRevision\)\}`/);
});
