import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { analyzeChangeSemantics } from '../src/change-analysis.js';
import { buildFormalCalls } from '../src/formal-calls.js';

function artifact(source) {
  const ast = parse(source);
  const analysis = analyzeChangeSemantics(ast);
  return buildFormalCalls(ast, analysis);
}

test('formal calls build a ranked acyclic recipe environment with fitted argument intervals', () => {
  const result = artifact(`create number score = 0

make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus number 0..5):
  do add_points(bonus)

make double_reward(bonus number 0..5):
  do reward(bonus)
  do reward(bonus)`);

  assert.equal(result.summary.unsupported, 0);
  assert.equal(result.entries.add_points.supported, true);
  assert.equal(result.entries.reward.supported, true);
  assert.equal(result.entries.double_reward.supported, true);
  assert.equal(result.entries.add_points.rank, 0);
  assert.equal(result.entries.reward.rank, 1);
  assert.equal(result.entries.double_reward.rank, 2);

  const rewardCall = result.entries.reward.body;
  assert.equal(rewardCall.kind, 'call');
  assert.equal(rewardCall.name, 'add_points');
  assert.equal(rewardCall.calleeRank, 0);
  assert.ok(Number.isInteger(rewardCall.line) && rewardCall.line > 0);
  assert.deepEqual(rewardCall.args, [
    { parameter: 'amount', range: { min: 0, max: 5 }, expr: { kind: 'var', name: 'bonus' } }
  ]);
  assert.deepEqual(result.entries.reward.signature, [
    { target: 'score', field: null, operation: 'increase', amountRange: { min: 0, max: 5 } }
  ]);
});

test('formal calls preserve branch/repeat structure while calls remain rank-decreasing', () => {
  const result = artifact(`create number score = 0

make tick(amount number 0..2):
  change score:
    add amount

make maybe_tick(amount number 0..2):
  if amount > 0:
    repeat 2:
      do tick(amount)`);

  assert.equal(result.entries.maybe_tick.supported, true);
  assert.equal(result.entries.maybe_tick.body.kind, 'branch');
  assert.equal(result.entries.maybe_tick.body.then.kind, 'repeat');
  assert.equal(result.entries.maybe_tick.body.then.count, 2);
  assert.equal(result.entries.maybe_tick.body.then.body.kind, 'call');
  assert.equal(result.entries.maybe_tick.body.then.body.calleeRank, 0);
});

test('formal calls reject an unbounded caller parameter used as a bounded callee argument', () => {
  const result = artifact(`create number score = 0

make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus):
  do add_points(bonus)`);

  assert.equal(result.entries.reward.supported, false);
  assert.match(result.entries.reward.reasons.join('\n'), /parameter 'bonus' has no safe integer range/);
  assert.match(result.entries.reward.reasons.join('\n'), /argument 1 .* formal integer range fragment/);
});

test('formal calls reject unknown callees explicitly', () => {
  const result = artifact(`make reward(bonus number 0..5):
  do missing(bonus)`);

  assert.equal(result.entries.reward.supported, false);
  assert.match(result.entries.reward.reasons.join('\n'), /unknown recipe 'missing'/);
});

test('formal calls reject recursive and cyclic recipe graphs', () => {
  const direct = artifact(`make loop(amount number 0..5):
  do loop(amount)`);
  assert.equal(direct.entries.loop.supported, false);
  assert.match(direct.entries.loop.reasons.join('\n'), /recursive\/cyclic call graph/);
  assert.match(direct.entries.loop.reasons.join('\n'), /not rank-decreasing/);

  const mutual = artifact(`make first(amount number 0..5):
  do second(amount)

make second(amount number 0..5):
  do first(amount)`);
  assert.equal(mutual.entries.first.supported, false);
  assert.equal(mutual.entries.second.supported, false);
  assert.match(mutual.entries.first.reasons.join('\n'), /recursive\/cyclic call graph/);
});

test('formal calls reject duplicate recipe declarations instead of allowing Map overwrite to hide them', () => {
  const source = `make reward(amount number 0..5):
  show amount

make reward(amount number 0..5):
  show amount`;
  const ast = parse(source);
  const analysis = analyzeChangeSemantics(ast);
  const result = buildFormalCalls(ast, analysis);

  assert.equal(result.entries.reward.supported, false);
  assert.match(result.entries.reward.reasons.join('\n'), /declared more than once/);
});
