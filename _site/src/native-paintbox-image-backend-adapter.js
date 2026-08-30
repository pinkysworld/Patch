import { NativeGuiError } from './native-gui-frozen-lower.js?v=868f0784ca7f3972';
import {
  validateNativeGuiIRV17,
  toV16CompatibleV17,
  flattenNativeGuiControlsV17
} from './native-gui-ir-v17.js?v=868f0784ca7f3972';
import { flattenNativeGuiControlsV16, PATCH_NATIVE_PAINTBOX_CONTROLS } from './native-gui-ir-v16.js?v=868f0784ca7f3972';
import { paintProgramHasImage } from './paintbox-control.js?v=868f0784ca7f3972';

const PAINTBOX = new Set(PATCH_NATIVE_PAINTBOX_CONTROLS);

/** Adapt Native GUI IR 1.7 PaintBox image programs to IR-1.6 underlays for backend 1.8. */
export function adaptNativePaintBoxImageForV17Backend(input) {
  const ir = validateNativeGuiIRV17(input);
  const compatibleIr = toV16CompatibleV17(ir);
  const originalControls = flattenNativeGuiControlsV17(ir);
  const compatibleControls = flattenNativeGuiControlsV16(compatibleIr);
  if (originalControls.length !== compatibleControls.length) {
    throw new NativeGuiError('Native PaintBox image backend adapter lost control ordering.');
  }

  const paintboxes = [];
  const imagePaintboxes = [];
  for (let index = 0; index < originalControls.length; index += 1) {
    const original = originalControls[index];
    if (!PAINTBOX.has(original.type)) continue;
    const compatible = compatibleControls[index];
    if (original.id !== compatible.id) {
      throw new NativeGuiError(`Native PaintBox '${original.id}' lost its IR 1.6 compatibility identity.`);
    }
    const item = {
      ...original,
      nativeIndex: index,
      commandId: 1200 + index,
      width: Number(original.layout?.width),
      height: Number(original.layout?.height)
    };
    paintboxes.push(item);
    if (paintProgramHasImage(original.paintProgram)) imagePaintboxes.push(item);
  }

  return {
    ir,
    compatibleIr,
    paintboxes,
    imagePaintboxes,
    events: ir.events ?? [],
    states: new Map((ir.states ?? []).map(state => [state.name, state])),
    controls: originalControls,
    compatibleControls
  };
}
