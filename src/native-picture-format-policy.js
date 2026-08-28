export const PATCH_NATIVE_PICTURE_FORMAT_POLICY_VERSION = '1.0';
export const PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID = 'native-picture-formats/1.0';
export const PATCH_NATIVE_PICTURE_READY_MEDIA_TYPES = Object.freeze(['image/png', 'image/jpeg']);
export const PATCH_NATIVE_PICTURE_DEFERRED_MEDIA_TYPES = Object.freeze(['image/webp', 'image/svg+xml']);
export const PATCH_NATIVE_PICTURE_MEDIA_TYPES = PATCH_NATIVE_PICTURE_READY_MEDIA_TYPES;

const READY = new Set(PATCH_NATIVE_PICTURE_READY_MEDIA_TYPES);
const DEFERRED = new Set(PATCH_NATIVE_PICTURE_DEFERRED_MEDIA_TYPES);
const RESOURCE_PREFIX = 'patch-resource:';
const DATA_URI = /^data:([^;,]+)[;,]/i;
const DEFERRED_PATH = /\.(?:webp|svg)$/i;

export class NativePictureFormatError extends Error {
  constructor(message, code = 'NATIVE_PICTURE_FORMAT') {
    super(message);
    this.name = 'NativePictureFormatError';
    this.code = code;
    this.policy = PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID;
  }
}

/**
 * Versioned Native Ready Picture format policy.
 *
 * Studio and Standalone Web may store PNG, JPEG, WebP and SVG project resources.
 * Native GUI IR 1.4 / payload v14 / runtime v1.5 PictureBox decoding is PNG/JPEG
 * only. WebP and SVG are explicit deferred formats: they fail closed until a
 * later versioned native contract expands Win32/WIC, AppKit/NSImage and
 * GTK/GdkPixbuf together. This module is not a Native GUI IR bump.
 */
export const PATCH_NATIVE_PICTURE_FORMAT_POLICY = Object.freeze({
  id: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
  version: PATCH_NATIVE_PICTURE_FORMAT_POLICY_VERSION,
  nativeGuiIR: '1.4',
  payload: 14,
  runtime: '1.5',
  ready: PATCH_NATIVE_PICTURE_READY_MEDIA_TYPES,
  deferred: PATCH_NATIVE_PICTURE_DEFERRED_MEDIA_TYPES,
  studioWeb: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  reason: 'Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf do not share one WebP/SVG decode contract. Native Ready Picture therefore guarantees PNG and JPEG only instead of inheriting host-specific decoders.'
});

export function nativePictureMediaTypeStatus(value) {
  const mediaType = String(value ?? '').trim().toLowerCase();
  if (!mediaType) return 'empty';
  if (READY.has(mediaType)) return 'ready';
  if (DEFERRED.has(mediaType)) return 'deferred';
  return 'unsupported';
}

export function inspectNativePictureSourceFormat(value) {
  const source = String(value ?? '').trim();
  if (!source) {
    return Object.freeze({ kind: 'empty', source, mediaType: null, status: 'empty' });
  }
  if (source.startsWith(RESOURCE_PREFIX)) {
    return Object.freeze({ kind: 'resource', source, mediaType: null, status: 'resource' });
  }
  if (/^data:/i.test(source)) {
    const data = source.match(DATA_URI);
    if (!data) {
      return Object.freeze({ kind: 'data-uri', source, mediaType: null, status: 'unsupported' });
    }
    const mediaType = String(data[1] ?? '').trim().toLowerCase();
    return Object.freeze({
      kind: 'data-uri',
      source,
      mediaType,
      status: nativePictureMediaTypeStatus(mediaType)
    });
  }
  if (DEFERRED_PATH.test(source.split('?')[0])) {
    const mediaType = /\.svg$/i.test(source.split('?')[0]) ? 'image/svg+xml' : 'image/webp';
    return Object.freeze({ kind: 'path', source, mediaType, status: 'deferred' });
  }
  return Object.freeze({ kind: 'opaque', source, mediaType: null, status: 'opaque' });
}

export function assertNativePictureMediaTypeAllowed(mediaType, options = {}) {
  const status = nativePictureMediaTypeStatus(mediaType);
  if (status === 'ready') return 'ready';
  throw formatPolicyError(mediaType, options.controlId, options.code);
}

export function assertNativePictureSourceFormat(source, options = {}) {
  const inspected = inspectNativePictureSourceFormat(source);
  if (inspected.status === 'empty' || inspected.status === 'resource' || inspected.status === 'opaque') {
    return inspected;
  }
  if (inspected.status === 'ready') return inspected;
  throw formatPolicyError(inspected.mediaType, options.controlId, options.code);
}

function formatPolicyError(mediaType, controlId, code) {
  const type = String(mediaType ?? '').trim() || 'unknown';
  const status = nativePictureMediaTypeStatus(type);
  const owner = controlId ? `Native Picture '${controlId}'` : 'Native Picture';
  const fate = status === 'deferred'
    ? `'${type}', which is deferred by ${PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID}`
    : `'${type}', which is outside ${PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID}`;
  return new NativePictureFormatError(
    `${owner} uses ${fate}. Native Ready Picture currently guarantees PNG and JPEG only; use PNG/JPEG or build the image on the Web target. Expanding WebP/SVG requires a versioned native contract on Win32, AppKit and GTK together.`,
    code ?? (status === 'deferred' ? 'NATIVE_PICTURE_FORMAT_DEFERRED' : 'NATIVE_PICTURE_FORMAT')
  );
}
