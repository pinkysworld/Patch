import {
  PATCH_NATIVE_GUI_IR_V16_VERSION,
  buildNativeGuiIRV16,
  validateNativeGuiIRV16,
  flattenNativeGuiControlsV16,
  flattenNativeGuiMenuItemsV16,
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
  PATCH_SEALED_NATIVE_GUI_PAINTBOX_VERSION,
  encodeNativeGuiPayloadV16,
  sealNativeGuiRuntimeV16,
  decodeNativeGuiPayloadV16,
  inspectNativeGuiChromeV16,
  inspectNativeGuiShapesV16,
  inspectNativeGuiPaintBoxesV16,
  inspectNativeGuiSlidersV16
} from './sealed-native-gui-v16.js';
import { resolveNativePictureResources } from './native-picture-resources.js';

/**
 * Stable product-facing entry point for the current Patch native GUI contract.
 *
 * Versioned modules remain available for frozen compatibility and regression
 * evidence. Current product consumers should import this module instead of a
 * concrete native-gui-ir-vNN/sealed-native-gui-vNN implementation.
 */
export const PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.6/payload-16/runtime-1.7';
export const PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V16_VERSION;
export const PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_PAINTBOX_VERSION;
export const PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.7';

export const PATCH_CURRENT_NATIVE_RUNTIME_TAGS = Object.freeze({
  windows: 'native-win32-runtime-v1.7',
  macos: 'native-macos-runtime-v1.7',
  linux: 'native-linux-runtime-v1.7'
});

export const buildCurrentNativeGuiIR = buildNativeGuiIRV16;
export const validateCurrentNativeGuiIR = validateNativeGuiIRV16;
export const flattenCurrentNativeGuiControls = flattenNativeGuiControlsV16;
export const flattenCurrentNativeGuiMenuItems = flattenNativeGuiMenuItemsV16;
export const encodeCurrentNativeGuiPayload = encodeNativeGuiPayloadV16;
export const decodeCurrentNativeGuiPayload = decodeNativeGuiPayloadV16;
export const inspectCurrentNativeGuiChrome = inspectNativeGuiChromeV16;
export const inspectCurrentNativeGuiShapes = inspectNativeGuiShapesV16;
export const inspectCurrentNativeGuiPaintBoxes = inspectNativeGuiPaintBoxesV16;
export const inspectCurrentNativeGuiSliders = inspectNativeGuiSlidersV16;
export const toLegacyV15NativeGuiIR = toV15CompatibleV16;
export const toLegacyV14NativeGuiIR = input => toV14CompatibleV15(toV15CompatibleV16(input));
export const toLegacyV13NativeGuiIR = input => toV13CompatibleV14(toV14CompatibleV15(toV15CompatibleV16(input)));
export const currentNativeHasChromeStage1 = hasNativeChromeStage1;
export const currentNativeHasShapeStage1 = hasNativeShapeStage1;
export const currentNativeHasPaintBoxStage1 = hasNativePaintBoxStage1;

export function sealCurrentNativeGuiRuntime(runtimeBytes, nativeGui, options = {}) {
  const resolved = resolveNativePictureResources(nativeGui, options.resources ?? []);
  return sealNativeGuiRuntimeV16(runtimeBytes, resolved.ir, options);
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
