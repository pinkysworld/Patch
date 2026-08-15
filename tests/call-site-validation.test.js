import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { collectRawCallSites } from '../src/call-site-validation.js';

test('raw call-site validation binds caller callee line and argument texts', () => {
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

test('raw call-site parser handles nested delimiters', () => {
  const sites = collectRawCallSites(`do target((1 + 2), [3, 4], other(5, 6))`);
  assert.deepEqual(sites, [
    { caller: '$program', callee: 'target', line: 1, args: ['(1 + 2)', '[3, 4]', 'other(5, 6)'] }
  ]);
});
