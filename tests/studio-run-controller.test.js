import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  PATCH_STUDIO_RUN_CONTROLLER_VERSION,
  createStudioRunLifecycle
} from '../web/studio-run-controller.js';

test('Studio Run controller exposes a bounded versioned lifecycle surface', () => {
  assert.equal(PATCH_STUDIO_RUN_CONTROLLER_VERSION, '0.1');
  execFileSync(process.execPath, ['--check', 'web/studio-run-controller.js'], { stdio: 'pipe' });
  const source = fs.readFileSync('web/studio-run-controller.js', 'utf8');
  assert.doesNotMatch(source, /^const document\s*=/m);
  assert.doesNotMatch(source, /queueMicrotask\(install/);
});

test('Run lifecycle yields before compile execute and presentation', () => {
  const scheduled = [];
  const busy = [];
  const success = [];
  let compileCalls = 0;
  let runtimeCalls = 0;
  const ir = { version: 'test-ir' };

  const lifecycle = createStudioRunLifecycle({
    source: () => 'create number score = 0',
    projectOptions: () => ({ kind: 'console' }),
    schedule: callback => scheduled.push(callback),
    compileProgram(source, options) {
      compileCalls += 1;
      assert.equal(source, 'create number score = 0');
      assert.deepEqual(options, { kind: 'console' });
      return { ast: { type: 'program' }, ir };
    },
    createRuntime: () => ({
      runAst(ast) {
        runtimeCalls += 1;
        assert.deepEqual(ast, { type: 'program' });
        return { output: ['0'], ui: [] };
      }
    }),
    triggerEvent: () => ({ output: [], ui: [] }),
    onBusyChange: value => busy.push(value),
    onRunSuccess: (result, compiled) => success.push({ result, compiled })
  });

  assert.equal(lifecycle.run(), true);
  assert.equal(lifecycle.run(), false, 'a scheduled Run must not queue twice');
  assert.equal(lifecycle.running, true);
  assert.equal(compileCalls, 0);
  assert.equal(runtimeCalls, 0);
  assert.deepEqual(busy, [true]);
  assert.equal(scheduled.length, 1);

  scheduled.shift()();
  assert.equal(lifecycle.running, false);
  assert.equal(lifecycle.started, true);
  assert.equal(compileCalls, 1);
  assert.equal(runtimeCalls, 1);
  assert.deepEqual(busy, [true, false]);
  assert.equal(success.length, 1);
  assert.equal(lifecycle.takePendingIr(), ir);
  assert.equal(lifecycle.takePendingIr(), null);
});

test('Run lifecycle owns semantic Window event dispatch after startup', () => {
  const events = [];
  const presented = [];
  const runtime = { runAst: () => ({ output: [], ui: [{ id: 'main' }] }) };
  const lifecycle = createStudioRunLifecycle({
    source: () => 'window "Counter":',
    projectOptions: () => ({ kind: 'window' }),
    schedule: callback => callback(),
    compileProgram: () => ({ ast: {}, ir: {} }),
    createRuntime: () => runtime,
    triggerEvent(activeRuntime, control, event, payload) {
      assert.equal(activeRuntime, runtime);
      events.push({ control, event, payload });
      return { output: ['1'], ui: [{ id: 'main' }] };
    },
    onEventSuccess: result => presented.push(result)
  });

  assert.equal(lifecycle.trigger('add_button', 'clicked'), false, 'events must fail closed before Run');
  assert.equal(lifecycle.run(), true);
  assert.equal(lifecycle.trigger('add_button', 'clicked', { value: 1 }), true);
  assert.deepEqual(events, [{ control: 'add_button', event: 'clicked', payload: { value: 1 } }]);
  assert.deepEqual(presented[0].output, ['1']);
});

test('Run failure clears runtime and pending IR before later events', () => {
  const errors = [];
  const lifecycle = createStudioRunLifecycle({
    source: () => 'broken source',
    projectOptions: () => ({ kind: 'console' }),
    schedule: callback => callback(),
    compileProgram() { throw new Error('compile failed'); },
    createRuntime: () => ({ runAst: () => ({ output: [], ui: [] }) }),
    triggerEvent: () => { throw new Error('must not dispatch'); },
    onRunError: error => errors.push(error.message)
  });

  assert.equal(lifecycle.run(), true);
  assert.equal(lifecycle.started, false);
  assert.equal(lifecycle.takePendingIr(), null);
  assert.equal(lifecycle.trigger('button', 'clicked'), false);
  assert.deepEqual(errors, ['compile failed']);
});

test('playground delegates Run lifecycle and Window rendering to separate bounded modules', () => {
  const playground = fs.readFileSync('web/playground.js', 'utf8');
  const controller = fs.readFileSync('web/studio-run-controller.js', 'utf8');
  const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');

  assert.match(playground, /installStudioRunController\(\{/);
  assert.match(playground, /createStudioWindowRenderer\(\{ dispatch: trigger \}\)/);
  assert.match(playground, /studioWindowRenderer\.renderInitial\(appView, ui\)/);
  assert.match(playground, /studioWindowRenderer\.renderAfterEvent\(appView, ui\)/);
  assert.match(playground, /studioRunController\.trigger\(control, event, payload\)/);
  assert.match(playground, /studioRunController\.refreshIrView\(\)/);
  assert.doesNotMatch(playground, /function renderWindows\(/);
  assert.doesNotMatch(playground, /function renderRuntimeWindowsAfterEvent\(/);
  assert.doesNotMatch(playground, /new PatchInterpreter\(/);
  assert.doesNotMatch(playground, /triggerWindowEvent\(/);
  assert.doesNotMatch(playground, /function executeRunProject\(/);
  assert.match(controller, /setTimeout\(callback, 0\)/);
  assert.match(controller, /triggerWindowEvent/);
  assert.match(renderer, /PATCH_STUDIO_WINDOW_RENDERER_VERSION = '0\.2'/);
  assert.match(renderer, /function renderWindows\(/);
  assert.match(renderer, /function renderRuntimeWindowsAfterEvent\(/);
  assert.match(buildSite, /'studio-run-controller\.js'/);
  assert.match(buildSite, /'studio-window-renderer\.js'/);
  assert.match(sw, /'\.\/studio-run-controller\.js'/);
  assert.match(sw, /'\.\/studio-window-renderer\.js'/);
});