import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateTransitiveCallBodyCertificate } from '../src/transitive-call-body-certificate.js';

const source = fs.readFileSync(new URL('../examples/formal-transitive-calls.patch', import.meta.url), 'utf8');

test('transitive certificate preserves recursive call-tree structure for Lean', () => {
  const certificate = generateTransitiveCallBodyCertificate(source, { name: 'TransitiveCalls' });
  assert.equal(certificate.certificateVersion, '0.1');
  assert.match(certificate.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(certificate.artifact.summary.maxNestedCallDepth, 2);
  assert.ok(certificate.certified.some(item => item.startsWith('caller->outer#') && item.endsWith('@depth2')));
  assert.ok(certificate.certified.some(item => item.startsWith('outer->middle#') && item.endsWith('@depth1')));
  assert.ok(!certificate.certified.some(item => item.startsWith('middle->leaf#')));
  assert.match(certificate.lean, /import PatchCallTree/);
  assert.match(certificate.lean, /CallTreeStmt\.call/);
  assert.match(certificate.lean, /CallTreeStmt\.call 2 1/);
  assert.match(certificate.lean, /CallTreeStmt\.call 1 0/);
  assert.match(certificate.lean, /RangeExpr\.add \(RangeExpr\.var "seed"\) \(RangeExpr\.lit 1\)/);
  assert.match(certificate.lean, /RangeExpr\.add \(RangeExpr\.var "amount"\) \(RangeExpr\.lit 1\)/);
  assert.match(certificate.lean, /evalCallTreeStmtEqBool/);
  assert.match(certificate.lean, /callTreeCoveredBool/);
  assert.match(certificate.lean, /concreteThroughAbstractBool/);
  assert.match(certificate.lean, /ConcreteArgsFit/);
  assert.match(certificate.lean, /concreteThroughAbstractBool_sound/);
  assert.match(certificate.lean, /checkedConcreteTransitiveCallTreeRefinesCallerSignature/);
  assert.match(certificate.lean, /target := "score"/);
  assert.match(certificate.lean, /target := "coins"/);
  assert.match(certificate.lean, /lo := 4, hi := 4/);
  assert.match(certificate.lean, /lo := 3, hi := 3/);
});
