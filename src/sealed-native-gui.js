import { flattenNativeGuiControls, validateNativeGuiIR } from './native-gui-ir.js';

export const PATCH_SEALED_NATIVE_GUI_VERSION = 8;
export const PATCH_SEALED_NATIVE_GUI_PREVIOUS_VERSION = 7;
export const PATCH_SEALED_NATIVE_GUI_MAGIC = 'PCHGUI01';
const FOOTER_SIZE = 20;
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

export class SealedNativeGuiError extends Error {}

/**
 * Payload v8 is the current Ready-App contract. It preserves the v7
 * state/Form/control/menu/event contract and adds two bytes of responsive
 * layout policy after every control geometry: kind 0=fixed, 1=anchor, 2=dock
 * plus an anchor bit-mask or dock-side code. The policy is UI metadata only and
 * does not enter semantic Change IR.
 *
 * Payload v7 remains explicitly encodable for the frozen runtime-v0.8 release
 * line and compatibility tooling.
 */
export function encodeNativeGuiPayload(input, options = {}) {
  const version = payloadVersion(options.version ?? PATCH_SEALED_NATIVE_GUI_VERSION);
  const ir = validateNativeGuiIR(input);
  validateTextBindings(ir);
  const writer = new Writer();
  const flatControls = flattenNativeGuiControls(ir);

  writer.u32(ir.states.length);
  for (const state of ir.states) {
    writer.text(state.name);
    const type = stateTypeCode(state.type);
    writer.u8(type);
    writeTypedValue(writer, type, state.initial);
  }

  writer.u32(ir.forms.length);
  for (let formIndex = 0; formIndex < ir.forms.length; formIndex += 1) {
    const form = ir.forms[formIndex];
    const controls = flatControls.filter(control => control.formIndex === formIndex);
    writer.text(form.id);
    writer.text(form.title);
    writer.u32(form.width);
    writer.u32(form.height);
    writer.u8(form.visible ? 1 : 0);
    writer.u32(controls.length);
    for (const control of controls) {
      writer.u8(controlTypeCode(control.type));
      writer.text(control.id ?? '');
      writer.text(control.text ?? '');
      writer.text(control.binding ?? '');
      const options = control.type === 'tabs'
        ? control.pageTitles
        : Array.isArray(control.options) ? control.options : [];
      writer.u32(options.length);
      for (const option of options) writer.text(option);
      writer.i32(control.layout?.x ?? 24);
      writer.i32(control.layout?.y ?? 24);
      writer.i32(control.layout?.width ?? 120);
      writer.i32(control.layout?.height ?? 36);
      if (version >= PATCH_SEALED_NATIVE_GUI_VERSION) writeLayoutPolicy(writer, control.layout?.policy);
      writer.i32(control.parentTabIndex ?? -1);
      writer.i32(control.pageIndex ?? -1);
    }

    writer.u32(form.menus.length);
    for (const menu of form.menus) {
      writer.text(menu.title);
      writer.u32(menu.items.length);
      for (const item of menu.items) {
        writer.text(item.id);
        writer.text(item.text);
      }
    }
  }

  writer.u32(ir.events.length);
  for (const event of ir.events) {
    writer.text(event.control);
    writer.u8(eventCode(event.event));
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

export function sealNativeGuiRuntime(runtimeBytes, input, options = {}) {
  const runtime = toBytes(runtimeBytes);
  const platform = options.platform ?? 'windows';
  const version = payloadVersion(options.version ?? PATCH_SEALED_NATIVE_GUI_VERSION);
  validateRuntimeHeader(runtime, platform);
  if (hasFooter(runtime)) throw new SealedNativeGuiError('Native GUI runtime template is already sealed.');
  const payload = encodeNativeGuiPayload(input, { version });
  const footer = new Uint8Array(FOOTER_SIZE);
  footer.set(new TextEncoder().encode(PATCH_SEALED_NATIVE_GUI_MAGIC), 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, version, true);
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
  payloadVersion(view.getUint32(8, true));
  const length = view.getUint32(12, true);
  if (!length || length > MAX_PAYLOAD_BYTES || length > footerOffset) throw new SealedNativeGuiError('Invalid sealed native GUI payload length.');
  const payload = bytes.subarray(footerOffset - length, footerOffset);
  if (crc32(payload) !== view.getUint32(16, true)) throw new SealedNativeGuiError('Sealed native GUI payload CRC mismatch.');
  return new Uint8Array(payload);
}

function payloadVersion(value) {
  const version = Number(value);
  if (version !== PATCH_SEALED_NATIVE_GUI_VERSION && version !== PATCH_SEALED_NATIVE_GUI_PREVIOUS_VERSION) {
    throw new SealedNativeGuiError(`Unsupported sealed native GUI version '${value}'.`);
  }
  return version;
}

function validateRuntimeHeader(runtime, platform) {
  if (platform === 'windows') {
    if (runtime.length < 2 || runtime[0] !== 0x4d || runtime[1] !== 0x5a) {
      throw new SealedNativeGuiError('Native GUI runtime template is not a Windows PE executable.');
    }
    return;
  }
  if (platform === 'linux') {
    if (runtime.length < 4 || runtime[0] !== 0x7f || runtime[1] !== 0x45 || runtime[2] !== 0x4c || runtime[3] !== 0x46) {
      throw new SealedNativeGuiError('Native GUI runtime template is not a Linux ELF executable.');
    }
    return;
  }
  if (platform === 'macos') {
    const magic = runtime.length >= 4 ? Array.from(runtime.subarray(0, 4)).map(byte => byte.toString(16).padStart(2, '0')).join('') : '';
    const machOMagics = new Set(['cffaedfe', 'feedfacf', 'cefaedfe', 'feedface', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca']);
    if (!machOMagics.has(magic)) throw new SealedNativeGuiError('Native GUI runtime template is not a macOS Mach-O executable.');
    return;
  }
  throw new SealedNativeGuiError(`Native GUI runtime platform '${platform}' is unsupported.`);
}

function validateTextBindings(ir) {
  const states = new Set(ir.states.map(state => state.name));
  const re = /\{([A-Za-z_]\w*)\}/g;
  for (const control of flattenNativeGuiControls(ir)) {
    const text = String(control.text ?? '');
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text))) {
      if (!states.has(match[1])) throw new SealedNativeGuiError(`Native GUI text '${text}' refers to unknown state '${match[1]}'.`);
    }
    if (control.type === 'radio' && (!Array.isArray(control.options) || control.options.length < 2)) {
      throw new SealedNativeGuiError('Native Radio payload needs at least two options.');
    }
    if (['combo', 'listbox'].includes(control.type) && (!Array.isArray(control.options) || control.options.length < 2)) {
      const label = control.type === 'combo' ? 'ComboBox' : 'ListBox';
      throw new SealedNativeGuiError(`Native ${label} payload needs at least two options.`);
    }
    if (control.type === 'tabs' && (!Array.isArray(control.pageTitles) || control.pageTitles.length < 2)) {
      throw new SealedNativeGuiError('Native Tabs payload needs at least two page titles.');
    }
  }
}

function writeLayoutPolicy(writer, policy) {
  if (!policy || policy.kind === 'fixed') {
    writer.u8(0);
    writer.u8(0);
    return;
  }
  if (policy.kind === 'anchor') {
    const edges = new Set(policy.edges ?? []);
    const allowed = ['left', 'right', 'top', 'bottom'];
    if (!edges.size || [...edges].some(edge => !allowed.includes(edge))) throw new SealedNativeGuiError('Invalid native anchor layout policy.');
    let mask = 0;
    if (edges.has('left')) mask |= 1;
    if (edges.has('right')) mask |= 2;
    if (edges.has('top')) mask |= 4;
    if (edges.has('bottom')) mask |= 8;
    writer.u8(1);
    writer.u8(mask);
    return;
  }
  if (policy.kind === 'dock') {
    const codes = { left: 1, right: 2, top: 3, bottom: 4, fill: 5 };
    const code = codes[policy.side];
    if (!code) throw new SealedNativeGuiError(`Invalid native dock layout policy '${policy.side}'.`);
    writer.u8(2);
    writer.u8(code);
    return;
  }
  throw new SealedNativeGuiError(`Unsupported native layout policy '${policy.kind}'.`);
}

function eventCode(event) {
  if (event === 'clicked') return 1;
  if (event === 'changed') return 2;
  if (event === 'confirmed') return 3;
  if (event === 'chosen') return 4;
  if (event === 'cancelled') return 5;
  throw new SealedNativeGuiError(`Unsupported native event '${event}'.`);
}

function writeAction(writer, action) {
  if (action.kind === 'openForm' || action.kind === 'closeForm') {
    writer.u8(action.kind === 'openForm' ? 1 : 2);
    writer.text(action.form);
    return;
  }
  if (action.kind === 'dialog') {
    writer.u8(4);
    writer.text(action.form);
    writer.text(action.title);
    writer.text(action.message);
    return;
  }
  if (action.kind === 'confirmDialog') {
    writer.u8(5);
    writer.text(action.form);
    writer.text(action.id);
    writer.text(action.title);
    writer.text(action.message);
    return;
  }
  if (action.kind === 'openFileDialog' || action.kind === 'saveFileDialog') {
    writer.u8(action.kind === 'openFileDialog' ? 6 : 7);
    writer.text(action.form);
    writer.text(action.id);
    writer.text(action.title);
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
  if (type === 'combo') return 5;
  if (type === 'listbox') return 6;
  if (type === 'tabs') return 7;
  if (type === 'radio') return 8;
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
