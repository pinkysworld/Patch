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
import { NativeGuiError } from './native-gui-frozen-lower.js';
import { createNativeWindowIconPackagePlanV110 } from './native-window-icon-package-v110.js';
import { resolveNativePictureResources } from './native-picture-resources.js';

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

export function buildCurrentNativeGuiIR(compiled) {
  assertCurrentNativeInputPresentation(compiled?.ast);
  assertCurrentNativeListboxPresentation(compiled?.ast);
  assertCurrentNativeSliderPresentation(compiled?.ast);
  assertCurrentNativePanelPresentation(compiled?.ast);
  assertCurrentNativePanelScroll(compiled?.ast);
  assertCurrentNativePanelLayout(compiled?.ast);
  return buildNativeGuiIRV19(compiled);
}
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
  const resources = options.resources ?? [];
  const resolved = resolveNativePictureResources(nativeGui, resources);
  const platform = String(options.platform ?? '').toLowerCase();
  if (platform === 'windows' || platform === 'win32') {
    const plan = createNativeWindowIconPackagePlanV110(runtimeBytes, resolved.ir, {
      platform: 'windows',
      name: options.name ?? 'PatchApp',
      resources
    });
    const executable = plan.files.find(file => file.path === plan.executable);
    if (!executable) throw new Error('Current Ready Windows package plan did not produce its executable.');
    return executable.bytes;
  }
  return sealNativeGuiRuntimeV19(runtimeBytes, resolved.ir, options);
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

function assertCurrentNativeInputPresentation(nodes) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'input') {
      const name = node.id ? ` '${node.id}'` : '';
      if (node.inputPresentation === 'password') {
        throw new NativeGuiError(`PasswordEdit Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no password-input presentation contract; validation fails closed rather than lowering it as a visible single-line Input.`);
      }
      if (node.inputMask) {
        throw new NativeGuiError(`MaskedEdit Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no input-mask contract; validation fails closed rather than dropping mask enforcement and lowering it as a plain Input.`);
      }
    }
    if (node?.kind === 'window' || (node?.kind === 'uiControl' && node.control === 'panel')) {
      assertCurrentNativeInputPresentation(node.body);
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) assertCurrentNativeInputPresentation(page.body);
    }
  }
}

function assertCurrentNativeListboxPresentation(nodes) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'listbox' && node.listboxPresentation === 'checked') {
      const name = node.id ? ` '${node.id}'` : '';
      throw new NativeGuiError(`CheckedListBox Stage 1${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no checked-list presentation contract; validation fails closed rather than lowering checked state as an ordinary ListBox selection.`);
    }
    if (node?.kind === 'window' || (node?.kind === 'uiControl' && node.control === 'panel')) {
      assertCurrentNativeListboxPresentation(node.body);
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) assertCurrentNativeListboxPresentation(page.body);
    }
  }
}

function assertCurrentNativeSliderPresentation(nodes) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'slider' && node.sliderPresentation === 'progress') {
      const name = node.id ? ` '${node.id}'` : '';
      throw new NativeGuiError(`ProgressBar Stage 1${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no passive progress presentation contract; validation fails closed rather than lowering it as an interactive Slider.`);
    }
    if (node?.kind === 'window' || (node?.kind === 'uiControl' && node.control === 'panel')) {
      assertCurrentNativeSliderPresentation(node.body);
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) assertCurrentNativeSliderPresentation(page.body);
    }
  }
}

function assertCurrentNativePanelPresentation(nodes) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'panel' && node.panelPresentation === 'group') {
      const name = node.id ? ` '${node.id}'` : '';
      throw new NativeGuiError(`GroupBox Stage 1${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no GroupBox presentation contract; validation fails closed rather than lowering it as a plain Panel.`);
    }
    if (node?.kind === 'window' || (node?.kind === 'uiControl' && node.control === 'panel')) {
      assertCurrentNativePanelPresentation(node.body);
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) assertCurrentNativePanelPresentation(page.body);
    }
  }
}

function assertCurrentNativePanelScroll(nodes) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'panel' && node.panelScroll === 'auto') {
      const name = node.id ? ` '${node.id}'` : '';
      throw new NativeGuiError(`ScrollBox Stage 1${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no Panel scrolling contract; validation fails closed rather than clipping or lowering it as a plain Panel.`);
    }
    if (node?.kind === 'window' || (node?.kind === 'uiControl' && node.control === 'panel')) {
      assertCurrentNativePanelScroll(node.body);
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) assertCurrentNativePanelScroll(page.body);
    }
  }
}

function assertCurrentNativePanelLayout(nodes) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'panel') {
      const positioned = (node.body ?? []).find(child => child?.kind === 'uiControl' && child.layout);
      if (positioned) {
        const name = node.id ? ` '${node.id}'` : '';
        throw new NativeGuiError(`Panel Stage 2 relative child layout in Panel${name} is not supported by Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION}. Use flow-layout Panel children for native builds until a new native containment contract is promoted.`);
      }
      assertCurrentNativePanelLayout(node.body);
      continue;
    }
    if (node?.kind === 'window') assertCurrentNativePanelLayout(node.body);
    if (node?.kind === 'tabs') for (const page of node.body ?? []) assertCurrentNativePanelLayout(page.body);
  }
}
