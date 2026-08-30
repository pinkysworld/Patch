import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');

test('runtime events keep keyed reconciliation as the default render-policy path', () => {
  assert.match(playground, /function runtimeWindowKey\(/);
  assert.match(playground, /dataset\.patchWindowKey/);
  assert.match(playground, /dataset\.patchControlKey = runtimeControlKey/);
  assert.match(playground, /function reconcileRuntimeWindows\(/);
  assert.match(playground, /patchRuntimeReconcile = 'keyed-control-v2'/);
  assert.match(playground, /patchRuntimeReusedForms/);
  assert.match(playground, /container\.insertBefore\(shell, current\)/);
  assert.match(playground, /function renderRuntimeWindowsAfterEvent\(/);

  const triggerStart = playground.indexOf('function trigger(control, event, payload = {})');
  const trigger = playground.slice(triggerStart, playground.indexOf('function showTab(name)', triggerStart));
  assert.match(trigger, /renderRuntimeWindowsAfterEvent\(appView, result\.ui\)/);
  assert.doesNotMatch(trigger, /renderWindows\(appView/);
  assert.doesNotMatch(trigger, /reconcileRuntimeWindows\(appView, result\.ui\)/);

  const dispatcherStart = playground.indexOf('function renderRuntimeWindowsAfterEvent(container, windows)');
  const dispatcher = playground.slice(dispatcherStart, playground.indexOf('function createControlElement', dispatcherStart));
  assert.match(dispatcher, /reconcileRuntimeWindows\(container, windows\)/);
  assert.match(dispatcher, /mode !== PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL/);
});

test('keyed Form replacement preserves bounded transient browser state', () => {
  assert.match(playground, /function captureRuntimeTransientState\(/);
  assert.match(playground, /function restoreRuntimeTransientState\(/);
  assert.match(playground, /selectionStart/);
  assert.match(playground, /setSelectionRange/);
  assert.match(playground, /containerScrollTop/);
  assert.match(playground, /patchRenderedSelection/);
  assert.match(playground, /preventScroll: true/);
});

test('Tabs update only their local panel instead of rerendering all Forms', () => {
  const start = playground.indexOf('function createTabsElement(control, context)');
  const end = playground.indexOf('function decorateDesignerControl', start);
  const tabs = playground.slice(start, end);
  assert.match(tabs, /renderTabsPanel\(panel, pages\[pageIndex\], context, pageIndex\)/);
  assert.match(tabs, /aria-selected/);
  assert.doesNotMatch(tabs, /renderWindows\(/);
});
