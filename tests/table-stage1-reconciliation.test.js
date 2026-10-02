import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const table = fs.readFileSync('web/table-stage1.js', 'utf8');
const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
const runtimeState = fs.readFileSync('web/studio-runtime-selection-state.js', 'utf8');

test('Table Stage 1 exposes and reuses the canonical runtime adapter contract', () => {
  execFileSync(process.execPath, ['--check', 'web/table-stage1.js'], { stdio: 'pipe' });
  assert.match(table, /PATCH_STUDIO_TABLE_RUNTIME_ADAPTER_CONTRACT_VERSION = '0\.1'/);
  assert.match(table, /export function isTableRuntimeAdapterControl\(control\)/);
  assert.match(table, /export function tableRuntimeAdapterModelFingerprint\(control\)/);
  assert.match(table, /function tableAdapterFingerprint\(node, options = \{\}\)/);
  assert.match(table, /layout: node\?\.layout \?\? null/);
  assert.match(table, /hasHandler: options\.hasHandler === true/);
  assert.match(table, /const existingTables = new Map\(\)/);
  assert.match(table, /const key = runtimeSelectionKey\(node,/);
  assert.match(table, /let element = existingTables\.get\(key\) \?\? null/);
  assert.match(table, /element\.__patchTableStageFingerprint !== fingerprint/);
  assert.match(table, /replacement\.__patchTableStageFingerprint = fingerprint/);
  assert.match(table, /existingTables\.delete\(key\)/);
  assert.doesNotMatch(table, /for \(const old of body\.querySelectorAll\(':scope > \.patch-table-stage1-control'\)\) old\.remove\(\)/);
});

test('Table reconciliation keeps explicit stale and deferred fallbacks', () => {
  assert.match(table, /shell\.dataset\.patchRenderDetail === 'deferred'/);
  assert.match(table, /for \(const element of existingTables\.values\(\)\) element\.remove\(\)/);
  assert.match(table, /for \(const stale of existingTables\.values\(\)\) stale\.remove\(\)/);
  assert.match(table, /element\?\.replaceWith\(replacement\)/);
});

test('Table adapter drift is reconciled without widening unknown specialized controls', () => {
  assert.match(table, /getRuntimeSelection/);
  assert.match(table, /setRuntimeSelection/);
  assert.match(table, /runtimeSelectionKey/);
  assert.match(runtimeState, /table/);
  assert.match(table, /patch-studio-runtime-adapter-reconcile/);
  assert.match(renderer, /function runtimeReconciledAdapterControlsFingerprint\(/);
  assert.match(renderer, /function runtimeFallbackSpecializedControlsFingerprint\(/);
  assert.match(renderer, /!isTableRuntimeAdapterControl\(control\)/);
  assert.match(renderer, /patch-studio-runtime-adapter-reconcile/);
  assert.match(renderer, /patchRuntimeReconciledAdapters/);
  assert.match(renderer, /shell\.__patchRuntimeFallbackSpecializedFingerprint !== fallbackSpecializedFingerprint/);
  assert.match(renderer, /return null;/);
});
