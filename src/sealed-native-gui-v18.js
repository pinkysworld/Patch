import { resolveNativePictureResources } from './native-picture-resources.js';
import { adaptNativeButtonImagesForV18Backend } from './native-button-image-backend-adapter.js';
import { validateNativeGuiIRV18 } from './native-gui-ir-v18.js';
import {
  encodeNativeGuiPayloadV17,
  inspectNativeGuiPaintImagesV17,
  inspectNativeGuiPaintBoxesV17,
  inspectNativeGuiShapesV17,
  inspectNativeGuiChromeV17,
  inspectNativeGuiSlidersV17
} from './sealed-native-gui-v17.js';

export const PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_VERSION = 18;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V18 = 'PCHGUI01';
export const PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_EXTENSION_MAGIC = 'BIMG';
const FOOTER_SIZE = 20;
const EXTENSION_TRAILER_SIZE = 8;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_EXTENSION_BYTES = 8 * 1024 * 1024;
const MAX_ASSETS = 1024;
const MAX_CONSUMERS = 4096;
const RESOURCE_ID = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const PATCH_NAME = /^[A-Za-z_]\w*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const READY_MEDIA = new Set(['image/png', 'image/jpeg']);

export class SealedNativeGuiV18Error extends Error {}

/**
 * Payload v18 is an additive Button ImageList transport over exact payload v17
 * bytes. Resource payloads are deduplicated and Button consumers reference them
 * by stable extension-local asset index. The existing v17 prefix remains
 * independently inspectable and byte-compatible.
 */
export function encodeNativeGuiPayloadV18(input, options = {}) {
  const ir = validateNativeGuiIRV18(input);
  const resolved = resolveNativePictureResources(ir, options.resources ?? []);
  const adapted = adaptNativeButtonImagesForV18Backend(resolved.ir, options.resources ?? []);
  const payloadV17 = encodeNativeGuiPayloadV17(adapted.compatibleIr);
  const extension = encodeButtonImageExtension(adapted);
  if (extension.length > MAX_EXTENSION_BYTES) {
    throw new SealedNativeGuiV18Error(`Native GUI payload v18 Button image extension exceeds ${MAX_EXTENSION_BYTES} bytes.`);
  }
  const trailer = new Uint8Array(EXTENSION_TRAILER_SIZE);
  trailer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_EXTENSION_MAGIC), 0);
  new DataView(trailer.buffer).setUint32(4, extension.length, true);
  const payload = concat([payloadV17, extension, trailer]);
  if (!payload.length || payload.length > MAX_PAYLOAD_BYTES) {
    throw new SealedNativeGuiV18Error(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  }
  return payload;
}

export function sealNativeGuiRuntimeV18(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  validateRuntimeHeader(runtime, options.platform ?? 'windows');
  if (hasFooter(runtime)) throw new SealedNativeGuiV18Error('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayloadV18(input, options);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V18), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayloadV18(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiV18Error('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  if (new TextDecoder().decode(footer.subarray(0, 8)) !== PATCH_SEALED_NATIVE_GUI_MAGIC_V18) {
    throw new SealedNativeGuiV18Error('Executable does not contain a sealed native GUI payload.');
  }
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_VERSION) {
    throw new SealedNativeGuiV18Error('Executable does not contain sealed native GUI payload v18.');
  }
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) {
    throw new SealedNativeGuiV18Error('Invalid sealed native GUI payload length.');
  }
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) {
    throw new SealedNativeGuiV18Error('Sealed native GUI payload CRC mismatch.');
  }
  inspectNativeGuiButtonImagesV18(payload);
  return new Uint8Array(payload);
}

export function inspectNativeGuiButtonImagesV18(payloadBytes) {
  const payload = toBytes(payloadBytes);
  if (payload.length < EXTENSION_TRAILER_SIZE) {
    throw new SealedNativeGuiV18Error('Payload v18 is missing the Button image extension trailer.');
  }
  const trailerOffset = payload.length - EXTENSION_TRAILER_SIZE;
  const magic = new TextDecoder().decode(payload.subarray(trailerOffset, trailerOffset + 4));
  if (magic !== PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_EXTENSION_MAGIC) {
    throw new SealedNativeGuiV18Error('Payload v18 has an invalid Button image extension trailer.');
  }
  const extensionLength = new DataView(payload.buffer, payload.byteOffset + trailerOffset, EXTENSION_TRAILER_SIZE).getUint32(4, true);
  if (extensionLength > trailerOffset || extensionLength > MAX_EXTENSION_BYTES) {
    throw new SealedNativeGuiV18Error('Payload v18 has an invalid Button image extension length.');
  }
  const extensionOffset = trailerOffset - extensionLength;
  const payloadV17 = new Uint8Array(payload.subarray(0, extensionOffset));
  if (!payloadV17.length) throw new SealedNativeGuiV18Error('Payload v18 is missing its payload-v17 compatibility prefix.');
  inspectNativeGuiPaintImagesV17(payloadV17);

  const reader = new Reader(payload.subarray(extensionOffset, trailerOffset));
  const assetCount = reader.u32();
  if (assetCount > MAX_ASSETS) throw new SealedNativeGuiV18Error('Payload v18 contains too many Button image assets.');
  const assets = [];
  const resourceIds = new Set();
  for (let index = 0; index < assetCount; index += 1) {
    const resourceId = reader.text();
    const mediaType = reader.text();
    const size = reader.u32();
    const sha256 = reader.text();
    const dataUri = reader.text();
    if (!RESOURCE_ID.test(resourceId) || resourceIds.has(resourceId)) {
      throw new SealedNativeGuiV18Error('Payload v18 contains invalid or duplicate Button image resource ids.');
    }
    if (!READY_MEDIA.has(mediaType)) throw new SealedNativeGuiV18Error(`Payload v18 Button image media type '${mediaType}' is unsupported.`);
    if (!SHA256.test(sha256)) throw new SealedNativeGuiV18Error('Payload v18 contains an invalid Button image SHA-256 value.');
    if (!dataUri.startsWith(`data:${mediaType};base64,`)) {
      throw new SealedNativeGuiV18Error(`Payload v18 Button image '${resourceId}' has an invalid data URI.`);
    }
    resourceIds.add(resourceId);
    assets.push(Object.freeze({ assetIndex: index, resourceId, mediaType, size, sha256, dataUri }));
  }

  const consumerCount = reader.u32();
  if (consumerCount > MAX_CONSUMERS) throw new SealedNativeGuiV18Error('Payload v18 contains too many Button image consumers.');
  const consumers = [];
  const nativeIndices = new Set();
  const controlIds = new Set();
  for (let index = 0; index < consumerCount; index += 1) {
    const nativeIndex = reader.u32();
    const controlId = reader.text();
    const imageListId = reader.text();
    const imageItem = reader.text();
    const assetIndex = reader.u32();
    const logicalWidth = reader.u32();
    const logicalHeight = reader.u32();
    if (!PATCH_NAME.test(controlId) || !PATCH_NAME.test(imageListId) || !PATCH_NAME.test(imageItem)) {
      throw new SealedNativeGuiV18Error('Payload v18 contains invalid Button image consumer names.');
    }
    if (nativeIndices.has(nativeIndex) || controlIds.has(controlId) || assetIndex >= assets.length) {
      throw new SealedNativeGuiV18Error('Payload v18 contains invalid or duplicate Button image consumer metadata.');
    }
    if (!logicalWidth || !logicalHeight || logicalWidth > 512 || logicalHeight > 512) {
      throw new SealedNativeGuiV18Error('Payload v18 contains invalid Button image logical dimensions.');
    }
    nativeIndices.add(nativeIndex);
    controlIds.add(controlId);
    consumers.push(Object.freeze({
      nativeIndex,
      controlId,
      imageListId,
      imageItem,
      assetIndex,
      resourceId: assets[assetIndex].resourceId,
      logicalWidth,
      logicalHeight
    }));
  }
  if (!reader.done()) throw new SealedNativeGuiV18Error('Payload v18 Button image extension contains trailing bytes.');
  return Object.freeze({
    payloadV17,
    assets: Object.freeze(assets),
    consumers: Object.freeze(consumers),
    extensionOffset,
    extensionLength
  });
}

export function inspectNativeGuiPaintImagesV18(payloadBytes) {
  return inspectNativeGuiPaintImagesV17(inspectNativeGuiButtonImagesV18(payloadBytes).payloadV17);
}

export function inspectNativeGuiPaintBoxesV18(payloadBytes) {
  return inspectNativeGuiPaintBoxesV17(inspectNativeGuiButtonImagesV18(payloadBytes).payloadV17);
}

export function inspectNativeGuiShapesV18(payloadBytes) {
  return inspectNativeGuiShapesV17(inspectNativeGuiButtonImagesV18(payloadBytes).payloadV17);
}

export function inspectNativeGuiChromeV18(payloadBytes) {
  return inspectNativeGuiChromeV17(inspectNativeGuiButtonImagesV18(payloadBytes).payloadV17);
}

export function inspectNativeGuiSlidersV18(payloadBytes) {
  return inspectNativeGuiSlidersV17(inspectNativeGuiButtonImagesV18(payloadBytes).payloadV17);
}

function encodeButtonImageExtension(adapted) {
  if (adapted.assets.length > MAX_ASSETS) throw new SealedNativeGuiV18Error('Payload v18 contains too many Button image assets.');
  if (adapted.consumers.length > MAX_CONSUMERS) throw new SealedNativeGuiV18Error('Payload v18 contains too many Button image consumers.');
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
    writer.u32(consumer.nativeIndex);
    writer.text(consumer.controlId);
    writer.text(consumer.imageListId);
    writer.text(consumer.imageItem);
    writer.u32(consumer.assetIndex);
    writer.u32(consumer.logicalWidth);
    writer.u32(consumer.logicalHeight);
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
    if (count < 0 || this.offset + count > this.bytes.length) throw new SealedNativeGuiV18Error('Malformed payload v18 Button image bytes.');
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
      throw new SealedNativeGuiV18Error('Payload v18 contains invalid UTF-8 text.');
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
      throw new SealedNativeGuiV18Error(`Payload v18 integer '${value}' is outside uint32 range.`);
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
    if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV18Error('Native GUI runtime template is not a Windows PE executable.');
    return;
  }
  if (platform === 'linux') {
    if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV18Error('Native GUI runtime template is not a Linux ELF executable.');
    return;
  }
  if (platform === 'macos') {
    const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : '';
    if (!new Set(['cffaedfe','feedfacf','cefaedfe','feedface','cafebabe','bebafeca','cafebabf','bfbafeca']).has(magic)) throw new SealedNativeGuiV18Error('Native GUI runtime template is not a macOS Mach-O executable.');
    return;
  }
  throw new SealedNativeGuiV18Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}

function hasFooter(bytes) {
  if (bytes.length < FOOTER_SIZE) return false;
  return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V18;
}
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
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
