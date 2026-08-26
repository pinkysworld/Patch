// Patch sealed Win32 GUI runtime v1.5.
// Payload v14 adds Chrome Stage 1 Panel/Timer/PictureBox/StatusBar over payload-v13/runtime-v1.4.
#define PATCH_WIN32_RUNTIME_V15_RESTORE_ENTRY PatchRuntimeV14CompatibilityMain
#include "win32-sealed-gui-v14.cpp"
#undef wWinMain
#undef PATCH_WIN32_RUNTIME_V15_RESTORE_ENTRY
#include <wincodec.h>
#include "sealed-chrome-v15.hpp"
#include "picture-data-v15.hpp"

#pragma comment(lib, "windowscodecs.lib")

struct PatchWinChromeV15 {
  HWND hwnd = nullptr;
  UINT_PTR timerId = 0;
  HBITMAP bitmap = nullptr;
  int bitmapWidth = 0;
  int bitmapHeight = 0;
};
static std::vector<PatchChromeV15> gPatchChromeV15;
static std::vector<PatchWinChromeV15> gPatchWinChromeV15;
static int gPatchChromeDispatchCountV15 = 0;
static HWND gPatchChromeHostV15 = nullptr;

static bool ReadSelfPayloadV15(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH]; DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH); if (!n || n >= MAX_PATH) return false;
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr); if (file == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER size{}; if (!GetFileSizeEx(file, &size) || size.QuadPart < 20) { CloseHandle(file); return false; }
  LARGE_INTEGER pos{}; pos.QuadPart = size.QuadPart - 20; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  uint8_t footer[20]{}; DWORD got = 0; if (!ReadFile(file, footer, 20, &got, nullptr) || got != 20 || memcmp(footer, PATCH_MAGIC, 8) != 0) { CloseHandle(file); return false; }
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 14 || !length || (uint64_t)length > (uint64_t)(size.QuadPart - 20)) { CloseHandle(file); return false; }
  pos.QuadPart = size.QuadPart - 20 - length; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  payload.resize(length); got = 0; BOOL ok = ReadFile(file, payload.data(), length, &got, nullptr); CloseHandle(file);
  return ok && got == length && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchChromeShadowKindV15(const PatchChromeV15& item, uint8_t kind) {
  if (item.kind == PATCH_CHROME_PANEL_V15 || item.kind == PATCH_CHROME_STATUS_V15) return kind == CK_TEXT;
  if (item.kind == PATCH_CHROME_TIMER_V15 || item.kind == PATCH_CHROME_PICTURE_V15) return kind == CK_BUTTON;
  return false;
}

static bool PatchResolveChromeV15() {
  for (const auto& item : gPatchChromeV15) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(PatchWideV11(item.id));
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    const auto& c = gControls[(size_t)item.nativeIndex];
    if (!PatchChromeShadowKindV15(item, c.kind) || c.hwnd) return false;
    for (const auto& patch : item.events) {
      if (patch.eventIndex >= gEvents.size()) return false;
      const auto& event = gEvents[(size_t)patch.eventIndex];
      if (event.control != PatchWideV11(item.id)) return false;
      if (item.kind == PATCH_CHROME_TIMER_V15 && (patch.event != "ticked" || event.kind != EV_CLICKED)) return false;
      if (item.kind == PATCH_CHROME_PICTURE_V15 && (patch.event != "clicked" || event.kind != EV_CLICKED)) return false;
    }
  }
  return true;
}

static bool PatchChromeVisibleV15(const Control& c) {
  if (c.parentTabIndex >= 0 && c.parentTabIndex < (int)gControls.size()) return gControls[(size_t)c.parentTabIndex].selectedPage == c.pageIndex;
  return true;
}

static std::wstring PatchChromeCaptionV15(const PatchChromeV15& item) {
  if (!item.binding.empty()) {
    auto it = gStateByName.find(PatchWideV11(item.binding));
    if (it != gStateByName.end()) {
      const auto& state = gStates[(size_t)it->second];
      if (state.type == ST_TEXT) return RenderText(state.text);
    }
  }
  return RenderText(PatchWideV11(item.text));
}

static HBITMAP PatchPictureBitmapV15(const PatchChromeV15& item, int controlWidth, int controlHeight, int& renderedWidth, int& renderedHeight) {
  renderedWidth = renderedHeight = 0;
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(item.source, picture) || picture.bytes.empty()) return nullptr;

  IWICImagingFactory* factory = nullptr;
  IWICStream* stream = nullptr;
  IWICBitmapDecoder* decoder = nullptr;
  IWICBitmapFrameDecode* frame = nullptr;
  IWICBitmapScaler* scaler = nullptr;
  IWICFormatConverter* converter = nullptr;
  HBITMAP bitmap = nullptr;

  auto releaseAll = [&]() {
    if (converter) converter->Release();
    if (scaler) scaler->Release();
    if (frame) frame->Release();
    if (decoder) decoder->Release();
    if (stream) stream->Release();
    if (factory) factory->Release();
  };

  HRESULT hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&factory));
  if (FAILED(hr)) { releaseAll(); return nullptr; }
  hr = factory->CreateStream(&stream);
  if (FAILED(hr)) { releaseAll(); return nullptr; }
  hr = stream->InitializeFromMemory(picture.bytes.data(), (DWORD)picture.bytes.size());
  if (FAILED(hr)) { releaseAll(); return nullptr; }
  hr = factory->CreateDecoderFromStream(stream, nullptr, WICDecodeMetadataCacheOnLoad, &decoder);
  if (FAILED(hr)) { releaseAll(); return nullptr; }
  hr = decoder->GetFrame(0, &frame);
  if (FAILED(hr)) { releaseAll(); return nullptr; }

  UINT sourceWidth = 0, sourceHeight = 0;
  hr = frame->GetSize(&sourceWidth, &sourceHeight);
  if (FAILED(hr) || !sourceWidth || !sourceHeight) { releaseAll(); return nullptr; }
  int targetWidth = std::max(1, controlWidth);
  int targetHeight = std::max(1, (int)(((uint64_t)sourceHeight * (uint64_t)targetWidth) / sourceWidth));
  if (targetHeight > std::max(1, controlHeight)) {
    targetHeight = std::max(1, controlHeight);
    targetWidth = std::max(1, (int)(((uint64_t)sourceWidth * (uint64_t)targetHeight) / sourceHeight));
  }

  hr = factory->CreateBitmapScaler(&scaler);
  if (FAILED(hr)) { releaseAll(); return nullptr; }
  hr = scaler->Initialize(frame, (UINT)targetWidth, (UINT)targetHeight, WICBitmapInterpolationModeFant);
  if (FAILED(hr)) { releaseAll(); return nullptr; }
  hr = factory->CreateFormatConverter(&converter);
  if (FAILED(hr)) { releaseAll(); return nullptr; }
  hr = converter->Initialize(scaler, GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone, nullptr, 0.0, WICBitmapPaletteTypeCustom);
  if (FAILED(hr)) { releaseAll(); return nullptr; }

  const UINT stride = (UINT)targetWidth * 4;
  std::vector<BYTE> pixels((size_t)stride * (size_t)targetHeight);
  hr = converter->CopyPixels(nullptr, stride, (UINT)pixels.size(), pixels.data());
  if (FAILED(hr)) { releaseAll(); return nullptr; }

  BITMAPINFO info{};
  info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  info.bmiHeader.biWidth = targetWidth;
  info.bmiHeader.biHeight = -targetHeight;
  info.bmiHeader.biPlanes = 1;
  info.bmiHeader.biBitCount = 32;
  info.bmiHeader.biCompression = BI_RGB;
  void* bits = nullptr;
  bitmap = CreateDIBSection(nullptr, &info, DIB_RGB_COLORS, &bits, nullptr, 0);
  if (!bitmap || !bits) {
    if (bitmap) DeleteObject(bitmap);
    releaseAll();
    return nullptr;
  }
  memcpy(bits, pixels.data(), pixels.size());
  renderedWidth = targetWidth;
  renderedHeight = targetHeight;
  releaseAll();
  return bitmap;
}

static bool PatchSetPictureBitmapV15(const PatchChromeV15& item, PatchWinChromeV15& native, int width, int height) {
  int renderedWidth = 0, renderedHeight = 0;
  HBITMAP bitmap = PatchPictureBitmapV15(item, width, height, renderedWidth, renderedHeight);
  if (!bitmap) return false;
  HBITMAP old = native.bitmap;
  native.bitmap = bitmap;
  native.bitmapWidth = width;
  native.bitmapHeight = height;
  SendMessageW(native.hwnd, STM_SETIMAGE, IMAGE_BITMAP, (LPARAM)bitmap);
  if (old) DeleteObject(old);
  return true;
}

static void PatchDestroyChromeImagesV15() {
  for (auto& native : gPatchWinChromeV15) {
    if (native.bitmap) DeleteObject(native.bitmap);
    native.bitmap = nullptr;
  }
}

static bool PatchInstallChromeV15() {
  gPatchWinChromeV15.assign(gControls.size(), {});
  if (!gForms.empty()) gPatchChromeHostV15 = gForms[0].hwnd;
  for (const auto& item : gPatchChromeV15) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.hwnd) return false;
    HWND parent = GetParent(c.hwnd); if (!parent) return false;
    RECT rect{}; if (!GetWindowRect(c.hwnd, &rect)) return false;
    POINT points[2] = {{rect.left, rect.top}, {rect.right, rect.bottom}};
    MapWindowPoints(nullptr, parent, points, 2);
    const int x = points[0].x, y = points[0].y, w = points[1].x - points[0].x, h = points[1].y - points[0].y;
    HWND native = nullptr;
    if (item.kind == PATCH_CHROME_PANEL_V15) {
      native = CreateWindowExW(0, L"BUTTON", PatchChromeCaptionV15(item).c_str(), WS_CHILD | WS_VISIBLE | BS_GROUPBOX, x, y, w, h, parent, nullptr, gInstance, nullptr);
    } else if (item.kind == PATCH_CHROME_TIMER_V15) {
      if (!gPatchChromeHostV15) return false;
      UINT_PTR timerId = 2000 + (UINT_PTR)item.nativeIndex;
      if (!SetTimer(gPatchChromeHostV15, timerId, item.interval, nullptr)) return false;
      gPatchWinChromeV15[(size_t)item.nativeIndex].timerId = timerId;
      ShowWindow(c.hwnd, SW_HIDE);
      continue;
    } else if (item.kind == PATCH_CHROME_PICTURE_V15) {
      DWORD style = WS_CHILD | WS_VISIBLE | SS_NOTIFY | SS_CENTERIMAGE;
      if (PatchPictureEmbeddedSourceV15(item.source)) style |= SS_BITMAP;
      else style |= SS_CENTER;
      native = CreateWindowExW(0, L"STATIC", PatchPictureEmbeddedSourceV15(item.source) ? L"" : PatchChromeCaptionV15(item).c_str(), style, x, y, w, h, parent, reinterpret_cast<HMENU>((INT_PTR)c.commandId), gInstance, nullptr);
    } else {
      native = CreateWindowExW(0, STATUSCLASSNAMEW, PatchChromeCaptionV15(item).c_str(), WS_CHILD | WS_VISIBLE, x, y, w, h, parent, nullptr, gInstance, nullptr);
    }
    if (!native) return false;
    if (gGuiFont) SendMessageW(native, WM_SETFONT, (WPARAM)gGuiFont, TRUE);
    auto& installed = gPatchWinChromeV15[(size_t)item.nativeIndex];
    installed.hwnd = native;
    if (item.kind == PATCH_CHROME_PICTURE_V15) {
      PatchSetAccessibleNameV09(native, PatchControlNameV09(c));
      if (PatchPictureEmbeddedSourceV15(item.source) && !PatchSetPictureBitmapV15(item, installed, w, h)) return false;
    }
    ShowWindow(c.hwnd, SW_HIDE);
  }
  return true;
}

static void PatchRefreshChromeV15() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchChromeV15) {
    auto& c = gControls[(size_t)item.nativeIndex];
    auto& native = gPatchWinChromeV15[(size_t)item.nativeIndex];
    if (item.kind == PATCH_CHROME_TIMER_V15) { ShowWindow(c.hwnd, SW_HIDE); continue; }
    if (!c.hwnd || !native.hwnd) continue;
    HWND parent = GetParent(c.hwnd);
    RECT rect{};
    int width = 0, height = 0;
    if (parent && GetWindowRect(c.hwnd, &rect)) {
      POINT points[2] = {{rect.left, rect.top}, {rect.right, rect.bottom}};
      MapWindowPoints(nullptr, parent, points, 2);
      width = points[1].x - points[0].x; height = points[1].y - points[0].y;
      MoveWindow(native.hwnd, points[0].x, points[0].y, width, height, TRUE);
    }
    if (item.kind == PATCH_CHROME_PICTURE_V15 && PatchPictureEmbeddedSourceV15(item.source)) {
      if (width > 0 && height > 0 && (native.bitmapWidth != width || native.bitmapHeight != height)) PatchSetPictureBitmapV15(item, native, width, height);
    } else {
      SetWindowTextW(native.hwnd, PatchChromeCaptionV15(item).c_str());
    }
    bool visible = PatchChromeVisibleV15(c);
    ShowWindow(native.hwnd, visible ? SW_SHOW : SW_HIDE);
    ShowWindow(c.hwnd, SW_HIDE);
  }
  gRefreshing = previous;
}

static bool PatchExecuteChromeEventV15(const PatchChromeV15& item, const PatchChromeEventPatchV15& patch) {
  if (patch.eventIndex >= gEvents.size()) return false;
  PatchExecuteEventV11(gEvents[(size_t)patch.eventIndex], false, L"", nullptr);
  ++gPatchChromeDispatchCountV15;
  return true;
}

static bool PatchDispatchChromeV15(const PatchChromeV15& item) {
  if (gRefreshing) return false;
  for (const auto& patch : item.events) if (!PatchExecuteChromeEventV15(item, patch)) return false;
  PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15();
  return true;
}

static bool PatchHandleTimerV15(UINT_PTR timerId) {
  if (!timerId) return false;
  for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId == timerId) return PatchDispatchChromeV15(item);
  return false;
}

static LRESULT CALLBACK PatchWndProcV15(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (msg == WM_TIMER && PatchHandleTimerV15((UINT_PTR)wParam)) return 0;
  LRESULT result = PatchWndProcV14(hwnd, msg, wParam, lParam);
  if (msg == WM_COMMAND || msg == WM_NOTIFY || msg == WM_SIZE || msg == WM_HSCROLL) PatchRefreshChromeV15();
  return result;
}

static int RunPatchChromeSmokeV15() {
  int code = 360;
  for (const auto& item : gPatchChromeV15) {
    auto& native = gPatchWinChromeV15[(size_t)item.nativeIndex];
    if (item.kind == PATCH_CHROME_TIMER_V15) {
      if (!native.timerId) return code++;
      if (!item.events.empty()) {
        int before = gPatchChromeDispatchCountV15;
        if (!PatchDispatchChromeV15(item) || gPatchChromeDispatchCountV15 <= before) return code++;
      }
      continue;
    }
    if (!native.hwnd) return code++;
    if (item.kind == PATCH_CHROME_PICTURE_V15) {
      if (PatchPictureEmbeddedSourceV15(item.source) && !native.bitmap) return code++;
      if (!item.events.empty()) {
        int before = gPatchChromeDispatchCountV15;
        if (!PatchDispatchChromeV15(item) || gPatchChromeDispatchCountV15 <= before) return code++;
      }
    }
  }
  return 0;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, LPWSTR, int showCommand) {
  PatchComScopeV09 patchCom;
  if (FAILED(patchCom.result) && patchCom.result != RPC_E_CHANGED_MODE) return 21;
  gInstance = instance; gSmokeMode = HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV15(payloadV14) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15()) return 22;
  PatchSyncListShadowsV11();
  INITCOMMONCONTROLSEX common{}; common.dwSize = sizeof(common); common.dwICC = ICC_WIN95_CLASSES | ICC_LISTVIEW_CLASSES | ICC_TAB_CLASSES | ICC_TREEVIEW_CLASSES | ICC_BAR_CLASSES;
  if (!InitCommonControlsEx(&common)) return 21;
  WNDCLASSW wc{}; wc.lpfnWndProc = PatchWndProcV15; wc.hInstance = instance; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  PATCH_WINDOW_CLASS = L"PatchSealedNativeWindowV15"; wc.lpszClassName = PATCH_WINDOW_CLASS; if (!RegisterClassW(&wc)) return 21;
  NONCLIENTMETRICSW metrics{}; metrics.cbSize = sizeof(metrics);
  if (SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, sizeof(metrics), &metrics, 0)) gGuiFont = CreateFontIndirectW(&metrics.lfMessageFont);
  if (!CreateFormsV09() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchInstallTreesV13() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallMenusV12()) return 21;
  for (auto& form : gForms) SetWindowLongPtrW(form.hwnd, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(PatchWndProcV15));
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15();
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
    if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
    PatchDestroyChromeImagesV15();
    if (gGuiFont) DeleteObject(gGuiFont);
    return result;
  }
  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) { if (PatchTranslateMenuAcceleratorV12(&msg)) continue; TranslateMessage(&msg); DispatchMessageW(&msg); }
  if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
  PatchDestroyChromeImagesV15();
  if (gGuiFont) DeleteObject(gGuiFont);
  return 0;
}
