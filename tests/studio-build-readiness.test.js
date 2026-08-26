import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildReadinessModel } from '../web/studio-dom-sync.js';

const windowSource = `window "Ready" as main size 480, 300:
  button "Run" as run_button at 24, 24 size 120, 36
  picture as logo at 24, 72 size 180, 120
`;

test('Studio build readiness reports supported current desktop targets before build', () => {
  const windows = buildReadinessModel(windowSource, 'window', 'native-windows');
  assert.equal(windows.state, 'ready');
  assert.equal(windows.label, 'Ready: Windows');

  const linux = buildReadinessModel(windowSource, 'window', 'native-linux');
  assert.equal(linux.state, 'ready');
  assert.equal(linux.label, 'Ready: Linux');
});

test('Studio build readiness surfaces fail-closed component incompatibility without changing build semantics', () => {
  const freebsd = buildReadinessModel(windowSource, 'window', 'native-freebsd');
  assert.equal(freebsd.state, 'blocked');
  assert.match(freebsd.label, /unsupported on FreeBSD/);
  assert.match(freebsd.detail, /button/);
  assert.match(freebsd.detail, /picture/);
});

test('Studio build readiness stays neutral for targets outside the component matrix and exposes source errors', () => {
  assert.equal(buildReadinessModel(windowSource, 'window', 'portable').state, 'neutral');
  assert.equal(buildReadinessModel('window "Broken":\n  definitely not patch syntax', 'window', 'native-windows').state, 'source-error');
  assert.equal(buildReadinessModel('create number n = 1', 'console', 'native-linux').state, 'ready');
});

test('Studio packages build readiness inside the canonical DOM synchronization module', () => {
  const sync = fs.readFileSync('web/studio-dom-sync.js', 'utf8');
  assert.match(sync, /buildReadinessModel/);
  assert.match(sync, /patchComponent/);
  assert.match(sync, /status\.id = 'buildReadiness'/);
  assert.match(sync, /aria-live/);
  assert.doesNotMatch(sync, /studio-build-readiness\.js/);
});
