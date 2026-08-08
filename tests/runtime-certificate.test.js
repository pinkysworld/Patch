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

  assert.deepEqual(certificate.certified, ['reward']);
  assert.equal(certificate.observedEffects, 1);
  assert.equal(certificate.runtimeValidation.summary.effects, 1);
  assert.equal(certificate.runtimeValidation.occurrences[0].effect.operation, 'increase');
  assert.equal(certificate.runtimeValidation.occurrences[0].effect.amount, 8);
  assert.match(certificate.runtimeTraceSha256, /^[a-f0-9]{64}$/);
  assert.match(certificate.lean, /import PatchRuntime/);
  assert.match(certificate.lean, /checkSourceRuntimeEvidence runtime_reward_source runtime_reward_observed = true/);
  assert.match(certificate.lean, /List\.Forall₂ EffectRefines actualTrace formalTrace/);
  assert.match(certificate.lean, /lo := 8, hi := 8/);
  assert.match(certificate.lean, /lo := 0, hi := 10/);
});

test('runtime certificate rejects branch path correspondence until explicit witnesses are modeled', async () => {
  const source = `create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus

do reward(4)`;

  await assert.rejects(
    () => generateLeanRuntimeCertificate(source, { name: 'BranchReward' }),
    /linear runtime-correspondence subset/
  );
});

test('runtime certificate refuses multiple observed invocations of one linear protected recipe', async () => {
  const source = `${linearSource.replace('show score', '')}\ndo reward(1)`;
  await assert.rejects(
    () => generateLeanRuntimeCertificate(source, { name: 'RepeatedReward' }),
    /one observed invocation per protected linear recipe/
  );
});
