import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateConcreteCallBodyCertificate } from '../src/concrete-call-body-certificate.js';

const source = fs.readFileSync(new URL('../examples/formal-callee-trace.patch', import.meta.url), 'utf8');
const guardedSource = fs.readFileSync(new URL('../examples/formal-callee-guard.patch', import.meta.url), 'utf8');

test('structured callee certificate preserves beta.28 exact multi-effect trace and caller signature import', () => {
  const certificate = generateConcreteCallBodyCertificate(source, { name: 'StructuredCalleeTrace' });
  assert.equal(certificate.certificateVersion, '0.2');
  assert.deepEqual(certificate.certified, ['caller->award#1']);
  assert.match(certificate.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(certificate.lean, /import PatchCallBodyImport/);
  assert.match(certificate.lean, /BoundStmt\.seq/);
  assert.match(certificate.lean, /BoundStmt\.repeat 2/);
  assert.match(certificate.lean, /RangeExpr\.var "amount"/);
  assert.match(certificate.lean, /RangeExpr\.scale 2 \(RangeExpr\.var "amount"\)/);
  assert.match(certificate.lean, /amount := some \(\{ lo := 3, hi := 3/);
  assert.match(certificate.lean, /amount := some \(\{ lo := 6, hi := 6/);
  assert.match(certificate.lean, /evalBoundStmtEqBool/);
  assert.match(certificate.lean, /boundBodyCoveredBool/);
  assert.match(certificate.lean, /signatureCoversBool/);
  assert.match(certificate.lean, /checkedConcreteCallBodyRefinesCallerSignature/);
  assert.match(certificate.lean, /TraceRefinesSignature/);
});

test('guarded callee certificate serializes exact GuardExpr and both concrete branch traces', () => {
  const certificate = generateConcreteCallBodyCertificate(guardedSource, { name: 'GuardedCalleeTrace' });
  assert.equal(certificate.certificateVersion, '0.2');
  assert.deepEqual(certificate.certified, [
    'caller_high->award#1',
    'caller_low->award#2'
  ]);
  assert.match(certificate.lean, /BoundStmt\.branch/);
  assert.match(certificate.lean, /GuardExpr\.le \(RangeExpr\.lit 3\) \(RangeExpr\.var "amount"\)/);
  assert.match(certificate.lean, /caller_high_award_1_trace/);
  assert.match(certificate.lean, /caller_low_award_2_trace/);
  assert.match(certificate.lean, /target := "score"/);
  assert.match(certificate.lean, /target := "coins"/);
  assert.match(certificate.lean, /lo := 3, hi := 3/);
  assert.match(certificate.lean, /lo := 2, hi := 2/);
  assert.match(certificate.lean, /evalBoundStmtEqBool/);
  assert.match(certificate.lean, /boundBodyCoveredBool/);
  assert.match(certificate.lean, /checkedConcreteCallBodyRefinesCallerSignature/);
});
