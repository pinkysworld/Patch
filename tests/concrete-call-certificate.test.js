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

test('concrete call certificate emits Lean checks for exact nested binding, abstract refinement and direct callee effect composition', () => {
  const certificate = generateConcreteCallCertificate(source, { name: 'ConcreteCalls' });
  assert.match(certificate.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(certificate.certificateVersion, '0.2');
  assert.ok(certificate.certified.some(item => item.startsWith('double_reward->reward#')));
  assert.ok(certificate.certified.some(item => item.startsWith('reward->add_points#')));
  assert.equal(certificate.certifiedEffects.length, 2);
  assert.ok(certificate.certifiedEffects.every(item => item.startsWith('reward->add_points#')));
  assert.match(certificate.lean, /import PatchCallEffect/);
  assert.match(certificate.lean, /concreteCallBinding/);
  assert.match(certificate.lean, /concreteThroughAbstractBool/);
  assert.match(certificate.lean, /RangeExpr\.var "bonus"/);
  assert.match(certificate.lean, /RangeExpr\.var "amount"/);
  assert.match(certificate.lean, /evalBoundQuantitativeEffect/);
  assert.match(certificate.lean, /effectMemberBool/);
  assert.match(certificate.lean, /signatureCoversBool/);
  assert.match(certificate.lean, /checkedConcreteBoundEffectRefinesCallerSignature/);
  assert.match(certificate.lean, /RefinesSignature/);
  assert.match(certificate.lean, /native_decide/);
  assert.match(certificate.lean, /concreteCallBinding_sound/);
  assert.match(certificate.lean, /concreteThroughAbstractBool_sound/);
});

test('concrete call certificate rejects arithmetic call arguments until their exact encoder is added', () => {
  const arithmetic = `make leaf(amount number 0..10):
  show amount

make caller(bonus number 0..5):
  do leaf(bonus + 1)

do caller(4)`;
  assert.throws(
    () => generateConcreteCallCertificate(arithmetic, { name: 'ArithmeticConcreteCall' }),
    /variable pass-through arguments only/
  );
});
