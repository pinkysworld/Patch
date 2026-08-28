// Patch sealed Win32 GUI runtime v1.9.
// Payload v18 adds ImageList / Button image over payload-v17/runtime-v1.8.
#define PATCH_WIN32_RUNTIME_V19_RESTORE_ENTRY PatchRuntimeV18CompatibilityMain
#include "win32-sealed-gui-v18.cpp"
#undef wWinMain
#undef PATCH_WIN32_RUNTIME_V19_RESTORE_ENTRY
#include "sealed-imagelist-v19.hpp"
#include <commctrl.h>

static std::vector<PatchImageListV19> gPatchImageListsV19;
static std::vector<PatchButtonImageV19> gPatchButtonImagesV19;
static std::vector<HIMAGELIST> gPatchButtonImageListsV19;

static bool ReadSelfPayloadV19(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH]; DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH); if (!n || n >= MAX_PATH) return false;
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr); if (file == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER size{}; if (!GetFileSizeEx(file, &size) || size.QuadPart < 20) { CloseHandle(file); return false; }
  LARGE_INTEGER pos{}; pos.QuadPart = size.QuadPart - 20; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  uint8_t footer[20]{}; DWORD got = 0; if (!ReadFile(file, footer, 20, &got, nullptr) || got != 20 || memcmp(footer, PATCH_MAGIC, 8) != 0) { CloseHandle(file); return false; }
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 18 || !length || (uint64_t)length > (uint64_t)(size.QuadPart - 20)) { CloseHandle(file); return false; }
  pos.QuadPart = size.QuadPart - 20 - length; if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  payload.resize(length); got = 0; BOOL ok = ReadFile(file, payload.data(), length, &got, nullptr); CloseHandle(file);
  return ok && got == length && Crc32(payload.data(), payload.size()) == crc;
}

static Bitmap* PatchButtonBitmapV19(const std::string& source, int width, int height) {
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(source, picture) || picture.bytes.empty()) return nullptr;
  HGLOBAL heap = GlobalAlloc(GMEM_MOVEABLE, picture.bytes.size());
  if (!heap) return nullptr;
  void* locked = GlobalLock(heap);
  if (!locked) { GlobalFree(heap); return nullptr; }
  memcpy(locked, picture.bytes.data(), picture.bytes.size());
  GlobalUnlock(heap);
  IStream* stream = nullptr;
  if (CreateStreamOnHGlobal(heap, TRUE, &stream) != S_OK || !stream) { GlobalFree(heap); return nullptr; }
  Bitmap* original = Bitmap::FromStream(stream);
  stream->Release();
  if (!original || original->GetLastStatus() != Ok) { delete original; return nullptr; }
  Bitmap* scaled = new Bitmap(width, height, PixelFormat32bppARGB);
  Graphics g(scaled);
  g.SetInterpolationMode(InterpolationModeHighQualityBicubic);
  g.DrawImage(original, 0, 0, width, height);
  delete original;
  return scaled;
}

static bool PatchResolveButtonImagesV19() {
  for (const auto& item : gPatchButtonImagesV19) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(PatchWideV11(item.id));
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    if (gControls[(size_t)item.nativeIndex].kind != CK_BUTTON) return false;
  }
  return true;
}

static bool PatchInstallButtonImagesV19() {
  for (const auto& item : gPatchButtonImagesV19) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.hwnd) return false;
    Bitmap* bitmap = PatchButtonBitmapV19(item.source, (int)item.width, (int)item.height);
    if (!bitmap) return false;
    HBITMAP handle = nullptr;
    if (bitmap->GetHBITMAP(Color(0, 0, 0, 0), &handle) != Ok || !handle) { delete bitmap; return false; }
    delete bitmap;
    HIMAGELIST list = ImageList_Create((int)item.width, (int)item.height, ILC_COLOR32, 1, 1);
    if (!list) { DeleteObject(handle); return false; }
    if (ImageList_Add(list, handle, nullptr) < 0) { ImageList_Destroy(list); DeleteObject(handle); return false; }
    DeleteObject(handle);
    BUTTON_IMAGELIST info{};
    info.himl = list;
    info.uAlign = BUTTON_IMAGELIST_ALIGN_LEFT;
    if (!SendMessageW(c.hwnd, BCM_SETIMAGELIST, 0, (LPARAM)&info)) { ImageList_Destroy(list); return false; }
    gPatchButtonImageListsV19.push_back(list);
  }
  return true;
}

static void PatchDestroyButtonImagesV19() {
  for (HIMAGELIST list : gPatchButtonImageListsV19) if (list) ImageList_Destroy(list);
  gPatchButtonImageListsV19.clear();
}

static LRESULT CALLBACK PatchWndProcV19(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  return PatchWndProcV18(hwnd, msg, wParam, lParam);
}

static int RunPatchImageListSmokeV19() {
  int code = 420;
  for (const auto& item : gPatchButtonImagesV19) {
    const auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.hwnd || c.kind != CK_BUTTON) return code++;
    BUTTON_IMAGELIST info{};
    if (!SendMessageW(c.hwnd, BCM_GETIMAGELIST, 0, (LPARAM)&info) || !info.himl) return code++;
  }
  return 0;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, LPWSTR, int showCommand) {
  GdiplusStartupInput gdiplusStartupInput;
  if (GdiplusStartup(&gPatchGdiplusTokenV16, &gdiplusStartupInput, nullptr) != Ok) return 21;
  PatchComScopeV09 patchCom;
  if (FAILED(patchCom.result) && patchCom.result != RPC_E_CHANGED_MODE) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  gInstance = instance; gSmokeMode = HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV18, payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV19(payloadV18) || !PatchConvertPayloadV18ToV17(payloadV18, payloadV17, gPatchImageListsV19, gPatchButtonImagesV19) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 20; }
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18() || !PatchResolveButtonImagesV19()) { GdiplusShutdown(gPatchGdiplusTokenV16); return 22; }
  PatchSyncListShadowsV11();
  INITCOMMONCONTROLSEX common{}; common.dwSize = sizeof(common); common.dwICC = ICC_WIN95_CLASSES | ICC_LISTVIEW_CLASSES | ICC_TAB_CLASSES | ICC_TREEVIEW_CLASSES | ICC_BAR_CLASSES | ICC_STANDARD_CLASSES;
  if (!InitCommonControlsEx(&common)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  WNDCLASSW wc{}; wc.lpfnWndProc = PatchWndProcV19; wc.hInstance = instance; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  PATCH_WINDOW_CLASS = L"PatchSealedNativeWindowV19"; wc.lpszClassName = PATCH_WINDOW_CLASS; if (!RegisterClassW(&wc)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  NONCLIENTMETRICSW metrics{}; metrics.cbSize = sizeof(metrics);
  if (SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, sizeof(metrics), &metrics, 0)) gGuiFont = CreateFontIndirectW(&metrics.lfMessageFont);
  if (!CreateFormsV09() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchInstallTreesV13() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16(instance) || !PatchInstallPaintBoxesV17(instance) || !PatchInstallPaintImageBoxesV18(instance) || !PatchInstallButtonImagesV19() || !PatchInstallMenusV12()) { GdiplusShutdown(gPatchGdiplusTokenV16); PatchDestroyPaintImagesV18(); PatchDestroyButtonImagesV19(); return 21; }
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
    if (!result) result = RunPatchImageListSmokeV19();
    if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
    PatchDestroyChromeImagesV15();
    PatchDestroyPaintImagesV18();
    PatchDestroyButtonImagesV19();
    if (gGuiFont) DeleteObject(gGuiFont);
    GdiplusShutdown(gPatchGdiplusTokenV16);
    return result;
  }
  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) { if (PatchTranslateMenuAcceleratorV12(&msg)) continue; TranslateMessage(&msg); DispatchMessageW(&msg); }
  if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
  PatchDestroyChromeImagesV15();
  PatchDestroyPaintImagesV18();
  PatchDestroyButtonImagesV19();
  if (gGuiFont) DeleteObject(gGuiFont);
  GdiplusShutdown(gPatchGdiplusTokenV16);
  return 0;
}
