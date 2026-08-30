import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_WORKER_PROTOCOL,
  PATCH_STUDIO_WORKER_PROTOCOL_VERSION,
  PATCH_STUDIO_WORKER_TASK_COMPILE,
  PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL,
  createStudioWorkerRequest,
  handleStudioWorkerRequest
} from '../src/studio-worker-protocol.js';
import { installStudioLanguageWorkerHost } from '../web/studio-language-worker.js';

test('Studio worker design-model task keeps application behavior out of design time', () => {
  const request = createStudioWorkerRequest({
    id: 'design-1',
    task: PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL,
    source: `create number count = 1\nchange count:\n  add 99\nwindow "Count {count}" as main:\n  text "{count}"`
  });
  const response = handleStudioWorkerRequest(request);
  assert.equal(response.ok, true);
  assert.equal(response.protocol, PATCH_STUDIO_WORKER_PROTOCOL);
  assert.equal(response.version, PATCH_STUDIO_WORKER_PROTOCOL_VERSION);
  assert.equal(response.id, 'design-1');
  assert.equal(response.result.state.count, 1);
  assert.equal(response.result.ui[0].title, 'Count 1');
  assert.deepEqual(response.result.skipped.map(item => item.kind), ['change']);
  assert.doesNotThrow(() => structuredClone(response));
});

test('Studio worker compile task returns the canonical compiler artifacts', () => {
  const response = handleStudioWorkerRequest(createStudioWorkerRequest({
    id: 'compile-1',
    task: PATCH_STUDIO_WORKER_TASK_COMPILE,
    source: 'create number score = 0\nchange score:\n  add 1\nshow score',
    options: { name: 'WorkerApp', kind: 'console', entry: 'main.patch' }
  }));
  assert.equal(response.ok, true);
  assert.equal(response.result.project.name, 'WorkerApp');
  assert.equal(response.result.ir.format, 'patch-ir');
  assert.equal(response.result.ast[1].kind, 'change');
  assert.doesNotThrow(() => structuredClone(response));
});

test('Studio worker protocol rejects incompatible versions in a structured error envelope', () => {
  const response = handleStudioWorkerRequest({
    protocol: PATCH_STUDIO_WORKER_PROTOCOL,
    version: '99',
    id: 'old-client',
    task: PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL,
    source: 'window "App":\n  text "Hello"',
    options: {}
  });
  assert.equal(response.ok, false);
  assert.equal(response.id, 'old-client');
  assert.equal(response.error.code, 'STUDIO_WORKER_PROTOCOL_VERSION');
  assert.match(response.error.message, /expected 0\.1/);
});

test('Studio worker protocol rejects task-specific option leakage', () => {
  assert.throws(
    () => createStudioWorkerRequest({
      id: 'bad-options',
      task: PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL,
      source: 'window "App":\n  text "Hello"',
      options: { name: 'not-a-design-option' }
    }),
    /not allowed for this task/
  );
});

test('Studio worker host delegates message events without owning UI state', () => {
  const listeners = new Map();
  const posted = [];
  const scope = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    postMessage(value) { posted.push(value); }
  };
  const uninstall = installStudioLanguageWorkerHost(scope);
  listeners.get('message')({
    data: createStudioWorkerRequest({
      id: 'host-1',
      task: PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL,
      source: 'window "App" as main:\n  text "Hello"'
    })
  });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].ok, true);
  assert.equal(posted[0].id, 'host-1');
  uninstall();
  assert.equal(listeners.has('message'), false);
});
