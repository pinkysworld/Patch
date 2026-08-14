import { validateNativeGuiIR } from './native-gui-ir.js';
import {
  validateNativeGuiIRV08,
  flattenNativeGuiControlsV08,
  flattenNativeGuiMenuItemsV08
} from './native-gui-ir-v08.js';

/**
 * Adapt Native GUI IR 0.8 Table controls to the stable v0.7 backend surface.
 *
 * The returned `legacyIr` is an implementation-only input for the existing
 * backend v0.8 generators. Every Table becomes a private ListBox shadow with
 * a private text binding. Backend v0.9 wrappers must replace those shadows
 * with real platform Table widgets before the generated source is returned.
 */
export function adaptNativeTablesForLegacyBackend(input) {
  const ir = validateNativeGuiIRV08(structuredClone(input));
  const flattened = flattenNativeGuiControlsV08(ir);
  const tables = flattened
    .filter(control => control.type === 'table')
    .map(control => ({
      id: control.id,
      formIndex: control.formIndex,
      nativeIndex: control.nativeIndex,
      parentTabIndex: control.parentTabIndex,
      pageIndex: control.pageIndex,
      layout: structuredClone(control.layout),
      columns: [...control.columns],
      rows: control.rows.map(row => [...row]),
      shadowState: uniqueShadowState(ir, control.nativeIndex)
    }));
  const byId = new Map(tables.map(table => [table.id, table]));
  const byIndex = new Map(tables.map(table => [table.nativeIndex, table]));

  const legacyIr = structuredClone(ir);
  legacyIr.version = '0.7';

  const rewrite = controls => (controls ?? []).map(control => {
    if (control.type === 'tabs') {
      return {
        ...control,
        pages: control.pages.map(page => ({ ...page, controls: rewrite(page.controls) }))
      };
    }
    if (control.type !== 'table') return control;
    const table = byId.get(control.id);
    return {
      type: 'listbox',
      id: control.id,
      text: '',
      binding: table.shadowState,
      options: ['__patch_table_row_0', '__patch_table_row_1'],
      layout: structuredClone(control.layout)
    };
  });
  for (const form of legacyIr.forms) form.controls = rewrite(form.controls);

  for (const table of tables) {
    legacyIr.states.push({
      name: table.shadowState,
      type: 'text',
      initial: '__patch_table_row_0'
    });
  }

  for (const event of legacyIr.events) {
    if (!byId.has(event.control)) continue;
    event.valueType = 'text';
  }

  validateNativeGuiIR(legacyIr);
  return {
    ir,
    legacyIr,
    tables,
    tablesById: byId,
    tablesByNativeIndex: byIndex,
    controls: flattened,
    menuItems: flattenNativeGuiMenuItemsV08(ir)
  };
}

export function tableEventIndexById(ir) {
  const map = new Map();
  for (let index = 0; index < (ir.events ?? []).length; index += 1) {
    const event = ir.events[index];
    if (event.event === 'changed' && event.valueType === 'text-list') map.set(event.control, index);
  }
  return map;
}

function uniqueShadowState(ir, nativeIndex) {
  const used = new Set((ir.states ?? []).map(state => state.name));
  let suffix = nativeIndex + 1;
  let name = `__patch_native_table_shadow_${suffix}`;
  while (used.has(name)) name = `__patch_native_table_shadow_${++suffix}`;
  return name;
}
