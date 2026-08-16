import { NativeGuiError } from './native-gui-ir.js';
import { adaptNativeMenusForLegacyBackend } from './native-menu-backend-adapter.js';
import {
  validateNativeGuiIRV10,
  toV09Compatible,
  flattenNativeGuiMenuItemsV10
} from './native-gui-ir-v10.js';

/**
 * Adapt Native GUI IR 1.0 to the 0.9 shape consumed by backend 1.0 while
 * retaining source-backed menu state metadata by exact structural position.
 */
export function adaptNativeMenuStateForV10Backend(input) {
  const ir = validateNativeGuiIRV10(input);
  const compatibleIr = toV09Compatible(ir);
  const legacy = adaptNativeMenusForLegacyBackend(compatibleIr);
  const items = flattenNativeGuiMenuItemsV10(ir);
  const itemByPosition = new Map(
    items.map(item => [`${item.formIndex}:${item.menuIndex}:${item.itemIndex}`, item])
  );

  const entries = legacy.entries.map(entry => {
    if (entry.type !== 'menuItem') return entry;
    const stateItem = itemByPosition.get(`${entry.formIndex}:${entry.menuIndex}:${entry.itemIndex}`);
    if (!stateItem) {
      throw new NativeGuiError(
        `Native menu state adapter lost MenuItem at ${entry.formIndex + 1}/${entry.menuIndex + 1}/${entry.itemIndex + 1}.`
      );
    }
    return {
      ...entry,
      enabledState: stateItem.enabledState ?? null,
      checkedState: stateItem.checkedState ?? null
    };
  });

  return {
    ir,
    compatibleIr,
    entries,
    menuItems: entries.filter(entry => entry.type === 'menuItem'),
    statefulItems: entries.filter(entry =>
      entry.type === 'menuItem' && (entry.enabledState || entry.checkedState)
    ),
    enabledItems: entries.filter(entry => entry.type === 'menuItem' && entry.enabledState),
    checkedItems: entries.filter(entry => entry.type === 'menuItem' && entry.checkedState)
  };
}
