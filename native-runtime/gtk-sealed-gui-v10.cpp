// Patch sealed GTK3 GUI runtime v1.0.
// Payload v9 adds real GtkTreeView/GtkListStore Table widgets while preserving
// runtime-v0.9 accessibility and responsive Anchor/Dock behavior.
#include <gtk/gtk.h>
#include <atk/atk.h>
#include <fstream>

#define main PatchSealedRuntimeV09Main
#include "gtk-sealed-gui-v09.cpp"
#undef main
#include "sealed-table-v10.hpp"

static std::vector<PatchTableV10> gPatchTablesV10;
static std::vector<GtkWidget*> gPatchTableViewsV10;
static std::vector<std::string> gPatchLastTableRowV10;
static int gPatchTableSelectionCountV10=0;

static bool ReadSelfPayloadV10(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path,std::ios::binary|std::ios::ate); if (!file) return false;
  std::streamoff size=file.tellg(); if (size<20) return false;
  file.seekg(size-20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer),20);
  if (!file || memcmp(footer,PATCH_MAGIC,8)!=0) return false;
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);
  if (version!=9 || !length || (uint64_t)length>(uint64_t)(size-20)) return false;
  file.seekg(size-20-(std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()),(std::streamsize)length);
  return file && Crc32(payload.data(),payload.size())==crc;
}

static bool PatchResolveTablesV10() {
  for (const auto& table:gPatchTablesV10) {
    if (table.nativeIndex<0 || table.nativeIndex>=(int)gControls.size()) return false;
    auto it=gControlById.find(table.id);
    if (it==gControlById.end() || it->second!=table.nativeIndex) return false;
    auto& c=gControls[(size_t)table.nativeIndex];
    if (c.kind!=CK_LISTBOX || c.binding!=table.shadowState) return false;
  }
  return true;
}

static const PatchTableV10* PatchTableForIndexV10(int index) { return PatchFindTableV10(gPatchTablesV10,index); }

static void PatchDispatchTableV10(int controlIndex,int row) {
  const PatchTableV10* table=PatchTableForIndexV10(controlIndex);
  if (!table || gRefreshing || row<0 || row>=(int)table->rows.size()) return;
  gPatchLastTableRowV10=table->rows[(size_t)row];
  ++gPatchTableSelectionCountV10;
  for (const auto& event:gEvents) if (event.control==table->id && event.kind==EV_CHANGED) ExecuteEvent(event,false,{});
}

static void OnPatchTableChangedV10(GtkTreeSelection* selection,gpointer data) {
  if (gRefreshing || !selection) return;
  GtkTreeModel* model=nullptr; GtkTreeIter iter;
  if (!gtk_tree_selection_get_selected(selection,&model,&iter) || !model) return;
  GtkTreePath* path=gtk_tree_model_get_path(model,&iter);
  int row=-1;
  if (path && gtk_tree_path_get_depth(path)>0) {
    int* indices=gtk_tree_path_get_indices(path);
    if (indices) row=indices[0];
  }
  if (path) gtk_tree_path_free(path);
  PatchDispatchTableV10(GPOINTER_TO_INT(data),row);
}

static bool PatchInstallTableV10(const PatchTableV10& table) {
  auto& c=gControls[(size_t)table.nativeIndex];
  auto& form=gForms[(size_t)c.formIndex];
  GtkWidget* parent=nullptr;
  if (c.parentTabIndex>=0) {
    if (c.parentTabIndex>=(int)gTabPages.size() || c.pageIndex<0 || c.pageIndex>=(int)gTabPages[(size_t)c.parentTabIndex].size()) return false;
    parent=gTabPages[(size_t)c.parentTabIndex][(size_t)c.pageIndex];
  } else parent=form.fixed;
  if (!parent || !GTK_IS_FIXED(parent)) return false;
  if (c.widget) gtk_widget_destroy(c.widget);

  std::vector<GType> types(table.columns.size(),G_TYPE_STRING);
  GtkListStore* store=gtk_list_store_newv((gint)types.size(),types.data());
  if (!store) return false;
  for (const auto& row:table.rows) {
    GtkTreeIter iter; gtk_list_store_append(store,&iter);
    for (guint column=0;column<(guint)row.size();++column) {
      GValue value=G_VALUE_INIT; g_value_init(&value,G_TYPE_STRING); g_value_set_string(&value,row[column].c_str());
      gtk_list_store_set_value(store,&iter,(gint)column,&value); g_value_unset(&value);
    }
  }
  GtkWidget* view=gtk_tree_view_new_with_model(GTK_TREE_MODEL(store));
  g_object_unref(store);
  if (!view) return false;
  for (gint column=0;column<(gint)table.columns.size();++column) {
    GtkCellRenderer* renderer=gtk_cell_renderer_text_new();
    GtkTreeViewColumn* treeColumn=gtk_tree_view_column_new_with_attributes(table.columns[(size_t)column].c_str(),renderer,"text",column,nullptr);
    gtk_tree_view_append_column(GTK_TREE_VIEW(view),treeColumn);
  }
  GtkTreeSelection* selection=gtk_tree_view_get_selection(GTK_TREE_VIEW(view));
  gtk_tree_selection_set_mode(selection,GTK_SELECTION_SINGLE);
  g_signal_connect(selection,"changed",G_CALLBACK(OnPatchTableChangedV10),GINT_TO_POINTER(table.nativeIndex));

  GtkWidget* wrapper=gtk_scrolled_window_new(nullptr,nullptr);
  gtk_scrolled_window_set_policy(GTK_SCROLLED_WINDOW(wrapper),GTK_POLICY_AUTOMATIC,GTK_POLICY_AUTOMATIC);
  gtk_container_add(GTK_CONTAINER(wrapper),view);
  gtk_widget_set_size_request(wrapper,c.width,c.height);
  gtk_fixed_put(GTK_FIXED(parent),wrapper,c.x,c.y);
  c.widget=wrapper; c.kind=9;
  gPatchTableViewsV10[(size_t)table.nativeIndex]=view;
  return true;
}

static bool PatchInstallTablesV10() {
  gPatchTableViewsV10.assign(gControls.size(),nullptr);
  for (const auto& table:gPatchTablesV10) if (!PatchInstallTableV10(table)) return false;
  return true;
}

static void ApplyPatchTableAccessibilityV10() {
  for (const auto& table:gPatchTablesV10) {
    GtkWidget* view=gPatchTableViewsV10[(size_t)table.nativeIndex];
    if (!view) continue;
    PatchSetAccessibleNameV09(view,PatchControlNameV09(gControls[(size_t)table.nativeIndex]));
  }
}

static int RunPatchTableAccessibilitySmokeV10() {
  int code=210;
  for (const auto& table:gPatchTablesV10) {
    GtkWidget* view=gPatchTableViewsV10[(size_t)table.nativeIndex];
    if (!view || PatchReadAccessibleNameV09(view)!=PatchControlNameV09(gControls[(size_t)table.nativeIndex])) return code++;
  }
  return 0;
}

static int RunPatchTableSmokeV10() {
  int code=220;
  for (const auto& table:gPatchTablesV10) {
    auto& c=gControls[(size_t)table.nativeIndex];
    GtkWidget* view=gPatchTableViewsV10[(size_t)table.nativeIndex];
    if (!c.widget || !GTK_IS_SCROLLED_WINDOW(c.widget) || !view || !GTK_IS_TREE_VIEW(view) || c.kind!=9) return code++;
    if (gtk_tree_view_get_n_columns(GTK_TREE_VIEW(view))!=(gint)table.columns.size()) return code++;
    GtkTreeModel* model=gtk_tree_view_get_model(GTK_TREE_VIEW(view));
    if (!model || gtk_tree_model_iter_n_children(model,nullptr)!=(gint)table.rows.size()) return code++;
    if (table.rows.empty()) return code++;
    const int row=(int)table.rows.size()-1;
    const int before=gPatchTableSelectionCountV10;
    GtkTreePath* path=gtk_tree_path_new_from_indices(row,-1);
    gtk_tree_selection_select_path(gtk_tree_view_get_selection(GTK_TREE_VIEW(view)),path);
    gtk_tree_path_free(path);
    while (gtk_events_pending()) gtk_main_iteration();
    if (gPatchTableSelectionCountV10<=before) return code++;
    if (gPatchLastTableRowV10!=table.rows[(size_t)row]) return code++;
    auto status=gStateByName.find("status");
    if (status!=gStateByName.end() && gStates[(size_t)status->second].text!="selected") return code++;
  }
  return 0;
}

int main(int argc,char* argv[]) {
  gSmokeMode=HasArg(argc,argv,"--patch-smoke");
  std::vector<uint8_t> payloadV9,payloadV8,payloadV7;
  if (!ReadSelfPayloadV10(payloadV9) || !PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10) ||
      !PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size()!=gControls.size() || !PatchResolveTablesV10()) return 22;
  gtk_init(&argc,&argv);
  if (!CreateForms() || !PatchInstallTablesV10()) return 21;
  for (int index=0;index<(int)gForms.size();++index) if (gForms[(size_t)index].fixed) {
    g_signal_connect(gForms[(size_t)index].fixed,"size-allocate",G_CALLBACK(OnPatchFormAllocateV09),GINT_TO_POINTER(index));
  }
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10();
  RefreshUI();
  for (auto& f:gForms) if (f.visible) gtk_widget_show_all(f.window);
  while (gtk_events_pending()) gtk_main_iteration();
  if (gSmokeMode) {
    int result=RunSmoke();
    if (!result) result=RunPatchAccessibilitySmokeV09();
    if (!result) result=RunPatchTableAccessibilitySmokeV10();
    if (!result) result=RunPatchResponsiveSmokeV09();
    if (!result) result=RunPatchTableSmokeV10();
    return result;
  }
  gtk_main(); return 0;
}
