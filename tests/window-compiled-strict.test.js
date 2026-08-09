import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import {
  PATCH_COMPILED_WINDOW_IR_VERSION,
  buildCompiledWindowArtifact,
  validateCompiledWindowArtifact
} from '../src/window-compiled.js';
import { zipStore } from '../src/local-native-kit.js';
import { buildPrebuiltCompiledWindowPackage } from '../src/prebuilt-window.js';

const source = fs.readFileSync(new URL('../examples/checkbox-window.patch', import.meta.url), 'utf8');

function artifact() {
  return buildCompiledWindowArtifact(compile(source, { name: 'Strict GUI', kind: 'window', entry: 'main.patch' }));
}

function readStoredPayload(bytes, wanted = 'patch-app.json') {
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
    const compressedSize = central.getUint32(20, true);
    const nameLength = central.getUint16(28, true);
    const extraLength = central.getUint16(30, true);
    const commentLength = central.getUint16(32, true);
    const localOffset = central.getUint32(42, true);
    const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength));
    if (name === wanted) {
      const local = new DataView(data.buffer, data.byteOffset + localOffset, 30);
      assert.equal(local.getUint16(8, true), 0, 'compiled payload must be stored for deterministic extraction');
      const localNameLength = local.getUint16(26, true);
      const localExtraLength = local.getUint16(28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      return JSON.parse(decoder.decode(data.subarray(start, start + compressedSize)));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.fail(`missing ZIP entry ${wanted}`);
}

test('compiled Window artifacts are pinned to the supported Change IR', () => {
  const built = artifact();
  assert.equal(PATCH_COMPILED_WINDOW_IR_VERSION, '0.10');
  assert.equal(built.irVersion, PATCH_COMPILED_WINDOW_IR_VERSION);
  assert.throws(
    () => validateCompiledWindowArtifact({ ...built, irVersion: '0.11' }),
    /requires Change IR 0\.10/
  );
});

test('compiled Window artifact rejects layout/program Form-count drift', () => {
  const built = artifact();
  assert.throws(
    () => validateCompiledWindowArtifact({ ...built, formLayout: { ...built.formLayout, windows: [] } }),
    /layout does not match/i
  );
});

test('current Ready Window payload contains compiled program and no Patch source', () => {
  const template = zipStore([
    { name: 'PatchWindowRuntime/readme.txt', content: 'runtime' },
    { name: 'PatchWindowRuntime/runner', content: 'binary', mode: 0o100755 }
  ]);
  const ready = buildPrebuiltCompiledWindowPackage(template, {
    platform: 'linux',
    name: 'Strict GUI',
    compiledWindow: artifact(),
    source: 'this option must never be packaged'
  });
  const payload = readStoredPayload(ready.bytes);
  assert.equal(payload.version, '0.3');
  assert.equal(payload.execution, 'compiled-window-program');
  assert.equal(payload.compiled.irVersion, '0.10');
  assert.equal(Object.hasOwn(payload, 'source'), false);
});
