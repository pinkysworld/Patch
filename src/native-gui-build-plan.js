import { buildFrozenNativeGuiIR, flattenFrozenNativeGuiControls } from './native-frozen-contract.js';
import { buildCurrentNativeGuiIR, flattenCurrentNativeGuiControls } from './native-current-contract.js';

const RETIRED_PLAN_OPTIONS = ['tableV09', 'menuV10', 'menuV11', 'listV12'];

/** Select the live native GUI contract that preserves source semantics. */
export function buildNativeGuiPlan(compiled, options = {}) {
  for (const key of RETIRED_PLAN_OPTIONS) {
    if (options[key]) {
      throw new Error(`Retired native contract option '${key}' is not a product build plan. Use current (Slider) or frozen (TreeView).`);
    }
  }
  const features = inspectNativeGuiFeatures(compiled?.ast);
  const forceSlider = Boolean(options.sliderV14);
  const forceChrome = Boolean(options.chromeV15);
  const forceShape = Boolean(options.shapeV16);
  const forcePaintBox = Boolean(options.paintboxV17);
  const forcePaintBoxImage = Boolean(options.paintboxImageV18);
  const forceImageList = Boolean(options.imagelistV19);

  if (forceImageList || forcePaintBoxImage || forcePaintBox || forceShape || forceChrome || forceSlider || features.slider || features.chrome || features.shape || features.paintbox || features.imageList || features.buttonImage) {
    const gui = buildCurrentNativeGuiIR(compiled);
    return {
      tier: features.imageList || features.buttonImage || forceImageList
        ? 'imagelist-v19'
        : features.paintboxImage || forcePaintBoxImage
          ? 'paintbox-image-v18'
          : features.paintbox || forcePaintBox
            ? 'paintbox-v17'
            : features.shape || forceShape
              ? 'shape-v16'
              : features.chrome || forceChrome ? 'chrome-v15' : 'slider-v14',
      gui,
      controlCount: flattenCurrentNativeGuiControls(gui).length,
      features
    };
  }
  const gui = buildFrozenNativeGuiIR(compiled);
  return { tier: 'tree-v13', gui, controlCount: flattenFrozenNativeGuiControls(gui).length, features };
}

export function inspectNativeGuiFeatures(ast) {
  const features = {
    table: false,
    tree: false,
    slider: false,
    chrome: false,
    shape: false,
    paintbox: false,
    paintboxImage: false,
    imageList: false,
    buttonImage: false,
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
      if (node.kind === 'uiControl' && ['panel', 'timer', 'picture', 'statusbar'].includes(node.control)) features.chrome = true;
      if (node.kind === 'uiControl' && node.control === 'shape') features.shape = true;
      if (node.kind === 'uiControl' && node.control === 'paintbox') features.paintbox = true;
      if (node.kind === 'drawPaint' && node.command?.operation === 'image') features.paintboxImage = true;
      if (node.kind === 'uiControl' && node.control === 'imagelist') features.imageList = true;
      if (node.kind === 'uiControl' && node.control === 'button' && node.imageListId && node.imageItem) features.buttonImage = true;
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
