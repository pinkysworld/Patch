import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');

test('runtime reconciler has a keyed control stage inside stable visible Forms', () => {
  assert.match(playground, /const RUNTIME_CORE_CONTROL_TYPES = new Set/);
  assert.match(playground, /function runtimeControlFingerprint\(/);
  assert.match(playground, /function runtimeSpecializedControlsFingerprint\(/);
  assert.match(playground, /function reconcileRuntimeCoreControls\(/);
  assert.match(playground, /function reconcileRuntimeWindowShell\(/);
  assert.match(playground, /patchRuntimeReconcile = 'keyed-control-v2'/);
  assert.match(playground, /patchRuntimeReconciledForms/);
  assert.match(playground, /patchRuntimeReusedControls/);
  assert.match(playground, /patchRuntimeReplacedControls/);
});

test('core control DOM identity is fingerprinted and specialized control drift fails back to Form replacement', () => {
  assert.match(playground, /el\.__patchControlFingerprint = runtimeControlFingerprint\(control\)/);
  assert.match(playground, /shell\.__patchRuntimeSpecializedFingerprint = runtimeSpecializedControlsFingerprint\(model\)/);
  assert.match(playground, /shell\.__patchRuntimeSpecializedFingerprint !== specializedFingerprint/);
  assert.match(playground, /return null;/);
  assert.match(playground, /existingElement\.replaceWith\(nextElement\)/);
});

test('control reconciliation validates the stable top-level key sequence before mutation', () => {
  assert.match(playground, /const rendered = \[\.\.\.body\.children\]\.filter\(child => child\.dataset\.patchControlKey\)/);
  assert.match(playground, /if \(rendered\.length !== expected\.length\) return null/);
  assert.match(playground, /rendered\[index\]\.dataset\.patchControlKey !== expected\[index\]\.key/);
});
