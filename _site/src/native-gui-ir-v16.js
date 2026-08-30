import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js?v=868f0784ca7f3972';
import { normalizePatchPaintCommand } from './paintbox-control.js?v=868f0784ca7f3972';
import {
  buildNativeGuiIRV15,
  validateNativeGuiIRV15,
  flattenNativeGuiMenuItemsV15,
  PATCH_NATIVE_SHAPE_CONTROLS
} from './native-gui-ir-v15.js?v=868f0784ca7f3972';

export const PATCH_NATIVE_GUI_IR_V16_VERSION = '1.6';
export const PATCH_NATIVE_PAINTBOX_CONTROLS = Object.freeze(['paintbox']);
export const PATCH_NATIVE_PAINTBOX_OPERATIONS = Object.freeze(['clear', 'line', 'rectangle', 'ellipse', 'text']);
const PAINTBOX = new Set(PATCH_NATIVE_PAINTBOX_CONTROLS);
const IDENT = /^[A-Za-z_]\w*$/;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const QUOTED = /^"(?:[^"\\]|\\.)*"$/;
const PAINT_SCALAR_TYPES = new Set(['number', 'text', 'boolean']);

/** Native GUI IR 1.6 adds source-backed PaintBox Stage 1 drawing. */
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
  const stateTypes = collectPaintStateTypes(ir.states);
  const paintboxIds = new Set();
  walkControls(ir, control => {
    if (!PAINTBOX.has(control.type)) return;
    if (!control.id || paintboxIds.has(control.id)) {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox id '${control.id ?? ''}' is missing or duplicated.`);
    }
    paintboxIds.add(control.id);
    if (control.selectionMode !== undefined || control.nodes !== undefined || control.pages !== undefined || control.controls !== undefined) {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${control.id}' contains incompatible control metadata.`);
    }
    if (control.binding !== null) {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${control.id}' does not bind persistent state.`);
    }
    control.paintProgram = validatePaintProgram(control.paintProgram, control.id, stateTypes, 0);
    const width = Number(control.layout?.width);
    const height = Number(control.layout?.height);
    if (!Number.isFinite(width) || width < 16 || !Number.isFinite(height) || height < 16) {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${control.id}' needs an explicit size of at least 16 by 16.`);
    }
  });

  for (const event of ir.events ?? []) {
    if (!paintboxIds.has(event.control)) continue;
    throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${event.control}' does not expose Patch events; drawing lives in the paint program.`);
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
  walkControls(input, control => {
    if (PAINTBOX.has(control.type)) found = true;
  });
  return found;
}

export function hasNativeShapeOrPaintBox(input) {
  const shapes = new Set(PATCH_NATIVE_SHAPE_CONTROLS);
  let found = false;
  walkControls(input, control => {
    if (shapes.has(control.type) || PAINTBOX.has(control.type)) found = true;
  });
  return found;
}

/**
 * Private compatibility projection used only below the Native GUI 1.6 boundary.
 * PaintBox becomes a Text shadow so frozen IR 1.5 remains byte/semantic compatible.
 * Backend 1.7 restores native GDI / AppKit / GTK drawing on top of that shadow.
 */
export function toV15CompatibleV16(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.5';
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
      if (control.type === 'paintbox') {
        const shadow = {
          type: 'text', id: control.id, text: '', binding: null, options: [],
          layout: cloneLayoutWithPolicy(control.layout)
        };
        out.push(shadow);
        continue;
      }
      out.push(control);
    }
    return out;
  };
  for (const form of ir.forms ?? []) form.controls = rewrite(form.controls);
  return ir;
}

function rewritePaintBoxesForV15Compatibility(ast, originalAst) {
  const paintboxes = [];
  const usedNames = collectUsedNames(originalAst);
  const handlers = collectPaintHandlers(originalAst);
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
        const width = Number(node.layout?.width);
        const height = Number(node.layout?.height);
        if (!Number.isFinite(width) || width < 16 || !Number.isFinite(height) || height < 16) {
          throw new NativeGuiError(`line ${node.line ?? '?'}: Native GUI IR 1.6 PaintBox '${node.id}' needs an explicit size of at least 16 by 16.`);
        }
        let program;
        try {
          program = lowerPaintProgram(handlers.get(node.id) ?? [], node.id);
        } catch (error) {
          throw new NativeGuiError(`line ${node.line ?? '?'}: ${error?.message ?? error}`);
        }
        const metadata = {
          kind: 'paintbox',
          id: node.id,
          compatId: allocCompat(node.id),
          paintProgram: program,
          width,
          height,
          line: node.line
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
  const restoreList = controls => {
    const out = [];
    for (const control of controls ?? []) {
      const item = byCompatId.get(control.id);
      if (item?.kind === 'paintbox') {
        control.type = 'paintbox';
        control.id = item.id;
        control.text = '';
        control.binding = null;
        control.options = [];
        control.paintProgram = item.paintProgram;
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

function collectPaintHandlers(ast) {
  const handlers = new Map();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'event' && node.event === 'paint' && node.control) {
        handlers.set(node.control, [...(handlers.get(node.control) ?? []), ...(node.body ?? [])]);
      }
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  return handlers;
}

function lowerPaintProgram(nodes, id) {
  const out = [];
  for (const node of nodes ?? []) {
    if (node.kind === 'drawPaint') {
      const command = normalizePatchPaintCommand(node.command);
      if (command.operation === 'image') {
        throw new NativeGuiError(
          `Native GUI IR 1.6 PaintBox '${id}' does not include draw image. Use Native GUI IR 1.7 / payload v17 / runtime v1.8.`
        );
      }
      if (command.operation === 'text') classifyPaintExpression(command.textExpr, 'text', id);
      out.push(Object.freeze({ kind: 'draw', command }));
      continue;
    }
    if (node.kind === 'if') {
      const expr = String(node.expr ?? '').trim();
      classifyPaintExpression(expr, 'if', id);
      out.push(Object.freeze({
        kind: 'if',
        expr,
        thenBody: Object.freeze(lowerPaintProgram(node.thenBody, id)),
        elseBody: Object.freeze(lowerPaintProgram(node.elseBody, id))
      }));
      continue;
    }
    if (node.kind === 'repeat') {
      const expr = String(node.expr ?? '').trim();
      classifyPaintExpression(expr, 'repeat', id);
      out.push(Object.freeze({
        kind: 'repeat',
        expr,
        body: Object.freeze(lowerPaintProgram(node.body, id))
      }));
      continue;
    }
    throw new NativeGuiError(
      `Native GUI IR 1.6 PaintBox '${id}' paint handlers may contain only draw, if and repeat.`
    );
  }
  return Object.freeze(out);
}

function validatePaintProgram(nodes, id, stateTypes, repeatDepth = 0) {
  if (!Array.isArray(nodes)) {
    throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' needs a paint program list.`);
  }
  return Object.freeze(nodes.map(node => {
    if (node?.kind === 'draw') {
      const command = normalizePatchPaintCommand(node.command);
      if (command.operation === 'image') {
        throw new NativeGuiError(
          `Native GUI IR 1.6 PaintBox '${id}' does not include draw image. Use Native GUI IR 1.7 / payload v17 / runtime v1.8.`
        );
      }
      if (command.operation === 'text') classifyPaintExpression(command.textExpr, 'text', id, stateTypes, repeatDepth);
      return Object.freeze({ kind: 'draw', command });
    }
    if (node?.kind === 'if') {
      const expr = String(node.expr ?? '').trim();
      classifyPaintExpression(expr, 'if', id, stateTypes, repeatDepth);
      return Object.freeze({
        kind: 'if',
        expr,
        thenBody: validatePaintProgram(node.thenBody, id, stateTypes, repeatDepth),
        elseBody: validatePaintProgram(node.elseBody, id, stateTypes, repeatDepth)
      });
    }
    if (node?.kind === 'repeat') {
      const expr = String(node.expr ?? '').trim();
      classifyPaintExpression(expr, 'repeat', id, stateTypes, repeatDepth);
      return Object.freeze({
        kind: 'repeat',
        expr,
        body: validatePaintProgram(node.body, id, stateTypes, repeatDepth + 1)
      });
    }
    throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' contains an unsupported paint node.`);
  }));
}

function classifyPaintExpression(expr, role, id, stateTypes = null, repeatDepth = 0) {
  const text = String(expr ?? '').trim();
  if (!text) {
    throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' ${role} expression is empty.`);
  }
  if (text === 'true' || text === 'false') {
    if (role === 'repeat') {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' repeat needs a whole number from 0 to 100000 or a simple state name.`);
    }
    return 'boolean';
  }
  if (NUMBER.test(text)) {
    if (role === 'repeat') {
      const number = Number(text);
      if (!Number.isInteger(number) || number < 0 || number > 100000) {
        throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' repeat needs a whole number from 0 to 100000 or a simple state name.`);
      }
    }
    return 'number';
  }
  if (QUOTED.test(text)) {
    if (role !== 'text') {
      throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' ${role} expression '${text}' must be a literal or simple state name.`);
    }
    return 'string';
  }
  if (IDENT.test(text)) {
    if (text === 'count' && repeatDepth > 0) return 'count';
    if (!stateTypes) return 'ident';
    if (stateTypes.has(text)) {
      const stateType = stateTypes.get(text);
      if (!PAINT_SCALAR_TYPES.has(stateType)) {
        throw new NativeGuiError(
          `Native GUI IR 1.6 PaintBox '${id}' ${role} state '${text}' has unsupported type '${stateType}'; native PaintBox expressions support number, text and boolean state only.`
        );
      }
      return `state-${stateType}`;
    }
    if (role === 'text') return 'loose-text';
    throw new NativeGuiError(`Native GUI IR 1.6 PaintBox '${id}' ${role} expression '${text}' refers to unknown state '${text}'.`);
  }
  throw new NativeGuiError(
    `Native GUI IR 1.6 PaintBox '${id}' ${role} expression '${text}' must be a literal or simple state name.`
  );
}

function collectPaintStateTypes(states) {
  const out = new Map();
  for (const state of states ?? []) {
    if (!state?.name || typeof state.type !== 'string') continue;
    if (out.has(state.name)) {
      throw new NativeGuiError(`Native GUI IR 1.6 state '${state.name}' is duplicated.`);
    }
    out.set(state.name, state.type);
  }
  return out;
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