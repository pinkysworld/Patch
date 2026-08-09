import test from 'node:test';
import assert from 'node:assert/strict';
import { generateConcreteCallCertificate } from '../src/concrete-call-certificate.js';

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

test('concrete call certificate preserves beta26 variable binding and direct callee effect composition', () => {
  const certificate = generateConcreteCallCertificate(source, { name: 'ConcreteCalls' });
  assert.match(certificate.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(certificate.certificateVersion, '0.3');
  assert.ok(certificate.certified.some(item => item.startsWith('double_reward->reward#')));
  assert.ok(certificate.certified.some(item => item.startsWith('reward->add_points#')));
  assert.equal(certificate.certifiedEffects.length, 2);
  assert.ok(certificate.certifiedEffects.every(item => item.startsWith('reward->add_points#')));
  assert.match(certificate.lean, /RangeExpr\.var "bonus"/);
  assert.match(certificate.lean, /RangeExpr\.var "amount"/);
  assert.match(certificate.lean, /checkedConcreteBoundEffectRefinesCallerSignature/);
  assert.match(certificate.lean, /concreteCallBinding_sound/);
  assert.match(certificate.lean, /concreteThroughAbstractBool_sound/);
});

test('beta27 certifies arithmetic call arguments and arithmetic direct leaf amounts', () => {
  const arithmetic = `create number score = 0

make leaf(amount number 1..6):
  change score:
    add amount * 2

make caller(bonus number 0..5):
  do leaf(bonus + 1)

do caller(4)
show score`;
  const certificate = generateConcreteCallCertificate(arithmetic, { name: 'ArithmeticConcreteCall' });
  assert.equal(certificate.certified.length, 1);
  assert.equal(certificate.certifiedEffects.length, 1);
  assert.match(certificate.certified[0], /^caller->leaf#/);
  assert.match(certificate.lean, /RangeExpr\.add \(RangeExpr\.var "bonus"\) \(RangeExpr\.lit 1\)/);
  assert.match(certificate.lean, /RangeExpr\.scale 2 \(RangeExpr\.var "amount"\)/);
  assert.match(certificate.lean, /amount := some \(\{ lo := 10, hi := 10/);
  assert.match(certificate.lean, /checkedConcreteBoundEffectRefinesCallerSignature/);
});

test('beta27 encodes subtraction and unary negation in exact call binding', () => {
  const arithmetic = `make leaf(amount number 0..5):
  show amount

make caller(bonus number 0..5):
  do leaf(-bonus + 5)

do caller(4)`;
  const certificate = generateConcreteCallCertificate(arithmetic, { name: 'NegatedConcreteCall' });
  assert.equal(certificate.certified.length, 1);
  assert.equal(certificate.certifiedEffects.length, 0);
  assert.match(certificate.lean, /RangeExpr\.add \(RangeExpr\.neg \(RangeExpr\.var "bonus"\)\) \(RangeExpr\.lit 5\)/);
  assert.match(certificate.lean, /\("amount", 1\)/);
});

test('concrete call certificate still rejects expressions outside the mechanized RangeExpr fragment', () => {
  const division = `make leaf(amount number 0..5):
  show amount

make caller(bonus number 0..5):
  do leaf(bonus / 2)

do caller(4)`;
  assert.throws(
    () => generateConcreteCallCertificate(division, { name: 'DivisionConcreteCall' }),
    /division is outside|formal integer expression fragment|formal call composition/
  );
});
