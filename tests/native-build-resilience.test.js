import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const nativeBuild = fs.readFileSync('web/native-build.js', 'utf8');

test('native build browser module remains valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', 'web/native-build.js'], { stdio: 'pipe' });
});

test('cloud builds expose explicit cancel retry and bounded timeout controls', () => {
  for (const marker of [
    'CLOUD_BUILD_TIMEOUT_MS = 15 * 60 * 1000',
    "cancel.id = 'cancelNativeBuild'",
    "retry.id = 'retryNativeBuild'",
    'cancelActiveCloudBuild',
    'retryLastCloudBuild',
    'PatchBuildCancelledError',
    'PatchBuildTimeoutError'
  ]) assert.ok(nativeBuild.includes(marker), marker);
});

test('retry dispatches a captured source snapshot with a fresh request id', () => {
  const runCloudStart = nativeBuild.indexOf('async function runCloudBuild(snapshot)');
  const waitStart = nativeBuild.indexOf('async function waitForRun', runCloudStart);
  const runCloud = nativeBuild.slice(runCloudStart, waitStart);
  assert.ok(runCloudStart > 0);
  assert.match(runCloud, /const requestId = makeRequestId\(\)/);
  assert.match(runCloud, /source_b64: snapshot\.sourceBase64/);
  assert.match(nativeBuild, /lastCloudBuildSnapshot = cloudSnapshot/);
  assert.match(nativeBuild, /await runCloudBuild\(snapshot\)/);
  assert.doesNotMatch(nativeBuild, /localStorage.*token|sessionStorage.*token/i);
});

test('cancel requests reach the exact GitHub Actions run and timeout cancels known work', () => {
  assert.match(nativeBuild, /actions\/runs\/\$\{state\.runId\}\/cancel/);
  assert.match(nativeBuild, /if \(seen && seen\.status !== 'completed'\) await cancelCloudRun\(state\)/);
  assert.match(nativeBuild, /state\.cancelRequested/);
  assert.match(nativeBuild, /state\.runId = run\.id/);
  assert.match(nativeBuild, /response\.status === 202 \|\| response\.status === 204/);
});

test('no-token ready and local build modes remain independent of cloud cancellation', () => {
  assert.match(nativeBuild, /Ready app download \(no token\)/);
  assert.match(nativeBuild, /nativeBuildMode\.value === 'prebuilt'/);
  assert.match(nativeBuild, /nativeBuildMode\.value === 'local'/);
  assert.match(nativeBuild, /nativeBuildMode\.value === 'cloud'/);
});
