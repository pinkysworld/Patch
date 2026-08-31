import {
  PATCH_NATIVE_GUI_IR_V18_VERSION,
  buildNativeGuiIRV18,
  validateNativeGuiIRV18,
  flattenNativeGuiControlsV18,
  flattenNativeGuiMenuItemsV18,
  toV17CompatibleV18,
  hasNativeButtonImage
} from './native-gui-ir-v18.js';
import {
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
  PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_VERSION,
  encodeNativeGuiPayloadV18,
  sealNativeGuiRuntimeV18,
  decodeNativeGuiPayloadV18,
  inspectNativeGuiButtonImagesV18,
  inspectNativeGuiChromeV18,
  inspectNativeGuiShapesV18,
  inspectNativeGuiPaintBoxesV18,
  inspectNativeGuiPaintImagesV18,
  inspectNativeGuiSlidersV18
} from './sealed-native-gui-v18.js';

/**
 * Stable product-facing entry point for the current Patch native GUI contract.
 *
 * Versioned modules remain available for frozen compatibility and regression
 * evidence. Current product consumers should import this module instead of a
 * concrete native-gui-ir-vNN/sealed-native-gui-vNN implementation.
 */
export const PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.8/payload-18/runtime-1.9';
export const PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V18_VERSION;
export const PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_BUTTON_IMAGE_VERSION;
export const PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.9';

export const PATCH_CURRENT_NATIVE_RUNTIME_TAGS = Object.freeze({
  windows: 'native-win32-runtime-v1.9',
  macos: 'native-macos-runtime-v1.9',
  linux: 'native-linux-runtime-v1.9'
});

export const buildCurrentNativeGuiIR = buildNativeGuiIRV18;
export const validateCurrentNativeGuiIR = validateNativeGuiIRV18;
export const flattenCurrentNativeGuiControls = flattenNativeGuiControlsV18;
export const flattenCurrentNativeGuiMenuItems = flattenNativeGuiMenuItemsV18;
export const encodeCurrentNativeGuiPayload = encodeNativeGuiPayloadV18;
export const decodeCurrentNativeGuiPayload = decodeNativeGuiPayloadV18;
export const inspectCurrentNativeGuiButtonImages = inspectNativeGuiButtonImagesV18;
export const inspectCurrentNativeGuiChrome = inspectNativeGuiChromeV18;
export const inspectCurrentNativeGuiShapes = inspectNativeGuiShapesV18;
export const inspectCurrentNativeGuiPaintBoxes = inspectNativeGuiPaintBoxesV18;
export const inspectCurrentNativeGuiPaintImages = inspectNativeGuiPaintImagesV18;
export const inspectCurrentNativeGuiSliders = inspectNativeGuiSlidersV18;
export const toLegacyV17NativeGuiIR = toV17CompatibleV18;
export const toLegacyV16NativeGuiIR = input => toV16CompatibleV17(toV17CompatibleV18(input));
export const toLegacyV15NativeGuiIR = input => toV15CompatibleV16(toV16CompatibleV17(toV17CompatibleV18(input)));
export const toLegacyV14NativeGuiIR = input => toV14CompatibleV15(toV15CompatibleV16(toV16CompatibleV17(toV17CompatibleV18(input))));
export const toLegacyV13NativeGuiIR = input => toV13CompatibleV14(toV14CompatibleV15(toV15CompatibleV16(toV16CompatibleV17(toV17CompatibleV18(input)))));
export const currentNativeHasChromeStage1 = hasNativeChromeStage1;
export const currentNativeHasShapeStage1 = hasNativeShapeStage1;
export const currentNativeHasPaintBoxStage1 = hasNativePaintBoxStage1;
export const currentNativeHasPaintBoxImage = hasNativePaintBoxImage;
export const currentNativeHasButtonImage = hasNativeButtonImage;

export function sealCurrentNativeGuiRuntime(runtimeBytes, nativeGui, options = {}) {
  return sealNativeGuiRuntimeV18(runtimeBytes, nativeGui, options);
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
