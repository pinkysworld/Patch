import test from 'node:test';
import assert from 'node:assert/strict';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';
import {
  validateDirectSemanticEffects,
  DirectEffectValidationError
} from '../src/direct-effect-validator.js';

async function validateProgram(source) {
  const { module, metadata, compiled } = compileToDirectWasm(source, { name: 'EffectValidation', kind: 'console' });
  assert.equal(WebAssembly.validate(module), true);
  const direct = await runDirectWasm(module, metadata);
  const validation = validateDirectSemanticEffects(compiled.ir, direct.trace);
  assert.equal(validation.ok, true);
  return { direct, validation, compiled };
}

test('independent validator reconstructs protected runtime increase and magnitude', async () => {
  const source = `create number score = 0\n\nallow reward:\n  score may increase up to 10\n\nmake reward(bonus number 0..5):\n  change score:\n    add bonus * 2\n\ndo reward(4)\nshow score`;
  const { validation } = await validateProgram(source);
  assert.equal(validation.summary.transitions, 1);
  assert.equal(validation.summary.effects, 1);
  assert.equal(validation.summary.protectedEffects, 1);
  assert.deepEqual(validation.occurrences[0].effect, {
    target: 'score',
    field: null,
    sourceOperation: 'add',
    operation: 'increase',
    amount: 8,
    rawAmount: 8,
    value: null,
    before: 0,
    after: 8,
    line: 8
  });
  assert.equal(validation.occurrences[0].signatureMatch.operation, 'increase');
  assert.deepEqual(validation.occurrences[0].signatureMatch.amountRange, { min: 0, max: 10 });
  assert.equal(validation.occurrences[0].capabilityMatch.maxAmount, 10);
});

test('validator derives decrease/increase direction from signed add/remove values', async () => {
  const source = `create number score = 10\nchange score:\n  add -3\nchange score:\n  remove -2\nshow score`;
  const { validation } = await validateProgram(source);
  assert.deepEqual(validation.occurrences.map(item => ({
    sourceOperation: item.effect.sourceOperation,
    operation: item.effect.operation,
    amount: item.effect.amount,
    before: item.effect.before,
    after: item.effect.after
  })), [
    { sourceOperation: 'add', operation: 'decrease', amount: 3, before: 10, after: 7 },
    { sourceOperation: 'remove', operation: 'increase', amount: 2, before: 7, after: 9 }
  ]);
});

test('validator preserves semantic set and clear identities independently of net direction', async () => {
  const source = `create number score = 10\nchange score:\n  set 20\nchange score:\n  clear\nshow score`;
  const { validation } = await validateProgram(source);
  assert.deepEqual(validation.occurrences.map(item => ({
    sourceOperation: item.effect.sourceOperation,
    operation: item.effect.operation,
    before: item.effect.before,
    after: item.effect.after
  })), [
    { sourceOperation: 'set', operation: 'set', before: 10, after: 20 },
    { sourceOperation: 'clear', operation: 'clear', before: 20, after: 0 }
  ]);
});

test('validator checks every operation effect within one multi-operation change block', async () => {
  const source = `create number score = 10\nchange score:\n  add 2\n  remove 1\n  set 20\nshow score`;
  const { direct, validation } = await validateProgram(source);
  assert.deepEqual(direct.trace, [{ target: 'score', before: 10, after: 20 }]);
  assert.deepEqual(validation.occurrences.map(item => item.effect.operation), ['increase', 'decrease', 'set']);
  assert.equal(validation.summary.transitions, 1);
  assert.equal(validation.summary.effects, 3);
});

test('validator attributes nested recipe runtime effects to the executing recipe signature', async () => {
  const source = `create number score = 0\n\nmake add_points(amount number 0..5):\n  change score:\n    add amount\n\nmake twice(amount number 0..5):\n  do add_points(amount)\n  do add_points(amount)\n\ndo twice(3)\nshow score`;
  const { validation } = await validateProgram(source);
  assert.deepEqual(validation.occurrences.map(item => item.scope), ['add_points', 'add_points']);
  assert.deepEqual(validation.occurrences.map(item => item.effect.amount), [3, 3]);
});

test('effect validation rejects a tampered static Change Signature even when Wasm trace is valid', async () => {
  const source = `create number score = 0\n\nmake reward(amount number 0..5):\n  change score:\n    add amount\n\ndo reward(4)`;
  const { module, metadata, compiled } = compileToDirectWasm(source, { name: 'BadSignature', kind: 'console' });
  const direct = await runDirectWasm(module, metadata);
  compiled.ir.changeSignatures.reward.changes = [];
  assert.throws(
    () => validateDirectSemanticEffects(compiled.ir, direct.trace),
    err => err instanceof DirectEffectValidationError && /not covered by Change Signature/.test(err.message)
  );
});

test('effect validation rejects a tampered capability that is narrower than observed runtime effect', async () => {
  const source = `create number score = 0\n\nallow reward:\n  score may increase up to 10\n\nmake reward(amount number 0..10):\n  change score:\n    add amount\n\ndo reward(8)`;
  const { module, metadata, compiled } = compileToDirectWasm(source, { name: 'BadCapability', kind: 'console' });
  const direct = await runDirectWasm(module, metadata);
  compiled.ir.changeCapabilities.reward[0].maxAmount = 5;
  assert.throws(
    () => validateDirectSemanticEffects(compiled.ir, direct.trace),
    err => err instanceof DirectEffectValidationError && /escapes Change Capability/.test(err.message)
  );
});

test('unprotected effects still require production Change Signature coverage', async () => {
  const source = `create number score = 0\nchange score:\n  add 4`;
  const { validation } = await validateProgram(source);
  assert.equal(validation.summary.unprotectedEffects, 1);
  assert.equal(validation.occurrences[0].protected, false);
  assert.equal(validation.occurrences[0].signatureMatch.operation, 'increase');
});
