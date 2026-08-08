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

test('runtime certificate binds direct execution to Lean runtime correspondence evidence', async () => {
  const certificate = await generateLeanRuntimeCertificate(linearSource, { name: 'RuntimeReward' });

  assert.deepEqual(certificate.certified, ['reward#1']);
  assert.equal(certificate.certifiedInvocations, 1);
  assert.equal(certificate.observedEffects, 1);
  assert.equal(certificate.runtimeValidation.summary.effects, 1);
  assert.equal(certificate.runtimeValidation.occurrences[0].effect.operation, 'increase');
  assert.equal(certificate.runtimeValidation.occurrences[0].effect.amount, 8);
  assert.match(certificate.runtimeTraceSha256, /^[a-f0-9]{64}$/);
  assert.match(certificate.lean, /import PatchRuntime/);
  assert.match(certificate.lean, /checkSourceRuntimeEvidence runtime_reward_1_source runtime_reward_1_observed runtime_reward_1_path = true/);
  assert.match(certificate.lean, /RuntimePath\.leaf/);
  assert.match(certificate.lean, /TraceRefines actualTrace formalTrace/);
  assert.match(certificate.lean, /lo := 8, hi := 8/);
  assert.match(certificate.lean, /lo := 0, hi := 10/);
});

test('runtime certificate models branch choices and multiple protected recipe invocations', async () => {
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
  assert.match(certificate.lean, /RuntimePath\.branchThen/);
  assert.match(certificate.lean, /RuntimePath\.branchElse/);
  assert.match(certificate.lean, /runtime_reward_1_checked/);
  assert.match(certificate.lean, /runtime_reward_2_checked/);
});

test('runtime certificate models each literal repeat iteration as an explicit path witness', async () => {
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
  assert.match(certificate.lean, /RuntimePath\.repeatSucc/);
  assert.match(certificate.lean, /RuntimePath\.repeatZero/);
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
