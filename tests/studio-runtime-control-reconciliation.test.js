import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');

test('runtime reconciler has a keyed control stage inside stable visible Forms', () => {
  assert.match(playground, /createStudioWindowRenderer\(\{ dispatch: trigger \}\)/);
  assert.match(renderer, /const RUNTIME_CORE_CONTROL_TYPES = new Set/);
  assert.match(renderer, /function runtimeControlFingerprint\(/);
  assert.match(renderer, /function runtimeReconciledAdapterControlsFingerprint\(/);
  assert.match(renderer, /function runtimeFallbackSpecializedControlsFingerprint\(/);
  assert.match(renderer, /function reconcileRuntimeCoreControls\(/);
  assert.match(renderer, /function reconcileRuntimeWindowShell\(/);
  assert.match(renderer, /patchRuntimeReconcile = 'keyed-control-v2'/);
  assert.match(renderer, /patchRuntimeReconciledForms/);
  assert.match(renderer, /patchRuntimeReusedControls/);
  assert.match(renderer, /patchRuntimeReplacedControls/);
  assert.match(renderer, /patchRuntimeReconciledAdapters/);
});

test('known Table adapter drift reconciles while unknown specialized drift keeps the Form fallback', () => {
  assert.match(renderer, /el\.__patchControlFingerprint = runtimeControlFingerprint\(control\)/);
  assert.match(renderer, /shell\.__patchRuntimeAdapterFingerprint = runtimeReconciledAdapterControlsFingerprint\(model\)/);
  assert.match(renderer, /shell\.__patchRuntimeFallbackSpecializedFingerprint = runtimeFallbackSpecializedControlsFingerprint\(model\)/);
  assert.match(renderer, /shell\.__patchRuntimeFallbackSpecializedFingerprint !== fallbackSpecializedFingerprint/);
  assert.match(renderer, /const adapterChanged = shell\.__patchRuntimeAdapterFingerprint !== adapterFingerprint/);
  assert.match(renderer, /patch-studio-runtime-adapter-reconcile/);
  assert.match(renderer, /existingElement\.replaceWith\(nextElement\)/);
});

test('control reconciliation validates the stable top-level key sequence before mutation', () => {
  const table = fs.readFileSync('web/table-stage1.js', 'utf8');
  assert.match(renderer, /const rendered = \[\.\.\.body\.children\]\.filter\(isRuntimeCoreReconcileChild\)/);
  assert.match(renderer, /isRuntimeCoreReconcileChild/);
  assert.match(table, /function isRuntimeCoreReconcileChild\(child\)/);
  assert.match(table, /patchRuntimeSelectionKind === 'table'/);
  assert.match(table, /patch-table-stage1-control/);
  assert.match(renderer, /if \(rendered\.length !== expected\.length\) return null/);
  assert.match(renderer, /rendered\[index\]\.dataset\.patchControlKey !== expected\[index\]\.key/);
  assert.match(renderer, /existingElement\.replaceWith\(nextElement\)/);
});