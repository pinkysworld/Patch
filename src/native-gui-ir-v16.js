import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js';
import { normalizePatchPaintCommand } from './paintbox-control.js';
import {
  buildNativeGuiIRV15,
  validateNativeGuiIRV15,
  flattenNativeGuiControlsV15,
  flattenNativeGuiMenuItemsV15,
  PATCH_NATIVE_SHAPE_CONTROLS
} from './native-gui-ir-v15.js';

export const PATCH_NATIVE_GUI_IR_V16_VERSION = '1.6';
export const PATCH_NATIVE_PAINTBOX_CONTROLS = Object.freeze(['paintbox']);
const PAINTBOX = new Set(PATCH_NATIVE_PAINTBOX_CONTROLS);

/**
 * Native GUI IR 1.6 transports PaintBox as a pure source-backed paint program.
 * The frozen/current IR 1.5 compatibility prefix sees only a Text shadow and no
 * synthetic paint event. Runtime 1.7 restores the drawing surface from metadata.
 */
export function buildNativeGuiIRV16(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.6 lowering.');
  }
  const compatibility = cloneCompiledWithPolicies(compiled);
  const paintboxes = rewritePaintBoxesForV15Compatibility(compatibility.ast, compiled.ast);
  const ir = buildNativeGuiIRV15(compatibility);
  if (paintboxes.length) restorePaintBoxes(ir, paintboxes);
  ir.version = PATCH_NATIVE_GUI_IR_V16_VERSION;
  return validateNativeGuiIRV16(ir);
}

export function validateNativeGuiIRV16(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V16_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.6 format/version is unsupported.');
  }
  const paintIds = new Set();
  walkControls(ir, control => {
    if (!PAINTBOX.has(control.type)) return;
    if (!control.id || paintIds.has(control.id)) {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox id '${control.id ?? ''}' is missing or duplicated.`);
    }
    paintIds.add(control.id);
    if (control.binding !== null || control.selectionMode !== undefined || control.nodes !== undefined || control.pages !== undefined || control.controls !== undefined) {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${control.id}' contains incompatible control metadata.`);
    }
    validatePaintProgram(control.paintProgram ?? [], control.id);
  });

  for (const event of ir.events ?? []) {
    if (paintIds.has(event.control) && event.event === 'paint') {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${event.control}' must carry OnPaint as pure paintProgram metadata, not a runtime input event.`);
    }
  }

  validateNativeGuiIRV15(toV15CompatibleV16(ir));
  return ir;
}

export function flattenNativeGuiControlsV16(ir) {
  validateNativeGuiIRV16(ir);
  return flattenControlsWithoutValidation(ir);
}

export function flattenNativeGuiMenuItemsV16(ir) {
  validateNativeGuiIRV16(ir);
  return flattenNativeGuiMenuItemsV15(toV15CompatibleV16(ir));
}

export function hasNativePaintBoxStage1(input) {
  let found = false;
  walkControls(input, control => { if (PAINTBOX.has(control.type)) found = true; });
  return found;
}

/** Private compatibility projection below the Native GUI 1.6 boundary. */
export function toV15CompatibleV16(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.5';
  const rewrite = controls => (controls ?? []).map(control => {
    if (control.type === 'tabs') return { ...control, pages: control.pages.map(page => ({ ...page, controls: rewrite(page.controls) })) };
    if (control.type === 'panel') return { ...control, controls: rewrite(control.controls) };
    if (control.type === 'paintbox') {
      return {
        type: 'text', id: control.id, text: '', binding: null, options: [],
        layout: cloneLayoutWithPolicy(control.layout)
      };
    }
    return control;
  });
  for (const form of ir.forms ?? []) form.controls = rewrite(form.controls);
  return ir;
}

function rewritePaintBoxesForV15Compatibility(ast, originalAst) {
  const usedNames = collectUsedNames(originalAst);
  const handlers = collectPaintHandlers(originalAst);
  const paintboxes = [];
  let sequence = 0;

  const allocCompat = id => {
    let compatId = `__patch_native_paintbox_${identifier(id)}_${++sequence}`;
    while (usedNames.has(compatId)) compatId += '_x';
    usedNames.add(compatId);
    return compatId;
  };

  const rewriteNodes = nodes => {
    const out = [];
    for (const node of nodes ?? []) {
      if (node.kind === 'event' && node.event === 'paint') continue;
      if (node.kind === 'uiControl' && node.control === 'paintbox') {
        if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.6 PaintBox needs a simple Patch name after 'as'.`);
        const handler = handlers.get(node.id);
        const metadata = {
          kind: 'paintbox', id: node.id, compatId: allocCompat(node.id),
          paintProgram: lowerPaintProgram(handler?.body ?? []), line: node.line
        };
        paintboxes.push(metadata);
        node.control = 'text';
        node.id = metadata.compatId;
        node.textExpr = null;
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
  return paintboxes;
}

function restorePaintBoxes(ir, paintboxes) {
  const byCompatId = new Map(paintboxes.map(item => [item.compatId, item]));
  const restore = controls => (controls ?? []).map(control => {
    const item = byCompatId.get(control.id);
    if (item) {
      control.type = 'paintbox';
      control.id = item.id;
      control.text = '';
      control.binding = null;
      control.options = [];
      control.paintProgram = structuredClone(item.paintProgram);
      return control;
    }
    if (control.type === 'tabs') for (const page of control.pages ?? []) page.controls = restore(page.controls);
    if (control.type === 'panel') control.controls = restore(control.controls);
    return control;
  });
  for (const form of ir.forms ?? []) form.controls = restore(form.controls);
}

function collectPaintHandlers(ast) {
  const handlers = new Map();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'event' && node.event === 'paint') {
        if (handlers.has(node.control)) throw new NativeGuiError(`PaintBox '${node.control}' has more than one paint handler.`);
        handlers.set(node.control, node);
      }
      if (node.body && node.kind !== 'event') walk(node.body);
    }
  };
  walk(ast);
  return handlers;
}

function lowerPaintProgram(nodes) {
  return (nodes ?? []).map(node => {
    if (node.kind === 'drawPaint') return { kind: 'draw', command: { ...normalizePatchPaintCommand(node.command) }, line: node.line ?? null };
    if (node.kind === 'if') return {
      kind: 'if', expr: String(node.expr ?? '').trim(), then: lowerPaintProgram(node.thenBody), else: lowerPaintProgram(node.elseBody), line: node.line ?? null
    };
    if (node.kind === 'repeat') return {
      kind: 'repeat', expr: String(node.expr ?? '').trim(), body: lowerPaintProgram(node.body), line: node.line ?? null
    };
    throw new NativeGuiError(`line ${node.line ?? '?'}: PaintBox native paint program supports only draw, if and repeat.`);
  });
}

function validatePaintProgram(nodes, id, depth = 0) {
  if (!Array.isArray(nodes) || depth > 32) throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' has an invalid or overly deep paint program.`);
  if (nodes.length > 10000) throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' has too many paint statements.`);
  for (const node of nodes) {
    if (!node || typeof node !== 'object') throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' has malformed paint metadata.`);
    if (node.kind === 'draw') {
      try { node.command = { ...normalizePatchPaintCommand(node.command) }; }
      catch (error) { throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' draw command is invalid: ${error?.message ?? error}`); }
      continue;
    }
    if (node.kind === 'if') {
      if (!String(node.expr ?? '').trim()) throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' has an empty if expression.`);
      validatePaintProgram(node.then, id, depth + 1);
      validatePaintProgram(node.else, id, depth + 1);
      continue;
    }
    if (node.kind === 'repeat') {
      if (!String(node.expr ?? '').trim()) throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' has an empty repeat expression.`);
      validatePaintProgram(node.body, id, depth + 1);
      continue;
    }
    throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' has unsupported paint node '${node.kind ?? '?'}'.`);
  }
}

function collectUsedNames(ast) {
  const out = new Set();
  const walk = nodes => { for (const node of nodes ?? []) { if (node.name) out.add(node.name); if (node.id) out.add(node.id); if (node.body) walk(node.body); if (node.thenBody) walk(node.thenBody); if (node.elseBody) walk(node.elseBody); } };
  walk(ast);
  return out;
}

function walkControls(ir, visit) {
  const walk = controls => { for (const control of controls ?? []) { visit(control); if (control.type === 'tabs') for (const page of control.pages ?? []) walk(page.controls); if (control.type === 'panel') walk(control.controls); } };
  for (const form of ir.forms ?? []) walk(form.controls);
}

function flattenControlsWithoutValidation(ir) {
  const out = [];
  const emit = (control, formIndex, parentTabIndex, pageIndex, pageTitles, parentPanelIndex) => {
    const nativeIndex = out.length;
    out.push({ ...control, formIndex, nativeIndex, parentTabIndex, pageIndex, pageTitles, parentPanelIndex });
    if (control.type === 'tabs') for (let page = 0; page < (control.pages ?? []).length; page += 1) for (const child of control.pages[page].controls ?? []) emit(child, formIndex, nativeIndex, page, [], parentPanelIndex);
    if (control.type === 'panel') for (const child of control.controls ?? []) emit(child, formIndex, parentTabIndex, pageIndex, [], nativeIndex);
  };
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) for (const control of ir.forms[formIndex].controls ?? []) emit(control, formIndex, -1, -1, control.type === 'tabs' ? control.pages.map(page => page.title) : [], -1);
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
function cloneNativeGuiIrWithPolicies(input) {
  const layouts = [];
  const collect = controls => { for (const control of controls ?? []) { layouts.push(control.layout?.policy ? structuredClone(control.layout.policy) : null); if (control.type === 'tabs') for (const page of control.pages ?? []) collect(page.controls); if (control.type === 'panel') collect(control.controls); } };
  for (const form of input.forms ?? []) collect(form.controls);
  const cloned = structuredClone(input); let cursor = 0;
  const restore = controls => { for (const control of controls ?? []) { const policy = layouts[cursor++]; if (policy && control.layout) defineLayoutPolicy(control.layout, policy); if (control.type === 'tabs') for (const page of control.pages ?? []) restore(page.controls); if (control.type === 'panel') restore(control.controls); } };
  for (const form of cloned.forms ?? []) restore(form.controls);
  return cloned;
}
function cloneLayoutWithPolicy(layout) { if (!layout) return layout; const cloned = structuredClone(layout); if (layout.policy) defineLayoutPolicy(cloned, structuredClone(layout.policy)); return cloned; }
function defineLayoutPolicy(layout, policy) { Object.defineProperty(layout, 'policy', { value: policy, enumerable: false, configurable: true, writable: false }); }
function identifier(value) { return String(value).replace(/[^A-Za-z0-9_]/g, '_').replace(/^[0-9]/, '_$&'); }
