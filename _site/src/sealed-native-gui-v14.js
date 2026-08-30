import { adaptNativeChromeForV14Backend } from './native-chrome-backend-adapter.js?v=868f0784ca7f3972';
import { validateNativeGuiIRV14 } from './native-gui-ir-v14.js?v=868f0784ca7f3972';
import { encodeNativeGuiPayloadV13, inspectNativeGuiSlidersV13 } from './sealed-native-gui-v13.js?v=868f0784ca7f3972';

export const PATCH_SEALED_NATIVE_GUI_CHROME_VERSION = 14;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V14 = 'PCHGUI01';
export const PATCH_SEALED_NATIVE_GUI_CHROME_EXTENSION_MAGIC = 'PCHC';
const FOOTER_SIZE = 20;
const EXTENSION_TRAILER_SIZE = 8;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_CHROME = 1024;
const MAX_EVENT_PATCHES = 10000;
const KIND = Object.freeze({ panel: 0, timer: 1, picture: 2, statusbar: 3 });
const KIND_NAME = Object.freeze(['panel', 'timer', 'picture', 'statusbar']);

export class SealedNativeGuiV14Error extends Error {}

/**
 * Payload v14 is an additive Chrome Stage 1 transport over exact payload v13 bytes.
 * The v13 prefix carries Panel/Timer/PictureBox/StatusBar as Text/Button shadows.
 * The v1.5 runtime strips this extension, delegates the prefix to runtime v1.4,
 * restores native GROUPBOX, WM_TIMER/NSTimer/g_timeout_add, STATIC/NSImageView/GtkImage
 * and STATUS/GtkStatusbar widgets, and maps Timer clicked shadows back to ticked.
 */
export function encodeNativeGuiPayloadV14(input) {
  const ir = validateNativeGuiIRV14(input);
  const adapted = adaptNativeChromeForV14Backend(ir);
  const payloadV13 = encodeNativeGuiPayloadV13(adapted.compatibleIr);
  const extension = encodeChromeExtension(adapted);
  const trailer = new Uint8Array(EXTENSION_TRAILER_SIZE);
  trailer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_CHROME_EXTENSION_MAGIC), 0);
  new DataView(trailer.buffer).setUint32(4, extension.length, true);
  const payload = concat([payloadV13, extension, trailer]);
  if (!payload.length || payload.length > MAX_PAYLOAD_BYTES) {
    throw new SealedNativeGuiV14Error(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  }
  return payload;
}

export function sealNativeGuiRuntimeV14(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  validateRuntimeHeader(runtime, options.platform ?? 'windows');
  if (hasFooter(runtime)) throw new SealedNativeGuiV14Error('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayloadV14(input);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V14), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_CHROME_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayloadV14(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiV14Error('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  if (new TextDecoder().decode(footer.subarray(0, 8)) !== PATCH_SEALED_NATIVE_GUI_MAGIC_V14) {
    throw new SealedNativeGuiV14Error('Executable does not contain a sealed native GUI payload.');
  }
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_CHROME_VERSION) {
    throw new SealedNativeGuiV14Error('Executable does not contain sealed native GUI payload v14.');
  }
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiV14Error('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiV14Error('Sealed native GUI payload CRC mismatch.');
  inspectNativeGuiChromeV14(payload);
  return new Uint8Array(payload);
}

export function inspectNativeGuiChromeV14(payloadBytes) {
  const payload = toBytes(payloadBytes);
  if (payload.length < EXTENSION_TRAILER_SIZE) throw new SealedNativeGuiV14Error('Payload v14 is missing the Chrome extension trailer.');
  const trailerOffset = payload.length - EXTENSION_TRAILER_SIZE;
  const magic = new TextDecoder().decode(payload.subarray(trailerOffset, trailerOffset + 4));
  if (magic !== PATCH_SEALED_NATIVE_GUI_CHROME_EXTENSION_MAGIC) throw new SealedNativeGuiV14Error('Payload v14 has an invalid Chrome extension trailer.');
  const extensionLength = new DataView(payload.buffer, payload.byteOffset + trailerOffset, EXTENSION_TRAILER_SIZE).getUint32(4, true);
  if (extensionLength > trailerOffset) throw new SealedNativeGuiV14Error('Payload v14 has an invalid Chrome extension length.');
  const extensionOffset = trailerOffset - extensionLength;
  const payloadV13 = new Uint8Array(payload.subarray(0, extensionOffset));
  if (!payloadV13.length) throw new SealedNativeGuiV14Error('Payload v14 is missing its payload-v13 compatibility prefix.');
  inspectNativeGuiSlidersV13(payloadV13);

  const reader = new Reader(payload.subarray(extensionOffset, trailerOffset));
  const count = reader.u32();
  if (count > MAX_CHROME) throw new SealedNativeGuiV14Error('Payload v14 contains too many Chrome controls.');
  const chrome = [];
  const indices = new Set();
  const ids = new Set();
  for (let chromeIndex = 0; chromeIndex < count; chromeIndex += 1) {
    const nativeIndex = reader.u32();
    const id = reader.text();
    const kind = reader.u32();
    const interval = reader.u32();
    const text = reader.text();
    const source = reader.text();
    const bindingText = reader.text();
    const childCount = reader.u32();
    if (!id || ids.has(id) || indices.has(nativeIndex) || kind > 3) {
      throw new SealedNativeGuiV14Error('Payload v14 contains invalid Chrome metadata.');
    }
    if (kind === KIND.timer && (!Number.isInteger(interval) || interval < 1 || interval > 3600000)) {
      throw new SealedNativeGuiV14Error(`Timer '${id}' has an invalid interval.`);
    }
    if (kind !== KIND.timer && interval !== 0) throw new SealedNativeGuiV14Error(`Chrome control '${id}' has a stray interval.`);
    if (kind === KIND.panel && childCount > MAX_CHROME) throw new SealedNativeGuiV14Error(`Panel '${id}' contains too many children.`);
    if (kind !== KIND.panel && childCount !== 0) throw new SealedNativeGuiV14Error(`Chrome control '${id}' has a stray child count.`);
    ids.add(id);
    indices.add(nativeIndex);
    const eventCount = reader.u32();
    if (eventCount > MAX_EVENT_PATCHES) throw new SealedNativeGuiV14Error(`Chrome control '${id}' contains too many event patches.`);
    const events = [];
    const eventIndices = new Set();
    for (let eventPatch = 0; eventPatch < eventCount; eventPatch += 1) {
      const eventIndex = reader.u32();
      const event = reader.text();
      if (eventIndices.has(eventIndex) || !event) throw new SealedNativeGuiV14Error(`Chrome control '${id}' repeats or omits event patch ${eventIndex}.`);
      eventIndices.add(eventIndex);
      events.push({ eventIndex, event });
    }
    chrome.push({
      nativeIndex,
      id,
      type: KIND_NAME[kind],
      interval,
      text,
      source,
      binding: bindingText || null,
      childCount,
      events
    });
  }
  if (!reader.done()) throw new SealedNativeGuiV14Error('Payload v14 Chrome extension contains trailing bytes.');
  return { payloadV13, chrome, extensionOffset, extensionLength };
}

export function inspectNativeGuiSlidersV14(payloadBytes) {
  return inspectNativeGuiSlidersV13(inspectNativeGuiChromeV14(payloadBytes).payloadV13);
}

function encodeChromeExtension(adapted) {
  if (adapted.chrome.length > MAX_CHROME) throw new SealedNativeGuiV14Error('Payload v14 contains too many Chrome controls.');
  const patchesByControl = new Map();
  for (const patch of adapted.eventPatches) {
    const list = patchesByControl.get(patch.control) ?? [];
    list.push(patch);
    patchesByControl.set(patch.control, list);
  }
  const writer = new Writer();
  writer.u32(adapted.chrome.length);
  for (const item of adapted.chrome) {
    const kind = KIND[item.type];
    if (kind === undefined) throw new SealedNativeGuiV14Error(`Unsupported Chrome type '${item.type}'.`);
    const patches = patchesByControl.get(item.id) ?? [];
    writer.u32(item.nativeIndex);
    writer.text(item.id);
    writer.u32(kind);
    writer.u32(item.type === 'timer' ? item.interval >>> 0 : 0);
    writer.text(item.text ?? '');
    writer.text(item.source ?? '');
    writer.text(item.binding ?? '');
    writer.u32(item.type === 'panel' ? (item.controls?.length ?? 0) : 0);
    writer.u32(patches.length);
    for (const patch of patches) {
      writer.u32(patch.eventIndex);
      writer.text(patch.event);
    }
  }
  return writer.bytes();
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  need(count) { if (count < 0 || this.offset + count > this.bytes.length) throw new SealedNativeGuiV14Error('Malformed payload v14 Chrome bytes.'); }
  u32() { this.need(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  text() { const length = this.u32(); this.need(length); let value; try { value = new TextDecoder('utf-8', { fatal: true }).decode(this.bytes.subarray(this.offset, this.offset + length)); } catch { throw new SealedNativeGuiV14Error('Payload v14 contains invalid UTF-8 text.'); } this.offset += length; return value; }
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
  if (platform === 'windows') { if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV14Error('Native GUI runtime template is not a Windows PE executable.'); return; }
  if (platform === 'linux') { if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV14Error('Native GUI runtime template is not a Linux ELF executable.'); return; }
  if (platform === 'macos') { const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : ''; if (!new Set(['cffaedfe','feedfacf','cefaedfe','feedface','cafebabe','bebafeca','cafebabf','bfbafeca']).has(magic)) throw new SealedNativeGuiV14Error('Native GUI runtime template is not a macOS Mach-O executable.'); return; }
  throw new SealedNativeGuiV14Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}
function hasFooter(bytes) { if (bytes.length < FOOTER_SIZE) return false; return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V14; }
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) { const size = parts.reduce((total, part) => total + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
