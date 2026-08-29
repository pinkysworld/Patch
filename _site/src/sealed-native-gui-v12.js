import { adaptNativeTreesForV12Backend } from './native-tree-backend-adapter.js?v=9ad29318e93c7c71';
import { validateNativeGuiIRV12 } from './native-gui-ir-v12.js?v=9ad29318e93c7c71';
import { encodeNativeGuiPayloadV11 } from './native-gui-frozen-seal.js?v=9ad29318e93c7c71';

export const PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V12 = 'PCHGUI01';
const FOOTER_SIZE = 20;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_TREE_COUNT = 1024;
const MAX_TREE_NODES = 10000;

export class SealedNativeGuiV12Error extends Error {}

/**
 * Payload v12 is an additive TreeView transport over frozen payload v11.
 * The v11 prefix carries a private multi-select ListBox shadow so the existing
 * event/action engine remains authoritative. A Tree metadata block is inserted
 * between Forms and Events; runtime v1.3 removes that block before delegating to
 * runtime v1.2 and projects native Tree selection into the private shadow.
 */
export function encodeNativeGuiPayloadV12(input) {
  const ir = validateNativeGuiIRV12(input);
  const adapted = adaptNativeTreesForV12Backend(ir);
  const payloadV11 = encodeNativeGuiPayloadV11(adapted.compatibleIr);
  const reader = new Reader(payloadV11);
  skipV11StatesAndForms(reader);
  const prefixEnd = reader.offset;

  const writer = new Writer();
  writer.raw(payloadV11, 0, prefixEnd);
  writeTrees(writer, adapted.trees);
  writer.raw(payloadV11, prefixEnd, payloadV11.length);
  const bytes = writer.bytes();
  if (!bytes.length || bytes.length > MAX_PAYLOAD_BYTES) {
    throw new SealedNativeGuiV12Error(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  }
  return bytes;
}

export function sealNativeGuiRuntimeV12(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  validateRuntimeHeader(runtime, options.platform ?? 'windows');
  if (hasFooter(runtime)) throw new SealedNativeGuiV12Error('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayloadV12(input);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V12), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_TREE_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayloadV12(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiV12Error('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  if (new TextDecoder().decode(footer.subarray(0, 8)) !== PATCH_SEALED_NATIVE_GUI_MAGIC_V12) {
    throw new SealedNativeGuiV12Error('Executable does not contain a sealed native GUI payload.');
  }
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_TREE_VERSION) {
    throw new SealedNativeGuiV12Error('Executable does not contain sealed native GUI payload v12.');
  }
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiV12Error('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiV12Error('Sealed native GUI payload CRC mismatch.');
  return new Uint8Array(payload);
}

export function inspectNativeGuiTreesV12(payloadBytes) {
  const payload = toBytes(payloadBytes);
  const reader = new Reader(payload);
  skipV11StatesAndForms(reader);
  const count = reader.u32();
  if (count > MAX_TREE_COUNT) throw new SealedNativeGuiV12Error('Payload v12 contains too many TreeViews.');
  const trees = [];
  const nativeIndices = new Set();
  const ids = new Set();
  for (let treeIndex = 0; treeIndex < count; treeIndex += 1) {
    const nativeIndex = reader.u32();
    const id = reader.text();
    const nodeCount = reader.u32();
    if (!id || ids.has(id) || nativeIndices.has(nativeIndex) || !nodeCount || nodeCount > MAX_TREE_NODES) {
      throw new SealedNativeGuiV12Error('Payload v12 contains invalid TreeView metadata.');
    }
    ids.add(id); nativeIndices.add(nativeIndex);
    const nodes = [];
    for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
      const parent = reader.i32();
      const text = reader.text();
      if (parent < -1 || parent >= nodeIndex) throw new SealedNativeGuiV12Error(`TreeView '${id}' contains an invalid parent index.`);
      nodes.push({ parent, text });
    }
    trees.push({ nativeIndex, id, nodes });
  }
  return { trees, eventsOffset: reader.offset };
}

function writeTrees(writer, trees) {
  if (trees.length > MAX_TREE_COUNT) throw new SealedNativeGuiV12Error('Payload v12 contains too many TreeViews.');
  writer.u32(trees.length);
  for (const tree of trees) {
    if (!tree.id || !tree.flatNodes.length || tree.flatNodes.length > MAX_TREE_NODES) {
      throw new SealedNativeGuiV12Error(`TreeView '${tree.id ?? ''}' cannot be encoded.`);
    }
    writer.u32(tree.nativeIndex);
    writer.text(tree.id);
    writer.u32(tree.flatNodes.length);
    for (const node of tree.flatNodes) {
      const parent = node.flatIndexPath.length > 1 ? node.flatIndexPath[node.flatIndexPath.length - 2] : -1;
      if (parent < -1 || parent >= node.flatIndex) throw new SealedNativeGuiV12Error(`TreeView '${tree.id}' contains an invalid parent index.`);
      writer.i32(parent);
      writer.text(node.text);
    }
  }
}

function skipV11StatesAndForms(reader) {
  const stateCount = reader.u32();
  if (stateCount > 10000) throw new SealedNativeGuiV12Error('Malformed payload v11 state block.');
  for (let state = 0; state < stateCount; state += 1) {
    reader.text();
    const type = reader.u8();
    reader.skipTyped(type);
  }
  const formCount = reader.u32();
  if (!formCount || formCount > 1024) throw new SealedNativeGuiV12Error('Malformed payload v11 Form block.');
  for (let form = 0; form < formCount; form += 1) {
    reader.text(); reader.text(); reader.u32(); reader.u32(); reader.u8();
    const controlCount = reader.u32();
    if (controlCount > 10000) throw new SealedNativeGuiV12Error('Malformed payload v11 control block.');
    for (let control = 0; control < controlCount; control += 1) {
      reader.u8(); reader.text(); reader.text(); reader.text();
      const optionCount = reader.u32();
      if (optionCount > 10000) throw new SealedNativeGuiV12Error('Malformed payload v11 options.');
      for (let option = 0; option < optionCount; option += 1) reader.text();
      reader.i32(); reader.i32(); reader.i32(); reader.i32();
      reader.u8(); reader.u8(); reader.i32(); reader.i32();
      const columnCount = reader.u32();
      if (columnCount > 256) throw new SealedNativeGuiV12Error('Malformed payload v11 Table columns.');
      for (let column = 0; column < columnCount; column += 1) reader.text();
      const rowCount = reader.u32();
      if (rowCount > 10000) throw new SealedNativeGuiV12Error('Malformed payload v11 Table rows.');
      for (let row = 0; row < rowCount; row += 1) for (let column = 0; column < columnCount; column += 1) reader.text();
    }
    const menuCount = reader.u32();
    if (menuCount > 1024) throw new SealedNativeGuiV12Error('Malformed payload v11 Menu block.');
    for (let menu = 0; menu < menuCount; menu += 1) {
      reader.text();
      const entryCount = reader.u32();
      if (!entryCount || entryCount > 10000) throw new SealedNativeGuiV12Error('Malformed payload v11 Menu entries.');
      for (let entry = 0; entry < entryCount; entry += 1) {
        const type = reader.u8();
        if (type === 2) continue;
        if (type !== 1) throw new SealedNativeGuiV12Error('Malformed payload v11 Menu entry type.');
        reader.text(); reader.text();
        const hasShortcut = reader.u8();
        if (hasShortcut > 1) throw new SealedNativeGuiV12Error('Malformed payload v11 shortcut flag.');
        if (hasShortcut) { reader.u8(); reader.text(); }
        reader.text(); reader.text();
      }
    }
  }
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  need(count) { if (count < 0 || this.offset + count > this.bytes.length) throw new SealedNativeGuiV12Error('Malformed payload v12 bytes.'); }
  u8() { this.need(1); return this.bytes[this.offset++]; }
  u32() { this.need(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  i32() { this.need(4); const value = this.view.getInt32(this.offset, true); this.offset += 4; return value; }
  text() { const length = this.u32(); this.need(length); const value = new TextDecoder('utf-8', { fatal: true }).decode(this.bytes.subarray(this.offset, this.offset + length)); this.offset += length; return value; }
  skipTyped(type) {
    if (type === 1) { this.need(8); this.offset += 8; return; }
    if (type === 2) { this.text(); return; }
    if (type === 3) { this.need(1); this.offset += 1; return; }
    if (type === 4) { const count = this.u32(); if (count > 10000) throw new SealedNativeGuiV12Error('Malformed payload v12 list state.'); for (let i = 0; i < count; i += 1) this.text(); return; }
    throw new SealedNativeGuiV12Error(`Unsupported state type ${type} in payload v12.`);
  }
}

class Writer {
  constructor() { this.parts = []; }
  push(bytes) { this.parts.push(bytes); }
  u32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); this.push(bytes); }
  i32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setInt32(0, value | 0, true); this.push(bytes); }
  text(value) { const bytes = new TextEncoder().encode(String(value)); this.u32(bytes.length); this.push(bytes); }
  raw(source, start, end) { this.push(source.subarray(start, end)); }
  bytes() { return concat(this.parts); }
}

function validateRuntimeHeader(runtime, platform) {
  if (platform === 'windows') {
    if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV12Error('Native GUI runtime template is not a Windows PE executable.');
    return;
  }
  if (platform === 'linux') {
    if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV12Error('Native GUI runtime template is not a Linux ELF executable.');
    return;
  }
  if (platform === 'macos') {
    const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : '';
    if (!new Set(['cffaedfe', 'feedfacf', 'cefaedfe', 'feedface', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca']).has(magic)) throw new SealedNativeGuiV12Error('Native GUI runtime template is not a macOS Mach-O executable.');
    return;
  }
  throw new SealedNativeGuiV12Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}

function hasFooter(bytes) {
  if (bytes.length < FOOTER_SIZE) return false;
  return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V12;
}
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) { const size = parts.reduce((total, part) => total + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
