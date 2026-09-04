import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');

test('runtime reconciler has a keyed control stage inside stable visible Forms', () => {
  assert.match(playground, /createStudioWindowRenderer\(\{ dispatch: trigger \}\)/);
  assert.match(renderer, /const RUNTIME_CORE_CONTROL_TYPES = new Set/);
  assert.match(renderer, /function runtimeControlFingerprint\(/);
  assert.match(renderer, /function runtimeSpecializedControlsFingerprint\(/);
  assert.match(renderer, /function reconcileRuntimeCoreControls\(/);
  assert.match(renderer, /function reconcileRuntimeWindowShell\(/);
  assert.match(renderer, /patchRuntimeReconcile = 'keyed-control-v2'/);
  assert.match(renderer, /patchRuntimeReconciledForms/);
  assert.match(renderer, /patchRuntimeReusedControls/);
  assert.match(renderer, /patchRuntimeReplacedControls/);
});

test('core control DOM identity is fingerprinted and specialized control drift fails back to Form replacement', () => {
  assert.match(renderer, /el\.__patchControlFingerprint = runtimeControlFingerprint\(control\)/);
  assert.match(renderer, /shell\.__patchRuntimeSpecializedFingerprint = runtimeSpecializedControlsFingerprint\(model\)/);
  assert.match(renderer, /shell\.__patchRuntimeSpecializedFingerprint !== specializedFingerprint/);
  assert.match(renderer, /return null;/);
  assert.match(renderer, /existingElement\.replaceWith\(nextElement\)/);
});

test('control reconciliation validates the stable top-level key sequence before mutation', () => {
  assert.match(renderer, /const rendered = \[\.\.\.body\.children\]\.filter\(child => child\.dataset\.patchControlKey\)/);
  assert.match(renderer, /if \(rendered\.length !== expected\.length\) return null/);
  assert.match(renderer, /rendered\[index\]\.dataset\.patchControlKey !== expected\[index\]\.key/);
});