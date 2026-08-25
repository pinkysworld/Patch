import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const restore = fs.readFileSync('web/project-config-restore.js', 'utf8');
const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
const ux = fs.readFileSync('web/designer-ux.js', 'utf8');
const forms = fs.readFileSync('web/form-designer-workflow.js', 'utf8');

test('Designer coordinator batches cross-observer reconciliation before reconnecting', () => {
  assert.match(restore, /installDesignerObserverCoordinator\(\)/);
  assert.match(restore, /pendingObservers = new Set\(\)/);
  assert.match(restore, /for \(const observer of batch\) observer\.pause\(\)/);
  assert.match(restore, /queueMicrotask\(\(\) => \{/);
  assert.match(restore, /for \(const observer of batch\) observer\.reconnect\(\)/);
  assert.match(restore, /A -> B -> A mutation ping-pong/);
  assert.match(restore, /window\.MutationObserver = CoordinatedDesignerObserver/);
});

test('large samples suppress only the redundant source change pass', () => {
  assert.match(workspace, /BULK_WINDOW_SAMPLES = new Set\(\['workshopDesk', 'listboxMultiWindow'\]\)/);
  assert.match(workspace, /event\.target === code/);
  assert.match(workspace, /event\.stopImmediatePropagation\(\)/);
  assert.match(workspace, /project-kind change perform the one immediate/);
  assert.match(restore, /sample\.value = 'counterWindow'/);
});

test('Designer UX and Form workflow cache parsed source models across DOM-only mutations', () => {
  for (const [label, source] of [['Designer UX', ux], ['Form workflow', forms]]) {
    assert.match(source, /let cachedSource = null/ , `${label} should track the source revision`);
    assert.match(source, /function refreshSourceSnapshot\(\)/, `${label} should centralize model refresh`);
    assert.match(source, /if \(source === cachedSource\) return/, `${label} should skip unchanged source`);
  }
  assert.match(ux, /scheduleDesignerUx/);
  assert.match(ux, /new MutationObserver\(\(\) => \{[\s\S]*scheduleDesignerUx\(\)/);
});

test('rendered Patch brand uses the classic softer 32-unit P', () => {
  assert.match(workspace, /dataset\.patchBrandMark/);
  assert.match(workspace, /viewBox=\"0 0 32 32\"/);
  assert.match(workspace, /M8 6H22V18H13V26H8ZM13 10H18V14H13Z/);
  assert.doesNotMatch(workspace, /shape-rendering=\"crispEdges\"/);
});
