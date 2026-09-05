import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/offline-studio.yml', import.meta.url), 'utf8');

function occurrences(text) {
  return workflow.split(text).length - 1;
}

test('Offline Studio workflow triggers on Stage 2 smoke and focused test changes', () => {
  for (const path of [
    "scripts/check-offline-studio-resource-build.js",
    "tests/offline-studio-linux-bundle.test.js",
    "tests/offline-studio-structured-diagnostics.test.js",
    "tests/offline-studio-workflow.test.js"
  ]) {
    assert.equal(occurrences(`- '${path}'`), 2, `${path} must trigger both pull_request and main push Offline Studio CI`);
  }
});

test('Offline Studio host unit matrix runs Stage 2 bundle and diagnostics tests', () => {
  const command = [
    'node --test',
    'tests/offline-studio-assets.test.js',
    'tests/offline-studio-build-bridge.test.js',
    'tests/offline-studio-linux-bundle.test.js',
    'tests/offline-studio-structured-diagnostics.test.js',
    'tests/offline-studio-workflow.test.js',
    'tests/offline-studio-portable.test.js',
    'tests/offline-downloads-page.test.js'
  ].join(' ');

  assert.equal(occurrences(command), 2, 'focused Offline Studio unit command must run on host matrix and macOS Intel kit');
});
