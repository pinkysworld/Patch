import { adaptNativeSlidersForV13Backend } from './native-slider-backend-adapter.js?v=868f0784ca7f3972';
import { validateNativeGuiIRV13 } from './native-gui-ir-v13.js?v=868f0784ca7f3972';
import { encodeNativeGuiPayloadV12, inspectNativeGuiTreesV12 } from './sealed-native-gui-v12.js?v=868f0784ca7f3972';

export const PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION = 13;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V13 = 'PCHGUI01';
export const PATCH_SEALED_NATIVE_GUI_SLIDER_EXTENSION_MAGIC = 'PSL1';
const FOOTER_SIZE = 20;
const EXTENSION_TRAILER_SIZE = 8;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_SLIDERS = 1024;
const MAX_EVENT_PATCHES = 10000;
const MAX_SENTINELS = 10000;

export class SealedNativeGuiV13Error extends Error {}

/**
 * Payload v13 is an additive Slider transport over exact payload v12 bytes.
 * The v12 prefix carries private Input shadows and collision-free numeric
 * sentinels. The v1.4 runtime strips this extension, delegates the prefix to
 * frozen runtime v1.3, restores native Slider controls, and maps each recorded
 * sentinel back to the transient numeric event-local value before executing the
 * existing action engine.
 */
export function encodeNativeGuiPayloadV13(input) {
  const ir = validateNativeGuiIRV13(input);
  const adapted = adaptNativeSlidersForV13Backend(ir);
  const payloadV12 = encodeNativeGuiPayloadV12(adapted.compatibleIr);
  const extension = encodeSliderExtension(adapted);
  const trailer = new Uint8Array(EXTENSION_TRAILER_SIZE);
  trailer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_SLIDER_EXTENSION_MAGIC), 0);
  new DataView(trailer.buffer).setUint32(4, extension.length, true);
  const payload = concat([payloadV12, extension, trailer]);
  if (!payload.length || payload.length > MAX_PAYLOAD_BYTES) {
    throw new SealedNativeGuiV13Error(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  }
  return payload;
}

export function sealNativeGuiRuntimeV13(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  validateRuntimeHeader(runtime, options.platform ?? 'windows');
  if (hasFooter(runtime)) throw new SealedNativeGuiV13Error('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayloadV13(input);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V13), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayloadV13(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiV13Error('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  if (new TextDecoder().decode(footer.subarray(0, 8)) !== PATCH_SEALED_NATIVE_GUI_MAGIC_V13) {
    throw new SealedNativeGuiV13Error('Executable does not contain a sealed native GUI payload.');
  }
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION) {
    throw new SealedNativeGuiV13Error('Executable does not contain sealed native GUI payload v13.');
  }
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiV13Error('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiV13Error('Sealed native GUI payload CRC mismatch.');
  inspectNativeGuiSlidersV13(payload);
  return new Uint8Array(payload);
}

export function inspectNativeGuiSlidersV13(payloadBytes) {
  const payload = toBytes(payloadBytes);
  if (payload.length < EXTENSION_TRAILER_SIZE) throw new SealedNativeGuiV13Error('Payload v13 is missing the Slider extension trailer.');
  const trailerOffset = payload.length - EXTENSION_TRAILER_SIZE;
  const magic = new TextDecoder().decode(payload.subarray(trailerOffset, trailerOffset + 4));
  if (magic !== PATCH_SEALED_NATIVE_GUI_SLIDER_EXTENSION_MAGIC) throw new SealedNativeGuiV13Error('Payload v13 has an invalid Slider extension trailer.');
  const extensionLength = new DataView(payload.buffer, payload.byteOffset + trailerOffset, EXTENSION_TRAILER_SIZE).getUint32(4, true);
  if (extensionLength > trailerOffset) throw new SealedNativeGuiV13Error('Payload v13 has an invalid Slider extension length.');
  const extensionOffset = trailerOffset - extensionLength;
  const payloadV12 = new Uint8Array(payload.subarray(0, extensionOffset));
  if (!payloadV12.length) throw new SealedNativeGuiV13Error('Payload v13 is missing its payload-v12 compatibility prefix.');
  inspectNativeGuiTreesV12(payloadV12);

  const reader = new Reader(payload.subarray(extensionOffset, trailerOffset));
  const count = reader.u32();
  if (count > MAX_SLIDERS) throw new SealedNativeGuiV13Error('Payload v13 contains too many Sliders.');
  const sliders = [];
  const indices = new Set();
  const ids = new Set();
  const allSentinels = new Set();
  for (let sliderIndex = 0; sliderIndex < count; sliderIndex += 1) {
    const nativeIndex = reader.u32();
    const id = reader.text();
    const min = reader.f64();
    const max = reader.f64();
    const step = reader.f64();
    const bindingText = reader.text();
    if (!id || ids.has(id) || indices.has(nativeIndex) || !(min < max) || !(step > 0)) {
      throw new SealedNativeGuiV13Error('Payload v13 contains invalid Slider metadata.');
    }
    ids.add(id); indices.add(nativeIndex);
    const eventCount = reader.u32();
    if (eventCount > MAX_EVENT_PATCHES) throw new SealedNativeGuiV13Error(`Slider '${id}' contains too many event patches.`);
    const events = [];
    const eventIndices = new Set();
    for (let eventPatch = 0; eventPatch < eventCount; eventPatch += 1) {
      const eventIndex = reader.u32();
      if (eventIndices.has(eventIndex)) throw new SealedNativeGuiV13Error(`Slider '${id}' repeats event patch ${eventIndex}.`);
      eventIndices.add(eventIndex);
      const sentinelCount = reader.u32();
      if (sentinelCount > MAX_SENTINELS) throw new SealedNativeGuiV13Error(`Slider '${id}' contains too many event sentinels.`);
      const sentinels = [];
      for (let sentinelIndex = 0; sentinelIndex < sentinelCount; sentinelIndex += 1) {
        const sentinel = reader.f64();
        if (allSentinels.has(sentinel)) throw new SealedNativeGuiV13Error(`Slider '${id}' reuses an event sentinel.`);
        allSentinels.add(sentinel);
        sentinels.push(sentinel);
      }
      events.push({ eventIndex, sentinels });
    }
    sliders.push({ nativeIndex, id, min, max, step, binding: bindingText || null, events });
  }
  if (!reader.done()) throw new SealedNativeGuiV13Error('Payload v13 Slider extension contains trailing bytes.');
  return { payloadV12, sliders, extensionOffset, extensionLength };
}

function encodeSliderExtension(adapted) {
  if (adapted.sliders.length > MAX_SLIDERS) throw new SealedNativeGuiV13Error('Payload v13 contains too many Sliders.');
  const patchesByControl = new Map();
  for (const patch of adapted.eventPatches) {
    const list = patchesByControl.get(patch.control) ?? [];
    list.push(patch);
    patchesByControl.set(patch.control, list);
  }
  const writer = new Writer();
  writer.u32(adapted.sliders.length);
  for (const slider of adapted.sliders) {
    const patches = patchesByControl.get(slider.id) ?? [];
    writer.u32(slider.nativeIndex);
    writer.text(slider.id);
    writer.f64(slider.min); writer.f64(slider.max); writer.f64(slider.step);
    writer.text(slider.binding ?? '');
    writer.u32(patches.length);
    for (const patch of patches) {
      writer.u32(patch.eventIndex);
      writer.u32(patch.sentinels.length);
      for (const sentinel of patch.sentinels) writer.f64(sentinel);
    }
  }
  return writer.bytes();
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  need(count) { if (count < 0 || this.offset + count > this.bytes.length) throw new SealedNativeGuiV13Error('Malformed payload v13 Slider bytes.'); }
  u32() { this.need(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  f64() { this.need(8); const value = this.view.getFloat64(this.offset, true); this.offset += 8; if (!Number.isFinite(value)) throw new SealedNativeGuiV13Error('Payload v13 contains a non-finite Slider number.'); return value; }
  text() { const length = this.u32(); this.need(length); let value; try { value = new TextDecoder('utf-8', { fatal: true }).decode(this.bytes.subarray(this.offset, this.offset + length)); } catch { throw new SealedNativeGuiV13Error('Payload v13 contains invalid UTF-8 text.'); } this.offset += length; return value; }
  done() { return this.offset === this.bytes.length; }
}
class Writer {
  constructor() { this.parts = []; }
  push(bytes) { this.parts.push(bytes); }
  u32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); this.push(bytes); }
  f64(value) { const number = Number(value); if (!Number.isFinite(number)) throw new SealedNativeGuiV13Error('Slider metadata number must be finite.'); const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat64(0, number, true); this.push(bytes); }
  text(value) { const bytes = new TextEncoder().encode(String(value)); this.u32(bytes.length); this.push(bytes); }
  bytes() { return concat(this.parts); }
}

function validateRuntimeHeader(runtime, platform) {
  if (platform === 'windows') { if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV13Error('Native GUI runtime template is not a Windows PE executable.'); return; }
  if (platform === 'linux') { if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV13Error('Native GUI runtime template is not a Linux ELF executable.'); return; }
  if (platform === 'macos') { const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : ''; if (!new Set(['cffaedfe','feedfacf','cefaedfe','feedface','cafebabe','bebafeca','cafebabf','bfbafeca']).has(magic)) throw new SealedNativeGuiV13Error('Native GUI runtime template is not a macOS Mach-O executable.'); return; }
  throw new SealedNativeGuiV13Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}
function hasFooter(bytes) { if (bytes.length < FOOTER_SIZE) return false; return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V13; }
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) { const size = parts.reduce((total, part) => total + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
