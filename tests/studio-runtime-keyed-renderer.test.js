import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');

test('runtime events reconcile keyed Forms instead of rebuilding the complete app tree', () => {
  assert.match(playground, /function runtimeWindowKey\(/);
  assert.match(playground, /dataset\.patchWindowKey/);
  assert.match(playground, /dataset\.patchControlKey = runtimeControlKey/);
  assert.match(playground, /function reconcileRuntimeWindows\(/);
  assert.match(playground, /patchRuntimeReconcile = 'keyed-window-v1'/);
  const trigger = playground.slice(playground.indexOf('function trigger(control, event, payload = {})'), playground.indexOf('function showTab(name)'));
  assert.match(trigger, /reconcileRuntimeWindows\(appView, result\.ui\)/);
  assert.doesNotMatch(trigger, /renderWindows\(appView/);
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
