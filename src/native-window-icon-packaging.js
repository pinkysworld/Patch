import { adaptNativeWindowIconsForV19Backend } from './native-window-icon-backend-adapter.js';
import { resourceById, resourceBytes } from './studio-resources.js';

export const PATCH_NATIVE_WINDOW_ICON_PACKAGING_VERSION = '0.1';
export const PATCH_NATIVE_WINDOW_ICON_PACKAGING_ID = 'native-window-icon-packaging/0.1';
export const PATCH_NATIVE_WINDOW_ICON_PACKAGING_SIZES = Object.freeze([16, 32, 64, 128, 256]);

const PNG_SIGNATURE = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ICNS_TYPES = new Map([
  [16, 'icp4'],
  [32, 'icp5'],
  [64, 'icp6'],
  [128, 'ic07'],
  [256, 'ic08']
]);

export class NativeWindowIconPackagingError extends Error {
  constructor(message, code = 'NATIVE_WINDOW_ICON_PACKAGING') {
    super(message);
    this.name = 'NativeWindowIconPackagingError';
    this.code = code;
  }
}

/**
 * Prepare deterministic application-icon packaging artifacts for the
 * experimental Native GUI IR 1.9 / payload v19 / runtime v1.10 line.
 *
 * This does not promote the current product contract. Runtime v1.10 can decode
 * PNG/JPEG Form icons, while cross-platform application packaging v0.1 is
 * deliberately stricter: the application icon must be one square PNG at a
 * standard 16/32/64/128/256 logical size so the same project resource can be
 * represented without a platform-specific image conversion dependency.
 *
 * Windows returns a valid PNG-backed .ico file but does not yet rewrite the PE
 * resource table of the token-free single EXE. macOS returns a valid .icns
 * resource contract, and Linux returns hicolor PNG + .desktop metadata.
 */
export function planNativeWindowIconPackaging(ir, resources = [], options = {}) {
  const adapted = adaptNativeWindowIconsForV19Backend(ir, resources);
  const name = safeName(options.name ?? 'PatchApp');
  const stem = fileStem(name);

  if (!adapted.applicationIcon) {
    return Object.freeze({
      id: PATCH_NATIVE_WINDOW_ICON_PACKAGING_ID,
      version: PATCH_NATIVE_WINDOW_ICON_PACKAGING_VERSION,
      experimental: true,
      currentProductPromoted: false,
      hasApplicationIcon: false,
      applicationIcon: null,
      windows: null,
      macos: null,
      linux: null
    });
  }

  const resourceId = adapted.applicationIcon.resourceId;
  const resource = resourceById(resources, resourceId);
  if (!resource) {
    throw new NativeWindowIconPackagingError(
      `Application icon resource '${resourceId}' is missing from the project resource inventory.`,
      'NATIVE_WINDOW_ICON_PACKAGING_RESOURCE_MISSING'
    );
  }
  if (resource.mediaType !== 'image/png') {
    throw new NativeWindowIconPackagingError(
      `Application icon packaging v0.1 requires PNG so one deterministic resource can produce Windows .ico, macOS .icns and Linux desktop metadata. '${resourceId}' is ${resource.mediaType}. JPEG remains valid for runtime-v1.10 Form icons.`,
      'NATIVE_WINDOW_ICON_PACKAGING_PNG_REQUIRED'
    );
  }

  const png = resourceBytes(resource);
  const dimensions = inspectPngDimensions(png);
  if (dimensions.width !== dimensions.height || !PATCH_NATIVE_WINDOW_ICON_PACKAGING_SIZES.includes(dimensions.width)) {
    throw new NativeWindowIconPackagingError(
      `Application icon '${resourceId}' must be a square ${PATCH_NATIVE_WINDOW_ICON_PACKAGING_SIZES.join('/')} px PNG for cross-platform packaging v0.1; received ${dimensions.width}x${dimensions.height}.`,
      'NATIVE_WINDOW_ICON_PACKAGING_DIMENSIONS'
    );
  }

  const size = dimensions.width;
  const icoBytes = encodePngIco(png, size);
  const icnsBytes = encodePngIcns(png, size);
  const desktopText = linuxDesktopEntry(name, stem);
  const desktopBytes = new TextEncoder().encode(desktopText);
  const linuxIconPath = `share/icons/hicolor/${size}x${size}/apps/${stem}.png`;
  const linuxDesktopPath = `share/applications/${stem}.desktop`;
  const macIconFile = `${stem}.icns`;

  return Object.freeze({
    id: PATCH_NATIVE_WINDOW_ICON_PACKAGING_ID,
    version: PATCH_NATIVE_WINDOW_ICON_PACKAGING_VERSION,
    experimental: true,
    currentProductPromoted: false,
    hasApplicationIcon: true,
    applicationIcon: Object.freeze({
      resourceId,
      formIndex: adapted.applicationIcon.formIndex,
      formId: adapted.applicationIcon.formId,
      width: size,
      height: size,
      sha256: resource.sha256
    }),
    windows: Object.freeze({
      filename: `${stem}.ico`,
      mediaType: 'image/x-icon',
      bytes: icoBytes,
      peEmbedded: false,
      nextGate: 'embed the generated ICO as the application icon resource in the Windows executable'
    }),
    macos: Object.freeze({
      filename: macIconFile,
      bundlePath: `Contents/Resources/${macIconFile}`,
      plistKey: 'CFBundleIconFile',
      plistValue: macIconFile,
      mediaType: 'image/icns',
      bytes: icnsBytes
    }),
    linux: Object.freeze({
      iconName: stem,
      iconPath: linuxIconPath,
      desktopPath: linuxDesktopPath,
      mediaType: 'image/png',
      iconBytes: new Uint8Array(png),
      desktopBytes,
      desktopText
    })
  });
}

export function encodePngIco(input, size) {
  const png = toBytes(input);
  assertPackagingSize(size);
  inspectPngDimensions(png, size);
  const headerSize = 6;
  const directorySize = 16;
  const imageOffset = headerSize + directorySize;
  const out = new Uint8Array(imageOffset + png.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  out[6] = size === 256 ? 0 : size;
  out[7] = size === 256 ? 0 : size;
  out[8] = 0;
  out[9] = 0;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, png.length, true);
  view.setUint32(18, imageOffset, true);
  out.set(png, imageOffset);
  return out;
}

export function encodePngIcns(input, size) {
  const png = toBytes(input);
  assertPackagingSize(size);
  inspectPngDimensions(png, size);
  const type = ICNS_TYPES.get(size);
  if (!type) {
    throw new NativeWindowIconPackagingError(
      `macOS ICNS packaging does not define a PNG chunk for ${size}px in packaging v0.1.`,
      'NATIVE_WINDOW_ICON_PACKAGING_ICNS_SIZE'
    );
  }
  const chunkLength = 8 + png.length;
  const totalLength = 8 + chunkLength;
  const out = new Uint8Array(totalLength);
  out.set(ascii('icns'), 0);
  new DataView(out.buffer).setUint32(4, totalLength, false);
  out.set(ascii(type), 8);
  new DataView(out.buffer).setUint32(12, chunkLength, false);
  out.set(png, 16);
  return out;
}

export function inspectPngDimensions(input, expectedSize = null) {
  const bytes = toBytes(input);
  if (bytes.length < 24 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new NativeWindowIconPackagingError('Application icon is not a valid PNG header.', 'NATIVE_WINDOW_ICON_PACKAGING_PNG');
  }
  const chunkLength = new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0, false);
  const chunkType = new TextDecoder().decode(bytes.subarray(12, 16));
  if (chunkLength !== 13 || chunkType !== 'IHDR') {
    throw new NativeWindowIconPackagingError('Application icon PNG is missing a canonical IHDR header.', 'NATIVE_WINDOW_ICON_PACKAGING_PNG');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + 16, 8);
  const width = view.getUint32(0, false);
  const height = view.getUint32(4, false);
  if (!width || !height || width > 8192 || height > 8192) {
    throw new NativeWindowIconPackagingError('Application icon PNG dimensions are invalid.', 'NATIVE_WINDOW_ICON_PACKAGING_PNG');
  }
  if (expectedSize !== null && (width !== expectedSize || height !== expectedSize)) {
    throw new NativeWindowIconPackagingError(
      `PNG dimensions ${width}x${height} do not match requested ${expectedSize}x${expectedSize} icon packaging.`,
      'NATIVE_WINDOW_ICON_PACKAGING_DIMENSIONS'
    );
  }
  return Object.freeze({ width, height });
}

function linuxDesktopEntry(name, stem) {
  const displayName = safeDesktopValue(name);
  return `[Desktop Entry]\nType=Application\nName=${displayName}\nExec=${stem}\nIcon=${stem}\nTerminal=false\nCategories=Utility;\n`;
}

function assertPackagingSize(value) {
  const size = Number(value);
  if (!Number.isInteger(size) || !PATCH_NATIVE_WINDOW_ICON_PACKAGING_SIZES.includes(size)) {
    throw new NativeWindowIconPackagingError(
      `Native application icon packaging size must be one of ${PATCH_NATIVE_WINDOW_ICON_PACKAGING_SIZES.join(', ')} px.`,
      'NATIVE_WINDOW_ICON_PACKAGING_DIMENSIONS'
    );
  }
}

function safeName(value) {
  const cleaned = String(value ?? '').trim().replace(/[\r\n\0]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
  return cleaned || 'PatchApp';
}
function fileStem(value) {
  return safeName(value).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}
function safeDesktopValue(value) {
  return safeName(value).replace(/[=]/g, '-');
}
function ascii(value) {
  return new TextEncoder().encode(value);
}
function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new NativeWindowIconPackagingError('Native icon packaging expects image bytes.', 'NATIVE_WINDOW_ICON_PACKAGING_BYTES');
}
