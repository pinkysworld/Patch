import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { validateFormalSourceExtraction, buildRawSourceWitness } from '../src/source-validation.js';
import { generateLeanCertificate } from '../src/certificate.js';

test('raw-source validator independently matches a protected ranged recipe', () => {
  const source = `create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
`;
  const compiled = compile(source);
  const entry = compiled.ir.sourceValidation.entries.reward;
  assert.equal(entry.validated, true);
  assert.equal(entry.sourceMatches, true);
  assert.equal(entry.rangeClaimsMatch, true);
  assert.equal(compiled.ir.sourceValidation.summary.mismatches, 0);
  assert.equal(compiled.ir.sourceValidation.producer, 'raw-source-independent-parser');
});

test('raw-source witness preserves source change verbs, branch and repeat structure', () => {
  const source = `create number score = 0
make adjust(amount number 1..3):
  repeat 2:
    if amount > 0:
      change score:
        remove amount
    else:
      change score:
        add amount
`;
  const witness = buildRawSourceWitness(source);
  const entry = witness.entries.adjust;
  assert.equal(entry.supported, true);
  const json = JSON.stringify(entry.source);
  assert.match(json, /"kind":"repeat"/);
  assert.match(json, /"kind":"branch"/);
  assert.match(json, /"operation":"remove"/);
  assert.match(json, /"operation":"add"/);
  assert.equal(entry.rangeClaims.length, 2);
  assert.deepEqual(entry.rangeClaims.map(claim => claim.range), [{ min: 1, max: 3 }, { min: 1, max: 3 }]);
});

test('source validator detects tampered production SourceStmt', () => {
  const source = `create number score = 0
make reward(bonus number 0..5):
  change score:
    add bonus * 2
`;
  const compiled = compile(source);
  const tampered = structuredClone(compiled.ir.formalSource);
  tampered.entries.reward.source.change = { impossible: true };
  // Replace the actual tree with a structurally different but still JSON value.
  tampered.entries.reward.source = { kind: 'skip' };
  const validation = validateFormalSourceExtraction(source, tampered);
  assert.equal(validation.entries.reward.validated, false);
  assert.equal(validation.entries.reward.sourceMatches, false);
  assert.equal(validation.summary.mismatches, 1);
});

test('source validator detects tampered production range claim', () => {
  const source = `create number score = 0
make reward(bonus number 0..5):
  change score:
    add bonus * 2
`;
  const compiled = compile(source);
  const tampered = structuredClone(compiled.ir.formalSource);
  tampered.entries.reward.rangeClaims[0].range.max = 999;
  const validation = validateFormalSourceExtraction(source, tampered);
  assert.equal(validation.entries.reward.validated, false);
  assert.equal(validation.entries.reward.rangeClaimsMatch, false);
  assert.equal(validation.summary.mismatches, 1);
});

test('certificate records that raw-source extraction passed before Lean checks', () => {
  const source = `create number score = 0
allow reward:
  score may increase up to 10
make reward(bonus number 0..5):
  change score:
    add bonus * 2
`;
  const certificate = generateLeanCertificate(source, { name: 'ValidatedReward' });
  assert.equal(certificate.sourceValidationSchemaVersion, '0.1');
  assert.equal(certificate.rawSourceValidation, 'patch-source-extraction-validation');
  assert.match(certificate.lean, /sourceValidationSchemaVersion/);
  assert.match(certificate.lean, /raw_source_validated/);
  assert.match(certificate.lean, /independent raw-source/);
});
