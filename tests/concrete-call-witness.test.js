import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildConcreteCallWitnesses } from '../src/concrete-call-witness.js';

const source = `create number score = 0

make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus number 0..5):
  do add_points(bonus)

make double_reward(bonus number 0..5):
  do reward(bonus)
  do reward(bonus)

do double_reward(4)
show score`;

test('concrete call witnesses evaluate and bind a transitive recipe call chain', () => {
  const compiled = compile(source, { name: 'ConcreteCalls' });
  const artifact = buildConcreteCallWitnesses(compiled.ast, compiled.ir.formalCalls);

  assert.equal(artifact.format, 'patch-concrete-call-witness');
  assert.equal(artifact.version, '0.1');
  assert.equal(artifact.summary.calls, 5);

  const root = artifact.witnesses[0];
  assert.equal(root.caller, '$program');
  assert.equal(root.callee, 'double_reward');
  assert.deepEqual(root.concreteValues, [4]);
  assert.deepEqual(root.expectedCalleeEnv, [{ name: 'bonus', value: 4 }]);
  assert.equal(root.abstractArgRanges, null);

  const nestedReward = artifact.witnesses.find(item => item.caller === 'double_reward' && item.callee === 'reward');
  assert.ok(nestedReward);
  assert.deepEqual(nestedReward.callerEnv, [{ name: 'bonus', value: 4 }]);
  assert.deepEqual(nestedReward.concreteValues, [4]);
  assert.deepEqual(nestedReward.expectedCalleeEnv, [{ name: 'bonus', value: 4 }]);
  assert.deepEqual(nestedReward.abstractArgRanges, [{ min: 0, max: 5 }]);

  const leaf = artifact.witnesses.find(item => item.caller === 'reward' && item.callee === 'add_points');
  assert.ok(leaf);
  assert.deepEqual(leaf.callerEnv, [{ name: 'bonus', value: 4 }]);
  assert.deepEqual(leaf.concreteValues, [4]);
  assert.deepEqual(leaf.expectedCalleeEnv, [{ name: 'amount', value: 4 }]);
  assert.deepEqual(leaf.abstractArgRanges, [{ min: 0, max: 5 }]);
});

test('out-of-range concrete calls are rejected no later than the compiler boundary', () => {
  const bad = `make reward(bonus number 0..5):
  show bonus

do reward(9)`;
  assert.throws(
    () => {
      const compiled = compile(bad, { name: 'BadConcreteCall' });
      buildConcreteCallWitnesses(compiled.ast, compiled.ir.formalCalls);
    },
    /outside its declared range 0\.\.5|value 9 is outside 'reward\.bonus' range 0\.\.5/
  );
});

test('concrete call witness generation follows concrete branch choice for nested calls', () => {
  const branchSource = `make positive(amount number 0..5):
  show amount

make zero(amount number 0..5):
  show amount

make choose(amount number 0..5):
  if amount > 0:
    do positive(amount)
  else:
    do zero(amount)

do choose(4)`;
  const compiled = compile(branchSource, { name: 'ConcreteBranchCall' });
  const artifact = buildConcreteCallWitnesses(compiled.ast, compiled.ir.formalCalls);
  assert.ok(artifact.witnesses.some(item => item.callee === 'positive'));
  assert.equal(artifact.witnesses.some(item => item.callee === 'zero'), false);
});

test('concrete binding certification rejects duplicate recipe parameter names explicitly', () => {
  const malformedAst = [
    {
      kind: 'function', name: 'duplicate', params: ['amount', 'amount'],
      paramRanges: { amount: { min: 0, max: 5 } }, body: [], line: 1
    },
    { kind: 'call', name: 'duplicate', args: ['1', '2'], line: 3 }
  ];
  assert.throws(
    () => buildConcreteCallWitnesses(malformedAst, { entries: {} }),
    /duplicate parameter names outside concrete binding certification/
  );
});
