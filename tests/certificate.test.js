import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLeanCertificate } from '../src/certificate.js';

test('certificate generator emits Lean-validated range, source, evidence, signature and policy theorems', () => {
  const source = `create thing player:\n  score = 0\n\nallow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 5 to score`;
  const cert = generateLeanCertificate(source, { name: 'RewardDemo' });
  assert.deepEqual(cert.certified, ['reward']);
  assert.equal(cert.sourceSchemaVersion, '0.2');
  assert.equal(cert.evidenceSchemaVersion, '0.1');
  assert.equal(cert.rangeSchemaVersion, '0.1');
  assert.equal(cert.certifiedRangeClaims, 1);
  assert.match(cert.lean, /import PatchRange/);
  assert.match(cert.lean, /def cert_reward_range_1_expr : RangeExpr/);
  assert.match(cert.lean, /analyzeRange cert_reward_range_1_expr cert_reward_range_1_env = some cert_reward_range_1_inferred/);
  assert.match(cert.lean, /rangeAnalysisSound/);
  assert.match(cert.lean, /def cert_reward_source : SourceStmt/);
  assert.match(cert.lean, /kind := \.add/);
  assert.match(cert.lean, /def cert_reward_evidence : EvidenceStmt/);
  assert.match(cert.lean, /kind := \.increase/);
  assert.match(cert.lean, /checkSourceEvidence cert_reward_source cert_reward_evidence = true/);
  assert.match(cert.lean, /checkSourceSignature cert_reward_source cert_reward_production_signature = true/);
  assert.match(cert.lean, /checkSourceProtected cert_reward_source cert_reward_policy = true/);
  assert.match(cert.lean, /checkedSourceExecutionCannotEscape/);
  assert.match(cert.lean, /hi := 10/);
  assert.equal(cert.sourceSha256.length, 64);
});

test('certificate generator preserves bounded dynamic source amounts before semantic normalization', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player, bonus number 0..10):\n  change player:\n    add bonus to score`;
  const cert = generateLeanCertificate(source);
  assert.match(cert.lean, /SourceChange/);
  assert.match(cert.lean, /EvidenceAmount/);
  assert.match(cert.lean, /RangeExpr\.var "bonus"/);
  assert.match(cert.lean, /kind := \.add/);
  assert.match(cert.lean, /kind := \.increase/);
  assert.match(cert.lean, /lo := 0, hi := 10/);
  assert.match(cert.lean, /sourceSchemaVersion : String := "0\.2"/);
  assert.match(cert.lean, /evidenceSchemaVersion : String := "0\.1"/);
  assert.match(cert.lean, /rangeSchemaVersion : String := "0\.1"/);
});

test('certificate proves the motivating bonus times two range in the formal fragment', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player, bonus number 0..5):\n  change player:\n    add bonus * 2 to score`;
  const cert = generateLeanCertificate(source);
  assert.equal(cert.certifiedRangeClaims, 1);
  assert.match(cert.lean, /RangeExpr\.scale 2/);
  assert.match(cert.lean, /RangeExpr\.var "bonus"/);
  assert.match(cert.lean, /lo := 0, hi := 5/);
  assert.match(cert.lean, /lo := 0, hi := 10/);
  assert.match(cert.lean, /theorem cert_reward_range_1_sound/);
  assert.match(cert.lean, /exact rangeAnalysisSound/);
});

test('negative source add is preserved while semantic evidence becomes decrease', () => {
  const source = `allow penalty:\n  player.score may decrease up to 5\n\nmake penalty(player):\n  change player:\n    add -5 to score`;
  const cert = generateLeanCertificate(source);
  const sourceStart = cert.lean.indexOf('def cert_penalty_source');
  const evidenceStart = cert.lean.indexOf('def cert_penalty_evidence');
  const claimStart = cert.lean.indexOf('def cert_penalty_production_signature');
  const sourceBlock = cert.lean.slice(sourceStart, evidenceStart);
  const evidenceBlock = cert.lean.slice(evidenceStart, claimStart);
  assert.match(sourceBlock, /kind := \.add/);
  assert.match(sourceBlock, /lo := \(-5\), hi := \(-5\)/);
  assert.match(evidenceBlock, /kind := \.decrease/);
  assert.match(evidenceBlock, /lo := 5, hi := 5/);
  assert.match(cert.lean, /RangeExpr\.neg/);
});

test('production signature claim remains separate from source and evidence artifacts', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 5 to score\n  change player:\n    add 5 to score`;
  const cert = generateLeanCertificate(source);
  const claimStart = cert.lean.indexOf('def cert_reward_production_signature');
  const claimEnd = cert.lean.indexOf('def cert_reward_policy');
  const claim = cert.lean.slice(claimStart, claimEnd);
  assert.equal((claim.match(/kind := \.increase/g) ?? []).length, 1);
  assert.match(cert.lean, /checkSourceEvidence/);
  assert.match(cert.lean, /checkSourceSignature/);
});

test('certificate generator refuses a protected recipe outside formal bridge/source/range coverage', () => {
  const source = `make helper(player):\n  change player:\n    add 1 to score\n\nallow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  do helper(player)`;
  assert.throws(
    () => generateLeanCertificate(source),
    /outside the verified-checker subset|outside the formal source\/range subset/
  );
});

test('certificate refuses production-proven division outside the beta.9 formal range fragment', () => {
  const source = `allow reward:\n  player.score may increase up to 5\n\nmake reward(player, bonus number 0..10):\n  change player:\n    add bonus / 2 to score`;
  assert.throws(() => generateLeanCertificate(source), /division is outside the beta\.9 verified range fragment/);
});
