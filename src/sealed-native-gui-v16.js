import { adaptNativePaintBoxForV16Backend } from './native-paintbox-backend-adapter.js';
import { validateNativeGuiIRV16 } from './native-gui-ir-v16.js';
import { encodeNativeGuiPayloadV15, inspectNativeGuiShapesV15 } from './sealed-native-gui-v15.js';
import { normalizePatchPaintCommand } from './paintbox-control.js';

export const PATCH_SEALED_NATIVE_GUI_PAINTBOX_VERSION = 16;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V16 = 'PCHGUI01';
export const PATCH_SEALED_NATIVE_GUI_PAINTBOX_EXTENSION_MAGIC = 'PPBX';
const FOOTER_SIZE = 20;
const EXTENSION_TRAILER_SIZE = 8;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_PAINTBOXES = 1024;
const MAX_PAINT_NODES = 10000;
const MAX_PAINT_DEPTH = 32;
const NODE_DRAW = 0;
const NODE_IF = 1;
const NODE_REPEAT = 2;
const DRAW_KIND = Object.freeze({ clear: 0, line: 1, rectangle: 2, ellipse: 3, text: 4 });
const DRAW_NAME = Object.freeze(['clear', 'line', 'rectangle', 'ellipse', 'text']);

export class SealedNativeGuiV16Error extends Error {}

/** Payload v16 is an additive pure PaintBox program transport over exact payload v15 bytes. */
export function encodeNativeGuiPayloadV16(input) {
  const ir = validateNativeGuiIRV16(input);
  const adapted = adaptNativePaintBoxForV16Backend(ir);
  const payloadV15 = encodeNativeGuiPayloadV15(adapted.compatibleIr);
  const extension = encodePaintBoxExtension(adapted);
  const trailer = new Uint8Array(EXTENSION_TRAILER_SIZE);
  trailer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_PAINTBOX_EXTENSION_MAGIC), 0);
  new DataView(trailer.buffer).setUint32(4, extension.length, true);
  const payload = concat([payloadV15, extension, trailer]);
  if (!payload.length || payload.length > MAX_PAYLOAD_BYTES) throw new SealedNativeGuiV16Error(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  return payload;
}

export function sealNativeGuiRuntimeV16(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  validateRuntimeHeader(runtime, options.platform ?? 'windows');
  if (hasFooter(runtime)) throw new SealedNativeGuiV16Error('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayloadV16(input);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V16), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_PAINTBOX_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayloadV16(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiV16Error('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  if (new TextDecoder().decode(footer.subarray(0, 8)) !== PATCH_SEALED_NATIVE_GUI_MAGIC_V16) throw new SealedNativeGuiV16Error('Executable does not contain a sealed native GUI payload.');
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_PAINTBOX_VERSION) throw new SealedNativeGuiV16Error('Executable does not contain sealed native GUI payload v16.');
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiV16Error('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiV16Error('Sealed native GUI payload CRC mismatch.');
  inspectNativeGuiPaintBoxesV16(payload);
  return new Uint8Array(payload);
}

export function inspectNativeGuiPaintBoxesV16(payloadBytes) {
  const payload = toBytes(payloadBytes);
  if (payload.length < EXTENSION_TRAILER_SIZE) throw new SealedNativeGuiV16Error('Payload v16 is missing the PaintBox extension trailer.');
  const trailerOffset = payload.length - EXTENSION_TRAILER_SIZE;
  const magic = new TextDecoder().decode(payload.subarray(trailerOffset, trailerOffset + 4));
  if (magic !== PATCH_SEALED_NATIVE_GUI_PAINTBOX_EXTENSION_MAGIC) throw new SealedNativeGuiV16Error('Payload v16 has an invalid PaintBox extension trailer.');
  const extensionLength = new DataView(payload.buffer, payload.byteOffset + trailerOffset, EXTENSION_TRAILER_SIZE).getUint32(4, true);
  if (extensionLength > trailerOffset) throw new SealedNativeGuiV16Error('Payload v16 has an invalid PaintBox extension length.');
  const extensionOffset = trailerOffset - extensionLength;
  const payloadV15 = new Uint8Array(payload.subarray(0, extensionOffset));
  if (!payloadV15.length) throw new SealedNativeGuiV16Error('Payload v16 is missing its payload-v15 compatibility prefix.');
  inspectNativeGuiShapesV15(payloadV15);

  const reader = new Reader(payload.subarray(extensionOffset, trailerOffset));
  const count = reader.u32();
  if (count > MAX_PAINTBOXES) throw new SealedNativeGuiV16Error('Payload v16 contains too many PaintBox controls.');
  const paintboxes = [];
  const ids = new Set();
  const indices = new Set();
  for (let index = 0; index < count; index += 1) {
    const nativeIndex = reader.u32();
    const id = reader.text();
    if (!id || ids.has(id) || indices.has(nativeIndex)) throw new SealedNativeGuiV16Error('Payload v16 contains invalid PaintBox metadata.');
    ids.add(id); indices.add(nativeIndex);
    const budget = { nodes: 0 };
    const paintProgram = readProgram(reader, 0, budget);
    paintboxes.push({ nativeIndex, id, type: 'paintbox', paintProgram });
  }
  if (!reader.done()) throw new SealedNativeGuiV16Error('Payload v16 PaintBox extension contains trailing bytes.');
  return { payloadV15, paintboxes, extensionOffset, extensionLength };
}

export function inspectNativeGuiShapesV16(payloadBytes) {
  return inspectNativeGuiShapesV15(inspectNativeGuiPaintBoxesV16(payloadBytes).payloadV15);
}

function encodePaintBoxExtension(adapted) {
  if (adapted.paintboxes.length > MAX_PAINTBOXES) throw new SealedNativeGuiV16Error('Payload v16 contains too many PaintBox controls.');
  const writer = new Writer();
  writer.u32(adapted.paintboxes.length);
  for (const item of adapted.paintboxes) {
    writer.u32(item.nativeIndex);
    writer.text(item.id);
    const budget = { nodes: 0 };
    writeProgram(writer, item.paintProgram ?? [], 0, budget);
  }
  return writer.bytes();
}

function writeProgram(writer, nodes, depth, budget) {
  if (!Array.isArray(nodes) || depth > MAX_PAINT_DEPTH) throw new SealedNativeGuiV16Error('PaintBox program exceeds the native nesting limit.');
  writer.u32(nodes.length);
  for (const node of nodes) {
    if (++budget.nodes > MAX_PAINT_NODES) throw new SealedNativeGuiV16Error('PaintBox program exceeds the native statement limit.');
    if (node.kind === 'draw') {
      writer.u8(NODE_DRAW);
      writeDraw(writer, node.command);
    } else if (node.kind === 'if') {
      writer.u8(NODE_IF);
      writer.text(node.expr);
      writeProgram(writer, node.then ?? [], depth + 1, budget);
      writeProgram(writer, node.else ?? [], depth + 1, budget);
    } else if (node.kind === 'repeat') {
      writer.u8(NODE_REPEAT);
      writer.text(node.expr);
      writeProgram(writer, node.body ?? [], depth + 1, budget);
    } else {
      throw new SealedNativeGuiV16Error(`Unsupported PaintBox node '${node.kind ?? '?'}'.`);
    }
  }
}

function readProgram(reader, depth, budget) {
  if (depth > MAX_PAINT_DEPTH) throw new SealedNativeGuiV16Error('Payload v16 PaintBox nesting exceeds the native limit.');
  const count = reader.u32();
  if (count > MAX_PAINT_NODES) throw new SealedNativeGuiV16Error('Payload v16 PaintBox block contains too many statements.');
  const out = [];
  for (let index = 0; index < count; index += 1) {
    if (++budget.nodes > MAX_PAINT_NODES) throw new SealedNativeGuiV16Error('Payload v16 PaintBox program contains too many statements.');
    const kind = reader.u8();
    if (kind === NODE_DRAW) out.push({ kind: 'draw', command: readDraw(reader) });
    else if (kind === NODE_IF) out.push({ kind: 'if', expr: reader.text(), then: readProgram(reader, depth + 1, budget), else: readProgram(reader, depth + 1, budget) });
    else if (kind === NODE_REPEAT) out.push({ kind: 'repeat', expr: reader.text(), body: readProgram(reader, depth + 1, budget) });
    else throw new SealedNativeGuiV16Error(`Payload v16 contains unknown PaintBox node kind ${kind}.`);
  }
  return out;
}

function writeDraw(writer, commandInput) {
  const command = normalizePatchPaintCommand(commandInput);
  const kind = DRAW_KIND[command.operation];
  if (kind === undefined) throw new SealedNativeGuiV16Error(`Unsupported PaintBox draw operation '${command.operation}'.`);
  writer.u8(kind);
  if (command.operation === 'clear') { writer.text(command.color); return; }
  if (command.operation === 'line') {
    writer.f64(command.x1); writer.f64(command.y1); writer.f64(command.x2); writer.f64(command.y2); writer.text(command.stroke); writer.f64(command.strokeWidth); return;
  }
  if (command.operation === 'rectangle' || command.operation === 'ellipse') {
    writer.f64(command.x); writer.f64(command.y); writer.f64(command.width); writer.f64(command.height); writer.text(command.fill); writer.text(command.stroke); writer.f64(command.strokeWidth); return;
  }
  writer.text(command.textExpr); writer.f64(command.x); writer.f64(command.y); writer.text(command.color); writer.f64(command.fontSize);
}

function readDraw(reader) {
  const kind = reader.u8();
  const operation = DRAW_NAME[kind];
  if (!operation) throw new SealedNativeGuiV16Error(`Payload v16 contains unknown PaintBox draw operation ${kind}.`);
  let command;
  if (operation === 'clear') command = { operation, color: reader.text() };
  else if (operation === 'line') command = { operation, x1: reader.f64(), y1: reader.f64(), x2: reader.f64(), y2: reader.f64(), stroke: reader.text(), strokeWidth: reader.f64() };
  else if (operation === 'rectangle' || operation === 'ellipse') command = { operation, x: reader.f64(), y: reader.f64(), width: reader.f64(), height: reader.f64(), fill: reader.text(), stroke: reader.text(), strokeWidth: reader.f64() };
  else command = { operation, textExpr: reader.text(), x: reader.f64(), y: reader.f64(), color: reader.text(), fontSize: reader.f64() };
  try { return { ...normalizePatchPaintCommand(command) }; }
  catch (error) { throw new SealedNativeGuiV16Error(`Payload v16 contains invalid PaintBox draw metadata: ${error?.message ?? error}`); }
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  need(count) { if (count < 0 || this.offset + count > this.bytes.length) throw new SealedNativeGuiV16Error('Malformed payload v16 PaintBox bytes.'); }
  u8() { this.need(1); return this.bytes[this.offset++]; }
  u32() { this.need(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  f64() { this.need(8); const value = this.view.getFloat64(this.offset, true); this.offset += 8; if (!Number.isFinite(value)) throw new SealedNativeGuiV16Error('Payload v16 contains a non-finite PaintBox number.'); return value; }
  text() { const length = this.u32(); this.need(length); let value; try { value = new TextDecoder('utf-8', { fatal: true }).decode(this.bytes.subarray(this.offset, this.offset + length)); } catch { throw new SealedNativeGuiV16Error('Payload v16 contains invalid UTF-8 text.'); } this.offset += length; return value; }
  done() { return this.offset === this.bytes.length; }
}
class Writer {
  constructor() { this.parts = []; }
  push(bytes) { this.parts.push(bytes); }
  u8(value) { this.push(Uint8Array.of(value & 0xff)); }
  u32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); this.push(bytes); }
  f64(value) { const number = Number(value); if (!Number.isFinite(number)) throw new SealedNativeGuiV16Error('PaintBox numeric metadata is not finite.'); const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat64(0, number, true); this.push(bytes); }
  text(value) { const bytes = new TextEncoder().encode(String(value)); this.u32(bytes.length); this.push(bytes); }
  bytes() { return concat(this.parts); }
}

function validateRuntimeHeader(runtime, platform) {
  if (platform === 'windows') { if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV16Error('Native GUI runtime template is not a Windows PE executable.'); return; }
  if (platform === 'linux') { if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV16Error('Native GUI runtime template is not a Linux ELF executable.'); return; }
  if (platform === 'macos') { const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : ''; if (!new Set(['cffaedfe','feedfacf','cefaedfe','feedface','cafebabe','bebafeca','cafebabf','bfbafeca']).has(magic)) throw new SealedNativeGuiV16Error('Native GUI runtime template is not a macOS Mach-O executable.'); return; }
  throw new SealedNativeGuiV16Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}
function hasFooter(bytes) { if (bytes.length < FOOTER_SIZE) return false; return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V16; }
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) { const size = parts.reduce((total, part) => total + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
