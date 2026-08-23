import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync('web/studio-bootstrap.js', 'utf8');
const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');
const playground = fs.readFileSync('web/playground.js', 'utf8');

test('bootstrap keeps the service-worker reload guard for the current site revision', () => {
  assert.match(bootstrap, /const reloadGuardValue = siteRevision \|\| 'unversioned';/);
  assert.match(bootstrap, /sessionStorage\.getItem\(reloadGuardKey\) === reloadGuardValue/);
  assert.match(bootstrap, /sessionStorage\.setItem\(reloadGuardKey, reloadGuardValue\)/);
  assert.doesNotMatch(bootstrap, /sessionStorage\.removeItem\(reloadGuardKey\)/);
});

test('accessibility and playground do not own worker registration or activation reloads', () => {
  for (const source of [accessibility, playground]) {
    assert.doesNotMatch(source, /serviceWorker\.register/);
    assert.doesNotMatch(source, /controllerchange/);
    assert.doesNotMatch(source, /patch-studio-sw-reload-guard/);
    assert.doesNotMatch(source, /window\.location\.reload\(\)/);
  }
});

test('a new published revision can still request one bootstrap recovery reload', () => {
  assert.match(bootstrap, /const siteRevision = scriptUrl\?\.searchParams\.get\('v'\) \|\| '';/);
  assert.match(bootstrap, /const hadController = Boolean\(navigator\.serviceWorker\.controller\)/);
  assert.match(bootstrap, /let reloadRequested = false/);
  assert.match(bootstrap, /if \(!hadController \|\| reloadedForActivation \|\| reloadRequested\) return/);
  assert.match(bootstrap, /reloadRequested = true/);
  assert.match(bootstrap, /window\.location\.reload\(\)/);
});
