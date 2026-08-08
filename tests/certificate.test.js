import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLeanCertificate } from '../src/certificate.js';

test('certificate generator emits Lean-validated evidence, signature and policy theorems', () => {
  const source = `create thing player:\n  score = 0\n\nallow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 5 to score`;
  const cert = generateLeanCertificate(source, { name: 'RewardDemo' });
  assert.deepEqual(cert.certified, ['reward']);
  assert.equal(cert.evidenceSchemaVersion, '0.1');
  assert.match(cert.lean, /import PatchEvidence/);
  assert.match(cert.lean, /def cert_reward_evidence : EvidenceStmt/);
  assert.match(cert.lean, /def cert_reward_production_signature : List EvidenceEffect/);
  assert.match(cert.lean, /checkEvidenceSignature cert_reward_evidence cert_reward_production_signature = true/);
  assert.match(cert.lean, /checkedEvidenceSignatureCorresponds/);
  assert.match(cert.lean, /checkEvidenceProtected cert_reward_evidence cert_reward_policy = true/);
  assert.match(cert.lean, /checkedEvidenceExecutionCannotEscape/);
  assert.match(cert.lean, /kind := \.increase/);
  assert.match(cert.lean, /hi := 10/);
  assert.equal(cert.sourceSha256.length, 64);
});

test('certificate generator preserves bounded dynamic semantic amounts as proof-free evidence', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player, bonus number 0..10):\n  change player:\n    add bonus to score`;
  const cert = generateLeanCertificate(source);
  assert.match(cert.lean, /EvidenceAmount/);
  assert.match(cert.lean, /lo := 0, hi := 10/);
  assert.match(cert.lean, /evidenceSchemaVersion : String := "0\.1"/);
});

test('production signature claim is emitted separately from bridge evidence', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 5 to score\n  change player:\n    add 5 to score`;
  const cert = generateLeanCertificate(source);
  const claimStart = cert.lean.indexOf('def cert_reward_production_signature');
  const claimEnd = cert.lean.indexOf('def cert_reward_policy');
  const claim = cert.lean.slice(claimStart, claimEnd);
  assert.equal((claim.match(/kind := \.increase/g) ?? []).length, 1);
  assert.match(cert.lean, /checkEvidenceSignature/);
});

test('certificate generator refuses a protected recipe outside formal bridge coverage', () => {
  const source = `make helper(player):\n  change player:\n    add 1 to score\n\nallow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  do helper(player)`;
  assert.throws(
    () => generateLeanCertificate(source),
    /outside the verified-checker subset/
  );
});
