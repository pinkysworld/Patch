import { NativeGuiError } from './native-gui-frozen-lower.js?v=9ad29318e93c7c71';
import {
  validateNativeGuiIRV13,
  toV12CompatibleV13,
  flattenNativeGuiControlsV13
} from './native-gui-ir-v13.js?v=9ad29318e93c7c71';
import { flattenNativeGuiControlsV12 } from './native-gui-ir-v12.js?v=9ad29318e93c7c71';

/** Adapt Native GUI IR 1.3 Sliders to frozen IR-1.2 Input shadows for backend 1.4. */
export function adaptNativeSlidersForV13Backend(input) {
  const ir = validateNativeGuiIRV13(input);
  const compatibleIr = toV12CompatibleV13(ir);
  const originalControls = flattenNativeGuiControlsV13(ir);
  const compatibleControls = flattenNativeGuiControlsV12(compatibleIr);
  if (originalControls.length !== compatibleControls.length) throw new NativeGuiError('Native Slider backend adapter lost control ordering.');

  const sliders = [];
  for (let index = 0; index < originalControls.length; index += 1) {
    const original = originalControls[index];
    if (original.type !== 'slider') continue;
    const compatible = compatibleControls[index];
    if (compatible.type !== 'input' || !compatible.binding) {
      throw new NativeGuiError(`Native Slider '${original.id}' did not project to an Input shadow.`);
    }
    sliders.push({
      ...original,
      nativeIndex: index,
      commandId: 1000 + index,
      shadowState: compatible.binding,
      initial: initialSliderValue(original, ir.states ?? [])
    });
  }

  const sliderIds = new Set(sliders.map(slider => slider.id));
  const usedNumbers = collectUsedNumbers(ir);
  let sentinelCursor = 8000000000000000;
  const eventPatches = [];
  for (let eventIndex = 0; eventIndex < (ir.events ?? []).length; eventIndex += 1) {
    const originalEvent = ir.events[eventIndex];
    if (!sliderIds.has(originalEvent.control)) continue;
    const compatibleEvent = compatibleIr.events?.[eventIndex];
    if (!compatibleEvent || compatibleEvent.control !== originalEvent.control) {
      throw new NativeGuiError(`Native Slider '${originalEvent.control}' event ordering drifted in the compatibility projection.`);
    }
    compatibleEvent.valueType = 'text';
    const sentinels = [];
    for (let actionIndex = 0; actionIndex < (originalEvent.actions?.length ?? 0); actionIndex += 1) {
      const originalAction = originalEvent.actions[actionIndex];
      const compatibleAction = compatibleEvent.actions?.[actionIndex];
      if (originalAction?.kind !== 'change' || compatibleAction?.kind !== 'change') continue;
      for (let opIndex = 0; opIndex < (originalAction.ops?.length ?? 0); opIndex += 1) {
        const originalOp = originalAction.ops[opIndex];
        const compatibleOp = compatibleAction.ops?.[opIndex];
        if (originalOp?.value?.kind !== 'eventValue' || !compatibleOp) continue;
        while (usedNumbers.has(sentinelCursor)) sentinelCursor -= 1;
        const sentinel = sentinelCursor--;
        usedNumbers.add(sentinel);
        compatibleOp.value = { kind: 'literal', value: sentinel };
        sentinels.push(sentinel);
      }
    }
    eventPatches.push({ eventIndex, control: originalEvent.control, sentinels });
  }

  return {
    ir,
    compatibleIr,
    sliders,
    events: ir.events ?? [],
    eventPatches,
    states: new Map((ir.states ?? []).map(state => [state.name, state])),
    controls: originalControls,
    compatibleControls
  };
}

export function sliderPersistentNumberTarget(event, states) {
  for (const action of event?.actions ?? []) {
    if (action.kind !== 'change' || action.stateType !== 'number' || states.get(action.target)?.type !== 'number') continue;
    if ((action.ops ?? []).some(op => op.op === 'set' && op.value?.kind === 'eventValue')) return action.target;
  }
  return null;
}

function initialSliderValue(control, states) {
  if (control.binding) {
    const state = states.find(item => item.name === control.binding);
    if (state?.type === 'number' && Number.isFinite(Number(state.initial))) return Number(state.initial);
  }
  return Number(control.min);
}

function collectUsedNumbers(ir) {
  const out = new Set();
  for (const state of ir.states ?? []) if (state.type === 'number' && Number.isFinite(Number(state.initial))) out.add(Number(state.initial));
  for (const event of ir.events ?? []) {
    for (const action of event.actions ?? []) {
      for (const op of action.ops ?? []) {
        if (op.value?.kind === 'literal' && Number.isFinite(Number(op.value.value))) out.add(Number(op.value.value));
      }
    }
  }
  return out;
}
