import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLeanCallCertificate } from '../src/call-certificate.js';

const acyclicSource = `create number score = 0

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

test('call certificate emits a finite ranked RecipeEnv checked by PatchCalls', () => {
  const certificate = generateLeanCallCertificate(acyclicSource, { name: 'FormalCalls' });

  assert.equal(certificate.environmentSize, 3);
  assert.deepEqual(certificate.certifiedRecipes, ['add_points', 'double_reward', 'reward']);
  assert.match(certificate.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(certificate.formalCalls.entries.add_points.rank, 0);
  assert.equal(certificate.formalCalls.entries.reward.rank, 1);
  assert.equal(certificate.formalCalls.entries.double_reward.rank, 2);
  assert.match(certificate.lean, /import PatchCalls/);
  assert.match(certificate.lean, /def callEnv : RecipeEnv/);
  assert.match(certificate.lean, /checkRecipeEnv callEnv = true/);
  assert.match(certificate.lean, /native_decide/);
  assert.match(certificate.lean, /checkRecipeEnv_sound callEnvChecked/);
  assert.match(certificate.lean, /CallStmt\.call "add_points"/);
  assert.match(certificate.lean, /CallStmt\.call "reward"/);
  assert.match(certificate.lean, /rank := 2/);
});

test('call certificate refuses cyclic environments before emitting a misleading certificate', () => {
  const source = `make first(amount number 0..5):
  do second(amount)

make second(amount number 0..5):
  do first(amount)`;

  assert.throws(
    () => generateLeanCallCertificate(source, { name: 'CyclicCalls' }),
    /fully supported finite recipe environment.*recursive\/cyclic call graph/
  );
});

test('call certificate refuses unbounded parameters at the formal call boundary', () => {
  const source = `create number score = 0

make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus):
  do add_points(bonus)`;

  assert.throws(
    () => generateLeanCallCertificate(source, { name: 'UnboundedCalls' }),
    /fully supported finite recipe environment.*no safe integer range/
  );
});
