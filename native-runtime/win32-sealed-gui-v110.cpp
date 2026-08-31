// Patch sealed Win32 GUI runtime v1.10.
// Payload v19 adds application/Form Window icons over payload-v18/runtime-v1.9.
#define PATCH_WIN32_RUNTIME_V110_RESTORE_ENTRY PatchRuntimeV19CompatibilityMain
#include "win32-sealed-gui-v19.cpp"
#undef wWinMain
#undef PATCH_WIN32_RUNTIME_V110_RESTORE_ENTRY
#include "sealed-window-icon-v110.hpp"

static std::vector<PatchWindowIconAssetV110> gPatchWindowIconAssetsV110;
static std::vector<PatchWindowIconConsumerV110> gPatchWindowIconsV110;

struct PatchWinWindowIconAssetV110 {
  HICON big = nullptr;
  HICON small = nullptr;
};
static std::vector<PatchWinWindowIconAssetV110> gPatchNativeWindowIconsV110;

static bool ReadSelfPayloadV110(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH]; DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH); if (!n || n >= MAX_PATH) return false;
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr); if (file == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER size{}; if (!GetFileSizeEx(file, &size) || size.QuadPart < 20) { CloseHandle(file); return false; }
  LARGE_INTEGER pos{}; pos.QuadPart = size.QuadPart - 20; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  uint8_t footer[20]{}; DWORD got = 0; if (!ReadFile(file, footer, 20, &got, nullptr) || got != 20 || memcmp(footer, PATCH_MAGIC, 8) != 0) { CloseHandle(file); return false; }
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 19 || !length || (uint64_t)length > (uint64_t)(size.QuadPart - 20)) { CloseHandle(file); return false; }
  pos.QuadPart = size.QuadPart - 20 - length; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  payload.resize(length); got = 0; BOOL ok = ReadFile(file, payload.data(), length, &got, nullptr); CloseHandle(file);
  return ok && got == length && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchResolveWindowIconsV110() {
  for (const auto& item : gPatchWindowIconsV110) {
    if (item.formIndex >= gForms.size() || item.assetIndex >= gPatchWindowIconAssetsV110.size()) return false;
    if (!item.formId.empty() && gForms[item.formIndex].id != PatchWideV11(item.formId)) return false;
  }
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  return gPatchWindowIconsV110.empty() || (application && application->assetIndex < gPatchWindowIconAssetsV110.size());
}

static HICON PatchCreateWindowHIconV110(Image* source, int width, int height) {
  if (!source || width <= 0 || height <= 0) return nullptr;
  Bitmap scaled(width, height, PixelFormat32bppARGB);
  {
    Graphics graphics(&scaled);
    graphics.Clear(Color(0, 0, 0, 0));
    graphics.SetInterpolationMode(InterpolationModeHighQualityBicubic);
    graphics.DrawImage(source, 0, 0, width, height);
  }
  HICON icon = nullptr;
  return scaled.GetHICON(&icon) == Ok ? icon : nullptr;
}

static bool PatchPrepareWindowIconsV110() {
  gPatchNativeWindowIconsV110.assign(gPatchWindowIconAssetsV110.size(), {});
  const int bigWidth = std::max(1, GetSystemMetrics(SM_CXICON));
  const int bigHeight = std::max(1, GetSystemMetrics(SM_CYICON));
  const int smallWidth = std::max(1, GetSystemMetrics(SM_CXSMICON));
  const int smallHeight = std::max(1, GetSystemMetrics(SM_CYSMICON));
  for (size_t index = 0; index < gPatchWindowIconAssetsV110.size(); ++index) {
    PatchButtonSourceImageV19 source;
    if (!PatchDecodeButtonSourceImageV19(gPatchWindowIconAssetsV110[index].dataUri, source)) return false;
    HICON big = PatchCreateWindowHIconV110(source.image, bigWidth, bigHeight);
    HICON small = PatchCreateWindowHIconV110(source.image, smallWidth, smallHeight);
    PatchDestroyButtonSourceImageV19(source);
    if (!big || !small) {
      if (big) DestroyIcon(big);
      if (small) DestroyIcon(small);
      return false;
    }
    gPatchNativeWindowIconsV110[index] = {big, small};
  }
  return true;
}

static const PatchWinWindowIconAssetV110* PatchNativeWindowIconV110(const PatchWindowIconConsumerV110* consumer) {
  if (!consumer || consumer->assetIndex >= gPatchNativeWindowIconsV110.size()) return nullptr;
  return &gPatchNativeWindowIconsV110[consumer->assetIndex];
}

static bool PatchInstallWindowIconsV110() {
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  for (uint32_t formIndex = 0; formIndex < gForms.size(); ++formIndex) {
    auto& form = gForms[formIndex];
    if (!form.hwnd) return false;
    const auto* explicitIcon = PatchWindowIconForFormV110(gPatchWindowIconsV110, formIndex);
    const auto* chosen = explicitIcon ? explicitIcon : application;
    const auto* native = PatchNativeWindowIconV110(chosen);
    if (!native) continue;
    SendMessageW(form.hwnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(native->big));
    SendMessageW(form.hwnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(native->small));
  }
  return true;
}

static void PatchDestroyWindowIconsV110() {
  for (auto& item : gPatchNativeWindowIconsV110) {
    if (item.big) DestroyIcon(item.big);
    if (item.small) DestroyIcon(item.small);
  }
  gPatchNativeWindowIconsV110.clear();
}

static int RunPatchWindowIconSmokeV110() {
  int code = 460;
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  if (!gPatchWindowIconsV110.empty() && !application) return code++;
  for (uint32_t formIndex = 0; formIndex < gForms.size(); ++formIndex) {
    const auto* explicitIcon = PatchWindowIconForFormV110(gPatchWindowIconsV110, formIndex);
    const auto* chosen = explicitIcon ? explicitIcon : application;
    if (!chosen) continue;
    const auto* native = PatchNativeWindowIconV110(chosen);
    if (!native || !native->big || !native->small || !gForms[formIndex].hwnd) return code++;
    HICON big = reinterpret_cast<HICON>(SendMessageW(gForms[formIndex].hwnd, WM_GETICON, ICON_BIG, 0));
    HICON small = reinterpret_cast<HICON>(SendMessageW(gForms[formIndex].hwnd, WM_GETICON, ICON_SMALL, 0));
    if (big != native->big || small != native->small) return code++;
  }
  return 0;
}

static int PatchWindowIconInstallFailureV110() {
  PatchDestroyWindowIconsV110();
  PatchDestroyButtonImagesV19();
  PatchDestroyChromeImagesV15();
  PatchDestroyPaintImagesV18();
  if (gGuiFont) DeleteObject(gGuiFont);
  GdiplusShutdown(gPatchGdiplusTokenV16);
  return 21;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, LPWSTR, int showCommand) {
  GdiplusStartupInput gdiplusStartupInput;
  if (GdiplusStartup(&gPatchGdiplusTokenV16, &gdiplusStartupInput, nullptr) != Ok) return 21;
  PatchComScopeV09 patchCom;
  if (FAILED(patchCom.result) && patchCom.result != RPC_E_CHANGED_MODE) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  gInstance = instance; gSmokeMode = HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV19, payloadV18, payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV110(payloadV19) || !PatchConvertPayloadV19ToV18(payloadV19, payloadV18, gPatchWindowIconAssetsV110, gPatchWindowIconsV110) || !PatchConvertPayloadV18ToV17(payloadV18, payloadV17, gPatchButtonImageAssetsV19, gPatchButtonImagesV19) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 20; }
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18() || !PatchResolveButtonImagesV19() || !PatchResolveWindowIconsV110() || !PatchPrepareWindowIconsV110()) { GdiplusShutdown(gPatchGdiplusTokenV16); return 22; }
  PatchSyncListShadowsV11();
  INITCOMMONCONTROLSEX common{}; common.dwSize = sizeof(common); common.dwICC = ICC_WIN95_CLASSES | ICC_LISTVIEW_CLASSES | ICC_TAB_CLASSES | ICC_TREEVIEW_CLASSES | ICC_BAR_CLASSES;
  if (!InitCommonControlsEx(&common)) return PatchWindowIconInstallFailureV110();
  WNDCLASSW wc{}; wc.lpfnWndProc = PatchWndProcV19; wc.hInstance = instance; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  const auto* applicationNative = PatchNativeWindowIconV110(application);
  if (applicationNative) wc.hIcon = applicationNative->big;
  PATCH_WINDOW_CLASS = L"PatchSealedNativeWindowV110"; wc.lpszClassName = PATCH_WINDOW_CLASS; if (!RegisterClassW(&wc)) return PatchWindowIconInstallFailureV110();
  NONCLIENTMETRICSW metrics{}; metrics.cbSize = sizeof(metrics);
  if (SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, sizeof(metrics), &metrics, 0)) gGuiFont = CreateFontIndirectW(&metrics.lfMessageFont);
  if (!CreateFormsV09() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchInstallTreesV13() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16(instance) || !PatchInstallPaintBoxesV17(instance) || !PatchInstallPaintImageBoxesV18(instance) || !PatchInstallButtonImagesV19() || !PatchInstallMenusV12() || !PatchInstallWindowIconsV110()) return PatchWindowIconInstallFailureV110();
  for (auto& form : gForms) SetWindowLongPtrW(form.hwnd, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(PatchWndProcV19));
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
    if (!result) result = RunPatchButtonImageSmokeV19();
    if (!result) result = RunPatchWindowIconSmokeV110();
    if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
    PatchDestroyWindowIconsV110(); PatchDestroyButtonImagesV19(); PatchDestroyChromeImagesV15(); PatchDestroyPaintImagesV18();
    if (gGuiFont) DeleteObject(gGuiFont);
    GdiplusShutdown(gPatchGdiplusTokenV16);
    return result;
  }
  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) { if (PatchTranslateMenuAcceleratorV12(&msg)) continue; TranslateMessage(&msg); DispatchMessageW(&msg); }
  if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
  PatchDestroyWindowIconsV110(); PatchDestroyButtonImagesV19(); PatchDestroyChromeImagesV15(); PatchDestroyPaintImagesV18();
  if (gGuiFont) DeleteObject(gGuiFont);
  GdiplusShutdown(gPatchGdiplusTokenV16);
  return 0;
}
