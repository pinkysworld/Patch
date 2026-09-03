import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isRetryableChromeStartupFailure } from '../scripts/run-studio-browser-performance-ci.js';

const ROOT = path.resolve(process.cwd());

test('full CI suite leaves real-browser performance to its dedicated bounded gate', () => {
  const runner = fs.readFileSync(path.join(ROOT, 'scripts/run-tests-ci.js'), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  assert.match(runner, /Studio browser performance stays inside generous R0 hard limits/);
  assert.match(workflow, /Studio browser performance gate/);
  assert.match(workflow, /node scripts\/run-studio-browser-performance-ci\.js/);
  assert.doesNotMatch(workflow, /run: node --test tests\/studio-browser-performance-contract\.test\.js tests\/studio-browser-performance\.test\.js/);
});

test('performance CI retries only browser startup and DevTools handshake failures', () => {
  assert.equal(isRetryableChromeStartupFailure('Performance Chrome did not expose DevTools within 15000ms.'), true);
  assert.equal(isRetryableChromeStartupFailure('Performance Chrome exited early.'), true);
  assert.equal(isRetryableChromeStartupFailure('Performance Chrome page target was not discoverable'), true);
  assert.equal(isRetryableChromeStartupFailure('Chrome CDP connection timed out'), true);
  assert.equal(isRetryableChromeStartupFailure('Chrome CDP connection failed'), true);
  assert.equal(isRetryableChromeStartupFailure('workshopRunFirstPaint 4100ms exceeds 3000ms'), false);
  assert.equal(isRetryableChromeStartupFailure('performance measurement timed out'), false);
  assert.equal(isRetryableChromeStartupFailure('AssertionError: source-backed Designer mismatch'), false);
});

test('performance CI keeps one bounded retry and the original product performance tests', () => {
  const harness = fs.readFileSync(path.join(ROOT, 'scripts/run-studio-browser-performance-ci.js'), 'utf8');
  assert.match(harness, /tests\/studio-browser-performance-contract\.test\.js/);
  assert.match(harness, /tests\/studio-browser-performance\.test\.js/);
  assert.match(harness, /Retrying the browser performance gate once/);
  assert.doesNotMatch(harness, /performance measurement timed out[\s\S]*RETRYABLE_CHROME_STARTUP_FAILURES/);
});