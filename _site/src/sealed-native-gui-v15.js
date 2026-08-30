import { adaptNativeShapeForV15Backend } from './native-shape-backend-adapter.js?v=868f0784ca7f3972';
import { validateNativeGuiIRV15 } from './native-gui-ir-v15.js?v=868f0784ca7f3972';
import { encodeNativeGuiPayloadV14, inspectNativeGuiChromeV14, inspectNativeGuiSlidersV14 } from './sealed-native-gui-v14.js?v=868f0784ca7f3972';
import { PATCH_SHAPE_KINDS } from './shape-control.js?v=868f0784ca7f3972';

export const PATCH_SEALED_NATIVE_GUI_SHAPE_VERSION = 15;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V15 = 'PCHGUI01';
export const PATCH_SEALED_NATIVE_GUI_SHAPE_EXTENSION_MAGIC = 'PSHP';
const FOOTER_SIZE = 20;
const EXTENSION_TRAILER_SIZE = 8;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_SHAPES = 1024;
const KIND = Object.freeze(Object.fromEntries(PATCH_SHAPE_KINDS.map((kind, index) => [kind, index])));
const KIND_NAME = PATCH_SHAPE_KINDS;

export class SealedNativeGuiV15Error extends Error {}

/**
 * Payload v15 is an additive Shape Stage 1 transport over exact payload v14 bytes.
 * The v14 prefix carries Shape as Text shadows. Runtime v1.6 strips this extension,
 * delegates the prefix to runtime v1.5, and restores native GDI / AppKit / GTK drawing.
 */
export function encodeNativeGuiPayloadV15(input) {
  const ir = validateNativeGuiIRV15(input);
  const adapted = adaptNativeShapeForV15Backend(ir);
  const payloadV14 = encodeNativeGuiPayloadV14(adapted.compatibleIr);
  const extension = encodeShapeExtension(adapted);
  const trailer = new Uint8Array(EXTENSION_TRAILER_SIZE);
  trailer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_SHAPE_EXTENSION_MAGIC), 0);
  new DataView(trailer.buffer).setUint32(4, extension.length, true);
  const payload = concat([payloadV14, extension, trailer]);
  if (!payload.length || payload.length > MAX_PAYLOAD_BYTES) {
    throw new SealedNativeGuiV15Error(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  }
  return payload;
}

export function sealNativeGuiRuntimeV15(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  validateRuntimeHeader(runtime, options.platform ?? 'windows');
  if (hasFooter(runtime)) throw new SealedNativeGuiV15Error('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayloadV15(input);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V15), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_SHAPE_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayloadV15(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiV15Error('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  if (new TextDecoder().decode(footer.subarray(0, 8)) !== PATCH_SEALED_NATIVE_GUI_MAGIC_V15) {
    throw new SealedNativeGuiV15Error('Executable does not contain a sealed native GUI payload.');
  }
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_SHAPE_VERSION) {
    throw new SealedNativeGuiV15Error('Executable does not contain sealed native GUI payload v15.');
  }
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiV15Error('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiV15Error('Sealed native GUI payload CRC mismatch.');
  inspectNativeGuiShapesV15(payload);
  return new Uint8Array(payload);
}

export function inspectNativeGuiShapesV15(payloadBytes) {
  const payload = toBytes(payloadBytes);
  if (payload.length < EXTENSION_TRAILER_SIZE) throw new SealedNativeGuiV15Error('Payload v15 is missing the Shape extension trailer.');
  const trailerOffset = payload.length - EXTENSION_TRAILER_SIZE;
  const magic = new TextDecoder().decode(payload.subarray(trailerOffset, trailerOffset + 4));
  if (magic !== PATCH_SEALED_NATIVE_GUI_SHAPE_EXTENSION_MAGIC) throw new SealedNativeGuiV15Error('Payload v15 has an invalid Shape extension trailer.');
  const extensionLength = new DataView(payload.buffer, payload.byteOffset + trailerOffset, EXTENSION_TRAILER_SIZE).getUint32(4, true);
  if (extensionLength > trailerOffset) throw new SealedNativeGuiV15Error('Payload v15 has an invalid Shape extension length.');
  const extensionOffset = trailerOffset - extensionLength;
  const payloadV14 = new Uint8Array(payload.subarray(0, extensionOffset));
  if (!payloadV14.length) throw new SealedNativeGuiV15Error('Payload v15 is missing its payload-v14 compatibility prefix.');
  inspectNativeGuiChromeV14(payloadV14);

  const reader = new Reader(payload.subarray(extensionOffset, trailerOffset));
  const count = reader.u32();
  if (count > MAX_SHAPES) throw new SealedNativeGuiV15Error('Payload v15 contains too many Shape controls.');
  const shapes = [];
  const indices = new Set();
  const ids = new Set();
  for (let shapeIndex = 0; shapeIndex < count; shapeIndex += 1) {
    const nativeIndex = reader.u32();
    const id = reader.text();
    const kind = reader.u32();
    const fill = reader.text();
    const stroke = reader.text();
    const strokeWidth = reader.text();
    const cornerRadius = reader.text();
    const opacity = reader.text();
    if (!id || ids.has(id) || indices.has(nativeIndex) || kind > 3 || !KIND_NAME[kind]) {
      throw new SealedNativeGuiV15Error('Payload v15 contains invalid Shape metadata.');
    }
    ids.add(id);
    indices.add(nativeIndex);
    shapes.push({
      nativeIndex,
      id,
      type: 'shape',
      shapeKind: KIND_NAME[kind],
      fill,
      stroke,
      strokeWidth,
      cornerRadius,
      opacity
    });
  }
  if (!reader.done()) throw new SealedNativeGuiV15Error('Payload v15 Shape extension contains trailing bytes.');
  return { payloadV14, shapes, extensionOffset, extensionLength };
}

export function inspectNativeGuiChromeV15(payloadBytes) {
  return inspectNativeGuiChromeV14(inspectNativeGuiShapesV15(payloadBytes).payloadV14);
}

export function inspectNativeGuiSlidersV15(payloadBytes) {
  return inspectNativeGuiSlidersV14(inspectNativeGuiShapesV15(payloadBytes).payloadV14);
}

function encodeShapeExtension(adapted) {
  if (adapted.shapes.length > MAX_SHAPES) throw new SealedNativeGuiV15Error('Payload v15 contains too many Shape controls.');
  const writer = new Writer();
  writer.u32(adapted.shapes.length);
  for (const item of adapted.shapes) {
    const kind = KIND[item.shapeKind];
    if (kind === undefined) throw new SealedNativeGuiV15Error(`Unsupported Shape kind '${item.shapeKind}'.`);
    writer.u32(item.nativeIndex);
    writer.text(item.id);
    writer.u32(kind);
    writer.text(item.fill ?? '');
    writer.text(item.stroke ?? '');
    writer.text(formatNumber(item.strokeWidth));
    writer.text(formatNumber(item.cornerRadius));
    writer.text(formatNumber(item.opacity));
  }
  return writer.bytes();
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new SealedNativeGuiV15Error('Shape numeric property is not finite.');
  return String(number);
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  need(count) { if (count < 0 || this.offset + count > this.bytes.length) throw new SealedNativeGuiV15Error('Malformed payload v15 Shape bytes.'); }
  u32() { this.need(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  text() { const length = this.u32(); this.need(length); let value; try { value = new TextDecoder('utf-8', { fatal: true }).decode(this.bytes.subarray(this.offset, this.offset + length)); } catch { throw new SealedNativeGuiV15Error('Payload v15 contains invalid UTF-8 text.'); } this.offset += length; return value; }
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
  if (platform === 'windows') { if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV15Error('Native GUI runtime template is not a Windows PE executable.'); return; }
  if (platform === 'linux') { if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV15Error('Native GUI runtime template is not a Linux ELF executable.'); return; }
  if (platform === 'macos') { const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : ''; if (!new Set(['cffaedfe','feedfacf','cefaedfe','feedface','cafebabe','bebafeca','cafebabf','bfbafeca']).has(magic)) throw new SealedNativeGuiV15Error('Native GUI runtime template is not a macOS Mach-O executable.'); return; }
  throw new SealedNativeGuiV15Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}
function hasFooter(bytes) { if (bytes.length < FOOTER_SIZE) return false; return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V15; }
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) { const size = parts.reduce((total, part) => total + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
