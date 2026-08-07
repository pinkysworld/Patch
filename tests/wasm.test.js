import test from 'node:test';
import assert from 'node:assert/strict';
import { compileToWasm, decodePatchWasm } from '../src/wasm.js';

test('bootstrap wasm backend emits an instantiable module', async () => {
  const source = `create number score = 1\nchange score:\n  add 2\nshow score`;
  const { module } = compileToWasm(source, { name: 'Score', kind: 'console' });
  assert.equal(module[0], 0x00);
  assert.equal(module[1], 0x61);
  const { instance } = await WebAssembly.instantiate(module);
  const payload = decodePatchWasm(instance);
  assert.equal(payload.format, 'patch-wasm-bootstrap');
  assert.equal(payload.project.name, 'Score');
  assert.equal(payload.project.kind, 'console');
  assert.equal(payload.source, source);
  assert.ok(payload.ir.instructions.some(instruction => instruction.code === 'CHANGE'));
});

test('wasm payload preserves GUI capabilities', async () => {
  const source = `window "Hello":\n  text "Hello"\n  button "OK" as ok`;
  const { module } = compileToWasm(source, { name: 'Hello', kind: 'window' });
  const { instance } = await WebAssembly.instantiate(module);
  const payload = decodePatchWasm(instance);
  assert.ok(payload.ir.capabilities.includes('ui.window'));
});
