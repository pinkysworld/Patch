import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const restore = fs.readFileSync('web/project-config-restore.js', 'utf8');
const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
const ux = fs.readFileSync('web/designer-ux.js', 'utf8');
const forms = fs.readFileSync('web/form-designer-workflow.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const siteCheck = fs.readFileSync('scripts/check-site.js', 'utf8');
const icon = fs.readFileSync('web/icon.svg', 'utf8');

test('Designer coordinator pauses the complete observer set during reconciliation', () => {
  assert.match(restore, /installDesignerObserverCoordinator\(\)/);
  assert.match(restore, /pendingObservers = new Set\(\)/);
  assert.match(restore, /designerObservers = new Set\(\)/);
  assert.match(restore, /designerObservers\.add\(this\)/);
  assert.match(restore, /const paused = \[\.\.\.designerObservers\]\.filter\(observer => observer\.active\)/);
  assert.match(restore, /for \(const observer of paused\) observer\.pause\(\)/);
  assert.match(restore, /queueMicrotask\(\(\) => \{/);
  assert.match(restore, /for \(const observer of paused\) observer\.reconnect\(\)/);
  assert.match(restore, /cross-module A -> B -> C -> A feedback chain/);
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

test('rendered Patch brand keeps geometry in the shared compiler icon while runtime only tags diagnostics', () => {
  assert.match(workspace, /dataset\.patchBrandMark/);
  assert.match(workspace, /compiler-p-v1/);
  assert.doesNotMatch(workspace, /innerHTML\s*=/);
  assert.doesNotMatch(workspace, /shape-rendering=\"crispEdges\"/);

  assert.match(icon, /viewBox="0 0 512 512"/);
  assert.match(icon, /aria-label="Patch Studio compiler mark"/);
  assert.match(icon, /id="patch-circuit-cuts"/);
  assert.match(icon, /id="patch-pass"/);
  assert.match(icon, /id="patch-accent"/);

  assert.match(buildSite, /'manifest\.webmanifest','icon\.svg'/);
  assert.match(siteCheck, /'_site\/icon\.svg'/);
  assert.match(siteCheck, /data-patch-brand-mark=\"compiler-p-v1\"/);
  assert.match(siteCheck, /rejectAll\('Studio beta36 current shell',[\s\S]*M8 6H22V18H13V26H8ZM13 10H18V14H13Z/);
});
