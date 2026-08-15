import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { validateCallSites, collectRawCallSites } from '../src/call-site-validation.js';
import { buildConcreteCallWitnesses } from '../src/concrete-call-witness.js';

test('raw call-site parser stays independent from production parser implementation', () => {
  const source = fs.readFileSync(new URL('../src/call-site-validation.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]\.\/parser\.js['"]/);
  assert.doesNotMatch(source, /parse\(source\)/);
  assert.match(source, /collectRawCallSites/);
  assert.match(source, /parseRawCall/);
  assert.match(source, /splitTopLevelArgs/);
});

test('raw call-site validation binds caller, callee, line and exact argument texts', () => {
  const source = `make leaf(a number 0..10, b number 0..10):
  show a

make middle(seed number 0..5):
  if seed > 0:
    do leaf(seed + 1, (seed + 2) * 2)
  else:
    do leaf(0, 1)

do middle(3)`;
  const compiled = compile(source, { name: 'RawCallSites' });
  const validation = compiled.ir.callSiteValidation;
  assert.equal(validation.format, 'patch-call-site-validation');
  assert.equal(validation.version, '0.1');
  assert.equal(validation.validated, true);
  assert.equal(validation.summary.rawSites, 3);
  assert.equal(validation.summary.productionSites, 3);
  assert.equal(validation.summary.mismatches, 0);
  assert.deepEqual(validation.rawSites, [
    { caller: 'middle', callee: 'leaf', line: 6, args: ['seed + 1', '(seed + 2) * 2'] },
    { caller: 'middle', callee: 'leaf', line: 8, args: ['0', '1'] },
    { caller: '$program', callee: 'middle', line: 10, args: ['3'] }
  ]);
});

test('raw call-site parser handles nested delimiters without splitting inner commas', () => {
  const sites = collectRawCallSites(`do target((1 + 2), [3, 4], other(5, 6))`);
  assert.deepEqual(sites, [
    { caller: '$program', callee: 'target', line: 1, args: ['(1 + 2)', '[3, 4]', 'other(5, 6)'] }
  ]);
});

test('call-site validation detects tampered production callee, argument and line identity', () => {
  const source = `make leaf(amount number 0..5):
  show amount

do leaf(3)`;
  const compiled = compile(source);

  for (const mutate of [
    ast => { ast[1].name = 'other'; },
    ast => { ast[1].args[0] = '4'; },
    ast => { ast[1].line = 99; }
  ]) {
    const tampered = structuredClone(compiled.ast);
    mutate(tampered);
    const validation = validateCallSites(source, tampered);
    assert.equal(validation.validated, false);
    assert.equal(validation.summary.mismatches, 1);
    assert.match(validation.reasons.join(' '), /disagrees with production AST/);
  }
});

test('concrete call certification fails closed when supplied raw call-site validation is not valid', () => {
  const source = `make leaf(amount number 0..5):
  show amount

do leaf(3)`;
  const compiled = compile(source);
  const tamperedAst = structuredClone(compiled.ast);
  tamperedAst[1].args[0] = '4';
  const badValidation = validateCallSites(source, tamperedAst);
  assert.equal(badValidation.validated, false);
  assert.throws(
    () => buildConcreteCallWitnesses(compiled.ast, compiled.ir.formalCalls, badValidation),
    /requires validated raw-source call sites/
  );
});

test('validated call-site provenance is carried by concrete witness artifact', () => {
  const source = `make leaf(amount number 0..5):
  show amount

do leaf(3)`;
  const compiled = compile(source);
  const artifact = buildConcreteCallWitnesses(compiled.ast, compiled.ir.formalCalls, compiled.ir.callSiteValidation);
  assert.equal(artifact.version, '0.1');
  assert.equal(artifact.callSiteValidationVersion, '0.1');
  assert.equal(artifact.rawCallSitesValidated, true);
});
