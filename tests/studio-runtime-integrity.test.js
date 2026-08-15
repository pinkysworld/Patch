import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('web/index.html', 'utf8');
const runtimeIntegrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');

test('runtime integrity wrapper loads before the native builder and verifies all v1.0 native templates', () => {
  const integrityIndex = html.indexOf('./runtime-integrity.js');
  const nativeBuildIndex = html.indexOf('./native-build.js');
  assert.ok(integrityIndex > 0);
  assert.ok(nativeBuildIndex > integrityIndex);
  for (const file of [
    'patch-windows-native-gui-runtime.exe',
    'patch-linux-native-gui-runtime.bin',
    'patch-macos-native-gui-runtime.bin'
  ]) assert.match(runtimeIntegrity, new RegExp(file.replaceAll('.', '\\.')));
  assert.match(runtimeIntegrity, /runtime-manifest\.json/);
  assert.match(runtimeIntegrity, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(runtimeIntegrity, /failed SHA-256 verification/);
});

test('Pages derives the deployed runtime manifest from GitHub release asset digests', () => {
  assert.match(pages, /runtime-integrity-manifest\.js/);
  assert.match(pages, /\.assets\[\]/);
  assert.match(pages, /\.digest/);
  assert.match(pages, /runtime-manifest\.json/);
});

test('service worker fetches runtime assets fresh-first before offline fallback', () => {
  assert.match(serviceWorker, /runtimeAsset/);
  assert.match(serviceWorker, /url\.pathname\.includes\('\/runtimes\/'\)/);
  assert.match(serviceWorker, /freshFirst = event\.request\.mode === 'navigate' \|\| codeAsset \|\| runtimeAsset/);
});
