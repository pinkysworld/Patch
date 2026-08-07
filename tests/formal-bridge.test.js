import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';

function entry(source, name) {
  return compile(source).ir.formalBridge.entries[name];
}

test('formal bridge matches production signature for direct semantic change', () => {
  const source = `make reward(player):\n  change player:\n    add 5 to score`;
  const bridged = entry(source, 'reward');
  assert.equal(bridged.supported, true);
  assert.equal(bridged.signatureMatchesProduction, true);
  assert.deepEqual(bridged.formalSignature, [{
    target: 'player',
    field: 'score',
    path: 'player.score',
    operation: 'increase',
    amountRange: { min: 5, max: 5 }
  }]);
});

test('formal bridge over-approximates both branches exactly as production analysis does', () => {
  const source = `make choose(player):\n  if true:\n    change player:\n      add 1 to score\n  else:\n    change player:\n      remove 1 from score`;
  const bridged = entry(source, 'choose');
  assert.equal(bridged.supported, true);
  assert.equal(bridged.signatureMatchesProduction, true);
  assert.equal(bridged.formalSignature.length, 2);
  assert.deepEqual(new Set(bridged.formalSignature.map(effect => effect.operation)), new Set(['increase', 'decrease']));
});

test('formal bridge treats literal repetition as repeated runtime effects with one static signature effect', () => {
  const source = `create number score = 0\nmake tick():\n  repeat 3:\n    change score:\n      add 1`;
  const bridged = entry(source, 'tick');
  assert.equal(bridged.supported, true);
  assert.equal(bridged.signatureMatchesProduction, true);
  assert.equal(bridged.core.kind, 'repeat');
  assert.equal(bridged.core.count, 3);
  assert.equal(bridged.formalSignature.length, 1);
});

test('formal bridge preserves a proven ranged semantic amount', () => {
  const source = `make reward(player, bonus number 0..10):\n  change player:\n    add bonus to score`;
  const bridged = entry(source, 'reward');
  assert.equal(bridged.supported, true);
  assert.equal(bridged.signatureMatchesProduction, true);
  assert.deepEqual(bridged.formalSignature[0].amountRange, { min: 0, max: 10 });
});

test('formal bridge marks recipe calls unsupported instead of claiming verification', () => {
  const source = `make add_points(player):\n  change player:\n    add 1 to score\n\nmake reward(player):\n  do add_points(player)`;
  const bridged = entry(source, 'reward');
  assert.equal(bridged.supported, false);
  assert.equal(bridged.signatureMatchesProduction, false);
  assert.ok(bridged.reasons.some(reason => reason.includes('recipe calls')));
});

test('formal bridge marks dynamic repetition unsupported', () => {
  const source = `make tick(times):\n  repeat times:\n    change score:\n      add 1`;
  const bridged = entry(source, 'tick');
  assert.equal(bridged.supported, false);
  assert.ok(bridged.reasons.some(reason => reason.includes('dynamic repeat count')));
});

test('compiler embeds a zero-mismatch formal bridge summary', () => {
  const source = `create number score = 0\nchange score:\n  add 1\nshow score`;
  const { ir, formalBridge } = compile(source, { name: 'FormalCounter' });
  assert.equal(ir.version, '0.5');
  assert.equal(ir.formalBridge, formalBridge);
  assert.equal(formalBridge.format, 'patch-formal-bridge');
  assert.equal(formalBridge.summary.mismatches, 0);
  assert.equal(formalBridge.entries.$program.supported, true);
  assert.equal(formalBridge.entries.$program.signatureMatchesProduction, true);
});
