import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildFormalRangeExpression } from '../src/formal-range.js';
import { buildIndependentRangeExpression } from '../src/independent-range-expression.js';
import { validateFormalSourceExtraction, buildRawSourceWitness } from '../src/source-validation.js';
import { generateLeanCertificate } from '../src/certificate.js';

test('source validation range parser and evaluator stay independent from production range code', () => {
  const validatorSource = fs.readFileSync(new URL('../src/source-validation.js', import.meta.url), 'utf8');
  const independentSource = fs.readFileSync(new URL('../src/independent-range-expression.js', import.meta.url), 'utf8');

  assert.doesNotMatch(validatorSource, /buildFormalRangeExpression/);
  assert.doesNotMatch(validatorSource, /from\s+['"]\.\/formal-range\.js['"]/);
  assert.doesNotMatch(independentSource, /from\s+['"]\.\/formal-range\.js['"]/);
  assert.doesNotMatch(independentSource, /from\s+['"]\.\/range-analysis\.js['"]/);
  assert.doesNotMatch(independentSource, /from\s+['"]\.\/parser\.js['"]/);
  assert.match(validatorSource, /buildIndependentRangeExpression/);
  assert.match(independentSource, /class IndependentRangeParser/);
  assert.match(independentSource, /function lex\(/);
  assert.match(independentSource, /inferIndependentRange/);
});

test('independent range parser and interval evaluator agree with production formal range on supported corpus', () => {
  const bindings = new Map([
    ['bonus', { min: 0, max: 5 }],
    ['offset', { min: -2, max: 3 }]
  ]);
  const cases = [
    '5',
    'bonus',
    '+bonus',
    '-bonus',
    'bonus + 2',
    'bonus - 2',
    '(bonus + 2) - offset',
    'bonus * 2',
    '2 * bonus',
    '3 * (bonus - 1)',
    '-(offset + 1)'
  ];

  for (const expression of cases) {
    const production = buildFormalRangeExpression(expression, bindings);
    const independent = buildIndependentRangeExpression(expression, bindings);
    assert.equal(production.supported, true, `production rejected ${expression}: ${production.reason ?? ''}`);
    assert.equal(independent.supported, true, `independent rejected ${expression}: ${independent.reason ?? ''}`);
    assert.deepEqual(independent.expr, production.expr, expression);
    assert.deepEqual(independent.bindings, production.bindings, expression);
    assert.deepEqual(independent.range, production.range, expression);
  }
});

test('independent range parser fails closed on decimals, division, unknown ranges and general multiplication', () => {
  const bindings = new Map([
    ['bonus', { min: 0, max: 5 }],
    ['other', { min: 1, max: 3 }]
  ]);
  for (const expression of ['1.5', 'bonus / 2', 'missing + 1', 'bonus * other']) {
    const independent = buildIndependentRangeExpression(expression, bindings);
    assert.equal(independent.supported, false, expression);
  }
});

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
  const validation = compiled.ir.sourceValidation;
  const entry = validation.entries.reward;
  assert.equal(validation.version, '0.2');
  assert.equal(validation.independentRangeExpressionVersion, '0.1');
  assert.equal(entry.validated, true);
  assert.equal(entry.sourceMatches, true);
  assert.equal(entry.rangeClaimsMatch, true);
  assert.equal(validation.summary.mismatches, 0);
  assert.equal(validation.producer, 'raw-source-independent-parser');
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
  assert.equal(witness.version, '0.2');
  assert.equal(witness.independentRangeExpressionVersion, '0.1');
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

test('certificate records independent raw-source/range validation provenance before Lean checks', () => {
  const source = `create number score = 0
allow reward:
  score may increase up to 10
make reward(bonus number 0..5):
  change score:
    add bonus * 2
`;
  const certificate = generateLeanCertificate(source, { name: 'ValidatedReward' });
  assert.equal(certificate.sourceValidationSchemaVersion, '0.2');
  assert.equal(certificate.independentRangeExpressionVersion, '0.1');
  assert.equal(certificate.rawSourceValidation, 'patch-source-extraction-validation');
  assert.match(certificate.lean, /sourceValidationSchemaVersion : String := "0\.2"/);
  assert.match(certificate.lean, /independentRangeExpressionVersion : String := "0\.1"/);
  assert.match(certificate.lean, /raw_source_validated/);
  assert.match(certificate.lean, /independent raw-source/);
  assert.match(certificate.lean, /formal-range\.js/);
  assert.match(certificate.lean, /range-analysis\.js/);
});
