import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js';
import { normalizePatchPaintCommand, PATCH_PAINTBOX_OPERATIONS, paintProgramHasImage } from './paintbox-control.js';
import {
  buildNativeGuiIRV16,
  validateNativeGuiIRV16,
  flattenNativeGuiMenuItemsV16,
  PATCH_NATIVE_PAINTBOX_CONTROLS
} from './native-gui-ir-v16.js';

export const PATCH_NATIVE_GUI_IR_V17_VERSION = '1.7';
export const PATCH_NATIVE_PAINTBOX_IMAGE_OPERATIONS = PATCH_PAINTBOX_OPERATIONS;
const PAINTBOX = new Set(PATCH_NATIVE_PAINTBOX_CONTROLS);
const IDENT = /^[A-Za-z_]\w*$/;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const QUOTED = /^"(?:[^"\\]|\\.)*"$/;

/** Native GUI IR 1.7 adds PaintBox `draw image` over IR 1.6 Stage 1 drawing. */
export function buildNativeGuiIRV17(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.7 lowering.');
  }
  const compatibility = cloneCompiledWithPolicies(compiled);
  stripPaintImageCommands(compatibility.ast);
  const ir = buildNativeGuiIRV16(compatibility);
  restorePaintImagePrograms(ir, compiled.ast);
  ir.version = PATCH_NATIVE_GUI_IR_V17_VERSION;
  return validateNativeGuiIRV17(ir);
}

export function validateNativeGuiIRV17(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V17_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.7 format/version is unsupported.');
  }
  const paintboxIds = new Set();
  walkControls(ir, control => {
    if (!PAINTBOX.has(control.type)) return;
    if (!control.id || paintboxIds.has(control.id)) {
      throw new NativeGuiError(`Native GUI IR 1.7 PaintBox id '${control.id ?? ''}' is missing or duplicated.`);
    }
    paintboxIds.add(control.id);
    control.paintProgram = validatePaintProgram(control.paintProgram, control.id);
  });
  validateNativeGuiIRV16(toV16CompatibleV17(ir));
  return ir;
}

export function flattenNativeGuiControlsV17(ir) {
  validateNativeGuiIRV17(ir);
  return flattenControlsWithoutValidation(ir);
}

export function flattenNativeGuiMenuItemsV17(ir) {
  validateNativeGuiIRV17(ir);
  return flattenNativeGuiMenuItemsV16(toV16CompatibleV17(ir));
}

export function hasNativePaintBoxImage(input) {
  let found = false;
  walkControls(input, control => {
    if (PAINTBOX.has(control.type) && paintProgramHasImage(control.paintProgram)) found = true;
  });
  return found;
}

/**
 * Private compatibility projection used only below the Native GUI 1.7 boundary.
 * Image commands are stripped so frozen IR 1.6 remains byte/semantic compatible.
 * Backend 1.8 restores PNG/JPEG drawing on top of that underlay.
 */
export function toV16CompatibleV17(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.6';
  walkControls(ir, control => {
    if (!PAINTBOX.has(control.type)) return;
    control.paintProgram = stripImageFromProgram(control.paintProgram ?? []);
  });
  return ir;
}

function stripPaintImageCommands(ast) {
  const walk = nodes => {
    const out = [];
    for (const node of nodes ?? []) {
      if (node.kind === 'drawPaint' && node.command?.operation === 'image') continue;
      if (node.body) node.body = walk(node.body);
      if (node.thenBody) node.thenBody = walk(node.thenBody);
      if (node.elseBody) node.elseBody = walk(node.elseBody);
      out.push(node);
    }
    return out;
  };
  const rewritten = walk(ast);
  ast.length = 0;
  ast.push(...rewritten);
}

function restorePaintImagePrograms(ir, originalAst) {
  const handlers = collectPaintHandlers(originalAst);
  walkControls(ir, control => {
    if (!PAINTBOX.has(control.type)) return;
    control.paintProgram = lowerPaintProgram(handlers.get(control.id) ?? [], control.id);
  });
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
      if (command.operation === 'text') classifyPaintExpression(command.textExpr, 'text', id);
      if (command.operation === 'image') validateImageSource(command.source, id);
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
      `Native GUI IR 1.7 PaintBox '${id}' paint handlers may contain only draw, if and repeat.`
    );
  }
  return Object.freeze(out);
}

function validatePaintProgram(nodes, id) {
  if (!Array.isArray(nodes)) {
    throw new NativeGuiError(`Native GUI IR 1.7 PaintBox '${id}' needs a paint program list.`);
  }
  return Object.freeze(nodes.map(node => {
    if (node?.kind === 'draw') {
      const command = normalizePatchPaintCommand(node.command);
      if (command.operation === 'text') classifyPaintExpression(command.textExpr, 'text', id);
      if (command.operation === 'image') validateImageSource(command.source, id);
      return Object.freeze({ kind: 'draw', command });
    }
    if (node?.kind === 'if') {
      const expr = String(node.expr ?? '').trim();
      classifyPaintExpression(expr, 'if', id);
      return Object.freeze({
        kind: 'if',
        expr,
        thenBody: validatePaintProgram(node.thenBody, id),
        elseBody: validatePaintProgram(node.elseBody, id)
      });
    }
    if (node?.kind === 'repeat') {
      const expr = String(node.expr ?? '').trim();
      classifyPaintExpression(expr, 'repeat', id);
      return Object.freeze({
        kind: 'repeat',
        expr,
        body: validatePaintProgram(node.body, id)
      });
    }
    throw new NativeGuiError(`Native GUI IR 1.7 PaintBox '${id}' contains an unsupported paint node.`);
  }));
}

function stripImageFromProgram(nodes) {
  const out = [];
  for (const node of nodes ?? []) {
    if (node?.kind === 'draw' && node.command?.operation === 'image') continue;
    if (node?.kind === 'if') {
      out.push({
        ...node,
        thenBody: stripImageFromProgram(node.thenBody),
        elseBody: stripImageFromProgram(node.elseBody)
      });
      continue;
    }
    if (node?.kind === 'repeat') {
      out.push({ ...node, body: stripImageFromProgram(node.body) });
      continue;
    }
    out.push(node);
  }
  return out;
}

function validateImageSource(source, id) {
  const text = String(source ?? '').trim();
  if (!text) {
    throw new NativeGuiError(`Native GUI IR 1.7 PaintBox '${id}' draw image needs a quoted locator.`);
  }
  if (!(text.startsWith('patch-resource:') || /^data:/i.test(text))) {
    throw new NativeGuiError(
      `Native GUI IR 1.7 PaintBox '${id}' draw image locator '${text}' must be a patch-resource: id or a data URI.`
    );
  }
}

function classifyPaintExpression(expr, role, id) {
  const text = String(expr ?? '').trim();
  if (!text) {
    throw new NativeGuiError(`Native GUI IR 1.7 PaintBox '${id}' ${role} expression is empty.`);
  }
  if (text === 'true' || text === 'false') {
    if (role === 'repeat') {
      throw new NativeGuiError(`Native GUI IR 1.7 PaintBox '${id}' repeat needs a whole number from 0 to 100000 or a simple state name.`);
    }
    return 'boolean';
  }
  if (NUMBER.test(text)) {
    if (role === 'repeat') {
      const number = Number(text);
      if (!Number.isInteger(number) || number < 0 || number > 100000) {
        throw new NativeGuiError(`Native GUI IR 1.7 PaintBox '${id}' repeat needs a whole number from 0 to 100000 or a simple state name.`);
      }
    }
    return 'number';
  }
  if (QUOTED.test(text)) {
    if (role !== 'text') {
      throw new NativeGuiError(`Native GUI IR 1.7 PaintBox '${id}' ${role} expression '${text}' must be a literal or simple state name.`);
    }
    return 'string';
  }
  if (IDENT.test(text)) return 'ident';
  throw new NativeGuiError(
    `Native GUI IR 1.7 PaintBox '${id}' ${role} expression '${text}' must be a literal or simple state name.`
  );
}

function walkControls(ir, visit) {
  const walk = controls => {
    for (const control of controls ?? []) {
      visit(control);
      if (control.type === 'tabs') for (const page of control.pages ?? []) walk(page.controls);
      if (control.type === 'panel') walk(control.controls);
    }
  };
  for (const form of ir.forms ?? []) walk(form.controls);
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

function defineLayoutPolicy(layout, policy) {
  Object.defineProperty(layout, 'policy', { value: policy, enumerable: false, configurable: true, writable: false });
}
