import { validateStudioResources } from './studio-resources.js';
import {
  PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
  nativePictureResourceDataUri
} from './native-picture-resources.js';
import { normalizeWindowIconExpression } from './window-icon.js';

export const PATCH_NATIVE_WINDOW_ICON_ASSET_PLAN_VERSION = '0.1';
export const PATCH_NATIVE_WINDOW_ICON_ASSET_PLAN_ID = 'native-window-icon-asset-plan/0.1';

export class NativeWindowIconAssetPlanError extends Error {
  constructor(message, code = 'NATIVE_WINDOW_ICON_ASSET_PLAN') {
    super(message);
    this.name = 'NativeWindowIconAssetPlanError';
    this.code = code;
  }
}

/**
 * Prepare deterministic project-backed icon assets for a future native
 * application/window icon transport.
 *
 * This deliberately does not widen the current Native GUI Ready contract. It
 * mirrors the existing Web rule that the first icon-bearing Form supplies the
 * application icon, while retaining every icon-bearing Form as an explicit
 * consumer. Resources are validated through the current native picture
 * PNG/JPEG policy and deduplicated by stable project resource id.
 */
export function planNativeWindowIconAssets(nodes, resources = []) {
  if (!Array.isArray(nodes)) {
    throw new NativeWindowIconAssetPlanError(
      'Native window icon planning needs a parsed Patch program.',
      'NATIVE_WINDOW_ICON_PROGRAM'
    );
  }

  const normalizedResources = validateStudioResources(resources);
  const resourcesById = new Map(normalizedResources.map(resource => [resource.id, resource]));
  const consumers = [];
  const payloadByResource = new Map();
  let windowIndex = 0;

  for (const node of nodes) {
    if (node?.kind !== 'window') continue;
    if (node.iconExpr) {
      const icon = normalizeIcon(node);
      if (!icon.resourceId) {
        throw new NativeWindowIconAssetPlanError(
          `Native Form '${node.id ?? `window${windowIndex + 1}`}' icon must use a project resource locator such as "patch-resource:app.icon". Network and external-file icon sources are not deterministic native build inputs.`,
          'NATIVE_WINDOW_ICON_PROJECT_RESOURCE_REQUIRED'
        );
      }

      const resource = resourcesById.get(icon.resourceId);
      if (!resource) {
        throw new NativeWindowIconAssetPlanError(
          `Native Form '${node.id ?? `window${windowIndex + 1}`}' icon references missing project resource '${icon.resourceId}'.`,
          'NATIVE_WINDOW_ICON_RESOURCE_MISSING'
        );
      }

      let dataUri;
      try {
        dataUri = nativePictureResourceDataUri(resource);
      } catch (error) {
        const wrapped = new NativeWindowIconAssetPlanError(
          error?.message ?? String(error),
          error?.code ?? 'NATIVE_WINDOW_ICON_RESOURCE_FORMAT'
        );
        wrapped.policy = error?.policy ?? PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID;
        throw wrapped;
      }

      if (!payloadByResource.has(resource.id)) {
        payloadByResource.set(resource.id, Object.freeze({
          resourceId: resource.id,
          mediaType: resource.mediaType,
          size: resource.size,
          sha256: resource.sha256,
          dataUri
        }));
      }

      consumers.push(Object.freeze({
        windowIndex,
        windowId: node.id ?? null,
        line: node.line ?? null,
        iconExpr: icon.sourceExpr,
        resourceId: resource.id
      }));
    }
    windowIndex += 1;
  }

  const applicationIcon = consumers.length
    ? Object.freeze({
        windowIndex: consumers[0].windowIndex,
        windowId: consumers[0].windowId,
        line: consumers[0].line,
        resourceId: consumers[0].resourceId
      })
    : null;

  return Object.freeze({
    id: PATCH_NATIVE_WINDOW_ICON_ASSET_PLAN_ID,
    version: PATCH_NATIVE_WINDOW_ICON_ASSET_PLAN_VERSION,
    status: 'pretransport',
    nativeGuiReady: false,
    formatPolicy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
    applicationIcon,
    consumerCount: consumers.length,
    consumers: Object.freeze(consumers),
    payloads: Object.freeze([...payloadByResource.values()])
  });
}

function normalizeIcon(node) {
  try {
    return normalizeWindowIconExpression(node.iconExpr);
  } catch (error) {
    const wrapped = new NativeWindowIconAssetPlanError(
      error?.message ?? String(error),
      error?.code ?? 'NATIVE_WINDOW_ICON_SOURCE'
    );
    wrapped.policy = error?.policy ?? null;
    throw wrapped;
  }
}
