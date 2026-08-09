import test from 'node:test';
import assert from 'node:assert/strict';
import { zipStore } from '../src/local-native-kit.js';
import {
  appendStoredFilesToZip,
  buildPrebuiltNativePackage,
  decodeSealedConsolePayload,
  prebuiltNativeTemplateName,
  prebuiltNativeTemplateUrl,
  sealConsoleRuntimeBinary
} from '../src/prebuilt-native.js';

function templateZip() {
  return zipStore([
    { name: 'PatchRuntime/readme.txt', content: 'runtime template' },
    { name: 'PatchRuntime/bin/runner', content: 'binary-placeholder', mode: 0o100755 }
  ]);
}

function centralEntries(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let eocd = -1;
  for (let i = data.length - 22; i >= 0; i -= 1) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) { eocd = i; break; }
  }
  assert.ok(eocd >= 0);
  const end = new DataView(data.buffer, data.byteOffset + eocd, 22);
  const entries = end.getUint16(10, true);
  let offset = end.getUint32(16, true);
  const decoder = new TextDecoder();
  const out = [];
  for (let i = 0; i < entries; i += 1) {
    const view = new DataView(data.buffer, data.byteOffset + offset, 46);
    assert.equal(view.getUint32(0, true), 0x02014b50);
    const compression = view.getUint16(10, true);
    const compressedSize = view.getUint32(20, true);
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    const localOffset = view.getUint32(42, true);
    const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength));
    out.push({ name, compression, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { data, entries: out };
}

function centralNames(bytes) { return centralEntries(bytes).entries.map(entry => entry.name); }

function storedEntry(bytes, name) {
  const { data, entries } = centralEntries(bytes);
  const entry = entries.find(item => item.name === name);
  assert.ok(entry, `missing ZIP entry ${name}`);
  assert.equal(entry.compression, 0, `${name} must be stored for direct test extraction`);
  const local = new DataView(data.buffer, data.byteOffset + entry.localOffset, 30);
  assert.equal(local.getUint32(0, true), 0x04034b50);
  const nameLength = local.getUint16(26, true);
  const extraLength = local.getUint16(28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  return data.subarray(start, start + entry.compressedSize);
}

test('prebuilt runtime template names use raw sealable binaries for Console', () => {
  assert.equal(prebuiltNativeTemplateName('windows', 'console'), 'patch-windows-console-runtime.bin');
  assert.equal(prebuiltNativeTemplateName('macos', 'console'), 'patch-macos-console-runtime.bin');
  assert.equal(prebuiltNativeTemplateName('linux', 'window'), 'patch-linux-window-runtime.zip');
  assert.equal(prebuiltNativeTemplateUrl('linux', 'console'), './runtimes/patch-linux-console-runtime.bin');
  assert.throws(() => prebuiltNativeTemplateName('freebsd', 'console'), /No prebuilt native runtime/);
});

test('sealed Console payload round-trips runtime, metadata and direct Wasm with CRC checks', () => {
  const runtime = new Uint8Array([0x4d, 0x5a, 1, 2, 3]);
  const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const sealed = sealConsoleRuntimeBinary(runtime, { name: 'Demo', wasm });
  const decoded = decodeSealedConsolePayload(sealed);
  assert.deepEqual([...decoded.runtime], [...runtime]);
  assert.deepEqual([...decoded.wasm], [...wasm]);
  assert.equal(decoded.metadata.name, 'Demo');
  assert.equal(decoded.metadata.kind, 'console');
  assert.throws(() => sealConsoleRuntimeBinary(sealed, { name: 'Again', wasm }), /already contains a sealed Patch payload/);
  const damaged = new Uint8Array(sealed);
  damaged[damaged.length - 29] ^= 0xff;
  assert.throws(() => decodeSealedConsolePayload(damaged), /CRC mismatch/);
});

test('Console package is a project-named self-contained Windows executable', () => {
  const runtime = new Uint8Array([0x4d, 0x5a, 1, 2, 3]);
  const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const built = buildPrebuiltNativePackage(runtime, {
    platform: 'windows',
    kind: 'console',
    name: 'My Console',
    wasm
  });
  assert.equal(built.filename, 'My_Console-windows-console.zip');
  assert.equal(built.sealed, true);
  assert.deepEqual(centralNames(built.bytes), ['My_Console.exe']);
  const decoded = decodeSealedConsolePayload(storedEntry(built.bytes, 'My_Console.exe'));
  assert.equal(decoded.metadata.name, 'My Console');
  assert.deepEqual([...decoded.wasm], [...wasm]);
});

test('macOS Console package creates a project-specific app bundle around the sealed executable', () => {
  const built = buildPrebuiltNativePackage(new Uint8Array([0xcf, 0xfa, 0xed, 0xfe]), {
    platform: 'macos',
    kind: 'console',
    name: 'Mac Demo',
    wasm: new Uint8Array([0, 97, 115, 109])
  });
  assert.deepEqual(centralNames(built.bytes), [
    'Mac_Demo.app/Contents/MacOS/Mac_Demo',
    'Mac_Demo.app/Contents/Info.plist'
  ]);
  const plist = new TextDecoder().decode(storedEntry(built.bytes, 'Mac_Demo.app/Contents/Info.plist'));
  assert.match(plist, /<string>Mac Demo<\/string>/);
  const decoded = decodeSealedConsolePayload(storedEntry(built.bytes, 'Mac_Demo.app/Contents/MacOS/Mac_Demo'));
  assert.equal(decoded.metadata.name, 'Mac Demo');
});

test('ZIP customizer preserves Window runtime entries and adds source payload', () => {
  const output = appendStoredFilesToZip(templateZip(), [
    { name: 'patch-app.json', data: new TextEncoder().encode('{"name":"Demo"}') }
  ]);
  assert.deepEqual(centralNames(output), [
    'PatchRuntime/readme.txt',
    'PatchRuntime/bin/runner',
    'patch-app.json'
  ]);
});

test('Window package continues to inject source payload into the prebuilt desktop player', () => {
  const built = buildPrebuiltNativePackage(templateZip(), {
    platform: 'macos',
    kind: 'window',
    name: 'Window Demo',
    source: 'window main "Demo":\n  text "Hello"'
  });
  assert.equal(built.filename, 'Window_Demo-macos-window.zip');
  assert.equal(built.sealed, false);
  const names = centralNames(built.bytes);
  assert.ok(names.includes('patch-app.json'));
  assert.ok(names.includes('PatchRuntime/bin/runner'));
  assert.ok(!names.includes('app.wasm'));
});
