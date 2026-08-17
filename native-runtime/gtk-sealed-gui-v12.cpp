// Patch sealed GTK3 GUI runtime v1.2.
// Payload v11 layers Menu separators, portable shortcuts and source-backed
// enabled/checked state over the proven payload-v10/runtime-v1.1 core.
#include <gtk/gtk.h>
#include <gdk/gdkkeysyms.h>
#include <algorithm>
#include <fstream>
#include <vector>

#define PATCH_RUNTIME_V11_RESTORE_MAIN PatchRuntimeV11CompatibilityMain
#include "gtk-sealed-gui-v11.cpp"
#undef main
#undef PATCH_RUNTIME_V11_RESTORE_MAIN
#include "sealed-menu-v12.hpp"

static std::vector<PatchMenuEntryV12> gPatchMenuEntriesV12;
static std::vector<GtkAccelGroup*> gPatchAccelGroupsV12;

static bool ReadSelfPayloadV12(std::vector<uint8_t>& payload){
  std::string path;if(!SelfPath(path))return false;
  std::ifstream file(path,std::ios::binary|std::ios::ate);if(!file)return false;
  std::streamoff size=file.tellg();if(size<20)return false;
  file.seekg(size-20);uint8_t footer[20]{};file.read(reinterpret_cast<char*>(footer),20);
  if(!file||memcmp(footer,PATCH_MAGIC,8)!=0)return false;
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);
  if(version!=11||!length||(uint64_t)length>(uint64_t)(size-20))return false;
  file.seekg(size-20-(std::streamoff)length);payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()),(std::streamsize)length);
  return file&&Crc32(payload.data(),payload.size())==crc;
}

static bool PatchBooleanStateV12(const std::string& name,bool fallback=true){
  if(name.empty())return fallback;
  auto it=gStateByName.find(name);if(it==gStateByName.end())return fallback;
  const auto& state=gStates[(size_t)it->second];
  return state.type==ST_BOOLEAN?state.boolean:fallback;
}

static const PatchMenuEntryV12* PatchMenuMetaForNativeItemV12(int nativeItemIndex){
  for(const auto& entry:gPatchMenuEntriesV12)if(entry.type==1&&entry.nativeItemIndex==nativeItemIndex)return &entry;
  return nullptr;
}

static GtkWidget* PatchNativeMenuV12(uint32_t formIndex,uint32_t menuIndex){
  if(formIndex>=gForms.size()||menuIndex>=gForms[(size_t)formIndex].menus.size())return nullptr;
  const auto& menu=gForms[(size_t)formIndex].menus[(size_t)menuIndex];if(menu.items.empty())return nullptr;
  const int nativeIndex=menu.items.front();
  if(nativeIndex<0||nativeIndex>=(int)gMenuItems.size()||!gMenuItems[(size_t)nativeIndex].widget)return nullptr;
  GtkWidget* parent=gtk_widget_get_parent(gMenuItems[(size_t)nativeIndex].widget);
  return parent&&GTK_IS_MENU_SHELL(parent)?parent:nullptr;
}

static guint PatchGtkKeyV12(const std::string& key){
  if(key.size()==1){
    char ch=key[0];if(ch>='A'&&ch<='Z')ch=(char)(ch-'A'+'a');
    gchar name[2]={ch,'\0'};return gdk_keyval_from_name(name);
  }
  if(key.size()>=2&&key[0]=='F')return gdk_keyval_from_name(key.c_str());
  return 0;
}

static GdkModifierType PatchGtkModifiersV12(const PatchMenuEntryV12& entry){
  guint flags=0;
  if(entry.modifiers&1)flags|=GDK_CONTROL_MASK;
  if(entry.modifiers&2)flags|=GDK_SHIFT_MASK;
  if(entry.modifiers&4)flags|=GDK_MOD1_MASK;
  return static_cast<GdkModifierType>(flags);
}

static bool PatchMenuEnabledV12(int nativeItemIndex){
  const auto* meta=PatchMenuMetaForNativeItemV12(nativeItemIndex);
  return !meta||meta->enabledState.empty()||PatchBooleanStateV12(meta->enabledState,false);
}

static void PatchRefreshMenusV12(){
  const bool previous=gRefreshing;gRefreshing=true;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type!=1||entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size())continue;
    GtkWidget* item=gMenuItems[(size_t)entry.nativeItemIndex].widget;if(!item)continue;
    if(!entry.enabledState.empty())gtk_widget_set_sensitive(item,PatchBooleanStateV12(entry.enabledState,false)?TRUE:FALSE);
    if(!entry.checkedState.empty()&&GTK_IS_CHECK_MENU_ITEM(item))gtk_check_menu_item_set_active(GTK_CHECK_MENU_ITEM(item),PatchBooleanStateV12(entry.checkedState,false)?TRUE:FALSE);
  }
  gRefreshing=previous;
}

static bool PatchInstallMenusV12(){
  gPatchAccelGroupsV12.assign(gForms.size(),nullptr);
  std::vector<const PatchMenuEntryV12*> separators;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type==2)separators.push_back(&entry);
    if(entry.type==1&&entry.hasShortcut){
      if(entry.formIndex>=gForms.size()||!gForms[(size_t)entry.formIndex].window)return false;
      if(!gPatchAccelGroupsV12[(size_t)entry.formIndex]){
        GtkAccelGroup* group=gtk_accel_group_new();if(!group)return false;
        gtk_window_add_accel_group(GTK_WINDOW(gForms[(size_t)entry.formIndex].window),group);
        gPatchAccelGroupsV12[(size_t)entry.formIndex]=group;
      }
    }
  }
  std::sort(separators.begin(),separators.end(),[](const auto* a,const auto* b){
    if(a->formIndex!=b->formIndex)return a->formIndex<b->formIndex;
    if(a->menuIndex!=b->menuIndex)return a->menuIndex<b->menuIndex;
    return a->entryIndex<b->entryIndex;
  });
  for(const auto* entry:separators){
    GtkWidget* menu=PatchNativeMenuV12(entry->formIndex,entry->menuIndex);if(!menu)return false;
    GtkWidget* separator=gtk_separator_menu_item_new();if(!separator)return false;
    gtk_menu_shell_insert(GTK_MENU_SHELL(menu),separator,(gint)entry->entryIndex);
  }
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type!=1)continue;
    if(entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size())return false;
    auto& native=gMenuItems[(size_t)entry.nativeItemIndex];GtkWidget* item=native.widget;if(!item)return false;
    if(!entry.checkedState.empty()&&!GTK_IS_CHECK_MENU_ITEM(item)){
      GtkWidget* menu=gtk_widget_get_parent(item);if(!menu||!GTK_IS_MENU_SHELL(menu))return false;
      GtkWidget* replacement=gtk_check_menu_item_new_with_label(entry.text.c_str());if(!replacement)return false;
      gtk_check_menu_item_set_draw_as_radio(GTK_CHECK_MENU_ITEM(replacement),FALSE);
      gtk_container_remove(GTK_CONTAINER(menu),item);
      gtk_menu_shell_insert(GTK_MENU_SHELL(menu),replacement,(gint)entry.entryIndex);
      native.widget=replacement;item=replacement;
    }
    if(entry.hasShortcut){
      if(entry.formIndex>=gPatchAccelGroupsV12.size()||!gPatchAccelGroupsV12[(size_t)entry.formIndex])return false;
      const guint key=PatchGtkKeyV12(entry.key);if(!key)return false;
      gtk_widget_add_accelerator(item,"activate",gPatchAccelGroupsV12[(size_t)entry.formIndex],key,PatchGtkModifiersV12(entry),GTK_ACCEL_VISIBLE);
    }
  }
  PatchRefreshMenusV12();
  return true;
}

static void PatchDestroyMenusV12(){
  for(size_t form=0;form<gPatchAccelGroupsV12.size();++form){
    GtkAccelGroup* group=gPatchAccelGroupsV12[form];if(!group)continue;
    if(form<gForms.size()&&gForms[form].window)gtk_window_remove_accel_group(GTK_WINDOW(gForms[form].window),group);
    g_object_unref(group);
  }
  gPatchAccelGroupsV12.clear();
}

static void PatchDispatchMenuV12(int index){
  if(!PatchMenuEnabledV12(index))return;
  PatchDispatchMenuV11(index);PatchRefreshMenusV12();
}

static void PatchOnClickedV12(GtkWidget* widget,gpointer data){PatchOnClickedV11(widget,data);PatchRefreshMenusV12();}
static void PatchOnToggledV12(GtkToggleButton* widget,gpointer data){PatchOnToggledV11(widget,data);PatchRefreshMenusV12();}
static void PatchOnRadioV12(GtkToggleButton* widget,gpointer data){PatchOnRadioV11(widget,data);PatchRefreshMenusV12();}
static void PatchOnInputV12(GtkEditable* widget,gpointer data){PatchOnInputV11(widget,data);PatchRefreshMenusV12();}
static void PatchOnComboV12(GtkComboBox* widget,gpointer data){PatchOnComboV11(widget,data);PatchRefreshMenusV12();}
static void PatchOnListSingleV12(GtkListBox* box,GtkListBoxRow* row,gpointer data){PatchOnListSingleV11(box,row,data);PatchRefreshMenusV12();}
static void PatchOnListMultiV12(GtkListBox* box,gpointer data){PatchOnListMultiV11(box,data);PatchRefreshMenusV12();}
static void PatchOnMenuV12(GtkWidget*,gpointer data){PatchDispatchMenuV12(GPOINTER_TO_INT(data));}
static void PatchOnTableChangedV12(GtkTreeSelection* selection,gpointer data){OnPatchTableChangedV10(selection,data);PatchRefreshMenusV12();}

static bool PatchRewireEventsV12(){
  for(int index=0;index<(int)gControls.size();++index){
    auto& c=gControls[(size_t)index];if(c.kind==9)continue;gpointer data=GINT_TO_POINTER(index);
    if(c.kind==CK_BUTTON){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)PatchOnClickedV11,data);g_signal_connect(c.widget,"clicked",G_CALLBACK(PatchOnClickedV12),data);}
    else if(c.kind==CK_CHECKBOX){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)PatchOnToggledV11,data);g_signal_connect(c.widget,"toggled",G_CALLBACK(PatchOnToggledV12),data);}
    else if(c.kind==CK_INPUT){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)PatchOnInputV11,data);g_signal_connect(c.widget,"changed",G_CALLBACK(PatchOnInputV12),data);}
    else if(c.kind==CK_COMBO){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)PatchOnComboV11,data);g_signal_connect(c.widget,"changed",G_CALLBACK(PatchOnComboV12),data);}
    else if(c.kind==CK_LISTBOX){const bool multi=PatchFindListBoxV11(gPatchListBoxesV11,c.id)!=nullptr;if(multi){g_signal_handlers_disconnect_by_func(c.widget,(gpointer)PatchOnListMultiV11,data);g_signal_connect(c.widget,"selected-rows-changed",G_CALLBACK(PatchOnListMultiV12),data);}else{g_signal_handlers_disconnect_by_func(c.widget,(gpointer)PatchOnListSingleV11,data);g_signal_connect(c.widget,"row-selected",G_CALLBACK(PatchOnListSingleV12),data);}}
    else if(c.kind==CK_RADIO){for(GtkWidget* item:c.radioItems){g_signal_handlers_disconnect_by_func(item,(gpointer)PatchOnRadioV11,data);g_signal_connect(item,"toggled",G_CALLBACK(PatchOnRadioV12),data);}}
  }
  for(int index=0;index<(int)gMenuItems.size();++index){
    auto& item=gMenuItems[(size_t)index];if(!item.widget)continue;gpointer data=GINT_TO_POINTER(index);
    g_signal_handlers_disconnect_by_func(item.widget,(gpointer)PatchOnMenuV11,data);
    g_signal_connect(item.widget,"activate",G_CALLBACK(PatchOnMenuV12),data);
  }
  return true;
}

static bool PatchRewireTableEventsV12(){
  for(const auto& table:gPatchTablesV10){
    if(table.nativeIndex<0||table.nativeIndex>=(int)gPatchTableViewsV10.size())return false;
    GtkWidget* view=gPatchTableViewsV10[(size_t)table.nativeIndex];if(!view||!GTK_IS_TREE_VIEW(view))return false;
    GtkTreeSelection* selection=gtk_tree_view_get_selection(GTK_TREE_VIEW(view));if(!selection)return false;
    gpointer data=GINT_TO_POINTER(table.nativeIndex);
    g_signal_handlers_disconnect_by_func(selection,(gpointer)OnPatchTableChangedV10,data);
    g_signal_connect(selection,"changed",G_CALLBACK(PatchOnTableChangedV12),data);
  }
  return true;
}

static int RunPatchMenuSmokeV12(){
  int code=260;
  const PatchMenuEntryV12* enabledEntry=nullptr;const PatchMenuEntryV12* checkedEntry=nullptr;const PatchMenuEntryV12* separator=nullptr;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type==2)separator=&entry;
    if(entry.type==1&&!entry.enabledState.empty())enabledEntry=&entry;
    if(entry.type==1&&!entry.checkedState.empty())checkedEntry=&entry;
  }
  if(!enabledEntry||!checkedEntry||!separator)return code++;
  GtkWidget* menu=PatchNativeMenuV12(separator->formIndex,separator->menuIndex);if(!menu)return code++;
  GList* children=gtk_container_get_children(GTK_CONTAINER(menu));
  if(g_list_length(children)!=4){g_list_free(children);return code++;}
  GtkWidget* separatorWidget=GTK_WIDGET(g_list_nth_data(children,(guint)separator->entryIndex));
  const bool validSeparator=separatorWidget&&GTK_IS_SEPARATOR_MENU_ITEM(separatorWidget);g_list_free(children);if(!validSeparator)return code++;
  GtkWidget* enabledItem=gMenuItems[(size_t)enabledEntry->nativeItemIndex].widget;if(!enabledItem||gtk_widget_get_sensitive(enabledItem))return code++;
  PatchDispatchMenuV12(enabledEntry->nativeItemIndex);if(PatchBooleanStateV12(enabledEntry->enabledState,false))return code++;
  auto enableAction=gMenuItemById.find("enable_advanced");if(enableAction==gMenuItemById.end())return code++;
  PatchDispatchMenuV12(enableAction->second);if(!gtk_widget_get_sensitive(enabledItem)||!PatchMenuEnabledV12(enabledEntry->nativeItemIndex))return code++;
  GtkWidget* checkedItem=gMenuItems[(size_t)checkedEntry->nativeItemIndex].widget;if(!checkedItem||!GTK_IS_CHECK_MENU_ITEM(checkedItem)||gtk_check_menu_item_get_active(GTK_CHECK_MENU_ITEM(checkedItem)))return code++;
  PatchDispatchMenuV12(checkedEntry->nativeItemIndex);if(!PatchBooleanStateV12(checkedEntry->checkedState,false)||!gtk_check_menu_item_get_active(GTK_CHECK_MENU_ITEM(checkedItem)))return code++;
  if(enabledEntry->hasShortcut&&(enabledEntry->formIndex>=gPatchAccelGroupsV12.size()||!gPatchAccelGroupsV12[(size_t)enabledEntry->formIndex]))return code++;
  if(checkedEntry->hasShortcut&&(checkedEntry->formIndex>=gPatchAccelGroupsV12.size()||!gPatchAccelGroupsV12[(size_t)checkedEntry->formIndex]))return code++;
  return 0;
}

int main(int argc,char* argv[]){
  gSmokeMode=HasArg(argc,argv,"--patch-smoke");
  std::vector<uint8_t> payloadV11,payloadV10,payloadV9,payloadV8,payloadV7;
  if(!ReadSelfPayloadV12(payloadV11)||!PatchConvertPayloadV11ToV10(payloadV11,payloadV10,gPatchMenuEntriesV12)||!PatchConvertPayloadV10ToV9(payloadV10,payloadV9,gPatchListStatesV11,gPatchListBoxesV11,gPatchListEventsV11)||!PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10)||!PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09)||!ParsePayload(payloadV7))return 20;
  if(gPatchLayoutPoliciesV09.size()!=gControls.size()||!PatchResolveTablesV10()||!PatchResolveListsV11())return 22;
  PatchSyncListShadowsV11();gtk_init(&argc,&argv);
  if(!CreateForms()||!PatchInstallTablesV10()||!PatchRewireEventsV11()||!PatchInstallMenusV12()||!PatchRewireEventsV12()||!PatchRewireTableEventsV12())return 21;
  for(int index=0;index<(int)gForms.size();++index)if(gForms[(size_t)index].fixed)g_signal_connect(gForms[(size_t)index].fixed,"size-allocate",G_CALLBACK(OnPatchFormAllocateV09),GINT_TO_POINTER(index));
  ApplyPatchAccessibilityV09();ApplyPatchTableAccessibilityV10();RefreshUI();PatchRefreshListsV11();PatchRefreshMenusV12();
  for(auto& f:gForms)if(f.visible)gtk_widget_show_all(f.window);while(gtk_events_pending())gtk_main_iteration();
  if(gSmokeMode){int result=RunSmoke();if(!result)result=RunPatchAccessibilitySmokeV09();if(!result)result=RunPatchTableAccessibilitySmokeV10();if(!result)result=RunPatchResponsiveSmokeV09();if(!result)result=RunPatchTableSmokeV10();if(!result)result=RunPatchListSmokeV11();if(!result)result=RunPatchMenuSmokeV12();PatchDestroyMenusV12();return result;}
  gtk_main();PatchDestroyMenusV12();return 0;
}
