import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function readRepoText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const workflow = readRepoText('.github/workflows/native-distribution.yml');

test('Native Distribution remains manual-only during active development', () => {
  assert.match(workflow, /^on:\s*\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|pull_request_target|schedule|workflow_run|release|repository_dispatch):/m);
  assert.match(workflow, /options: \[windows, macos, linux\]/);
  assert.match(workflow, /options: \[unsigned, require\]/);
});

test('Linux GTK dependency setup is bounded, retry-aware and preserves the real failure code', () => {
  assert.match(workflow, /sudo timeout 180s apt-get -o Acquire::Retries=3 update/);
  assert.match(workflow, /sudo timeout 300s apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=60 install/);
  assert.match(workflow, /GTK dependency index update failed or exceeded 180 seconds/);
  assert.match(workflow, /GTK dependency installation failed or exceeded 300 seconds/);
  assert.equal((workflow.match(/code=\$\?/g) ?? []).length, 2);
  assert.equal((workflow.match(/exit "\$code"/g) ?? []).length, 2);
  assert.doesNotMatch(workflow, /if ! sudo timeout/);
  assert.match(workflow, /timeout-minutes: 30/);
});

test('manual Native Distribution remains available for explicit platform/signing checks', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /options: \[windows, macos, linux\]/);
  assert.match(workflow, /options: \[unsigned, require\]/);
});
