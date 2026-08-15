import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildFormalGuardExpression } from '../src/formal-guard.js';
import { buildIndependentGuardExpression } from '../src/independent-guard-expression.js';
import { validateFormalGuardExtraction, buildRawGuardWitness } from '../src/guard-validation.js';

test('guard validation parser implementation stays independent from production guard parsing', () => {
  const validatorSource = fs.readFileSync(new URL('../src/guard-validation.js', import.meta.url), 'utf8');
  const independentSource = fs.readFileSync(new URL('../src/independent-guard-expression.js', import.meta.url), 'utf8');

  assert.doesNotMatch(validatorSource, /buildFormalGuardExpression/);
  assert.doesNotMatch(independentSource, /from\s+['"]\.\/formal-guard\.js['"]/);
  assert.doesNotMatch(independentSource, /from\s+['"]\.\/parser\.js['"]/);
  assert.match(validatorSource, /buildIndependentGuardExpression/);
  assert.match(independentSource, /class IndependentGuardParser/);
  assert.match(independentSource, /function lex\(/);
});

test('independent guard expression parser agrees with production normalization on supported corpus', () => {
  const allowed = new Set(['bonus', 'limit']);
  const cases = [
    'bonus > 0',
    'bonus + 1 <= limit',
    '(bonus + 1) > 0',
    'bonus * 2 >= limit - 3',
    '2 * bonus < 9',
    'not bonus == 0',
    'bonus != limit',
    'bonus > 0 and limit >= bonus',
    'bonus == 0 or not (limit < 2)',
    'true and not false'
  ];

  for (const source of cases) {
    const production = buildFormalGuardExpression(source, allowed);
    const independent = buildIndependentGuardExpression(source, allowed);
    assert.equal(production.supported, true, `production rejected ${source}: ${production.reason ?? ''}`);
    assert.equal(independent.supported, true, `independent rejected ${source}: ${independent.reason ?? ''}`);
    assert.deepEqual(independent.expr, production.expr, source);
    assert.deepEqual(independent.variables, production.variables, source);
  }
});

test('independent guard expression parser fails closed on unsupported variables, tokens and multiplication', () => {
  const allowed = new Set(['bonus']);
  for (const source of ['score > 0', 'bonus / 2 > 0', 'bonus * bonus > 0', 'bonus + 0']) {
    const result = buildIndependentGuardExpression(source, allowed);
    assert.equal(result.supported, false, source);
  }
});

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
  const validation = compiled.ir.guardValidation;
  const entry = validation.entries.reward;
  assert.equal(validation.version, '0.2');
  assert.equal(validation.independentGuardExpressionVersion, '0.1');
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
  assert.equal(witness.independentGuardExpressionVersion, '0.1');
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
