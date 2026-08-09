import test from 'node:test';
import assert from 'node:assert/strict';
import { zipStore } from '../src/local-native-kit.js';
import {
  appendStoredFilesToZip,
  buildPrebuiltNativePackage,
  prebuiltNativeTemplateName,
  prebuiltNativeTemplateUrl
} from '../src/prebuilt-native.js';

function templateZip() {
  return zipStore([
    { name: 'PatchRuntime/readme.txt', content: 'runtime template' },
    { name: 'PatchRuntime/bin/runner', content: 'binary-placeholder', mode: 0o100755 }
  ]);
}

function centralNames(bytes) {
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
  const names = [];
  for (let i = 0; i < entries; i += 1) {
    const view = new DataView(data.buffer, data.byteOffset + offset, 46);
    assert.equal(view.getUint32(0, true), 0x02014b50);
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    names.push(decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

test('prebuilt runtime template names are stable for Windows/macOS/Linux', () => {
  assert.equal(prebuiltNativeTemplateName('windows', 'console'), 'patch-windows-console-runtime.zip');
  assert.equal(prebuiltNativeTemplateName('macos', 'window'), 'patch-macos-window-runtime.zip');
  assert.equal(prebuiltNativeTemplateUrl('linux', 'window'), './runtimes/patch-linux-window-runtime.zip');
  assert.throws(() => prebuiltNativeTemplateName('freebsd', 'console'), /No prebuilt native runtime/);
});

test('ZIP customizer preserves template entries and adds payload files', () => {
  const output = appendStoredFilesToZip(templateZip(), [
    { name: 'patch-app.json', data: new TextEncoder().encode('{"name":"Demo"}') },
    { name: 'app.wasm', data: new Uint8Array([0, 97, 115, 109]) }
  ]);
  assert.deepEqual(centralNames(output), [
    'PatchRuntime/readme.txt',
    'PatchRuntime/bin/runner',
    'patch-app.json',
    'app.wasm'
  ]);
});

test('console package injects direct Wasm and metadata without recompiling runtime', () => {
  const built = buildPrebuiltNativePackage(templateZip(), {
    platform: 'windows',
    kind: 'console',
    name: 'My Console',
    wasm: new Uint8Array([0, 97, 115, 109])
  });
  assert.equal(built.filename, 'My_Console-windows-console.zip');
  const names = centralNames(built.bytes);
  assert.ok(names.includes('app.wasm'));
  assert.ok(names.includes('patch-app.json'));
  assert.ok(names.includes('PatchRuntime/bin/runner'));
});

test('window package injects source payload only', () => {
  const built = buildPrebuiltNativePackage(templateZip(), {
    platform: 'macos',
    kind: 'window',
    name: 'Window Demo',
    source: 'window main "Demo":\n  text "Hello"'
  });
  assert.equal(built.filename, 'Window_Demo-macos-window.zip');
  const names = centralNames(built.bytes);
  assert.ok(names.includes('patch-app.json'));
  assert.ok(!names.includes('app.wasm'));
});
