import { NativeGuiError } from './native-gui-frozen-lower.js';
import {
  validateNativeGuiIRV16,
  toV15CompatibleV16,
  flattenNativeGuiControlsV16,
  PATCH_NATIVE_PAINTBOX_CONTROLS
} from './native-gui-ir-v16.js';
import { flattenNativeGuiControlsV15 } from './native-gui-ir-v15.js';

const PAINTBOX = new Set(PATCH_NATIVE_PAINTBOX_CONTROLS);

/** Adapt Native GUI IR 1.6 PaintBox controls to IR-1.5 Text shadows for backend 1.7. */
export function adaptNativePaintBoxForV16Backend(input) {
  const ir = validateNativeGuiIRV16(input);
  const compatibleIr = toV15CompatibleV16(ir);
  const originalControls = flattenNativeGuiControlsV16(ir);
  const compatibleControls = flattenNativeGuiControlsV15(compatibleIr);
  if (originalControls.length !== compatibleControls.length) {
    throw new NativeGuiError('Native PaintBox backend adapter lost control ordering.');
  }

  const paintboxes = [];
  for (let index = 0; index < originalControls.length; index += 1) {
    const original = originalControls[index];
    if (!PAINTBOX.has(original.type)) continue;
    const compatible = compatibleControls[index];
    if (original.id !== compatible.id || compatible.type !== 'text') {
      throw new NativeGuiError(`Native PaintBox '${original.id}' did not project to a Text compatibility shadow.`);
    }
    paintboxes.push({
      ...original,
      nativeIndex: index,
      commandId: 1100 + index,
      shadowType: compatible.type,
      width: Number(original.layout?.width),
      height: Number(original.layout?.height)
    });
  }

  return {
    ir,
    compatibleIr,
    paintboxes,
    events: ir.events ?? [],
    states: new Map((ir.states ?? []).map(state => [state.name, state])),
    controls: originalControls,
    compatibleControls
  };
}
