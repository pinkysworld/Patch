import { validateNativeGuiIR } from './native-gui-ir.js';

export const PATCH_SEALED_NATIVE_GUI_VERSION = 1;
export const PATCH_SEALED_NATIVE_GUI_MAGIC = 'PCHGUI01';
const FOOTER_SIZE = 20;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

export class SealedNativeGuiError extends Error {}

export function encodeNativeGuiPayload(input) {
  const ir = validateNativeGuiIR(input);
  validateTextBindings(ir);
  const writer = new Writer();

  writer.u32(ir.states.length);
  for (const state of ir.states) {
    writer.text(state.name);
    const type = stateTypeCode(state.type);
    writer.u8(type);
    writeTypedValue(writer, type, state.initial);
  }

  writer.u32(ir.forms.length);
  for (const form of ir.forms) {
    writer.text(form.id);
    writer.text(form.title);
    writer.u32(form.width);
    writer.u32(form.height);
    writer.u8(form.visible ? 1 : 0);
    writer.u32(form.controls.length);
    for (const control of form.controls) {
      writer.u8(controlTypeCode(control.type));
      writer.text(control.id ?? '');
      writer.text(control.text ?? '');
      writer.text(control.binding ?? '');
      writer.i32(control.layout?.x ?? 24);
      writer.i32(control.layout?.y ?? 24);
      writer.i32(control.layout?.width ?? 120);
      writer.i32(control.layout?.height ?? 36);
    }
  }

  writer.u32(ir.events.length);
  for (const event of ir.events) {
    writer.text(event.control);
    writer.u8(event.event === 'clicked' ? 1 : event.event === 'changed' ? 2 : 0);
    writer.u8(event.valueType === 'boolean' ? 1 : event.valueType === 'text' ? 2 : 0);
    writer.u32(event.actions.length);
    for (const action of event.actions) writeAction(writer, action);
  }
  const bytes = writer.bytes();
  if (!bytes.length || bytes.length > MAX_PAYLOAD_BYTES) {
    throw new SealedNativeGuiError(`Native GUI payload exceeds the ${MAX_PAYLOAD_BYTES}-byte safety limit.`);
  }
  return bytes;
}

export function sealNativeGuiRuntime(runtimeBytes, input) {
  const runtime = toBytes(runtimeBytes);
  if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) {
    throw new SealedNativeGuiError('Native GUI runtime template is not a Windows PE executable.');
  }
  if (hasFooter(runtime)) throw new SealedNativeGuiError('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayload(input);
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, PATCH_SEALED_NATIVE_GUI_VERSION, true);
  view.setUint32(12, payload.length, true);
  view.setUint32(16, crc32(payload), true);
  return concat([runtime, payload, footer]);
}

export function decodeNativeGuiPayload(binaryBytes) {
  const bytes = toBytes(binaryBytes);
  if (bytes.length < FOOTER_SIZE) throw new SealedNativeGuiError('Executable does not contain a sealed native GUI payload.');
  const footerOffset = bytes.length - FOOTER_SIZE;
  const footer = bytes.subarray(footerOffset);
  const magic = new TextDecoder().decode(footer.subarray(0, 8));
  if (magic !== PATCH_SEALED_NATIVE_GUI_MAGIC) throw new SealedNativeGuiError('Executable does not contain a sealed native GUI payload.');
  const view = new DataView(footer.buffer, footer.byteOffset, footer.byteLength);
  if (view.getUint32(8, true) !== PATCH_SEALED_NATIVE_GUI_VERSION) throw new SealedNativeGuiError('Unsupported sealed native GUI version.');
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiError('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiError('Sealed native GUI payload CRC mismatch.');
  return new Uint8Array(payload);
}

function validateTextBindings(ir) {
  const states = new Set(ir.states.map(state => state.name));
  const re = /\{([A-Za-z_]\w*)\}/g;
  for (const form of ir.forms) {
    for (const control of form.controls) {
      const text = String(control.text ?? '');
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(text))) {
        if (!states.has(match[1])) throw new SealedNativeGuiError(`Native GUI text '${text}' refers to unknown state '${match[1]}'.`);
      }
    }
  }
}

function writeAction(writer, action) {
  if (action.kind === 'openForm' || action.kind === 'closeForm') {
    writer.u8(action.kind === 'openForm' ? 1 : 2);
    writer.text(action.form);
    return;
  }
  if (action.kind !== 'change') throw new SealedNativeGuiError(`Unsupported native action '${action.kind}'.`);
  writer.u8(3);
  writer.text(action.target);
  const type = stateTypeCode(action.stateType);
  writer.u8(type);
  writer.u32(action.ops.length);
  for (const op of action.ops) {
    writer.u8(opCode(op.op));
    if (op.op === 'clear') {
      writer.u8(0);
    } else if (op.value?.kind === 'eventValue') {
      writer.u8(2);
    } else {
      writer.u8(1);
      writeTypedValue(writer, type, op.value?.value);
    }
  }
}

function stateTypeCode(type) {
  if (type === 'number') return 1;
  if (type === 'text') return 2;
  if (type === 'boolean') return 3;
  throw new SealedNativeGuiError(`Unsupported native state type '${type}'.`);
}
function controlTypeCode(type) {
  if (type === 'text') return 1;
  if (type === 'button') return 2;
  if (type === 'input') return 3;
  if (type === 'checkbox') return 4;
  throw new SealedNativeGuiError(`Unsupported native control '${type}'.`);
}
function opCode(op) {
  if (op === 'set') return 1;
  if (op === 'add') return 2;
  if (op === 'remove') return 3;
  if (op === 'clear') return 4;
  throw new SealedNativeGuiError(`Unsupported native operation '${op}'.`);
}
function writeTypedValue(writer, type, value) {
  if (type === 1) writer.f64(Number(value));
  else if (type === 2) writer.text(String(value ?? ''));
  else if (type === 3) writer.u8(value ? 1 : 0);
  else throw new SealedNativeGuiError('Unsupported native value type.');
}

class Writer {
  constructor() { this.parts = []; }
  push(bytes) { this.parts.push(bytes); }
  u8(value) { this.push(Uint8Array.of(value & 0xff)); }
  u32(value) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value >>> 0, true); this.push(b); }
  i32(value) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, Number(value) | 0, true); this.push(b); }
  f64(value) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, Number(value), true); this.push(b); }
  text(value) { const b = new TextEncoder().encode(String(value)); this.u32(b.length); this.push(b); }
  bytes() { return concat(this.parts); }
}
function hasFooter(bytes) {
  if (bytes.length < FOOTER_SIZE) return false;
  return new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIZE, bytes.length - FOOTER_SIZE + 8)) === PATCH_SEALED_NATIVE_GUI_MAGIC;
}
function toBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function concat(parts) { const size = parts.reduce((n, p) => n + p.length, 0); const out = new Uint8Array(size); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
