export const PATCH_PREBUILT_NATIVE_VERSION = '0.1';

const TEMPLATE_NAMES = {
  windows: {
    console: 'patch-windows-console-runtime.zip',
    window: 'patch-windows-window-runtime.zip'
  },
  macos: {
    console: 'patch-macos-console-runtime.zip',
    window: 'patch-macos-window-runtime.zip'
  },
  linux: {
    console: 'patch-linux-console-runtime.zip',
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
  const payload = {
    format: 'patch-prebuilt-native-payload',
    version: PATCH_PREBUILT_NATIVE_VERSION,
    name,
    kind
  };

  const files = [];
  if (kind === 'console') {
    if (!(options.wasm instanceof Uint8Array)) throw new PrebuiltNativeError('Console prebuilt packaging needs the browser-compiled direct Wasm payload.');
    files.push({ name: 'app.wasm', data: options.wasm });
  } else {
    payload.source = String(options.source ?? '');
  }
  files.push({ name: 'patch-app.json', data: new TextEncoder().encode(JSON.stringify(payload)) });

  return {
    format: 'patch-prebuilt-native-package',
    version: PATCH_PREBUILT_NATIVE_VERSION,
    platform,
    kind,
    name,
    filename: `${safeFileName(name)}-${platform}-${kind}.zip`,
    bytes: appendStoredFilesToZip(toBytes(templateBytes), files)
  };
}

export function appendStoredFilesToZip(zipBytes, files) {
  const bytes = toBytes(zipBytes);
  const eocdOffset = findEocd(bytes);
  const eocd = new DataView(bytes.buffer, bytes.byteOffset + eocdOffset, bytes.byteLength - eocdOffset);
  const disk = eocd.getUint16(4, true);
  const centralDisk = eocd.getUint16(6, true);
  const entriesOnDisk = eocd.getUint16(8, true);
  const entries = eocd.getUint16(10, true);
  const centralSize = eocd.getUint32(12, true);
  const centralOffset = eocd.getUint32(16, true);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entries) throw new PrebuiltNativeError('Multi-disk ZIP runtime templates are not supported.');
  if (entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new PrebuiltNativeError('ZIP64 runtime templates are not supported yet.');
  if (centralOffset + centralSize > eocdOffset) throw new PrebuiltNativeError('Runtime template ZIP central directory is malformed.');

  const encoder = new TextEncoder();
  const normalized = files.map(file => {
    const nameBytes = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data));
    return { nameBytes, data, crc: crc32(data), offset: 0 };
  });

  const localChunks = [];
  let addedLocalSize = 0;
  const { time, date } = dosTimestamp(new Date());
  for (const entry of normalized) {
    entry.offset = centralOffset + addedLocalSize;
    const header = new Uint8Array(30 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
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
    view.setUint16(12, time, true);
    view.setUint16(14, date, true);
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

  const localPrefix = bytes.subarray(0, centralOffset);
  const oldCentral = bytes.subarray(centralOffset, centralOffset + centralSize);
  const newCentralOffset = centralOffset + addedLocalSize;
  const newEntries = entries + normalized.length;
  if (newEntries >= 0xffff) throw new PrebuiltNativeError('Customized runtime ZIP would require ZIP64 entry counts.');

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, newEntries, true);
  endView.setUint16(10, newEntries, true);
  endView.setUint32(12, centralSize + addedCentralSize, true);
  endView.setUint32(16, newCentralOffset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([localPrefix, ...localChunks, oldCentral, ...addedCentral, end]);
}

function findEocd(bytes) {
  const min = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) return offset;
  }
  throw new PrebuiltNativeError('Runtime template is not a supported ZIP archive.');
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

function dosTimestamp(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function normalizePlatform(platform) {
  if (['windows', 'macos', 'linux'].includes(platform)) return platform;
  throw new PrebuiltNativeError(`Prebuilt native downloads currently support Windows, macOS and Linux; '${platform}' is not available yet.`);
}
function safeName(name) { return String(name).trim().replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').slice(0, 80) || 'PatchApp'; }
function safeFileName(name) { return safeName(name).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp'; }
