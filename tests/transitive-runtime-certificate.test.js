import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateTransitiveRuntimeCertificate } from '../src/transitive-runtime-certificate.js';

const source = fs.readFileSync(new URL('../examples/formal-transitive-calls.patch', import.meta.url), 'utf8');

test('beta31 certificate embeds beta30 proof and checks runtime-derived effects directly', async () => {
  const certificate = await generateTransitiveRuntimeCertificate(source, { name: 'TransitiveRuntime' });
  assert.equal(certificate.certificateVersion, '0.1');
  assert.equal(certificate.correspondenceVersion, '0.1');
  assert.ok(certificate.certified.some(item => item.startsWith('caller->outer#') && item.endsWith('@depth2')));
  assert.match(certificate.lean, /import PatchCallRuntime/);
  assert.match(certificate.lean, /namespace PatchGeneratedTransitiveCallBodyCertificate/);
  assert.match(certificate.lean, /namespace PatchGeneratedTransitiveRuntimeCertificate/);
  assert.match(certificate.lean, /runtime_caller_outer_1_observed/);
  assert.match(certificate.lean, /runtime_caller_outer_1_scopes : List String := \["leaf", "middle"\]/);
  assert.match(certificate.lean, /runtime_caller_outer_1_siteIds : List Nat := \[0, 1\]/);
  assert.match(certificate.lean, /evalCallTreeStmtEqBool caller_outer_1_bindings caller_outer_1_tree runtime_caller_outer_1_observed/);
  assert.match(certificate.lean, /checkedObservedTransitiveRuntimeRefinesCallerSignature/);
  assert.match(certificate.lean, /directWasmTraceSha256/);
  assert.match(certificate.lean, /target := "score"/);
  assert.match(certificate.lean, /target := "coins"/);
});

test('beta31 certificate generation refuses ambiguous repeated scoped traces', async () => {
  const ambiguous = source.replace(
    /do caller\(1\)\r?\nshow score/,
    'do caller(1)\ndo caller(1)\nshow score'
  );
  assert.notEqual(ambiguous, source, 'ambiguity fixture must add a second concrete caller invocation');
  await assert.rejects(
    () => generateTransitiveRuntimeCertificate(ambiguous, { name: 'AmbiguousTransitiveRuntime' }),
    /No unambiguous beta\.31|ambiguous/i
  );
});
