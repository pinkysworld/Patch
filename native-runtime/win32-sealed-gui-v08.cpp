// Patch sealed Win32 GUI runtime v0.8.
// Accessibility overlay over the payload-v7 runtime implementation.
#include <windows.h>
#include <initguid.h>
#include <oleacc.h>
#include <objbase.h>
#include <cwctype>

#define wWinMain PatchSealedRuntimeV07WinMain
#include "win32-sealed-gui-v07.cpp"
#undef wWinMain

#pragma comment(lib, "oleacc.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")

struct PatchComScopeV08 {
  HRESULT result;
  PatchComScopeV08() : result(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED)) {}
  ~PatchComScopeV08() { if (SUCCEEDED(result)) CoUninitialize(); }
};

static std::wstring PatchHumanizeV08(const std::wstring& value) {
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

static bool PatchNeedsExplicitNameV08(const Control& c) {
  return c.kind == CK_INPUT || c.kind == CK_COMBO || c.kind == CK_LISTBOX || c.kind == CK_TABS || c.kind == CK_RADIO;
}

static std::wstring PatchControlNameV08(const Control& c) {
  if (!c.text.empty() && c.text.find(L'{') == std::wstring::npos) return c.text;
  if (!c.id.empty()) return PatchHumanizeV08(c.id);
  return PatchHumanizeV08(c.binding);
}

static std::wstring PatchRadioNameV08(const Control& c, const std::wstring& option) {
  const std::wstring group = PatchControlNameV08(c);
  return group.empty() ? option : group + L": " + option;
}

static void PatchSetAccessibleNameV08(HWND hwnd, const std::wstring& name) {
  if (!hwnd || name.empty()) return;
  IAccPropServices* service = nullptr;
  const HRESULT created = CoCreateInstance(CLSID_AccPropServices, nullptr, CLSCTX_SERVER, IID_IAccPropServices, reinterpret_cast<void**>(&service));
  if (SUCCEEDED(created) && service) {
    service->SetHwndPropStr(hwnd, OBJID_CLIENT, CHILDID_SELF, PROPID_ACC_NAME, name.c_str());
    service->Release();
  }
}

static void PatchClearAccessibleNameV08(HWND hwnd) {
  if (!hwnd || !IsWindow(hwnd)) return;
  IAccPropServices* service = nullptr;
  const HRESULT created = CoCreateInstance(CLSID_AccPropServices, nullptr, CLSCTX_SERVER, IID_IAccPropServices, reinterpret_cast<void**>(&service));
  if (SUCCEEDED(created) && service) {
    MSAAPROPID property = PROPID_ACC_NAME;
    service->ClearHwndProps(hwnd, OBJID_CLIENT, CHILDID_SELF, &property, 1);
    service->Release();
  }
}

static std::wstring PatchReadAccessibleNameV08(HWND hwnd) {
  if (!hwnd) return L"";
  IAccessible* accessible = nullptr;
  const HRESULT result = AccessibleObjectFromWindow(hwnd, OBJID_CLIENT, IID_IAccessible, reinterpret_cast<void**>(&accessible));
  if (FAILED(result) || !accessible) return L"";
  VARIANT child{};
  child.vt = VT_I4;
  child.lVal = CHILDID_SELF;
  BSTR value = nullptr;
  const HRESULT named = accessible->get_accName(child, &value);
  std::wstring out = SUCCEEDED(named) && value ? std::wstring(value, SysStringLen(value)) : L"";
  if (value) SysFreeString(value);
  accessible->Release();
  return out;
}

static void ApplyPatchAccessibilityV08() {
  for (auto& c : gControls) {
    if (!PatchNeedsExplicitNameV08(c)) continue;
    if (c.kind == CK_RADIO) {
      for (size_t i = 0; i < c.radioItems.size() && i < c.options.size(); ++i) PatchSetAccessibleNameV08(c.radioItems[i], PatchRadioNameV08(c, c.options[i]));
      continue;
    }
    PatchSetAccessibleNameV08(c.hwnd, PatchControlNameV08(c));
  }
}

static void ClearPatchAccessibilityV08() {
  for (auto& c : gControls) {
    if (!PatchNeedsExplicitNameV08(c)) continue;
    if (c.kind == CK_RADIO) {
      for (HWND item : c.radioItems) PatchClearAccessibleNameV08(item);
      continue;
    }
    PatchClearAccessibleNameV08(c.hwnd);
  }
}

static int RunPatchAccessibilitySmokeV08() {
  int code = 130;
  for (const auto& c : gControls) {
    if (!PatchNeedsExplicitNameV08(c)) continue;
    if (c.kind == CK_RADIO) {
      if (c.radioItems.size() != c.options.size()) return code++;
      for (size_t i = 0; i < c.options.size(); ++i) if (PatchReadAccessibleNameV08(c.radioItems[i]) != PatchRadioNameV08(c, c.options[i])) return code++;
      continue;
    }
    if (PatchReadAccessibleNameV08(c.hwnd) != PatchControlNameV08(c)) return code++;
  }
  return 0;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  PatchComScopeV08 patchCom;
  gInstance = instance;
  gGuiFont = (HFONT)GetStockObject(DEFAULT_GUI_FONT);
  gSmokeMode = HasArg(L"--patch-smoke");
  std::vector<uint8_t> payload;
  if (!ReadSelfPayload(payload) || !ParsePayload(payload)) return 20;
  INITCOMMONCONTROLSEX common{};
  common.dwSize = sizeof(common);
  common.dwICC = ICC_TAB_CLASSES;
  if (!InitCommonControlsEx(&common)) return 21;
  WNDCLASSEXW wc{};
  wc.cbSize = sizeof(wc);
  wc.hInstance = instance;
  wc.lpfnWndProc = WndProc;
  wc.lpszClassName = PATCH_WINDOW_CLASS;
  wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
  wc.hIcon = LoadIcon(nullptr, IDI_APPLICATION);
  wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  if (!RegisterClassExW(&wc)) return 22;
  if (!CreateForms()) return 23;
  ApplyPatchAccessibilityV08();
  RefreshUI();
  for (auto& f : gForms) if (f.visible) ShowWindow(f.hwnd, showCommand == 0 ? SW_SHOWNORMAL : showCommand);
  if (gSmokeMode) {
    const int base = RunSmoke();
    const int accessibility = base == 0 ? RunPatchAccessibilitySmokeV08() : base;
    ClearPatchAccessibilityV08();
    return accessibility;
  }
  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
  ClearPatchAccessibilityV08();
  return (int)msg.wParam;
}
