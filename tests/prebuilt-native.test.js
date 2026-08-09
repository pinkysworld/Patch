import test from 'node:test';
import assert from 'node:assert/strict';
import { zipStore } from '../src/local-native-kit.js';
import {
  appendStoredFilesToZip,
  buildPrebuiltNativePackage,
  decodeSealedConsolePayload,
  PATCH_MAX_SEALED_WASM_BYTES,
  prebuiltNativeTemplateName,
  prebuiltNativeTemplateUrl,
  sealConsoleRuntimeBinary
} from '../src/prebuilt-native.js';

function templateZip(extra = []) {
  return zipStore([
    { name: 'PatchRuntime/readme.txt', content: 'runtime template' },
    { name: 'PatchRuntime/bin/runner', content: 'binary-placeholder', mode: 0o100755 },
    ...extra
  ]);
}

function centralEntries(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let eocd = -1;
  for (let i = data.length - 22; i >= 0; i -= 1) {
    if (data[i] !== 0x50 || data[i + 1] !== 0x4b || data[i + 2] !== 0x05 || data[i + 3] !== 0x06) continue;
    const view = new DataView(data.buffer, data.byteOffset + i, data.length - i);
    const commentLength = view.getUint16(20, true);
    if (i + 22 + commentLength === data.length) { eocd = i; break; }
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
  return { data, eocd, entries: out };
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

function withZipComment(zip, commentBytes) {
  const bytes = new Uint8Array(zip);
  const { eocd } = centralEntries(bytes);
  const comment = commentBytes instanceof Uint8Array ? commentBytes : new TextEncoder().encode(String(commentBytes));
  const out = new Uint8Array(bytes.length + comment.length);
  out.set(bytes, 0);
  new DataView(out.buffer).setUint16(eocd + 20, comment.length, true);
  out.set(comment, bytes.length);
  return out;
}

function concatBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function resealWithMetadata(sealed, metadataObject) {
  const decoded = decodeSealedConsolePayload(sealed);
  const metadata = new TextEncoder().encode(JSON.stringify(metadataObject));
  const footer = new Uint8Array(28);
  footer.set(new TextEncoder().encode('PCHSEA01'), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, 1, true);
  view.setUint32(12, metadata.length, true);
  view.setUint32(16, decoded.wasm.length, true);
  view.setUint32(20, crc32(metadata), true);
  view.setUint32(24, crc32(decoded.wasm), true);
  return concatBytes([decoded.runtime, metadata, decoded.wasm, footer]);
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
  assert.equal(decoded.metadata.format, 'patch-sealed-console-payload');
  assert.equal(decoded.metadata.version, '0.2');
  assert.throws(() => sealConsoleRuntimeBinary(sealed, { name: 'Again', wasm }), /already contains a sealed Patch payload/);
  const damaged = new Uint8Array(sealed);
  damaged[damaged.length - 29] ^= 0xff;
  assert.throws(() => decodeSealedConsolePayload(damaged), /CRC mismatch/);
});

test('sealed Console decoder rejects schema-valid CRC around an incompatible metadata kind', () => {
  const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const sealed = sealConsoleRuntimeBinary(new Uint8Array([1, 2, 3]), { name: 'Demo', wasm });
  const incompatible = resealWithMetadata(sealed, {
    format: 'patch-sealed-console-payload', version: '0.2', name: 'Demo', kind: 'window'
  });
  assert.throws(() => decodeSealedConsolePayload(incompatible), /kind must be console/);
});

test('sealed Console decoder rejects oversized declared payloads before reading them', () => {
  const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const sealed = sealConsoleRuntimeBinary(new Uint8Array([1, 2, 3]), { name: 'Demo', wasm });
  const oversized = new Uint8Array(sealed);
  new DataView(oversized.buffer).setUint32(oversized.length - 12, PATCH_MAX_SEALED_WASM_BYTES + 1, true);
  assert.throws(() => decodeSealedConsolePayload(oversized), /safety limit/);
});

test('sealer rejects a payload that is not a Wasm v1 module', () => {
  assert.throws(
    () => sealConsoleRuntimeBinary(new Uint8Array([1, 2, 3]), { name: 'Demo', wasm: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }),
    /invalid WebAssembly header/
  );
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

test('sealed Console packaging is reproducible for the same runtime and project', () => {
  const runtime = new Uint8Array([0x7f, 0x45, 0x4c, 0x46]);
  const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  const options = { platform: 'linux', kind: 'console', name: 'Repeatable', wasm };
  const first = buildPrebuiltNativePackage(runtime, options);
  const second = buildPrebuiltNativePackage(runtime, options);
  assert.deepEqual([...first.bytes], [...second.bytes]);
});

test('macOS Console package creates a project-specific app bundle around the sealed executable', () => {
  const built = buildPrebuiltNativePackage(new Uint8Array([0xcf, 0xfa, 0xed, 0xfe]), {
    platform: 'macos',
    kind: 'console',
    name: 'Mac Demo',
    wasm: new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
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

test('ZIP customizer preserves Window runtime entries, archive comments and adds source payload', () => {
  const template = withZipComment(templateZip(), new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0x41]));
  const output = appendStoredFilesToZip(template, [
    { name: 'patch-app.json', data: new TextEncoder().encode('{"name":"Demo"}') }
  ]);
  assert.deepEqual(centralNames(output), [
    'PatchRuntime/readme.txt',
    'PatchRuntime/bin/runner',
    'patch-app.json'
  ]);
  assert.deepEqual([...output.subarray(output.length - 5)], [0x50, 0x4b, 0x05, 0x06, 0x41]);
});

test('ZIP customizer rejects duplicate or unsafe injected paths', () => {
  const duplicate = templateZip([{ name: 'patch-app.json', content: '{}' }]);
  assert.throws(
    () => appendStoredFilesToZip(duplicate, [{ name: 'patch-app.json', data: new Uint8Array([1]) }]),
    /already contains ZIP entry/
  );
  assert.throws(
    () => appendStoredFilesToZip(templateZip(), [{ name: '../escape', data: new Uint8Array([1]) }]),
    /Unsafe ZIP entry name/
  );
});

test('Window package continues to inject source payload into the prebuilt desktop player reproducibly', () => {
  const template = templateZip();
  const options = {
    platform: 'macos',
    kind: 'window',
    name: 'Window Demo',
    source: 'window main "Demo":\n  text "Hello"'
  };
  const built = buildPrebuiltNativePackage(template, options);
  const repeated = buildPrebuiltNativePackage(template, options);
  assert.equal(built.filename, 'Window_Demo-macos-window.zip');
  assert.equal(built.sealed, false);
  assert.deepEqual([...built.bytes], [...repeated.bytes]);
  const names = centralNames(built.bytes);
  assert.ok(names.includes('patch-app.json'));
  assert.ok(names.includes('PatchRuntime/bin/runner'));
  assert.ok(!names.includes('app.wasm'));
});
