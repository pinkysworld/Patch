import { adaptNativeImageListForV18Backend } from './native-imagelist-backend-adapter.js';
import { validateNativeGuiIRV18 } from './native-gui-ir-v18.js';
import {
  encodeNativeGuiPayloadV17,
  inspectNativeGuiPaintImagesV17,
  inspectNativeGuiPaintBoxesV17,
  inspectNativeGuiShapesV17,
  inspectNativeGuiChromeV17,
  inspectNativeGuiSlidersV17
} from './sealed-native-gui-v17.js';

export const PATCH_SEALED_NATIVE_GUI_IMAGELIST_VERSION = 18;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V18 = 'PCHGUI01';
export const PATCH_SEALED_NATIVE_GUI_IMAGELIST_EXTENSION_MAGIC = 'PILT';
const FOOTER_SIZE = 20;
const EXTENSION_TRAILER_SIZE = 8;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_LISTS = 256;
const MAX_ITEMS = 256;
const MAX_BUTTONS = 1024;
const MIN_LOGICAL_SIZE = 1;
const MAX_LOGICAL_SIZE = 512;

export class SealedNativeGuiV18Error extends Error {}

/**
 * Payload v18 is an additive ImageList / Button-image transport over exact payload v17 bytes.
 * The v17 prefix remains fail-closed for ImageList. Runtime v1.9 strips this extension,
 * delegates the prefix to runtime v1.8, and overlays PNG/JPEG Button images.
 */
export function encodeNativeGuiPayloadV18(input) {
  const ir = validateNativeGuiIRV18(input);
  const adapted = adaptNativeImageListForV18Backend(ir);
  const payloadV17 = encodeNativeGuiPayloadV17(adapted.compatibleIr);
  const extension = encodeImageListExtension(adapted);
  const trailer = new Uint8Array(EXTENSION_TRAILER_SIZE);
  trailer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_IMAGELIST_EXTENSION_MAGIC), 0);
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
  const payload = encodeNativeGuiPayloadV18(input);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V18), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_IMAGELIST_VERSION, true);
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
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_IMAGELIST_VERSION) {
    throw new SealedNativeGuiV18Error('Executable does not contain sealed native GUI payload v18.');
  }
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiV18Error('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiV18Error('Sealed native GUI payload CRC mismatch.');
  inspectNativeGuiImageListsV18(payload);
  return new Uint8Array(payload);
}

export function inspectNativeGuiImageListsV18(payloadBytes) {
  const payload = toBytes(payloadBytes);
  if (payload.length < EXTENSION_TRAILER_SIZE) throw new SealedNativeGuiV18Error('Payload v18 is missing the ImageList extension trailer.');
  const trailerOffset = payload.length - EXTENSION_TRAILER_SIZE;
  const magic = new TextDecoder().decode(payload.subarray(trailerOffset, trailerOffset + 4));
  if (magic !== PATCH_SEALED_NATIVE_GUI_IMAGELIST_EXTENSION_MAGIC) throw new SealedNativeGuiV18Error('Payload v18 has an invalid ImageList extension trailer.');
  const extensionLength = new DataView(payload.buffer, payload.byteOffset + trailerOffset, EXTENSION_TRAILER_SIZE).getUint32(4, true);
  if (extensionLength > trailerOffset) throw new SealedNativeGuiV18Error('Payload v18 has an invalid ImageList extension length.');
  const extensionOffset = trailerOffset - extensionLength;
  const payloadV17 = new Uint8Array(payload.subarray(0, extensionOffset));
  if (!payloadV17.length) throw new SealedNativeGuiV18Error('Payload v18 is missing its payload-v17 compatibility prefix.');
  inspectNativeGuiPaintImagesV17(payloadV17);

  const reader = new Reader(payload.subarray(extensionOffset, trailerOffset));
  const listCount = reader.u32();
  if (listCount > MAX_LISTS) throw new SealedNativeGuiV18Error('Payload v18 contains too many ImageLists.');
  const imageLists = [];
  const listsById = new Map();
  for (let index = 0; index < listCount; index += 1) {
    const id = reader.text();
    const width = reader.u32();
    const height = reader.u32();
    const itemCount = reader.u32();
    if (!id || listsById.has(id) || itemCount > MAX_ITEMS ||
        width < MIN_LOGICAL_SIZE || width > MAX_LOGICAL_SIZE ||
        height < MIN_LOGICAL_SIZE || height > MAX_LOGICAL_SIZE) {
      throw new SealedNativeGuiV18Error('Payload v18 contains invalid ImageList metadata.');
    }
    const items = [];
    const itemsByName = new Map();
    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      const name = reader.text();
      const resourceId = reader.text();
      const source = reader.text();
      if (!name || itemsByName.has(name) || !resourceId || !source) {
        throw new SealedNativeGuiV18Error('Payload v18 contains invalid ImageList item metadata.');
      }
      const item = { name, resourceId, source };
      items.push(item);
      itemsByName.set(name, item);
    }
    const list = { id, width, height, items, itemsByName };
    imageLists.push({ id, width, height, items });
    listsById.set(id, list);
  }
  const buttonCount = reader.u32();
  if (buttonCount > MAX_BUTTONS) throw new SealedNativeGuiV18Error('Payload v18 contains too many Button image overlays.');
  const buttons = [];
  const indices = new Set();
  const buttonIds = new Set();
  for (let index = 0; index < buttonCount; index += 1) {
    const nativeIndex = reader.u32();
    const id = reader.text();
    const imageListId = reader.text();
    const imageItem = reader.text();
    const source = reader.text();
    const width = reader.u32();
    const height = reader.u32();
    if (!id || buttonIds.has(id) || indices.has(nativeIndex) || !imageListId || !imageItem || !source) {
      throw new SealedNativeGuiV18Error('Payload v18 contains invalid Button image metadata.');
    }
    const list = listsById.get(imageListId);
    if (!list) throw new SealedNativeGuiV18Error(`Payload v18 Button '${id}' refers to a missing ImageList.`);
    const item = list.itemsByName.get(imageItem);
    if (!item) throw new SealedNativeGuiV18Error(`Payload v18 Button '${id}' refers to a missing ImageList item.`);
    if (source !== item.source) throw new SealedNativeGuiV18Error(`Payload v18 Button '${id}' image source does not match ${imageListId}.${imageItem}.`);
    if (width !== list.width || height !== list.height) {
      throw new SealedNativeGuiV18Error(`Payload v18 Button '${id}' image size does not match ImageList '${imageListId}'.`);
    }
    buttonIds.add(id);
    indices.add(nativeIndex);
    buttons.push({ nativeIndex, id, imageListId, imageItem, source, width, height });
  }
  if (!reader.done()) throw new SealedNativeGuiV18Error('Payload v18 ImageList extension contains trailing bytes.');
  return { payloadV17, imageLists, buttons, extensionOffset, extensionLength };
}

export function inspectNativeGuiPaintImagesV18(payloadBytes) {
  return inspectNativeGuiPaintImagesV17(inspectNativeGuiImageListsV18(payloadBytes).payloadV17);
}

export function inspectNativeGuiPaintBoxesV18(payloadBytes) {
  return inspectNativeGuiPaintBoxesV17(inspectNativeGuiImageListsV18(payloadBytes).payloadV17);
}

export function inspectNativeGuiShapesV18(payloadBytes) {
  return inspectNativeGuiShapesV17(inspectNativeGuiImageListsV18(payloadBytes).payloadV17);
}

export function inspectNativeGuiChromeV18(payloadBytes) {
  return inspectNativeGuiChromeV17(inspectNativeGuiImageListsV18(payloadBytes).payloadV17);
}

export function inspectNativeGuiSlidersV18(payloadBytes) {
  return inspectNativeGuiSlidersV17(inspectNativeGuiImageListsV18(payloadBytes).payloadV17);
}

function encodeImageListExtension(adapted) {
  if (adapted.imageLists.length > MAX_LISTS) throw new SealedNativeGuiV18Error('Payload v18 contains too many ImageLists.');
  if (adapted.buttons.length > MAX_BUTTONS) throw new SealedNativeGuiV18Error('Payload v18 contains too many Button image overlays.');
  const writer = new Writer();
  writer.u32(adapted.imageLists.length);
  for (const list of adapted.imageLists) {
    if ((list.items ?? []).length > MAX_ITEMS) throw new SealedNativeGuiV18Error(`Payload v18 ImageList '${list.id}' is too large.`);
    writer.text(list.id);
    writer.u32(list.width);
    writer.u32(list.height);
    writer.u32(list.items.length);
    for (const item of list.items) {
      writer.text(item.name);
      writer.text(item.resourceId);
      writer.text(item.source ?? '');
    }
  }
  writer.u32(adapted.buttons.length);
  for (const button of adapted.buttons) {
    writer.u32(button.nativeIndex);
    writer.text(button.id);
    writer.text(button.imageListId);
    writer.text(button.imageItem);
    writer.text(button.source);
    writer.u32(button.width);
    writer.u32(button.height);
  }
  return writer.bytes();
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  need(count) {
    if (!Number.isInteger(count) || count < 0 || this.offset > this.bytes.length || count > this.bytes.length - this.offset) {
      throw new SealedNativeGuiV18Error('Malformed payload v18 ImageList bytes.');
    }
  }
  u32() { this.need(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  text() {
    const length = this.u32();
    this.need(length);
    let value;
    try { value = new TextDecoder('utf-8', { fatal: true }).decode(this.bytes.subarray(this.offset, this.offset + length)); }
    catch { throw new SealedNativeGuiV18Error('Payload v18 contains invalid UTF-8 text.'); }
    this.offset += length;
    return value;
  }
  done() { return this.offset === this.bytes.length; }
}
class Writer {
  constructor() { this.parts = []; }
  push(bytes) { this.parts.push(bytes); }
  u32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); this.push(bytes); }
  text(value) { const bytes = new TextEncoder().encode(String(value)); this.u32(bytes.length); this.push(bytes); }
  bytes() { return concat(this.parts); }
}

function validateRuntimeHeader(runtime, platform) {
  if (platform === 'windows') { if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV18Error('Native GUI runtime template is not a Windows PE executable.'); return; }
  if (platform === 'linux') { if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV18Error('Native GUI runtime template is not a Linux ELF executable.'); return; }
  if (platform === 'macos') { const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : ''; if (!new Set(['cffaedfe','feedfacf','cefaedfe','feedface','cafebabe','bebafeca','cafebabf','bfbafeca']).has(magic)) throw new SealedNativeGuiV18Error('Native GUI runtime template is not a macOS Mach-O executable.'); return; }
  throw new SealedNativeGuiV18Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}
function hasFooter(bytes) { if (bytes.length < FOOTER_SIZE) return false; return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V18; }
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) { const size = parts.reduce((total, part) => total + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
