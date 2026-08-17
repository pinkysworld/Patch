import { validateNativeGuiIRV11 } from './native-gui-ir-v11.js';
import { encodeNativeGuiPayload } from './sealed-native-gui.js';

export const PATCH_SEALED_NATIVE_GUI_MENU_VERSION = 11;
export const PATCH_SEALED_NATIVE_GUI_MAGIC_V11 = 'PCHGUI01';
const FOOTER_SIZE = 20;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

export class SealedNativeGuiV11Error extends Error {}

/**
 * Sealed payload v11 extends frozen payload v10 only in the structural Menu
 * block. State, control, Table, persistent-list and event/action bytes remain
 * byte-compatible with v10. Menu entries become typed so separators survive,
 * shortcuts retain portable modifier semantics, and enabled/checked bindings
 * reference ordinary Patch Boolean state by name.
 */
export function encodeNativeGuiPayloadV11(input) {
  const ir = validateNativeGuiIRV11(input);
  const compatible = cloneForV10(ir);
  const payloadV10 = encodeNativeGuiPayload(compatible, { version: 10 });
  const reader = new Reader(payloadV10);
  const writer = new Writer();

  copyStates(reader, writer);
  const formCount = reader.u32();
  writer.u32(formCount);
  if (formCount !== ir.forms.length) throw new SealedNativeGuiV11Error('Payload v11 lost Form ordering.');

  for (let formIndex = 0; formIndex < formCount; formIndex += 1) {
    copyFormHeaderAndControls(reader, writer);
    skipV10Menus(reader);
    writeMenusV11(writer, ir.forms[formIndex]);
  }

  writer.raw(payloadV10, reader.offset, payloadV10.length);
  const bytes = writer.bytes();
  if (!bytes.length || bytes.length > MAX_PAYLOAD_BYTES) {
    throw new SealedNativeGuiV11Error(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  }
  return bytes;
}

export function sealNativeGuiRuntimeV11(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  validateRuntimeHeader(runtime, options.platform ?? 'windows');
  if (hasFooter(runtime)) throw new SealedNativeGuiV11Error('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayloadV11(input);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC_V11), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_MENU_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayloadV11(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiV11Error('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  if (new TextDecoder().decode(footer.subarray(0, 8)) !== PATCH_SEALED_NATIVE_GUI_MAGIC_V11) {
    throw new SealedNativeGuiV11Error('Executable does not contain a sealed native GUI payload.');
  }
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_MENU_VERSION) {
    throw new SealedNativeGuiV11Error('Executable does not contain sealed native GUI payload v11.');
  }
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiV11Error('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiV11Error('Sealed native GUI payload CRC mismatch.');
  return new Uint8Array(payload);
}

function cloneForV10(ir) {
  const policies = [];
  const collect = controls => {
    for (const control of controls ?? []) {
      policies.push(control.layout?.policy ? structuredClone(control.layout.policy) : null);
      if (control.type === 'tabs') for (const page of control.pages ?? []) collect(page.controls);
    }
  };
  for (const form of ir.forms ?? []) collect(form.controls);

  const cloned = structuredClone(ir);
  let cursor = 0;
  const restore = controls => {
    for (const control of controls ?? []) {
      const policy = policies[cursor++];
      if (policy && control.layout) Object.defineProperty(control.layout, 'policy', { value: policy, enumerable: false, configurable: true, writable: false });
      if (control.type === 'tabs') for (const page of control.pages ?? []) restore(page.controls);
    }
  };
  for (const form of cloned.forms ?? []) restore(form.controls);
  if (cursor !== policies.length) throw new SealedNativeGuiV11Error('Payload v11 compatibility clone lost control ordering.');

  for (const form of cloned.forms ?? []) {
    for (const menu of form.menus ?? []) {
      menu.items = (menu.items ?? [])
        .filter(item => item.type !== 'menuSeparator')
        .map(item => {
          const { shortcut: _shortcut, enabledState: _enabled, checkedState: _checked, ...rest } = item;
          return rest;
        });
    }
  }
  return validateNativeGuiIRV11(cloned);
}

function copyStates(reader, writer) {
  const count = reader.u32();
  writer.u32(count);
  for (let i = 0; i < count; i += 1) {
    writer.text(reader.text());
    const type = reader.u8();
    writer.u8(type);
    const start = reader.offset;
    reader.skipTyped(type);
    writer.raw(reader.bytes, start, reader.offset);
  }
}

function copyFormHeaderAndControls(reader, writer) {
  writer.text(reader.text());
  writer.text(reader.text());
  writer.u32(reader.u32());
  writer.u32(reader.u32());
  writer.u8(reader.u8());
  const controlCount = reader.u32();
  writer.u32(controlCount);
  for (let i = 0; i < controlCount; i += 1) {
    const start = reader.offset;
    reader.u8(); reader.text(); reader.text(); reader.text();
    const optionCount = reader.u32();
    for (let option = 0; option < optionCount; option += 1) reader.text();
    reader.i32(); reader.i32(); reader.i32(); reader.i32();
    reader.u8(); reader.u8();
    reader.i32(); reader.i32();
    const columnCount = reader.u32();
    for (let column = 0; column < columnCount; column += 1) reader.text();
    const rowCount = reader.u32();
    for (let row = 0; row < rowCount; row += 1) for (let column = 0; column < columnCount; column += 1) reader.text();
    writer.raw(reader.bytes, start, reader.offset);
  }
}

function skipV10Menus(reader) {
  const menuCount = reader.u32();
  for (let menu = 0; menu < menuCount; menu += 1) {
    reader.text();
    const itemCount = reader.u32();
    for (let item = 0; item < itemCount; item += 1) { reader.text(); reader.text(); }
  }
}

function writeMenusV11(writer, form) {
  const menus = form.menus ?? [];
  writer.u32(menus.length);
  for (const menu of menus) {
    writer.text(menu.title);
    writer.u32(menu.items.length);
    for (const entry of menu.items) {
      if (entry.type === 'menuSeparator') {
        writer.u8(2);
        continue;
      }
      if (entry.type !== 'menuItem') throw new SealedNativeGuiV11Error(`Menu '${menu.title}' contains an unsupported entry.`);
      writer.u8(1);
      writer.text(entry.id);
      writer.text(entry.text);
      const shortcut = entry.shortcut ?? null;
      writer.u8(shortcut ? 1 : 0);
      if (shortcut) {
        let modifiers = 0;
        if (shortcut.primary) modifiers |= 1;
        if (shortcut.shift) modifiers |= 2;
        if (shortcut.alt) modifiers |= 4;
        writer.u8(modifiers);
        writer.text(shortcut.key);
      }
      writer.text(entry.enabledState ?? '');
      writer.text(entry.checkedState ?? '');
    }
  }
}

class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  need(count) { if (count < 0 || this.offset + count > this.bytes.length) throw new SealedNativeGuiV11Error('Malformed payload v10 compatibility bytes.'); }
  u8() { this.need(1); return this.bytes[this.offset++]; }
  u32() { this.need(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  i32() { this.need(4); const value = this.view.getInt32(this.offset, true); this.offset += 4; return value; }
  text() { const length = this.u32(); this.need(length); const value = new TextDecoder().decode(this.bytes.subarray(this.offset, this.offset + length)); this.offset += length; return value; }
  skipTyped(type) {
    if (type === 1) { this.need(8); this.offset += 8; return; }
    if (type === 2) { this.text(); return; }
    if (type === 3) { this.need(1); this.offset += 1; return; }
    if (type === 4) { const count = this.u32(); for (let i = 0; i < count; i += 1) this.text(); return; }
    throw new SealedNativeGuiV11Error(`Unsupported state type ${type} in payload v10 compatibility bytes.`);
  }
}

class Writer {
  constructor() { this.parts = []; }
  push(bytes) { this.parts.push(bytes); }
  u8(value) { this.push(Uint8Array.of(value & 0xff)); }
  u32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); this.push(bytes); }
  text(value) { const bytes = new TextEncoder().encode(String(value)); this.u32(bytes.length); this.push(bytes); }
  raw(source, start, end) { this.push(source.subarray(start, end)); }
  bytes() { return concat(this.parts); }
}

function validateRuntimeHeader(runtime, platform) {
  if (platform === 'windows') {
    if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) throw new SealedNativeGuiV11Error('Native GUI runtime template is not a Windows PE executable.');
    return;
  }
  if (platform === 'linux') {
    if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) throw new SealedNativeGuiV11Error('Native GUI runtime template is not a Linux ELF executable.');
    return;
  }
  if (platform === 'macos') {
    const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : '';
    if (!new Set(['cffaedfe', 'feedfacf', 'cefaedfe', 'feedface', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca']).has(magic)) {
      throw new SealedNativeGuiV11Error('Native GUI runtime template is not a macOS Mach-O executable.');
    }
    return;
  }
  throw new SealedNativeGuiV11Error(`Native GUI runtime platform '${platform}' is unsupported.`);
}

function hasFooter(bytes) {
  if (bytes.length < FOOTER_SIZE) return false;
  return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC_V11;
}
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) { const size = parts.reduce((total, part) => total + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
