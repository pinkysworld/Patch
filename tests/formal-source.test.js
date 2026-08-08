import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';

test('compiler embeds source-core syntax separately from semantic formal bridge', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 5 to score`;
  const { ir } = compile(source);
  const sourceEntry = ir.formalSource.entries.reward;
  const bridgeEntry = ir.formalBridge.entries.reward;
  assert.equal(sourceEntry.supported, true);
  assert.equal(sourceEntry.source.kind, 'change');
  assert.equal(sourceEntry.source.change.operation, 'add');
  assert.deepEqual(sourceEntry.source.change.amountRange, { min: 5, max: 5 });
  assert.equal(bridgeEntry.core.kind, 'emit');
  assert.equal(bridgeEntry.core.effect.operation, 'increase');
});

test('formal source core preserves a negative add before Lean semantic normalization', () => {
  const source = `allow penalty:\n  player.score may decrease up to 5\n\nmake penalty(player):\n  change player:\n    add -5 to score`;
  const { ir } = compile(source);
  const sourceEntry = ir.formalSource.entries.penalty;
  const bridgeEntry = ir.formalBridge.entries.penalty;
  assert.equal(sourceEntry.supported, true);
  assert.equal(sourceEntry.source.change.operation, 'add');
  assert.deepEqual(sourceEntry.source.change.amountRange, { min: -5, max: -5 });
  assert.equal(bridgeEntry.core.effect.operation, 'decrease');
  assert.deepEqual(bridgeEntry.core.effect.amountRange, { min: 5, max: 5 });
});

test('formal source core preserves branch and bounded repeat structure', () => {
  const source = `allow reward:\n  score may increase up to 1\n\nmake reward():\n  if score > 0:\n    repeat 2:\n      change score:\n        add 1\n  else:\n    change score:\n      add 1`;
  const { ir } = compile(source);
  const entry = ir.formalSource.entries.reward;
  assert.equal(entry.supported, true);
  assert.equal(entry.source.kind, 'branch');
  assert.equal(entry.source.then.kind, 'repeat');
  assert.equal(entry.source.then.count, 2);
  assert.equal(entry.source.else.kind, 'change');
});

test('formal source core refuses mixed-sign amount ranges conservatively', () => {
  const source = `make maybe(player, delta number -2..2):\n  change player:\n    add delta to score`;
  const { ir } = compile(source);
  const entry = ir.formalSource.entries.maybe;
  assert.equal(entry.supported, false);
  assert.match(entry.reasons.join('\n'), /crosses zero/);
});
