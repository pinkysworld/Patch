import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const runController = fs.readFileSync('web/studio-run-controller.js', 'utf8');
const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');

test('runtime events keep keyed reconciliation as the default render-policy path', () => {
  assert.match(renderer, /function runtimeWindowKey\(/);
  assert.match(renderer, /dataset\.patchWindowKey/);
  assert.match(renderer, /dataset\.patchControlKey = runtimeControlKey/);
  assert.match(renderer, /function reconcileRuntimeWindows\(/);
  assert.match(renderer, /patchRuntimeReconcile = 'keyed-control-v2'/);
  assert.match(renderer, /patchRuntimeReusedForms/);
  assert.match(renderer, /container\.insertBefore\(shell, current\)/);
  assert.match(renderer, /function renderRuntimeWindowsAfterEvent\(/);

  assert.match(runController, /onEventSuccess\(result\)/);
  assert.match(runController, /renderAfterEvent\(result\.ui\)/);
  assert.match(playground, /createStudioWindowRenderer\(\{ dispatch: trigger \}\)/);
  const installStart = playground.indexOf('const studioRunController = installStudioRunController({');
  const install = playground.slice(installStart, playground.indexOf("for (const tab of document.querySelectorAll('.tab'))", installStart));
  assert.match(install, /renderInitial\(ui\) \{[\s\S]*?studioWindowRenderer\.renderInitial\(appView, ui\)/);
  const afterEventStart = install.indexOf('renderAfterEvent(ui) {');
  const afterEvent = install.slice(afterEventStart, install.indexOf('renderFailure()', afterEventStart));
  assert.match(afterEvent, /studioWindowRenderer\.renderAfterEvent\(appView, ui\)/);
  assert.doesNotMatch(afterEvent, /renderWindows\(appView, ui/);
  assert.doesNotMatch(afterEvent, /reconcileRuntimeWindows\(appView, ui\)/);

  const dispatcherStart = renderer.indexOf('function renderRuntimeWindowsAfterEvent(container, windows, dispatch)');
  const dispatcher = renderer.slice(dispatcherStart, renderer.indexOf('function createControlElement', dispatcherStart));
  assert.match(dispatcher, /reconcileRuntimeWindows\(container, windows, dispatch\)/);
  assert.match(dispatcher, /mode !== PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL/);
});

test('keyed Form replacement preserves bounded transient browser state', () => {
  assert.match(renderer, /function captureRuntimeTransientState\(/);
  assert.match(renderer, /function restoreRuntimeTransientState\(/);
  assert.match(renderer, /selectionStart/);
  assert.match(renderer, /setSelectionRange/);
  assert.match(renderer, /containerScrollTop/);
  assert.match(renderer, /patchRenderedSelection/);
  assert.match(renderer, /preventScroll: true/);
});

test('Tabs update only their local panel instead of rerendering all Forms', () => {
  const start = renderer.indexOf('function createTabsElement(control, context)');
  const end = renderer.indexOf('function decorateDesignerControl', start);
  const tabs = renderer.slice(start, end);
  assert.match(tabs, /renderTabsPanel\(panel, pages\[pageIndex\], context, pageIndex\)/);
  assert.match(tabs, /aria-selected/);
  assert.doesNotMatch(tabs, /renderWindows\(/);
});