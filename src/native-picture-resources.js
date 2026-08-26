import { validateStudioResources } from './studio-resources.js';

export const PATCH_NATIVE_PICTURE_RESOURCE_PREFIX = 'patch-resource:';

export class NativePictureResourceError extends Error {
  constructor(message, code = 'NATIVE_PICTURE_RESOURCE') {
    super(message);
    this.name = 'NativePictureResourceError';
    this.code = code;
  }
}

/**
 * Resolve Studio project image locators into self-contained Picture source data URIs.
 * The returned IR is a deep clone; the caller's Native GUI IR is never mutated.
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
    if (control?.type !== 'picture') return;
    const source = String(control.source ?? '');
    if (!source.startsWith(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX)) return;
    const resourceId = source.slice(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX.length);
    const resource = byId.get(resourceId);
    if (!resource) {
      throw new NativePictureResourceError(
        `Native Picture '${control.id ?? 'unnamed'}' references missing project resource '${resourceId}'.`,
        'NATIVE_PICTURE_RESOURCE_MISSING'
      );
    }
    control.source = nativePictureResourceDataUri(resource);
    resolved.push(Object.freeze({
      control: control.id ?? null,
      resourceId,
      mediaType: resource.mediaType,
      size: resource.size,
      sha256: resource.sha256
    }));
  });

  return Object.freeze({
    ir,
    resolved: Object.freeze(resolved),
    resolvedCount: resolved.length,
    resourceCount: normalized.length
  });
}

export function nativePictureResourceDataUri(resource) {
  const [normalized] = validateStudioResources([resource]);
  return `data:${normalized.mediaType};base64,${normalized.data}`;
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
