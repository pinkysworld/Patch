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
  const actual = await sha256Hex(base64ToBytes(resource.data));
  if (actual !== resource.sha256) {
    throw new StudioResourceError(
      `Resource '${resource.id}' failed SHA-256 verification.`,
      'STUDIO_RESOURCE_HASH_MISMATCH'
    );
  }
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

export async function sha256Hex(input) {
  const bytes = normalizeBytes(input);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new StudioResourceError('SHA-256 is unavailable in this environment.', 'STUDIO_RESOURCE_CRYPTO');
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
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
