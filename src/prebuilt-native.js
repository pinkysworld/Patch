export const PATCH_PREBUILT_NATIVE_VERSION = '0.2';
export const PATCH_SEALED_CONSOLE_VERSION = 1;
export const PATCH_MAX_SEALED_METADATA_BYTES = 64 * 1024;
export const PATCH_MAX_SEALED_WASM_BYTES = 64 * 1024 * 1024;

const SEALED_MAGIC_TEXT = 'PCHSEA01';
const SEALED_FOOTER_SIZE = 28;
const REPRO_DOS_TIME = 0;
const REPRO_DOS_DATE = 0x21; // 1980-01-01
const TEMPLATE_NAMES = {
  windows: {
    console: 'patch-windows-console-runtime.bin',
    window: 'patch-windows-window-runtime.zip'
  },
  macos: {
    console: 'patch-macos-console-runtime.bin',
    window: 'patch-macos-window-runtime.zip'
  },
  linux: {
    console: 'patch-linux-console-runtime.bin',
    window: 'patch-linux-window-runtime.zip'
  }
};

export class PrebuiltNativeError extends Error {}

export function prebuiltNativeTemplateName(platform, kind) {
  const normalizedKind = kind === 'window' ? 'window' : 'console';
  const name = TEMPLATE_NAMES[platform]?.[normalizedKind];
  if (!name) throw new PrebuiltNativeError(`No prebuilt native runtime is available for ${platform}/${normalizedKind}.`);
  return name;
}

export function prebuiltNativeTemplateUrl(platform, kind, base = './runtimes/') {
  return `${base}${prebuiltNativeTemplateName(platform, kind)}`;
}

export function buildPrebuiltNativePackage(templateBytes, options = {}) {
  const platform = normalizePlatform(options.platform);
  const kind = options.kind === 'window' ? 'window' : 'console';
  const name = safeName(options.name ?? 'PatchApp');

  if (kind === 'console') {
    if (!(options.wasm instanceof Uint8Array)) {
      throw new PrebuiltNativeError('Console prebuilt packaging needs the browser-compiled direct Wasm payload.');
    }
    const sealed = sealConsoleRuntimeBinary(toBytes(templateBytes), { name, wasm: options.wasm });
    return {
      format: 'patch-sealed-native-package',
      version: PATCH_PREBUILT_NATIVE_VERSION,
      platform,
      kind,
      name,
      sealed: true,
      filename: `${safeFileName(name)}-${platform}-${kind}.zip`,
      bytes: storedZip(sealedConsoleFiles(platform, name, sealed))
    };
  }

  const source = String(options.source ?? '');
  const payload = {
    format: 'patch-prebuilt-native-payload',
    version: PATCH_PREBUILT_NATIVE_VERSION,
    name,
    kind,
    source
  };
  return {
    format: 'patch-prebuilt-native-package',
    version: PATCH_PREBUILT_NATIVE_VERSION,
    platform,
    kind,
    name,
    sealed: false,
    filename: `${safeFileName(name)}-${platform}-${kind}.zip`,
    bytes: appendStoredFilesToZip(toBytes(templateBytes), [
      { name: 'patch-app.json', data: new TextEncoder().encode(JSON.stringify(payload)) }
    ])
  };
}

export function sealConsoleRuntimeBinary(runtimeBytes, options = {}) {
  const runtime = toBytes(runtimeBytes);
  const name = safeName(options.name ?? 'PatchApp');
  if (!(options.wasm instanceof Uint8Array)) throw new PrebuiltNativeError('Sealing a Console runtime needs a direct Wasm payload.');
  if (hasSealedFooter(runtime)) throw new PrebuiltNativeError('Runtime template already contains a sealed Patch payload.');
  validateDirectWasm(options.wasm);
  if (options.wasm.length > PATCH_MAX_SEALED_WASM_BYTES) {
    throw new PrebuiltNativeError(`Sealed Console Wasm exceeds the ${PATCH_MAX_SEALED_WASM_BYTES}-byte safety limit.`);
  }

  const metadata = new TextEncoder().encode(JSON.stringify({
    format: 'patch-sealed-console-payload',
    version: PATCH_PREBUILT_NATIVE_VERSION,
    name,
    kind: 'console'
  }));
  if (metadata.length > PATCH_MAX_SEALED_METADATA_BYTES) {
    throw new PrebuiltNativeError(`Sealed Console metadata exceeds the ${PATCH_MAX_SEALED_METADATA_BYTES}-byte safety limit.`);
  }

  const wasm = options.wasm;
  const footer = new Uint8Array(SEALED_FOOTER_SIZE);
  footer.set(new TextEncoder().encode(SEALED_MAGIC_TEXT), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_CONSOLE_VERSION, true);
  view.setUint32(12, metadata.length, true);
  view.setUint32(16, wasm.length, true);
  view.setUint32(20, crc32(metadata), true);
  view.setUint32(24, crc32(wasm), true);
  return concatBytes([runtime, metadata, wasm, footer]);
}

export function decodeSealedConsolePayload(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < SEALED_FOOTER_SIZE) throw new PrebuiltNativeError('Executable does not contain a sealed Patch payload.');
  const footerOffset = bytes.length - SEALED_FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  const magic = new TextDecoder().decode(footer.subarray(0, 8));
  if (magic !== SEALED_MAGIC_TEXT) throw new PrebuiltNativeError('Executable does not contain a sealed Patch payload.');

  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  const version = view.getUint32(8, true);
  if (version !== PATCH_SEALED_CONSOLE_VERSION) throw new PrebuiltNativeError(`Unsupported sealed Console payload version ${version}.`);
  const metadataLength = view.getUint32(12, true);
  const wasmLength = view.getUint32(16, true);
  validateSealedLengths(metadataLength, wasmLength);

  const payloadOffset = footerOffset - metadataLength - wasmLength;
  if (payloadOffset < 0) throw new PrebuiltNativeError('Sealed Console payload lengths are invalid.');
  const metadataBytes = bytes.subarray(payloadOffset, payloadOffset + metadataLength);
  const wasm = bytes.subarray(payloadOffset + metadataLength, footerOffset);
  if (crc32(metadataBytes) !== view.getUint32(20, true)) throw new PrebuiltNativeError('Sealed Console metadata CRC mismatch.');
  if (crc32(wasm) !== view.getUint32(24, true)) throw new PrebuiltNativeError('Sealed Console Wasm CRC mismatch.');

  let metadata;
  try { metadata = JSON.parse(new TextDecoder().decode(metadataBytes)); }
  catch { throw new PrebuiltNativeError('Sealed Console metadata is not valid JSON.'); }
  validateSealedMetadata(metadata);
  validateDirectWasm(wasm);

  return {
    runtime: bytes.subarray(0, payloadOffset),
    metadata,
    wasm: new Uint8Array(wasm)
  };
}

function validateSealedLengths(metadataLength, wasmLength) {
  if (metadataLength <= 0 || metadataLength > PATCH_MAX_SEALED_METADATA_BYTES) {
    throw new PrebuiltNativeError('Sealed Console metadata length is outside the supported safety limit.');
  }
  if (wasmLength < 8 || wasmLength > PATCH_MAX_SEALED_WASM_BYTES) {
    throw new PrebuiltNativeError('Sealed Console Wasm length is outside the supported safety limit.');
  }
}

function validateSealedMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') throw new PrebuiltNativeError('Sealed Console metadata must be an object.');
  if (metadata.format !== 'patch-sealed-console-payload') throw new PrebuiltNativeError('Sealed Console metadata format is unsupported.');
  if (metadata.version !== PATCH_PREBUILT_NATIVE_VERSION) throw new PrebuiltNativeError(`Sealed Console metadata version '${metadata.version ?? '?'}' is unsupported.`);
  if (metadata.kind !== 'console') throw new PrebuiltNativeError('Sealed Console metadata kind must be console.');
  if (typeof metadata.name !== 'string' || !metadata.name.trim()) throw new PrebuiltNativeError('Sealed Console metadata needs a project name.');
}

function validateDirectWasm(wasm) {
  if (!(wasm instanceof Uint8Array) || wasm.length < 8) throw new PrebuiltNativeError('Sealed Console payload is not a complete WebAssembly module.');
  const expected = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  for (let i = 0; i < expected.length; i += 1) {
    if (wasm[i] !== expected[i]) throw new PrebuiltNativeError('Sealed Console payload has an invalid WebAssembly header.');
  }
}

function sealedConsoleFiles(platform, name, binary) {
  const file = safeFileName(name);
  if (platform === 'windows') {
    return [{ name: `${file}.exe`, content: binary, mode: 0o100755 }];
  }
  if (platform === 'linux') {
    return [{ name: file, content: binary, mode: 0o100755 }];
  }
  const appRoot = `${file}.app/Contents`;
  return [
    { name: `${appRoot}/MacOS/${file}`, content: binary, mode: 0o100755 },
    { name: `${appRoot}/Info.plist`, content: macInfoPlist(name, file), mode: 0o100644 }
  ];
}

function macInfoPlist(name, executable) {
  const bundlePart = safeFileName(name).toLowerCase().replace(/_/g, '-');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>CFBundleName</key><string>${xml(name)}</string>\n<key>CFBundleDisplayName</key><string>${xml(name)}</string>\n<key>CFBundleExecutable</key><string>${xml(executable)}</string>\n<key>CFBundleIdentifier</key><string>org.patchlang.${xml(bundlePart)}</string>\n<key>CFBundlePackageType</key><string>APPL</string>\n<key>CFBundleShortVersionString</key><string>0.2</string>\n<key>CFBundleVersion</key><string>1</string>\n</dict></plist>\n`;
}

function hasSealedFooter(bytes) {
  if (bytes.length < SEALED_FOOTER_SIZE) return false;
  return new TextDecoder().decode(bytes.subarray(bytes.length - SEALED_FOOTER_SIZE, bytes.length - SEALED_FOOTER_SIZE + 8)) === SEALED_MAGIC_TEXT;
}

export function appendStoredFilesToZip(zipBytes, files) {
  const bytes = toBytes(zipBytes);
  const archive = readZipDirectory(bytes);
  const encoder = new TextEncoder();
  const seen = new Set(archive.names);
  const normalized = files.map(file => {
    const name = validateZipEntryName(String(file.name));
    if (seen.has(name)) throw new PrebuiltNativeError(`Runtime template already contains ZIP entry '${name}'.`);
    seen.add(name);
    const nameBytes = encoder.encode(name);
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data));
    return { name, nameBytes, data, crc: crc32(data), offset: 0 };
  });

  const localChunks = [];
  let addedLocalSize = 0;
  for (const entry of normalized) {
    entry.offset = archive.centralOffset + addedLocalSize;
    const header = new Uint8Array(30 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, REPRO_DOS_TIME, true);
    view.setUint16(12, REPRO_DOS_DATE, true);
    view.setUint32(14, entry.crc, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, entry.nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(entry.nameBytes, 30);
    localChunks.push(header, entry.data);
    addedLocalSize += header.length + entry.data.length;
  }

  const addedCentral = [];
  let addedCentralSize = 0;
  for (const entry of normalized) {
    const header = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 0x0314, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, REPRO_DOS_TIME, true);
    view.setUint16(14, REPRO_DOS_DATE, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0o100644 << 16, true);
    view.setUint32(42, entry.offset, true);
    header.set(entry.nameBytes, 46);
    addedCentral.push(header);
    addedCentralSize += header.length;
  }

  const localPrefix = bytes.subarray(0, archive.centralOffset);
  const oldCentral = bytes.subarray(archive.centralOffset, archive.eocdOffset);
  const newCentralOffset = archive.centralOffset + addedLocalSize;
  const newEntries = archive.entries + normalized.length;
  if (newEntries >= 0xffff) throw new PrebuiltNativeError('Customized runtime ZIP would require ZIP64 entry counts.');

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, newEntries, true);
  endView.setUint16(10, newEntries, true);
  endView.setUint32(12, archive.centralSize + addedCentralSize, true);
  endView.setUint32(16, newCentralOffset, true);
  endView.setUint16(20, archive.comment.length, true);

  return concatBytes([localPrefix, ...localChunks, oldCentral, ...addedCentral, end, archive.comment]);
}

function readZipDirectory(bytes) {
  const eocdOffset = findEocd(bytes);
  const eocd = new DataView(bytes.buffer, bytes.byteOffset + eocdOffset, 22);
  const disk = eocd.getUint16(4, true);
  const centralDisk = eocd.getUint16(6, true);
  const entriesOnDisk = eocd.getUint16(8, true);
  const entries = eocd.getUint16(10, true);
  const centralSize = eocd.getUint32(12, true);
  const centralOffset = eocd.getUint32(16, true);
  const commentLength = eocd.getUint16(20, true);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entries) throw new PrebuiltNativeError('Multi-disk ZIP runtime templates are not supported.');
  if (entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new PrebuiltNativeError('ZIP64 runtime templates are not supported yet.');
  if (centralOffset + centralSize !== eocdOffset) throw new PrebuiltNativeError('Runtime template ZIP central directory is malformed or contains unsupported trailing records.');

  const decoder = new TextDecoder();
  const names = [];
  let offset = centralOffset;
  for (let i = 0; i < entries; i += 1) {
    if (offset + 46 > eocdOffset) throw new PrebuiltNativeError('Runtime template ZIP central directory is truncated.');
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 46);
    if (view.getUint32(0, true) !== 0x02014b50) throw new PrebuiltNativeError('Runtime template ZIP central entry signature is invalid.');
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const entryCommentLength = view.getUint16(32, true);
    const end = offset + 46 + nameLength + extraLength + entryCommentLength;
    if (end > eocdOffset) throw new PrebuiltNativeError('Runtime template ZIP central entry is truncated.');
    names.push(decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
    offset = end;
  }
  if (offset !== eocdOffset) throw new PrebuiltNativeError('Runtime template ZIP central directory size does not match its entries.');

  return {
    eocdOffset,
    entries,
    centralSize,
    centralOffset,
    names,
    comment: bytes.subarray(eocdOffset + 22, eocdOffset + 22 + commentLength)
  };
}

function findEocd(bytes) {
  const min = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4b || bytes[offset + 2] !== 0x05 || bytes[offset + 3] !== 0x06) continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset);
    const commentLength = view.getUint16(20, true);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  throw new PrebuiltNativeError('Runtime template is not a supported ZIP archive.');
}

function validateZipEntryName(name) {
  if (!name || name.startsWith('/') || name.startsWith('\\') || /^[A-Za-z]:/.test(name) || name.split(/[\\/]/).includes('..')) {
    throw new PrebuiltNativeError(`Unsafe ZIP entry name '${name}'.`);
  }
  return name.replace(/\\/g, '/');
}

function storedZip(files) {
  const encoder = new TextEncoder();
  const entries = files.map(file => {
    const name = validateZipEntryName(String(file.name));
    const nameBytes = encoder.encode(name);
    const data = file.content instanceof Uint8Array ? file.content : encoder.encode(String(file.content));
    return { ...file, name, nameBytes, data, crc: crc32(data), offset: 0 };
  });
  const names = new Set();
  for (const entry of entries) {
    if (names.has(entry.name)) throw new PrebuiltNativeError(`Duplicate ZIP entry '${entry.name}'.`);
    names.add(entry.name);
  }

  const localChunks = [];
  let offset = 0;
  for (const entry of entries) {
    const header = new Uint8Array(30 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, REPRO_DOS_TIME, true);
    view.setUint16(12, REPRO_DOS_DATE, true);
    view.setUint32(14, entry.crc, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, entry.nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(entry.nameBytes, 30);
    entry.offset = offset;
    localChunks.push(header, entry.data);
    offset += header.length + entry.data.length;
  }

  const centralChunks = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 0x0314, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, REPRO_DOS_TIME, true);
    view.setUint16(14, REPRO_DOS_DATE, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, ((entry.mode ?? 0o100644) << 16) >>> 0, true);
    view.setUint32(42, entry.offset, true);
    header.set(entry.nameBytes, 46);
    centralChunks.push(header);
    centralSize += header.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);
  return concatBytes([...localChunks, ...centralChunks, end]);
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new PrebuiltNativeError('Expected runtime template bytes.');
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
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

function xml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[c]); }
function normalizePlatform(platform) {
  if (['windows', 'macos', 'linux'].includes(platform)) return platform;
  throw new PrebuiltNativeError(`Prebuilt native downloads currently support Windows, macOS and Linux; '${platform}' is not available yet.`);
}
function safeName(name) { return String(name).trim().replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').slice(0, 80) || 'PatchApp'; }
function safeFileName(name) { return safeName(name).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp'; }
