import { NativeGuiError } from './native-gui-ir.js';
import {
  validateNativeGuiIRV11,
  toV10Compatible,
  flattenNativeGuiControlsV11
} from './native-gui-ir-v11.js';
import { flattenNativeGuiControlsV10 } from './native-gui-ir-v10.js';

/**
 * Adapt Native GUI IR 1.1 to the 1.0 shape consumed by backend 1.1 while
 * retaining list-state and multi-select metadata by stable native index.
 */
export function adaptNativeListsForV11Backend(input) {
  const ir = validateNativeGuiIRV11(input);
  const compatibleIr = toV10Compatible(ir);
  const originalControls = flattenNativeGuiControlsV11(ir);
  const compatibleControls = flattenNativeGuiControlsV10(compatibleIr);
  if (originalControls.length !== compatibleControls.length) {
    throw new NativeGuiError('Native list backend adapter lost control ordering.');
  }

  const listStates = new Map(
    (ir.states ?? []).filter(state => state.type === 'list').map(state => [state.name, state])
  );
  const multiControls = [];
  for (let index = 0; index < originalControls.length; index += 1) {
    const control = originalControls[index];
    if (control.type !== 'listbox' || control.selectionMode !== 'multiple') continue;
    const state = listStates.get(control.binding);
    if (!state) throw new NativeGuiError(`Native multi-select ListBox '${control.id}' is missing list state.`);
    multiControls.push({ ...control, state, nativeIndex: index, commandId: 1000 + index });
  }

  const events = [];
  for (let index = 0; index < (ir.events ?? []).length; index += 1) {
    const event = ir.events[index];
    if (event.valueType !== 'text-list') continue;
    events.push({ ...event, eventIndex: index });
  }

  return {
    ir,
    compatibleIr,
    listStates,
    multiControls,
    events
  };
}
