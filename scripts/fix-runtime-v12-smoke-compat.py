from pathlib import Path
import re

replacements = {
    'native-runtime/win32-sealed-gui-v12.cpp': r'''static int RunPatchMenuSmokeV12(){
  int code=260; bool hasDecorations=false;
  const PatchMenuEntryV12* enabledEntry=nullptr; const PatchMenuEntryV12* checkedEntry=nullptr; const PatchMenuEntryV12* separator=nullptr;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type==2){
      hasDecorations=true; separator=&entry;
      HMENU menu=PatchNativeMenuV12(entry.formIndex,entry.menuIndex); if(!menu)return code++;
      if(entry.entryIndex>=(uint32_t)GetMenuItemCount(menu))return code++;
      MENUITEMINFOW info{};info.cbSize=sizeof(info);info.fMask=MIIM_FTYPE;
      if(!GetMenuItemInfoW(menu,(UINT)entry.entryIndex,TRUE,&info)||(info.fType&MFT_SEPARATOR)==0)return code++;
      continue;
    }
    if(entry.type!=1||entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size())return code++;
    HMENU menu=PatchNativeMenuV12(entry.formIndex,entry.menuIndex); if(!menu)return code++;
    const auto& item=gMenuItems[(size_t)entry.nativeItemIndex];
    if(entry.hasShortcut){hasDecorations=true;if(entry.formIndex>=gPatchAcceleratorsV12.size()||!gPatchAcceleratorsV12[(size_t)entry.formIndex])return code++;}
    if(!entry.enabledState.empty()){
      hasDecorations=true; enabledEntry=&entry;
      const bool expected=PatchBooleanStateV12(entry.enabledState,false);
      if(PatchMenuEnabledV12(entry.nativeItemIndex)!=expected)return code++;
      const UINT state=GetMenuState(menu,(UINT)item.commandId,MF_BYCOMMAND);
      const bool nativeEnabled=(state&(MF_DISABLED|MF_GRAYED))==0;
      if(nativeEnabled!=expected)return code++;
    }
    if(!entry.checkedState.empty()){
      hasDecorations=true; checkedEntry=&entry;
      const bool expected=PatchBooleanStateV12(entry.checkedState,false);
      const bool nativeChecked=(GetMenuState(menu,(UINT)item.commandId,MF_BYCOMMAND)&MF_CHECKED)!=0;
      if(nativeChecked!=expected)return code++;
    }
  }
  if(!hasDecorations)return 0;
  auto enableAction=gMenuItemById.find(L"enable_advanced");
  auto advancedAction=gMenuItemById.find(L"advanced_action");
  auto pinAction=gMenuItemById.find(L"pin_item");
  if(enableAction!=gMenuItemById.end()&&advancedAction!=gMenuItemById.end()&&pinAction!=gMenuItemById.end()&&enabledEntry&&checkedEntry&&separator){
    PatchDispatchMenuV12(enabledEntry->nativeItemIndex); if(PatchBooleanStateV12(enabledEntry->enabledState,false))return code++;
    PatchDispatchMenuV12(enableAction->second); if(!PatchMenuEnabledV12(enabledEntry->nativeItemIndex))return code++;
    PatchDispatchMenuV12(checkedEntry->nativeItemIndex); if(!PatchBooleanStateV12(checkedEntry->checkedState,false))return code++;
    HMENU checkedMenu=PatchNativeMenuV12(checkedEntry->formIndex,checkedEntry->menuIndex); if(!checkedMenu)return code++;
    const auto& checkedItem=gMenuItems[(size_t)checkedEntry->nativeItemIndex];
    if((GetMenuState(checkedMenu,(UINT)checkedItem.commandId,MF_BYCOMMAND)&MF_CHECKED)==0)return code++;
  }
  return 0;
}
''',
    'native-runtime/appkit-sealed-gui-v12.mm': r'''static int RunPatchMenuSmokeV12(){
  int code=260; bool hasDecorations=false;
  const PatchMenuEntryV12* enabledEntry=nullptr;const PatchMenuEntryV12* checkedEntry=nullptr;const PatchMenuEntryV12* separator=nullptr;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type==2){
      hasDecorations=true;separator=&entry;
      NSMenu* menu=PatchNativeMenuV12(entry.formIndex,entry.menuIndex);if(!menu||entry.entryIndex>=(uint32_t)menu.numberOfItems)return code++;
      NSMenuItem* item=[menu itemAtIndex:(NSInteger)entry.entryIndex];if(!item||!item.separatorItem)return code++;
      continue;
    }
    if(entry.type!=1||entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size())return code++;
    NSMenuItem* item=gMenuItems[(size_t)entry.nativeItemIndex].widget;if(!item)return code++;
    if(entry.hasShortcut){hasDecorations=true;if(item.keyEquivalent.length==0)return code++;}
    if(!entry.enabledState.empty()){
      hasDecorations=true;enabledEntry=&entry;
      const bool expected=PatchBooleanStateV12(entry.enabledState,false);
      if((item.enabled==YES)!=expected||PatchMenuEnabledV12(entry.nativeItemIndex)!=expected)return code++;
    }
    if(!entry.checkedState.empty()){
      hasDecorations=true;checkedEntry=&entry;
      const bool expected=PatchBooleanStateV12(entry.checkedState,false);
      if((item.state==NSControlStateValueOn)!=expected)return code++;
    }
  }
  if(!hasDecorations)return 0;
  auto enableAction=gMenuItemById.find("enable_advanced");
  auto advancedAction=gMenuItemById.find("advanced_action");
  auto pinAction=gMenuItemById.find("pin_item");
  if(enableAction!=gMenuItemById.end()&&advancedAction!=gMenuItemById.end()&&pinAction!=gMenuItemById.end()&&enabledEntry&&checkedEntry&&separator){
    PatchDispatchMenuV12(enabledEntry->nativeItemIndex);if(PatchBooleanStateV12(enabledEntry->enabledState,false))return code++;
    PatchDispatchMenuV12(enableAction->second);
    NSMenuItem* enabledItem=gMenuItems[(size_t)enabledEntry->nativeItemIndex].widget;if(!enabledItem||!enabledItem.enabled)return code++;
    PatchDispatchMenuV12(checkedEntry->nativeItemIndex);
    NSMenuItem* checkedItem=gMenuItems[(size_t)checkedEntry->nativeItemIndex].widget;
    if(!PatchBooleanStateV12(checkedEntry->checkedState,false)||!checkedItem||checkedItem.state!=NSControlStateValueOn)return code++;
  }
  return 0;
}
''',
    'native-runtime/gtk-sealed-gui-v12.cpp': r'''static int RunPatchMenuSmokeV12(){
  int code=260; bool hasDecorations=false;
  const PatchMenuEntryV12* enabledEntry=nullptr;const PatchMenuEntryV12* checkedEntry=nullptr;const PatchMenuEntryV12* separator=nullptr;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type==2){
      hasDecorations=true;separator=&entry;
      GtkWidget* menu=PatchNativeMenuV12(entry.formIndex,entry.menuIndex);if(!menu)return code++;
      GList* children=gtk_container_get_children(GTK_CONTAINER(menu));
      GtkWidget* item=GTK_WIDGET(g_list_nth_data(children,(guint)entry.entryIndex));
      const bool valid=item&&GTK_IS_SEPARATOR_MENU_ITEM(item);g_list_free(children);if(!valid)return code++;
      continue;
    }
    if(entry.type!=1||entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size())return code++;
    GtkWidget* item=gMenuItems[(size_t)entry.nativeItemIndex].widget;if(!item)return code++;
    if(entry.hasShortcut){hasDecorations=true;if(entry.formIndex>=gPatchAccelGroupsV12.size()||!gPatchAccelGroupsV12[(size_t)entry.formIndex])return code++;}
    if(!entry.enabledState.empty()){
      hasDecorations=true;enabledEntry=&entry;
      const bool expected=PatchBooleanStateV12(entry.enabledState,false);
      if((gtk_widget_get_sensitive(item)!=FALSE)!=expected||PatchMenuEnabledV12(entry.nativeItemIndex)!=expected)return code++;
    }
    if(!entry.checkedState.empty()){
      hasDecorations=true;checkedEntry=&entry;
      if(!GTK_IS_CHECK_MENU_ITEM(item))return code++;
      const bool expected=PatchBooleanStateV12(entry.checkedState,false);
      if((gtk_check_menu_item_get_active(GTK_CHECK_MENU_ITEM(item))!=FALSE)!=expected)return code++;
    }
  }
  if(!hasDecorations)return 0;
  auto enableAction=gMenuItemById.find("enable_advanced");
  auto advancedAction=gMenuItemById.find("advanced_action");
  auto pinAction=gMenuItemById.find("pin_item");
  if(enableAction!=gMenuItemById.end()&&advancedAction!=gMenuItemById.end()&&pinAction!=gMenuItemById.end()&&enabledEntry&&checkedEntry&&separator){
    PatchDispatchMenuV12(enabledEntry->nativeItemIndex);if(PatchBooleanStateV12(enabledEntry->enabledState,false))return code++;
    PatchDispatchMenuV12(enableAction->second);
    GtkWidget* enabledItem=gMenuItems[(size_t)enabledEntry->nativeItemIndex].widget;if(!enabledItem||!gtk_widget_get_sensitive(enabledItem))return code++;
    PatchDispatchMenuV12(checkedEntry->nativeItemIndex);
    GtkWidget* checkedItem=gMenuItems[(size_t)checkedEntry->nativeItemIndex].widget;
    if(!PatchBooleanStateV12(checkedEntry->checkedState,false)||!checkedItem||!GTK_IS_CHECK_MENU_ITEM(checkedItem)||!gtk_check_menu_item_get_active(GTK_CHECK_MENU_ITEM(checkedItem)))return code++;
  }
  return 0;
}
'''
}

pattern = re.compile(r'static int RunPatchMenuSmokeV12\(\)\{.*?\n\}\n\n(?=(?:int WINAPI wWinMain|int main))', re.S)
for file, replacement in replacements.items():
    path = Path(file)
    text = path.read_text()
    updated, count = pattern.subn(replacement + '\n', text, count=1)
    if count != 1:
        raise SystemExit(f'{file}: expected exactly one Menu smoke function, found {count}')
    path.write_text(updated)
