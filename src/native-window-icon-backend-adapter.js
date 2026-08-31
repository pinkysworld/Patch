import { validateStudioResources } from './studio-resources.js';
import {
  PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
  nativePictureResourceDataUri
} from './native-picture-resources.js';
import { validateNativeGuiIRV19 } from './native-gui-ir-v19.js';

export class NativeWindowIconBackendError extends Error {
  constructor(message, code = 'NATIVE_WINDOW_ICON_BACKEND') {
    super(message);
    this.name = 'NativeWindowIconBackendError';
    this.code = code;
  }
}

/**
 * Resolve IR 1.9 Form icon resource ids into deduplicated native payload assets.
 * This adapter is transport-only. It does not claim that any desktop runtime
 * consumes the assets yet.
 */
export function adaptNativeWindowIconsForV19Backend(ir, resources = []) {
  validateNativeGuiIRV19(ir);
  const normalized = validateStudioResources(resources);
  const byId = new Map(normalized.map(resource => [resource.id, resource]));
  const assetIndexByResource = new Map();
  const assets = [];
  const consumers = [];

  for (let formIndex = 0; formIndex < ir.forms.length; formIndex += 1) {
    const form = ir.forms[formIndex];
    if (!form.icon) continue;
    const resourceId = form.icon.resourceId;
    const resource = byId.get(resourceId);
    if (!resource) {
      throw new NativeWindowIconBackendError(
        `Native Form '${form.id ?? formIndex + 1}' icon references missing project resource '${resourceId}'.`,
        'NATIVE_WINDOW_ICON_RESOURCE_MISSING'
      );
    }

    let dataUri;
    try {
      dataUri = nativePictureResourceDataUri(resource);
    } catch (error) {
      const wrapped = new NativeWindowIconBackendError(
        error?.message ?? String(error),
        error?.code ?? 'NATIVE_WINDOW_ICON_RESOURCE_FORMAT'
      );
      wrapped.policy = error?.policy ?? PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID;
      throw wrapped;
    }

    let assetIndex = assetIndexByResource.get(resourceId);
    if (assetIndex === undefined) {
      assetIndex = assets.length;
      assetIndexByResource.set(resourceId, assetIndex);
      assets.push(Object.freeze({
        resourceId,
        mediaType: resource.mediaType,
        size: resource.size,
        sha256: resource.sha256,
        dataUri
      }));
    }

    consumers.push(Object.freeze({
      formIndex,
      formId: form.id ?? null,
      assetIndex,
      resourceId,
      application: form.icon.application
    }));
  }

  const applicationIcon = consumers.find(consumer => consumer.application) ?? null;
  return Object.freeze({
    formatPolicy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
    assetCount: assets.length,
    consumerCount: consumers.length,
    applicationIcon,
    assets: Object.freeze(assets),
    consumers: Object.freeze(consumers)
  });
}
