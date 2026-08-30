import { NativeGuiError } from './native-gui-frozen-lower.js?v=868f0784ca7f3972';
import {
  validateNativeGuiIRV14,
  toV13CompatibleV14,
  flattenNativeGuiControlsV14,
  PATCH_NATIVE_CHROME_CONTROLS
} from './native-gui-ir-v14.js?v=868f0784ca7f3972';
import { flattenNativeGuiControlsV13 } from './native-gui-ir-v13.js?v=868f0784ca7f3972';

const CHROME = new Set(PATCH_NATIVE_CHROME_CONTROLS);

/** Adapt Native GUI IR 1.4 Chrome Stage 1 controls to IR-1.3 shadows for backend 1.5. */
export function adaptNativeChromeForV14Backend(input) {
  const ir = validateNativeGuiIRV14(input);
  const compatibleIr = toV13CompatibleV14(ir);
  const originalControls = flattenNativeGuiControlsV14(ir);
  const compatibleControls = flattenNativeGuiControlsV13(compatibleIr);
  if (originalControls.length !== compatibleControls.length) {
    throw new NativeGuiError('Native Chrome backend adapter lost control ordering.');
  }

  const chrome = [];
  for (let index = 0; index < originalControls.length; index += 1) {
    const original = originalControls[index];
    if (!CHROME.has(original.type)) continue;
    const compatible = compatibleControls[index];
    if (!compatibleShadow(original, compatible)) {
      throw new NativeGuiError(`Native ${displayChrome(original.type)} '${original.id}' did not project to a compatibility shadow.`);
    }
    chrome.push({
      ...original,
      nativeIndex: index,
      commandId: 1000 + index,
      shadowType: compatible.type
    });
  }

  const chromeIds = new Set(chrome.map(item => item.id));
  const eventPatches = [];
  for (let eventIndex = 0; eventIndex < (ir.events ?? []).length; eventIndex += 1) {
    const originalEvent = ir.events[eventIndex];
    if (!chromeIds.has(originalEvent.control)) continue;
    const compatibleEvent = compatibleIr.events?.[eventIndex];
    if (!compatibleEvent || compatibleEvent.control !== originalEvent.control) {
      throw new NativeGuiError(`Native Chrome '${originalEvent.control}' event ordering drifted in the compatibility projection.`);
    }
    eventPatches.push({
      eventIndex,
      control: originalEvent.control,
      event: originalEvent.event,
      compatibleEvent: compatibleEvent.event
    });
  }

  return {
    ir,
    compatibleIr,
    chrome,
    events: ir.events ?? [],
    eventPatches,
    states: new Map((ir.states ?? []).map(state => [state.name, state])),
    controls: originalControls,
    compatibleControls
  };
}

function compatibleShadow(original, compatible) {
  if (original.id !== compatible.id) return false;
  if (original.type === 'panel' || original.type === 'statusbar') return compatible.type === 'text';
  if (original.type === 'timer' || original.type === 'picture') return compatible.type === 'button';
  return false;
}

function displayChrome(type) {
  if (type === 'picture') return 'PictureBox';
  if (type === 'statusbar') return 'StatusBar';
  return type[0].toUpperCase() + type.slice(1);
}
