// Patch sealed Win32 GUI runtime v1.8.
// Payload v17 adds PaintBox draw image over payload-v16/runtime-v1.7.
#define PATCH_WIN32_RUNTIME_V18_RESTORE_ENTRY PatchRuntimeV17CompatibilityMain
#include "win32-sealed-gui-v17.cpp"
#undef wWinMain
#undef PATCH_WIN32_RUNTIME_V18_RESTORE_ENTRY
#include "sealed-paintbox-image-v18.hpp"

static std::vector<PatchPaintBoxV18> gPatchPaintImageBoxesV18;
static std::vector<HWND> gPatchPaintImageHwndsV18;
struct PatchPaintImageCacheEntryV18 {
  Image* image = nullptr;
  IStream* stream = nullptr;
};
static std::map<std::string, PatchPaintImageCacheEntryV18> gPatchPaintImagesV18;
static ATOM gPatchPaintBoxClassV18 = 0;

static bool ReadSelfPayloadV18(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH]; DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH); if (!n || n >= MAX_PATH) return false;
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr); if (file == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER size{}; if (!GetFileSizeEx(file, &size) || size.QuadPart < 20) { CloseHandle(file); return false; }
  LARGE_INTEGER pos{}; pos.QuadPart = size.QuadPart - 20; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  uint8_t footer[20]{}; DWORD got = 0; if (!ReadFile(file, footer, 20, &got, nullptr) || got != 20 || memcmp(footer, PATCH_MAGIC, 8) != 0) { CloseHandle(file); return false; }
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 17 || !length || (uint64_t)length > (uint64_t)(size.QuadPart - 20)) { CloseHandle(file); return false; }
  pos.QuadPart = size.QuadPart - 20 - length; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  payload.resize(length); got = 0; BOOL ok = ReadFile(file, payload.data(), length, &got, nullptr); CloseHandle(file);
  return ok && got == length && Crc32(payload.data(), payload.size()) == crc;
}

static Image* PatchPaintCachedImageV18(const std::string& source) {
  auto it = gPatchPaintImagesV18.find(source);
  if (it != gPatchPaintImagesV18.end()) return it->second.image;
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(source, picture) || picture.bytes.empty()) {
    gPatchPaintImagesV18[source] = {};
    return nullptr;
  }
  HGLOBAL heap = GlobalAlloc(GMEM_MOVEABLE, picture.bytes.size());
  if (!heap) return nullptr;
  void* locked = GlobalLock(heap);
  if (!locked) { GlobalFree(heap); return nullptr; }
  memcpy(locked, picture.bytes.data(), picture.bytes.size());
  GlobalUnlock(heap);
  IStream* stream = nullptr;
  if (CreateStreamOnHGlobal(heap, TRUE, &stream) != S_OK || !stream) { GlobalFree(heap); return nullptr; }
  Image* image = Image::FromStream(stream);
  if (!image || image->GetLastStatus() != Ok || image->GetWidth() == 0 || image->GetHeight() == 0) {
    delete image;
    stream->Release();
    gPatchPaintImagesV18[source] = {};
    return nullptr;
  }
  // GDI+ requires the source stream to remain alive for the Image lifetime.
  gPatchPaintImagesV18[source] = {image, stream};
  return image;
}

static void PatchDestroyPaintImagesV18() {
  for (auto& item : gPatchPaintImagesV18) {
    delete item.second.image;
    if (item.second.stream) item.second.stream->Release();
  }
  gPatchPaintImagesV18.clear();
}

static bool PatchResolvePaintImageBoxesV18() {
  for (const auto& item : gPatchPaintImageBoxesV18) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(PatchWideV11(item.id));
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    PatchPaintBoxV17 box;
    box.width = item.width;
    box.height = item.height;
    PatchPaintMetricsV17 metrics;
    if (!PatchPaintMetricsFromBoxV17(box, 320, 200, metrics)) return false;
  }
  return true;
}

static void PatchPaintDrawNodeV18(Graphics& g, const PatchPaintNodeV18& node, int loopCount, const PatchPaintMetricsV17& metrics) {
  auto number = [&](const std::string& expr, double min, double max, double& out) {
    if (!PatchPaintEvalNumberV17(expr, loopCount, out)) return false;
    if (!std::isfinite(out) || out < min || out > max) return false;
    return true;
  };
  if (node.operation == PATCH_PAINT_CLEAR_V18) {
    PatchColorV16 color;
    if (!PatchParseColorV16(node.color, true, color)) return;
    if (color.transparent) return;
    SolidBrush brush(PatchPaintGdiplusColorV17(color));
    g.FillRectangle(&brush, 0.0f, 0.0f, (REAL)metrics.width, (REAL)metrics.height);
    return;
  }
  if (node.operation == PATCH_PAINT_LINE_V18) {
    double x1 = 0, y1 = 0, x2 = 0, y2 = 0, strokeWidth = 0;
    PatchColorV16 stroke;
    if (!number(node.x1, -1e6, 1e6, x1) || !number(node.y1, -1e6, 1e6, y1) || !number(node.x2, -1e6, 1e6, x2) || !number(node.y2, -1e6, 1e6, y2)) return;
    if (!PatchParseColorV16(node.stroke, false, stroke) || !number(node.strokeWidth, 0, 64, strokeWidth) || strokeWidth <= 0) return;
    Pen pen(PatchPaintGdiplusColorV17(stroke), (REAL)strokeWidth);
    pen.SetLineCap(LineCapFlat, LineCapFlat, DashCapFlat);
    g.DrawLine(&pen, (REAL)PatchPaintMapX(metrics, x1), (REAL)PatchPaintMapY(metrics, y1), (REAL)PatchPaintMapX(metrics, x2), (REAL)PatchPaintMapY(metrics, y2));
    return;
  }
  if (node.operation == PATCH_PAINT_RECTANGLE_V18 || node.operation == PATCH_PAINT_ELLIPSE_V18) {
    double x = 0, y = 0, w = 0, h = 0, strokeWidth = 0;
    PatchColorV16 fill, stroke;
    if (!number(node.x, -1e6, 1e6, x) || !number(node.y, -1e6, 1e6, y) || !number(node.width, 0, 1e6, w) || !number(node.height, 0, 1e6, h)) return;
    if (!PatchParseColorV16(node.fill, true, fill) || !PatchParseColorV16(node.stroke, false, stroke) || !number(node.strokeWidth, 0, 64, strokeWidth)) return;
    const REAL dx = (REAL)PatchPaintMapX(metrics, x), dy = (REAL)PatchPaintMapY(metrics, y);
    const REAL dw = (REAL)PatchPaintMapW(metrics, w), dh = (REAL)PatchPaintMapH(metrics, h);
    SolidBrush brush(PatchPaintGdiplusColorV17(fill));
    Pen pen(PatchPaintGdiplusColorV17(stroke), (REAL)strokeWidth);
    pen.SetLineCap(LineCapFlat, LineCapFlat, DashCapFlat);
    if (node.operation == PATCH_PAINT_ELLIPSE_V18) {
      if (!fill.transparent) g.FillEllipse(&brush, dx, dy, dw, dh);
      if (strokeWidth > 0) g.DrawEllipse(&pen, dx, dy, dw, dh);
      return;
    }
    if (!fill.transparent) g.FillRectangle(&brush, dx, dy, dw, dh);
    if (strokeWidth > 0) g.DrawRectangle(&pen, dx, dy, dw, dh);
    return;
  }
  if (node.operation == PATCH_PAINT_TEXT_V18) {
    std::string text;
    double x = 0, y = 0, fontSize = 0;
    PatchColorV16 color;
    if (!PatchPaintEvalTextV17(node.textExpr, loopCount, text)) return;
    if (!number(node.x, -1e6, 1e6, x) || !number(node.y, -1e6, 1e6, y) || !number(node.fontSize, 1, 512, fontSize)) return;
    if (!PatchParseColorV16(node.color, false, color)) return;
    Font font(L"Segoe UI", (REAL)PatchPaintMapFont(metrics, fontSize), FontStyleRegular, UnitPixel);
    SolidBrush brush(PatchPaintGdiplusColorV17(color));
    StringFormat format;
    format.SetAlignment(StringAlignmentNear);
    format.SetLineAlignment(StringAlignmentNear);
    std::wstring wide = PatchWideV11(text);
    g.DrawString(wide.c_str(), -1, &font, PointF((REAL)PatchPaintMapX(metrics, x), (REAL)PatchPaintMapY(metrics, y)), &format, &brush);
    return;
  }
  if (node.operation == PATCH_PAINT_IMAGE_V18) {
    double x = 0, y = 0, w = 0, h = 0;
    if (!number(node.x, -1e6, 1e6, x) || !number(node.y, -1e6, 1e6, y) || !number(node.width, 0, 1e6, w) || !number(node.height, 0, 1e6, h) || w <= 0 || h <= 0) return;
    Image* image = PatchPaintCachedImageV18(node.source);
    if (!image) return;
    g.DrawImage(image, (REAL)PatchPaintMapX(metrics, x), (REAL)PatchPaintMapY(metrics, y), (REAL)PatchPaintMapW(metrics, w), (REAL)PatchPaintMapH(metrics, h));
  }
}

static void PatchPaintBoxV18(Graphics& g, const PatchPaintBoxV18& item, int width, int height) {
  PatchPaintMetricsV17 metrics;
  PatchPaintBoxV17 box;
  box.width = item.width;
  box.height = item.height;
  if (!PatchPaintMetricsFromBoxV17(box, (double)std::max(1, width), (double)std::max(1, height), metrics)) return;
  g.SetSmoothingMode(SmoothingModeAntiAlias);
  g.SetTextRenderingHint(TextRenderingHintAntiAlias);
  PatchPaintRunProgramV18(item.program, 0, [&](const PatchPaintNodeV18& node, int loopCount) {
    PatchPaintDrawNodeV18(g, node, loopCount, metrics);
  });
}

static LRESULT CALLBACK PatchPaintBoxWndProcV18(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (msg == WM_PAINT) {
    PAINTSTRUCT ps{};
    HDC hdc = BeginPaint(hwnd, &ps);
    RECT client{}; GetClientRect(hwnd, &client);
    const int nativeIndex = (int)(INT_PTR)GetWindowLongPtrW(hwnd, GWLP_USERDATA);
    const PatchPaintBoxV18* item = PatchPaintBoxForNativeIndexV18(gPatchPaintImageBoxesV18, nativeIndex);
    if (item) {
      Graphics g(hdc);
      PatchPaintBoxV18(g, *item, client.right - client.left, client.bottom - client.top);
    }
    EndPaint(hwnd, &ps);
    return 0;
  }
  if (msg == WM_ERASEBKGND) return 1;
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static bool PatchRegisterPaintBoxClassV18(HINSTANCE instance) {
  if (gPatchPaintBoxClassV18) return true;
  WNDCLASSW wc{};
  wc.lpfnWndProc = PatchPaintBoxWndProcV18;
  wc.hInstance = instance;
  wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
  wc.hbrBackground = (HBRUSH)GetStockObject(NULL_BRUSH);
  wc.lpszClassName = L"PatchPaintBoxV18";
  gPatchPaintBoxClassV18 = RegisterClassW(&wc);
  return gPatchPaintBoxClassV18 != 0;
}

static bool PatchInstallPaintImageBoxesV18(HINSTANCE instance) {
  gPatchPaintImageHwndsV18.assign(gControls.size(), nullptr);
  if (!gPatchPaintImageBoxesV18.empty() && !PatchRegisterPaintBoxClassV18(instance)) return false;
  for (const auto& item : gPatchPaintImageBoxesV18) {
    HWND underlay = item.nativeIndex >= 0 && item.nativeIndex < (int)gPatchPaintBoxHwndsV17.size() ? gPatchPaintBoxHwndsV17[(size_t)item.nativeIndex] : nullptr;
    auto& c = gControls[(size_t)item.nativeIndex];
    HWND host = underlay ? underlay : c.hwnd;
    if (!host) return false;
    HWND parent = GetParent(host); if (!parent) return false;
    RECT rect{}; if (!GetWindowRect(host, &rect)) return false;
    POINT points[2] = {{rect.left, rect.top}, {rect.right, rect.bottom}};
    MapWindowPoints(nullptr, parent, points, 2);
    const int x = points[0].x, y = points[0].y, w = std::max(1, points[1].x - points[0].x), h = std::max(1, points[1].y - points[0].y);
    HWND native = CreateWindowExW(0, L"PatchPaintBoxV18", L"", WS_CHILD | WS_VISIBLE, x, y, w, h, parent, nullptr, instance, nullptr);
    if (!native) return false;
    SetWindowLongPtrW(native, GWLP_USERDATA, (LONG_PTR)item.nativeIndex);
    PatchSetAccessibleNameV09(native, PatchControlNameV09(c) + L" drawing surface");
    gPatchPaintImageHwndsV18[(size_t)item.nativeIndex] = native;
    ShowWindow(host, SW_HIDE);
    if (c.hwnd) ShowWindow(c.hwnd, SW_HIDE);
  }
  return true;
}

static void PatchRefreshPaintImageBoxesV18() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchPaintImageBoxesV18) {
    auto& c = gControls[(size_t)item.nativeIndex];
    HWND native = gPatchPaintImageHwndsV18[(size_t)item.nativeIndex];
    HWND underlay = item.nativeIndex >= 0 && item.nativeIndex < (int)gPatchPaintBoxHwndsV17.size() ? gPatchPaintBoxHwndsV17[(size_t)item.nativeIndex] : nullptr;
    HWND host = underlay ? underlay : c.hwnd;
    if (!host || !native) continue;
    HWND parent = GetParent(host);
    RECT rect{};
    if (parent && GetWindowRect(host, &rect)) {
      POINT points[2] = {{rect.left, rect.top}, {rect.right, rect.bottom}};
      MapWindowPoints(nullptr, parent, points, 2);
      MoveWindow(native, points[0].x, points[0].y, std::max(1, points[1].x - points[0].x), std::max(1, points[1].y - points[0].y), TRUE);
    }
    bool visible = true;
    if (c.parentTabIndex >= 0 && c.parentTabIndex < (int)gControls.size()) visible = gControls[(size_t)c.parentTabIndex].selectedPage == c.pageIndex;
    ShowWindow(native, visible ? SW_SHOW : SW_HIDE);
    ShowWindow(host, SW_HIDE);
    if (c.hwnd) ShowWindow(c.hwnd, SW_HIDE);
    InvalidateRect(native, nullptr, TRUE);
  }
  gRefreshing = previous;
}

static LRESULT CALLBACK PatchWndProcV18(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  LRESULT result = PatchWndProcV17(hwnd, msg, wParam, lParam);
  if (msg == WM_COMMAND || msg == WM_NOTIFY || msg == WM_SIZE || msg == WM_HSCROLL || msg == WM_TIMER) {
    PatchRefreshPaintBoxesV17();
    PatchRefreshPaintImageBoxesV18();
  }
  return result;
}

static int RunPatchPaintBoxImageSmokeV18() {
  int code = 410;
  for (const auto& item : gPatchPaintImageBoxesV18) {
    HWND native = gPatchPaintImageHwndsV18[(size_t)item.nativeIndex];
    if (!native) return code++;
    const std::string* source = PatchPaintFirstImageSourceV18(item.program);
    if (!source) return code++;
    Image* image = PatchPaintCachedImageV18(*source);
    if (!image || image->GetLastStatus() != Ok || image->GetWidth() == 0 || image->GetHeight() == 0) return code++;
  }
  return 0;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, LPWSTR, int showCommand) {
  GdiplusStartupInput gdiplusStartupInput;
  if (GdiplusStartup(&gPatchGdiplusTokenV16, &gdiplusStartupInput, nullptr) != Ok) return 21;
  PatchComScopeV09 patchCom;
  if (FAILED(patchCom.result) && patchCom.result != RPC_E_CHANGED_MODE) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  gInstance = instance; gSmokeMode = HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV18(payloadV17) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 20; }
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18()) { GdiplusShutdown(gPatchGdiplusTokenV16); return 22; }
  PatchSyncListShadowsV11();
  INITCOMMONCONTROLSEX common{}; common.dwSize = sizeof(common); common.dwICC = ICC_WIN95_CLASSES | ICC_LISTVIEW_CLASSES | ICC_TAB_CLASSES | ICC_TREEVIEW_CLASSES | ICC_BAR_CLASSES;
  if (!InitCommonControlsEx(&common)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  WNDCLASSW wc{}; wc.lpfnWndProc = PatchWndProcV18; wc.hInstance = instance; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  PATCH_WINDOW_CLASS = L"PatchSealedNativeWindowV18"; wc.lpszClassName = PATCH_WINDOW_CLASS; if (!RegisterClassW(&wc)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  NONCLIENTMETRICSW metrics{}; metrics.cbSize = sizeof(metrics);
  if (SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, sizeof(metrics), &metrics, 0)) gGuiFont = CreateFontIndirectW(&metrics.lfMessageFont);
  if (!CreateFormsV09() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchInstallTreesV13() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16(instance) || !PatchInstallPaintBoxesV17(instance) || !PatchInstallPaintImageBoxesV18(instance) || !PatchInstallMenusV12()) { GdiplusShutdown(gPatchGdiplusTokenV16); PatchDestroyPaintImagesV18(); return 21; }
  for (auto& form : gForms) SetWindowLongPtrW(form.hwnd, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(PatchWndProcV18));
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16(); PatchRefreshPaintBoxesV17(); PatchRefreshPaintImageBoxesV18();
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
    if (!result) result = RunPatchPaintBoxSmokeV17();
    if (!result) result = RunPatchPaintBoxImageSmokeV18();
    if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
    PatchDestroyChromeImagesV15();
    PatchDestroyPaintImagesV18();
    if (gGuiFont) DeleteObject(gGuiFont);
    GdiplusShutdown(gPatchGdiplusTokenV16);
    return result;
  }
  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) { if (PatchTranslateMenuAcceleratorV12(&msg)) continue; TranslateMessage(&msg); DispatchMessageW(&msg); }
  if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
  PatchDestroyChromeImagesV15();
  PatchDestroyPaintImagesV18();
  if (gGuiFont) DeleteObject(gGuiFont);
  GdiplusShutdown(gPatchGdiplusTokenV16);
  return 0;
}
