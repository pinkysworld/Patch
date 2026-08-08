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
