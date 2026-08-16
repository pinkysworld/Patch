import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-ir.js';
import {
  buildNativeGuiIRV10,
  validateNativeGuiIRV10,
  flattenNativeGuiControlsV10,
  flattenNativeGuiMenuItemsV10
} from './native-gui-ir-v10.js';

export const PATCH_NATIVE_GUI_IR_V11_VERSION = '1.1';

/**
 * Native GUI IR 1.1 adds persistent text-list state and list-backed multi-select
 * ListBox semantics. Text-backed ListBox remains single-select and unchanged.
 */
export function buildNativeGuiIRV11(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.1 lowering.');
  }

  const listStates = collectListStates(compiled.ast);
  if (!listStates.size) {
    const ir = buildNativeGuiIRV10(compiled);
    ir.version = PATCH_NATIVE_GUI_IR_V11_VERSION;
    return validateNativeGuiIRV11(ir);
  }

  rejectListInterpolation(compiled.ast, listStates);
  const compatibility = cloneCompiledWithPolicies(compiled);
  rewriteListsForV10Compatibility(compatibility.ast, listStates);
  const ir = buildNativeGuiIRV10(compatibility);

  for (const state of ir.states ?? []) {
    const original = listStates.get(state.name);
    if (!original) continue;
    state.type = 'list';
    state.initial = [...original.initial];
  }

  markMultiSelectControls(ir, listStates);
  restoreListEventsAndActions(ir, compiled.ast, listStates);
  ir.version = PATCH_NATIVE_GUI_IR_V11_VERSION;
  return validateNativeGuiIRV11(ir);
}

export function validateNativeGuiIRV11(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V11_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.1 format/version is unsupported.');
  }

  const states = new Map();
  for (const state of ir.states ?? []) {
    if (states.has(state.name)) throw new NativeGuiError(`Native GUI IR 1.1 state '${state.name}' is duplicated.`);
    if (state.type === 'list') {
      if (!Array.isArray(state.initial) || state.initial.some(value => typeof value !== 'string')) {
        throw new NativeGuiError(`Native GUI IR 1.1 list state '${state.name}' needs a text-list initial value.`);
      }
    }
    states.set(state.name, state);
  }

  const sources = new Map();
  walkControls(ir, (control, formId) => {
    if (control.id) sources.set(control.id, { control, formId });
    if (control.type !== 'listbox') {
      if (control.selectionMode !== undefined) {
        throw new NativeGuiError(`Native GUI IR 1.1 '${control.type}' cannot declare ListBox selectionMode.`);
      }
      return;
    }
    const state = states.get(control.binding);
    if (state?.type === 'list') {
      if (control.selectionMode !== 'multiple') {
        throw new NativeGuiError(`Native GUI IR 1.1 list-backed ListBox '${control.id}' must use multiple selection.`);
      }
    } else if (control.selectionMode !== undefined && control.selectionMode !== 'single') {
      throw new NativeGuiError(`Native GUI IR 1.1 text-backed ListBox '${control.id}' must remain single-select.`);
    }
  });

  for (const event of ir.events ?? []) {
    const source = sources.get(event.control);
    const state = source?.control?.binding ? states.get(source.control.binding) : null;
    const multi = source?.control?.type === 'listbox' && state?.type === 'list';
    if (multi) {
      if (event.event !== 'changed' || event.valueType !== 'text-list') {
        throw new NativeGuiError(`Native GUI IR 1.1 multi-select ListBox '${event.control}' needs changed/text-list event semantics.`);
      }
    } else if (event.valueType === 'text-list' && source?.control?.type !== 'table') {
      throw new NativeGuiError(`Native GUI IR 1.1 event '${event.control}' exposes text-list without a list-backed ListBox.`);
    }
    for (const action of event.actions ?? []) validateListAction(action, event, states);
  }

  validateNativeGuiIRV10(toV10Compatible(ir));
  return ir;
}

export function flattenNativeGuiControlsV11(ir) {
  validateNativeGuiIRV11(ir);
  const compatible = toV10Compatible(ir);
  const flat = flattenNativeGuiControlsV10(compatible);
  const original = flattenControlsWithoutValidation(ir);
  if (flat.length !== original.length) throw new NativeGuiError('Native GUI IR 1.1 control flattening lost ordering.');
  return flat.map((control, index) => ({
    ...control,
    ...(original[index].selectionMode ? { selectionMode: original[index].selectionMode } : {})
  }));
}

export function flattenNativeGuiMenuItemsV11(ir) {
  validateNativeGuiIRV11(ir);
  return flattenNativeGuiMenuItemsV10(toV10Compatible(ir));
}

export function toV10Compatible(ir) {
  const compatible = cloneNativeGuiIrWithPolicies(ir);
  compatible.version = '1.0';
  const listNames = new Set();
  for (const state of compatible.states ?? []) {
    if (state.type !== 'list') continue;
    listNames.add(state.name);
    state.type = 'text';
    state.initial = state.initial?.[0] ?? '';
  }

  const listBackedControlIds = new Set();
  walkControls(compatible, control => {
    if (control.type === 'listbox' && listNames.has(control.binding)) {
      listBackedControlIds.add(control.id);
      delete control.selectionMode;
    }
  });

  for (const event of compatible.events ?? []) {
    if (event.valueType === 'text-list' && listBackedControlIds.has(event.control)) event.valueType = 'text';
    for (const action of event.actions ?? []) {
      if (action.kind !== 'change' || !listNames.has(action.target)) continue;
      action.stateType = 'text';
      action.ops = (action.ops ?? []).map(op => compatibleListOperation(op));
    }
  }
  return compatible;
}

function collectListStates(ast) {
  const out = new Map();
  for (const node of ast ?? []) {
    if (node.kind !== 'create' || node.valueType !== 'list') continue;
    out.set(node.name, { node, initial: parseTextListLiteral(node.expr, node.line, `list state '${node.name}'`) });
  }
  return out;
}

function rewriteListsForV10Compatibility(ast, listStates) {
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'create' && listStates.has(node.name)) {
        node.valueType = 'text';
        node.expr = JSON.stringify(listStates.get(node.name).initial[0] ?? '');
      }
      if (node.kind === 'change' && listStates.has(node.target)) {
        node.ops = (node.ops ?? []).map(op => rewriteListOperationForCompatibility(op));
      }
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
}

function rewriteListOperationForCompatibility(op) {
  if (op.op === 'clear') return op;
  const expr = String(op.expr ?? '').trim();
  if (expr === 'value') return { ...op, op: 'set' };
  if (op.op === 'add') return { ...op, expr: JSON.stringify('') };
  return { ...op, op: 'set', expr: JSON.stringify('') };
}

function restoreListEventsAndActions(ir, originalAst, listStates) {
  const originalEvents = new Map(
    (originalAst ?? []).filter(node => node.kind === 'event').map(node => [`${node.control}\u0000${node.event}`, node])
  );
  const multiBindings = collectMultiListBindings(originalAst, listStates);

  for (const event of ir.events ?? []) {
    if (event.event === 'changed' && multiBindings.has(event.control)) event.valueType = 'text-list';
    const original = originalEvents.get(`${event.control}\u0000${event.event}`);
    if (!original) continue;
    let actionIndex = 0;
    for (const node of original.body ?? []) {
      const lowered = event.actions?.[actionIndex];
      if (!lowered) break;
      if (node.kind === 'change' && listStates.has(node.target)) {
        event.actions[actionIndex] = lowerListChange(node, event);
      }
      actionIndex += 1;
    }
  }
}

function lowerListChange(node, event) {
  const ops = [];
  for (const op of node.ops ?? []) {
    if (op.field) throw new NativeGuiError(`line ${op.line ?? '?'}: native GUI 1.1 list state does not support field mutation.`);
    if (!['set', 'add', 'remove', 'clear'].includes(op.op)) {
      throw new NativeGuiError(`line ${op.line ?? '?'}: native GUI 1.1 cannot apply '${op.op}' to list state '${node.target}'.`);
    }
    if (op.op === 'clear') {
      ops.push({ op: 'clear' });
      continue;
    }
    const expr = String(op.expr ?? '').trim();
    if (expr === 'value') {
      if (op.op !== 'set' || event.valueType !== 'text-list') {
        throw new NativeGuiError(`line ${op.line ?? '?'}: list event value can only be assigned with 'set = value' in a text-list event.`);
      }
      ops.push({ op: 'set', value: { kind: 'eventValue' } });
      continue;
    }
    if (op.op === 'set') {
      ops.push({ op: 'set', value: { kind: 'literal', value: parseTextListLiteral(expr, op.line, `list state '${node.target}'`) } });
      continue;
    }
    ops.push({ op: op.op, value: { kind: 'literal', value: parseTextLiteral(expr, op.line, `${op.op} value`) } });
  }
  return { kind: 'change', target: node.target, stateType: 'list', ops };
}

function validateListAction(action, event, states) {
  if (action.kind !== 'change') return;
  const state = states.get(action.target);
  if (state?.type !== 'list') return;
  if (action.stateType !== 'list') throw new NativeGuiError(`Native GUI IR 1.1 change '${action.target}' lost list stateType.`);
  for (const op of action.ops ?? []) {
    if (!['set', 'add', 'remove', 'clear'].includes(op.op)) {
      throw new NativeGuiError(`Native GUI IR 1.1 cannot apply '${op.op}' to list state '${action.target}'.`);
    }
    if (op.op === 'clear') continue;
    if (op.value?.kind === 'eventValue') {
      if (op.op !== 'set' || event.valueType !== 'text-list') {
        throw new NativeGuiError('Native GUI IR 1.1 list eventValue requires set/text-list semantics.');
      }
      continue;
    }
    if (op.op === 'set') {
      if (!Array.isArray(op.value?.value) || op.value.value.some(value => typeof value !== 'string')) {
        throw new NativeGuiError('Native GUI IR 1.1 list set literal must be a text list.');
      }
    } else if (typeof op.value?.value !== 'string') {
      throw new NativeGuiError(`Native GUI IR 1.1 list ${op.op} literal must be text.`);
    }
  }
}

function compatibleListOperation(op) {
  if (op.op === 'clear') return { op: 'clear' };
  if (op.value?.kind === 'eventValue') return { op: 'set', value: { kind: 'eventValue' } };
  if (op.op === 'add') return { op: 'add', value: { kind: 'literal', value: '' } };
  return { op: 'set', value: { kind: 'literal', value: '' } };
}

function collectMultiListBindings(ast, listStates) {
  const out = new Set();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'listbox' && listStates.has(node.id)) out.add(node.id);
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  return out;
}

function markMultiSelectControls(ir, listStates) {
  walkControls(ir, control => {
    if (control.type === 'listbox' && listStates.has(control.binding)) control.selectionMode = 'multiple';
  });
}

function rejectListInterpolation(ast, listStates) {
  const names = [...listStates.keys()];
  const scanText = (expr, line, label) => {
    const text = String(expr ?? '');
    for (const name of names) {
      if (text.includes(`{${name}}`)) {
        throw new NativeGuiError(`line ${line ?? '?'}: native GUI 1.1 does not interpolate list state '${name}' into ${label}; use a scalar display state.`);
      }
    }
  };
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.textExpr) scanText(node.textExpr, node.line, `${node.control} text`);
      if (node.kind === 'window') scanText(node.titleExpr, node.line, 'Form title');
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
}

function parseTextListLiteral(expr, line, label) {
  try {
    const value = JSON.parse(String(expr ?? '').trim());
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error('not text-list');
    return value;
  } catch {
    throw new NativeGuiError(`line ${line ?? '?'}: native GUI 1.1 ${label} must be a literal list of quoted text.`);
  }
}

function parseTextLiteral(expr, line, label) {
  try {
    const value = JSON.parse(String(expr ?? '').trim());
    if (typeof value !== 'string') throw new Error('not text');
    return value;
  } catch {
    throw new NativeGuiError(`line ${line ?? '?'}: native GUI 1.1 ${label} must be quoted text.`);
  }
}

function walkControls(ir, visit) {
  const walk = (controls, formId) => {
    for (const control of controls ?? []) {
      visit(control, formId);
      if (control.type === 'tabs') for (const page of control.pages ?? []) walk(page.controls, formId);
    }
  };
  for (const form of ir.forms ?? []) walk(form.controls, form.id);
}

function flattenControlsWithoutValidation(ir) {
  const out = [];
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (const control of form.controls ?? []) {
      const nativeIndex = out.length;
      out.push({ ...control, formIndex, nativeIndex, parentTabIndex: -1, pageIndex: -1, pageTitles: control.type === 'tabs' ? control.pages.map(page => page.title) : [] });
      if (control.type !== 'tabs') continue;
      for (let pageIndex = 0; pageIndex < control.pages.length; pageIndex += 1) {
        for (const child of control.pages[pageIndex].controls ?? []) {
          out.push({ ...child, formIndex, nativeIndex: out.length, parentTabIndex: nativeIndex, pageIndex, pageTitles: [] });
        }
      }
    }
  }
  return out;
}

function cloneCompiledWithPolicies(compiled) {
  const policies = [];
  const collect = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' || node.kind === 'tabs') policies.push(node.layout?.policy ? structuredClone(node.layout.policy) : null);
      if (node.body) collect(node.body);
      if (node.thenBody) collect(node.thenBody);
      if (node.elseBody) collect(node.elseBody);
    }
  };
  collect(compiled.ast);
  const cloned = structuredClone(compiled);
  let cursor = 0;
  const restore = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' || node.kind === 'tabs') {
        const policy = policies[cursor++];
        if (policy && node.layout) Object.defineProperty(node.layout, 'policy', { value: policy, enumerable: false, configurable: true, writable: false });
      }
      if (node.body) restore(node.body);
      if (node.thenBody) restore(node.thenBody);
      if (node.elseBody) restore(node.elseBody);
    }
  };
  restore(cloned.ast);
  if (cursor !== policies.length) throw new NativeGuiError('Native GUI IR 1.1 compiled clone lost layout policy ordering.');
  return cloned;
}

function cloneNativeGuiIrWithPolicies(input) {
  const policies = [];
  const collect = controls => {
    for (const control of controls ?? []) {
      policies.push(control.layout?.policy ? structuredClone(control.layout.policy) : null);
      if (control.type === 'tabs') for (const page of control.pages ?? []) collect(page.controls);
    }
  };
  for (const form of input.forms ?? []) collect(form.controls);
  const cloned = structuredClone(input);
  let cursor = 0;
  const restore = controls => {
    for (const control of controls ?? []) {
      const policy = policies[cursor++];
      if (policy && control.layout) Object.defineProperty(control.layout, 'policy', { value: policy, enumerable: false, configurable: true, writable: false });
      if (control.type === 'tabs') for (const page of control.pages ?? []) restore(page.controls);
    }
  };
  for (const form of cloned.forms ?? []) restore(form.controls);
  if (cursor !== policies.length) throw new NativeGuiError('Native GUI IR 1.1 clone lost layout policy ordering.');
  return cloned;
}
