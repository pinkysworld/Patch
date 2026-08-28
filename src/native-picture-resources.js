import { validateStudioResources } from './studio-resources.js';
import {
  PATCH_NATIVE_PICTURE_MEDIA_TYPES,
  PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
  assertNativePictureMediaTypeAllowed,
  assertNativePictureSourceFormat
} from './native-picture-format-policy.js';

export const PATCH_NATIVE_PICTURE_RESOURCE_PREFIX = 'patch-resource:';
export { PATCH_NATIVE_PICTURE_MEDIA_TYPES, PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID };

export class NativePictureResourceError extends Error {
  constructor(message, code = 'NATIVE_PICTURE_RESOURCE') {
    super(message);
    this.name = 'NativePictureResourceError';
    this.code = code;
    this.policy = PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID;
  }
}

/**
 * Resolve Studio project image locators into self-contained Picture, PaintBox
 * `draw image`, ImageList and Button image source data URIs. The returned IR is a
 * deep clone; the caller's Native GUI IR is never mutated. Native Ready runtimes
 * follow native-picture-formats/1.0: PNG/JPEG only.
 */
export function resolveNativePictureResources(input, resources = []) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.forms)) {
    throw new NativePictureResourceError('Native Picture resource resolution needs a Native GUI IR with forms.', 'NATIVE_PICTURE_IR');
  }
  const normalized = validateStudioResources(resources);
  const byId = new Map(normalized.map(resource => [resource.id, resource]));
  const ir = cloneJson(input);
  const resolved = [];

  walkControls(ir.forms, control => {
    if (control?.type === 'picture') {
      resolvePictureSource(control, byId, resolved);
      return;
    }
    if (control?.type === 'paintbox') resolvePaintImageProgram(control, byId, resolved);
    if (control?.type === 'button') resolveButtonImage(control, byId, resolved);
  });
  resolveImageLists(ir, byId, resolved);

  return Object.freeze({
    ir,
    resolved: Object.freeze(resolved),
    resolvedCount: resolved.length,
    resourceCount: normalized.length,
    policy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID
  });
}

export function nativePictureResourceDataUri(resource) {
  const [normalized] = validateStudioResources([resource]);
  assertNativePictureResourceMediaType(normalized);
  return `data:${normalized.mediaType};base64,${normalized.data}`;
}

function resolvePictureSource(control, byId, resolved) {
  const source = String(control.source ?? '');
  if (!source.startsWith(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX)) {
    assertNativePictureSourceFormat(source, { controlId: control.id });
    return;
  }
  const resourceId = source.slice(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX.length);
  const resource = byId.get(resourceId);
  if (!resource) {
    throw new NativePictureResourceError(
      `Native Picture '${control.id ?? 'unnamed'}' references missing project resource '${resourceId}'.`,
      'NATIVE_PICTURE_RESOURCE_MISSING'
    );
  }
  assertNativePictureResourceMediaType(resource, control.id);
  control.source = nativePictureResourceDataUri(resource);
  resolved.push(Object.freeze({
    control: control.id ?? null,
    resourceId,
    mediaType: resource.mediaType,
    size: resource.size,
    sha256: resource.sha256,
    policy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID
  }));
}

function resolvePaintImageProgram(control, byId, resolved) {
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node?.kind === 'draw' && node.command?.operation === 'image') {
        node.command.source = resolvePaintImageSource(node.command.source, control.id, byId, resolved);
      }
      if (node?.thenBody) walk(node.thenBody);
      if (node?.elseBody) walk(node.elseBody);
      if (node?.body) walk(node.body);
    }
  };
  walk(control.paintProgram);
}

function resolvePaintImageSource(value, controlId, byId, resolved) {
  const source = String(value ?? '');
  if (!source.startsWith(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX)) {
    assertNativePictureSourceFormat(source, { controlId });
    return source;
  }
  const resourceId = source.slice(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX.length);
  const resource = byId.get(resourceId);
  if (!resource) {
    throw new NativePictureResourceError(
      `Native PaintBox '${controlId ?? 'unnamed'}' draw image references missing project resource '${resourceId}'.`,
      'NATIVE_PICTURE_RESOURCE_MISSING'
    );
  }
  assertNativePictureResourceMediaType(resource, controlId);
  resolved.push(Object.freeze({
    control: controlId ?? null,
    resourceId,
    mediaType: resource.mediaType,
    size: resource.size,
    sha256: resource.sha256,
    policy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
    consumer: 'paintbox-image'
  }));
  return nativePictureResourceDataUri(resource);
}

function resolveImageLists(ir, byId, resolved) {
  for (const list of ir.imageLists ?? []) {
    for (const item of list.items ?? []) {
      item.source = resolveNamedImageSource(item.source || `${PATCH_NATIVE_PICTURE_RESOURCE_PREFIX}${item.resourceId}`, `imagelist:${list.id}.${item.name}`, byId, resolved, 'imagelist');
    }
  }
}

function resolveButtonImage(control, byId, resolved) {
  if (!control?.imageListId || !control?.imageItem) return;
  const locator = control.imageSource || (control.imageResourceId ? `${PATCH_NATIVE_PICTURE_RESOURCE_PREFIX}${control.imageResourceId}` : '');
  if (!locator) return;
  control.imageSource = resolveNamedImageSource(locator, control.id, byId, resolved, 'button-image');
}

function resolveNamedImageSource(value, controlId, byId, resolved, consumer) {
  const source = String(value ?? '');
  if (!source.startsWith(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX)) {
    assertNativePictureSourceFormat(source, { controlId });
    return source;
  }
  const resourceId = source.slice(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX.length);
  const resource = byId.get(resourceId);
  if (!resource) {
    throw new NativePictureResourceError(
      `Native ${consumer === 'button-image' ? 'Button' : 'ImageList'} '${controlId ?? 'unnamed'}' references missing project resource '${resourceId}'.`,
      'NATIVE_PICTURE_RESOURCE_MISSING'
    );
  }
  assertNativePictureResourceMediaType(resource, controlId);
  resolved.push(Object.freeze({
    control: controlId ?? null,
    resourceId,
    mediaType: resource.mediaType,
    size: resource.size,
    sha256: resource.sha256,
    policy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
    consumer
  }));
  return nativePictureResourceDataUri(resource);
}

function assertNativePictureResourceMediaType(resource, controlId = null) {
  try {
    assertNativePictureMediaTypeAllowed(resource.mediaType, {
      controlId,
      code: 'NATIVE_PICTURE_RESOURCE_FORMAT'
    });
  } catch (error) {
    throw wrapFormatError(error, 'NATIVE_PICTURE_RESOURCE_FORMAT');
  }
}

function wrapFormatError(error, code = error?.code) {
  if (error instanceof NativePictureResourceError) return error;
  const wrapped = new NativePictureResourceError(error?.message ?? String(error), code ?? 'NATIVE_PICTURE_FORMAT');
  wrapped.policy = error?.policy ?? PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID;
  return wrapped;
}

function walkControls(forms, visit) {
  const walk = controls => {
    for (const control of controls ?? []) {
      visit(control);
      if (control?.type === 'tabs') {
        for (const page of control.pages ?? []) walk(page.controls);
      }
      if (control?.type === 'panel') walk(control.controls);
    }
  };
  for (const form of forms ?? []) walk(form.controls);
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new NativePictureResourceError('Native GUI IR is not JSON-serializable.', 'NATIVE_PICTURE_IR');
  }
}
