import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchInterpreter } from '../src/interpreter.js';
import { applySemanticOperations, composeChanges, invertChange } from '../src/change.js';

const SEED = 0x20260812;
const CASES = 240;

test('generated Change History sequences round-trip through inverse, undo and redo', () => {
  const random = xorshift32(SEED);
  for (let caseIndex = 0; caseIndex < CASES; caseIndex += 1) {
    const initial = integer(random, -25, 25);
    const count = integer(random, 1, 12);
    const operations = [];
    let expected = initial;

    for (let index = 0; index < count; index += 1) {
      const kind = integer(random, 0, 3);
      if (kind === 0) {
        const value = integer(random, 0, 12);
        operations.push({ source: `add ${value}`, apply: current => current + value });
      } else if (kind === 1) {
        const value = integer(random, 0, 12);
        operations.push({ source: `remove ${value}`, apply: current => current - value });
      } else if (kind === 2) {
        const value = integer(random, -30, 30);
        operations.push({ source: `set = ${value}`, apply: () => value });
      } else {
        operations.push({ source: 'clear', apply: () => 0 });
      }
      expected = operations.at(-1).apply(expected);
    }

    const source = buildUndoRedoProgram(initial, operations);
    let result;
    try {
      result = new PatchInterpreter().run(source);
    } catch (error) {
      assert.fail(`seed=${SEED} case=${caseIndex}\n${source}\n${error.stack ?? error}`);
    }

    assert.deepEqual(result.output, [String(expected), String(initial), String(expected)], `seed=${SEED} case=${caseIndex}`);
    assert.equal(result.state.x, expected, `seed=${SEED} case=${caseIndex}`);
    assert.equal(result.history.length, operations.length, `seed=${SEED} case=${caseIndex}`);

    for (const change of result.history) {
      assert.deepEqual(
        applySemanticOperations(change.before, change.operations),
        change.after,
        `forward semantics seed=${SEED} case=${caseIndex} change=${change.id}`
      );
      assert.deepEqual(
        applySemanticOperations(change.after, change.inverseOperations),
        change.before,
        `stored inverse seed=${SEED} case=${caseIndex} change=${change.id}`
      );
      const inverse = invertChange(change);
      assert.deepEqual(
        applySemanticOperations(inverse.before, inverse.operations),
        inverse.after,
        `invertChange seed=${SEED} case=${caseIndex} change=${change.id}`
      );
    }

    let composed = result.history[0];
    for (const change of result.history.slice(1)) composed = composeChanges(composed, change);
    assert.equal(composed.before, initial, `composed before seed=${SEED} case=${caseIndex}`);
    assert.equal(composed.after, expected, `composed after seed=${SEED} case=${caseIndex}`);
    assert.equal(applySemanticOperations(composed.before, composed.operations), expected, `composed forward seed=${SEED} case=${caseIndex}`);
    assert.equal(applySemanticOperations(composed.after, composed.inverseOperations), initial, `composed inverse seed=${SEED} case=${caseIndex}`);
  }
});

test('a new committed change invalidates generated redo history', () => {
  const random = xorshift32(SEED ^ 0x5f3759df);
  for (let caseIndex = 0; caseIndex < 80; caseIndex += 1) {
    const initial = integer(random, -10, 10);
    const first = integer(random, 1, 9);
    const replacement = integer(random, -20, 20);
    const source = [
      `create number x = ${initial}`,
      'change x called first:',
      `  add ${first}`,
      'undo first',
      'change x called replacement:',
      `  set = ${replacement}`,
      'redo'
    ].join('\n');
    assert.throws(
      () => new PatchInterpreter().run(source),
      /There is nothing to redo/,
      `seed=${SEED} redo-invalidation case=${caseIndex}`
    );
  }
});

function buildUndoRedoProgram(initial, operations) {
  const lines = [`create number x = ${initial}`];
  operations.forEach((operation, index) => {
    lines.push(`change x called change_${index + 1}:`);
    lines.push(`  ${operation.source}`);
  });
  lines.push('show x');
  for (let index = 0; index < operations.length; index += 1) lines.push('undo');
  lines.push('show x');
  for (let index = 0; index < operations.length; index += 1) lines.push('redo');
  lines.push('show x');
  return lines.join('\n');
}

function xorshift32(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function integer(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}
