import { NativeGuiError } from './native-gui-frozen-lower.js';
import {
  validateNativeGuiIRV15,
  toV14CompatibleV15,
  flattenNativeGuiControlsV15,
  PATCH_NATIVE_SHAPE_CONTROLS
} from './native-gui-ir-v15.js';
import { flattenNativeGuiControlsV14 } from './native-gui-ir-v14.js';

const SHAPE = new Set(PATCH_NATIVE_SHAPE_CONTROLS);

/** Adapt Native GUI IR 1.5 Shape controls to IR-1.4 Text shadows for backend 1.6. */
export function adaptNativeShapeForV15Backend(input) {
  const ir = validateNativeGuiIRV15(input);
  const compatibleIr = toV14CompatibleV15(ir);
  const originalControls = flattenNativeGuiControlsV15(ir);
  const compatibleControls = flattenNativeGuiControlsV14(compatibleIr);
  if (originalControls.length !== compatibleControls.length) {
    throw new NativeGuiError('Native Shape backend adapter lost control ordering.');
  }

  const shapes = [];
  for (let index = 0; index < originalControls.length; index += 1) {
    const original = originalControls[index];
    if (!SHAPE.has(original.type)) continue;
    const compatible = compatibleControls[index];
    if (original.id !== compatible.id || compatible.type !== 'text') {
      throw new NativeGuiError(`Native Shape '${original.id}' did not project to a Text compatibility shadow.`);
    }
    shapes.push({
      ...original,
      nativeIndex: index,
      commandId: 1000 + index,
      shadowType: compatible.type
    });
  }

  return {
    ir,
    compatibleIr,
    shapes,
    events: ir.events ?? [],
    states: new Map((ir.states ?? []).map(state => [state.name, state])),
    controls: originalControls,
    compatibleControls
  };
}
