import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/native-distribution.yml', 'utf8');

function pullRequestPaths(text) {
  const match = text.match(/pull_request:\n[\s\S]*?paths:\n([\s\S]*?)\n\nconcurrency:/);
  assert.ok(match, 'native-distribution pull_request paths block must remain explicit');
  return match[1];
}

test('Native Distribution only watches distribution-affecting PR paths', () => {
  const paths = pullRequestPaths(workflow);
  for (const required of [
    '.github/workflows/native-distribution.yml',
    'src/native-gui-ir.js',
    'src/native-accessibility.js',
    'src/win32-gui-v08.js',
    'src/appkit-gui-v08.js',
    'src/gtk-gui-v08.js',
    'scripts/build-native-gui.js',
    'scripts/build-native-win32.js',
    'scripts/build-native-appkit.js',
    'scripts/build-native-gtk.js',
    'scripts/build-native-sea.js',
    'scripts/sign-windows.ps1',
    'scripts/sign-notarize-macos.sh',
    'scripts/write-signing-status.js',
    'examples/forms-navigation.patch'
  ]) assert.match(paths, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.doesNotMatch(paths, /\n\s*- web\/docs\.html\b/);
  assert.doesNotMatch(paths, /\n\s*- docs\//);
  assert.doesNotMatch(paths, /\n\s*- tests\//);
});

test('Linux GTK dependency setup is bounded and retry-aware', () => {
  assert.match(workflow, /sudo timeout 180s apt-get -o Acquire::Retries=3 update/);
  assert.match(workflow, /sudo timeout 300s apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=60 install/);
  assert.match(workflow, /GTK dependency index update failed or exceeded 180 seconds/);
  assert.match(workflow, /GTK dependency installation failed or exceeded 300 seconds/);
  assert.match(workflow, /timeout-minutes: 30/);
});

test('manual Native Distribution remains available for explicit platform/signing checks', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /options: \[windows, macos, linux\]/);
  assert.match(workflow, /options: \[unsigned, require\]/);
});
