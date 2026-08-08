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
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['10']);
  assert.equal(direct.state.score, 10);
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

test('direct Wasm compiles protected ranged recipes to Wasm functions', async () => {
  const source = `create number score = 0\n\nallow reward:\n  score may increase up to 10\n\nmake reward(bonus number 0..5):\n  change score:\n    add bonus * 2\n\ndo reward(4)\nshow score`;
  const { direct, metadata } = await compare(source);
  assert.deepEqual(direct.output, ['8']);
  assert.equal(direct.state.score, 8);
  assert.equal(metadata.version, '0.3-recipes');
  assert.deepEqual(metadata.recipes.reward.params, ['bonus']);
  assert.deepEqual(metadata.recipes.reward.paramRanges, { bonus: { min: 0, max: 5 } });
});

test('direct Wasm supports acyclic recipe-to-recipe calls', async () => {
  const source = `create number score = 0\n\nmake add_points(amount):\n  change score:\n    add amount\n\nmake twice(amount):\n  do add_points(amount)\n  do add_points(amount)\n\ndo twice(3)\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['6']);
  assert.equal(direct.state.score, 6);
});

test('direct Wasm passes repeat count as a numeric recipe argument', async () => {
  const source = `create number total = 0\n\nmake add_points(amount):\n  change total:\n    add amount\n\nrepeat 3:\n  do add_points(count)\n\nshow total`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['6']);
  assert.equal(direct.state.total, 6);
});

test('direct Wasm recipe parameters participate in direct conditions', async () => {
  const source = `create number score = 0\n\nmake maybe_add(amount):\n  if amount > 2:\n    change score:\n      add amount\n\ndo maybe_add(2)\ndo maybe_add(4)\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['4']);
  assert.equal(direct.state.score, 4);
});

test('direct Wasm enforces ranged recipe parameters with a Wasm trap', async () => {
  const source = `create number score = 0\n\nmake add_points(amount number 0..5):\n  change score:\n    add amount\n\ndo add_points(6)\nshow score`;
  assert.throws(() => new PatchInterpreter().run(source), /outside 0\.\.5/);
  const { module, metadata } = compileToDirectWasm(source, { name: 'RangeTrap', kind: 'console' });
  assert.equal(WebAssembly.validate(module), true);
  await assert.rejects(() => runDirectWasm(module, metadata), WebAssembly.RuntimeError);
});

test('direct Wasm rejects dynamic repeat, non-boolean conditions and nested creation explicitly', () => {
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

  const nestedCreate = `create number score = 1\nif score > 0:\n  create number score = 2`;
  assert.throws(
    () => compileToDirectWasm(nestedCreate, { kind: 'console' }),
    err => err instanceof DirectWasmUnsupportedError && /only supported at top level/.test(err.message)
  );
});

test('direct Wasm rejects unsupported recipe results and premature recipe calls', () => {
  const returnSource = `create number score = 0\nmake value(x):\n  return x\ndo value(1)`;
  assert.throws(
    () => compileToDirectWasm(returnSource, { kind: 'console' }),
    err => err instanceof DirectWasmUnsupportedError && /return/.test(err.message)
  );

  const prematureCall = `make tick():\n  change score:\n    add 1\ndo tick()\ncreate number score = 0`;
  assert.throws(
    () => compileToDirectWasm(prematureCall, { kind: 'console' }),
    err => err instanceof DirectWasmUnsupportedError && /must be created before calling recipe/.test(err.message)
  );
});

test('direct Wasm rejects non-numeric language constructs instead of silently falling back', () => {
  const textSource = `create text greeting = "hello"\nshow greeting`;
  assert.throws(
    () => compileToDirectWasm(textSource, { kind: 'console' }),
    err => err instanceof DirectWasmUnsupportedError && /create text/.test(err.message)
  );
});
