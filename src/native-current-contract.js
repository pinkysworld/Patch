import {
  PATCH_NATIVE_GUI_IR_V15_VERSION,
  buildNativeGuiIRV15,
  validateNativeGuiIRV15,
  flattenNativeGuiControlsV15,
  flattenNativeGuiMenuItemsV15,
  toV14CompatibleV15,
  hasNativeShapeStage1
} from './native-gui-ir-v15.js';
import {
  toV13CompatibleV14,
  hasNativeChromeStage1
} from './native-gui-ir-v14.js';
import {
  PATCH_SEALED_NATIVE_GUI_SHAPE_VERSION,
  encodeNativeGuiPayloadV15,
  sealNativeGuiRuntimeV15,
  decodeNativeGuiPayloadV15,
  inspectNativeGuiChromeV15,
  inspectNativeGuiShapesV15,
  inspectNativeGuiSlidersV15
} from './sealed-native-gui-v15.js';
import { resolveNativePictureResources } from './native-picture-resources.js';

/**
 * Stable product-facing entry point for the current Patch native GUI contract.
 *
 * Versioned modules remain available for frozen compatibility and regression
 * evidence. Current product consumers should import this module instead of a
 * concrete native-gui-ir-vNN/sealed-native-gui-vNN implementation.
 */
export const PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.5/payload-15/runtime-1.6';
export const PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V15_VERSION;
export const PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_SHAPE_VERSION;
export const PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.6';

export const PATCH_CURRENT_NATIVE_RUNTIME_TAGS = Object.freeze({
  windows: 'native-win32-runtime-v1.6',
  macos: 'native-macos-runtime-v1.6',
  linux: 'native-linux-runtime-v1.6'
});

export const buildCurrentNativeGuiIR = buildNativeGuiIRV15;
export const validateCurrentNativeGuiIR = validateNativeGuiIRV15;
export const flattenCurrentNativeGuiControls = flattenNativeGuiControlsV15;
export const flattenCurrentNativeGuiMenuItems = flattenNativeGuiMenuItemsV15;
export const encodeCurrentNativeGuiPayload = encodeNativeGuiPayloadV15;
export const decodeCurrentNativeGuiPayload = decodeNativeGuiPayloadV15;
export const inspectCurrentNativeGuiChrome = inspectNativeGuiChromeV15;
export const inspectCurrentNativeGuiShapes = inspectNativeGuiShapesV15;
export const inspectCurrentNativeGuiSliders = inspectNativeGuiSlidersV15;
export const toLegacyV14NativeGuiIR = toV14CompatibleV15;
export const toLegacyV13NativeGuiIR = input => toV13CompatibleV14(toV14CompatibleV15(input));
export const currentNativeHasChromeStage1 = hasNativeChromeStage1;
export const currentNativeHasShapeStage1 = hasNativeShapeStage1;

export function sealCurrentNativeGuiRuntime(runtimeBytes, nativeGui, options = {}) {
  const resolved = resolveNativePictureResources(nativeGui, options.resources ?? []);
  return sealNativeGuiRuntimeV15(runtimeBytes, resolved.ir, options);
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
