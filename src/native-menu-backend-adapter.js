import { NativeGuiError } from './native-gui-ir.js';
import { flattenNativeGuiMenuItemsV08 } from './native-gui-ir-v08.js';
import {
  validateNativeGuiIRV09,
  toV08Compatible
} from './native-gui-ir-v09.js';

/**
 * Convert Native GUI IR 0.9 Menu decorations to the 0.8 structural shape used
 * by backend 0.9, while retaining exact entry-position metadata for overlays.
 */
export function adaptNativeMenusForLegacyBackend(input) {
  const ir = validateNativeGuiIRV09(input);
  const legacyIr = toV08Compatible(ir);
  const legacyItems = flattenNativeGuiMenuItemsV08(legacyIr);
  const legacyByPosition = new Map(
    legacyItems.map(item => [positionKey(item.formIndex, item.menuIndex, item.itemIndex), item])
  );
  const entries = [];

  for (let formIndex = 0; formIndex < ir.forms.length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (let menuIndex = 0; menuIndex < (form.menus ?? []).length; menuIndex += 1) {
      const menu = form.menus[menuIndex];
      for (let itemIndex = 0; itemIndex < menu.items.length; itemIndex += 1) {
        const item = menu.items[itemIndex];
        const legacy = legacyByPosition.get(positionKey(formIndex, menuIndex, itemIndex));
        if (!legacy) {
          throw new NativeGuiError(
            `Native menu backend adapter lost entry ${formIndex + 1}/${menuIndex + 1}/${itemIndex + 1}.`
          );
        }
        entries.push({
          ...item,
          formIndex,
          menuIndex,
          itemIndex,
          menuTitle: menu.title,
          legacyId: legacy.id,
          legacyText: legacy.text,
          legacyNativeIndex: legacy.nativeIndex,
          commandId: 20000 + legacy.nativeIndex
        });
      }
    }
  }

  return {
    ir,
    legacyIr,
    entries,
    separators: entries.filter(entry => entry.type === 'menuSeparator'),
    shortcuts: entries.filter(entry => entry.type === 'menuItem' && entry.shortcut)
  };
}

function positionKey(formIndex, menuIndex, itemIndex) {
  return `${formIndex}:${menuIndex}:${itemIndex}`;
}
