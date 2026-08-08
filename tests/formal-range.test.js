import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFormalRangeExpression } from '../src/formal-range.js';
import { compile } from '../src/compiler.js';

test('formal range extractor models ranged variable times non-negative integer constant', () => {
  const result = buildFormalRangeExpression('bonus * 2', { bonus: { min: 0, max: 5 } });
  assert.equal(result.supported, true);
  assert.deepEqual(result.expr, { kind: 'scale', factor: 2, expr: { kind: 'var', name: 'bonus' } });
  assert.deepEqual(result.range, { min: 0, max: 10 });
  assert.deepEqual(result.bindings, { bonus: { min: 0, max: 5 } });
});

test('formal range extractor handles integer add subtract negate and parentheses', () => {
  const result = buildFormalRangeExpression('-(bonus - 1) + 3', { bonus: { min: 0, max: 5 } });
  assert.equal(result.supported, true);
  assert.deepEqual(result.range, { min: -1, max: 4 });
});

test('formal range extractor rejects division even when production range analysis supports it', () => {
  const result = buildFormalRangeExpression('bonus / 2', { bonus: { min: 0, max: 10 } });
  assert.equal(result.supported, false);
  assert.match(result.reason, /division/);
});

test('formal range extractor rejects general variable multiplication', () => {
  const result = buildFormalRangeExpression('bonus * factor', {
    bonus: { min: 0, max: 5 },
    factor: { min: 1, max: 2 }
  });
  assert.equal(result.supported, false);
  assert.match(result.reason, /general multiplication/);
});

test('compiler records formal range claim separately from production range result', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player, bonus number 0..5):\n  change player:\n    add bonus * 2 to score`;
  const { ir } = compile(source);
  assert.equal(ir.formalSource.entries.reward.supported, true);
  assert.equal(ir.formalSource.entries.reward.rangeClaims.length, 1);
  const claim = ir.formalSource.entries.reward.rangeClaims[0];
  assert.equal(claim.expression, 'bonus * 2');
  assert.deepEqual(claim.range, { min: 0, max: 10 });
  assert.deepEqual(claim.expr, { kind: 'scale', factor: 2, expr: { kind: 'var', name: 'bonus' } });
  assert.deepEqual(ir.changeSignatures.reward.changes[0].amountRange, { min: 0, max: 10 });
});

test('formal certification boundary refuses arithmetic outside verified range fragment', () => {
  const source = `allow reward:\n  player.score may increase up to 5\n\nmake reward(player, bonus number 0..10):\n  change player:\n    add bonus / 2 to score`;
  const { ir } = compile(source);
  assert.equal(ir.formalSource.entries.reward.supported, false);
  assert.ok(ir.formalSource.entries.reward.reasons.some(reason => reason.includes('division')));
});
