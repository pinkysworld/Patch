import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchInterpreter } from '../src/interpreter.js';
import { compileToDirectWasm, runDirectWasm, DirectWasmUnsupportedError } from '../src/wasm-direct.js';

function normalizedInterpreterTrace(history) {
  return history.map(change => ({
    target: change.target,
    before: change.before,
    after: change.after
  }));
}

async function compare(source) {
  const interpreted = new PatchInterpreter().run(source);
  const { module, metadata } = compileToDirectWasm(source, { name: 'DirectParity', kind: 'console' });
  assert.equal(WebAssembly.validate(module), true);
  const direct = await runDirectWasm(module, metadata);
  assert.deepEqual(direct.output, interpreted.output);
  assert.deepEqual(direct.state, interpreted.state);
  assert.deepEqual(direct.trace, normalizedInterpreterTrace(interpreted.history));
  return { direct, metadata, interpreted };
}

test('direct Wasm executes create, numeric changes and show without a Patch interpreter host', async () => {
  const source = `create number score = 1\nchange score:\n  add 2\nshow score\nchange score:\n  remove 1\nshow score`;
  const { direct, metadata } = await compare(source);
  assert.deepEqual(direct.output, ['3', '2']);
  assert.deepEqual(direct.trace, [
    { target: 'score', before: 1, after: 3 },
    { target: 'score', before: 3, after: 2 }
  ]);
  assert.equal(direct.state.score, 2);
  assert.equal(metadata.format, 'patch-wasm-direct');
  assert.equal(metadata.irVersion, '0.9');
  assert.equal(metadata.traceVersion, '0.1');
  assert.equal(direct.instance.exports.patch_state_score.value, 2);
});

test('one Patch change block emits one direct trace event even with multiple operations', async () => {
  const source = `create number score = 1\nchange score:\n  add 2\n  add 3\n  remove 1\nshow score`;
  const { direct, interpreted } = await compare(source);
  assert.equal(interpreted.history.length, 1);
  assert.deepEqual(direct.trace, [{ target: 'score', before: 1, after: 5 }]);
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
  const source = `create number score = 2\nif score < 3:\n  change score:\n    add 10\nelse:\n  change score:\n    add 100\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['12']);
  assert.deepEqual(direct.trace, [{ target: 'score', before: 2, after: 12 }]);
});

test('direct Wasm supports boolean composition for conditions', async () => {
  const source = `create number score = 2\nif score > 1 and not (score > 3):\n  change score:\n    add 5\nelse:\n  change score:\n    add 50\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['7']);
});

test('direct Wasm lowers literal repeat to a real Wasm loop and exposes Patch count', async () => {
  const source = `create number score = 0\nrepeat 3:\n  change score:\n    add count\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['6']);
  assert.equal(direct.state.score, 6);
  assert.deepEqual(direct.trace, [
    { target: 'score', before: 0, after: 1 },
    { target: 'score', before: 1, after: 3 },
    { target: 'score', before: 3, after: 6 }
  ]);
});

test('direct Wasm preserves nested repeat count shadowing', async () => {
  const source = `create number score = 0\nrepeat 2:\n  repeat 2:\n    change score:\n      add count\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['6']);
});

test('direct Wasm supports if inside repeat using the count local', async () => {
  const source = `create number score = 0\nrepeat 3:\n  if count >= 2:\n    change score:\n      add count\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['5']);
});

test('direct Wasm compiles protected ranged recipes to Wasm functions and preserves their transition trace', async () => {
  const source = `create number score = 0\nallow reward:\n  score may increase up to 10\nmake reward(bonus number 0..5):\n  change score:\n    add bonus * 2\ndo reward(4)\nshow score`;
  const { direct, metadata } = await compare(source);
  assert.deepEqual(direct.output, ['8']);
  assert.deepEqual(direct.trace, [{ target: 'score', before: 0, after: 8 }]);
  assert.equal(metadata.functions.length, 1);
  assert.equal(metadata.functions[0].name, 'reward');
});

test('direct Wasm supports acyclic recipe-to-recipe calls', async () => {
  const source = `create number score = 0\nmake inner(amount number 0..5):\n  change score:\n    add amount\nmake outer(amount number 0..5):\n  do inner(amount)\ndo outer(4)\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['4']);
});

test('direct Wasm passes repeat count as a numeric recipe argument', async () => {
  const source = `create number score = 0\nmake add(amount number 1..3):\n  change score:\n    add amount\nrepeat 3:\n  do add(count)\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['6']);
});

test('direct Wasm recipe parameters participate in direct conditions', async () => {
  const source = `create number score = 0\nmake add_if(amount number 0..5):\n  if amount > 2:\n    change score:\n      add amount\ndo add_if(4)\ndo add_if(1)\nshow score`;
  const { direct } = await compare(source);
  assert.deepEqual(direct.output, ['4']);
  assert.deepEqual(direct.trace, [{ target: 'score', before: 0, after: 4 }]);
});

test('direct Wasm exposes transition events through the host callback', async () => {
  const source = `create number score = 1\nchange score:\n  add 4`;
  const { direct, metadata } = await compare(source);
  assert.equal(metadata.traceVersion, '0.1');
  assert.deepEqual(metadata.stateTargets, ['score']);
  assert.deepEqual(direct.trace, [{ target: 'score', before: 1, after: 5 }]);
});

test('direct Wasm enforces ranged recipe parameters with a Wasm trap', async () => {
  const source = `create number score = 0\nmake reward(bonus number 0..5):\n  change score:\n    add bonus\ndo reward(9)`;
  const { module, metadata } = compileToDirectWasm(source, { name: 'Guarded', kind: 'console' });
  await assert.rejects(() => runDirectWasm(module, metadata), /unreachable|RuntimeError/i);
});

test('direct Wasm rejects dynamic repeat, non-boolean conditions and nested creation explicitly', () => {
  assert.throws(
    () => compileToDirectWasm(`create number n = 3\nrepeat n:\n  show count`),
    DirectWasmUnsupportedError
  );
  assert.throws(
    () => compileToDirectWasm(`create number n = 3\nif n:\n  show n`),
    DirectWasmUnsupportedError
  );
  assert.throws(
    () => compileToDirectWasm(`if true:\n  create number nested = 1`),
    DirectWasmUnsupportedError
  );
});

test('direct Wasm rejects unsupported recipe results and premature recipe calls', () => {
  assert.throws(
    () => compileToDirectWasm(`make answer():\n  return 42\ndo answer()`),
    DirectWasmUnsupportedError
  );
  assert.throws(
    () => compileToDirectWasm(`do later()\nmake later():\n  show 1`),
    DirectWasmUnsupportedError
  );
});

test('direct Wasm rejects non-numeric language constructs instead of silently falling back', () => {
  assert.throws(
    () => compileToDirectWasm(`create text name = "Mia"\nshow name`),
    DirectWasmUnsupportedError
  );
});
