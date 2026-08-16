// Patch sealed GTK3 GUI runtime v1.1.
// Payload v10 adds persistent text-list state and list-backed multi-select
// ListBox while preserving payload v9/runtime-v1.0 Table behavior.
#include <gtk/gtk.h>
#include <atk/atk.h>
#include <algorithm>
#include <fstream>

#define PATCH_GTK_RUNTIME_V09_ENTRY PatchSealedRuntimeV09Main
#include "gtk-sealed-gui-v09.cpp"
#undef PATCH_GTK_RUNTIME_V09_ENTRY
#include "sealed-table-v10.hpp"
#include "sealed-list-v11.hpp"

static std::vector<PatchTableV10> gPatchTablesV10;
static std::vector<GtkWidget*> gPatchTableViewsV10;
static std::vector<std::string> gPatchLastTableRowV10;
static int gPatchTableSelectionCountV10=0;

static std::vector<PatchListStateV11> gPatchListStatesV11;
static std::vector<PatchListBoxV11> gPatchListBoxesV11;
static std::vector<PatchListEventV11> gPatchListEventsV11;
static bool gPatchListRuntimeErrorV11=false;
static std::string gPatchListRuntimeErrorMessageV11;

static bool ReadSelfPayloadV11(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path,std::ios::binary|std::ios::ate); if (!file) return false;
  std::streamoff size=file.tellg(); if (size<20) return false;
  file.seekg(size-20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer),20);
  if (!file || memcmp(footer,PATCH_MAGIC,8)!=0) return false;
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);
  if (version!=10 || !length || (uint64_t)length>(uint64_t)(size-20)) return false;
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

static bool PatchResolveListsV11() {
  for (const auto& box:gPatchListBoxesV11) {
    if (box.nativeIndex<0 || box.nativeIndex>=(int)gControls.size()) return false;
    auto it=gControlById.find(box.id);
    if (it==gControlById.end() || it->second!=box.nativeIndex) return false;
    auto& c=gControls[(size_t)box.nativeIndex];
    if (c.kind!=CK_LISTBOX || c.binding!=box.binding) return false;
    auto state=gStateByName.find(box.binding);
    if (state==gStateByName.end() || gStates[(size_t)state->second].type!=ST_TEXT) return false;
    if (!PatchFindListStateV11(gPatchListStatesV11,box.binding)) return false;
  }
  return true;
}

static std::vector<std::string> PatchSelectedListValuesV11(const PatchListBoxV11& box) {
  std::vector<std::string> out;
  if (box.nativeIndex<0 || box.nativeIndex>=(int)gControls.size()) return out;
  auto& c=gControls[(size_t)box.nativeIndex];
  if (!c.widget || !GTK_IS_LIST_BOX(c.widget)) return out;
  GList* rows=gtk_list_box_get_selected_rows(GTK_LIST_BOX(c.widget));
  for (GList* item=rows;item;item=item->next) {
    auto* row=GTK_LIST_BOX_ROW(item->data);
    GtkWidget* child=row?gtk_bin_get_child(GTK_BIN(row)):nullptr;
    const char* value=child&&GTK_IS_LABEL(child)?gtk_label_get_text(GTK_LABEL(child)):nullptr;
    if(value)out.emplace_back(value);
  }
  g_list_free(rows);
  return out;
}

static void PatchSyncListShadowsV11() {
  for (const auto& state:gPatchListStatesV11) {
    auto it=gStateByName.find(state.name);
    if (it!=gStateByName.end()) gStates[(size_t)it->second].text=state.value.empty()?std::string():state.value.front();
  }
}

static void PatchRefreshListsV11() {
  const bool previous=gRefreshing; gRefreshing=true;
  for (const auto& box:gPatchListBoxesV11) {
    if (box.nativeIndex<0 || box.nativeIndex>=(int)gControls.size()) continue;
    auto& c=gControls[(size_t)box.nativeIndex];
    auto* state=PatchFindListStateV11(gPatchListStatesV11,box.binding);
    if (!state || !c.widget || !GTK_IS_LIST_BOX(c.widget)) continue;
    gtk_list_box_unselect_all(GTK_LIST_BOX(c.widget));
    for (size_t index=0;index<c.options.size();++index) {
      if (std::find(state->value.begin(),state->value.end(),c.options[index])==state->value.end()) continue;
      GtkListBoxRow* row=gtk_list_box_get_row_at_index(GTK_LIST_BOX(c.widget),(gint)index);
      if(row)gtk_list_box_select_row(GTK_LIST_BOX(c.widget),row);
    }
  }
  gRefreshing=previous;
}

static void PatchReportListErrorV11(const std::string& message) {
  gPatchListRuntimeErrorV11=true; gPatchListRuntimeErrorMessageV11=message;
  if (gSmokeMode) return;
  GtkWidget* dialog=gtk_message_dialog_new(nullptr,GTK_DIALOG_MODAL,GTK_MESSAGE_ERROR,GTK_BUTTONS_OK,"%s",message.c_str());
  gtk_window_set_title(GTK_WINDOW(dialog),"Patch stopped"); gtk_dialog_run(GTK_DIALOG(dialog)); gtk_widget_destroy(dialog);
}

static bool PatchApplyListActionV11(const PatchListActionV11& action,const std::vector<std::string>* eventList) {
  auto* state=PatchFindListStateV11(gPatchListStatesV11,action.target); if(!state)return false;
  for (const auto& op:action.ops) {
    if(op.op==4){state->value.clear();continue;}
    if(op.op==1){
      if(op.valueKind==2){if(!eventList)return false;state->value=*eventList;}
      else if(op.valueKind==1)state->value=op.listValue;
      else return false;
      continue;
    }
    if(op.valueKind!=1)return false;
    if(op.op==2){state->value.push_back(op.textValue);continue;}
    if(op.op==3){auto it=std::find(state->value.begin(),state->value.end(),op.textValue);if(it==state->value.end()){PatchReportListErrorV11("Cannot remove "+op.textValue+" because it is not in the list.");return false;}state->value.erase(it);continue;}
    return false;
  }
  return true;
}

static const PatchListActionV11* PatchListActionAtV11(const PatchListEventV11* meta,uint32_t index) {
  if(!meta)return nullptr; for(const auto& action:meta->actions)if(action.actionIndex==index)return &action; return nullptr;
}

static void PatchExecuteEventV11(const Event& event,bool eventBool,const std::string& eventText,const std::vector<std::string>* eventList=nullptr);

static void PatchDispatchResultV11(const std::string& id,uint8_t kind,const std::string& value={}) {
  for(const auto& event:gEvents)if(event.control==id&&event.kind==kind)PatchExecuteEventV11(event,false,value,nullptr);
}

static void PatchExecuteEventV11(const Event& event,bool eventBool,const std::string& eventText,const std::vector<std::string>* eventList) {
  const auto* meta=PatchFindListEventV11(gPatchListEventsV11,event.control,event.kind);
  for(uint32_t index=0;index<(uint32_t)event.actions.size();++index) {
    if(const auto* listAction=PatchListActionAtV11(meta,index)) {
      if(!PatchApplyListActionV11(*listAction,eventList)) { if(!gPatchListRuntimeErrorV11)PatchReportListErrorV11("Invalid sealed list operation."); return; }
      continue;
    }
    const auto& action=event.actions[index];
    if(action.kind==ACT_OPEN){auto& w=gForms[gFormById[action.form]];gtk_widget_show_all(w.window);gtk_window_present(GTK_WINDOW(w.window));}
    else if(action.kind==ACT_CLOSE)gtk_widget_hide(gForms[gFormById[action.form]].window);
    else if(action.kind==ACT_DIALOG)ShowInfoDialog(action);
    else if(action.kind==ACT_CONFIRM){bool accepted=ShowConfirmDialog(action);gLastResultSource=action.id;gLastResultValue.clear();gLastResultEvent=accepted?EV_CONFIRMED:EV_CANCELLED;PatchDispatchResultV11(action.id,accepted?EV_CONFIRMED:EV_CANCELLED);}
    else if(action.kind==ACT_OPEN_FILE||action.kind==ACT_SAVE_FILE){std::string value;bool chosen=ShowFileDialog(action,value);gLastResultSource=action.id;gLastResultValue=chosen?value:std::string();gLastResultEvent=chosen?EV_CHOSEN:EV_CANCELLED;PatchDispatchResultV11(action.id,chosen?EV_CHOSEN:EV_CANCELLED,chosen?value:std::string());}
    else if(action.kind==ACT_CHANGE){State& state=gStates[gStateByName[action.target]];for(const auto& op:action.ops)ApplyOperation(state,op,eventBool,eventText);}
  }
  PatchSyncListShadowsV11(); RefreshUI(); PatchRefreshListsV11();
}

static void PatchDispatchControlV11(int index,uint8_t kind,bool eventBool=false,const std::string& eventText={},const std::vector<std::string>* eventList=nullptr) {
  if(gRefreshing||index<0||index>=(int)gControls.size())return;auto& control=gControls[(size_t)index];if(control.id.empty())return;
  for(const auto& event:gEvents)if(event.control==control.id&&event.kind==kind)PatchExecuteEventV11(event,eventBool,eventText,eventList);
}
static void PatchDispatchMenuV11(int index){if(gRefreshing||index<0||index>=(int)gMenuItems.size())return;auto& item=gMenuItems[(size_t)index];for(const auto& event:gEvents)if(event.control==item.id&&event.kind==EV_CLICKED)PatchExecuteEventV11(event,false,{},nullptr);}

static void PatchOnClickedV11(GtkWidget*,gpointer data){PatchDispatchControlV11(GPOINTER_TO_INT(data),EV_CLICKED);}
static void PatchOnMenuV11(GtkWidget*,gpointer data){PatchDispatchMenuV11(GPOINTER_TO_INT(data));}
static void PatchOnToggledV11(GtkToggleButton* button,gpointer data){PatchDispatchControlV11(GPOINTER_TO_INT(data),EV_CHANGED,gtk_toggle_button_get_active(button),{});}
static void PatchOnRadioV11(GtkToggleButton* button,gpointer data){if(gRefreshing||!gtk_toggle_button_get_active(button))return;const char* value=gtk_button_get_label(GTK_BUTTON(button));PatchDispatchControlV11(GPOINTER_TO_INT(data),EV_CHANGED,false,value?value:"");}
static void PatchOnInputV11(GtkEditable* editable,gpointer data){const char* value=gtk_entry_get_text(GTK_ENTRY(editable));PatchDispatchControlV11(GPOINTER_TO_INT(data),EV_CHANGED,false,value?value:"");}
static void PatchOnComboV11(GtkComboBox* combo,gpointer data){gchar* value=gtk_combo_box_text_get_active_text(GTK_COMBO_BOX_TEXT(combo));PatchDispatchControlV11(GPOINTER_TO_INT(data),EV_CHANGED,false,value?value:"");if(value)g_free(value);}
static void PatchOnListSingleV11(GtkListBox*,GtkListBoxRow* row,gpointer data){std::string value;if(row){GtkWidget* child=gtk_bin_get_child(GTK_BIN(row));const char* text=child&&GTK_IS_LABEL(child)?gtk_label_get_text(GTK_LABEL(child)):nullptr;if(text)value=text;}PatchDispatchControlV11(GPOINTER_TO_INT(data),EV_CHANGED,false,value);}
static void PatchOnListMultiV11(GtkListBox*,gpointer data){const int index=GPOINTER_TO_INT(data);if(index<0||index>=(int)gControls.size())return;const auto* box=PatchFindListBoxV11(gPatchListBoxesV11,gControls[(size_t)index].id);if(!box)return;auto values=PatchSelectedListValuesV11(*box);PatchDispatchControlV11(index,EV_CHANGED,false,{},&values);}

static bool PatchRewireEventsV11() {
  for(int index=0;index<(int)gControls.size();++index) {
    auto& c=gControls[(size_t)index]; if(c.kind==9)continue;
    gpointer data=GINT_TO_POINTER(index);
    if(c.kind==CK_BUTTON){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)OnClicked,data);g_signal_connect(c.widget,"clicked",G_CALLBACK(PatchOnClickedV11),data);}
    else if(c.kind==CK_CHECKBOX){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)OnToggled,data);g_signal_connect(c.widget,"toggled",G_CALLBACK(PatchOnToggledV11),data);}
    else if(c.kind==CK_INPUT){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)OnInputChanged,data);g_signal_connect(c.widget,"changed",G_CALLBACK(PatchOnInputV11),data);}
    else if(c.kind==CK_COMBO){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)OnComboChanged,data);g_signal_connect(c.widget,"changed",G_CALLBACK(PatchOnComboV11),data);}
    else if(c.kind==CK_LISTBOX){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)OnListChanged,data);const bool multi=PatchFindListBoxV11(gPatchListBoxesV11,c.id)!=nullptr;if(multi){gtk_list_box_set_selection_mode(GTK_LIST_BOX(c.widget),GTK_SELECTION_MULTIPLE);g_signal_connect(c.widget,"selected-rows-changed",G_CALLBACK(PatchOnListMultiV11),data);}else g_signal_connect(c.widget,"row-selected",G_CALLBACK(PatchOnListSingleV11),data);}
    else if(c.kind==CK_RADIO){for(GtkWidget* item:c.radioItems){g_signal_handlers_disconnect_by_func(item,(gpointer)OnRadioToggled,data);g_signal_connect(item,"toggled",G_CALLBACK(PatchOnRadioV11),data);}}
  }
  for(int index=0;index<(int)gMenuItems.size();++index){auto& item=gMenuItems[(size_t)index];if(!item.widget)continue;gpointer data=GINT_TO_POINTER(index);g_signal_handlers_disconnect_by_func(item.widget,(gpointer)OnMenuActivated,data);g_signal_connect(item.widget,"activate",G_CALLBACK(PatchOnMenuV11),data);}
  return true;
}

static const PatchTableV10* PatchTableForIndexV10(int index) { return PatchFindTableV10(gPatchTablesV10,index); }
static void PatchDispatchTableV10(int controlIndex,int row) {
  const PatchTableV10* table=PatchTableForIndexV10(controlIndex);if(!table||gRefreshing||row<0||row>=(int)table->rows.size())return;
  gPatchLastTableRowV10=table->rows[(size_t)row];++gPatchTableSelectionCountV10;
  for(const auto& event:gEvents)if(event.control==table->id&&event.kind==EV_CHANGED)PatchExecuteEventV11(event,false,{},nullptr);
}
static void OnPatchTableChangedV10(GtkTreeSelection* selection,gpointer data) {
  if(gRefreshing||!selection)return;GtkTreeModel* model=nullptr;GtkTreeIter iter;if(!gtk_tree_selection_get_selected(selection,&model,&iter)||!model)return;GtkTreePath* path=gtk_tree_model_get_path(model,&iter);int row=-1;if(path&&gtk_tree_path_get_depth(path)>0){int* indices=gtk_tree_path_get_indices(path);if(indices)row=indices[0];}if(path)gtk_tree_path_free(path);PatchDispatchTableV10(GPOINTER_TO_INT(data),row);
}
static bool PatchInstallTableV10(const PatchTableV10& table) {
  auto& c=gControls[(size_t)table.nativeIndex];auto& form=gForms[(size_t)c.formIndex];GtkWidget* parent=nullptr;
  if(c.parentTabIndex>=0){if(c.parentTabIndex>=(int)gTabPages.size()||c.pageIndex<0||c.pageIndex>=(int)gTabPages[(size_t)c.parentTabIndex].size())return false;parent=gTabPages[(size_t)c.parentTabIndex][(size_t)c.pageIndex];}else parent=form.fixed;
  if(!parent||!GTK_IS_FIXED(parent))return false;if(c.widget)gtk_widget_destroy(c.widget);
  std::vector<GType> types(table.columns.size(),G_TYPE_STRING);GtkListStore* store=gtk_list_store_newv((gint)types.size(),types.data());if(!store)return false;
  for(const auto& row:table.rows){GtkTreeIter iter;gtk_list_store_append(store,&iter);for(guint column=0;column<(guint)row.size();++column){GValue value=G_VALUE_INIT;g_value_init(&value,G_TYPE_STRING);g_value_set_string(&value,row[column].c_str());gtk_list_store_set_value(store,&iter,(gint)column,&value);g_value_unset(&value);}}
  GtkWidget* view=gtk_tree_view_new_with_model(GTK_TREE_MODEL(store));g_object_unref(store);if(!view)return false;
  for(gint column=0;column<(gint)table.columns.size();++column){GtkCellRenderer* renderer=gtk_cell_renderer_text_new();GtkTreeViewColumn* treeColumn=gtk_tree_view_column_new_with_attributes(table.columns[(size_t)column].c_str(),renderer,"text",column,nullptr);gtk_tree_view_append_column(GTK_TREE_VIEW(view),treeColumn);}
  GtkTreeSelection* selection=gtk_tree_view_get_selection(GTK_TREE_VIEW(view));gtk_tree_selection_set_mode(selection,GTK_SELECTION_SINGLE);g_signal_connect(selection,"changed",G_CALLBACK(OnPatchTableChangedV10),GINT_TO_POINTER(table.nativeIndex));
  GtkWidget* wrapper=gtk_scrolled_window_new(nullptr,nullptr);gtk_scrolled_window_set_policy(GTK_SCROLLED_WINDOW(wrapper),GTK_POLICY_AUTOMATIC,GTK_POLICY_AUTOMATIC);gtk_container_add(GTK_CONTAINER(wrapper),view);gtk_widget_set_size_request(wrapper,c.width,c.height);gtk_fixed_put(GTK_FIXED(parent),wrapper,c.x,c.y);c.widget=wrapper;c.kind=9;gPatchTableViewsV10[(size_t)table.nativeIndex]=view;return true;
}
static bool PatchInstallTablesV10(){gPatchTableViewsV10.assign(gControls.size(),nullptr);for(const auto& table:gPatchTablesV10)if(!PatchInstallTableV10(table))return false;return true;}
static void ApplyPatchTableAccessibilityV10(){for(const auto& table:gPatchTablesV10){GtkWidget* view=gPatchTableViewsV10[(size_t)table.nativeIndex];if(view)PatchSetAccessibleNameV09(view,PatchControlNameV09(gControls[(size_t)table.nativeIndex]));}}
static int RunPatchTableAccessibilitySmokeV10(){int code=210;for(const auto& table:gPatchTablesV10){GtkWidget* view=gPatchTableViewsV10[(size_t)table.nativeIndex];if(!view||PatchReadAccessibleNameV09(view)!=PatchControlNameV09(gControls[(size_t)table.nativeIndex]))return code++;}return 0;}
static int RunPatchTableSmokeV10(){int code=220;for(const auto& table:gPatchTablesV10){auto& c=gControls[(size_t)table.nativeIndex];GtkWidget* view=gPatchTableViewsV10[(size_t)table.nativeIndex];if(!c.widget||!GTK_IS_SCROLLED_WINDOW(c.widget)||!view||!GTK_IS_TREE_VIEW(view)||c.kind!=9)return code++;if(gtk_tree_view_get_n_columns(GTK_TREE_VIEW(view))!=(gint)table.columns.size())return code++;GtkTreeModel* model=gtk_tree_view_get_model(GTK_TREE_VIEW(view));if(!model||gtk_tree_model_iter_n_children(model,nullptr)!=(gint)table.rows.size())return code++;if(table.rows.empty())return code++;const int row=(int)table.rows.size()-1;const int before=gPatchTableSelectionCountV10;GtkTreePath* path=gtk_tree_path_new_from_indices(row,-1);gtk_tree_selection_select_path(gtk_tree_view_get_selection(GTK_TREE_VIEW(view)),path);gtk_tree_path_free(path);while(gtk_events_pending())gtk_main_iteration();if(gPatchTableSelectionCountV10<=before)return code++;if(gPatchLastTableRowV10!=table.rows[(size_t)row])return code++;}return 0;}

static int RunPatchListSmokeV11() {
  int code=240;
  for(const auto& box:gPatchListBoxesV11){auto& c=gControls[(size_t)box.nativeIndex];auto* state=PatchFindListStateV11(gPatchListStatesV11,box.binding);if(!state||!c.widget||!GTK_IS_LIST_BOX(c.widget))return code++;if(gtk_list_box_get_selection_mode(GTK_LIST_BOX(c.widget))!=GTK_SELECTION_MULTIPLE)return code++;PatchRefreshListsV11();auto initial=PatchSelectedListValuesV11(box);if(initial!=state->value)return code++;if(c.options.size()<2)return code++;const bool previous=gRefreshing;gRefreshing=true;gtk_list_box_unselect_all(GTK_LIST_BOX(c.widget));GtkListBoxRow* first=gtk_list_box_get_row_at_index(GTK_LIST_BOX(c.widget),0);GtkListBoxRow* last=gtk_list_box_get_row_at_index(GTK_LIST_BOX(c.widget),(gint)c.options.size()-1);if(first)gtk_list_box_select_row(GTK_LIST_BOX(c.widget),first);if(last)gtk_list_box_select_row(GTK_LIST_BOX(c.widget),last);gRefreshing=previous;auto selected=PatchSelectedListValuesV11(box);PatchDispatchControlV11(box.nativeIndex,EV_CHANGED,false,{},&selected);if(gPatchListRuntimeErrorV11)return code++;if(state->value!=selected)return code++;auto projected=PatchSelectedListValuesV11(box);if(projected!=state->value)return code++;}
  return 0;
}

int main(int argc,char* argv[]) {
  gSmokeMode=HasArg(argc,argv,"--patch-smoke");
  std::vector<uint8_t> payloadV10,payloadV9,payloadV8,payloadV7;
  if(!ReadSelfPayloadV11(payloadV10)||!PatchConvertPayloadV10ToV9(payloadV10,payloadV9,gPatchListStatesV11,gPatchListBoxesV11,gPatchListEventsV11)||!PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10)||!PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09)||!ParsePayload(payloadV7))return 20;
  if(gPatchLayoutPoliciesV09.size()!=gControls.size()||!PatchResolveTablesV10()||!PatchResolveListsV11())return 22;
  PatchSyncListShadowsV11();gtk_init(&argc,&argv);
  if(!CreateForms()||!PatchInstallTablesV10()||!PatchRewireEventsV11())return 21;
  for(int index=0;index<(int)gForms.size();++index)if(gForms[(size_t)index].fixed)g_signal_connect(gForms[(size_t)index].fixed,"size-allocate",G_CALLBACK(OnPatchFormAllocateV09),GINT_TO_POINTER(index));
  ApplyPatchAccessibilityV09();ApplyPatchTableAccessibilityV10();RefreshUI();PatchRefreshListsV11();
  for(auto& f:gForms)if(f.visible)gtk_widget_show_all(f.window);while(gtk_events_pending())gtk_main_iteration();
  if(gSmokeMode){int result=RunSmoke();if(!result)result=RunPatchAccessibilitySmokeV09();if(!result)result=RunPatchTableAccessibilitySmokeV10();if(!result)result=RunPatchResponsiveSmokeV09();if(!result)result=RunPatchTableSmokeV10();if(!result)result=RunPatchListSmokeV11();return result;}
  gtk_main();return 0;
}
