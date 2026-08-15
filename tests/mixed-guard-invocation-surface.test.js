import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('mixed-guard invocation-frame evidence remains reproducible and reviewable', () => {
  const pkg = JSON.parse(read('package.json'));
  const example = read('examples/formal-transitive-calls-mixed-guards.patch');
  const workflow = read('.github/workflows/beta32-invocation-frames.yml');
  const reproWorkflow = read('.github/workflows/reproducibility-bundle.yml');
  const doc = read('docs/MIXED_GUARD_INVOCATION_FRAMES.md');
  const reproDoc = read('docs/REPRODUCIBILITY_BUNDLE.md');

  assert.equal(
    pkg.scripts?.['transitive-runtime-certify:mixed-guards'],
    'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls-mixed-guards.patch --out formal/GeneratedMixedGuardTransitiveRuntimeCertificate.lean'
  );

  for (const phrase of [
    'make leaf(amount number 1..5):',
    'if amount >= 3:',
    'make middle(seed number 0..4):',
    'make outer(seed number 0..4):',
    'make caller(seed number 0..4):',
    'do caller(1)\ndo caller(4)\ndo caller(1)'
  ]) assert.match(example, new RegExp(escapeRegExp(phrase)), phrase);

  for (const phrase of [
    'Execute mixed-guard repeated calls and generate beta32 frame certificate',
    'npm run transitive-runtime-certify:mixed-guards',
    'Verify generated beta32 mixed-guard invocation-frame certificate',
    'GeneratedMixedGuardTransitiveRuntimeCertificate.lean'
  ]) assert.match(workflow, new RegExp(escapeRegExp(phrase)), phrase);

  for (const phrase of [
    'Regenerate mixed-guard invocation-frame certificate',
    'formal/GeneratedMixedGuardTransitiveRuntimeCertificate.lean'
  ]) assert.match(reproWorkflow, new RegExp(escapeRegExp(phrase)), phrase);

  for (const phrase of [
    'twelve concrete invocation frames',
    'six transitive runtime correspondences',
    'coins +4',
    'score +5',
    'runtime transition capture',
    'does **not** establish end-to-end compiler correctness'
  ]) assert.match(doc, new RegExp(escapeRegExp(phrase), 'i'), phrase);

  assert.match(reproDoc, /transitive-runtime-certify:mixed-guards/);
  assert.match(reproDoc, /GeneratedMixedGuardTransitiveRuntimeCertificate\.lean/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
