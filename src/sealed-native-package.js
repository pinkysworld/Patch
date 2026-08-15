import { sealNativeGuiRuntime } from './sealed-native-gui.js';

export const PATCH_SEALED_NATIVE_PACKAGE_VERSION = '0.2';

export class SealedNativePackageError extends Error {}

export function buildLinuxNativeGuiPackage(runtimeBytes, nativeGui, options = {}) {
  const name = safeFileName(options.name ?? 'PatchApp');
  const runtime = toBytes(runtimeBytes);
  const sealed = sealNativeGuiRuntime(runtime, nativeGui, { platform: 'linux', version: options.payloadVersion });
  return {
    format: 'patch-sealed-linux-native-gui-package',
    version: PATCH_SEALED_NATIVE_PACKAGE_VERSION,
    platform: 'linux',
    kind: 'window',
    name,
    filename: `${name}-linux-window.zip`,
    executable: name,
    sealedBytes: sealed,
    bytes: storedZip([{ name, data: sealed, mode: 0o100755 }])
  };
}

export function buildMacosNativeGuiPackage(runtimeBytes, nativeGui, options = {}) {
  const name = safeFileName(options.name ?? 'PatchApp');
  const runtime = toBytes(runtimeBytes);
  const sealed = sealNativeGuiRuntime(runtime, nativeGui, { platform: 'macos', version: options.payloadVersion });
  const bundle = `${name}.app`;
  const executablePath = `${bundle}/Contents/MacOS/${name}`;
  const plistPath = `${bundle}/Contents/Info.plist`;
  const pkgInfoPath = `${bundle}/Contents/PkgInfo`;
  const plist = new TextEncoder().encode(infoPlist(name));
  const pkgInfo = new TextEncoder().encode('APPL????');
  return {
    format: 'patch-sealed-macos-native-gui-package',
    version: PATCH_SEALED_NATIVE_PACKAGE_VERSION,
    platform: 'macos',
    kind: 'window',
    name,
    bundle,
    filename: `${name}-macos-window.zip`,
    executable: executablePath,
    sealedBytes: sealed,
    bytes: storedZip([
      { name: executablePath, data: sealed, mode: 0o100755 },
      { name: plistPath, data: plist, mode: 0o100644 },
      { name: pkgInfoPath, data: pkgInfo, mode: 0o100644 }
    ])
  };
}

function infoPlist(name) {
  const xmlName = escapeXml(name);
  const identifierPart = name.toLowerCase().replace(/[^a-z0-9.-]/g, '-').replace(/^-+|-+$/g, '') || 'patchapp';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>CFBundleDevelopmentRegion</key><string>en</string>\n  <key>CFBundleExecutable</key><string>${xmlName}</string>\n  <key>CFBundleIdentifier</key><string>org.patchlang.studio.${identifierPart}</string>\n  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>\n  <key>CFBundleName</key><string>${xmlName}</string>\n  <key>CFBundlePackageType</key><string>APPL</string>\n  <key>CFBundleShortVersionString</key><string>0.1</string>\n  <key>CFBundleVersion</key><string>1</string>\n  <key>LSMinimumSystemVersion</key><string>11.0</string>\n  <key>NSHighResolutionCapable</key><true/>\n</dict>\n</plist>\n`;
}

function storedZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new SealedNativePackageError('ZIP package needs at least one file.');
  const locals = [];
  const centrals = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const data = toBytes(entry.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0x21, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    locals.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x21, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, ((entry.mode ?? 0o100644) << 16) >>> 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    localOffset += local.length + data.length;
  }

  const centralBytes = concat(centrals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return concat([...locals, centralBytes, end]);
}

function safeFileName(name) {
  return String(name).trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'PatchApp';
}
function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new SealedNativePackageError('Expected native runtime template bytes.');
}
function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
