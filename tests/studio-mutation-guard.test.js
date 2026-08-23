import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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

test('guard suppresses a self-triggering Designer reconciliation microtask', async () => {
  class NativeMutationObserver {
    static instances = [];

    constructor(callback) {
      this.callback = callback;
      this.observing = false;
      NativeMutationObserver.instances.push(this);
    }

    observe() { this.observing = true; }
    disconnect() { this.observing = false; }
    takeRecords() { return []; }
    trigger(records = []) { if (this.observing) this.callback(records, this); }
  }

  const windowObject = { MutationObserver: NativeMutationObserver };
  const context = vm.createContext({
    window: windowObject,
    navigator: {},
    document: {},
    queueMicrotask,
    Promise,
    TypeError
  });
  vm.runInContext(bootstrap, context);

  let callbacks = 0;
  const observer = new context.window.MutationObserver(() => {
    callbacks += 1;
    queueMicrotask(() => NativeMutationObserver.instances[0].trigger([{ type: 'childList' }]));
  });
  const designer = { id: 'designer', nodeType: 1, closest: selector => selector === '#designer' ? designer : null };
  observer.observe(designer, { childList: true, subtree: true });

  NativeMutationObserver.instances[0].trigger([{ type: 'childList' }]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(callbacks, 1, 'observer must not retrigger from its own reconciliation microtask');

  NativeMutationObserver.instances[0].trigger([{ type: 'childList' }]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(callbacks, 2, 'observer must reconnect for later external mutations');
});

test('guard covers the two existing self-mutating Designer reconciliation paths', () => {
  assert.match(designerUx, /new MutationObserver\(\(\) => \{/);
  assert.match(designerUx, /syncDesignerUx\(\)/);
  assert.match(designerUx, /\.observe\(designer, \{ childList: true, subtree: true \}\)/);

  assert.match(formsDesigner, /new MutationObserver\(scheduleApply\)\.observe\(target, \{ childList: true, subtree: true \}\)/);
  assert.match(formsDesigner, /patch-form-resize-handle/);
  assert.match(formsDesigner, /handle\.remove\(\)/);
});
