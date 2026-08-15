import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateTransitiveRuntimeCertificate } from '../src/transitive-runtime-certificate.js';

const source = fs.readFileSync(new URL('../examples/formal-transitive-calls.patch', import.meta.url), 'utf8');
const repeatedSource = fs.readFileSync(new URL('../examples/formal-transitive-calls-repeated.patch', import.meta.url), 'utf8');
const mixedGuardSource = fs.readFileSync(new URL('../examples/formal-transitive-calls-mixed-guards.patch', import.meta.url), 'utf8');

test('beta32 certificate binds an independently reconstructed invocation frame to the beta30 exact call tree', async () => {
  const certificate = await generateTransitiveRuntimeCertificate(source, { name: 'TransitiveRuntime' });
  assert.equal(certificate.certificateVersion, '0.2');
  assert.equal(certificate.correspondenceVersion, '0.2');
  assert.equal(certificate.invocationFrameVersion, '0.1');
  assert.ok(certificate.certified.some(item => item.startsWith('caller->outer#') && item.endsWith('@depth2')));
  assert.match(certificate.lean, /import PatchCallRuntime/);
  assert.match(certificate.lean, /namespace PatchGeneratedTransitiveCallBodyCertificate/);
  assert.match(certificate.lean, /namespace PatchGeneratedTransitiveRuntimeCertificate/);
  assert.match(certificate.lean, /runtime_caller_outer_1_observed/);
  assert.match(certificate.lean, /runtime_caller_outer_1_scopes : List String := \["leaf", "middle"\]/);
  assert.match(certificate.lean, /runtime_caller_outer_1_siteIds : List Nat := \[0, 1\]/);
  assert.match(certificate.lean, /runtime_caller_outer_1_frameBindings : BindingList/);
  assert.match(certificate.lean, /runtime_caller_outer_1_frame_binding_checked/);
  assert.match(certificate.lean, /runtime_caller_outer_1_frameBindings = caller_outer_1_bindings/);
  assert.match(certificate.lean, /evalCallTreeStmtEqBool caller_outer_1_bindings caller_outer_1_tree runtime_caller_outer_1_observed/);
  assert.match(certificate.lean, /checkedObservedTransitiveRuntimeRefinesCallerSignature/);
  assert.match(certificate.lean, /invocationFrameVersion/);
  assert.match(certificate.lean, /directWasmTraceSha256/);
  assert.match(certificate.lean, /target := "score"/);
  assert.match(certificate.lean, /target := "coins"/);
});

test('beta32 certificate generation distinguishes repeated identical invocation frames', async () => {
  const certificate = await generateTransitiveRuntimeCertificate(repeatedSource, { name: 'RepeatedTransitiveRuntime' });
  assert.equal(certificate.certificateVersion, '0.2');
  assert.equal(certificate.correspondenceVersion, '0.2');
  assert.ok(certificate.certified.includes('caller->outer#1@depth2'));
  assert.ok(certificate.certified.includes('caller->outer#2@depth2'));

  const outer = certificate.correspondences.filter(item => item.caller === 'caller' && item.callee === 'outer');
  assert.equal(outer.length, 2);
  assert.deepEqual(outer.map(item => item.frameId), [1, 5]);
  assert.deepEqual(outer.map(item => item.occurrenceIds), [[0, 1], [2, 3]]);
  assert.match(certificate.lean, /runtime_caller_outer_1_frame_binding_checked/);
  assert.match(certificate.lean, /runtime_caller_outer_2_frame_binding_checked/);
  assert.match(certificate.lean, /runtime_caller_outer_1_direct_wasm_refines_caller/);
  assert.match(certificate.lean, /runtime_caller_outer_2_direct_wasm_refines_caller/);
});

test('beta32 certificate proves mixed guard traces for repeated caller identities', async () => {
  const certificate = await generateTransitiveRuntimeCertificate(mixedGuardSource, { name: 'MixedGuardTransitiveRuntime' });
  assert.equal(certificate.certificateVersion, '0.2');
  assert.equal(certificate.correspondenceVersion, '0.2');
  assert.ok(certificate.certified.includes('caller->outer#1@depth2'));
  assert.ok(certificate.certified.includes('caller->outer#2@depth2'));
  assert.ok(certificate.certified.includes('caller->outer#3@depth2'));

  const outer = certificate.correspondences
    .filter(item => item.caller === 'caller' && item.callee === 'outer')
    .sort((a, b) => a.invocation - b.invocation);
  assert.equal(outer.length, 3);
  assert.equal(new Set(outer.map(item => item.frameId)).size, 3);
  assert.deepEqual(outer.map(item => item.observedEffects[0]?.target), ['coins', 'score', 'coins']);
  assert.deepEqual(outer.map(item => item.frame.bindings[0]?.value), [1, 4, 1]);
  assert.deepEqual(outer[0].observedEffects, outer[2].observedEffects);
  assert.notDeepEqual(outer[0].observedEffects, outer[1].observedEffects);

  for (const invocation of [1, 2, 3]) {
    assert.match(certificate.lean, new RegExp(`runtime_caller_outer_${invocation}_frame_binding_checked`));
    assert.match(certificate.lean, new RegExp(`runtime_caller_outer_${invocation}_call_tree_checked`));
    assert.match(certificate.lean, new RegExp(`runtime_caller_outer_${invocation}_direct_wasm_refines_caller`));
  }
  assert.match(certificate.lean, /target := "coins"/);
  assert.match(certificate.lean, /target := "score"/);
});
