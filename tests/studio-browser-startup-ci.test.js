import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isRetryableStudioChromeStartupFailure } from '../scripts/run-studio-browser-startup-ci.js';

const ROOT = path.resolve(process.cwd());

test('Studio startup CI retries only Chrome and DevTools startup handshake failures', () => {
  assert.equal(isRetryableStudioChromeStartupFailure('Chrome did not expose DevTools within 15000ms.'), true);
  assert.equal(isRetryableStudioChromeStartupFailure('Chrome exited before DevTools was ready (code=1).'), true);
  assert.equal(isRetryableStudioChromeStartupFailure('Chrome page target was not discoverable.'), true);
  assert.equal(isRetryableStudioChromeStartupFailure('Timed out connecting to the Chrome page target'), true);
  assert.equal(isRetryableStudioChromeStartupFailure('Chrome DevTools WebSocket connection failed'), true);
  assert.equal(isRetryableStudioChromeStartupFailure('Chrome page stopped responding to Page.enable for 2000ms'), true);
  assert.equal(isRetryableStudioChromeStartupFailure('Chrome page stopped responding to Page.navigate for 2000ms'), true);
  assert.equal(isRetryableStudioChromeStartupFailure('Chrome DevTools connection closed'), true);

  assert.equal(isRetryableStudioChromeStartupFailure('AssertionError: Run smoke probe did not render the default Patch Window app'), false);
  assert.equal(isRetryableStudioChromeStartupFailure('Command Palette did not open in Chrome'), false);
  assert.equal(isRetryableStudioChromeStartupFailure('Studio did not reach the responsive Run state'), false);
  assert.equal(isRetryableStudioChromeStartupFailure('Workshop Desk source mismatch'), false);
});

test('Studio startup CI keeps one bounded retry and the original product browser test', () => {
  const harness = fs.readFileSync(path.join(ROOT, 'scripts/run-studio-browser-startup-ci.js'), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');

  assert.match(harness, /tests\/studio-browser-startup\.test\.js/);
  assert.match(harness, /Retrying the startup gate once/);
  assert.match(workflow, /Studio Chrome startup smoke/);
  assert.match(workflow, /node scripts\/run-studio-browser-startup-ci\.js/);
  assert.match(workflow, /tests\/studio-browser-startup\.test\.js/);
  assert.doesNotMatch(workflow, /run: node --test tests\/studio-browser-startup\.test\.js/);
});
