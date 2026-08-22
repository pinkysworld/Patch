// Patch sealed Win32 GUI runtime v1.4.
// Payload v13 adds native Slider metadata over frozen payload-v12/runtime-v1.3.
#define PATCH_WIN32_RUNTIME_V14_RESTORE_ENTRY PatchRuntimeV13CompatibilityMain
#include "win32-sealed-gui-v13.cpp"
#undef wWinMain
#undef PATCH_WIN32_RUNTIME_V14_RESTORE_ENTRY
#include "sealed-slider-v14.hpp"

struct PatchWinSliderV14 { HWND hwnd=nullptr; };
static std::vector<PatchSliderV14> gPatchSlidersV14;
static std::vector<PatchWinSliderV14> gPatchWinSlidersV14;
static int gPatchSliderDispatchCountV14=0;

static bool ReadSelfPayloadV14(std::vector<uint8_t>& payload){
  wchar_t path[MAX_PATH];DWORD n=GetModuleFileNameW(nullptr,path,MAX_PATH);if(!n||n>=MAX_PATH)return false;
  HANDLE file=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);if(file==INVALID_HANDLE_VALUE)return false;
  LARGE_INTEGER size{};if(!GetFileSizeEx(file,&size)||size.QuadPart<20){CloseHandle(file);return false;}
  LARGE_INTEGER pos{};pos.QuadPart=size.QuadPart-20;if(!SetFilePointerEx(file,pos,nullptr,FILE_BEGIN)){CloseHandle(file);return false;}
  uint8_t footer[20]{};DWORD got=0;if(!ReadFile(file,footer,20,&got,nullptr)||got!=20||memcmp(footer,PATCH_MAGIC,8)!=0){CloseHandle(file);return false;}
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);if(version!=13||!length||(uint64_t)length>(uint64_t)(size.QuadPart-20)){CloseHandle(file);return false;}
  pos.QuadPart=size.QuadPart-20-length;if(!SetFilePointerEx(file,pos,nullptr,FILE_BEGIN)){CloseHandle(file);return false;}
  payload.resize(length);got=0;BOOL ok=ReadFile(file,payload.data(),length,&got,nullptr);CloseHandle(file);return ok&&got==length&&Crc32(payload.data(),payload.size())==crc;
}

static int PatchSliderTicksV14(const PatchSliderV14& slider){double raw=(slider.max-slider.min)/slider.step;if(!std::isfinite(raw)||raw<0)return 0;double floored=std::floor(raw+1e-10);if(floored>2000000000.0)floored=2000000000.0;return (int)floored;}
static int PatchSliderPositionV14(const PatchSliderV14& slider,double value){double clamped=std::max(slider.min,std::min(slider.max,value));long long pos=(long long)std::llround((clamped-slider.min)/slider.step);int ticks=PatchSliderTicksV14(slider);if(pos<0)pos=0;if(pos>ticks)pos=ticks;return(int)pos;}
static double PatchSliderValueV14(const PatchSliderV14& slider,HWND hwnd){if(!hwnd)return slider.min;int pos=(int)SendMessageW(hwnd,TBM_GETPOS,0,0);double value=slider.min+(double)pos*slider.step;return std::max(slider.min,std::min(slider.max,value));}
static bool PatchSliderStateValueV14(const PatchSliderV14& slider,double& value){if(slider.binding.empty()){value=slider.min;return true;}auto it=gStateByName.find(PatchWideV11(slider.binding));if(it==gStateByName.end())return false;const auto& state=gStates[(size_t)it->second];if(state.type!=ST_NUMBER)return false;value=state.number;return std::isfinite(value);}

static bool PatchResolveSlidersV14(){
  for(const auto& slider:gPatchSlidersV14){
    if(slider.nativeIndex<0||slider.nativeIndex>=(int)gControls.size())return false;
    auto it=gControlById.find(PatchWideV11(slider.id));if(it==gControlById.end()||it->second!=slider.nativeIndex)return false;
    const auto& c=gControls[(size_t)slider.nativeIndex];if(c.kind!=CK_INPUT||c.hwnd)return false;
    double initial=0;if(!PatchSliderStateValueV14(slider,initial))return false;
    for(const auto& patch:slider.events){if(patch.eventIndex>=gEvents.size())return false;const auto& event=gEvents[(size_t)patch.eventIndex];if(event.control!=PatchWideV11(slider.id)||event.kind!=EV_CHANGED)return false;}
  }return true;
}

static bool PatchInstallSlidersV14(){
  gPatchWinSlidersV14.assign(gControls.size(),{});
  for(const auto& slider:gPatchSlidersV14){
    auto& c=gControls[(size_t)slider.nativeIndex];if(!c.hwnd)return false;HWND parent=GetParent(c.hwnd);if(!parent)return false;
    RECT rect{};if(!GetWindowRect(c.hwnd,&rect))return false;POINT points[2]={{rect.left,rect.top},{rect.right,rect.bottom}};MapWindowPoints(nullptr,parent,points,2);
    HWND track=CreateWindowExW(0,TRACKBAR_CLASSW,L"",WS_CHILD|WS_VISIBLE|WS_TABSTOP|TBS_HORZ|TBS_AUTOTICKS,points[0].x,points[0].y,points[1].x-points[0].x,points[1].y-points[0].y,parent,reinterpret_cast<HMENU>((INT_PTR)c.commandId),gInstance,nullptr);
    if(!track)return false;if(gGuiFont)SendMessageW(track,WM_SETFONT,(WPARAM)gGuiFont,TRUE);SendMessageW(track,TBM_SETRANGEMIN,FALSE,0);SendMessageW(track,TBM_SETRANGEMAX,FALSE,PatchSliderTicksV14(slider));
    double initial=slider.min;if(!PatchSliderStateValueV14(slider,initial))return false;SendMessageW(track,TBM_SETPOS,TRUE,PatchSliderPositionV14(slider,initial));gPatchWinSlidersV14[(size_t)slider.nativeIndex].hwnd=track;ShowWindow(c.hwnd,SW_HIDE);
  }return true;
}

static void PatchRefreshSlidersV14(){
  bool previous=gRefreshing;gRefreshing=true;
  for(const auto& slider:gPatchSlidersV14){auto& c=gControls[(size_t)slider.nativeIndex];HWND track=gPatchWinSlidersV14[(size_t)slider.nativeIndex].hwnd;if(!c.hwnd||!track)continue;
    if(!slider.binding.empty()){double value=slider.min;if(PatchSliderStateValueV14(slider,value))SendMessageW(track,TBM_SETPOS,TRUE,PatchSliderPositionV14(slider,value));}
    HWND parent=GetParent(c.hwnd);RECT rect{};if(parent&&GetWindowRect(c.hwnd,&rect)){POINT points[2]={{rect.left,rect.top},{rect.right,rect.bottom}};MapWindowPoints(nullptr,parent,points,2);MoveWindow(track,points[0].x,points[0].y,points[1].x-points[0].x,points[1].y-points[0].y,TRUE);}bool visible=true;if(c.parentTabIndex>=0&&c.parentTabIndex<(int)gControls.size())visible=gControls[(size_t)c.parentTabIndex].selectedPage==c.pageIndex;ShowWindow(track,visible?SW_SHOW:SW_HIDE);ShowWindow(c.hwnd,SW_HIDE);
  }gRefreshing=previous;
}

struct PatchSliderSentinelRestoreV14{Operation* op=nullptr;double value=0;};
static bool PatchExecuteSliderEventV14(const PatchSliderV14& slider,const PatchSliderEventPatchV14& patch,double value){
  if(patch.eventIndex>=gEvents.size())return false;Event& event=gEvents[(size_t)patch.eventIndex];std::vector<PatchSliderSentinelRestoreV14> restore;
  for(auto& action:event.actions)for(auto& op:action.ops)if(op.valueKind==VK_LITERAL&&action.stateType==ST_NUMBER)for(double sentinel:patch.sentinels)if(op.number==sentinel){restore.push_back({&op,op.number});op.number=value;break;}
  if(restore.size()!=patch.sentinels.size()){for(auto& item:restore)item.op->number=item.value;return false;}
  PatchExecuteEventV11(event,false,L"",nullptr);for(auto& item:restore)item.op->number=item.value;++gPatchSliderDispatchCountV14;return true;
}
static bool PatchDispatchSliderV14(const PatchSliderV14& slider,int notification){if(gRefreshing)return false;if(notification==TB_THUMBTRACK)return true;HWND hwnd=gPatchWinSlidersV14[(size_t)slider.nativeIndex].hwnd;double value=PatchSliderValueV14(slider,hwnd);for(const auto& patch:slider.events)if(!PatchExecuteSliderEventV14(slider,patch,value))return false;PatchRefreshMenusV12();PatchRefreshTreesV13();PatchRefreshSlidersV14();return true;}
static bool PatchHandleSliderScrollV14(HWND hwnd,int notification){if(!hwnd)return false;for(const auto& slider:gPatchSlidersV14)if(gPatchWinSlidersV14[(size_t)slider.nativeIndex].hwnd==hwnd)return PatchDispatchSliderV14(slider,notification);return false;}

static LRESULT CALLBACK PatchWndProcV14(HWND hwnd,UINT msg,WPARAM wParam,LPARAM lParam){
  if(msg==WM_HSCROLL&&PatchHandleSliderScrollV14(reinterpret_cast<HWND>(lParam),LOWORD(wParam)))return 0;
  LRESULT result=PatchWndProcV13(hwnd,msg,wParam,lParam);if(msg==WM_COMMAND||msg==WM_NOTIFY||msg==WM_SIZE)PatchRefreshSlidersV14();return result;
}

static const std::wstring* PatchSliderSetTargetV14(const PatchSliderV14& slider){for(const auto& patch:slider.events){if(patch.eventIndex>=gEvents.size())continue;const auto& event=gEvents[(size_t)patch.eventIndex];for(const auto& action:event.actions)if(action.kind==ACT_CHANGE&&action.stateType==ST_NUMBER)for(const auto& op:action.ops)if(op.op==OP_SET&&op.valueKind==VK_LITERAL)for(double sentinel:patch.sentinels)if(op.number==sentinel)return &action.target;}return nullptr;}
static int RunPatchSliderSmokeV14(){int code=340;for(const auto& slider:gPatchSlidersV14){HWND track=gPatchWinSlidersV14[(size_t)slider.nativeIndex].hwnd;if(!track)return code++;if((int)SendMessageW(track,TBM_GETRANGEMAX,0,0)!=PatchSliderTicksV14(slider))return code++;if(!slider.events.empty()){int before=gPatchSliderDispatchCountV14;SendMessageW(track,TBM_SETPOS,TRUE,PatchSliderTicksV14(slider));if(!PatchDispatchSliderV14(slider,TB_ENDTRACK)||gPatchSliderDispatchCountV14<=before)return code++;if(const auto* target=PatchSliderSetTargetV14(slider)){auto it=gStateByName.find(*target);if(it==gStateByName.end()||gStates[(size_t)it->second].type!=ST_NUMBER||std::fabs(gStates[(size_t)it->second].number-PatchSliderValueV14(slider,track))>1e-9)return code++;}}}return 0;}

int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,LPWSTR,int showCommand){
  gInstance=instance;gSmokeMode=HasArg(L"--patch-smoke");std::vector<uint8_t> payloadV13,payloadV12,payloadV11,payloadV10,payloadV9,payloadV8,payloadV7;
  if(!ReadSelfPayloadV14(payloadV13)||!PatchConvertPayloadV13ToV12(payloadV13,payloadV12,gPatchSlidersV14)||!PatchConvertPayloadV12ToV11(payloadV12,payloadV11,gPatchTreesV13)||!PatchConvertPayloadV11ToV10(payloadV11,payloadV10,gPatchMenuEntriesV12)||!PatchConvertPayloadV10ToV9(payloadV10,payloadV9,gPatchListStatesV11,gPatchListBoxesV11,gPatchListEventsV11)||!PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10)||!PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09)||!ParsePayload(payloadV7))return 20;
  if(gPatchLayoutPoliciesV09.size()!=gControls.size()||!PatchResolveTablesV10()||!PatchResolveListsV11()||!PatchResolveTreesV13()||!PatchResolveSlidersV14())return 22;
  PatchSyncListShadowsV11();INITCOMMONCONTROLSEX common{};common.dwSize=sizeof(common);common.dwICC=ICC_WIN95_CLASSES|ICC_LISTVIEW_CLASSES|ICC_TAB_CLASSES|ICC_TREEVIEW_CLASSES|ICC_BAR_CLASSES;if(!InitCommonControlsEx(&common))return 21;
  WNDCLASSW wc{};wc.lpfnWndProc=PatchWndProcV14;wc.hInstance=instance;wc.hCursor=LoadCursor(nullptr,IDC_ARROW);wc.hbrBackground=(HBRUSH)(COLOR_WINDOW+1);PATCH_WINDOW_CLASS=L"PatchSealedNativeWindowV14";wc.lpszClassName=PATCH_WINDOW_CLASS;if(!RegisterClassW(&wc))return 21;
  NONCLIENTMETRICSW metrics{};metrics.cbSize=sizeof(metrics);if(SystemParametersInfoW(SPI_GETNONCLIENTMETRICS,sizeof(metrics),&metrics,0))gGuiFont=CreateFontIndirectW(&metrics.lfMessageFont);
  if(!CreateFormsV09()||!PatchInstallTablesV10()||!PatchInstallListsV11()||!PatchInstallTreesV13()||!PatchInstallSlidersV14()||!PatchInstallMenusV12())return 21;
  for(auto& form:gForms)SetWindowLongPtrW(form.hwnd,GWLP_WNDPROC,reinterpret_cast<LONG_PTR>(PatchWndProcV14));
  ApplyPatchAccessibilityV09();ApplyPatchTableAccessibilityV10();RefreshUI();PatchRefreshListsV11();PatchRefreshMenusV12();PatchRefreshTreesV13();PatchRefreshSlidersV14();for(auto& form:gForms)if(form.visible)ShowWindow(form.hwnd,showCommand==0?SW_SHOWNORMAL:showCommand);
  if(gSmokeMode){int result=RunSmoke();if(!result)result=RunPatchAccessibilitySmokeV09();if(!result)result=RunPatchTableAccessibilitySmokeV10();if(!result)result=RunPatchResponsiveSmokeV09();if(!result)result=RunPatchTableSmokeV10();if(!result)result=RunPatchListSmokeV11();if(!result)result=RunPatchMenuSmokeV12();if(!result)result=RunPatchTreeSmokeV13();if(!result)result=RunPatchSliderSmokeV14();if(gGuiFont)DeleteObject(gGuiFont);return result;}
  MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){if(PatchTranslateMenuAcceleratorV12(&msg))continue;TranslateMessage(&msg);DispatchMessageW(&msg);}if(gGuiFont)DeleteObject(gGuiFont);return 0;
}
