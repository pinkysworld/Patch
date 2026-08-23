import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync('web/studio-bootstrap.js', 'utf8');
const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');

for (const [name, source] of [
  ['bootstrap', bootstrap],
  ['accessibility refresh', accessibility]
]) {
  test(`${name} keeps the service-worker reload guard for the current site revision`, () => {
    assert.match(source, /const reloadGuardValue = siteRevision \|\| 'unversioned';/);
    assert.match(source, /sessionStorage\.getItem\(reloadGuardKey\) === reloadGuardValue/);
    assert.match(source, /sessionStorage\.setItem\(reloadGuardKey, reloadGuardValue\)/);
    assert.doesNotMatch(source, /sessionStorage\.removeItem\(reloadGuardKey\)/);
  });
}

test('revision changes can still request one recovery reload', () => {
  assert.match(bootstrap, /const siteRevision = scriptUrl\?\.searchParams\.get\('v'\) \|\| '';/);
  assert.match(accessibility, /const siteRevision = new URL\(import\.meta\.url\)\.searchParams\.get\('v'\) \|\| '';/);
  assert.match(bootstrap, /window\.location\.reload\(\)/);
  assert.match(accessibility, /window\.location\.reload\(\)/);
});
