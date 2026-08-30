import { validateStudioResources } from './studio-resources.js';
import { nativePictureResourceDataUri, PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID } from './native-picture-resources.js';
import {
  flattenNativeGuiControlsV18,
  toV17CompatibleV18,
  validateNativeGuiIRV18
} from './native-gui-ir-v18.js';

export const PATCH_NATIVE_BUTTON_IMAGE_BACKEND_ADAPTER_VERSION = '0.1';
export const PATCH_NATIVE_BUTTON_IMAGE_BACKEND_ADAPTER_ID = 'native-button-image-backend-adapter/0.1';
const MAX_ASSETS = 1024;
const MAX_CONSUMERS = 4096;

export class NativeButtonImageBackendError extends Error {
  constructor(message, code = 'NATIVE_BUTTON_IMAGE_BACKEND') {
    super(message);
    this.name = 'NativeButtonImageBackendError';
    this.code = code;
    this.policy = PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID;
  }
}

/**
 * Prepare IR 1.8 Button image metadata for payload v18.
 *
 * Resource bytes remain outside the Native GUI IR itself. The adapter resolves
 * the already-validated resource ids against the Studio project resources,
 * applies the existing native-picture-formats/1.0 PNG/JPEG policy and
 * deduplicates resource payloads before consumers receive stable asset indices.
 */
export function adaptNativeButtonImagesForV18Backend(input, resources = []) {
  const ir = validateNativeGuiIRV18(input);
  const normalized = validateStudioResources(resources);
  const byId = new Map(normalized.map(resource => [resource.id, resource]));
  const assets = [];
  const assetIndexByResource = new Map();
  const consumers = [];

  for (const control of flattenNativeGuiControlsV18(ir)) {
    if (control.type !== 'button' || !control.image) continue;
    if (consumers.length >= MAX_CONSUMERS) {
      throw new NativeButtonImageBackendError(`Native Button image transport exceeds ${MAX_CONSUMERS} consumers.`, 'NATIVE_BUTTON_IMAGE_TOO_MANY_CONSUMERS');
    }
    const resourceId = control.image.resourceId;
    const resource = byId.get(resourceId);
    if (!resource) {
      throw new NativeButtonImageBackendError(
        `Native Button '${control.id ?? 'unnamed'}' image references missing project resource '${resourceId}'.`,
        'NATIVE_BUTTON_IMAGE_RESOURCE_MISSING'
      );
    }

    let assetIndex = assetIndexByResource.get(resourceId);
    if (assetIndex === undefined) {
      if (assets.length >= MAX_ASSETS) {
        throw new NativeButtonImageBackendError(`Native Button image transport exceeds ${MAX_ASSETS} unique assets.`, 'NATIVE_BUTTON_IMAGE_TOO_MANY_ASSETS');
      }
      let dataUri;
      try {
        dataUri = nativePictureResourceDataUri(resource);
      } catch (error) {
        const wrapped = new NativeButtonImageBackendError(
          error?.message ?? String(error),
          error?.code ?? 'NATIVE_BUTTON_IMAGE_RESOURCE_FORMAT'
        );
        wrapped.policy = error?.policy ?? PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID;
        throw wrapped;
      }
      assetIndex = assets.length;
      assetIndexByResource.set(resourceId, assetIndex);
      assets.push(Object.freeze({
        assetIndex,
        resourceId,
        mediaType: resource.mediaType,
        size: resource.size,
        sha256: resource.sha256,
        dataUri
      }));
    }

    consumers.push(Object.freeze({
      nativeIndex: control.nativeIndex,
      formIndex: control.formIndex,
      controlId: control.id,
      assetIndex,
      resourceId,
      imageListId: control.image.imageListId,
      imageItem: control.image.imageItem,
      logicalWidth: control.image.logicalWidth,
      logicalHeight: control.image.logicalHeight
    }));
  }

  return Object.freeze({
    id: PATCH_NATIVE_BUTTON_IMAGE_BACKEND_ADAPTER_ID,
    version: PATCH_NATIVE_BUTTON_IMAGE_BACKEND_ADAPTER_VERSION,
    formatPolicy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
    compatibleIr: toV17CompatibleV18(ir),
    assets: Object.freeze(assets),
    consumers: Object.freeze(consumers),
    assetCount: assets.length,
    consumerCount: consumers.length
  });
}
