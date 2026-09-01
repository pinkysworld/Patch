import {
  PATCH_NATIVE_GUI_IR_V19_VERSION,
  buildNativeGuiIRV19,
  validateNativeGuiIRV19,
  flattenNativeGuiControlsV19,
  flattenNativeGuiMenuItemsV19,
  toV18CompatibleV19,
  hasNativeWindowIcon
} from './native-gui-ir-v19.js';
import {
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
  PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_VERSION,
  encodeNativeGuiPayloadV19,
  sealNativeGuiRuntimeV19,
  decodeNativeGuiPayloadV19,
  inspectNativeGuiWindowIconsV19,
  inspectNativeGuiButtonImagesV19,
  inspectNativeGuiChromeV19,
  inspectNativeGuiShapesV19,
  inspectNativeGuiPaintBoxesV19,
  inspectNativeGuiPaintImagesV19,
  inspectNativeGuiSlidersV19
} from './sealed-native-gui-v19.js';

/**
 * Stable product-facing entry point for the current Patch native GUI contract.
 *
 * Versioned modules remain available for frozen compatibility and regression
 * evidence. Current product consumers should import this module instead of a
 * concrete native-gui-ir-vNN/sealed-native-gui-vNN implementation.
 */
export const PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.9/payload-19/runtime-1.10';
export const PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V19_VERSION;
export const PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_WINDOW_ICON_VERSION;
export const PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.10';

export const PATCH_CURRENT_NATIVE_RUNTIME_TAGS = Object.freeze({
  windows: 'native-win32-runtime-v1.10',
  macos: 'native-macos-runtime-v1.10',
  linux: 'native-linux-runtime-v1.10'
});

export const buildCurrentNativeGuiIR = buildNativeGuiIRV19;
export const validateCurrentNativeGuiIR = validateNativeGuiIRV19;
export const flattenCurrentNativeGuiControls = flattenNativeGuiControlsV19;
export const flattenCurrentNativeGuiMenuItems = flattenNativeGuiMenuItemsV19;
export const encodeCurrentNativeGuiPayload = encodeNativeGuiPayloadV19;
export const decodeCurrentNativeGuiPayload = decodeNativeGuiPayloadV19;
export const inspectCurrentNativeGuiWindowIcons = inspectNativeGuiWindowIconsV19;
export const inspectCurrentNativeGuiButtonImages = inspectNativeGuiButtonImagesV19;
export const inspectCurrentNativeGuiChrome = inspectNativeGuiChromeV19;
export const inspectCurrentNativeGuiShapes = inspectNativeGuiShapesV19;
export const inspectCurrentNativeGuiPaintBoxes = inspectNativeGuiPaintBoxesV19;
export const inspectCurrentNativeGuiPaintImages = inspectNativeGuiPaintImagesV19;
export const inspectCurrentNativeGuiSliders = inspectNativeGuiSlidersV19;

export const toLegacyV18NativeGuiIR = toV18CompatibleV19;
export const toLegacyV17NativeGuiIR = input => toV17CompatibleV18(toV18CompatibleV19(input));
export const toLegacyV16NativeGuiIR = input => toV16CompatibleV17(toV17CompatibleV18(toV18CompatibleV19(input)));
export const toLegacyV15NativeGuiIR = input => toV15CompatibleV16(toV16CompatibleV17(toV17CompatibleV18(toV18CompatibleV19(input))));
export const toLegacyV14NativeGuiIR = input => toV14CompatibleV15(toV15CompatibleV16(toV16CompatibleV17(toV17CompatibleV18(toV18CompatibleV19(input)))));
export const toLegacyV13NativeGuiIR = input => toV13CompatibleV14(toV14CompatibleV15(toV15CompatibleV16(toV16CompatibleV17(toV17CompatibleV18(toV18CompatibleV19(input))))));

export const currentNativeHasChromeStage1 = hasNativeChromeStage1;
export const currentNativeHasShapeStage1 = hasNativeShapeStage1;
export const currentNativeHasPaintBoxStage1 = hasNativePaintBoxStage1;
export const currentNativeHasPaintBoxImage = hasNativePaintBoxImage;
export const currentNativeHasButtonImage = hasNativeButtonImage;
export const currentNativeHasWindowIcon = hasNativeWindowIcon;

export function sealCurrentNativeGuiRuntime(runtimeBytes, nativeGui, options = {}) {
  return sealNativeGuiRuntimeV19(runtimeBytes, nativeGui, options);
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
