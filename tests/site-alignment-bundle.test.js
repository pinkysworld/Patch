import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('public site build carries Designer alignment modules referenced by Studio and service worker', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });

  for (const file of [
    '_site/designer-alignment.js',
    '_site/designer-alignment-guides.js'
  ]) assert.ok(fs.existsSync(file), `${file} must be present in the deployable site`);

  const html = fs.readFileSync('_site/index.html', 'utf8');
  const sw = fs.readFileSync('_site/sw.js', 'utf8');
  assert.match(html, /\.\/designer-alignment-guides\.js\?v=[a-f0-9]+/);
  assert.match(sw, /\.\/designer-alignment\.js\?v=[a-f0-9]+/);
  assert.match(sw, /\.\/designer-alignment-guides\.js\?v=[a-f0-9]+/);
});
