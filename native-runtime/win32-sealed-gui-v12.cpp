// Patch sealed Win32 GUI runtime v1.2.
// Payload v11 layers Menu separators, portable shortcuts and source-backed
// enabled/checked state over the proven payload-v10/runtime-v1.1 core.
#include <windows.h>
#include <commctrl.h>
#include <algorithm>
#include <fstream>
#include <vector>

#define wWinMain PatchRuntimeV11CompatibilityMain
#include "win32-sealed-gui-v11.cpp"
#undef wWinMain
#include "sealed-menu-v12.hpp"

static std::vector<PatchMenuEntryV12> gPatchMenuEntriesV12;
static std::vector<HACCEL> gPatchAcceleratorsV12;

static bool ReadSelfPayloadV12(std::vector<uint8_t>& payload){
  wchar_t path[MAX_PATH]; DWORD n=GetModuleFileNameW(nullptr,path,MAX_PATH); if(!n||n>=MAX_PATH)return false;
  HANDLE file=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr); if(file==INVALID_HANDLE_VALUE)return false;
  LARGE_INTEGER size{}; if(!GetFileSizeEx(file,&size)||size.QuadPart<20){CloseHandle(file);return false;}
  LARGE_INTEGER pos{}; pos.QuadPart=size.QuadPart-20; if(!SetFilePointerEx(file,pos,nullptr,FILE_BEGIN)){CloseHandle(file);return false;}
  uint8_t footer[20]{}; DWORD got=0; if(!ReadFile(file,footer,20,&got,nullptr)||got!=20||memcmp(footer,PATCH_MAGIC,8)!=0){CloseHandle(file);return false;}
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);
  if(version!=11||!length||(uint64_t)length>(uint64_t)(size.QuadPart-20)){CloseHandle(file);return false;}
  pos.QuadPart=size.QuadPart-20-length; if(!SetFilePointerEx(file,pos,nullptr,FILE_BEGIN)){CloseHandle(file);return false;}
  payload.resize(length); got=0; BOOL ok=ReadFile(file,payload.data(),length,&got,nullptr); CloseHandle(file);
  return ok&&got==length&&Crc32(payload.data(),payload.size())==crc;
}

static bool PatchBooleanStateV12(const std::string& name,bool fallback=true){
  if(name.empty())return fallback;
  auto it=gStateByName.find(PatchWideV11(name));
  if(it==gStateByName.end())return fallback;
  const auto& state=gStates[(size_t)it->second];
  return state.type==ST_BOOLEAN?state.boolean:fallback;
}

static const PatchMenuEntryV12* PatchMenuMetaForNativeItemV12(int nativeItemIndex){
  for(const auto& entry:gPatchMenuEntriesV12)if(entry.type==1&&entry.nativeItemIndex==nativeItemIndex)return &entry;
  return nullptr;
}

static HMENU PatchNativeMenuV12(uint32_t formIndex,uint32_t menuIndex){
  if(formIndex>=gForms.size())return nullptr;
  HMENU root=GetMenu(gForms[(size_t)formIndex].hwnd); if(!root)return nullptr;
  return GetSubMenu(root,(int)menuIndex);
}

static std::wstring PatchShortcutDisplayV12(const PatchMenuEntryV12& entry){
  if(!entry.hasShortcut)return L"";
  std::wstring text;
  if(entry.modifiers&1)text+=L"Ctrl+";
  if(entry.modifiers&2)text+=L"Shift+";
  if(entry.modifiers&4)text+=L"Alt+";
  text+=PatchWideV11(entry.key);
  return text;
}

static WORD PatchVirtualKeyV12(const std::string& key){
  if(key.size()==1){const char ch=key[0];if((ch>='A'&&ch<='Z')||(ch>='0'&&ch<='9'))return(WORD)ch;}
  if(key.size()>=2&&key[0]=='F'){
    int number=0; for(size_t i=1;i<key.size();++i){if(key[i]<'0'||key[i]>'9')return 0;number=number*10+(key[i]-'0');}
    if(number>=1&&number<=12)return(WORD)(VK_F1+number-1);
  }
  return 0;
}

static bool PatchMenuEnabledV12(int nativeItemIndex){
  const auto* meta=PatchMenuMetaForNativeItemV12(nativeItemIndex);
  return !meta||meta->enabledState.empty()||PatchBooleanStateV12(meta->enabledState,false);
}

static void PatchRefreshMenusV12(){
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type!=1||entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size())continue;
    HMENU menu=PatchNativeMenuV12(entry.formIndex,entry.menuIndex); if(!menu)continue;
    const auto& item=gMenuItems[(size_t)entry.nativeItemIndex];
    UINT enabled=entry.enabledState.empty()||PatchBooleanStateV12(entry.enabledState,false)?MF_ENABLED:MF_GRAYED;
    EnableMenuItem(menu,(UINT)item.commandId,MF_BYCOMMAND|enabled);
    if(!entry.checkedState.empty())CheckMenuItem(menu,(UINT)item.commandId,MF_BYCOMMAND|(PatchBooleanStateV12(entry.checkedState,false)?MF_CHECKED:MF_UNCHECKED));
  }
  for(auto& form:gForms)if(form.hwnd)DrawMenuBar(form.hwnd);
}

static bool PatchInstallMenusV12(){
  gPatchAcceleratorsV12.assign(gForms.size(),nullptr);
  std::vector<std::vector<ACCEL>> accelerators(gForms.size());

  // The v10 core created only real MenuItems. Insert separators back at their
  // exact source positions before decorating item labels and accelerator state.
  std::vector<const PatchMenuEntryV12*> separators;
  for(const auto& entry:gPatchMenuEntriesV12)if(entry.type==2)separators.push_back(&entry);
  std::sort(separators.begin(),separators.end(),[](const auto* a,const auto* b){
    if(a->formIndex!=b->formIndex)return a->formIndex<b->formIndex;
    if(a->menuIndex!=b->menuIndex)return a->menuIndex<b->menuIndex;
    return a->entryIndex<b->entryIndex;
  });
  for(const auto* entry:separators){
    HMENU menu=PatchNativeMenuV12(entry->formIndex,entry->menuIndex); if(!menu)return false;
    if(!InsertMenuW(menu,(UINT)entry->entryIndex,MF_BYPOSITION|MF_SEPARATOR,0,nullptr))return false;
  }

  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type!=1)continue;
    if(entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size()||entry.formIndex>=gForms.size())return false;
    HMENU menu=PatchNativeMenuV12(entry.formIndex,entry.menuIndex); if(!menu)return false;
    const auto& item=gMenuItems[(size_t)entry.nativeItemIndex];
    std::wstring label=item.text;
    if(entry.hasShortcut){
      std::wstring display=PatchShortcutDisplayV12(entry); if(display.empty())return false;
      label+=L"\t"+display;
      WORD key=PatchVirtualKeyV12(entry.key); if(!key)return false;
      ACCEL accel{}; accel.fVirt=FVIRTKEY;
      if(entry.modifiers&1)accel.fVirt|=FCONTROL;
      if(entry.modifiers&2)accel.fVirt|=FSHIFT;
      if(entry.modifiers&4)accel.fVirt|=FALT;
      accel.key=key; accel.cmd=(WORD)item.commandId;
      accelerators[(size_t)entry.formIndex].push_back(accel);
    }
    MENUITEMINFOW info{}; info.cbSize=sizeof(info); info.fMask=MIIM_STRING; info.dwTypeData=label.data();
    if(!SetMenuItemInfoW(menu,(UINT)item.commandId,FALSE,&info))return false;
  }

  for(size_t form=0;form<accelerators.size();++form){
    auto& entries=accelerators[form];
    if(entries.empty())continue;
    gPatchAcceleratorsV12[form]=CreateAcceleratorTableW(entries.data(),(int)entries.size());
    if(!gPatchAcceleratorsV12[form])return false;
  }
  PatchRefreshMenusV12();
  return true;
}

static void PatchDestroyMenusV12(){for(auto table:gPatchAcceleratorsV12)if(table)DestroyAcceleratorTable(table);gPatchAcceleratorsV12.clear();}

static void PatchDispatchMenuV12(int index){
  if(!PatchMenuEnabledV12(index))return;
  PatchDispatchMenuV11(index);
  PatchRefreshMenusV12();
}

static LRESULT CALLBACK PatchWndProcV12(HWND hwnd,UINT msg,WPARAM wParam,LPARAM lParam){
  if(msg==WM_COMMAND){
    int id=LOWORD(wParam),notification=HIWORD(wParam); HWND eventHwnd=reinterpret_cast<HWND>(lParam);
    if(notification==0&&eventHwnd==nullptr){
      for(int i=0;i<(int)gMenuItems.size();++i)if(gMenuItems[(size_t)i].commandId==id){PatchDispatchMenuV12(i);return 0;}
    }
    for(int i=0;i<(int)gControls.size();++i){
      auto& c=gControls[(size_t)i]; if(c.commandId!=id)continue;
      if(c.kind==CK_BUTTON&&notification==BN_CLICKED)PatchDispatchControlV11(i,EV_CLICKED,eventHwnd);
      else if(c.kind==CK_CHECKBOX&&notification==BN_CLICKED)PatchDispatchControlV11(i,EV_CHANGED,eventHwnd);
      else if(c.kind==CK_RADIO&&notification==BN_CLICKED)PatchDispatchControlV11(i,EV_CHANGED,eventHwnd);
      else if(c.kind==CK_INPUT&&notification==EN_CHANGE)PatchDispatchControlV11(i,EV_CHANGED,eventHwnd);
      else if(c.kind==CK_COMBO&&notification==CBN_SELCHANGE)PatchDispatchControlV11(i,EV_CHANGED,eventHwnd);
      else if(c.kind==CK_LISTBOX&&notification==LBN_SELCHANGE)PatchDispatchControlV11(i,EV_CHANGED,eventHwnd);
      PatchRefreshMenusV12(); break;
    }
    return 0;
  }
  if(msg==WM_NOTIFY){
    if(PatchHandleTableNotifyV10(reinterpret_cast<NMHDR*>(lParam))){PatchRefreshMenusV12();return 0;}
    if(HandleTabNotify(reinterpret_cast<NMHDR*>(lParam)))return 0;
  }
  return PatchWndProcV09(hwnd,msg,wParam,lParam);
}

static bool PatchTranslateAcceleratorV12(MSG& msg){
  for(size_t form=0;form<gPatchAcceleratorsV12.size();++form){
    HACCEL table=gPatchAcceleratorsV12[form]; if(!table||form>=gForms.size()||!gForms[form].hwnd)continue;
    if(TranslateAcceleratorW(gForms[form].hwnd,table,&msg))return true;
  }
  return false;
}

static int RunPatchMenuSmokeV12(){
  int code=260;
  const PatchMenuEntryV12* enabledEntry=nullptr; const PatchMenuEntryV12* checkedEntry=nullptr; const PatchMenuEntryV12* separator=nullptr;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type==2)separator=&entry;
    if(entry.type==1&&!entry.enabledState.empty())enabledEntry=&entry;
    if(entry.type==1&&!entry.checkedState.empty())checkedEntry=&entry;
  }
  if(!enabledEntry||!checkedEntry||!separator)return code++;
  HMENU menu=PatchNativeMenuV12(separator->formIndex,separator->menuIndex); if(!menu)return code++;
  if(GetMenuItemCount(menu)!=4)return code++;
  MENUITEMINFOW sep{};sep.cbSize=sizeof(sep);sep.fMask=MIIM_FTYPE;if(!GetMenuItemInfoW(menu,(UINT)separator->entryIndex,TRUE,&sep)||(sep.fType&MFT_SEPARATOR)==0)return code++;
  if(PatchMenuEnabledV12(enabledEntry->nativeItemIndex))return code++;
  const auto& enabledItem=gMenuItems[(size_t)enabledEntry->nativeItemIndex];
  if((GetMenuState(menu,(UINT)enabledItem.commandId,MF_BYCOMMAND)&(MF_DISABLED|MF_GRAYED))==0)return code++;
  PatchDispatchMenuV12(enabledEntry->nativeItemIndex); // disabled must remain guarded
  if(PatchBooleanStateV12(enabledEntry->enabledState,false))return code++;
  auto enableAction=gMenuItemById.find(L"enable_advanced");if(enableAction==gMenuItemById.end())return code++;
  PatchDispatchMenuV12(enableAction->second);
  if(!PatchMenuEnabledV12(enabledEntry->nativeItemIndex))return code++;
  const auto& checkedItem=gMenuItems[(size_t)checkedEntry->nativeItemIndex];
  if((GetMenuState(menu,(UINT)checkedItem.commandId,MF_BYCOMMAND)&MF_CHECKED)!=0)return code++;
  PatchDispatchMenuV12(checkedEntry->nativeItemIndex);
  if(!PatchBooleanStateV12(checkedEntry->checkedState,false))return code++;
  if((GetMenuState(menu,(UINT)checkedItem.commandId,MF_BYCOMMAND)&MF_CHECKED)==0)return code++;
  if(enabledEntry->hasShortcut&&gPatchAcceleratorsV12[(size_t)enabledEntry->formIndex]==nullptr)return code++;
  return 0;
}

int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,PWSTR,int showCommand){
  PatchComScopeV09 patchCom; gInstance=instance; gGuiFont=(HFONT)GetStockObject(DEFAULT_GUI_FONT); gSmokeMode=HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV11,payloadV10,payloadV9,payloadV8,payloadV7;
  if(!ReadSelfPayloadV12(payloadV11)||!PatchConvertPayloadV11ToV10(payloadV11,payloadV10,gPatchMenuEntriesV12)||!PatchConvertPayloadV10ToV9(payloadV10,payloadV9,gPatchListStatesV11,gPatchListBoxesV11,gPatchListEventsV11)||!PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10)||!PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09)||!ParsePayload(payloadV7))return 20;
  if(gPatchLayoutPoliciesV09.size()!=gControls.size()||!PatchResolveTablesV10()||!PatchResolveListsV11())return 24;
  PatchSyncListShadowsV11();
  INITCOMMONCONTROLSEX common{};common.dwSize=sizeof(common);common.dwICC=ICC_TAB_CLASSES|ICC_LISTVIEW_CLASSES;if(!InitCommonControlsEx(&common))return 21;
  WNDCLASSEXW wc{};wc.cbSize=sizeof(wc);wc.hInstance=instance;wc.lpfnWndProc=PatchWndProcV12;wc.lpszClassName=PATCH_WINDOW_CLASS;wc.hCursor=LoadCursor(nullptr,IDC_ARROW);wc.hIcon=LoadIcon(nullptr,IDI_APPLICATION);wc.hbrBackground=(HBRUSH)(COLOR_WINDOW+1);if(!RegisterClassExW(&wc))return 22;
  if(!CreateForms()||!PatchInstallTablesV10()||!PatchInstallListsV11()||!PatchInstallMenusV12())return 23;
  ApplyPatchAccessibilityV09();ApplyPatchTableAccessibilityV10();RefreshUI();PatchRefreshListsV11();PatchRefreshMenusV12();
  for(auto& f:gForms)if(f.visible)ShowWindow(f.hwnd,showCommand==0?SW_SHOWNORMAL:showCommand);
  if(gSmokeMode){int result=RunSmoke();if(!result)result=RunPatchAccessibilitySmokeV09();if(!result)result=RunPatchTableAccessibilitySmokeV10();if(!result)result=RunPatchResponsiveSmokeV09();if(!result)result=RunPatchTableSmokeV10();if(!result)result=RunPatchListSmokeV11();if(!result)result=RunPatchMenuSmokeV12();ClearPatchAccessibilityV09();PatchDestroyMenusV12();return result;}
  MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){if(PatchTranslateAcceleratorV12(msg))continue;TranslateMessage(&msg);DispatchMessageW(&msg);}ClearPatchAccessibilityV09();PatchDestroyMenusV12();return(int)msg.wParam;
}
