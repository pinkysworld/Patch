import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');

test('runtime events route through the explicit render policy dispatcher', () => {
  assert.match(playground, /from '\.\/studio-runtime-render-policy\.js'/);
  assert.match(playground, /function renderRuntimeWindowsAfterEvent\(/);
  assert.match(playground, /resolveStudioRuntimeRenderMode\(globalThis\.location\?\.search \?\? ''\)/);
  assert.match(playground, /PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL/);
  assert.match(playground, /patchRuntimeRenderMode/);
  assert.match(playground, /patchRuntimeReconcile = 'full-fallback-v1'/);
  assert.match(playground, /renderWindows\(container, windows, true\)/);
  assert.match(playground, /restoreRuntimeTransientState\(container, transient\)/);

  const triggerStart = playground.indexOf('function trigger(control, event, payload = {})');
  assert.ok(triggerStart >= 0);
  const trigger = playground.slice(triggerStart, playground.indexOf('function showTab(name)', triggerStart));
  assert.match(trigger, /renderRuntimeWindowsAfterEvent\(appView, result\.ui\)/);
  assert.doesNotMatch(trigger, /reconcileRuntimeWindows\(appView, result\.ui\)/);
});

test('runtime render policy ships with hosted and Offline Studio closure', () => {
  assert.match(buildSite, /'studio-runtime-render-policy\.js'/);
  assert.match(serviceWorker, /'\.\/studio-runtime-render-policy\.js'/);
});
