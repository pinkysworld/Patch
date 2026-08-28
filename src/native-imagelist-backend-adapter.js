import { NativeGuiError } from './native-gui-frozen-lower.js';
import {
  validateNativeGuiIRV18,
  toV17CompatibleV18,
  flattenNativeGuiControlsV18
} from './native-gui-ir-v18.js';
import { flattenNativeGuiControlsV17 } from './native-gui-ir-v17.js';

/** Adapt Native GUI IR 1.8 ImageList/Button images to IR-1.7 underlays for backend 1.9. */
export function adaptNativeImageListForV18Backend(input) {
  const ir = validateNativeGuiIRV18(input);
  const compatibleIr = toV17CompatibleV18(ir);
  const originalControls = flattenNativeGuiControlsV18(ir);
  const compatibleControls = flattenNativeGuiControlsV17(compatibleIr);
  if (originalControls.length !== compatibleControls.length) {
    throw new NativeGuiError('Native ImageList backend adapter lost control ordering.');
  }

  const buttons = [];
  for (let index = 0; index < originalControls.length; index += 1) {
    const original = originalControls[index];
    const compatible = compatibleControls[index];
    if (original.id !== compatible.id) {
      throw new NativeGuiError(`Native control '${original.id}' lost its IR 1.7 compatibility identity.`);
    }
    if (original.type !== 'button' || !original.imageListId || !original.imageItem) continue;
    buttons.push({
      nativeIndex: index,
      id: original.id,
      imageListId: original.imageListId,
      imageItem: original.imageItem,
      source: String(original.imageSource ?? ''),
      width: Number(original.imageWidth) || 16,
      height: Number(original.imageHeight) || 16
    });
  }

  return {
    ir,
    compatibleIr,
    imageLists: ir.imageLists ?? [],
    buttons,
    events: ir.events ?? [],
    states: new Map((ir.states ?? []).map(state => [state.name, state])),
    controls: originalControls,
    compatibleControls
  };
}
