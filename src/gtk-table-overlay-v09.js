import { NativeGuiError } from './native-gui-ir.js';
import { nativeAccessibleName } from './native-accessibility.js';

/** Apply Native GUI IR 0.8 Table structure to backend-v0.8 GTK output. */
export function applyGtkTableOverlayV09(source, adapted, eventIndexes) {
  source = replaceRequired(
    source,
    `static GtkWidget *gControls[${Math.max(1, adapted.controls.length)}] = {};`,
    `static GtkWidget *gControls[${Math.max(1, adapted.controls.length)}] = {};\nstatic GtkWidget *gTableViews[${Math.max(1, adapted.controls.length)}] = {};`,
    'GTK Table view storage'
  );

  for (const table of adapted.tables) {
    source = removeShadowState(source, table);
    source = removeShadowRefresh(source, table);
    source = replaceRequired(source, legacyListBoxCreate(adapted, table), tableCreate(adapted, table), `GTK Table '${table.id}' creation`);
    const eventIndex = eventIndexes.get(table.id);
    if (eventIndex !== undefined) {
      source = replaceRequired(source, `static void Event_${eventIndex}(const std::string& eventValue) {`, `static void Event_${eventIndex}(const std::vector<std::string>& eventValue) {`, `GTK Table '${table.id}' event signature`);
      source = replaceRequired(
        source,
        `  if (commandId == ${1000 + table.nativeIndex}) { if (!row) { Event_${eventIndex}(std::string()); return; } GtkWidget *child = gtk_bin_get_child(GTK_BIN(row)); const char *value = child ? gtk_label_get_text(GTK_LABEL(child)) : ""; Event_${eventIndex}(value ? std::string(value) : std::string()); return; }\n`,
        '',
        `GTK Table '${table.id}' legacy ListBox dispatch`
      );
    }
  }

  source = replaceRequired(source, 'static void OnListChanged(GtkListBox *box, GtkListBoxRow *row, gpointer data) {', `${tableHelpers(adapted, eventIndexes)}\nstatic void OnListChanged(GtkListBox *box, GtkListBoxRow *row, gpointer data) {`, 'GTK Table callback insertion');
  source = injectSmoke(source, adapted);
  assertNoShadowState(source, adapted);
  return source;
}

function tableHelpers(adapted, eventIndexes) {
  const rowFunctions = adapted.tables.map(table => {
    const cases = table.rows.map((row, rowIndex) => `    case ${rowIndex}: return {${row.map(cString).join(', ')}};`).join('\n');
    return `static std::vector<std::string> PatchTableRow_${table.nativeIndex}(int row) {\n  switch (row) {\n${cases}\n    default: return {};\n  }\n}`;
  }).join('\n');
  const dispatch = adapted.tables.map(table => {
    const eventIndex = eventIndexes.get(table.id);
    const call = eventIndex === undefined ? '' : ` Event_${eventIndex}(PatchTableRow_${table.nativeIndex}(row));`;
    return `  if (commandId == ${1000 + table.nativeIndex}) {\n    GtkTreeModel *model = nullptr; GtkTreeIter iter; if (!gtk_tree_selection_get_selected(selection, &model, &iter)) return;\n    GtkTreePath *path = gtk_tree_model_get_path(model, &iter); int row = path && gtk_tree_path_get_depth(path) > 0 ? gtk_tree_path_get_indices(path)[0] : -1; if (path) gtk_tree_path_free(path);\n    if (row >= 0) { ++gPatchTableSelectionCount;${call} } return;\n  }`;
  }).join('\n');
  return `${rowFunctions}\nstatic int gPatchTableSelectionCount = 0;\nstatic void OnTableChanged(GtkTreeSelection *selection, gpointer data) {\n  if (gRefreshing) return; int commandId = GPOINTER_TO_INT(data);\n${dispatch}\n}`;
}

function tableCreate(adapted, table) {
  const control = adapted.controls[table.nativeIndex];
  const x = layoutInt(control.layout?.x, control.parentTabIndex >= 0 ? 12 : 24);
  const y = layoutInt(control.layout?.y, control.parentTabIndex >= 0 ? 12 : 24);
  const width = positiveInt(control.layout?.width, 400);
  const height = positiveInt(control.layout?.height, 180);
  const parentPut = control.parentTabIndex >= 0
    ? `GtkWidget *parent = gTabPages[${control.parentTabIndex}].at(${control.pageIndex}); gtk_fixed_put(GTK_FIXED(parent), control, ${x}, ${y});`
    : `gtk_fixed_put(GTK_FIXED(fixed), control, ${x}, ${y});`;
  const types = table.columns.map(() => 'G_TYPE_STRING').join(', ');
  const columns = table.columns.map((title, index) => `    { GtkCellRenderer *renderer = gtk_cell_renderer_text_new(); GtkTreeViewColumn *column = gtk_tree_view_column_new_with_attributes(${cString(title)}, renderer, "text", ${index}, nullptr); gtk_tree_view_append_column(GTK_TREE_VIEW(view), column); }`).join('\n');
  const rows = table.rows.map(row => `    { GtkTreeIter iter; gtk_list_store_append(store, &iter); gtk_list_store_set(store, &iter, ${row.map((value, index) => `${index}, ${cString(value)}`).join(', ')}, -1); }`).join('\n');
  const accessible = nativeAccessibleName(control) ?? table.id;
  return `  if (${control.formIndex} == index) {\n    GtkListStore *store = gtk_list_store_new(${table.columns.length}, ${types});\n${rows}\n    GtkWidget *view = gtk_tree_view_new_with_model(GTK_TREE_MODEL(store)); g_object_unref(store);\n${columns}\n    GtkTreeSelection *selection = gtk_tree_view_get_selection(GTK_TREE_VIEW(view)); gtk_tree_selection_set_mode(selection, GTK_SELECTION_SINGLE); g_signal_connect(selection, "changed", G_CALLBACK(OnTableChanged), GINT_TO_POINTER(${1000 + table.nativeIndex}));\n    GtkWidget *control = gtk_scrolled_window_new(nullptr, nullptr); gtk_scrolled_window_set_policy(GTK_SCROLLED_WINDOW(control), GTK_POLICY_AUTOMATIC, GTK_POLICY_AUTOMATIC); gtk_container_add(GTK_CONTAINER(control), view); gtk_widget_set_size_request(control, ${width}, ${height});\n    ${parentPut}\n    gControls[${table.nativeIndex}] = control; gTableViews[${table.nativeIndex}] = view; AtkObject *tableAccessible = gtk_widget_get_accessible(view); if (tableAccessible) atk_object_set_name(tableAccessible, ${cString(accessible)});\n  }`;
}

function legacyListBoxCreate(adapted, table) {
  const control = adapted.controls[table.nativeIndex];
  const x = layoutInt(control.layout?.x, control.parentTabIndex >= 0 ? 12 : 24);
  const y = layoutInt(control.layout?.y, control.parentTabIndex >= 0 ? 12 : 24);
  const width = positiveInt(control.layout?.width, 400);
  const height = positiveInt(control.layout?.height, 180);
  const put = control.parentTabIndex >= 0
    ? `GtkWidget *parent = gTabPages[${control.parentTabIndex}].at(${control.pageIndex}); gtk_fixed_put(GTK_FIXED(parent), control, ${x}, ${y});`
    : `gtk_fixed_put(GTK_FIXED(fixed), control, ${x}, ${y});`;
  return `  if (${control.formIndex} == index) {\n    GtkWidget *control = gtk_list_box_new(); gtk_list_box_set_selection_mode(GTK_LIST_BOX(control), GTK_SELECTION_SINGLE); GtkWidget *label_${table.nativeIndex}_0 = gtk_label_new("__patch_table_row_0"); gtk_widget_set_halign(label_${table.nativeIndex}_0, GTK_ALIGN_START); gtk_widget_set_margin_start(label_${table.nativeIndex}_0, 8); gtk_widget_set_margin_end(label_${table.nativeIndex}_0, 8); gtk_widget_set_margin_top(label_${table.nativeIndex}_0, 5); gtk_widget_set_margin_bottom(label_${table.nativeIndex}_0, 5); gtk_list_box_insert(GTK_LIST_BOX(control), label_${table.nativeIndex}_0, -1); GtkWidget *label_${table.nativeIndex}_1 = gtk_label_new("__patch_table_row_1"); gtk_widget_set_halign(label_${table.nativeIndex}_1, GTK_ALIGN_START); gtk_widget_set_margin_start(label_${table.nativeIndex}_1, 8); gtk_widget_set_margin_end(label_${table.nativeIndex}_1, 8); gtk_widget_set_margin_top(label_${table.nativeIndex}_1, 5); gtk_widget_set_margin_bottom(label_${table.nativeIndex}_1, 5); gtk_list_box_insert(GTK_LIST_BOX(control), label_${table.nativeIndex}_1, -1);\n    gtk_widget_set_size_request(control, ${width}, ${height});\n    ${put}\n    g_signal_connect(control, "row-selected", G_CALLBACK(OnListChanged), GINT_TO_POINTER(${1000 + table.nativeIndex}));\n    gControls[${table.nativeIndex}] = control;\n  }`;
}

function removeShadowState(source, table) {
  return replaceRequired(source, `static std::string patch_state_${identifier(table.shadowState)} = "__patch_table_row_0";\n`, '', `GTK Table '${table.id}' shadow state`);
}
function removeShadowRefresh(source, table) {
  const state = `patch_state_${identifier(table.shadowState)}`;
  const marker = `  if (gControls[${table.nativeIndex}]) { int selected = -1; if (${state} == "__patch_table_row_0") selected = 0; else if (${state} == "__patch_table_row_1") selected = 1; GtkListBoxRow *row = selected >= 0 ? gtk_list_box_get_row_at_index(GTK_LIST_BOX(gControls[${table.nativeIndex}]), selected) : nullptr; gtk_list_box_select_row(GTK_LIST_BOX(gControls[${table.nativeIndex}]), row); }\n`;
  return replaceRequired(source, marker, '', `GTK Table '${table.id}' shadow refresh`);
}

function injectSmoke(source, adapted) {
  const checks = [];
  let code = 150;
  for (const table of adapted.tables) {
    const last = Math.max(0, table.rows.length - 1);
    checks.push(`  if (!gControls[${table.nativeIndex}] || !GTK_IS_SCROLLED_WINDOW(gControls[${table.nativeIndex}]) || !gTableViews[${table.nativeIndex}] || gtk_tree_view_get_n_columns(GTK_TREE_VIEW(gTableViews[${table.nativeIndex}])) != ${table.columns.length}) return ${code++};`);
    checks.push(`  { GtkTreeModel *model = gtk_tree_view_get_model(GTK_TREE_VIEW(gTableViews[${table.nativeIndex}])); if (!model || gtk_tree_model_iter_n_children(model, nullptr) != ${table.rows.length}) return ${code++}; int before = gPatchTableSelectionCount; GtkTreePath *path = gtk_tree_path_new_from_indices(${last}, -1); gtk_tree_selection_select_path(gtk_tree_view_get_selection(GTK_TREE_VIEW(gTableViews[${table.nativeIndex}])), path); gtk_tree_path_free(path); if (gPatchTableSelectionCount <= before) return ${code++}; }`);
  }
  const start = source.indexOf('static int RunPatchSmoke() {');
  let index = source.indexOf('  gtk_widget_destroy(gForms[', start);
  if (index < 0) index = source.indexOf('  return 0;', start);
  if (index < 0) throw new NativeGuiError('Generated GTK source is missing Table smoke insertion point.');
  return source.slice(0, index) + checks.join('\n') + '\n' + source.slice(index);
}

function assertNoShadowState(source, adapted) { for (const table of adapted.tables) if (source.includes(table.shadowState)) throw new NativeGuiError(`GTK Table '${table.id}' leaked backend shadow state.`); }
function replaceRequired(source, marker, replacement, label) { if (!source.includes(marker)) throw new NativeGuiError(`${label} marker is missing from generated GTK source.`); return source.replace(marker, replacement); }
function identifier(value) { return String(value).replace(/[^A-Za-z0-9_]/g, '_').replace(/^[0-9]/, '_$&'); }
function layoutInt(value, fallback) { return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback; }
function positiveInt(value, fallback) { return Number.isFinite(Number(value)) ? Math.max(1, Math.round(Number(value))) : fallback; }
function cString(value) { return JSON.stringify(String(value ?? '')); }
