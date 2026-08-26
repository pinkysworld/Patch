import {
  PATCH_NATIVE_GUI_IR_V14_VERSION,
  buildNativeGuiIRV14,
  validateNativeGuiIRV14,
  flattenNativeGuiControlsV14,
  flattenNativeGuiMenuItemsV14,
  toV13CompatibleV14,
  hasNativeChromeStage1
} from './native-gui-ir-v14.js';
import {
  PATCH_SEALED_NATIVE_GUI_CHROME_VERSION,
  encodeNativeGuiPayloadV14,
  sealNativeGuiRuntimeV14,
  decodeNativeGuiPayloadV14,
  inspectNativeGuiChromeV14,
  inspectNativeGuiSlidersV14
} from './sealed-native-gui-v14.js';
import { resolveNativePictureResources } from './native-picture-resources.js';

/**
 * Stable product-facing entry point for the current Patch native GUI contract.
 *
 * Versioned modules remain available for frozen compatibility and regression
 * evidence. Current product consumers should import this module instead of a
 * concrete native-gui-ir-vNN/sealed-native-gui-vNN implementation.
 */
export const PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.4/payload-14/runtime-1.5';
export const PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V14_VERSION;
export const PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_CHROME_VERSION;
export const PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.5';

export const PATCH_CURRENT_NATIVE_RUNTIME_TAGS = Object.freeze({
  windows: 'native-win32-runtime-v1.5',
  macos: 'native-macos-runtime-v1.5',
  linux: 'native-linux-runtime-v1.5'
});

export const buildCurrentNativeGuiIR = buildNativeGuiIRV14;
export const validateCurrentNativeGuiIR = validateNativeGuiIRV14;
export const flattenCurrentNativeGuiControls = flattenNativeGuiControlsV14;
export const flattenCurrentNativeGuiMenuItems = flattenNativeGuiMenuItemsV14;
export const encodeCurrentNativeGuiPayload = encodeNativeGuiPayloadV14;
export const decodeCurrentNativeGuiPayload = decodeNativeGuiPayloadV14;
export const inspectCurrentNativeGuiChrome = inspectNativeGuiChromeV14;
export const inspectCurrentNativeGuiSliders = inspectNativeGuiSlidersV14;
export const toLegacyV13NativeGuiIR = toV13CompatibleV14;
export const currentNativeHasChromeStage1 = hasNativeChromeStage1;

export function sealCurrentNativeGuiRuntime(runtimeBytes, nativeGui, options = {}) {
  const resolved = resolveNativePictureResources(nativeGui, options.resources ?? []);
  return sealNativeGuiRuntimeV14(runtimeBytes, resolved.ir, options);
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
