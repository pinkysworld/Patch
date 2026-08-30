import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { analyzeChangeSemantics } from '../src/change-analysis.js';
import {
  findObviousExcessAuthority,
  formatLeastAuthoritySuggestion,
  inferLeastAuthority
} from '../src/least-authority.js';

function signatureFor(source, name) {
  return analyzeChangeSemantics(parse(source)).signatures[name];
}

test('least-authority inference derives target, direction and magnitude from normal simple code', () => {
  const signature = signatureFor(`create number score = 0\nmake reward(bonus number 0..5):\n  change score:\n    add bonus * 2`, 'reward');
  const inference = inferLeastAuthority(signature);

  assert.equal(inference.complete, true);
  assert.deepEqual(inference.rules, [{
    target: 'score',
    field: null,
    operation: 'increase',
    maxAmount: 10,
    magnitudeKnown: true,
    paths: ['score']
  }]);
  assert.equal(formatLeastAuthoritySuggestion('reward', inference), `allow reward:\n  score may increase up to 10`);
});

test('least-authority inference remains useful without forcing beginners to declare a bound', () => {
  const signature = signatureFor(`create number score = 0\nmake reward(bonus):\n  change score:\n    add bonus`, 'reward');
  const inference = inferLeastAuthority(signature);

  assert.equal(inference.complete, true);
  assert.equal(inference.rules[0].operation, 'add');
  assert.equal(inference.rules[0].maxAmount, null);
  assert.equal(inference.rules[0].magnitudeKnown, false);
  assert.equal(inference.hasUnboundedQuantitativeRule, true);
});

test('least-authority inference fails closed on unknown call targets', () => {
  const signature = signatureFor(`make risky():\n  do mystery()`, 'risky');
  const inference = inferLeastAuthority(signature);

  assert.equal(inference.complete, false);
  assert.equal(inference.rules.length, 0);
  assert.match(inference.reasons[0], /Cannot infer trusted authority/);
});

test('excess-authority analysis finds unused operations and oversized bounds', () => {
  const inference = inferLeastAuthority(signatureFor(`create number score = 0\nmake reward(bonus number 0..5):\n  change score:\n    add bonus * 2`, 'reward'));
  const findings = findObviousExcessAuthority([
    { target: 'score', field: null, operation: 'increase', maxAmount: 1000 },
    { target: 'score', field: null, operation: 'set', maxAmount: null },
    { target: 'credits', field: null, operation: 'increase', maxAmount: 500 }
  ], inference);

  assert.deepEqual(findings, [
    { kind: 'excess-magnitude', path: 'score', operation: 'increase', declaredMax: 1000, requiredMax: 10 },
    { kind: 'unused-rule', path: 'score', operation: 'set', declaredMax: null, requiredMax: null },
    { kind: 'unused-rule', path: 'credits', operation: 'increase', declaredMax: 500, requiredMax: null }
  ]);
});
