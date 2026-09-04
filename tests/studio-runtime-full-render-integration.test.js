import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const runController = fs.readFileSync('web/studio-run-controller.js', 'utf8');
const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');

test('runtime events route through the explicit render policy dispatcher', () => {
  assert.match(renderer, /from '\.\/studio-runtime-render-policy\.js'/);
  assert.match(renderer, /function renderRuntimeWindowsAfterEvent\(/);
  assert.match(renderer, /resolveStudioRuntimeRenderMode\(globalThis\.location\?\.search \?\? ''\)/);
  assert.match(renderer, /PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL/);
  assert.match(renderer, /patchRuntimeRenderMode/);
  assert.match(renderer, /patchRuntimeReconcile = 'full-fallback-v1'/);
  assert.match(renderer, /renderWindows\(container, windows, true, \{\}, dispatch\)/);
  assert.match(renderer, /restoreRuntimeTransientState\(container, transient\)/);

  assert.match(runController, /onEventSuccess\(result\)/);
  assert.match(runController, /renderAfterEvent\(result\.ui\)/);
  const installStart = playground.indexOf('const studioRunController = installStudioRunController({');
  assert.ok(installStart >= 0);
  const install = playground.slice(installStart, playground.indexOf("for (const tab of document.querySelectorAll('.tab'))", installStart));
  assert.match(install, /renderAfterEvent\(ui\) \{/);
  assert.match(install, /studioWindowRenderer\.renderAfterEvent\(appView, ui\)/);
  assert.doesNotMatch(install, /reconcileRuntimeWindows\(appView, ui\)/);
});

test('runtime render policy and renderer ship with hosted and Offline Studio closure', () => {
  assert.match(buildSite, /'studio-runtime-render-policy\.js'/);
  assert.match(buildSite, /'studio-window-renderer\.js'/);
  assert.match(serviceWorker, /'\.\/studio-runtime-render-policy\.js'/);
  assert.match(serviceWorker, /'\.\/studio-window-renderer\.js'/);
});