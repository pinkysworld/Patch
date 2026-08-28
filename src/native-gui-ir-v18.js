import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js';
import {
  buildNativeGuiIRV17,
  validateNativeGuiIRV17,
  flattenNativeGuiMenuItemsV17
} from './native-gui-ir-v17.js';
import {
  PATCH_IMAGELIST_MAX_ITEMS,
  PATCH_IMAGELIST_MIN_LOGICAL_SIZE,
  PATCH_IMAGELIST_MAX_LOGICAL_SIZE,
  normalizeImageListId,
  normalizeImageListItemName
} from './imagelist-control.js';

export const PATCH_NATIVE_GUI_IR_V18_VERSION = '1.8';
const RESOURCE_PREFIX = 'patch-resource:';
const MAX_LISTS = 256;

/** Native GUI IR 1.8 adds ImageList + Button `image list.item` over IR 1.7. */
export function buildNativeGuiIRV18(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.8 lowering.');
  }
  const lists = collectImageLists(compiled.ast);
  const buttons = collectButtonImages(compiled.ast, lists);
  const compatibility = cloneCompiledWithPolicies(compiled);
  stripImageListForV17(compatibility.ast);
  const ir = buildNativeGuiIRV17(compatibility);
  ir.imageLists = lists;
  restoreButtonImages(ir, buttons);
  ir.version = PATCH_NATIVE_GUI_IR_V18_VERSION;
  return validateNativeGuiIRV18(ir);
}

export function validateNativeGuiIRV18(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V18_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.8 format/version is unsupported.');
  }
  const lists = validateImageLists(ir.imageLists);
  const listIds = new Set(lists.map(list => list.id));
  walkControls(ir, control => {
    if (control.type !== 'button') return;
    if (!control.imageListId && !control.imageItem) return;
    if (!control.imageListId || !control.imageItem) {
      throw new NativeGuiError(`Native GUI IR 1.8 Button '${control.id}' image binding is incomplete.`);
    }
    if (!listIds.has(control.imageListId)) {
      throw new NativeGuiError(
        `Native GUI IR 1.8 Button '${control.id}' image ${control.imageListId}.${control.imageItem} refers to a missing ImageList.`
      );
    }
  });
  ir.imageLists = lists;
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

export function hasNativeImageList(input) {
  return (input?.imageLists ?? []).length > 0 || astHasImageList(input);
}

export function hasNativeButtonImage(input) {
  let found = false;
  walkControls(input, control => {
    if (control?.type === 'button' && control.imageListId && control.imageItem) found = true;
  });
  if (found) return true;
  return astHasButtonImage(input);
}

/**
 * Private compatibility projection used only below the Native GUI 1.8 boundary.
 * ImageList collections and Button image bindings are stripped so frozen IR 1.7
 * remains fail-closed. Backend 1.9 restores PNG/JPEG Button images on top.
 */
export function toV17CompatibleV18(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.7';
  delete ir.imageLists;
  walkControls(ir, control => {
    if (control.type !== 'button') return;
    delete control.imageListId;
    delete control.imageItem;
    delete control.imageSource;
    delete control.imageResourceId;
    delete control.imageWidth;
    delete control.imageHeight;
  });
  return ir;
}

function collectImageLists(ast) {
  const lists = [];
  const ids = new Set();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'imagelist') {
        const id = normalizeImageListId(node.id);
        if (ids.has(id)) {
          throw new NativeGuiError(`Native GUI IR 1.8 ImageList id '${id}' is duplicated.`);
        }
        ids.add(id);
        const width = Number(node.logicalWidth);
        const height = Number(node.logicalHeight);
        if (!Number.isInteger(width) || width < PATCH_IMAGELIST_MIN_LOGICAL_SIZE || width > PATCH_IMAGELIST_MAX_LOGICAL_SIZE) {
          throw new NativeGuiError(`Native GUI IR 1.8 ImageList '${id}' needs a logical width from ${PATCH_IMAGELIST_MIN_LOGICAL_SIZE} to ${PATCH_IMAGELIST_MAX_LOGICAL_SIZE}.`);
        }
        if (!Number.isInteger(height) || height < PATCH_IMAGELIST_MIN_LOGICAL_SIZE || height > PATCH_IMAGELIST_MAX_LOGICAL_SIZE) {
          throw new NativeGuiError(`Native GUI IR 1.8 ImageList '${id}' needs a logical height from ${PATCH_IMAGELIST_MIN_LOGICAL_SIZE} to ${PATCH_IMAGELIST_MAX_LOGICAL_SIZE}.`);
        }
        const items = validateItems(node.items, id);
        lists.push(Object.freeze({
          id,
          width,
          height,
          items
        }));
      }
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  if (lists.length > MAX_LISTS) {
    throw new NativeGuiError(`Native GUI IR 1.8 contains more than ${MAX_LISTS} ImageLists.`);
  }
  return Object.freeze(lists);
}

function collectButtonImages(ast, lists) {
  const byId = new Map(lists.map(list => [list.id, list]));
  const buttons = new Map();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'button' && node.imageListId && node.imageItem) {
        const listId = normalizeImageListId(node.imageListId);
        const itemName = normalizeImageListItemName(node.imageItem);
        const list = byId.get(listId);
        if (!list) {
          throw new NativeGuiError(
            `line ${node.line ?? '?'}: native GUI Button '${node.id}' image ${listId}.${itemName} refers to ImageList '${listId}' that is not defined.`
          );
        }
        const item = list.items.find(entry => entry.name === itemName);
        if (!item) {
          throw new NativeGuiError(
            `line ${node.line ?? '?'}: native GUI Button '${node.id}' image ${listId}.${itemName} refers to ImageList item '${itemName}' that is not in '${listId}'.`
          );
        }
        buttons.set(node.id, Object.freeze({
          id: node.id,
          imageListId: listId,
          imageItem: itemName,
          imageResourceId: item.resourceId,
          imageSource: `${RESOURCE_PREFIX}${item.resourceId}`,
          imageWidth: list.width,
          imageHeight: list.height
        }));
      }
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  return buttons;
}

function restoreButtonImages(ir, buttons) {
  walkControls(ir, control => {
    if (control.type !== 'button') return;
    const binding = buttons.get(control.id);
    if (!binding) return;
    control.imageListId = binding.imageListId;
    control.imageItem = binding.imageItem;
    control.imageResourceId = binding.imageResourceId;
    control.imageSource = binding.imageSource;
    control.imageWidth = binding.imageWidth;
    control.imageHeight = binding.imageHeight;
  });
}

function stripImageListForV17(ast) {
  const walk = nodes => {
    const out = [];
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'imagelist') continue;
      if (node.kind === 'uiControl' && node.control === 'button') {
        delete node.imageListId;
        delete node.imageItem;
      }
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

function validateImageLists(value) {
  const lists = Array.isArray(value) ? value : [];
  if (lists.length > MAX_LISTS) {
    throw new NativeGuiError(`Native GUI IR 1.8 contains more than ${MAX_LISTS} ImageLists.`);
  }
  const ids = new Set();
  return Object.freeze(lists.map(list => {
    const id = normalizeImageListId(list.id);
    if (ids.has(id)) throw new NativeGuiError(`Native GUI IR 1.8 ImageList id '${id}' is duplicated.`);
    ids.add(id);
    const width = Number(list.width);
    const height = Number(list.height);
    if (!Number.isInteger(width) || width < PATCH_IMAGELIST_MIN_LOGICAL_SIZE || width > PATCH_IMAGELIST_MAX_LOGICAL_SIZE) {
      throw new NativeGuiError(`Native GUI IR 1.8 ImageList '${id}' needs a logical width from ${PATCH_IMAGELIST_MIN_LOGICAL_SIZE} to ${PATCH_IMAGELIST_MAX_LOGICAL_SIZE}.`);
    }
    if (!Number.isInteger(height) || height < PATCH_IMAGELIST_MIN_LOGICAL_SIZE || height > PATCH_IMAGELIST_MAX_LOGICAL_SIZE) {
      throw new NativeGuiError(`Native GUI IR 1.8 ImageList '${id}' needs a logical height from ${PATCH_IMAGELIST_MIN_LOGICAL_SIZE} to ${PATCH_IMAGELIST_MAX_LOGICAL_SIZE}.`);
    }
    return Object.freeze({
      id,
      width,
      height,
      items: validateItems(list.items, id)
    });
  }));
}

function validateItems(value, id) {
  const items = Array.isArray(value) ? value : [];
  if (items.length > PATCH_IMAGELIST_MAX_ITEMS) {
    throw new NativeGuiError(`Native GUI IR 1.8 ImageList '${id}' contains more than ${PATCH_IMAGELIST_MAX_ITEMS} images.`);
  }
  const names = new Set();
  return Object.freeze(items.map(item => {
    const name = normalizeImageListItemName(item.name);
    if (names.has(name)) {
      throw new NativeGuiError(`Native GUI IR 1.8 ImageList '${id}' item '${name}' is duplicated.`);
    }
    names.add(name);
    const resourceId = String(item.resourceId ?? '').trim();
    if (!resourceId) {
      throw new NativeGuiError(`Native GUI IR 1.8 ImageList '${id}' item '${name}' needs a project resource id.`);
    }
    const source = String(item.source ?? `${RESOURCE_PREFIX}${resourceId}`).trim();
    return Object.freeze({
      name,
      resourceId,
      sourceExpr: String(item.sourceExpr ?? JSON.stringify(`${RESOURCE_PREFIX}${resourceId}`)),
      source
    });
  }));
}

function astHasImageList(input) {
  let found = false;
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'imagelist') found = true;
      if (node.body) walk(node.body);
    }
  };
  walk(input?.ast);
  return found;
}

function astHasButtonImage(input) {
  let found = false;
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'button' && node.imageListId && node.imageItem) found = true;
      if (node.body) walk(node.body);
    }
  };
  walk(input?.ast);
  return found;
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
  Object.defineProperty(layout, 'policy', { value: policy, enumerable: false, configurable: true, writable: false });
}
