import { buildNativeGuiIR, flattenNativeGuiControls } from './native-gui-ir.js';
import { buildNativeGuiIRV08, flattenNativeGuiControlsV08 } from './native-gui-ir-v08.js';
import { buildNativeGuiIRV09, flattenNativeGuiControlsV09 } from './native-gui-ir-v09.js';

/** Select the smallest native GUI contract that preserves source semantics. */
export function buildNativeGuiPlan(compiled, options = {}) {
  const features = inspectNativeGuiFeatures(compiled?.ast);
  const forceTable = Boolean(options.tableV09);
  const forceMenu = Boolean(options.menuV10);

  if (forceMenu || features.menuDecorations) {
    const gui = buildNativeGuiIRV09(compiled);
    return {
      tier: 'menu-v10',
      gui,
      controlCount: flattenNativeGuiControlsV09(gui).length,
      features
    };
  }
  if (forceTable || features.table) {
    const gui = buildNativeGuiIRV08(compiled);
    return {
      tier: 'table-v09',
      gui,
      controlCount: flattenNativeGuiControlsV08(gui).length,
      features
    };
  }
  const gui = buildNativeGuiIR(compiled);
  return {
    tier: 'base-v08',
    gui,
    controlCount: flattenNativeGuiControls(gui).length,
    features
  };
}

export function inspectNativeGuiFeatures(ast) {
  const features = { table: false, menuSeparators: false, menuShortcuts: false, menuDecorations: false };
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'table') features.table = true;
      if (node.kind === 'menuSeparator') features.menuSeparators = true;
      if (node.kind === 'menuItem' && node.shortcutExpr) features.menuShortcuts = true;
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  features.menuDecorations = features.menuSeparators || features.menuShortcuts;
  return features;
}
