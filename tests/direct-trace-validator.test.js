import test from 'node:test';
import assert from 'node:assert/strict';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';
import {
  buildDirectTraceContract,
  deriveExpectedDirectTrace,
  validateDirectTrace,
  DirectTraceValidationError
} from '../src/direct-trace-validator.js';

async function validateProgram(source) {
  const { module, metadata, compiled } = compileToDirectWasm(source, { name: 'TraceValidation', kind: 'console' });
  assert.equal(WebAssembly.validate(module), true);
  const direct = await runDirectWasm(module, metadata);
  const validation = validateDirectTrace(compiled.ir, direct.trace);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.expectedState, direct.state);
  return { direct, validation, compiled };
}

test('independent trace contract assigns stable lexical change-site ids', () => {
  const source = `create number score = 0\n\nmake add_points(amount):\n  change score:\n    add amount\n\nif score == 0:\n  change score:\n    add 1\nelse:\n  change score:\n    remove 1\n\ndo add_points(2)`;
  const { compiled } = compileToDirectWasm(source, { name: 'SiteContract', kind: 'console' });
  const contract = buildDirectTraceContract(compiled.ir);
  assert.equal(contract.format, 'patch-direct-trace-contract');
  assert.equal(contract.version, '0.1');
  assert.deepEqual(contract.sites.map(site => ({
    siteId: site.siteId,
    scope: site.scope,
    target: site.target,
    op: site.operations[0].op
  })), [
    { siteId: 0, scope: 'add_points', target: 'score', op: 'add' },
    { siteId: 1, scope: '$program', target: 'score', op: 'add' },
    { siteId: 2, scope: '$program', target: 'score', op: 'remove' }
  ]);
});

test('validator independently derives direct linear transitions from Change IR', async () => {
  const source = `create number score = 1\nchange score:\n  add 2\n  add 3\nchange score:\n  remove 1\nshow score`;
  const { direct, validation } = await validateProgram(source);
  assert.deepEqual(direct.trace, [
    { target: 'score', before: 1, after: 6 },
    { target: 'score', before: 6, after: 5 }
  ]);
  assert.deepEqual(validation.expectedTrace.map(event => ({
    siteId: event.siteId,
    target: event.target,
    before: event.before,
    after: event.after
  })), [
    { siteId: 0, target: 'score', before: 1, after: 6 },
    { siteId: 1, target: 'score', before: 6, after: 5 }
  ]);
});

test('validator reconstructs branch and loop site occurrences independently', async () => {
  const source = `create number score = 0\nrepeat 4:\n  if count == 2 or count == 4:\n    change score:\n      add count\n  else:\n    change score:\n      add 1\nshow score`;
  const { validation } = await validateProgram(source);
  assert.deepEqual(validation.expectedTrace.map(event => event.siteId), [1, 0, 1, 0]);
  assert.deepEqual(validation.expectedTrace.map(event => event.after), [1, 3, 4, 8]);
});

test('validator reconstructs acyclic recipe calls and ranged parameters independently', async () => {
  const source = `create number score = 0\n\nallow reward:\n  score may increase up to 10\n\nmake add_points(amount number 0..5):\n  change score:\n    add amount\n\nmake twice(amount number 0..5):\n  do add_points(amount)\n  do add_points(amount)\n\ndo twice(3)\nshow score`;
  const { direct, validation } = await validateProgram(source);
  assert.deepEqual(direct.trace, [
    { target: 'score', before: 0, after: 3 },
    { target: 'score', before: 3, after: 6 }
  ]);
  assert.deepEqual(validation.expectedTrace.map(event => event.siteId), [0, 0]);
  assert.equal(validation.contract.sites[0].scope, 'add_points');
});

test('validator rejects a tampered direct transition even when target and length still match', async () => {
  const source = `create number score = 0\nchange score:\n  add 2\nchange score:\n  add 3`;
  const { module, metadata, compiled } = compileToDirectWasm(source, { name: 'TamperedTrace', kind: 'console' });
  const direct = await runDirectWasm(module, metadata);
  const tampered = direct.trace.map(event => ({ ...event }));
  tampered[1].after = 999;
  assert.throws(
    () => validateDirectTrace(compiled.ir, tampered),
    err => err instanceof DirectTraceValidationError && /after-value mismatch/.test(err.message)
  );
});

test('validator rejects missing and reordered direct transitions', async () => {
  const source = `create number left = 0\ncreate number right = 0\nchange left:\n  add 1\nchange right:\n  add 2`;
  const { module, metadata, compiled } = compileToDirectWasm(source, { name: 'TraceOrder', kind: 'console' });
  const direct = await runDirectWasm(module, metadata);

  assert.throws(
    () => validateDirectTrace(compiled.ir, direct.trace.slice(0, 1)),
    err => err instanceof DirectTraceValidationError && /length mismatch/.test(err.message)
  );

  assert.throws(
    () => validateDirectTrace(compiled.ir, [...direct.trace].reverse()),
    err => err instanceof DirectTraceValidationError && /target mismatch/.test(err.message)
  );
});

test('validator direct execution model is serializable and separate from backend metadata', () => {
  const source = `create number score = 0\nchange score:\n  add 4`;
  const { compiled, metadata } = compileToDirectWasm(source, { name: 'SerializableContract', kind: 'console' });
  const expected = deriveExpectedDirectTrace(compiled.ir);
  assert.doesNotThrow(() => JSON.stringify(expected.contract));
  assert.equal(expected.contract.sites[0].siteId, 0);
  assert.equal(expected.trace[0].siteId, 0);
  assert.equal('changeSites' in metadata, false);
});
