import { compile } from './compiler.js?v=9ad29318e93c7c71';

export const PATCH_WASM_VERSION = '0.1-bootstrap';

export function compileToWasm(source, options = {}) {
  const compiled = compile(source, options);
  const payloadObject = {
    format: 'patch-wasm-bootstrap',
    version: PATCH_WASM_VERSION,
    project: compiled.project,
    ir: compiled.ir,
    source
  };
  const payloadText = JSON.stringify(payloadObject);
  const payload = new TextEncoder().encode(payloadText);
  const pages = Math.max(1, Math.ceil(payload.length / 65536));

  const module = bytes(
    [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
    section(5, bytes(vec([bytes([0x00], u32(pages))]))),
    section(6, bytes(vec([
      globalI32(0),
      globalI32(payload.length)
    ]))),
    section(7, bytes(vec([
      exportEntry('memory', 0x02, 0),
      exportEntry('patch_payload_ptr', 0x03, 0),
      exportEntry('patch_payload_len', 0x03, 1)
    ]))),
    section(11, bytes(vec([
      bytes([0x00, 0x41], s32(0), [0x0b], u32(payload.length), payload)
    ])))
  );

  return { module, payload: payloadObject, compiled };
}

export function decodePatchWasm(instance) {
  const memory = instance.exports.memory;
  const ptr = Number(instance.exports.patch_payload_ptr.value);
  const len = Number(instance.exports.patch_payload_len.value);
  const data = new Uint8Array(memory.buffer, ptr, len);
  return JSON.parse(new TextDecoder().decode(data));
}

function globalI32(value) {
  return bytes([0x7f, 0x00, 0x41], s32(value), [0x0b]);
}

function exportEntry(name, kind, index) {
  return bytes(nameBytes(name), [kind], u32(index));
}

function nameBytes(text) {
  const encoded = new TextEncoder().encode(text);
  return bytes(u32(encoded.length), encoded);
}

function section(id, payload) {
  return bytes([id], u32(payload.length), payload);
}

function vec(items) {
  return bytes(u32(items.length), ...items);
}

function u32(value) {
  const out = [];
  let n = Number(value) >>> 0;
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n !== 0) byte |= 0x80;
    out.push(byte);
  } while (n !== 0);
  return out;
}

function s32(value) {
  const out = [];
  let n = Number(value) | 0;
  let more = true;
  while (more) {
    let byte = n & 0x7f;
    n >>= 7;
    const sign = (byte & 0x40) !== 0;
    more = !((n === 0 && !sign) || (n === -1 && sign));
    if (more) byte |= 0x80;
    out.push(byte);
  }
  return out;
}

function bytes(...parts) {
  const flat = [];
  for (const part of parts) {
    if (part == null) continue;
    if (part instanceof Uint8Array) flat.push(...part);
    else if (Array.isArray(part)) flat.push(...part);
    else flat.push(part);
  }
  return Uint8Array.from(flat);
}
