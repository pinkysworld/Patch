import {
  PATCH_NATIVE_GUI_IR_FORMAT,
  NativeGuiError
} from './native-gui-ir.js';
import {
  buildNativeGuiIRV08,
  validateNativeGuiIRV08,
  flattenNativeGuiControlsV08
} from './native-gui-ir-v08.js';
import {
  parseMenuShortcutExpression,
  parseMenuShortcut,
  menuShortcutIdentity
} from './menu-shortcut.js';

export const PATCH_NATIVE_GUI_IR_V09_VERSION = '0.9';

/**
 * Native GUI IR 0.9 extends 0.8 with structural Menu separators and portable
 * MenuItem shortcut metadata. Table 0.8 behavior remains unchanged.
 *
 * Primary is intentionally platform-neutral here. Backends map it to Control
 * on Windows/Linux and Command on macOS.
 */
export function buildNativeGuiIRV09(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 0.9 lowering.');
  }

  const cloned = structuredClone(compiled);
  const usedIds = collectUiIds(cloned.ast);
  const menus = [];
  let separatorOrdinal = 0;
  let formIndex = 0;

  cloned.ast = (cloned.ast ?? []).map(node => {
    if (node.kind !== 'window') return node;
    const currentForm = formIndex++;
    let menuIndex = 0;
    return {
      ...node,
      body: (node.body ?? []).map(child => {
        if (child.kind !== 'menu') return child;
        const currentMenu = menuIndex++;
        const entries = (child.body ?? []).map((entry, entryIndex) => {
          if (entry.kind !== 'menuSeparator') {
            return { kind: 'menuItem', source: entry, entryIndex };
          }
          const ordinal = ++separatorOrdinal;
          const dummyId = uniqueSeparatorId(usedIds, ordinal);
          usedIds.add(dummyId);
          return {
            kind: 'menuSeparator',
            source: entry,
            entryIndex,
            dummyId,
            dummyText: `__patch_menu_separator_${ordinal}_${entryIndex}`
          };
        });
        menus.push({ formIndex: currentForm, menuIndex: currentMenu, node: child, entries });
        return {
          ...child,
          body: entries.map(entry => entry.kind === 'menuSeparator'
            ? {
                kind: 'menuItem',
                id: entry.dummyId,
                textExpr: JSON.stringify(entry.dummyText),
                shortcutExpr: null,
                line: entry.source.line
              }
            : entry.source)
        };
      })
    };
  });

  const ir = buildNativeGuiIRV08(cloned);

  for (const spec of menus) {
    const nativeMenu = ir.forms?.[spec.formIndex]?.menus?.[spec.menuIndex];
    if (!nativeMenu) throw new NativeGuiError('Native GUI IR 0.9 lost Menu ordering during lowering.');
    const loweredById = new Map((nativeMenu.items ?? []).map(item => [item.id, item]));
    nativeMenu.items = spec.entries.map(entry => {
      if (entry.kind === 'menuSeparator') return { type: 'menuSeparator' };
      const lowered = loweredById.get(entry.source.id);
      if (!lowered) throw new NativeGuiError(`Native GUI IR 0.9 lost MenuItem '${entry.source.id}'.`);
      const shortcut = entry.source.shortcutExpr
        ? parseShortcut(entry.source.shortcutExpr, entry.source.line)
        : null;
      return shortcut ? { ...lowered, shortcut } : { ...lowered, shortcut: null };
    });
  }

  ir.version = PATCH_NATIVE_GUI_IR_V09_VERSION;
  return validateNativeGuiIRV09(ir);
}

export function validateNativeGuiIRV09(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V09_VERSION) {
    throw new NativeGuiError('Native GUI IR 0.9 format/version is unsupported.');
  }

  const shortcuts = new Map();
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (const menu of form.menus ?? []) {
      if (!Array.isArray(menu.items) || !menu.items.length) {
        throw new NativeGuiError(`Native GUI IR 0.9 Menu '${menu?.title ?? ''}' is empty.`);
      }
      if (menu.items[0]?.type === 'menuSeparator' || menu.items.at(-1)?.type === 'menuSeparator') {
        throw new NativeGuiError(`Native GUI IR 0.9 Menu '${menu.title}' has an edge separator.`);
      }
      for (let index = 0; index < menu.items.length; index += 1) {
        const item = menu.items[index];
        if (item?.type === 'menuSeparator') {
          if (index > 0 && menu.items[index - 1]?.type === 'menuSeparator') {
            throw new NativeGuiError(`Native GUI IR 0.9 Menu '${menu.title}' has consecutive separators.`);
          }
          continue;
        }
        if (item?.type !== 'menuItem' || !item.id || typeof item.text !== 'string') {
          throw new NativeGuiError(`Native GUI IR 0.9 Menu '${menu.title}' contains an invalid entry.`);
        }
        if (item.shortcut === null || item.shortcut === undefined) continue;
        const shortcut = validateShortcutObject(item.shortcut, item.id);
        const identity = menuShortcutIdentity(shortcut);
        if (shortcuts.has(identity)) {
          throw new NativeGuiError(
            `Native GUI IR 0.9 reuses Menu shortcut '${identity}' for '${item.id}' and '${shortcuts.get(identity)}' in one application.`
          );
        }
        shortcuts.set(identity, item.id);
      }
    }
  }

  validateNativeGuiIRV08(toV08Compatible(ir));
  return ir;
}

export function flattenNativeGuiControlsV09(ir) {
  validateNativeGuiIRV09(ir);
  return flattenNativeGuiControlsV08(toV08Compatible(ir));
}

export function flattenNativeGuiMenuItemsV09(ir) {
  validateNativeGuiIRV09(ir);
  const out = [];
  for (let formIndex = 0; formIndex < ir.forms.length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (let menuIndex = 0; menuIndex < (form.menus ?? []).length; menuIndex += 1) {
      const menu = form.menus[menuIndex];
      for (let itemIndex = 0; itemIndex < menu.items.length; itemIndex += 1) {
        const item = menu.items[itemIndex];
        if (item.type !== 'menuItem') continue;
        out.push({
          ...item,
          formIndex,
          menuIndex,
          itemIndex,
          menuTitle: menu.title,
          nativeIndex: out.length
        });
      }
    }
  }
  return out;
}

export function flattenNativeGuiMenuEntriesV09(ir) {
  validateNativeGuiIRV09(ir);
  const out = [];
  for (let formIndex = 0; formIndex < ir.forms.length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (let menuIndex = 0; menuIndex < (form.menus ?? []).length; menuIndex += 1) {
      const menu = form.menus[menuIndex];
      for (let itemIndex = 0; itemIndex < menu.items.length; itemIndex += 1) {
        out.push({
          ...menu.items[itemIndex],
          formIndex,
          menuIndex,
          itemIndex,
          menuTitle: menu.title,
          entryIndex: out.length
        });
      }
    }
  }
  return out;
}

export function toV08Compatible(ir) {
  const compatible = structuredClone(ir);
  compatible.version = '0.8';
  const usedIds = collectIrUiIds(compatible);
  let separatorOrdinal = 0;
  for (let formIndex = 0; formIndex < (compatible.forms ?? []).length; formIndex += 1) {
    const form = compatible.forms[formIndex];
    for (let menuIndex = 0; menuIndex < (form.menus ?? []).length; menuIndex += 1) {
      const menu = form.menus[menuIndex];
      menu.items = (menu.items ?? []).map((item, itemIndex) => {
        if (item.type === 'menuSeparator') {
          const id = uniqueCompatSeparatorId(usedIds, ++separatorOrdinal, formIndex, menuIndex, itemIndex);
          usedIds.add(id);
          return {
            type: 'menuItem',
            id,
            text: `__patch_v09_separator_${separatorOrdinal}`
          };
        }
        const { shortcut: _shortcut, ...rest } = item;
        return rest;
      });
    }
  }
  return compatible;
}

function parseShortcut(expr, line) {
  try {
    return parseMenuShortcutExpression(expr, line);
  } catch (error) {
    throw new NativeGuiError(error.message);
  }
}

function validateShortcutObject(shortcut, id) {
  if (!shortcut || typeof shortcut !== 'object' || typeof shortcut.key !== 'string') {
    throw new NativeGuiError(`Native GUI IR 0.9 MenuItem '${id}' has invalid shortcut metadata.`);
  }
  let parsed;
  try {
    parsed = parseMenuShortcut(menuShortcutIdentity(shortcut));
  } catch (error) {
    throw new NativeGuiError(`Native GUI IR 0.9 MenuItem '${id}' has invalid shortcut metadata: ${error.message}`);
  }
  if (
    Boolean(parsed.primary) !== Boolean(shortcut.primary) ||
    Boolean(parsed.shift) !== Boolean(shortcut.shift) ||
    Boolean(parsed.alt) !== Boolean(shortcut.alt) ||
    parsed.key !== shortcut.key ||
    parsed.display !== shortcut.display
  ) {
    throw new NativeGuiError(`Native GUI IR 0.9 MenuItem '${id}' has non-canonical shortcut metadata.`);
  }
  return parsed;
}

function collectUiIds(ast) {
  const ids = new Set();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.id) ids.add(node.id);
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  return ids;
}

function collectIrUiIds(ir) {
  const ids = new Set();
  const controls = controlsList => {
    for (const control of controlsList ?? []) {
      if (control.id) ids.add(control.id);
      if (control.type === 'tabs') for (const page of control.pages ?? []) controls(page.controls);
    }
  };
  for (const form of ir.forms ?? []) {
    controls(form.controls);
    for (const menu of form.menus ?? []) {
      for (const item of menu.items ?? []) if (item.id) ids.add(item.id);
    }
  }
  return ids;
}

function uniqueSeparatorId(usedIds, ordinal) {
  let suffix = ordinal;
  let id = `__patch_menu_separator_v09_${suffix}`;
  while (usedIds.has(id)) id = `__patch_menu_separator_v09_${++suffix}`;
  return id;
}

function uniqueCompatSeparatorId(usedIds, ordinal, formIndex, menuIndex, itemIndex) {
  let suffix = ordinal;
  let id = `__patch_v09_separator_${formIndex}_${menuIndex}_${itemIndex}_${suffix}`;
  while (usedIds.has(id)) id = `__patch_v09_separator_${formIndex}_${menuIndex}_${itemIndex}_${++suffix}`;
  return id;
}
