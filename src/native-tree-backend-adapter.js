import { NativeGuiError } from './native-gui-ir.js';
import {
  validateNativeGuiIRV12,
  toV11CompatibleV12,
  flattenNativeGuiControlsV12
} from './native-gui-ir-v12.js';
import { flattenNativeGuiControlsV11 } from './native-gui-ir-v11.js';

/** Adapt Native GUI IR 1.2 TreeViews to backend-v1.2 list shadows. */
export function adaptNativeTreesForV12Backend(input) {
  const ir = validateNativeGuiIRV12(input);
  const compatibleIr = toV11CompatibleV12(ir);
  const originalControls = flattenNativeGuiControlsV12(ir);
  const compatibleControls = flattenNativeGuiControlsV11(compatibleIr);
  if (originalControls.length !== compatibleControls.length) throw new NativeGuiError('Native TreeView backend adapter lost control ordering.');

  const trees = [];
  for (let index = 0; index < originalControls.length; index += 1) {
    const original = originalControls[index];
    if (original.type !== 'tree') continue;
    const compatible = compatibleControls[index];
    if (compatible.type !== 'listbox' || compatible.selectionMode !== 'multiple' || !compatible.binding) {
      throw new NativeGuiError(`Native TreeView '${original.id}' did not project to a list-backed shadow.`);
    }
    trees.push({
      ...original,
      nativeIndex: index,
      commandId: 1000 + index,
      shadowState: compatible.binding,
      flatNodes: flattenTreeNodes(original.nodes)
    });
  }
  const byId = new Map(trees.map(tree => [tree.id, tree]));
  const events = [];
  for (let index = 0; index < (ir.events ?? []).length; index += 1) {
    const event = ir.events[index];
    if (byId.has(event.control)) events.push({ ...event, eventIndex: index });
  }
  return {
    ir, compatibleIr, trees, treesById: byId, events,
    states: new Map((ir.states ?? []).map(state => [state.name, state])),
    controls: originalControls, compatibleControls
  };
}

export function treePersistentPathTarget(event, states) {
  for (const action of event?.actions ?? []) {
    if (action.kind !== 'change' || action.stateType !== 'list' || states.get(action.target)?.type !== 'list') continue;
    if ((action.ops ?? []).some(op => op.op === 'set' && op.value?.kind === 'eventValue')) return action.target;
  }
  return null;
}

function flattenTreeNodes(nodes) {
  const out = [];
  const walk = (items, parentFlatIndexes, indexPath) => {
    for (let index = 0; index < (items ?? []).length; index += 1) {
      const node = items[index];
      const flatIndex = out.length;
      const flatIndexPath = [...parentFlatIndexes, flatIndex];
      const nodeIndexPath = [...indexPath, index];
      out.push({ text: node.text, flatIndex, flatIndexPath, indexPath: nodeIndexPath, children: node.children?.length ?? 0 });
      walk(node.children, flatIndexPath, nodeIndexPath);
    }
  };
  walk(nodes, [], []);
  return out;
}
