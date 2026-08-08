import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';

test('input changed exposes transient value without mutating persistent state by itself', () => {
  const source = `create text name = "before"

window "Hello":
  input name

when name changed:
  show value`;

  const runtime = new PatchInterpreter();
  const started = runtime.run(source);
  assert.equal(started.state.name, 'before');

  const changed = triggerWindowEvent(runtime, 'name', 'changed', { value: 'Mia' });
  assert.deepEqual(changed.output, ['Mia']);
  assert.equal(changed.state.name, 'before');
  assert.equal(changed.history.length, 0);
});

test('input changed persists only through an explicit semantic change', () => {
  const source = `create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value`;

  const runtime = new PatchInterpreter();
  runtime.run(source);
  const changed = triggerWindowEvent(runtime, 'name', 'changed', { value: 'Mia' });

  assert.equal(changed.state.name, 'Mia');
  assert.equal(changed.history.length, 1);
  assert.equal(changed.history[0].target, 'name');
  assert.equal(changed.history[0].before, '');
  assert.equal(changed.history[0].after, 'Mia');
  assert.equal(changed.history[0].cause[0].kind, 'event');
  assert.equal(changed.history[0].cause[0].control, 'name');
  assert.equal(changed.history[0].cause[0].event, 'changed');
  assert.equal(changed.ui[0].controls.find(control => control.type === 'input').value, 'Mia');
});

test('changed event requires an explicit transient value payload', () => {
  const source = `create text name = ""
window "Hello":
  input name
when name changed:
  show value`;
  const runtime = new PatchInterpreter();
  runtime.run(source);
  assert.throws(
    () => triggerWindowEvent(runtime, 'name', 'changed'),
    /needs an event-local value/
  );
});

test('shared Window preflight accepts input changed and still rejects unsupported pairs', () => {
  const supported = compile(`create text name = ""
window "Hello":
  input name
when name changed:
  change name:
    set = value`, { kind: 'window' });
  const summary = validateWindowRuntimeSupport(supported);
  assert.equal(summary.events, 1);

  const unsupported = compile(`window "Broken":
  button "Close" as close_button
when close_button changed:
  show 1`, { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(unsupported),
    /support 'clicked' on buttons and 'changed' on inputs/
  );
});
