import test from 'node:test';
import assert from 'node:assert/strict';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';
import {
  buildDirectTraceContract,
  deriveExpectedDirectTrace,
  validateDirectTrace,
  DirectTraceValidationError,
  PATCH_DIRECT_INVOCATION_FRAME_VERSION
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
  const source = `create number score = 0\n\nallow add_points:\n  score may increase up to 5\n\nmake add_points(amount number 0..5):\n  change score:\n    add amount\n\nmake twice(amount number 0..5):\n  do add_points(amount)\n  do add_points(amount)\n\ndo twice(3)\nshow score`;
  const { direct, validation } = await validateProgram(source);
  assert.deepEqual(direct.trace, [
    { target: 'score', before: 0, after: 3 },
    { target: 'score', before: 3, after: 6 }
  ]);
  assert.deepEqual(validation.expectedTrace.map(event => event.siteId), [0, 0]);
  assert.equal(validation.contract.sites[0].scope, 'add_points');

  assert.equal(validation.invocationFrameVersion, PATCH_DIRECT_INVOCATION_FRAME_VERSION);
  assert.deepEqual(validation.invocationFrames, [
    {
      frameId: 0,
      parentFrameId: null,
      callerScope: '$program',
      callee: 'twice',
      invocation: 1,
      depth: 0,
      line: 14,
      args: [3],
      bindings: [{ name: 'amount', value: 3 }],
      transitionStart: 0,
      transitionEndExclusive: 2
    },
    {
      frameId: 1,
      parentFrameId: 0,
      callerScope: 'twice',
      callee: 'add_points',
      invocation: 1,
      depth: 1,
      line: 11,
      args: [3],
      bindings: [{ name: 'amount', value: 3 }],
      transitionStart: 0,
      transitionEndExclusive: 1
    },
    {
      frameId: 2,
      parentFrameId: 0,
      callerScope: 'twice',
      callee: 'add_points',
      invocation: 2,
      depth: 1,
      line: 12,
      args: [3],
      bindings: [{ name: 'amount', value: 3 }],
      transitionStart: 1,
      transitionEndExclusive: 2
    }
  ]);
  assert.deepEqual(validation.expectedTrace.map(event => event.frameIds), [[0, 1], [0, 2]]);
  assert.deepEqual(validation.annotatedTrace.map(event => event.frameIds), [[0, 1], [0, 2]]);
});

test('validator gives repeated identical root calls distinct independently reconstructed frames', async () => {
  const source = `create number score = 0\n\nmake add_points(amount number 0..5):\n  change score:\n    add amount\n\nmake caller(amount number 0..5):\n  do add_points(amount)\n\ndo caller(2)\ndo caller(2)`;
  const { validation } = await validateProgram(source);
  const callers = validation.invocationFrames.filter(frame => frame.callee === 'caller');
  const leaves = validation.invocationFrames.filter(frame => frame.callee === 'add_points');
  assert.deepEqual(callers.map(frame => [frame.frameId, frame.invocation, frame.transitionStart, frame.transitionEndExclusive]), [
    [0, 1, 0, 1],
    [2, 2, 1, 2]
  ]);
  assert.deepEqual(leaves.map(frame => [frame.frameId, frame.parentFrameId, frame.invocation]), [
    [1, 0, 1],
    [3, 2, 2]
  ]);
  assert.deepEqual(validation.expectedTrace.map(event => event.frameIds), [[0, 1], [2, 3]]);
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
  assert.doesNotThrow(() => JSON.stringify(expected.invocationFrames));
  assert.equal(expected.contract.sites[0].siteId, 0);
  assert.equal(expected.trace[0].siteId, 0);
  assert.equal('changeSites' in metadata, false);
  assert.equal('invocationFrames' in metadata, false);
});
