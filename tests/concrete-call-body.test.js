import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildConcreteCallBodyWitnesses } from '../src/concrete-call-body.js';

const source = fs.readFileSync(new URL('../examples/formal-callee-trace.patch', import.meta.url), 'utf8');
const guardedSource = fs.readFileSync(new URL('../examples/formal-callee-guard.patch', import.meta.url), 'utf8');

test('structured callee witness preserves sequence, static repeat and exact claimed effect trace', () => {
  const compiled = compile(source, { name: 'StructuredCalleeTrace' });
  const artifact = buildConcreteCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  assert.equal(artifact.format, 'patch-concrete-call-body');
  assert.equal(artifact.version, '0.2');
  assert.equal(artifact.summary.total, 1);
  assert.equal(artifact.summary.supported, 1);

  const witness = artifact.witnesses[0];
  assert.equal(witness.caller, 'caller');
  assert.equal(witness.callee, 'award');
  assert.equal(witness.supported, true);
  assert.deepEqual(witness.expectedCalleeEnv, [{ name: 'amount', value: 3 }]);
  assert.equal(witness.body.kind, 'seq');
  assert.equal(witness.body.first.kind, 'emit');
  assert.equal(witness.body.second.kind, 'repeat');
  assert.equal(witness.body.second.count, 2);
  assert.deepEqual(witness.claimedTrace, [
    { target: 'score', field: null, operation: 'increase', amountRange: { min: 3, max: 3 } },
    { target: 'coins', field: null, operation: 'increase', amountRange: { min: 6, max: 6 } },
    { target: 'coins', field: null, operation: 'increase', amountRange: { min: 6, max: 6 } }
  ]);
});

test('guard-aware callee witness selects then and else traces from exact parameter bindings', () => {
  const compiled = compile(guardedSource, { name: 'GuardedCalleeTrace' });
  const artifact = buildConcreteCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  assert.equal(artifact.version, '0.2');
  assert.equal(artifact.summary.total, 2);
  assert.equal(artifact.summary.supported, 2);

  const high = artifact.witnesses.find(item => item.caller === 'caller_high');
  const low = artifact.witnesses.find(item => item.caller === 'caller_low');
  assert.ok(high);
  assert.ok(low);
  assert.equal(high.body.kind, 'branch');
  assert.equal(low.body.kind, 'branch');
  assert.equal(high.body.guard.kind, 'le');
  assert.equal(low.body.guard.kind, 'le');
  assert.deepEqual(high.expectedCalleeEnv, [{ name: 'amount', value: 3 }]);
  assert.deepEqual(low.expectedCalleeEnv, [{ name: 'amount', value: 1 }]);
  assert.deepEqual(high.claimedTrace, [
    { target: 'score', field: null, operation: 'increase', amountRange: { min: 3, max: 3 } }
  ]);
  assert.deepEqual(low.claimedTrace, [
    { target: 'coins', field: null, operation: 'increase', amountRange: { min: 2, max: 2 } }
  ]);

  for (const witness of [high, low]) {
    const signatureTargets = new Set(witness.calleeSignature.map(effect => effect.target));
    assert.ok(signatureTargets.has('score'));
    assert.ok(signatureTargets.has('coins'));
  }
});

test('guard-aware callee witness rejects state-dependent branch variables before certification', () => {
  const stateGuard = `create number threshold = 3
create number score = 0

make award(amount number 1..5):
  if amount >= threshold:
    change score:
      add amount

make caller(bonus number 0..4):
  do award(bonus + 1)

do caller(2)`;
  const compiled = compile(stateGuard, { name: 'StateGuardUnsupported' });
  assert.throws(
    () => buildConcreteCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls),
    /cannot find 'threshold'|not a recipe parameter/i
  );
});

test('structured callee witness rejects nested recipe calls instead of flattening them', () => {
  const nested = `make leaf(amount number 0..5):
  change score:
    add amount

make outer(amount number 0..5):
  do leaf(amount)

make caller(amount number 0..5):
  do outer(amount)

do caller(2)`;
  const compiled = compile(nested, { name: 'NestedUnsupported' });
  const artifact = buildConcreteCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  const outer = artifact.witnesses.find(item => item.callee === 'outer');
  assert.ok(outer);
  assert.equal(outer.supported, false);
  assert.match(outer.reason, /body construct 'call' is outside beta\.29/);
});
