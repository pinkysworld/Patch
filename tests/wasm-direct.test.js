import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchInterpreter } from '../src/interpreter.js';
import { compileToDirectWasm, runDirectWasm, DirectWasmUnsupportedError } from '../src/wasm-direct.js';

async function compare(source) {
  const interpreted = new PatchInterpreter().run(source);
  const { module, metadata } = compileToDirectWasm(source, { name: 'DirectParity', kind: 'console' });
  assert.equal(WebAssembly.validate(module), true);
  const direct = await runDirectWasm(module, metadata);
  assert.deepEqual(direct.output, interpreted.output);
  assert.deepEqual(direct.state, interpreted.state);
  return { direct, metadata };
}

test('direct Wasm executes create, numeric changes and show without a Patch interpreter host', async () => {
  const source = `create number score = 1\nchange score:\n  add 2\nshow score\nchange score:\n  remove 1\nshow score`;
  const { direct, metadata } = await compare(source);
  assert.deepEqual(direct.output, ['3', '2']);
  assert.equal(direct.state.score, 2);
  assert.equal(metadata.format, 'patch-wasm-direct');
  assert.equal(metadata.irVersion, '0.7');
  assert.equal(direct.instance.exports.patch_state_score.value, 2);
});

test('direct Wasm lowers numeric expressions and reads earlier persistent bindings', async () => {
  const source = `create number base = 2\ncreate number score = base * 3 + 1\nchange score:\n  add base * (4 - 1)\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['13']);
  assert.deepEqual(direct.state, { base: 2, score: 13 });
});

test('direct Wasm preserves decimal JavaScript Number behavior through f64', async () => {
  const source = `create number value = 1.5\nchange value:\n  add 2.25\nshow value`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['3.75']);
  assert.equal(direct.state.value, 3.75);
});

test('direct Wasm lowers if/else comparisons to Wasm control flow', async () => {
  const source = `create number score = 3\nif score >= 3:\n  change score:\n    add 7\nelse:\n  change score:\n    remove 100\nshow score`;
  const { direct, metadata } = await compare(source);
  assert.deepEqual(direct.output, ['10']);
  assert.equal(direct.state.score, 10);
  assert.equal(metadata.version, '0.2-control');
});

test('direct Wasm supports boolean composition for conditions', async () => {
  const source = `create number score = 4\ncreate number limit = 10\nif score < limit and not false:\n  change score:\n    add 2\nelse:\n  change score:\n    remove 2\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['6']);
});

test('direct Wasm lowers literal repeat to a real Wasm loop and exposes Patch count', async () => {
  const source = `create number score = 0\nrepeat 3:\n  change score:\n    add count\n  show count\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['1', '2', '3', '6']);
  assert.equal(direct.state.score, 6);
});

test('direct Wasm preserves nested repeat count shadowing', async () => {
  const source = `create number total = 0\nrepeat 2:\n  change total:\n    add count\n  repeat 2:\n    change total:\n      add count\nshow total`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['9']);
  assert.equal(direct.state.total, 9);
});

test('direct Wasm supports if inside repeat using the count local', async () => {
  const source = `create number hits = 0\nrepeat 4:\n  if count == 2 or count == 4:\n    change hits:\n      add 1\nshow hits`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['2']);
  assert.equal(direct.state.hits, 2);
});

test('direct Wasm rejects dynamic repeat and non-boolean conditions explicitly', () => {
  const dynamicRepeat = `create number times = 3\ncreate number score = 0\nrepeat times:\n  change score:\n    add 1`;
  assert.throws(
    () => compileToDirectWasm(dynamicRepeat, { kind: 'console' }),
    err => err instanceof DirectWasmUnsupportedError && /literal whole number/.test(err.message)
  );

  const numericCondition = `create number score = 1\nif score:\n  change score:\n    add 1`;
  assert.throws(
    () => compileToDirectWasm(numericCondition, { kind: 'console' }),
    err => err instanceof DirectWasmUnsupportedError && /must be a boolean or comparison/.test(err.message)
  );
});

test('direct Wasm rejects unsupported language constructs instead of silently falling back', () => {
  const textSource = `create text greeting = "hello"\nshow greeting`;
  assert.throws(
    () => compileToDirectWasm(textSource, { kind: 'console' }),
    err => err instanceof DirectWasmUnsupportedError && /create text/.test(err.message)
  );

  const recipeSource = `create number score = 0\nmake tick():\n  change score:\n    add 1\ndo tick()`;
  assert.throws(
    () => compileToDirectWasm(recipeSource, { kind: 'console' }),
    err => err instanceof DirectWasmUnsupportedError && /MAKE/.test(err.message)
  );
});
