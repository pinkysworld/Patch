import {
  PATCH_NATIVE_GUI_IR_V17_VERSION,
  buildNativeGuiIRV17,
  validateNativeGuiIRV17,
  flattenNativeGuiControlsV17,
  flattenNativeGuiMenuItemsV17,
  toV16CompatibleV17,
  hasNativePaintBoxImage
} from './native-gui-ir-v17.js';
import {
  toV15CompatibleV16,
  hasNativePaintBoxStage1
} from './native-gui-ir-v16.js';
import {
  toV14CompatibleV15,
  hasNativeShapeStage1
} from './native-gui-ir-v15.js';
import {
  toV13CompatibleV14,
  hasNativeChromeStage1
} from './native-gui-ir-v14.js';
import {
  PATCH_SEALED_NATIVE_GUI_PAINTBOX_IMAGE_VERSION,
  encodeNativeGuiPayloadV17,
  sealNativeGuiRuntimeV17,
  decodeNativeGuiPayloadV17,
  inspectNativeGuiChromeV17,
  inspectNativeGuiShapesV17,
  inspectNativeGuiPaintBoxesV17,
  inspectNativeGuiPaintImagesV17,
  inspectNativeGuiSlidersV17
} from './sealed-native-gui-v17.js';
import { resolveNativePictureResources } from './native-picture-resources.js';

/**
 * Stable product-facing entry point for the current Patch native GUI contract.
 *
 * Versioned modules remain available for frozen compatibility and regression
 * evidence. Current product consumers should import this module instead of a
 * concrete native-gui-ir-vNN/sealed-native-gui-vNN implementation.
 */
export const PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.7/payload-17/runtime-1.8';
export const PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V17_VERSION;
export const PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_PAINTBOX_IMAGE_VERSION;
export const PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.8';

export const PATCH_CURRENT_NATIVE_RUNTIME_TAGS = Object.freeze({
  windows: 'native-win32-runtime-v1.8',
  macos: 'native-macos-runtime-v1.8',
  linux: 'native-linux-runtime-v1.8'
});

export const buildCurrentNativeGuiIR = buildNativeGuiIRV17;
export const validateCurrentNativeGuiIR = validateNativeGuiIRV17;
export const flattenCurrentNativeGuiControls = flattenNativeGuiControlsV17;
export const flattenCurrentNativeGuiMenuItems = flattenNativeGuiMenuItemsV17;
export const encodeCurrentNativeGuiPayload = encodeNativeGuiPayloadV17;
export const decodeCurrentNativeGuiPayload = decodeNativeGuiPayloadV17;
export const inspectCurrentNativeGuiChrome = inspectNativeGuiChromeV17;
export const inspectCurrentNativeGuiShapes = inspectNativeGuiShapesV17;
export const inspectCurrentNativeGuiPaintBoxes = inspectNativeGuiPaintBoxesV17;
export const inspectCurrentNativeGuiPaintImages = inspectNativeGuiPaintImagesV17;
export const inspectCurrentNativeGuiSliders = inspectNativeGuiSlidersV17;
export const toLegacyV16NativeGuiIR = toV16CompatibleV17;
export const toLegacyV15NativeGuiIR = input => toV15CompatibleV16(toV16CompatibleV17(input));
export const toLegacyV14NativeGuiIR = input => toV14CompatibleV15(toV15CompatibleV16(toV16CompatibleV17(input)));
export const toLegacyV13NativeGuiIR = input => toV13CompatibleV14(toV14CompatibleV15(toV15CompatibleV16(toV16CompatibleV17(input))));
export const currentNativeHasChromeStage1 = hasNativeChromeStage1;
export const currentNativeHasShapeStage1 = hasNativeShapeStage1;
export const currentNativeHasPaintBoxStage1 = hasNativePaintBoxStage1;
export const currentNativeHasPaintBoxImage = hasNativePaintBoxImage;

export function sealCurrentNativeGuiRuntime(runtimeBytes, nativeGui, options = {}) {
  const resolved = resolveNativePictureResources(nativeGui, options.resources ?? []);
  return sealNativeGuiRuntimeV17(runtimeBytes, resolved.ir, options);
}

export function currentNativeContract() {
  return Object.freeze({
    id: PATCH_CURRENT_NATIVE_CONTRACT_ID,
    guiIr: PATCH_CURRENT_NATIVE_GUI_IR_VERSION,
    payload: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,
    runtime: PATCH_CURRENT_NATIVE_RUNTIME_VERSION,
    runtimeTags: PATCH_CURRENT_NATIVE_RUNTIME_TAGS
  });
}
