import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync('web/studio-bootstrap.js', 'utf8');
const designerUx = fs.readFileSync('web/designer-ux.js', 'utf8');
const formsDesigner = fs.readFileSync('web/forms-designer.js', 'utf8');

test('Studio bootstrap installs the Designer mutation guard before service-worker startup', () => {
  const install = bootstrap.indexOf('installDesignerMutationGuard();');
  const serviceWorker = bootstrap.indexOf("if (!('serviceWorker' in navigator)) return;");
  assert.ok(install >= 0, 'missing Designer mutation guard bootstrap');
  assert.ok(serviceWorker >= 0, 'missing service-worker bootstrap');
  assert.ok(install < serviceWorker, 'mutation guard must install before application modules can start');
  assert.match(bootstrap, /window\.MutationObserver = PatchStudioMutationObserver/);
});

test('Designer observers stay disconnected through reconciliation microtasks', () => {
  assert.match(bootstrap, /this\.nativeObserver\.disconnect\(\)/);
  assert.match(bootstrap, /scheduleMicrotask\(\(\) => this\.reconnect\(\)\)/);
  assert.match(bootstrap, /if \(isDesignerTarget\(target\)\) this\.guarded = true/);
  assert.match(bootstrap, /target\.id === 'designer' \|\| target\.id === 'designerCanvas'/);
});

test('guard covers the two existing self-mutating Designer reconciliation paths', () => {
  assert.match(designerUx, /new MutationObserver\(\(\) => \{/);
  assert.match(designerUx, /syncDesignerUx\(\)/);
  assert.match(designerUx, /\.observe\(designer, \{ childList: true, subtree: true \}\)/);

  assert.match(formsDesigner, /new MutationObserver\(scheduleApply\)\.observe\(target, \{ childList: true, subtree: true \}\)/);
  assert.match(formsDesigner, /patch-form-resize-handle/);
  assert.match(formsDesigner, /handle\.remove\(\)/);
});
