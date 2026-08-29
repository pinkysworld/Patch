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
 * `draw image`, and ImageList/Button source data URIs. The returned IR is a
 * deep clone; the caller's Native GUI IR is never mutated. Native Ready
 * runtimes follow native-picture-formats/1.0: PNG/JPEG only.
 */
export function resolveNativePictureResources(input, resources = []) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.forms)) {
    throw new NativePictureResourceError('Native Picture resource resolution needs a Native GUI IR with forms.', 'NATIVE_PICTURE_IR');
  }
  const normalized = validateStudioResources(resources);
  const byId = new Map(normalized.map(resource => [resource.id, resource]));
  const ir = cloneJson(input);
  const resolved = [];
  const imageListItems = resolveImageListSources(ir, byId, resolved);

  walkControls(ir.forms, control => {
    if (control?.type === 'picture') {
      resolvePictureSource(control, byId, resolved);
      return;
    }
    if (control?.type === 'paintbox') {
      resolvePaintImageProgram(control, byId, resolved);
      return;
    }
    if (control?.type === 'button' && (control.imageListId || control.imageItem || control.imageSource)) {
      resolveButtonImageSource(control, imageListItems);
    }
  });

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

function resolveImageListSources(ir, byId, resolved) {
  const linked = new Map();
  for (const list of ir.imageLists ?? []) {
    const listId = String(list?.id ?? '').trim();
    if (!listId || !Array.isArray(list.items)) {
      throw new NativePictureResourceError('Native ImageList resource metadata is malformed.', 'NATIVE_IMAGELIST_RESOURCE');
    }
    for (const item of list.items) {
      const itemName = String(item?.name ?? '').trim();
      const resourceId = String(item?.resourceId ?? '').trim();
      if (!itemName || !resourceId) {
        throw new NativePictureResourceError(`Native ImageList '${listId}' contains incomplete image metadata.`, 'NATIVE_IMAGELIST_RESOURCE');
      }
      const expectedLocator = `${PATCH_NATIVE_PICTURE_RESOURCE_PREFIX}${resourceId}`;
      const source = String(item.source ?? expectedLocator);
      let linkedSource = source;
      if (source.startsWith(PATCH_NATIVE_PICTURE_RESOURCE_PREFIX)) {
        if (source !== expectedLocator) {
          throw new NativePictureResourceError(
            `Native ImageList '${listId}.${itemName}' source does not match resource '${resourceId}'.`,
            'NATIVE_IMAGELIST_RESOURCE_MISMATCH'
          );
        }
        const resource = byId.get(resourceId);
        if (resource) {
          assertNativePictureResourceMediaType(resource, `${listId}.${itemName}`);
          linkedSource = nativePictureResourceDataUri(resource);
          resolved.push(Object.freeze({
            control: null,
            resourceId,
            mediaType: resource.mediaType,
            size: resource.size,
            sha256: resource.sha256,
            policy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
            consumer: 'imagelist',
            imageList: listId,
            imageItem: itemName
          }));
        } else {
          const inlineSource = inlineImageSourceFromExpression(item.sourceExpr);
          if (!resourceId.startsWith('inline-') || !inlineSource) {
            throw new NativePictureResourceError(
              `Native ImageList '${listId}.${itemName}' references missing project resource '${resourceId}'.`,
              'NATIVE_PICTURE_RESOURCE_MISSING'
            );
          }
          assertNativePictureSourceFormat(inlineSource, { controlId: `${listId}.${itemName}` });
          linkedSource = inlineSource;
        }
      } else {
        assertNativePictureSourceFormat(source, { controlId: `${listId}.${itemName}` });
      }
      item.source = linkedSource;
      linked.set(`${listId}\u0000${itemName}`, Object.freeze({
        listId,
        itemName,
        resourceId,
        originalSource: source,
        source: linkedSource,
        width: Number(list.width),
        height: Number(list.height)
      }));
    }
  }
  return linked;
}

function inlineImageSourceFromExpression(value) {
  const expression = String(value ?? '').trim();
  if (!expression) return null;
  try {
    const parsed = JSON.parse(expression);
    return typeof parsed === 'string' && /^data:image\/(?:png|jpeg);base64,/i.test(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveButtonImageSource(control, imageListItems) {
  const listId = String(control.imageListId ?? '').trim();
  const itemName = String(control.imageItem ?? '').trim();
  if (!listId || !itemName) {
    throw new NativePictureResourceError(
      `Native Button '${control.id ?? 'unnamed'}' has incomplete ImageList metadata.`,
      'NATIVE_IMAGELIST_BUTTON_BINDING'
    );
  }
  const item = imageListItems.get(`${listId}\u0000${itemName}`);
  if (!item) {
    throw new NativePictureResourceError(
      `Native Button '${control.id ?? 'unnamed'}' references missing ImageList item '${listId}.${itemName}'.`,
      'NATIVE_IMAGELIST_BUTTON_BINDING'
    );
  }
  if (String(control.imageResourceId ?? '') !== item.resourceId) {
    throw new NativePictureResourceError(
      `Native Button '${control.id ?? 'unnamed'}' image resource does not match '${listId}.${itemName}'.`,
      'NATIVE_IMAGELIST_RESOURCE_MISMATCH'
    );
  }
  const currentSource = String(control.imageSource ?? '');
  if (currentSource !== item.originalSource && currentSource !== item.source) {
    throw new NativePictureResourceError(
      `Native Button '${control.id ?? 'unnamed'}' image source does not match '${listId}.${itemName}'.`,
      'NATIVE_IMAGELIST_RESOURCE_MISMATCH'
    );
  }
  if (Number(control.imageWidth) !== item.width || Number(control.imageHeight) !== item.height) {
    throw new NativePictureResourceError(
      `Native Button '${control.id ?? 'unnamed'}' image size does not match ImageList '${listId}'.`,
      'NATIVE_IMAGELIST_SIZE_MISMATCH'
    );
  }
  control.imageSource = item.source;
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
