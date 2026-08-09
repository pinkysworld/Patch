import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildTransitiveCallBodyWitnesses } from '../src/transitive-call-body.js';

const source = fs.readFileSync(new URL('../examples/formal-transitive-calls.patch', import.meta.url), 'utf8');

test('transitive witness reconstructs two nested exact call levels without flattening them', () => {
  const compiled = compile(source, { name: 'TransitiveCalls' });
  const artifact = buildTransitiveCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  assert.equal(artifact.format, 'patch-transitive-call-body');
  assert.equal(artifact.version, '0.1');
  assert.equal(artifact.summary.unsupported, 0);
  assert.equal(artifact.summary.maxNestedCallDepth, 2);

  const outer = artifact.witnesses.find(item => item.caller === 'caller' && item.callee === 'outer');
  assert.ok(outer);
  assert.equal(outer.supported, true);
  assert.equal(outer.nestedCallDepth, 2);
  assert.deepEqual(outer.expectedCalleeEnv, [{ name: 'seed', value: 2 }]);
  assert.equal(outer.callTree.kind, 'call');
  assert.equal(outer.callTree.callee, 'middle');
  assert.deepEqual(outer.callTree.params, ['amount']);
  assert.deepEqual(outer.callTree.declared, [{ min: 1, max: 4 }]);
  assert.equal(outer.callTree.body.kind, 'seq');
  assert.equal(outer.callTree.body.first.kind, 'call');
  assert.equal(outer.callTree.body.first.callee, 'leaf');
  assert.deepEqual(outer.claimedTrace, [
    { target: 'score', field: null, operation: 'increase', amountRange: { min: 4, max: 4 } },
    { target: 'coins', field: null, operation: 'increase', amountRange: { min: 3, max: 3 } }
  ]);
});

test('transitive witness preserves shallower nested edges as exact witnesses too', () => {
  const compiled = compile(source, { name: 'TransitiveCalls' });
  const artifact = buildTransitiveCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  const middle = artifact.witnesses.find(item => item.caller === 'outer' && item.callee === 'middle');
  const leaf = artifact.witnesses.find(item => item.caller === 'middle' && item.callee === 'leaf');
  assert.ok(middle);
  assert.ok(leaf);
  assert.equal(middle.nestedCallDepth, 1);
  assert.equal(leaf.nestedCallDepth, 0);
  assert.deepEqual(middle.expectedCalleeEnv, [{ name: 'amount', value: 3 }]);
  assert.deepEqual(leaf.expectedCalleeEnv, [{ name: 'amount', value: 4 }]);
  assert.deepEqual(middle.claimedTrace, [
    { target: 'score', field: null, operation: 'increase', amountRange: { min: 4, max: 4 } },
    { target: 'coins', field: null, operation: 'increase', amountRange: { min: 3, max: 3 } }
  ]);
  assert.deepEqual(leaf.claimedTrace, [
    { target: 'score', field: null, operation: 'increase', amountRange: { min: 4, max: 4 } }
  ]);
});

test('transitive certification pipeline fails closed at the earliest range boundary', () => {
  const invalid = `create number score = 0

make leaf(amount number 1..2):
  change score:
    add amount

make outer(seed number 0..3):
  do leaf(seed + 1)

make caller(seed number 0..2):
  do outer(seed + 1)

do caller(1)`;
  assert.throws(
    () => compile(invalid, { name: 'InvalidTransitiveFit' }),
    /outside its declared range|outside formalCalls support|fit|range|argument|interval/i
  );
});
