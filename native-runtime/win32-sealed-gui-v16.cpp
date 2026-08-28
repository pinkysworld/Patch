// Patch sealed Win32 GUI runtime v1.6.
// Payload v15 adds Shape Stage 1 rectangle/rounded/ellipse/line over payload-v14/runtime-v1.5.
#define PATCH_WIN32_RUNTIME_V16_RESTORE_ENTRY PatchRuntimeV15CompatibilityMain
#include "win32-sealed-gui-v15.cpp"
#undef wWinMain
#undef PATCH_WIN32_RUNTIME_V16_RESTORE_ENTRY
#include <gdiplus.h>
#include "sealed-shape-v16.hpp"

#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "msimg32.lib")

using namespace Gdiplus;

static std::vector<PatchShapeV16> gPatchShapesV16;
static std::vector<HWND> gPatchShapeHwndsV16;
static ULONG_PTR gPatchGdiplusTokenV16 = 0;
static ATOM gPatchShapeClassV16 = 0;

static bool ReadSelfPayloadV16(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH]; DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH); if (!n || n >= MAX_PATH) return false;
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr); if (file == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER size{}; if (!GetFileSizeEx(file, &size) || size.QuadPart < 20) { CloseHandle(file); return false; }
  LARGE_INTEGER pos{}; pos.QuadPart = size.QuadPart - 20; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  uint8_t footer[20]{}; DWORD got = 0; if (!ReadFile(file, footer, 20, &got, nullptr) || got != 20 || memcmp(footer, PATCH_MAGIC, 8) != 0) { CloseHandle(file); return false; }
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 15 || !length || (uint64_t)length > (uint64_t)(size.QuadPart - 20)) { CloseHandle(file); return false; }
  pos.QuadPart = size.QuadPart - 20 - length; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  payload.resize(length); got = 0; BOOL ok = ReadFile(file, payload.data(), length, &got, nullptr); CloseHandle(file);
  return ok && got == length && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchResolveShapesV16() {
  for (const auto& item : gPatchShapesV16) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(PatchWideV11(item.id));
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    const auto& c = gControls[(size_t)item.nativeIndex];
    if (c.kind != CK_TEXT || c.hwnd) return false;
    PatchColorV16 fill, stroke; double strokeWidth = 0, cornerRadius = 0, opacity = 1;
    if (!PatchShapeStyleV16(item, fill, stroke, strokeWidth, cornerRadius, opacity)) return false;
  }
  return true;
}

static Color PatchGdiplusColorV16(const PatchColorV16& color) {
  if (color.transparent) return Color(0, color.r, color.g, color.b);
  return Color(color.a, color.r, color.g, color.b);
}

static void PatchPaintShapeV16(Graphics& g, const PatchShapeV16& item, int width, int height) {
  PatchColorV16 fill, stroke; double strokeWidth = 0, cornerRadius = 0, opacity = 1;
  if (!PatchShapeStyleV16(item, fill, stroke, strokeWidth, cornerRadius, opacity)) return;
  g.SetSmoothingMode(SmoothingModeAntiAlias);
  const REAL x = (REAL)(width * 0.01), y = (REAL)(height * 0.01), w = (REAL)(width * 0.98), h = (REAL)(height * 0.98);
  SolidBrush brush(PatchGdiplusColorV16(fill));
  Pen pen(PatchGdiplusColorV16(stroke), (REAL)strokeWidth);
  pen.SetLineCap(LineCapFlat, LineCapFlat, DashCapFlat);
  if (item.kind == PATCH_SHAPE_ELLIPSE_V16) {
    if (!fill.transparent) g.FillEllipse(&brush, x, y, w, h);
    if (strokeWidth > 0) g.DrawEllipse(&pen, x, y, w, h);
    return;
  }
  if (item.kind == PATCH_SHAPE_LINE_V16) {
    if (strokeWidth > 0) g.DrawLine(&pen, 0.0f, (REAL)height / 2.0f, (REAL)width, (REAL)height / 2.0f);
    return;
  }
  const REAL rx = (REAL)(cornerRadius * width / 100.0);
  const REAL ry = (REAL)(cornerRadius * height / 100.0);
  if (item.kind == PATCH_SHAPE_ROUNDED_V16 && (rx > 0 || ry > 0)) {
    GraphicsPath path;
    const REAL diameterX = rx * 2.0f, diameterY = ry * 2.0f;
    path.AddArc(x, y, diameterX, diameterY, 180, 90);
    path.AddArc(x + w - diameterX, y, diameterX, diameterY, 270, 90);
    path.AddArc(x + w - diameterX, y + h - diameterY, diameterX, diameterY, 0, 90);
    path.AddArc(x, y + h - diameterY, diameterX, diameterY, 90, 90);
    path.CloseFigure();
    if (!fill.transparent) g.FillPath(&brush, &path);
    if (strokeWidth > 0) g.DrawPath(&pen, &path);
    return;
  }
  if (!fill.transparent) g.FillRectangle(&brush, x, y, w, h);
  if (strokeWidth > 0) g.DrawRectangle(&pen, x, y, w, h);
}

static LRESULT CALLBACK PatchShapeWndProcV16(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (msg == WM_PAINT) {
    PAINTSTRUCT ps{};
    HDC hdc = BeginPaint(hwnd, &ps);
    RECT client{}; GetClientRect(hwnd, &client);
    const int nativeIndex = (int)(INT_PTR)GetWindowLongPtrW(hwnd, GWLP_USERDATA);
    const PatchShapeV16* item = PatchShapeForNativeIndexV16(gPatchShapesV16, nativeIndex);
    if (item) {
      Graphics g(hdc);
      PatchPaintShapeV16(g, *item, client.right - client.left, client.bottom - client.top);
    }
    EndPaint(hwnd, &ps);
    return 0;
  }
  if (msg == WM_ERASEBKGND) return 1;
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static bool PatchRegisterShapeClassV16(HINSTANCE instance) {
  if (gPatchShapeClassV16) return true;
  WNDCLASSW wc{};
  wc.lpfnWndProc = PatchShapeWndProcV16;
  wc.hInstance = instance;
  wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
  wc.hbrBackground = (HBRUSH)GetStockObject(NULL_BRUSH);
  wc.lpszClassName = L"PatchShapeV16";
  gPatchShapeClassV16 = RegisterClassW(&wc);
  return gPatchShapeClassV16 != 0;
}

static bool PatchInstallShapesV16(HINSTANCE instance) {
  gPatchShapeHwndsV16.assign(gControls.size(), nullptr);
  if (!gPatchShapesV16.empty() && !PatchRegisterShapeClassV16(instance)) return false;
  for (const auto& item : gPatchShapesV16) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.hwnd) return false;
    HWND parent = GetParent(c.hwnd); if (!parent) return false;
    RECT rect{}; if (!GetWindowRect(c.hwnd, &rect)) return false;
    POINT points[2] = {{rect.left, rect.top}, {rect.right, rect.bottom}};
    MapWindowPoints(nullptr, parent, points, 2);
    const int x = points[0].x, y = points[0].y, w = std::max(1, points[1].x - points[0].x), h = std::max(1, points[1].y - points[0].y);
    HWND native = CreateWindowExW(WS_EX_TRANSPARENT, L"PatchShapeV16", L"", WS_CHILD | WS_VISIBLE, x, y, w, h, parent, nullptr, instance, nullptr);
    if (!native) return false;
    SetWindowLongPtrW(native, GWLP_USERDATA, (LONG_PTR)item.nativeIndex);
    PatchSetAccessibleNameV09(native, PatchControlNameV09(c) + L" shape");
    gPatchShapeHwndsV16[(size_t)item.nativeIndex] = native;
    ShowWindow(c.hwnd, SW_HIDE);
  }
  return true;
}

static void PatchRefreshShapesV16() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchShapesV16) {
    auto& c = gControls[(size_t)item.nativeIndex];
    HWND native = gPatchShapeHwndsV16[(size_t)item.nativeIndex];
    if (!c.hwnd || !native) continue;
    HWND parent = GetParent(c.hwnd);
    RECT rect{};
    if (parent && GetWindowRect(c.hwnd, &rect)) {
      POINT points[2] = {{rect.left, rect.top}, {rect.right, rect.bottom}};
      MapWindowPoints(nullptr, parent, points, 2);
      MoveWindow(native, points[0].x, points[0].y, std::max(1, points[1].x - points[0].x), std::max(1, points[1].y - points[0].y), TRUE);
    }
    bool visible = true;
    if (c.parentTabIndex >= 0 && c.parentTabIndex < (int)gControls.size()) visible = gControls[(size_t)c.parentTabIndex].selectedPage == c.pageIndex;
    ShowWindow(native, visible ? SW_SHOW : SW_HIDE);
    ShowWindow(c.hwnd, SW_HIDE);
    InvalidateRect(native, nullptr, TRUE);
  }
  gRefreshing = previous;
}

static LRESULT CALLBACK PatchWndProcV16(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  LRESULT result = PatchWndProcV15(hwnd, msg, wParam, lParam);
  if (msg == WM_COMMAND || msg == WM_NOTIFY || msg == WM_SIZE || msg == WM_HSCROLL || msg == WM_TIMER) PatchRefreshShapesV16();
  return result;
}

static int RunPatchShapeSmokeV16() {
  int code = 380;
  for (const auto& item : gPatchShapesV16) {
    HWND native = gPatchShapeHwndsV16[(size_t)item.nativeIndex];
    if (!native) return code++;
  }
  return 0;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, LPWSTR, int showCommand) {
  GdiplusStartupInput gdiplusStartupInput;
  if (GdiplusStartup(&gPatchGdiplusTokenV16, &gdiplusStartupInput, nullptr) != Ok) return 21;
  PatchComScopeV09 patchCom;
  if (FAILED(patchCom.result) && patchCom.result != RPC_E_CHANGED_MODE) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  gInstance = instance; gSmokeMode = HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV16(payloadV15) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 20; }
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16()) { GdiplusShutdown(gPatchGdiplusTokenV16); return 22; }
  PatchSyncListShadowsV11();
  INITCOMMONCONTROLSEX common{}; common.dwSize = sizeof(common); common.dwICC = ICC_WIN95_CLASSES | ICC_LISTVIEW_CLASSES | ICC_TAB_CLASSES | ICC_TREEVIEW_CLASSES | ICC_BAR_CLASSES;
  if (!InitCommonControlsEx(&common)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  WNDCLASSW wc{}; wc.lpfnWndProc = PatchWndProcV16; wc.hInstance = instance; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  PATCH_WINDOW_CLASS = L"PatchSealedNativeWindowV16"; wc.lpszClassName = PATCH_WINDOW_CLASS; if (!RegisterClassW(&wc)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  NONCLIENTMETRICSW metrics{}; metrics.cbSize = sizeof(metrics);
  if (SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, sizeof(metrics), &metrics, 0)) gGuiFont = CreateFontIndirectW(&metrics.lfMessageFont);
  if (!CreateFormsV09() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchInstallTreesV13() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16(instance) || !PatchInstallMenusV12()) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  for (auto& form : gForms) SetWindowLongPtrW(form.hwnd, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(PatchWndProcV16));
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16();
  for (auto& form : gForms) if (form.visible) ShowWindow(form.hwnd, showCommand == 0 ? SW_SHOWNORMAL : showCommand);
  if (gSmokeMode) {
    int result = RunSmoke();
    if (!result) result = RunPatchAccessibilitySmokeV09();
    if (!result) result = RunPatchTableAccessibilitySmokeV10();
    if (!result) result = RunPatchResponsiveSmokeV09();
    if (!result) result = RunPatchTableSmokeV10();
    if (!result) result = RunPatchListSmokeV11();
    if (!result) result = RunPatchMenuSmokeV12();
    if (!result) result = RunPatchTreeSmokeV13();
    if (!result) result = RunPatchSliderSmokeV14();
    if (!result) result = RunPatchChromeSmokeV15();
    if (!result) result = RunPatchShapeSmokeV16();
    if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
    PatchDestroyChromeImagesV15();
    if (gGuiFont) DeleteObject(gGuiFont);
    GdiplusShutdown(gPatchGdiplusTokenV16);
    return result;
  }
  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) { if (PatchTranslateMenuAcceleratorV12(&msg)) continue; TranslateMessage(&msg); DispatchMessageW(&msg); }
  if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
  PatchDestroyChromeImagesV15();
  if (gGuiFont) DeleteObject(gGuiFont);
  GdiplusShutdown(gPatchGdiplusTokenV16);
  return 0;
}
