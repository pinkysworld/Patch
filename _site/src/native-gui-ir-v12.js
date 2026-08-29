import {
  NativeGuiError,
  PATCH_NATIVE_GUI_IR_FORMAT,
  buildNativeGuiIRV11,
  validateNativeGuiIRV11,
  flattenNativeGuiMenuItemsV11
} from './native-gui-frozen-lower.js?v=9ad29318e93c7c71';

export const PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2';

/** Native GUI IR 1.2 adds source-backed TreeView hierarchy and text-list paths. */
export function buildNativeGuiIRV12(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.2 lowering.');
  }
  const compatibility = cloneCompiledWithPolicies(compiled);
  const trees = rewriteTreesForV11Compatibility(compatibility.ast);
  const ir = buildNativeGuiIRV11(compatibility);
  if (trees.length) restoreTrees(ir, trees);
  ir.version = PATCH_NATIVE_GUI_IR_V12_VERSION;
  return validateNativeGuiIRV12(ir);
}

export function validateNativeGuiIRV12(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V12_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.2 format/version is unsupported.');
  }
  const states = new Map((ir.states ?? []).map(state => [state.name, state]));
  const treeIds = new Set();
  walkControls(ir, control => {
    if (control.type !== 'tree') return;
    if (!control.id || control.binding !== null || !Array.isArray(control.nodes) || !control.nodes.length) {
      throw new NativeGuiError('Native GUI IR 1.2 TreeView needs an id, no persistent binding and at least one node.');
    }
    if (control.selectionMode !== undefined) {
      throw new NativeGuiError(`Native GUI IR 1.2 TreeView '${control.id}' cannot declare ListBox selectionMode.`);
    }
    if (treeIds.has(control.id)) throw new NativeGuiError(`Native GUI IR 1.2 TreeView id '${control.id}' is duplicated.`);
    treeIds.add(control.id);
    validateTreeNodes(control.nodes, control.id, states);
  });
  for (const event of ir.events ?? []) {
    if (!treeIds.has(event.control)) continue;
    if (event.event !== 'changed' || event.valueType !== 'text-list') {
      throw new NativeGuiError(`Native GUI IR 1.2 TreeView '${event.control}' needs changed/text-list event semantics.`);
    }
  }
  validateNativeGuiIRV11(toV11CompatibleV12(ir));
  return ir;
}

export function flattenNativeGuiControlsV12(ir) {
  validateNativeGuiIRV12(ir);
  return flattenControlsWithoutValidation(ir);
}

export function flattenNativeGuiMenuItemsV12(ir) {
  validateNativeGuiIRV12(ir);
  return flattenNativeGuiMenuItemsV11(toV11CompatibleV12(ir));
}

/** Backend-only v1.1 projection; v1.3 backends replace every Tree shadow. */
export function toV11CompatibleV12(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.1';
  const usedStates = new Set((ir.states ?? []).map(state => state.name));
  let treeIndex = 0;
  const rewrite = controls => (controls ?? []).map(control => {
    if (control.type === 'tabs') {
      return { ...control, pages: control.pages.map(page => ({ ...page, controls: rewrite(page.controls) })) };
    }
    if (control.type !== 'tree') return control;
    const shadowState = uniqueShadowState(usedStates, ++treeIndex);
    const options = flattenTreeTexts(control.nodes);
    if (options.length < 2) options.push('__patch_native_tree_shadow_option__');
    ir.states.push({ name: shadowState, type: 'list', initial: [] });
    return {
      type: 'listbox', id: control.id, text: '', binding: shadowState,
      options, selectionMode: 'multiple', layout: cloneLayoutWithPolicy(control.layout)
    };
  });
  for (const form of ir.forms ?? []) form.controls = rewrite(form.controls);
  return ir;
}

function rewriteTreesForV11Compatibility(ast) {
  const trees = [];
  const usedNames = new Set((ast ?? []).filter(node => node.kind === 'create').map(node => node.name));
  const byId = new Map();
  let sequence = 0;
  const rewrite = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'tree') {
        if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.2 TreeView needs a simple Patch name after 'as'.`);
        const originalId = node.id;
        let compatId = `__patch_native_tree_${identifier(originalId)}_${++sequence}`;
        while (usedNames.has(compatId)) compatId += '_x';
        usedNames.add(compatId);
        const sourceNodes = structuredClone(node.treeNodes ?? []);
        const options = flattenTreeLabelExprs(sourceNodes);
        if (options.length < 2) options.push(JSON.stringify('__patch_native_tree_shadow_option__'));
        trees.push({ id: originalId, compatId, nodes: sourceNodes, line: node.line });
        byId.set(originalId, compatId);
        node.control = 'listbox';
        node.id = compatId;
        node.options = options;
        delete node.treeNodes;
      }
      if (node.body) rewrite(node.body);
      if (node.thenBody) rewrite(node.thenBody);
      if (node.elseBody) rewrite(node.elseBody);
    }
  };
  rewrite(ast);
  if (!trees.length) return trees;
  ast.unshift(...trees.map(tree => ({ kind: 'create', name: tree.compatId, valueType: 'list', expr: '[]', line: tree.line })));
  for (const node of ast) if (node.kind === 'event' && byId.has(node.control)) node.control = byId.get(node.control);
  return trees;
}

function restoreTrees(ir, trees) {
  const byCompatId = new Map(trees.map(tree => [tree.compatId, tree]));
  walkControls(ir, control => {
    const tree = byCompatId.get(control.id);
    if (!tree) return;
    control.type = 'tree'; control.id = tree.id; control.text = ''; control.binding = null; control.options = [];
    control.nodes = lowerTreeNodes(tree.nodes);
    delete control.selectionMode;
  });
  ir.states = (ir.states ?? []).filter(state => !byCompatId.has(state.name));
  for (const event of ir.events ?? []) {
    const tree = byCompatId.get(event.control);
    if (tree) event.control = tree.id;
  }
}

function lowerTreeNodes(nodes) {
  return (nodes ?? []).map(node => ({ text: requireTreeTextTemplate(node.labelExpr, node.line), children: lowerTreeNodes(node.children) }));
}

function validateTreeNodes(nodes, treeId, states) {
  if (!Array.isArray(nodes) || !nodes.length) throw new NativeGuiError(`Native GUI IR 1.2 TreeView '${treeId}' contains an empty branch.`);
  for (const node of nodes) {
    if (!node || typeof node.text !== 'string' || !Array.isArray(node.children)) {
      throw new NativeGuiError(`Native GUI IR 1.2 TreeView '${treeId}' contains an invalid node.`);
    }
    const interpolation = /\{([A-Za-z_]\w*)\}/g;
    let match;
    while ((match = interpolation.exec(node.text))) {
      const state = states.get(match[1]);
      if (!state) throw new NativeGuiError(`Native GUI IR 1.2 TreeView '${treeId}' label refers to unknown state '${match[1]}'.`);
      if (state.type === 'list') throw new NativeGuiError(`Native GUI IR 1.2 TreeView '${treeId}' cannot interpolate list state '${match[1]}' into a node label.`);
    }
    if (node.children.length) validateTreeNodes(node.children, treeId, states);
  }
}

function requireTreeTextTemplate(expr, line) {
  try {
    const value = JSON.parse(String(expr ?? '').trim());
    if (typeof value !== 'string') throw new Error('not text');
    return value;
  } catch {
    throw new NativeGuiError(`line ${line ?? '?'}: native GUI 1.2 TreeView node labels must be quoted text templates.`);
  }
}

function flattenTreeLabelExprs(nodes, out = []) { for (const node of nodes ?? []) { out.push(String(node.labelExpr ?? '""')); flattenTreeLabelExprs(node.children, out); } return out; }
function flattenTreeTexts(nodes, out = []) { for (const node of nodes ?? []) { out.push(String(node.text ?? '')); flattenTreeTexts(node.children, out); } return out; }
function walkControls(ir, visit) { const walk = controls => { for (const control of controls ?? []) { visit(control); if (control.type === 'tabs') for (const page of control.pages ?? []) walk(page.controls); } }; for (const form of ir.forms ?? []) walk(form.controls); }

function flattenControlsWithoutValidation(ir) {
  const out = [];
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (const control of form.controls ?? []) {
      const nativeIndex = out.length;
      out.push({ ...control, formIndex, nativeIndex, parentTabIndex: -1, pageIndex: -1, pageTitles: control.type === 'tabs' ? control.pages.map(page => page.title) : [] });
      if (control.type !== 'tabs') continue;
      for (let pageIndex = 0; pageIndex < control.pages.length; pageIndex += 1) for (const child of control.pages[pageIndex].controls ?? []) out.push({ ...child, formIndex, nativeIndex: out.length, parentTabIndex: nativeIndex, pageIndex, pageTitles: [] });
    }
  }
  return out;
}

function cloneCompiledWithPolicies(compiled) {
  const cloned = structuredClone(compiled);
  const originalNodes = [], clonedNodes = [];
  collectLayoutNodes(compiled.ast, originalNodes); collectLayoutNodes(cloned.ast, clonedNodes);
  for (let index = 0; index < Math.min(originalNodes.length, clonedNodes.length); index += 1) {
    const policy = originalNodes[index].layout?.policy;
    if (policy && clonedNodes[index].layout) defineLayoutPolicy(clonedNodes[index].layout, structuredClone(policy));
  }
  return cloned;
}
function collectLayoutNodes(nodes, out) { for (const node of nodes ?? []) { if (node.kind === 'uiControl' || node.kind === 'tabs') out.push(node); if (node.body) collectLayoutNodes(node.body, out); if (node.thenBody) collectLayoutNodes(node.thenBody, out); if (node.elseBody) collectLayoutNodes(node.elseBody, out); } }
function cloneNativeGuiIrWithPolicies(input) { const layouts=[]; const collect=controls=>{for(const control of controls??[]){layouts.push(control.layout?.policy?structuredClone(control.layout.policy):null);if(control.type==='tabs')for(const page of control.pages??[])collect(page.controls);}}; for(const form of input.forms??[])collect(form.controls); const cloned=structuredClone(input); let cursor=0; const restore=controls=>{for(const control of controls??[]){const policy=layouts[cursor++];if(policy&&control.layout)defineLayoutPolicy(control.layout,policy);if(control.type==='tabs')for(const page of control.pages??[])restore(page.controls);}};for(const form of cloned.forms??[])restore(form.controls);return cloned; }
function cloneLayoutWithPolicy(layout) { if (!layout) return layout; const cloned=structuredClone(layout); if(layout.policy)defineLayoutPolicy(cloned,structuredClone(layout.policy)); return cloned; }
function defineLayoutPolicy(layout, policy) { Object.defineProperty(layout,'policy',{value:policy,enumerable:false,configurable:true,writable:false}); }
function uniqueShadowState(used, seed) { let name=`__patch_native_tree_shadow_${seed}`; while(used.has(name))name+='_x'; used.add(name); return name; }
function identifier(value) { return String(value).replace(/[^A-Za-z0-9_]/g,'_').replace(/^[0-9]/,'_$&'); }
