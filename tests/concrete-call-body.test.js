import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildConcreteCallBodyWitnesses } from '../src/concrete-call-body.js';

const source = fs.readFileSync(new URL('../examples/formal-callee-trace.patch', import.meta.url), 'utf8');

test('structured callee witness preserves sequence, static repeat and exact claimed effect trace', () => {
  const compiled = compile(source, { name: 'StructuredCalleeTrace' });
  const artifact = buildConcreteCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  assert.equal(artifact.format, 'patch-concrete-call-body');
  assert.equal(artifact.version, '0.1');
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
  assert.match(outer.reason, /body construct 'call' is outside beta\.28/);
});
