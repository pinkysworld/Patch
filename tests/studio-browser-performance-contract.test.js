import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_BROWSER_PERFORMANCE_CONTRACT,
  PATCH_STUDIO_BROWSER_PERFORMANCE_LIMITS_MS,
  validateStudioBrowserPerformance
} from '../scripts/studio-browser-performance-contract.js';

test('Studio browser performance contract is versioned and keeps generous finite CI limits', () => {
  assert.equal(PATCH_STUDIO_BROWSER_PERFORMANCE_CONTRACT, 'patch-studio-browser-performance/0.1');
  assert.deepEqual(Object.keys(PATCH_STUDIO_BROWSER_PERFORMANCE_LIMITS_MS).sort(), [
    'largeProjectDesignerSwitch',
    'largeProjectRunFirstPaint',
    'workshopEventToPaint',
    'workshopRunFirstPaint'
  ]);
  for (const limit of Object.values(PATCH_STUDIO_BROWSER_PERFORMANCE_LIMITS_MS)) {
    assert.equal(Number.isFinite(limit), true);
    assert.ok(limit >= 2000, 'hosted-runner hard limits should remain generous rather than microbenchmark-sensitive');
  }
});

test('Studio browser performance validation reports exact over-budget measurements', () => {
  const limits = {
    workshopRunFirstPaint: 100,
    workshopEventToPaint: 100,
    largeProjectRunFirstPaint: 100,
    largeProjectDesignerSwitch: 100
  };
  const passed = validateStudioBrowserPerformance({
    workshopRunFirstPaint: 10,
    workshopEventToPaint: 20,
    largeProjectRunFirstPaint: 30,
    largeProjectDesignerSwitch: 40
  }, limits);
  assert.equal(passed.passed, true);
  assert.deepEqual(passed.failures, []);

  const failed = validateStudioBrowserPerformance({
    workshopRunFirstPaint: 101,
    workshopEventToPaint: 20,
    largeProjectRunFirstPaint: 30,
    largeProjectDesignerSwitch: Number.NaN
  }, limits);
  assert.equal(failed.passed, false);
  assert.equal(failed.failures.length, 2);
  assert.match(failed.failures[0], /workshopRunFirstPaint 101\.0ms exceeds 100ms/);
  assert.match(failed.failures[1], /largeProjectDesignerSwitch must be a finite non-negative measurement/);
});
