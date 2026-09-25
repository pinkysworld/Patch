export const PATCH_STUDIO_RESOURCE_MODEL_VERSION = 1;
export const PATCH_STUDIO_MAX_RESOURCE_BYTES = 2 * 1024 * 1024;
export const PATCH_STUDIO_MAX_RESOURCE_TOTAL_BYTES = 8 * 1024 * 1024;
export const PATCH_STUDIO_MAX_RESOURCES = 128;
export const PATCH_STUDIO_IMAGE_MEDIA_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml'
]);

const IMAGE_MEDIA_TYPES = new Set(PATCH_STUDIO_IMAGE_MEDIA_TYPES);
const RESOURCE_ID = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;

export class StudioResourceError extends Error {
  constructor(message, code = 'STUDIO_RESOURCE_INVALID') {
    super(message);
    this.name = 'StudioResourceError';
    this.code = code;
  }
}

export function normalizeStudioResourceId(value) {
  const id = String(value ?? '').trim();
  if (!id || id.length > 128 || !RESOURCE_ID.test(id)) {
    throw new StudioResourceError(
      `Resource id '${id || '?'}' is invalid. Use a letter-led logical name such as app.logo.`,
      'STUDIO_RESOURCE_ID'
    );
  }
  return id;
}

export function normalizeStudioResourcePath(value) {
  const path = String(value ?? '').replaceAll('\\', '/').trim();
  if (!path || path.startsWith('/') || path.includes('\0')) {
    throw new StudioResourceError('Resource path is invalid.', 'STUDIO_RESOURCE_PATH');
  }
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw new StudioResourceError('Resource path must stay inside the project.', 'STUDIO_RESOURCE_PATH');
  }
  return parts.join('/');
}

export function normalizeStudioImageMediaType(value) {
  const mediaType = String(value ?? '').trim().toLowerCase();
  if (!IMAGE_MEDIA_TYPES.has(mediaType)) {
    throw new StudioResourceError(
      `Unsupported image resource media type '${mediaType || '?'}'.`,
      'STUDIO_RESOURCE_MEDIA_TYPE'
    );
  }
  return mediaType;
}

export async function buildStudioImageResource(input) {
  if (!isRecord(input)) throw new StudioResourceError('Image resource input must be an object.');
  const id = normalizeStudioResourceId(input.id);
  const path = normalizeStudioResourcePath(input.path ?? defaultResourcePath(id, input.mediaType));
  const mediaType = normalizeStudioImageMediaType(input.mediaType);
  const bytes = normalizeBytes(input.bytes);
  assertResourceSize(bytes.byteLength);
  const sha256 = await sha256Hex(bytes);
  return Object.freeze({
    id,
    path,
    mediaType,
    size: bytes.byteLength,
    sha256,
    data: bytesToBase64(bytes)
  });
}

export function validateStudioResource(value) {
  if (!isRecord(value)) throw new StudioResourceError('Each Studio resource must be an object.');
  const id = normalizeStudioResourceId(value.id);
  const path = normalizeStudioResourcePath(value.path);
  const mediaType = normalizeStudioImageMediaType(value.mediaType);
  const data = normalizeBase64(value.data);
  const bytes = base64ToBytes(data);
  if (bytesToBase64(bytes) !== data) {
    throw new StudioResourceError(
      `Resource '${id}' data is not canonical base64.`,
      'STUDIO_RESOURCE_DATA'
    );
  }
  assertResourceSize(bytes.byteLength);
  const size = Number(value.size);
  if (!Number.isInteger(size) || size < 0 || size !== bytes.byteLength) {
    throw new StudioResourceError(
      `Resource '${id}' size metadata does not match its encoded data.`,
      'STUDIO_RESOURCE_SIZE'
    );
  }
  const sha256 = String(value.sha256 ?? '').trim().toLowerCase();
  if (!SHA256.test(sha256)) {
    throw new StudioResourceError(`Resource '${id}' SHA-256 is invalid.`, 'STUDIO_RESOURCE_HASH');
  }
  assertStudioResourceDigest(id, bytes, sha256);
  return { id, path, mediaType, size, sha256, data };
}

export function validateStudioResources(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new StudioResourceError('Project resources must be an array.');
  if (value.length > PATCH_STUDIO_MAX_RESOURCES) {
    throw new StudioResourceError(
      `Project contains more than ${PATCH_STUDIO_MAX_RESOURCES} resources.`,
      'STUDIO_RESOURCE_TOO_MANY'
    );
  }
  const resources = [];
  const ids = new Set();
  const paths = new Set();
  let totalBytes = 0;
  for (const item of value) {
    const resource = validateStudioResource(item);
    if (ids.has(resource.id)) {
      throw new StudioResourceError(`Resource id '${resource.id}' appears more than once.`, 'STUDIO_RESOURCE_DUPLICATE_ID');
    }
    if (paths.has(resource.path)) {
      throw new StudioResourceError(`Resource path '${resource.path}' appears more than once.`, 'STUDIO_RESOURCE_DUPLICATE_PATH');
    }
    ids.add(resource.id);
    paths.add(resource.path);
    totalBytes += resource.size;
    if (totalBytes > PATCH_STUDIO_MAX_RESOURCE_TOTAL_BYTES) {
      throw new StudioResourceError(
        `Project resources exceed the ${PATCH_STUDIO_MAX_RESOURCE_TOTAL_BYTES} byte Studio limit.`,
        'STUDIO_RESOURCE_TOTAL_TOO_LARGE'
      );
    }
    resources.push(resource);
  }
  return resources;
}

export async function verifyStudioResource(value) {
  const resource = validateStudioResource(value);
  assertStudioResourceDigest(resource.id, base64ToBytes(resource.data), resource.sha256);
  return resource;
}

export function studioResourceLocator(id) {
  return `patch-resource:${normalizeStudioResourceId(id)}`;
}

export function studioResourceSourceExpression(id) {
  return JSON.stringify(studioResourceLocator(id));
}

export function resourceBytes(value) {
  return base64ToBytes(validateStudioResource(value).data);
}

export function resourceById(resources, id) {
  const target = normalizeStudioResourceId(id);
  return validateStudioResources(resources).find(resource => resource.id === target) ?? null;
}

export function bytesToBase64(input) {
  const bytes = normalizeBytes(input);
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + chunk));
    binary += String.fromCharCode(...slice);
  }
  return globalBtoa(binary);
}

export function base64ToBytes(value) {
  const data = normalizeBase64(value);
  let binary;
  try {
    binary = globalAtob(data);
  } catch {
    throw new StudioResourceError('Resource data is not valid base64.', 'STUDIO_RESOURCE_DATA');
  }
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

export async function sha256Hex(input) {
  const bytes = normalizeBytes(input);
  const digest = sha256DigestHex(bytes);
  await crossCheckSubtleSha256(bytes, digest);
  return digest;
}

function assertStudioResourceDigest(id, bytes, sha256) {
  if (sha256DigestHex(bytes) !== sha256) {
    throw new StudioResourceError(
      `Resource '${id}' failed SHA-256 verification.`,
      'STUDIO_RESOURCE_HASH_MISMATCH'
    );
  }
}

function sha256DigestHex(bytes) {
  const length = bytes.length;
  const bitHi = Math.floor(length / 0x20000000);
  const bitLo = (length * 8) >>> 0;
  const total = Math.ceil((length + 9) / 64) * 64;
  const padded = new Uint8Array(total);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  view.setUint32(total - 8, bitHi);
  view.setUint32(total - 4, bitLo);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < total; offset += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr(w[index - 15], 7) ^ rotr(w[index - 15], 18) ^ (w[index - 15] >>> 3);
      const s1 = rotr(w[index - 2], 17) ^ rotr(w[index - 2], 19) ^ (w[index - 2] >>> 10);
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let index = 0; index < 64; index += 1) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + s1 + ch + SHA256_K[index] + w[index]) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map(word => word.toString(16).padStart(8, '0')).join('');
}

function rotr(value, bits) {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

async function crossCheckSubtleSha256(bytes, digest) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) return;
  let web;
  try {
    web = new Uint8Array(await subtle.digest('SHA-256', bytes));
  } catch {
    return;
  }
  const hex = [...web].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== digest) {
    throw new StudioResourceError('SHA-256 is unavailable in this environment.', 'STUDIO_RESOURCE_CRYPTO');
  }
}

function assertResourceSize(size) {
  if (!Number.isInteger(size) || size < 1) {
    throw new StudioResourceError('Image resource data is empty.', 'STUDIO_RESOURCE_EMPTY');
  }
  if (size > PATCH_STUDIO_MAX_RESOURCE_BYTES) {
    throw new StudioResourceError(
      `Image resource exceeds the ${PATCH_STUDIO_MAX_RESOURCE_BYTES} byte Studio limit.`,
      'STUDIO_RESOURCE_TOO_LARGE'
    );
  }
}

function defaultResourcePath(id, mediaType) {
  const type = normalizeStudioImageMediaType(mediaType);
  const extension = type === 'image/png' ? 'png'
    : type === 'image/jpeg' ? 'jpg'
      : type === 'image/webp' ? 'webp'
        : 'svg';
  return `resources/${normalizeStudioResourceId(id).replace(/[.-]+/g, '_')}.${extension}`;
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new StudioResourceError('Resource bytes must be an ArrayBuffer or Uint8Array.', 'STUDIO_RESOURCE_BYTES');
}

function normalizeBase64(value) {
  const data = String(value ?? '').trim();
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new StudioResourceError('Resource data is not canonical base64.', 'STUDIO_RESOURCE_DATA');
  }
  return data;
}

function globalBtoa(binary) {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);
  throw new StudioResourceError('Base64 encoding is unavailable in this environment.', 'STUDIO_RESOURCE_BASE64');
}

function globalAtob(data) {
  if (typeof globalThis.atob === 'function') return globalThis.atob(data);
  throw new StudioResourceError('Base64 decoding is unavailable in this environment.', 'STUDIO_RESOURCE_BASE64');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
