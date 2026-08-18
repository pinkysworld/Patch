// Patch sealed Win32 GUI runtime v1.3.
// Payload v12 adds TreeView hierarchy over frozen payload-v11/runtime-v1.2.
#include <windows.h>
#include <commctrl.h>
#include <algorithm>
#include <fstream>
#include <vector>

#define PATCH_WIN32_RUNTIME_V13_RESTORE_ENTRY PatchRuntimeV12CompatibilityMain
#include "win32-sealed-gui-v12.cpp"
#undef wWinMain
#undef PATCH_WIN32_RUNTIME_V13_RESTORE_ENTRY
#include "sealed-tree-v13.hpp"

struct PatchWinTreeV13 {
  HWND hwnd = nullptr;
  std::vector<HTREEITEM> items;
};

static std::vector<PatchTreeV13> gPatchTreesV13;
static std::vector<PatchWinTreeV13> gPatchWinTreesV13;
static int gPatchTreeSelectionCountV13 = 0;

static bool ReadSelfPayloadV13(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH]; DWORD n=GetModuleFileNameW(nullptr,path,MAX_PATH); if(!n||n>=MAX_PATH)return false;
  HANDLE file=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr); if(file==INVALID_HANDLE_VALUE)return false;
  LARGE_INTEGER size{}; if(!GetFileSizeEx(file,&size)||size.QuadPart<20){CloseHandle(file);return false;}
  LARGE_INTEGER pos{};pos.QuadPart=size.QuadPart-20;if(!SetFilePointerEx(file,pos,nullptr,FILE_BEGIN)){CloseHandle(file);return false;}
  uint8_t footer[20]{};DWORD got=0;if(!ReadFile(file,footer,20,&got,nullptr)||got!=20||memcmp(footer,PATCH_MAGIC,8)!=0){CloseHandle(file);return false;}
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);
  if(version!=12||!length||(uint64_t)length>(uint64_t)(size.QuadPart-20)){CloseHandle(file);return false;}
  pos.QuadPart=size.QuadPart-20-length;if(!SetFilePointerEx(file,pos,nullptr,FILE_BEGIN)){CloseHandle(file);return false;}
  payload.resize(length);got=0;BOOL ok=ReadFile(file,payload.data(),length,&got,nullptr);CloseHandle(file);
  return ok&&got==length&&Crc32(payload.data(),payload.size())==crc;
}

static bool PatchResolveTreesV13() {
  for (const auto& tree : gPatchTreesV13) {
    if (tree.nativeIndex < 0 || tree.nativeIndex >= (int)gControls.size()) return false;
    auto id = gControlById.find(PatchWideV11(tree.id));
    if (id == gControlById.end() || id->second != tree.nativeIndex) return false;
    const auto& control = gControls[(size_t)tree.nativeIndex];
    if (control.kind != CK_LISTBOX || !PatchFindListBoxV11(gPatchListBoxesV11, tree.id) || control.options.size() < tree.nodes.size()) return false;
  }
  return true;
}

static std::wstring PatchTreeTextV13(const PatchTreeNodeV13& node) { return RenderText(PatchWideV11(node.text)); }

static bool PatchInstallTreesV13() {
  gPatchWinTreesV13.assign(gControls.size(), {});
  for (const auto& tree : gPatchTreesV13) {
    auto& control = gControls[(size_t)tree.nativeIndex];
    if (!control.hwnd) return false;
    HWND parent = GetParent(control.hwnd); if (!parent) return false;
    RECT rect{}; if(!GetWindowRect(control.hwnd,&rect))return false;
    POINT points[2]={{rect.left,rect.top},{rect.right,rect.bottom}};MapWindowPoints(nullptr,parent,points,2);
    auto& native = gPatchWinTreesV13[(size_t)tree.nativeIndex];
    native.hwnd=CreateWindowExW(WS_EX_CLIENTEDGE,WC_TREEVIEWW,L"",WS_CHILD|WS_VISIBLE|WS_TABSTOP|WS_BORDER|TVS_HASBUTTONS|TVS_HASLINES|TVS_LINESATROOT|TVS_SHOWSELALWAYS,points[0].x,points[0].y,points[1].x-points[0].x,points[1].y-points[0].y,parent,reinterpret_cast<HMENU>((INT_PTR)control.commandId),gInstance,nullptr);
    if(!native.hwnd)return false;if(gGuiFont)SendMessageW(native.hwnd,WM_SETFONT,(WPARAM)gGuiFont,TRUE);
    native.items.reserve(tree.nodes.size());
    for(size_t index=0;index<tree.nodes.size();++index){
      const auto& node=tree.nodes[index];std::wstring text=PatchTreeTextV13(node);control.options[index]=text;
      HTREEITEM parentItem=node.parent<0?TVI_ROOT:native.items[(size_t)node.parent];
      TVINSERTSTRUCTW insert{};insert.hParent=parentItem;insert.hInsertAfter=TVI_LAST;insert.item.mask=TVIF_TEXT;insert.item.pszText=text.data();
      HTREEITEM item=TreeView_InsertItem(native.hwnd,&insert);if(!item)return false;native.items.push_back(item);
    }
    for(size_t index=0;index<tree.nodes.size();++index){bool parent=false;for(const auto& node:tree.nodes)if(node.parent==(int)index){parent=true;break;}if(parent)TreeView_Expand(native.hwnd,native.items[index],TVE_EXPAND);}
    ShowWindow(control.hwnd,SW_HIDE);
  }
  return true;
}

static void PatchRefreshTreesV13() {
  const bool previous=gRefreshing;gRefreshing=true;
  for(const auto& tree:gPatchTreesV13){
    auto& control=gControls[(size_t)tree.nativeIndex];auto& native=gPatchWinTreesV13[(size_t)tree.nativeIndex];if(!control.hwnd||!native.hwnd)continue;
    for(size_t index=0;index<tree.nodes.size();++index){
      std::wstring text=PatchTreeTextV13(tree.nodes[index]);control.options[index]=text;
      TVITEMW item{};item.mask=TVIF_TEXT;item.hItem=native.items[index];item.pszText=text.data();TreeView_SetItem(native.hwnd,&item);
      SendMessageW(control.hwnd,LB_DELETESTRING,(WPARAM)index,0);SendMessageW(control.hwnd,LB_INSERTSTRING,(WPARAM)index,(LPARAM)text.c_str());
    }
    HWND parent=GetParent(control.hwnd);RECT rect{};if(parent&&GetWindowRect(control.hwnd,&rect)){POINT points[2]={{rect.left,rect.top},{rect.right,rect.bottom}};MapWindowPoints(nullptr,parent,points,2);MoveWindow(native.hwnd,points[0].x,points[0].y,points[1].x-points[0].x,points[1].y-points[0].y,TRUE);}
    bool visible=true;if(control.parentTabIndex>=0&&control.parentTabIndex<(int)gControls.size())visible=gControls[(size_t)control.parentTabIndex].selectedPage==control.pageIndex;
    ShowWindow(native.hwnd,visible?SW_SHOW:SW_HIDE);ShowWindow(control.hwnd,SW_HIDE);
  }
  gRefreshing=previous;
}

static int PatchTreeNodeIndexV13(const PatchTreeV13& tree, const PatchWinTreeV13& native, HTREEITEM item) {
  for(size_t index=0;index<native.items.size();++index)if(native.items[index]==item)return (int)index;return -1;
}

static bool PatchDispatchTreeSelectionV13(const PatchTreeV13& tree, HTREEITEM item) {
  auto& native=gPatchWinTreesV13[(size_t)tree.nativeIndex];const int nodeIndex=PatchTreeNodeIndexV13(tree,native,item);if(nodeIndex<0)return false;
  auto path=PatchTreePathIndicesV13(tree,nodeIndex);if(path.empty())return false;
  auto& control=gControls[(size_t)tree.nativeIndex];PatchRefreshTreesV13();
  SendMessageW(control.hwnd,LB_SETSEL,FALSE,(LPARAM)-1);for(int index:path)SendMessageW(control.hwnd,LB_SETSEL,TRUE,(LPARAM)index);
  ++gPatchTreeSelectionCountV13;PatchDispatchControlV11(tree.nativeIndex,EV_CHANGED,control.hwnd);PatchRefreshMenusV12();PatchRefreshTreesV13();return true;
}

static bool PatchHandleTreeNotifyV13(NMHDR* header) {
  if(!header||header->code!=TVN_SELCHANGEDW||gRefreshing)return false;
  for(const auto& tree:gPatchTreesV13){auto& native=gPatchWinTreesV13[(size_t)tree.nativeIndex];if(native.hwnd!=header->hwndFrom)continue;auto* change=reinterpret_cast<NMTREEVIEWW*>(header);return PatchDispatchTreeSelectionV13(tree,change->itemNew.hItem);}
  return false;
}

static LRESULT CALLBACK PatchWndProcV13(HWND hwnd,UINT msg,WPARAM wParam,LPARAM lParam) {
  if(msg==WM_NOTIFY&&PatchHandleTreeNotifyV13(reinterpret_cast<NMHDR*>(lParam)))return 0;
  LRESULT result=PatchWndProcV12(hwnd,msg,wParam,lParam);
  if(msg==WM_COMMAND||msg==WM_NOTIFY||msg==WM_SIZE)PatchRefreshTreesV13();
  return result;
}

static int RunPatchTreeSmokeV13() {
  int code=300;for(const auto& tree:gPatchTreesV13){
    const auto& native=gPatchWinTreesV13[(size_t)tree.nativeIndex];if(!native.hwnd||native.items.size()!=tree.nodes.size()||TreeView_GetCount(native.hwnd)!=(LRESULT)tree.nodes.size())return code++;
    if(tree.id=="files"&&!tree.nodes.empty()){
      auto* selected=PatchFindListStateV11(gPatchListStatesV11,"selected");if(selected){const int before=gPatchTreeSelectionCountV13;if(!PatchDispatchTreeSelectionV13(tree,native.items.back())||gPatchTreeSelectionCountV13!=before+1)return code++;auto path=PatchTreePathIndicesV13(tree,(int)tree.nodes.size()-1);std::vector<std::string> expected;for(int index:path)expected.push_back(PatchUtf8V11(PatchTreeTextV13(tree.nodes[(size_t)index])));if(selected->value!=expected)return code++;}
    }
  }return 0;
}

int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,LPWSTR,int) {
  gInstance=instance;gSmokeMode=HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV12,payloadV11,payloadV10,payloadV9,payloadV8,payloadV7;
  if(!ReadSelfPayloadV13(payloadV12)||!PatchConvertPayloadV12ToV11(payloadV12,payloadV11,gPatchTreesV13)||!PatchConvertPayloadV11ToV10(payloadV11,payloadV10,gPatchMenuEntriesV12)||!PatchConvertPayloadV10ToV9(payloadV10,payloadV9,gPatchListStatesV11,gPatchListBoxesV11,gPatchListEventsV11)||!PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10)||!PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09)||!ParsePayload(payloadV7))return 20;
  if(gPatchLayoutPoliciesV09.size()!=gControls.size()||!PatchResolveTablesV10()||!PatchResolveListsV11()||!PatchResolveTreesV13())return 22;
  PatchSyncListShadowsV11();INITCOMMONCONTROLSEX common{};common.dwSize=sizeof(common);common.dwICC=ICC_WIN95_CLASSES|ICC_LISTVIEW_CLASSES|ICC_TAB_CLASSES|ICC_TREEVIEW_CLASSES;if(!InitCommonControlsEx(&common))return 21;
  WNDCLASSW wc{};wc.lpfnWndProc=PatchWndProcV13;wc.hInstance=instance;wc.hCursor=LoadCursor(nullptr,IDC_ARROW);wc.hbrBackground=(HBRUSH)(COLOR_WINDOW+1);PATCH_WINDOW_CLASS=L"PatchSealedNativeWindowV13";wc.lpszClassName=PATCH_WINDOW_CLASS;if(!RegisterClassW(&wc))return 21;
  NONCLIENTMETRICSW metrics{};metrics.cbSize=sizeof(metrics);if(SystemParametersInfoW(SPI_GETNONCLIENTMETRICS,sizeof(metrics),&metrics,0))gGuiFont=CreateFontIndirectW(&metrics.lfMessageFont);
  if(!CreateFormsV09()||!PatchInstallTablesV10()||!PatchInstallListsV11()||!PatchInstallTreesV13()||!PatchInstallMenusV12())return 21;
  for(auto& form:gForms)SetWindowLongPtrW(form.hwnd,GWLP_WNDPROC,reinterpret_cast<LONG_PTR>(PatchWndProcV13));
  ApplyPatchAccessibilityV09();ApplyPatchTableAccessibilityV10();RefreshUI();PatchRefreshListsV11();PatchRefreshMenusV12();PatchRefreshTreesV13();for(auto& form:gForms)if(form.visible)ShowWindow(form.hwnd,SW_SHOW);
  if(gSmokeMode){int result=RunSmoke();if(!result)result=RunPatchAccessibilitySmokeV09();if(!result)result=RunPatchTableAccessibilitySmokeV10();if(!result)result=RunPatchResponsiveSmokeV09();if(!result)result=RunPatchTableSmokeV10();if(!result)result=RunPatchListSmokeV11();if(!result)result=RunPatchMenuSmokeV12();if(!result)result=RunPatchTreeSmokeV13();if(gGuiFont)DeleteObject(gGuiFont);return result;}
  MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){if(PatchTranslateMenuAcceleratorV12(&msg))continue;TranslateMessage(&msg);DispatchMessageW(&msg);}if(gGuiFont)DeleteObject(gGuiFont);return 0;
}
