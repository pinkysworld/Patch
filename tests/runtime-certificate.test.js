import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLeanRuntimeCertificate } from '../src/runtime-certificate.js';

const linearSource = `create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
show score`;

test('runtime certificate binds direct execution to guarded Lean correspondence and concrete capability evidence', async () => {
  const certificate = await generateLeanRuntimeCertificate(linearSource, { name: 'RuntimeReward' });

  assert.deepEqual(certificate.certified, ['reward#1']);
  assert.equal(certificate.certifiedInvocations, 1);
  assert.equal(certificate.observedEffects, 1);
  assert.equal(certificate.checkedGuardClaims, 0);
  assert.equal(certificate.runtimeValidation.summary.effects, 1);
  assert.equal(certificate.runtimeValidation.occurrences[0].effect.operation, 'increase');
  assert.equal(certificate.runtimeValidation.occurrences[0].effect.amount, 8);
  assert.match(certificate.runtimeTraceSha256, /^[a-f0-9]{64}$/);
  assert.equal(certificate.runtimePathWitnessVersion, '0.2');
  assert.equal(certificate.guardValidationVersion, '0.2');
  assert.equal(certificate.guardValidation.independentGuardExpressionVersion, '0.1');
  assert.match(certificate.lean, /import PatchGuarded/);
  assert.match(certificate.lean, /def guardValidationVersion : String := "0\.2"/);
  assert.match(certificate.lean, /checkGuardedSourceRuntimeEvidence runtime_reward_1_source runtime_reward_1_guard runtime_reward_1_env runtime_reward_1_observed runtime_reward_1_path = true/);
  assert.match(certificate.lean, /checkSourceProtected runtime_reward_1_source runtime_reward_1_policy = true/);
  assert.match(certificate.lean, /runtime_reward_1_guarded_concrete_policy_safe/);
  assert.match(certificate.lean, /checkedGuardedConcreteRuntimeCannotEscape/);
  assert.match(certificate.lean, /GuardTree\.leaf/);
  assert.match(certificate.lean, /RuntimePath\.leaf/);
  assert.match(certificate.lean, /TraceRefines actualTrace formalTrace/);
  assert.match(certificate.lean, /GuardPathValid runtime_reward_1_env/);
  assert.match(certificate.lean, /lo := 8, hi := 8/);
  assert.match(certificate.lean, /lo := 0, hi := 10/);
});

test('runtime certificate checks branch choices against concrete protected-recipe parameter environments', async () => {
  const source = `create number score = 0

allow reward:
  score may increase up to 5

make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus

do reward(4)
do reward(0)`;

  const certificate = await generateLeanRuntimeCertificate(source, { name: 'BranchReward' });
  assert.deepEqual(certificate.certified, ['reward#1', 'reward#2']);
  assert.equal(certificate.certifiedInvocations, 2);
  assert.equal(certificate.observedEffects, 1);
  assert.equal(certificate.checkedGuardClaims, 2);
  assert.deepEqual(certificate.runtimePathWitnesses.invocations.map(item => item.environment), [
    { bonus: 4 },
    { bonus: 0 }
  ]);
  assert.match(certificate.lean, /GuardExpr\.lt \(RangeExpr\.lit 0\) \(RangeExpr\.var "bonus"\)/);
  assert.match(certificate.lean, /RuntimePath\.branchThen/);
  assert.match(certificate.lean, /RuntimePath\.branchElse/);
  assert.match(certificate.lean, /def runtime_reward_1_env : IntEnv :=[\s\S]*name = "bonus" then some 4/);
  assert.match(certificate.lean, /def runtime_reward_2_env : IntEnv :=[\s\S]*name = "bonus" then some 0/);
  assert.match(certificate.lean, /runtime_reward_1_guarded_checked/);
  assert.match(certificate.lean, /runtime_reward_2_guarded_checked/);
  assert.match(certificate.lean, /runtime_reward_1_guarded_concrete_policy_safe/);
  assert.match(certificate.lean, /runtime_reward_2_guarded_concrete_policy_safe/);
});

test('runtime certificate models each literal repeat iteration as an explicit guard-aware path witness', async () => {
  const source = `create number score = 0

allow tick:
  score may increase up to 1

make tick():
  repeat 3:
    change score:
      add 1

do tick()`;

  const certificate = await generateLeanRuntimeCertificate(source, { name: 'RepeatTick' });
  assert.deepEqual(certificate.certified, ['tick#1']);
  assert.equal(certificate.observedEffects, 3);
  assert.equal(certificate.runtimeValidation.summary.effects, 3);
  assert.match(certificate.lean, /GuardTree\.repeat 3/);
  assert.match(certificate.lean, /RuntimePath\.repeatSucc/);
  assert.match(certificate.lean, /RuntimePath\.repeatZero/);
  assert.match(certificate.lean, /runtime_tick_1_guarded_concrete_policy_safe/);
});

test('runtime certificate refuses a protected policy with no observed protected invocation', async () => {
  const source = `create number score = 0

allow reward:
  score may increase up to 5

make reward(bonus number 0..5):
  change score:
    add bonus`;

  await assert.rejects(
    () => generateLeanRuntimeCertificate(source, { name: 'UnusedReward' }),
    /No protected recipe invocation was observed/
  );
});

test('runtime certificate rejects non-integer capability bounds at the Lean runtime-policy boundary', async () => {
  const source = `create number score = 0

allow reward:
  score may increase up to 1.5

make reward():
  change score:
    add 1

do reward()`;

  await assert.rejects(
    () => generateLeanRuntimeCertificate(source, { name: 'DecimalPolicy' }),
    /non-negative safe integer/
  );
});

test('runtime certificate rejects persistent-state branch guards outside the guard-aware parameter fragment', async () => {
  const source = `create number score = 1

allow reward:
  score may increase up to 5

make reward(bonus number 0..5):
  if score > 0:
    change score:
      add bonus

do reward(2)`;

  await assert.rejects(
    () => generateLeanRuntimeCertificate(source, { name: 'PersistentGuard' }),
    /outside the beta\.23 guard-aware fragment.*not a recipe parameter/
  );
});

test('runtime certificate rejects non-integer concrete values used by formal guards', async () => {
  const source = `create number score = 0

allow reward:
  score may increase up to 5

make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add 1

do reward(1.5)`;

  await assert.rejects(
    () => generateLeanRuntimeCertificate(source, { name: 'DecimalGuardValue' }),
    /Guard variable 'bonus'.*must be a safe integer/
  );
});
