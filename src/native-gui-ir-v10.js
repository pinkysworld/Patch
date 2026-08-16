import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-ir.js';
import {
  buildNativeGuiIRV09,
  validateNativeGuiIRV09,
  flattenNativeGuiControlsV09,
  flattenNativeGuiMenuItemsV09
} from './native-gui-ir-v09.js';

export const PATCH_NATIVE_GUI_IR_V10_VERSION = '1.0';

/**
 * Native GUI IR 1.0 extends 0.9 with source-backed Boolean MenuItem state.
 * `enabledState` and `checkedState` reference ordinary Patch Boolean state by
 * name. The bindings never create hidden state and never toggle implicitly.
 */
export function buildNativeGuiIRV10(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.0 lowering.');
  }

  const compatibilityCompiled = cloneCompiledWithPolicies(compiled);
  stripMenuStateBindings(compatibilityCompiled.ast);
  const ir = buildNativeGuiIRV09(compatibilityCompiled);

  let formIndex = 0;
  for (const node of compiled.ast) {
    if (node.kind !== 'window') continue;
    const nativeForm = ir.forms?.[formIndex++];
    if (!nativeForm) throw new NativeGuiError('Native GUI IR 1.0 lost Form ordering during lowering.');
    let menuIndex = 0;
    for (const child of node.body ?? []) {
      if (child.kind !== 'menu') continue;
      const nativeMenu = nativeForm.menus?.[menuIndex++];
      if (!nativeMenu) throw new NativeGuiError('Native GUI IR 1.0 lost Menu ordering during lowering.');
      if ((nativeMenu.items?.length ?? 0) !== (child.body?.length ?? 0)) {
        throw new NativeGuiError(`Native GUI IR 1.0 Menu '${nativeMenu.title}' lost entry ordering.`);
      }
      for (let itemIndex = 0; itemIndex < (child.body ?? []).length; itemIndex += 1) {
        const sourceItem = child.body[itemIndex];
        const nativeItem = nativeMenu.items[itemIndex];
        if (sourceItem.kind === 'menuSeparator') {
          if (nativeItem?.type !== 'menuSeparator') {
            throw new NativeGuiError(`Native GUI IR 1.0 Menu '${nativeMenu.title}' lost a separator.`);
          }
          continue;
        }
        if (sourceItem.kind !== 'menuItem' || nativeItem?.type !== 'menuItem' || sourceItem.id !== nativeItem.id) {
          throw new NativeGuiError(`Native GUI IR 1.0 Menu '${nativeMenu.title}' lost MenuItem identity.`);
        }
        nativeItem.enabledState = sourceItem.enabledState ?? null;
        nativeItem.checkedState = sourceItem.checkedState ?? null;
      }
    }
  }

  ir.version = PATCH_NATIVE_GUI_IR_V10_VERSION;
  return validateNativeGuiIRV10(ir);
}

export function validateNativeGuiIRV10(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V10_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.0 format/version is unsupported.');
  }

  const stateByName = new Map((ir.states ?? []).map(state => [state.name, state]));
  for (const form of ir.forms ?? []) {
    for (const menu of form.menus ?? []) {
      for (const item of menu.items ?? []) {
        if (item?.type !== 'menuItem') continue;
        validateBooleanBinding(item, item.enabledState, 'enabledState', stateByName);
        validateBooleanBinding(item, item.checkedState, 'checkedState', stateByName);
      }
    }
  }

  validateNativeGuiIRV09(toV09Compatible(ir));
  return ir;
}

export function flattenNativeGuiControlsV10(ir) {
  validateNativeGuiIRV10(ir);
  return flattenNativeGuiControlsV09(toV09Compatible(ir));
}

export function flattenNativeGuiMenuItemsV10(ir) {
  validateNativeGuiIRV10(ir);
  const compatible = toV09Compatible(ir);
  const baseItems = flattenNativeGuiMenuItemsV09(compatible);
  const byPosition = new Map(
    baseItems.map(item => [`${item.formIndex}:${item.menuIndex}:${item.itemIndex}`, item])
  );
  const out = [];
  for (let formIndex = 0; formIndex < ir.forms.length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (let menuIndex = 0; menuIndex < (form.menus ?? []).length; menuIndex += 1) {
      const menu = form.menus[menuIndex];
      for (let itemIndex = 0; itemIndex < menu.items.length; itemIndex += 1) {
        const item = menu.items[itemIndex];
        if (item.type !== 'menuItem') continue;
        const base = byPosition.get(`${formIndex}:${menuIndex}:${itemIndex}`);
        if (!base) throw new NativeGuiError(`Native GUI IR 1.0 lost MenuItem '${item.id}' while flattening.`);
        out.push({ ...base, enabledState: item.enabledState ?? null, checkedState: item.checkedState ?? null });
      }
    }
  }
  return out;
}

export function toV09Compatible(ir) {
  const compatible = cloneNativeGuiIrWithPolicies(ir);
  compatible.version = '0.9';
  for (const form of compatible.forms ?? []) {
    for (const menu of form.menus ?? []) {
      menu.items = (menu.items ?? []).map(item => {
        if (item?.type !== 'menuItem') return item;
        const { enabledState: _enabledState, checkedState: _checkedState, ...rest } = item;
        return rest;
      });
    }
  }
  return compatible;
}

function validateBooleanBinding(item, stateName, field, stateByName) {
  if (stateName === null || stateName === undefined) return;
  if (typeof stateName !== 'string' || !stateName) {
    throw new NativeGuiError(`Native GUI IR 1.0 MenuItem '${item.id}' has invalid ${field}.`);
  }
  const state = stateByName.get(stateName);
  if (!state || state.type !== 'boolean') {
    throw new NativeGuiError(
      `Native GUI IR 1.0 MenuItem '${item.id}' ${field} '${stateName}' must reference Boolean state.`
    );
  }
}

function stripMenuStateBindings(nodes) {
  for (const node of nodes ?? []) {
    if (node.kind === 'menuItem') {
      node.enabledState = null;
      node.checkedState = null;
    }
    if (node.body) stripMenuStateBindings(node.body);
    if (node.thenBody) stripMenuStateBindings(node.thenBody);
    if (node.elseBody) stripMenuStateBindings(node.elseBody);
  }
}

function cloneCompiledWithPolicies(compiled) {
  const policies = [];
  const collect = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' || node.kind === 'tabs') {
        policies.push(node.layout?.policy ? structuredClone(node.layout.policy) : null);
      }
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
        if (policy && node.layout) {
          Object.defineProperty(node.layout, 'policy', {
            value: policy,
            enumerable: false,
            configurable: true,
            writable: false
          });
        }
      }
      if (node.body) restore(node.body);
      if (node.thenBody) restore(node.thenBody);
      if (node.elseBody) restore(node.elseBody);
    }
  };
  restore(cloned.ast);
  if (cursor !== policies.length) throw new NativeGuiError('Native GUI IR 1.0 compiled clone lost layout policy ordering.');
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
      if (policy && control.layout) {
        Object.defineProperty(control.layout, 'policy', {
          value: policy,
          enumerable: false,
          configurable: true,
          writable: false
        });
      }
      if (control.type === 'tabs') for (const page of control.pages ?? []) restore(page.controls);
    }
  };
  for (const form of cloned.forms ?? []) restore(form.controls);
  if (cursor !== policies.length) throw new NativeGuiError('Native GUI IR 1.0 clone lost layout policy ordering.');
  return cloned;
}
