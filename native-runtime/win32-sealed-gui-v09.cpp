// Patch sealed Win32 GUI runtime v0.9.
// Payload v8 adds runtime-responsive source-backed Anchor/Dock layout while
// preserving the v0.8 Microsoft Active Accessibility contract.
#include <windows.h>
#include <initguid.h>
#include <oleacc.h>
#include <objbase.h>
#include <cwctype>
#include <fstream>

#define wWinMain PatchSealedRuntimeV07WinMain
#include "win32-sealed-gui-v07.cpp"
#undef wWinMain
#include "sealed-responsive-v09.hpp"

#pragma comment(lib, "oleacc.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")

static std::vector<PatchLayoutPolicyV09> gPatchLayoutPoliciesV09;

struct PatchComScopeV09 {
  HRESULT result;
  PatchComScopeV09() : result(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED)) {}
  ~PatchComScopeV09() { if (SUCCEEDED(result)) CoUninitialize(); }
};

static std::wstring PatchHumanizeV09(const std::wstring& value) {
  std::wstring out;
  for (size_t i = 0; i < value.size(); ++i) {
    const wchar_t ch = value[i];
    if (ch == L'_' || ch == L'-') {
      if (!out.empty() && out.back() != L' ') out.push_back(L' ');
      continue;
    }
    const bool upper = std::iswupper(ch) != 0;
    const bool prevLower = i > 0 && std::iswlower(value[i - 1]) != 0;
    const bool prevUpper = i > 0 && std::iswupper(value[i - 1]) != 0;
    const bool nextLower = i + 1 < value.size() && std::iswlower(value[i + 1]) != 0;
    if (!out.empty() && out.back() != L' ' && upper && (prevLower || (prevUpper && nextLower))) out.push_back(L' ');
    out.push_back(ch);
  }
  if (!out.empty()) out[0] = (wchar_t)std::towupper(out[0]);
  return out;
}

static bool PatchNeedsExplicitNameV09(const Control& c) {
  return c.kind == CK_INPUT || c.kind == CK_COMBO || c.kind == CK_LISTBOX || c.kind == CK_TABS || c.kind == CK_RADIO;
}

static std::wstring PatchControlNameV09(const Control& c) {
  if (!c.text.empty() && c.text.find(L'{') == std::wstring::npos) return c.text;
  if (!c.id.empty()) return PatchHumanizeV09(c.id);
  return PatchHumanizeV09(c.binding);
}

static std::wstring PatchRadioNameV09(const Control& c, const std::wstring& option) {
  const std::wstring group = PatchControlNameV09(c);
  return group.empty() ? option : group + L": " + option;
}

static void PatchSetAccessibleNameV09(HWND hwnd, const std::wstring& name) {
  if (!hwnd || name.empty()) return;
  IAccPropServices* service = nullptr;
  const HRESULT created = CoCreateInstance(CLSID_AccPropServices, nullptr, CLSCTX_SERVER, IID_IAccPropServices, reinterpret_cast<void**>(&service));
  if (SUCCEEDED(created) && service) {
    service->SetHwndPropStr(hwnd, OBJID_CLIENT, CHILDID_SELF, PROPID_ACC_NAME, name.c_str());
    service->Release();
  }
}

static void PatchClearAccessibleNameV09(HWND hwnd) {
  if (!hwnd || !IsWindow(hwnd)) return;
  IAccPropServices* service = nullptr;
  const HRESULT created = CoCreateInstance(CLSID_AccPropServices, nullptr, CLSCTX_SERVER, IID_IAccPropServices, reinterpret_cast<void**>(&service));
  if (SUCCEEDED(created) && service) {
    MSAAPROPID property = PROPID_ACC_NAME;
    service->ClearHwndProps(hwnd, OBJID_CLIENT, CHILDID_SELF, &property, 1);
    service->Release();
  }
}

static std::wstring PatchReadAccessibleNameV09(HWND hwnd) {
  if (!hwnd) return L"";
  IAccessible* accessible = nullptr;
  const HRESULT result = AccessibleObjectFromWindow(hwnd, OBJID_CLIENT, IID_IAccessible, reinterpret_cast<void**>(&accessible));
  if (FAILED(result) || !accessible) return L"";
  VARIANT child{}; child.vt = VT_I4; child.lVal = CHILDID_SELF;
  BSTR value = nullptr;
  const HRESULT named = accessible->get_accName(child, &value);
  std::wstring out = SUCCEEDED(named) && value ? std::wstring(value, SysStringLen(value)) : L"";
  if (value) SysFreeString(value);
  accessible->Release();
  return out;
}

static void ApplyPatchAccessibilityV09() {
  for (auto& c : gControls) {
    if (!PatchNeedsExplicitNameV09(c)) continue;
    if (c.kind == CK_RADIO) {
      for (size_t i = 0; i < c.radioItems.size() && i < c.options.size(); ++i) PatchSetAccessibleNameV09(c.radioItems[i], PatchRadioNameV09(c, c.options[i]));
      continue;
    }
    PatchSetAccessibleNameV09(c.hwnd, PatchControlNameV09(c));
  }
}

static void ClearPatchAccessibilityV09() {
  for (auto& c : gControls) {
    if (!PatchNeedsExplicitNameV09(c)) continue;
    if (c.kind == CK_RADIO) {
      for (HWND item : c.radioItems) PatchClearAccessibleNameV09(item);
      continue;
    }
    PatchClearAccessibleNameV09(c.hwnd);
  }
}

static int RunPatchAccessibilitySmokeV09() {
  int code = 130;
  for (const auto& c : gControls) {
    if (!PatchNeedsExplicitNameV09(c)) continue;
    if (c.kind == CK_RADIO) {
      if (c.radioItems.size() != c.options.size()) return code++;
      for (size_t i = 0; i < c.options.size(); ++i) if (PatchReadAccessibleNameV09(c.radioItems[i]) != PatchRadioNameV09(c, c.options[i])) return code++;
      continue;
    }
    if (PatchReadAccessibleNameV09(c.hwnd) != PatchControlNameV09(c)) return code++;
  }
  return 0;
}

static bool ReadSelfPayloadV09(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH]; DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH);
  if (!n || n >= MAX_PATH) return false;
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER size{};
  if (!GetFileSizeEx(file, &size) || size.QuadPart < 20) { CloseHandle(file); return false; }
  LARGE_INTEGER pos{}; pos.QuadPart = size.QuadPart - 20;
  if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  uint8_t footer[20]{}; DWORD got = 0;
  if (!ReadFile(file, footer, 20, &got, nullptr) || got != 20 || memcmp(footer, PATCH_MAGIC, 8) != 0) { CloseHandle(file); return false; }
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8), length=le32(footer+12), crc=le32(footer+16);
  if (version != 8 || !length || (uint64_t)length > (uint64_t)(size.QuadPart - 20)) { CloseHandle(file); return false; }
  pos.QuadPart = size.QuadPart - 20 - length;
  if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  payload.resize(length); got = 0;
  BOOL ok = ReadFile(file, payload.data(), length, &got, nullptr); CloseHandle(file);
  return ok && got == length && Crc32(payload.data(), payload.size()) == crc;
}

static void MovePatchControlV09(int index, int x, int y, int width, int height) {
  if (index < 0 || index >= (int)gControls.size()) return;
  auto& c = gControls[index];
  if (c.kind == CK_RADIO) {
    const int count = (int)c.radioItems.size();
    int itemHeight = count ? height / count : 26;
    if (itemHeight < 22) itemHeight = 22;
    if (itemHeight > 30) itemHeight = 30;
    for (int option = 0; option < count; ++option) MoveWindow(c.radioItems[option], x, y + option * itemHeight, width, itemHeight, TRUE);
    return;
  }
  if (!c.hwnd) return;
  int renderHeight = c.kind == CK_COMBO ? height + 120 : height;
  if (c.kind == CK_COMBO && renderHeight < 160) renderHeight = 160;
  MoveWindow(c.hwnd, x, y, width, renderHeight, TRUE);
}

static void ApplyPatchResponsiveLayoutV09(int formIndex, int formWidth, int formHeight) {
  if (formIndex < 0 || formIndex >= (int)gForms.size() || formWidth <= 0 || formHeight <= 0 || gPatchLayoutPoliciesV09.size() != gControls.size()) return;
  const auto& form = gForms[formIndex];
  for (int index = 0; index < (int)gControls.size(); ++index) {
    auto& c = gControls[index];
    if (c.formIndex != formIndex || c.parentTabIndex >= 0 || !PatchPolicyResponsiveV09(gPatchLayoutPoliciesV09[index])) continue;
    int x=c.x, y=c.y, width=c.width, height=c.height;
    PatchApplyLayoutPolicyV09(gPatchLayoutPoliciesV09[index], form.width, form.height, formWidth, formHeight, x, y, width, height);
    MovePatchControlV09(index, x, y, width, height);
    if (c.kind == CK_TABS) {
      for (int childIndex = 0; childIndex < (int)gControls.size(); ++childIndex) {
        auto& child = gControls[childIndex];
        if (child.parentTabIndex != index) continue;
        MovePatchControlV09(childIndex, x + 10 + child.x, y + 30 + child.y, child.width, child.height);
      }
    }
  }
}

static LRESULT CALLBACK PatchWndProcV09(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (msg == WM_SIZE) {
    const int formIndex = (int)(INT_PTR)GetWindowLongPtrW(hwnd, GWLP_USERDATA);
    ApplyPatchResponsiveLayoutV09(formIndex, LOWORD(lParam), HIWORD(lParam));
  }
  return WndProc(hwnd, msg, wParam, lParam);
}

static int RunPatchResponsiveSmokeV09() {
  if (gPatchLayoutPoliciesV09.size() != gControls.size()) return 180;
  for (int index = 0; index < (int)gControls.size(); ++index) {
    const auto policy = gPatchLayoutPoliciesV09[index];
    if (!PatchPolicyResponsiveV09(policy) || gControls[index].parentTabIndex >= 0) continue;
    auto& c = gControls[index];
    const int beforeX = c.x, beforeY = c.y, beforeWidth = c.width, beforeHeight = c.height;
    int expectedX=beforeX, expectedY=beforeY, expectedWidth=beforeWidth, expectedHeight=beforeHeight;
    const auto& form = gForms[c.formIndex];
    PatchApplyLayoutPolicyV09(policy, form.width, form.height, form.width + 80, form.height + 60, expectedX, expectedY, expectedWidth, expectedHeight);
    SendMessageW(form.hwnd, WM_SIZE, SIZE_RESTORED, MAKELPARAM(form.width + 80, form.height + 60));
    HWND target = c.kind == CK_RADIO && !c.radioItems.empty() ? c.radioItems[0] : c.hwnd;
    if (!target) return 181;
    RECT rect{}; if (!GetWindowRect(target, &rect)) return 182;
    POINT origin{rect.left,rect.top}; ScreenToClient(form.hwnd,&origin);
    if (origin.x != expectedX || (c.kind != CK_RADIO && origin.y != expectedY)) return 183;
    if (c.kind != CK_COMBO && c.kind != CK_RADIO && rect.right - rect.left != expectedWidth) return 184;
    return 0;
  }
  return 0;
}

#ifndef PATCH_WIN32_RUNTIME_V09_ENTRY
#define PATCH_WIN32_RUNTIME_V09_ENTRY wWinMain
#endif

int WINAPI PATCH_WIN32_RUNTIME_V09_ENTRY(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  PatchComScopeV09 patchCom;
  gInstance = instance;
  gGuiFont = (HFONT)GetStockObject(DEFAULT_GUI_FONT);
  gSmokeMode = HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV8, payloadV7;
  if (!ReadSelfPayloadV09(payloadV8) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size()) return 24;
  INITCOMMONCONTROLSEX common{}; common.dwSize = sizeof(common); common.dwICC = ICC_TAB_CLASSES;
  if (!InitCommonControlsEx(&common)) return 21;
  WNDCLASSEXW wc{}; wc.cbSize=sizeof(wc); wc.hInstance=instance; wc.lpfnWndProc=PatchWndProcV09; wc.lpszClassName=PATCH_WINDOW_CLASS; wc.hCursor=LoadCursor(nullptr,IDC_ARROW); wc.hIcon=LoadIcon(nullptr,IDI_APPLICATION); wc.hbrBackground=(HBRUSH)(COLOR_WINDOW+1);
  if (!RegisterClassExW(&wc)) return 22;
  if (!CreateForms()) return 23;
  ApplyPatchAccessibilityV09();
  RefreshUI();
  for (auto& f : gForms) if (f.visible) ShowWindow(f.hwnd, showCommand == 0 ? SW_SHOWNORMAL : showCommand);
  if (gSmokeMode) {
    const int base = RunSmoke();
    const int accessibility = base == 0 ? RunPatchAccessibilitySmokeV09() : base;
    const int responsive = accessibility == 0 ? RunPatchResponsiveSmokeV09() : accessibility;
    ClearPatchAccessibilityV09();
    return responsive;
  }
  MSG msg{};
  while (GetMessageW(&msg,nullptr,0,0)>0) { TranslateMessage(&msg); DispatchMessageW(&msg); }
  ClearPatchAccessibilityV09();
  return (int)msg.wParam;
}
