import {
  PATCH_NATIVE_GUI_IR_V12_VERSION,
  buildNativeGuiIRV12,
  validateNativeGuiIRV12,
  flattenNativeGuiControlsV12,
  flattenNativeGuiMenuItemsV12
} from './native-gui-ir-v12.js?v=868f0784ca7f3972';
import {
  PATCH_SEALED_NATIVE_GUI_TREE_VERSION,
  encodeNativeGuiPayloadV12,
  sealNativeGuiRuntimeV12,
  decodeNativeGuiPayloadV12,
  inspectNativeGuiTreesV12
} from './sealed-native-gui-v12.js?v=868f0784ca7f3972';

/**
 * Stable product-facing entry point for the frozen TreeView compatibility contract.
 *
 * Current Ready/offline builds import `native-current-contract.js` instead.
 * This facade exists so IR 1.2 / payload v12 / runtime v1.3 has one boundary,
 * matching the current Slider line, while versioned modules remain the
 * executable compatibility implementation.
 */
export const PATCH_FROZEN_NATIVE_CONTRACT_ID = 'native-gui-1.2/payload-12/runtime-1.3';
export const PATCH_FROZEN_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V12_VERSION;
export const PATCH_FROZEN_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_TREE_VERSION;
export const PATCH_FROZEN_NATIVE_RUNTIME_VERSION = '1.3';

export const PATCH_FROZEN_NATIVE_RUNTIME_TAGS = Object.freeze({
  windows: 'native-win32-runtime-v1.3',
  macos: 'native-macos-runtime-v1.3',
  linux: 'native-linux-runtime-v1.3'
});

export const buildFrozenNativeGuiIR = buildNativeGuiIRV12;
export const validateFrozenNativeGuiIR = validateNativeGuiIRV12;
export const flattenFrozenNativeGuiControls = flattenNativeGuiControlsV12;
export const flattenFrozenNativeGuiMenuItems = flattenNativeGuiMenuItemsV12;
export const encodeFrozenNativeGuiPayload = encodeNativeGuiPayloadV12;
export const sealFrozenNativeGuiRuntime = sealNativeGuiRuntimeV12;
export const decodeFrozenNativeGuiPayload = decodeNativeGuiPayloadV12;
export const inspectFrozenNativeGuiTrees = inspectNativeGuiTreesV12;

export function frozenNativeContract() {
  return Object.freeze({
    id: PATCH_FROZEN_NATIVE_CONTRACT_ID,
    guiIr: PATCH_FROZEN_NATIVE_GUI_IR_VERSION,
    payload: PATCH_FROZEN_NATIVE_PAYLOAD_VERSION,
    runtime: PATCH_FROZEN_NATIVE_RUNTIME_VERSION,
    runtimeTags: PATCH_FROZEN_NATIVE_RUNTIME_TAGS
  });
}
