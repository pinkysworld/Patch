import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js';
import { normalizePatchShape, PATCH_SHAPE_KINDS } from './shape-control.js';
import {
  buildNativeGuiIRV14,
  validateNativeGuiIRV14,
  flattenNativeGuiMenuItemsV14,
  PATCH_NATIVE_CHROME_CONTROLS
} from './native-gui-ir-v14.js';

export const PATCH_NATIVE_GUI_IR_V15_VERSION = '1.5';
export const PATCH_NATIVE_SHAPE_CONTROLS = Object.freeze(['shape']);
export const PATCH_NATIVE_SHAPE_KINDS = PATCH_SHAPE_KINDS;
const SHAPE = new Set(PATCH_NATIVE_SHAPE_CONTROLS);

/** Native GUI IR 1.5 adds source-backed Shape rectangle/rounded/ellipse/line. */
export function buildNativeGuiIRV15(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.5 lowering.');
  }
  const compatibility = cloneCompiledWithPolicies(compiled);
  const shapes = rewriteShapesForV14Compatibility(compatibility.ast, compiled.ast);
  const ir = buildNativeGuiIRV14(compatibility);
  if (shapes.length) restoreShapes(ir, shapes);
  ir.version = PATCH_NATIVE_GUI_IR_V15_VERSION;
  return validateNativeGuiIRV15(ir);
}

export function validateNativeGuiIRV15(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V15_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.5 format/version is unsupported.');
  }
  const shapeIds = new Set();
  walkControls(ir, control => {
    if (!SHAPE.has(control.type)) return;
    if (!control.id || shapeIds.has(control.id)) {
      throw new NativeGuiError(`Native GUI IR 1.5 Shape id '${control.id ?? ''}' is missing or duplicated.`);
    }
    shapeIds.add(control.id);
    if (control.selectionMode !== undefined || control.nodes !== undefined || control.pages !== undefined || control.controls !== undefined) {
      throw new NativeGuiError(`Native GUI IR 1.5 Shape '${control.id}' contains incompatible control metadata.`);
    }
    if (control.binding !== null) {
      throw new NativeGuiError(`Native GUI IR 1.5 Shape '${control.id}' does not bind persistent state.`);
    }
    try {
      const shape = normalizePatchShape({
        kind: control.shapeKind,
        fill: control.fill,
        stroke: control.stroke,
        strokeWidth: control.strokeWidth,
        cornerRadius: control.cornerRadius,
        opacity: control.opacity
      });
      control.shapeKind = shape.kind;
      control.fill = shape.fill;
      control.stroke = shape.stroke;
      control.strokeWidth = shape.strokeWidth;
      control.cornerRadius = shape.cornerRadius;
      control.opacity = shape.opacity;
    } catch (error) {
      throw new NativeGuiError(`Native GUI IR 1.5 Shape '${control.id}' is invalid: ${error?.message ?? error}`);
    }
  });

  for (const event of ir.events ?? []) {
    if (!shapeIds.has(event.control)) continue;
    throw new NativeGuiError(`Native GUI IR 1.5 Shape '${event.control}' does not expose Patch events.`);
  }

  validateNativeGuiIRV14(toV14CompatibleV15(ir));
  return ir;
}

export function flattenNativeGuiControlsV15(ir) {
  validateNativeGuiIRV15(ir);
  return flattenControlsWithoutValidation(ir);
}

export function flattenNativeGuiMenuItemsV15(ir) {
  validateNativeGuiIRV15(ir);
  return flattenNativeGuiMenuItemsV14(toV14CompatibleV15(ir));
}

export function hasNativeShapeStage1(input) {
  let found = false;
  walkControls(input, control => {
    if (SHAPE.has(control.type)) found = true;
  });
  return found;
}

export function hasNativeChromeOrShape(input) {
  const chrome = new Set(PATCH_NATIVE_CHROME_CONTROLS);
  let found = false;
  walkControls(input, control => {
    if (chrome.has(control.type) || SHAPE.has(control.type)) found = true;
  });
  return found;
}

/**
 * Private compatibility projection used only below the Native GUI 1.5 boundary.
 * Shape becomes a Text shadow so frozen IR 1.4 remains byte/semantic compatible.
 * Backend 1.6 restores native GDI/AppKit/GTK drawing on top of that shadow.
 */
export function toV14CompatibleV15(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.4';
  const rewrite = controls => {
    const out = [];
    for (const control of controls ?? []) {
      if (control.type === 'tabs') {
        out.push({ ...control, pages: control.pages.map(page => ({ ...page, controls: rewrite(page.controls) })) });
        continue;
      }
      if (control.type === 'panel') {
        out.push({ ...control, controls: rewrite(control.controls) });
        continue;
      }
      if (control.type === 'shape') {
        out.push({
          type: 'text', id: control.id, text: '', binding: null, options: [],
          layout: cloneLayoutWithPolicy(control.layout)
        });
        continue;
      }
      out.push(control);
    }
    return out;
  };
  for (const form of ir.forms ?? []) form.controls = rewrite(form.controls);
  return ir;
}

function rewriteShapesForV14Compatibility(ast, originalAst) {
  const shapes = [];
  const usedNames = collectUsedNames(originalAst);
  const byId = new Map();
  let sequence = 0;

  const allocCompat = id => {
    let compatId = `__patch_native_shape_${identifier(id)}_${++sequence}`;
    while (usedNames.has(compatId)) compatId += '_x';
    usedNames.add(compatId);
    return compatId;
  };

  const rewriteNodes = nodes => {
    const out = [];
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'shape') {
        if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.5 Shape needs a simple Patch name after 'as'.`);
        let shape;
        try {
          shape = normalizePatchShape({
            kind: node.shapeKind,
            fill: node.fill,
            stroke: node.stroke,
            strokeWidth: node.strokeWidth,
            cornerRadius: node.cornerRadius,
            opacity: node.opacity
          });
        } catch (error) {
          throw new NativeGuiError(`line ${node.line ?? '?'}: ${error?.message ?? error}`);
        }
        const metadata = {
          kind: 'shape',
          id: node.id,
          compatId: allocCompat(node.id),
          shapeKind: shape.kind,
          fill: shape.fill,
          stroke: shape.stroke,
          strokeWidth: shape.strokeWidth,
          cornerRadius: shape.cornerRadius,
          opacity: shape.opacity,
          line: node.line
        };
        shapes.push(metadata);
        byId.set(metadata.id, metadata);
        node.control = 'text';
        node.id = metadata.compatId;
        node.textExpr = null;
        delete node.shapeKind;
        delete node.fill;
        delete node.stroke;
        delete node.strokeWidth;
        delete node.cornerRadius;
        delete node.opacity;
        out.push(node);
        continue;
      }
      if (node.body && node.kind !== 'menu') node.body = rewriteNodes(node.body);
      if (node.thenBody) node.thenBody = rewriteNodes(node.thenBody);
      if (node.elseBody) node.elseBody = rewriteNodes(node.elseBody);
      out.push(node);
    }
    return out;
  };

  const rewritten = rewriteNodes(ast);
  ast.length = 0;
  ast.push(...rewritten);
  return shapes;
}

function restoreShapes(ir, shapes) {
  const byCompatId = new Map(shapes.map(item => [item.compatId, item]));
  const restoreList = controls => {
    const out = [];
    for (const control of controls ?? []) {
      const item = byCompatId.get(control.id);
      if (item?.kind === 'shape') {
        control.type = 'shape';
        control.id = item.id;
        control.text = '';
        control.binding = null;
        control.options = [];
        control.shapeKind = item.shapeKind;
        control.fill = item.fill;
        control.stroke = item.stroke;
        control.strokeWidth = item.strokeWidth;
        control.cornerRadius = item.cornerRadius;
        control.opacity = item.opacity;
        out.push(control);
        continue;
      }
      if (control.type === 'tabs') {
        for (const page of control.pages ?? []) page.controls = restoreList(page.controls);
      }
      if (control.type === 'panel') control.controls = restoreList(control.controls);
      out.push(control);
    }
    return out;
  };

  for (const form of ir.forms ?? []) form.controls = restoreList(form.controls);
}

function collectUsedNames(ast) {
  const out = new Set();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.name) out.add(node.name);
      if (node.id) out.add(node.id);
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  return out;
}

function walkControls(ir, visit) {
  const walk = (controls, insidePanel = false) => {
    for (const control of controls ?? []) {
      visit(control, insidePanel);
      if (control.type === 'tabs') for (const page of control.pages ?? []) walk(page.controls, insidePanel);
      if (control.type === 'panel') walk(control.controls, true);
    }
  };
  for (const form of ir.forms ?? []) walk(form.controls, false);
}

function flattenControlsWithoutValidation(ir) {
  const out = [];
  const emit = (control, formIndex, parentTabIndex, pageIndex, pageTitles, parentPanelIndex) => {
    const nativeIndex = out.length;
    out.push({
      ...control,
      formIndex,
      nativeIndex,
      parentTabIndex,
      pageIndex,
      pageTitles,
      parentPanelIndex
    });
    if (control.type === 'tabs') {
      for (let pageIndexCursor = 0; pageIndexCursor < (control.pages ?? []).length; pageIndexCursor += 1) {
        for (const child of control.pages[pageIndexCursor].controls ?? []) {
          emit(child, formIndex, nativeIndex, pageIndexCursor, [], parentPanelIndex);
        }
      }
    }
    if (control.type === 'panel') {
      for (const child of control.controls ?? []) {
        emit(child, formIndex, parentTabIndex, pageIndex, [], nativeIndex);
      }
    }
  };
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (const control of form.controls ?? []) {
      emit(control, formIndex, -1, -1, control.type === 'tabs' ? control.pages.map(page => page.title) : [], -1);
    }
  }
  return out;
}

function cloneCompiledWithPolicies(compiled) {
  const cloned = structuredClone(compiled);
  const originalNodes = [], clonedNodes = [];
  collectLayoutNodes(compiled.ast, originalNodes);
  collectLayoutNodes(cloned.ast, clonedNodes);
  for (let index = 0; index < Math.min(originalNodes.length, clonedNodes.length); index += 1) {
    const policy = originalNodes[index].layout?.policy;
    if (policy && clonedNodes[index].layout) defineLayoutPolicy(clonedNodes[index].layout, structuredClone(policy));
  }
  return cloned;
}

function collectLayoutNodes(nodes, out) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl' || node.kind === 'tabs') out.push(node);
    if (node.body) collectLayoutNodes(node.body, out);
    if (node.thenBody) collectLayoutNodes(node.thenBody, out);
    if (node.elseBody) collectLayoutNodes(node.elseBody, out);
  }
}

function cloneNativeGuiIrWithPolicies(input) {
  const layouts = [];
  const collect = controls => {
    for (const control of controls ?? []) {
      layouts.push(control.layout?.policy ? structuredClone(control.layout.policy) : null);
      if (control.type === 'tabs') for (const page of control.pages ?? []) collect(page.controls);
      if (control.type === 'panel') collect(control.controls);
    }
  };
  for (const form of input.forms ?? []) collect(form.controls);
  const cloned = structuredClone(input);
  let cursor = 0;
  const restore = controls => {
    for (const control of controls ?? []) {
      const policy = layouts[cursor++];
      if (policy && control.layout) defineLayoutPolicy(control.layout, policy);
      if (control.type === 'tabs') for (const page of control.pages ?? []) restore(page.controls);
      if (control.type === 'panel') restore(control.controls);
    }
  };
  for (const form of cloned.forms ?? []) restore(form.controls);
  return cloned;
}

function cloneLayoutWithPolicy(layout) {
  if (!layout) return layout;
  const cloned = structuredClone(layout);
  if (layout.policy) defineLayoutPolicy(cloned, structuredClone(layout.policy));
  return cloned;
}

function defineLayoutPolicy(layout, policy) {
  Object.defineProperty(layout, 'policy', { value: policy, enumerable: false, configurable: true, writable: false });
}

function identifier(value) {
  return String(value).replace(/[^A-Za-z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
}
