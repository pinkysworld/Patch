import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js';
import { collectWindowImageLists, resolveButtonImageBinding } from './button-image.js';
import {
  PATCH_IMAGELIST_MIN_LOGICAL_SIZE,
  PATCH_IMAGELIST_MAX_LOGICAL_SIZE
} from './imagelist-control.js';
import {
  buildNativeGuiIRV17,
  validateNativeGuiIRV17,
  flattenNativeGuiMenuItemsV17
} from './native-gui-ir-v17.js';

export const PATCH_NATIVE_GUI_IR_V18_VERSION = '1.8';
const PATCH_NAME = /^[A-Za-z_]\w*$/;
const RESOURCE_ID = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;

/**
 * Native GUI IR 1.8 is an additive Button ImageList transport over IR 1.7.
 *
 * The current product contract intentionally remains IR 1.7 until a matching
 * desktop runtime consumes this metadata on Win32, AppKit and GTK. IR 1.8 can
 * therefore be developed and tested without weakening the current fail-closed
 * native Button-image boundary.
 */
export function buildNativeGuiIRV18(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.8 lowering.');
  }

  const buttonImages = collectButtonImageBindings(compiled.ast);
  const compatibility = cloneCompiledWithPolicies(compiled);
  stripButtonImageBindings(compatibility.ast);
  const ir = buildNativeGuiIRV17(compatibility);
  restoreButtonImageBindings(ir, buttonImages);
  ir.version = PATCH_NATIVE_GUI_IR_V18_VERSION;
  return validateNativeGuiIRV18(ir);
}

export function validateNativeGuiIRV18(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V18_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.8 format/version is unsupported.');
  }

  const seen = new Set();
  walkControls(ir, (control, formIndex) => {
    if (control.image === undefined || control.image === null) return;
    if (control.type !== 'button') {
      throw new NativeGuiError(`Native GUI IR 1.8 image metadata is supported only on Button controls, not '${control.type ?? 'unknown'}'.`);
    }
    if (!control.id || !PATCH_NAME.test(control.id)) {
      throw new NativeGuiError('Native GUI IR 1.8 Button image metadata needs a valid Button id.');
    }
    const key = `${formIndex}:${control.id}`;
    if (seen.has(key)) {
      throw new NativeGuiError(`Native GUI IR 1.8 Button image metadata for '${control.id}' is duplicated.`);
    }
    seen.add(key);
    control.image = normalizeButtonImage(control.image, control.id);
  });

  validateNativeGuiIRV17(toV17CompatibleV18(ir));
  return ir;
}

export function flattenNativeGuiControlsV18(ir) {
  validateNativeGuiIRV18(ir);
  return flattenControlsWithoutValidation(ir);
}

export function flattenNativeGuiMenuItemsV18(ir) {
  validateNativeGuiIRV18(ir);
  return flattenNativeGuiMenuItemsV17(toV17CompatibleV18(ir));
}

export function hasNativeButtonImage(input) {
  let found = false;
  walkControls(input, control => {
    if (control.type === 'button' && control.image) found = true;
  });
  return found;
}

/**
 * Exact compatibility projection below the IR 1.8 boundary. Button image
 * metadata is removed and the version is restored to 1.7, leaving the existing
 * PaintBox-image/native contract untouched.
 */
export function toV17CompatibleV18(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.7';
  walkControls(ir, control => {
    if (control.type === 'button') delete control.image;
  });
  return ir;
}

function collectButtonImageBindings(ast) {
  const out = [];
  let formIndex = 0;
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    const imageLists = collectWindowImageLists(node.body ?? []);
    walkAstControls(node.body ?? [], control => {
      if (control.kind !== 'uiControl' || control.control !== 'button' || !control.imageListId || !control.imageItem) return;
      let binding;
      try {
        binding = resolveButtonImageBinding(imageLists, control, control.line);
      } catch (error) {
        throw new NativeGuiError(error?.message ?? String(error));
      }
      if (!binding?.resourceId) {
        throw new NativeGuiError(
          `Native GUI IR 1.8 Button '${control.id ?? 'unnamed'}' image ${control.imageListId}.${control.imageItem} does not resolve to a project resource.`
        );
      }
      out.push(Object.freeze({
        formIndex,
        controlId: control.id,
        imageListId: binding.imageListId,
        imageItem: binding.imageItem,
        resourceId: binding.resourceId,
        logicalWidth: binding.width,
        logicalHeight: binding.height
      }));
    });
    formIndex += 1;
  }
  return Object.freeze(out);
}

/**
 * The IR 1.7 compatibility underlay has neither an ImageList control nor a
 * Button-image consumer contract. IR 1.8 resolves those nonvisual declarations
 * before this projection, so the private compatibility AST removes ImageList
 * nodes and clears Button bindings while preserving every other statement.
 */
function stripButtonImageBindings(nodes) {
  if (!Array.isArray(nodes)) return;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node?.kind === 'uiControl' && node.control === 'imagelist') {
      nodes.splice(index, 1);
      continue;
    }
    if (node?.kind === 'uiControl' && node.control === 'button') {
      node.imageListId = null;
      node.imageItem = null;
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) stripButtonImageBindings(page.body);
      continue;
    }
    if (node?.body) stripButtonImageBindings(node.body);
    if (node?.thenBody) stripButtonImageBindings(node.thenBody);
    if (node?.elseBody) stripButtonImageBindings(node.elseBody);
  }
}

function restoreButtonImageBindings(ir, bindings) {
  const byForm = new Map();
  for (const binding of bindings) {
    const list = byForm.get(binding.formIndex) ?? [];
    list.push(binding);
    byForm.set(binding.formIndex, list);
  }
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    const expected = new Map((byForm.get(formIndex) ?? []).map(binding => [binding.controlId, binding]));
    walkControlList(ir.forms[formIndex].controls, control => {
      const binding = expected.get(control.id);
      if (!binding) return;
      if (control.type !== 'button') {
        throw new NativeGuiError(`Native GUI IR 1.8 Button image target '${control.id}' changed type during compatibility lowering.`);
      }
      control.image = {
        imageListId: binding.imageListId,
        imageItem: binding.imageItem,
        resourceId: binding.resourceId,
        logicalWidth: binding.logicalWidth,
        logicalHeight: binding.logicalHeight
      };
      expected.delete(control.id);
    });
    if (expected.size) {
      throw new NativeGuiError(`Native GUI IR 1.8 could not restore Button image target '${expected.keys().next().value}'.`);
    }
  }
}

function normalizeButtonImage(value, controlId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeGuiError(`Native GUI IR 1.8 Button '${controlId}' image metadata is invalid.`);
  }
  const imageListId = String(value.imageListId ?? '').trim();
  const imageItem = String(value.imageItem ?? '').trim();
  const resourceId = String(value.resourceId ?? '').trim();
  const logicalWidth = Number(value.logicalWidth);
  const logicalHeight = Number(value.logicalHeight);
  if (!PATCH_NAME.test(imageListId) || !PATCH_NAME.test(imageItem)) {
    throw new NativeGuiError(`Native GUI IR 1.8 Button '${controlId}' has invalid ImageList metadata.`);
  }
  if (!RESOURCE_ID.test(resourceId)) {
    throw new NativeGuiError(`Native GUI IR 1.8 Button '${controlId}' has invalid resource id '${resourceId || '?'}'.`);
  }
  for (const [label, number] of [['width', logicalWidth], ['height', logicalHeight]]) {
    if (!Number.isInteger(number) || number < PATCH_IMAGELIST_MIN_LOGICAL_SIZE || number > PATCH_IMAGELIST_MAX_LOGICAL_SIZE) {
      throw new NativeGuiError(
        `Native GUI IR 1.8 Button '${controlId}' image logical ${label} must be a whole number from ${PATCH_IMAGELIST_MIN_LOGICAL_SIZE} to ${PATCH_IMAGELIST_MAX_LOGICAL_SIZE}.`
      );
    }
  }
  return Object.freeze({ imageListId, imageItem, resourceId, logicalWidth, logicalHeight });
}

function walkAstControls(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node);
    if (node.kind === 'tabs') {
      for (const page of node.body ?? []) walkAstControls(page.body, visit);
      continue;
    }
    if (node.kind === 'uiControl' && Array.isArray(node.body)) walkAstControls(node.body, visit);
  }
}

function walkControls(ir, visit) {
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    walkControlList(ir.forms[formIndex].controls, control => visit(control, formIndex));
  }
}

function walkControlList(controls, visit) {
  for (const control of controls ?? []) {
    visit(control);
    if (control.type === 'tabs') for (const page of control.pages ?? []) walkControlList(page.controls, visit);
    if (control.type === 'panel') walkControlList(control.controls, visit);
  }
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
