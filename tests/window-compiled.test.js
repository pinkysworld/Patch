import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { zipStore } from '../src/local-native-kit.js';
import {
  buildCompiledWindowArtifact,
  runCompiledWindow,
  validateCompiledWindowArtifact
} from '../src/window-compiled.js';
import { buildPrebuiltCompiledWindowPackage } from '../src/prebuilt-window.js';

const source = fs.readFileSync(new URL('../examples/checkbox-window.patch', import.meta.url), 'utf8');

function compiled() {
  return buildCompiledWindowArtifact(compile(source, { name: 'Compiled Demo', kind: 'window', entry: 'main.patch' }));
}

function storedEntry(bytes, wanted) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let eocd = -1;
  for (let i = data.length - 22; i >= 0; i -= 1) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) { eocd = i; break; }
  }
  assert.ok(eocd >= 0, 'ZIP end record missing');
  const end = new DataView(data.buffer, data.byteOffset + eocd, 22);
  const entries = end.getUint16(10, true);
  let offset = end.getUint32(16, true);
  const decoder = new TextDecoder();
  for (let i = 0; i < entries; i += 1) {
    const central = new DataView(data.buffer, data.byteOffset + offset, 46);
    assert.equal(central.getUint32(0, true), 0x02014b50);
    const compressedSize = central.getUint32(20, true);
    const nameLength = central.getUint16(28, true);
    const extraLength = central.getUint16(30, true);
    const commentLength = central.getUint16(32, true);
    const localOffset = central.getUint32(42, true);
    const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength));
    if (name === wanted) {
      const local = new DataView(data.buffer, data.byteOffset + localOffset, 30);
      assert.equal(local.getUint32(0, true), 0x04034b50);
      assert.equal(local.getUint16(8, true), 0, 'test expects stored payload');
      const localNameLength = local.getUint16(26, true);
      const localExtraLength = local.getUint16(28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      return data.subarray(start, start + compressedSize);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.fail(`missing ZIP entry ${wanted}`);
}

test('compiled Window artifact contains executable AST and source-backed layout', () => {
  const artifact = compiled();
  assert.equal(artifact.format, 'patch-compiled-window-program');
  assert.equal(artifact.version, '0.2');
  assert.equal(artifact.irVersion, '0.10');
  assert.equal(artifact.project.kind, 'window');
  assert.ok(artifact.program.some(node => node.kind === 'window'));
  assert.equal(artifact.formLayout.format, 'patch-source-backed-form-layout');
  assert.equal(artifact.formLayout.windows[0].width, 520);
});

test('compiled Window artifact executes without reparsing Patch source', () => {
  const runtime = new PatchInterpreter();
  const result = runCompiledWindow(runtime, compiled());
  assert.equal(result.state.subscribed, false);
  assert.equal(result.ui[0].title, 'Preferences');
  assert.equal(result.ui[0].controls.find(control => control.type === 'checkbox').value, false);
});

test('compiled Window validator fails closed for incompatible artifacts', () => {
  const artifact = compiled();
  assert.throws(() => validateCompiledWindowArtifact({ ...artifact, version: '9' }), /version/);
  assert.throws(() => validateCompiledWindowArtifact({ ...artifact, program: [] }), /no Patch window/);
  assert.throws(() => validateCompiledWindowArtifact({ ...artifact, formLayout: null }), /form layout/);
});

test('ready Window package links compiled program payload into runtime ZIP', () => {
  const template = zipStore([
    { name: 'PatchWindowRuntime/readme.txt', content: 'runtime' },
    { name: 'PatchWindowRuntime/runner', content: 'binary', mode: 0o100755 }
  ]);
  const built = buildPrebuiltCompiledWindowPackage(template, {
    platform: 'windows',
    name: 'Compiled Demo',
    compiledWindow: compiled(),
    source
  });
  assert.equal(built.compiled, true);
  assert.equal(built.filename, 'Compiled_Demo-windows-window.zip');
  const payload = JSON.parse(new TextDecoder().decode(storedEntry(built.bytes, 'patch-app.json')));
  assert.equal(payload.version, '0.4');
  assert.equal(payload.execution, 'compiled-window-program');
  assert.equal(payload.compiled.format, 'patch-compiled-window-program');
  assert.equal(payload.compiled.version, '0.2');
  assert.equal(payload.compiled.program.some(node => node.kind === 'window'), true);
  assert.equal(payload.compiled.formLayout.windows[0].width, 520);
});
