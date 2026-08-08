import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { validateFormalGuardExtraction, buildRawGuardWitness } from '../src/guard-validation.js';

test('raw guard validator independently matches parameter branch structure', () => {
  const source = `create number score = 0
make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus
  else:
    change score:
      add 1
`;
  const compiled = compile(source);
  const entry = compiled.ir.guardValidation.entries.reward;
  assert.equal(entry.validated, true);
  assert.equal(entry.treeMatches, true);
  assert.equal(entry.claimsMatch, true);
  assert.equal(entry.variablesMatch, true);
  assert.equal(compiled.ir.formalSource.entries.reward.guardSupported, true);
  assert.equal(compiled.ir.formalSource.entries.reward.guardClaims.length, 1);
  assert.equal(compiled.ir.guardValidation.producer, 'raw-source-independent-guard-parser');
});

test('raw guard witness preserves nested branch/repeat shape', () => {
  const source = `make choose(bonus number 0..5):
  repeat 2:
    if bonus > 0:
      show bonus
    else:
      show 0
`;
  const witness = buildRawGuardWitness(source);
  const entry = witness.entries.choose;
  assert.equal(entry.supported, true);
  const json = JSON.stringify(entry.guardTree);
  assert.match(json, /"kind":"repeat"/);
  assert.match(json, /"kind":"branch"/);
  assert.match(json, /"kind":"lt"/);
  assert.deepEqual(entry.guardVariables, ['bonus']);
});

test('guard validation detects tampered production branch expression', () => {
  const source = `create number score = 0
make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus
`;
  const compiled = compile(source);
  const tampered = structuredClone(compiled.ir.formalSource);
  tampered.entries.reward.guardTree.guard = { kind: 'bool', value: false };
  const validation = validateFormalGuardExtraction(source, tampered);
  assert.equal(validation.entries.reward.validated, false);
  assert.equal(validation.entries.reward.treeMatches, false);
  assert.equal(validation.summary.mismatches, 1);
});

test('guard validation detects tampered production guard claim', () => {
  const source = `create number score = 0
make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus
`;
  const compiled = compile(source);
  const tampered = structuredClone(compiled.ir.formalSource);
  tampered.entries.reward.guardClaims[0].expression = 'bonus < 0';
  const validation = validateFormalGuardExtraction(source, tampered);
  assert.equal(validation.entries.reward.validated, false);
  assert.equal(validation.entries.reward.claimsMatch, false);
});

test('persistent-state guards remain outside the beta.23 guard-aware fragment without weakening SourceStmt support', () => {
  const source = `create number score = 1
make reward(bonus number 0..5):
  if score > 0:
    change score:
      add bonus
`;
  const compiled = compile(source);
  const formal = compiled.ir.formalSource.entries.reward;
  assert.equal(formal.supported, true);
  assert.equal(formal.guardSupported, false);
  assert.match(formal.guardReasons.join(' '), /not a recipe parameter/);
  assert.equal(compiled.ir.sourceValidation.entries.reward.validated, true);
  assert.equal(compiled.ir.guardValidation.entries.reward.validated, false);
});
