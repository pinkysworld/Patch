import { buildNativeGuiIR, flattenNativeGuiControls } from './native-gui-ir.js';
import { buildNativeGuiIRV08, flattenNativeGuiControlsV08 } from './native-gui-ir-v08.js';
import { buildNativeGuiIRV09, flattenNativeGuiControlsV09 } from './native-gui-ir-v09.js';
import { buildNativeGuiIRV10, flattenNativeGuiControlsV10 } from './native-gui-ir-v10.js';
import { buildNativeGuiIRV11, flattenNativeGuiControlsV11 } from './native-gui-ir-v11.js';
import { buildNativeGuiIRV12, flattenNativeGuiControlsV12 } from './native-gui-ir-v12.js';
import { buildNativeGuiIRV13, flattenNativeGuiControlsV13 } from './native-gui-ir-v13.js';

/** Select the smallest native GUI contract that preserves source semantics. */
export function buildNativeGuiPlan(compiled, options = {}) {
  const features = inspectNativeGuiFeatures(compiled?.ast);
  const forceTable = Boolean(options.tableV09);
  const forceMenu = Boolean(options.menuV10);
  const forceMenuState = Boolean(options.menuV11);
  const forceList = Boolean(options.listV12);
  const forceTree = Boolean(options.treeV13);
  const forceSlider = Boolean(options.sliderV14);

  if (forceSlider || features.slider) {
    const gui = buildNativeGuiIRV13(compiled);
    return { tier: 'slider-v14', gui, controlCount: flattenNativeGuiControlsV13(gui).length, features };
  }
  if (forceTree || features.tree) {
    const gui = buildNativeGuiIRV12(compiled);
    return { tier: 'tree-v13', gui, controlCount: flattenNativeGuiControlsV12(gui).length, features };
  }
  if (forceList || features.listState) {
    const gui = buildNativeGuiIRV11(compiled);
    return { tier: 'list-v12', gui, controlCount: flattenNativeGuiControlsV11(gui).length, features };
  }
  if (forceMenuState || features.menuStateBindings) {
    const gui = buildNativeGuiIRV10(compiled);
    return { tier: 'menu-v11', gui, controlCount: flattenNativeGuiControlsV10(gui).length, features };
  }
  if (forceMenu || features.menuDecorations) {
    const gui = buildNativeGuiIRV09(compiled);
    return { tier: 'menu-v10', gui, controlCount: flattenNativeGuiControlsV09(gui).length, features };
  }
  if (forceTable || features.table) {
    const gui = buildNativeGuiIRV08(compiled);
    return { tier: 'table-v09', gui, controlCount: flattenNativeGuiControlsV08(gui).length, features };
  }
  const gui = buildNativeGuiIR(compiled);
  return { tier: 'base-v08', gui, controlCount: flattenNativeGuiControls(gui).length, features };
}

export function inspectNativeGuiFeatures(ast) {
  const features = {
    table: false,
    tree: false,
    slider: false,
    listState: false,
    listBackedListBox: false,
    menuSeparators: false,
    menuShortcuts: false,
    menuEnabledState: false,
    menuCheckedState: false,
    menuStateBindings: false,
    menuDecorations: false
  };
  const listNames = new Set((ast ?? []).filter(node => node.kind === 'create' && node.valueType === 'list').map(node => node.name));
  features.listState = listNames.size > 0;

  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'table') features.table = true;
      if (node.kind === 'uiControl' && node.control === 'tree') features.tree = true;
      if (node.kind === 'uiControl' && node.control === 'slider') features.slider = true;
      if (node.kind === 'uiControl' && node.control === 'listbox' && listNames.has(node.id)) features.listBackedListBox = true;
      if (node.kind === 'menuSeparator') features.menuSeparators = true;
      if (node.kind === 'menuItem' && node.shortcutExpr) features.menuShortcuts = true;
      if (node.kind === 'menuItem' && node.enabledState) features.menuEnabledState = true;
      if (node.kind === 'menuItem' && node.checkedState) features.menuCheckedState = true;
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  features.menuStateBindings = features.menuEnabledState || features.menuCheckedState;
  features.menuDecorations = features.menuSeparators || features.menuShortcuts || features.menuStateBindings;
  return features;
}
