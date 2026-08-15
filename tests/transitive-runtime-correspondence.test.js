import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTransitiveRuntimeCorrespondence } from '../src/transitive-runtime-correspondence.js';

const source = fs.readFileSync(new URL('../examples/formal-transitive-calls.patch', import.meta.url), 'utf8');
const mixedGuardSource = fs.readFileSync(new URL('../examples/formal-transitive-calls-mixed-guards.patch', import.meta.url), 'utf8');

test('validated direct-Wasm effects match the beta30 depth-2 frame-identified call-tree trace', async () => {
  const artifact = await buildTransitiveRuntimeCorrespondence(source, { name: 'TransitiveRuntime' });
  assert.equal(artifact.format, 'patch-transitive-runtime-correspondence');
  assert.equal(artifact.version, '0.2');
  assert.equal(artifact.invocationFrameVersion, '0.1');
  assert.equal(artifact.transitiveWitnessVersion, '0.2');
  assert.match(artifact.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(artifact.runtimeTraceSha256, /^[a-f0-9]{64}$/);
  assert.equal(artifact.runtimeValidation.ok, true);
  assert.equal(artifact.summary.runtimeTransitions, 2);
  assert.equal(artifact.summary.runtimeEffects, 2);
  assert.equal(artifact.summary.invocationFrames, 4);
  assert.equal(artifact.summary.supported, 2);
  assert.equal(artifact.summary.unsupported, 0);
  assert.equal(artifact.summary.maxCertifiedDepth, 2);

  const outer = artifact.correspondences.find(item => item.caller === 'caller' && item.callee === 'outer');
  assert.ok(outer);
  assert.equal(outer.supported, true);
  assert.equal(outer.nestedCallDepth, 2);
  assert.equal(outer.frameId, 1);
  assert.deepEqual(outer.frame, {
    frameId: 1,
    parentFrameId: 0,
    callerScope: 'caller',
    callee: 'outer',
    invocation: 1,
    depth: 1,
    line: 17,
    args: [2],
    bindings: [{ name: 'seed', value: 2 }],
    transitionStart: 0,
    transitionEndExclusive: 2
  });
  assert.deepEqual(outer.occurrenceIds, [0, 1]);
  assert.deepEqual(outer.occurrenceRange, { start: 0, endExclusive: 2 });
  assert.deepEqual(outer.scopes, ['leaf', 'middle']);
  assert.deepEqual(outer.observedEffects, [
    { target: 'score', field: null, operation: 'increase', amountRange: { min: 4, max: 4 } },
    { target: 'coins', field: null, operation: 'increase', amountRange: { min: 3, max: 3 } }
  ]);
  assert.deepEqual(outer.observedEffects, outer.beta30Trace);
  assert.deepEqual(outer.siteIds, [0, 1]);
  assert.deepEqual(outer.observedTransitions.map(item => [item.scope, item.frameIds, item.before, item.after]), [
    ['leaf', [0, 1, 2, 3], 0, 4],
    ['middle', [0, 1, 2], 0, 3]
  ]);
});

test('beta32 independently reconstructed frames disambiguate repeated identical call traces', async () => {
  const repeated = source.replace(
    /do caller\(1\)\r?\nshow score/,
    'do caller(1)\ndo caller(1)\nshow score'
  );
  assert.notEqual(repeated, source, 'repeated-call fixture must add a second concrete caller invocation');
  const artifact = await buildTransitiveRuntimeCorrespondence(repeated, { name: 'RepeatedTransitiveRuntime' });
  assert.equal(artifact.runtimeValidation.ok, true);
  assert.equal(artifact.summary.runtimeTransitions, 4);
  assert.equal(artifact.summary.runtimeEffects, 4);
  assert.equal(artifact.summary.invocationFrames, 8);
  assert.equal(artifact.summary.supported, 4);
  assert.equal(artifact.summary.unsupported, 0);
  assert.equal(artifact.summary.maxCertifiedDepth, 2);

  const outerCalls = artifact.correspondences
    .filter(item => item.caller === 'caller' && item.callee === 'outer')
    .sort((a, b) => a.invocation - b.invocation);
  assert.equal(outerCalls.length, 2);
  assert.deepEqual(outerCalls.map(item => [item.invocation, item.frameId, item.frame.parentFrameId, item.frame.bindings]), [
    [1, 1, 0, [{ name: 'seed', value: 2 }]],
    [2, 5, 4, [{ name: 'seed', value: 2 }]]
  ]);
  assert.deepEqual(outerCalls.map(item => item.occurrenceIds), [[0, 1], [2, 3]]);
  assert.deepEqual(outerCalls.map(item => item.scopes), [['leaf', 'middle'], ['leaf', 'middle']]);
  assert.deepEqual(outerCalls[0].observedEffects, outerCalls[1].observedEffects);
});

test('beta32 invocation frames preserve mixed guard paths across repeated root calls', async () => {
  const artifact = await buildTransitiveRuntimeCorrespondence(mixedGuardSource, { name: 'MixedGuardTransitiveRuntime' });
  assert.equal(artifact.runtimeValidation.ok, true);
  assert.equal(artifact.summary.runtimeTransitions, 3);
  assert.equal(artifact.summary.runtimeEffects, 3);
  assert.equal(artifact.summary.invocationFrames, 9);
  assert.equal(artifact.summary.supported, 6);
  assert.equal(artifact.summary.unsupported, 0);
  assert.equal(artifact.summary.maxCertifiedDepth, 2);

  const outerCalls = artifact.correspondences
    .filter(item => item.caller === 'caller' && item.callee === 'outer')
    .sort((a, b) => a.invocation - b.invocation);
  assert.equal(outerCalls.length, 3);
  assert.deepEqual(outerCalls.map(item => item.invocation), [1, 2, 3]);
  assert.equal(new Set(outerCalls.map(item => item.frameId)).size, 3);
  assert.deepEqual(outerCalls.map(item => item.frame.bindings), [
    [{ name: 'seed', value: 1 }],
    [{ name: 'seed', value: 4 }],
    [{ name: 'seed', value: 1 }]
  ]);
  assert.deepEqual(outerCalls.map(item => item.occurrenceIds), [[0], [1], [2]]);
  assert.deepEqual(outerCalls.map(item => item.scopes), [['leaf'], ['leaf'], ['leaf']]);
  assert.deepEqual(outerCalls.map(item => item.observedEffects), [
    [{ target: 'coins', field: null, operation: 'increase', amountRange: { min: 4, max: 4 } }],
    [{ target: 'score', field: null, operation: 'increase', amountRange: { min: 5, max: 5 } }],
    [{ target: 'coins', field: null, operation: 'increase', amountRange: { min: 4, max: 4 } }]
  ]);
  assert.deepEqual(outerCalls[0].observedEffects, outerCalls[0].beta30Trace);
  assert.deepEqual(outerCalls[1].observedEffects, outerCalls[1].beta30Trace);
  assert.deepEqual(outerCalls[2].observedEffects, outerCalls[2].beta30Trace);
  assert.deepEqual(outerCalls[0].observedEffects, outerCalls[2].observedEffects);
  assert.notDeepEqual(outerCalls[0].observedEffects, outerCalls[1].observedEffects);
});
