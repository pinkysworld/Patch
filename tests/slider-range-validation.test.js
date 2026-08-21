import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';

const source = `create number level = 5
window "Level":
  slider -10..10 as level step 0.5
when level changed:
  change level:
    set = value
`;

test('shared Window event adapter rejects Slider values outside the declared range', () => {
  const runtime = new PatchInterpreter();
  runtime.run(source);
  assert.throws(() => triggerWindowEvent(runtime, 'level', 'changed', { value: -10.5 }), /value from -10 to 10/);
  assert.throws(() => triggerWindowEvent(runtime, 'level', 'changed', { value: 10.5 }), /value from -10 to 10/);
  assert.equal(runtime.result().state.level, 5);
  assert.equal(runtime.result().history.length, 0);
});

test('shared Window event adapter accepts bounded decimal Slider values', () => {
  const runtime = new PatchInterpreter();
  runtime.run(source);
  const result = triggerWindowEvent(runtime, 'level', 'changed', { value: -2.5 });
  assert.equal(result.state.level, -2.5);
  assert.equal(result.history.length, 1);
});
