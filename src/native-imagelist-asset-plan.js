import { collectWindowImageLists, resolveButtonImageBinding } from './button-image.js';
import { validateStudioResources } from './studio-resources.js';
import {
  PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
  nativePictureResourceDataUri
} from './native-picture-resources.js';

export const PATCH_NATIVE_IMAGELIST_ASSET_PLAN_VERSION = '0.1';
export const PATCH_NATIVE_IMAGELIST_ASSET_PLAN_ID = 'native-imagelist-asset-plan/0.1';

export class NativeImageListAssetPlanError extends Error {
  constructor(message, code = 'NATIVE_IMAGELIST_ASSET_PLAN') {
    super(message);
    this.name = 'NativeImageListAssetPlanError';
    this.code = code;
  }
}

/**
 * Prepare the resource payload needed by native Button ImageList consumers.
 *
 * This is intentionally a pretransport contract. It resolves and validates the
 * exact PNG/JPEG resources that a future Native GUI IR/runtime line must carry,
 * but it does not widen current Native GUI IR 1.7 support. Current desktop
 * lowering must continue to fail closed until Win32/AppKit/GTK consume this
 * plan through a versioned IR/runtime contract.
 */
export function planNativeImageListAssets(windowNode, resources = []) {
  if (!windowNode || windowNode.kind !== 'window' || !Array.isArray(windowNode.body)) {
    throw new NativeImageListAssetPlanError('Native ImageList planning needs one parsed Patch window.', 'NATIVE_IMAGELIST_WINDOW');
  }

  const normalizedResources = validateStudioResources(resources);
  const resourcesById = new Map(normalizedResources.map(resource => [resource.id, resource]));
  const imageLists = collectWindowImageLists(windowNode.body);
  const consumers = [];
  const payloadByResource = new Map();

  walkNodes(windowNode.body, node => {
    if (node.kind !== 'uiControl' || node.control !== 'button' || !node.imageListId || !node.imageItem) return;
    const binding = resolveButtonImageBinding(imageLists, node, node.line);
    const resourceId = binding?.resourceId;
    if (!resourceId) {
      throw new NativeImageListAssetPlanError(
        `Button '${node.id ?? 'unnamed'}' image ${node.imageListId}.${node.imageItem} does not resolve to a project resource.`,
        'NATIVE_IMAGELIST_RESOURCE_ID'
      );
    }
    const resource = resourcesById.get(resourceId);
    if (!resource) {
      throw new NativeImageListAssetPlanError(
        `Button '${node.id ?? 'unnamed'}' image ${node.imageListId}.${node.imageItem} references missing project resource '${resourceId}'.`,
        'NATIVE_IMAGELIST_RESOURCE_MISSING'
      );
    }

    let dataUri;
    try {
      dataUri = nativePictureResourceDataUri(resource);
    } catch (error) {
      const wrapped = new NativeImageListAssetPlanError(
        error?.message ?? String(error),
        error?.code ?? 'NATIVE_IMAGELIST_RESOURCE_FORMAT'
      );
      wrapped.policy = error?.policy ?? PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID;
      throw wrapped;
    }

    if (!payloadByResource.has(resourceId)) {
      payloadByResource.set(resourceId, Object.freeze({
        resourceId,
        mediaType: resource.mediaType,
        size: resource.size,
        sha256: resource.sha256,
        dataUri
      }));
    }

    consumers.push(Object.freeze({
      controlId: node.id ?? null,
      line: node.line ?? null,
      imageListId: binding.imageListId,
      imageItem: binding.imageItem,
      resourceId,
      logicalWidth: binding.width,
      logicalHeight: binding.height
    }));
  });

  return Object.freeze({
    id: PATCH_NATIVE_IMAGELIST_ASSET_PLAN_ID,
    version: PATCH_NATIVE_IMAGELIST_ASSET_PLAN_VERSION,
    status: 'pretransport',
    nativeGuiReady: false,
    formatPolicy: PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID,
    imageListCount: imageLists.size,
    consumerCount: consumers.length,
    consumers: Object.freeze(consumers),
    payloads: Object.freeze([...payloadByResource.values()])
  });
}

function walkNodes(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node);
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) walkNodes(page.body, visit);
      continue;
    }
    if (node?.kind === 'uiControl' && Array.isArray(node.body)) walkNodes(node.body, visit);
  }
}
