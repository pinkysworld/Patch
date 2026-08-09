import test from 'node:test';
import assert from 'node:assert/strict';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';
import { validateDirectSemanticEffects } from '../src/direct-effect-validator.js';

test('independent semantic-effect validation preserves concrete invocation-frame stacks', async () => {
  const source = `create number score = 0

make leaf(amount number 0..5):
  change score:
    add amount

make caller(amount number 0..5):
  do leaf(amount)

do caller(2)
do caller(2)`;
  const { module, metadata, compiled } = compileToDirectWasm(source, { name: 'FrameEffects', kind: 'console' });
  const execution = await runDirectWasm(module, metadata);
  const validation = validateDirectSemanticEffects(compiled.ir, execution.trace);

  assert.equal(validation.ok, true);
  assert.equal(validation.invocationFrameVersion, '0.1');
  assert.equal(validation.summary.invocationFrames, 4);
  assert.deepEqual(validation.invocationFrames.map(frame => [
    frame.frameId,
    frame.parentFrameId,
    frame.callerScope,
    frame.callee,
    frame.invocation,
    frame.transitionStart,
    frame.transitionEndExclusive
  ]), [
    [0, null, '$program', 'caller', 1, 0, 1],
    [1, 0, 'caller', 'leaf', 1, 0, 1],
    [2, null, '$program', 'caller', 2, 1, 2],
    [3, 2, 'caller', 'leaf', 2, 1, 2]
  ]);
  assert.deepEqual(validation.occurrences.map(item => item.frameIds), [[0, 1], [2, 3]]);
  assert.deepEqual(validation.occurrences.map(item => [item.scope, item.effect.operation, item.effect.amount]), [
    ['leaf', 'increase', 2],
    ['leaf', 'increase', 2]
  ]);
});
