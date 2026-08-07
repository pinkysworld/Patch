import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildPatchApp, parsePatchApp, serializePatchApp } from '../src/bundle.js';

test('compiler lowers Patch source to Change IR', () => {
  const source = `create number score = 0\nchange score:\n  add 1\nshow score`;
  const { ir } = compile(source, { name: 'Counter', kind: 'console' });
  assert.equal(ir.format, 'patch-ir');
  assert.equal(ir.project.name, 'Counter');
  assert.equal(ir.instructions[0].code, 'CREATE');
  assert.equal(ir.instructions[1].code, 'CHANGE');
  assert.equal(ir.instructions[1].operations[0].op, 'add');
  assert.ok(ir.capabilities.includes('state.change'));
});

test('portable patchapp contains source and IR', () => {
  const source = `create text name = "Mia"\nshow name`;
  const bundle = buildPatchApp(source, { name: 'Hello', kind: 'console' });
  assert.equal(bundle.format, 'patchapp');
  assert.equal(bundle.manifest.name, 'Hello');
  assert.equal(bundle.source['main.patch'], source);
  assert.equal(bundle.ir.format, 'patch-ir');
});

test('patchapp serialization round-trips', () => {
  const source = `create number x = 1\nshow x`;
  const bundle = buildPatchApp(source, { name: 'RoundTrip' });
  const parsed = parsePatchApp(serializePatchApp(bundle));
  assert.equal(parsed.manifest.name, 'RoundTrip');
  assert.equal(parsed.ir.instructions[0].code, 'CREATE');
});
