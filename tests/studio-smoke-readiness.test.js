import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync('web/studio-bootstrap.js', 'utf8');

test('production smoke probes real Run behavior until Studio becomes functional', () => {
  assert.match(bootstrap, /document\.documentElement\.dataset\.patchStudioSmoke = 'pending'/);
  assert.match(bootstrap, /const smokeDeadline = Date\.now\(\) \+ 14000/);
  assert.match(bootstrap, /const probeReadyStudio = \(\) =>/);
  assert.match(bootstrap, /run\.click\(\)/);
  assert.match(bootstrap, /app\.querySelector\('\.patch-window'\)/);
  assert.match(bootstrap, /!app\.hidden && renderedWindow/);
  assert.match(bootstrap, /dataset\.patchStudioSmoke = 'ready'/);
  assert.match(bootstrap, /Date\.now\(\) >= smokeDeadline/);
  assert.match(bootstrap, /dataset\.patchStudioSmoke = 'failed'/);
  assert.match(bootstrap, /window\.setTimeout\(probeReadyStudio, 200\)/);
  assert.match(bootstrap, /window\.setTimeout\(probeReadyStudio, 250\)/);
});

test('production smoke no longer assumes Run listeners exist after one fixed second', () => {
  assert.doesNotMatch(bootstrap, /window\.setTimeout\(\(\) => \{[\s\S]*?run\.click\(\)[\s\S]*?\}, 1000\)/);
  assert.doesNotMatch(bootstrap, /renderedWindow[\s\S]*?\}, 100\)/);
});
