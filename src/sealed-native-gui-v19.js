import { adaptNativeWindowIconsForV19Backend } from './native-window-icon-backend-adapter.js';
import { validateNativeGuiIRV19, toV18CompatibleV19 } from './native-gui-ir-v19.js';
import {
  encodeNativeGuiPayloadV18,
  inspectNativeGuiButtonImagesV18,
  inspectNativeGuiPaintImagesV18,
  inspectNativeGuiPaintBoxesV18,
  inspectNativeGuiShapesV18,
  inspectNativeGuiChromeV18,
  inspectNativeGuiSlidersV18
} from './sealed-native-gui-v18.js';

export const PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_VERSION = 19;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V19 = 'PCHGUI01';
export const PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_EXTENSION_MAGIC = 'WICO';
const FOOTER_SIZE = 20;
const EXTENSION_TRAILER_SIZE = 8;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_EXTENSION_BYTES = 8 * 1024 * 1024;
const MAX_ASSETS = 256;
const MAX_CONSUMERS = 1024;
const RESOURCE_ID = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const PATCH_NAME = /^[A-Za-z_]\w*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const READY_MEDIA = new Set(['image/png', 'image/jpeg']);

export class SealedNativeGuiV19Error extends Error {}

/**
 * Payload v19 adds bounded application/Form icon assets over exact payload v18
 * bytes. Window icon assets are deduplicated by project resource id and Forms
 * reference extension-local asset indices. This transport still makes no claim
 * that the current desktop runtimes consume the icon extension.
 */
export function encodeNativeGuiPayloadV19(input, options = {}) {
  const ir = validateNativeGuiIRV19(input);
  const adapted = adaptNativeWindowIconsForV19Backend(ir, options.resources ?? []);
  const payloadV18 = encodeNativeGuiPayloadV18(toV18CompatibleV19(ir), options);
  const extension = encodeWindowIconExtension(adapted);
  if (extension.length > MAX_EXTENSION_BYTES) {
    throw new SealedNativeGuiV19Error(`Native GUI payload v19 Window icon extension exceeds ${MAX_EXTENSION_BYTES} bytes.`);
  }
  const trailer = new Uint8Array(EXTENSION_TRAILER_SIZE);
  trailer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_EXTENSION_MAGIC), 0);
  new DataView(trailer.buffer).setUint32(4, extension.length, true);
  const payload = concat([payloadV18, extension, trailer]);
  if (!payload.length || payload.length > MAX_PAYLOAD_BYTES) {
    throw new SealedNativeGuiV19Error(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  }
  return payload;
}

export function sealNativeGuiRuntimeV19(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  validateRuntimeHeader(runtime, options.platform ?? 'windows');
  if (hasFooter(runtime)) throw new SealedNativeGuiV19Error('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayloadV19(input, options);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V19), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayloadV19(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiV19Error('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  if (new TextDecoder().decode(footer.subarray(0, 8)) !== PATCH_SEALED_NATIVE_GUI_MAGIC_V19) {
    throw new SealedNativeGuiV19Error('Executable does not contain a sealed native GUI payload.');
  }
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_VERSION) {
    throw new SealedNativeGuiV19Error('Executable does not contain sealed native GUI payload v19.');
  }
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) {
    throw new SealedNativeGuiV19Error('Invalid sealed native GUI payload length.');
  }
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) {
    throw new SealedNativeGuiV19Error('Sealed native GUI payload CRC mismatch.');
  }
  inspectNativeGuiWindowIconsV19(payload);
  return new Uint8Array(payload);
}

export function inspectNativeGuiWindowIconsV19(payloadBytes) {
  const payload = toBytes(payloadBytes);
  if (payload.length < EXTENSION_TRAILER_SIZE) {
    throw new SealedNativeGuiV19Error('Payload v19 is missing the Window icon extension trailer.');
  }
  const trailerOffset = payload.length - EXTENSION_TRAILER_SIZE;
  const magic = new TextDecoder().decode(payload.subarray(trailerOffset, trailerOffset + 4));
  if (magic !== PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_EXTENSION_MAGIC) {
    throw new SealedNativeGuiV19Error('Payload v19 has an invalid Window icon extension trailer.');
  }
  const extensionLength = new DataView(
    payload.buffer,
    payload.byteOffset + trailerOffset,
    EXTENSION_TRAILER_SIZE
  ).getUint32(4, true);
  if (extensionLength > trailerOffset || extensionLength > MAX_EXTENSION_BYTES) {
    throw new SealedNativeGuiV19Error('Payload v19 has an invalid Window icon extension length.');
  }
  const extensionOffset = trailerOffset - extensionLength;
  const payloadV18 = new Uint8Array(payload.subarray(0, extensionOffset));
  if (!payloadV18.length) throw new SealedNativeGuiV19Error('Payload v19 is missing its payload-v18 compatibility prefix.');
  inspectNativeGuiButtonImagesV18(payloadV18);

  const reader = new Reader(payload.subarray(extensionOffset, trailerOffset));
  const assetCount = reader.u32();
  if (assetCount > MAX_ASSETS) throw new SealedNativeGuiV19Error('Payload v19 contains too many Window icon assets.');
  const assets = [];
  const resourceIds = new Set();
  for (let index = 0; index < assetCount; index += 1) {
    const resourceId = reader.text();
    const mediaType = reader.text();
    const size = reader.u32();
    const sha256 = reader.text();
    const dataUri = reader.text();
    if (!RESOURCE_ID.test(resourceId) || resourceIds.has(resourceId)) {
      throw new SealedNativeGuiV19Error('Payload v19 contains invalid or duplicate Window icon resource ids.');
    }
    if (!READY_MEDIA.has(mediaType)) {
      throw new SealedNativeGuiV19Error(`Payload v19 Window icon media type '${mediaType}' is unsupported.`);
    }
    if (!SHA256.test(sha256)) throw new SealedNativeGuiV19Error('Payload v19 contains an invalid Window icon SHA-256 value.');
    if (!dataUri.startsWith(`data:${mediaType};base64,`)) {
      throw new SealedNativeGuiV19Error(`Payload v19 Window icon '${resourceId}' has an invalid data URI.`);
    }
    resourceIds.add(resourceId);
    assets.push(Object.freeze({ assetIndex: index, resourceId, mediaType, size, sha256, dataUri }));
  }

  const consumerCount = reader.u32();
  if (consumerCount > MAX_CONSUMERS) throw new SealedNativeGuiV19Error('Payload v19 contains too many Window icon consumers.');
  const consumers = [];
  const formIndices = new Set();
  let previousFormIndex = -1;
  let applicationCount = 0;
  for (let index = 0; index < consumerCount; index += 1) {
    const formIndex = reader.u32();
    const formId = reader.text();
    const assetIndex = reader.u32();
    const applicationRaw = reader.u32();
    if (formIndices.has(formIndex) || formIndex <= previousFormIndex || assetIndex >= assets.length) {
      throw new SealedNativeGuiV19Error('Payload v19 contains invalid or duplicate Window icon consumer metadata.');
    }
    if (formId && !PATCH_NAME.test(formId)) {
      throw new SealedNativeGuiV19Error('Payload v19 contains an invalid Window icon Form name.');
    }
    if (applicationRaw > 1) throw new SealedNativeGuiV19Error('Payload v19 contains an invalid application icon flag.');
    const application = applicationRaw === 1;
    if (application) applicationCount += 1;
    if ((index === 0) !== application) {
      throw new SealedNativeGuiV19Error('Payload v19 requires exactly its first Window icon consumer to own the application icon.');
    }
    formIndices.add(formIndex);
    previousFormIndex = formIndex;
    consumers.push(Object.freeze({
      formIndex,
      formId: formId || null,
      assetIndex,
      resourceId: assets[assetIndex].resourceId,
      application
    }));
  }
  if (consumerCount && applicationCount !== 1) {
    throw new SealedNativeGuiV19Error('Payload v19 application icon metadata is inconsistent.');
  }
  if (!reader.done()) throw new SealedNativeGuiV19Error('Payload v19 Window icon extension contains trailing bytes.');

  return Object.freeze({
    payloadV18,
    assets: Object.freeze(assets),
    consumers: Object.freeze(consumers),
    applicationIcon: consumers.find(consumer => consumer.application) ?? null,
    extensionOffset,
    extensionLength
  });
}

export function inspectNativeGuiButtonImagesV19(payloadBytes) {
  return inspectNativeGuiButtonImagesV18(inspectNativeGuiWindowIconsV19(payloadBytes).payloadV18);
}

export function inspectNativeGuiPaintImagesV19(payloadBytes) {
  return inspectNativeGuiPaintImagesV18(inspectNativeGuiWindowIconsV19(payloadBytes).payloadV18);
}

export function inspectNativeGuiPaintBoxesV19(payloadBytes) {
  return inspectNativeGuiPaintBoxesV18(inspectNativeGuiWindowIconsV19(payloadBytes).payloadV18);
}

export function inspectNativeGuiShapesV19(payloadBytes) {
  return inspectNativeGuiShapesV18(inspectNativeGuiWindowIconsV19(payloadBytes).payloadV18);
}

export function inspectNativeGuiChromeV19(payloadBytes) {
  return inspectNativeGuiChromeV18(inspectNativeGuiWindowIconsV19(payloadBytes).payloadV18);
}

export function inspectNativeGuiSlidersV19(payloadBytes) {
  return inspectNativeGuiSlidersV18(inspectNativeGuiWindowIconsV19(payloadBytes).payloadV18);
}

function encodeWindowIconExtension(adapted) {
  if (adapted.assets.length > MAX_ASSETS) throw new SealedNativeGuiV19Error('Payload v19 contains too many Window icon assets.');
  if (adapted.consumers.length > MAX_CONSUMERS) throw new SealedNativeGuiV19Error('Payload v19 contains too many Window icon consumers.');
  const writer = new Writer();
  writer.u32(adapted.assets.length);
  for (const asset of adapted.assets) {
    writer.text(asset.resourceId);
    writer.text(asset.mediaType);
    writer.u32(asset.size);
    writer.text(asset.sha256);
    writer.text(asset.dataUri);
  }
  writer.u32(adapted.consumers.length);
  for (const consumer of adapted.consumers) {
    writer.u32(consumer.formIndex);
    writer.text(consumer.formId ?? '');
    writer.u32(consumer.assetIndex);
    writer.u32(consumer.application ? 1 : 0);
  }
  return writer.bytes();
}

class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.offset = 0;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  need(count) {
    if (count < 0 || this.offset + count > this.bytes.length) throw new SealedNativeGuiV19Error('Malformed payload v19 Window icon bytes.');
  }
  u32() {
    this.need(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }
  text() {
    const length = this.u32();
    this.need(length);
    let value;
    try {
      value = new TextDecoder('utf-8', { fatal: true }).decode(this.bytes.subarray(this.offset, this.offset + length));
    } catch {
      throw new SealedNativeGuiV19Error('Payload v19 contains invalid UTF-8 text.');
    }
    this.offset += length;
    return value;
  }
  done() { return this.offset === this.bytes.length; }
}

class Writer {
  constructor() { this.parts = []; }
  push(bytes) { this.parts.push(bytes); }
  u32(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) {
      throw new SealedNativeGuiV19Error(`Payload v19 integer '${value}' is outside uint32 range.`);
    }
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, number, true);
    this.push(bytes);
  }
  text(value) {
    const bytes = new TextEncoder().encode(String(value));
    this.u32(bytes.length);
    this.push(bytes);
  }
  bytes() { return concat(this.parts); }
}

function validateRuntimeHeader(runtime, platform) {
  if (platform === 'windows') {
    if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV19Error('Native GUI runtime template is not a Windows PE executable.');
    return;
  }
  if (platform === 'linux') {
    if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV19Error('Native GUI runtime template is not a Linux ELF executable.');
    return;
  }
  if (platform === 'macos') {
    const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : '';
    if (!new Set(['cffaedfe','feedfacf','cefaedfe','feedface','cafebabe','bebafeca','cafebabf','bfbafeca']).has(magic)) throw new SealedNativeGuiV19Error('Native GUI runtime template is not a macOS Mach-O executable.');
    return;
  }
  throw new SealedNativeGuiV19Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}

function hasFooter(bytes) {
  if (bytes.length < FOOTER_SIZE) return false;
  return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V19;
}

function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }

function concat(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
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
