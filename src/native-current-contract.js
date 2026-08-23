import {
  PATCH_NATIVE_GUI_IR_V13_VERSION,
  buildNativeGuiIRV13,
  validateNativeGuiIRV13,
  flattenNativeGuiControlsV13,
  flattenNativeGuiMenuItemsV13
} from './native-gui-ir-v13.js';
import {
  PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION,
  encodeNativeGuiPayloadV13,
  sealNativeGuiRuntimeV13,
  decodeNativeGuiPayloadV13,
  inspectNativeGuiSlidersV13
} from './sealed-native-gui-v13.js';

/**
 * Stable product-facing entry point for the current Patch native GUI contract.
 *
 * Versioned modules remain available for frozen compatibility and regression
 * evidence. Current product consumers should import this module instead of a
 * concrete native-gui-ir-vNN/sealed-native-gui-vNN implementation.
 */
export const PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V13_VERSION;
export const PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION;
export const PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.4';

export const PATCH_CURRENT_NATIVE_RUNTIME_TAGS = Object.freeze({
  windows: 'native-win32-runtime-v1.4',
  macos: 'native-macos-runtime-v1.4',
  linux: 'native-linux-runtime-v1.4'
});

export const buildCurrentNativeGuiIR = buildNativeGuiIRV13;
export const validateCurrentNativeGuiIR = validateNativeGuiIRV13;
export const flattenCurrentNativeGuiControls = flattenNativeGuiControlsV13;
export const flattenCurrentNativeGuiMenuItems = flattenNativeGuiMenuItemsV13;
export const encodeCurrentNativeGuiPayload = encodeNativeGuiPayloadV13;
export const sealCurrentNativeGuiRuntime = sealNativeGuiRuntimeV13;
export const decodeCurrentNativeGuiPayload = decodeNativeGuiPayloadV13;
export const inspectCurrentNativeGuiSliders = inspectNativeGuiSlidersV13;

export function currentNativeContract() {
  return Object.freeze({
    guiIr: PATCH_CURRENT_NATIVE_GUI_IR_VERSION,
    payload: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,
    runtime: PATCH_CURRENT_NATIVE_RUNTIME_VERSION,
    runtimeTags: PATCH_CURRENT_NATIVE_RUNTIME_TAGS
  });
}
