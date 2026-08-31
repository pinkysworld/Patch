import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js';
import { normalizeWindowIconExpression } from './window-icon.js';
import {
  buildNativeGuiIRV18,
  validateNativeGuiIRV18,
  flattenNativeGuiControlsV18,
  flattenNativeGuiMenuItemsV18
} from './native-gui-ir-v18.js';

export const PATCH_NATIVE_GUI_IR_V19_VERSION = '1.9';
const RESOURCE_ID = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;

/**
 * Native GUI IR 1.9 adds project-backed Form/application icon metadata over
 * the experimental IR 1.8 Button ImageList contract.
 *
 * The current product contract remains pinned below this line. IR 1.9 has an
 * exact IR 1.8 compatibility projection so icon work can be developed without
 * weakening existing fail-closed Ready behavior or rewriting the established
 * Button-image contract.
 */
export function buildNativeGuiIRV19(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.9 lowering.');
  }

  const icons = collectWindowIconBindings(compiled.ast);
  const compatibility = cloneCompiledWithPolicies(compiled);
  stripWindowIcons(compatibility.ast);
  const ir = buildNativeGuiIRV18(compatibility);
  restoreWindowIcons(ir, icons);
  ir.version = PATCH_NATIVE_GUI_IR_V19_VERSION;
  return validateNativeGuiIRV19(ir);
}

export function validateNativeGuiIRV19(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V19_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.9 format/version is unsupported.');
  }

  let firstIconIndex = -1;
  let applicationCount = 0;
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    const form = ir.forms[formIndex];
    if (form.icon === undefined || form.icon === null) continue;
    if (firstIconIndex < 0) firstIconIndex = formIndex;
    form.icon = normalizeFormIcon(form.icon, formIndex, form.id ?? null);
    if (form.icon.application) applicationCount += 1;
  }

  if (firstIconIndex >= 0) {
    if (applicationCount !== 1 || !ir.forms[firstIconIndex].icon?.application) {
      throw new NativeGuiError('Native GUI IR 1.9 requires exactly the first icon-bearing Form to own the application icon.');
    }
  } else if (applicationCount !== 0) {
    throw new NativeGuiError('Native GUI IR 1.9 application icon metadata is inconsistent.');
  }

  validateNativeGuiIRV18(toV18CompatibleV19(ir));
  return ir;
}

export function toV18CompatibleV19(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.8';
  for (const form of ir.forms ?? []) delete form.icon;
  return ir;
}

export function flattenNativeGuiControlsV19(ir) {
  validateNativeGuiIRV19(ir);
  return flattenNativeGuiControlsV18(toV18CompatibleV19(ir));
}

export function flattenNativeGuiMenuItemsV19(ir) {
  validateNativeGuiIRV19(ir);
  return flattenNativeGuiMenuItemsV18(toV18CompatibleV19(ir));
}

export function hasNativeWindowIcon(input) {
  return Boolean(input?.forms?.some(form => form?.icon));
}

function collectWindowIconBindings(ast) {
  const bindings = [];
  let formIndex = 0;
  for (const node of ast ?? []) {
    if (node?.kind !== 'window') continue;
    if (node.iconExpr) {
      let icon;
      try {
        icon = normalizeWindowIconExpression(node.iconExpr);
      } catch (error) {
        throw new NativeGuiError(error?.message ?? String(error));
      }
      if (!icon.resourceId) {
        throw new NativeGuiError(
          `Native GUI IR 1.9 Form '${node.id ?? `window${formIndex + 1}`}' icon must use a project resource locator such as "patch-resource:app.icon".`
        );
      }
      bindings.push(Object.freeze({
        formIndex,
        formId: node.id ?? null,
        resourceId: icon.resourceId,
        application: false
      }));
    }
    formIndex += 1;
  }

  if (bindings.length) {
    bindings[0] = Object.freeze({ ...bindings[0], application: true });
  }
  return Object.freeze(bindings);
}

function stripWindowIcons(ast) {
  for (const node of ast ?? []) {
    if (node?.kind === 'window') delete node.iconExpr;
  }
}

function restoreWindowIcons(ir, bindings) {
  for (const binding of bindings) {
    const form = ir.forms?.[binding.formIndex];
    if (!form) {
      throw new NativeGuiError(`Native GUI IR 1.9 could not restore icon metadata for Form ${binding.formIndex + 1}.`);
    }
    if (binding.formId && form.id && binding.formId !== form.id) {
      throw new NativeGuiError(
        `Native GUI IR 1.9 Form identity changed while restoring icon '${binding.resourceId}'.`
      );
    }
    form.icon = {
      resourceId: binding.resourceId,
      application: binding.application
    };
  }
}

function normalizeFormIcon(value, formIndex, formId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeGuiError(`Native GUI IR 1.9 Form '${formId ?? formIndex + 1}' icon metadata is invalid.`);
  }
  const resourceId = String(value.resourceId ?? '').trim();
  if (!RESOURCE_ID.test(resourceId)) {
    throw new NativeGuiError(
      `Native GUI IR 1.9 Form '${formId ?? formIndex + 1}' has invalid icon resource id '${resourceId || '?'}'.`
    );
  }
  if (typeof value.application !== 'boolean') {
    throw new NativeGuiError(`Native GUI IR 1.9 Form '${formId ?? formIndex + 1}' icon application flag must be boolean.`);
  }
  return Object.freeze({ resourceId, application: value.application });
}

function cloneCompiledWithPolicies(compiled) {
  const cloned = structuredClone(compiled);
  const originalNodes = [];
  const clonedNodes = [];
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
  Object.defineProperty(layout, 'policy', {
    value: policy,
    enumerable: false,
    configurable: true,
    writable: false
  });
}
