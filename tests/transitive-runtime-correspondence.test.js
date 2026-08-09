import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTransitiveRuntimeCorrespondence } from '../src/transitive-runtime-correspondence.js';

const source = fs.readFileSync(new URL('../examples/formal-transitive-calls.patch', import.meta.url), 'utf8');

test('validated direct-Wasm effects match the beta30 depth-2 scoped call-tree trace', async () => {
  const artifact = await buildTransitiveRuntimeCorrespondence(source, { name: 'TransitiveRuntime' });
  assert.equal(artifact.format, 'patch-transitive-runtime-correspondence');
  assert.equal(artifact.version, '0.1');
  assert.equal(artifact.transitiveWitnessVersion, '0.2');
  assert.match(artifact.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(artifact.runtimeTraceSha256, /^[a-f0-9]{64}$/);
  assert.equal(artifact.runtimeValidation.ok, true);
  assert.equal(artifact.summary.runtimeTransitions, 2);
  assert.equal(artifact.summary.runtimeEffects, 2);
  assert.equal(artifact.summary.supported, 2);
  assert.equal(artifact.summary.unsupported, 0);
  assert.equal(artifact.summary.maxCertifiedDepth, 2);

  const outer = artifact.correspondences.find(item => item.caller === 'caller' && item.callee === 'outer');
  assert.ok(outer);
  assert.equal(outer.supported, true);
  assert.equal(outer.nestedCallDepth, 2);
  assert.deepEqual(outer.occurrenceRange, { start: 0, endExclusive: 2 });
  assert.deepEqual(outer.scopes, ['leaf', 'middle']);
  assert.deepEqual(outer.observedEffects, [
    { target: 'score', field: null, operation: 'increase', amountRange: { min: 4, max: 4 } },
    { target: 'coins', field: null, operation: 'increase', amountRange: { min: 3, max: 3 } }
  ]);
  assert.deepEqual(outer.observedEffects, outer.beta30Trace);
  assert.deepEqual(outer.siteIds, [0, 1]);
  assert.deepEqual(outer.observedTransitions.map(item => [item.scope, item.before, item.after]), [
    ['leaf', 0, 4],
    ['middle', 0, 3]
  ]);
});

test('beta31 fails closed when identical validated scoped traces are ambiguous', async () => {
  const ambiguous = source.replace('do caller(1)\nshow score', 'do caller(1)\ndo caller(1)\nshow score');
  const artifact = await buildTransitiveRuntimeCorrespondence(ambiguous, { name: 'AmbiguousTransitiveRuntime' });
  assert.equal(artifact.runtimeValidation.ok, true);
  assert.equal(artifact.summary.runtimeTransitions, 4);
  assert.equal(artifact.summary.runtimeEffects, 4);
  assert.equal(artifact.summary.supported, 0);
  assert.ok(artifact.summary.unsupported > 0);
  assert.ok(artifact.correspondences.every(item => !item.supported));
  assert.ok(artifact.correspondences.every(item => /ambiguous/.test(item.reason)));
});
