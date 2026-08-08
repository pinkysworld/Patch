import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFormalGuardExpression } from '../src/formal-guard.js';

const vars = new Set(['bonus', 'limit']);

test('formal guard extracts a parameter comparison', () => {
  const guard = buildFormalGuardExpression('bonus > 0', vars);
  assert.equal(guard.supported, true);
  assert.deepEqual(guard.variables, ['bonus']);
  assert.deepEqual(guard.expr, {
    kind: 'lt',
    left: { kind: 'lit', value: 0 },
    right: { kind: 'var', name: 'bonus' }
  });
});

test('formal guard preserves boolean composition and arithmetic scale', () => {
  const guard = buildFormalGuardExpression('bonus * 2 <= limit and not (bonus == 0)', vars);
  assert.equal(guard.supported, true);
  assert.deepEqual(guard.variables, ['bonus', 'limit']);
  assert.equal(guard.expr.kind, 'and');
  assert.equal(guard.expr.left.kind, 'le');
  assert.equal(guard.expr.left.left.kind, 'scale');
  assert.equal(guard.expr.right.kind, 'not');
});

test('formal guard supports arithmetic parentheses in comparisons', () => {
  const guard = buildFormalGuardExpression('(bonus + 1) >= limit', vars);
  assert.equal(guard.supported, true);
  assert.equal(guard.expr.kind, 'le');
});

test('formal guard rejects persistent/global names outside recipe parameters', () => {
  const guard = buildFormalGuardExpression('score > 0', vars);
  assert.equal(guard.supported, false);
  assert.match(guard.reason, /not a recipe parameter/);
});

test('formal guard rejects general variable multiplication', () => {
  const guard = buildFormalGuardExpression('bonus * limit > 0', vars);
  assert.equal(guard.supported, false);
  assert.match(guard.reason, /non-negative integer literal operand/);
});

test('formal guard rejects division and decimal literals', () => {
  assert.equal(buildFormalGuardExpression('bonus / 2 > 0', vars).supported, false);
  assert.equal(buildFormalGuardExpression('bonus > 0.5', vars).supported, false);
});
