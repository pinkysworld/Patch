// Patch sealed Win32 GUI runtime v1.9.
// Payload v18 adds Button ImageList assets over payload-v17/runtime-v1.8.
#define PATCH_WIN32_RUNTIME_V19_RESTORE_ENTRY PatchRuntimeV18CompatibilityMain
#include "win32-sealed-gui-v18.cpp"
#undef wWinMain
#undef PATCH_WIN32_RUNTIME_V19_RESTORE_ENTRY
#include "sealed-button-image-v19.hpp"

static std::vector<PatchButtonImageAssetV19> gPatchButtonImageAssetsV19;
static std::vector<PatchButtonImageConsumerV19> gPatchButtonImagesV19;
static std::vector<HIMAGELIST> gPatchButtonImageListsV19;

struct PatchButtonSourceImageV19 {
  Image* image = nullptr;
  IStream* stream = nullptr;
};

static void PatchDestroyButtonSourceImageV19(PatchButtonSourceImageV19& source) {
  delete source.image;
  source.image = nullptr;
  if (source.stream) source.stream->Release();
  source.stream = nullptr;
}

static bool PatchDecodeButtonSourceImageV19(const std::string& dataUri, PatchButtonSourceImageV19& out) {
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(dataUri, picture) || picture.bytes.empty()) return false;
  HGLOBAL heap = GlobalAlloc(GMEM_MOVEABLE, picture.bytes.size());
  if (!heap) return false;
  void* locked = GlobalLock(heap);
  if (!locked) { GlobalFree(heap); return false; }
  memcpy(locked, picture.bytes.data(), picture.bytes.size());
  GlobalUnlock(heap);
  IStream* stream = nullptr;
  if (CreateStreamOnHGlobal(heap, TRUE, &stream) != S_OK || !stream) { GlobalFree(heap); return false; }
  Image* image = Image::FromStream(stream);
  if (!image || image->GetLastStatus() != Ok || image->GetWidth() == 0 || image->GetHeight() == 0) {
    delete image;
    stream->Release();
    return false;
  }
  out.image = image;
  out.stream = stream;
  return true;
}

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

static bool PatchResolveButtonImagesV19() {
  for (const auto& item : gPatchButtonImagesV19) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(PatchWideV11(item.controlId));
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    if (gControls[(size_t)item.nativeIndex].kind != CK_BUTTON) return false;
    if (item.assetIndex >= gPatchButtonImageAssetsV19.size()) return false;
  }
  return true;
}

static HIMAGELIST PatchCreateButtonImageListV19(const PatchButtonImageConsumerV19& consumer) {
  if (consumer.assetIndex >= gPatchButtonImageAssetsV19.size()) return nullptr;
  const auto& asset = gPatchButtonImageAssetsV19[consumer.assetIndex];
  PatchButtonSourceImageV19 source;
  if (!PatchDecodeButtonSourceImageV19(asset.dataUri, source)) return nullptr;

  const int width = (int)consumer.logicalWidth, height = (int)consumer.logicalHeight;
  Bitmap scaled(width, height, PixelFormat32bppARGB);
  {
    Graphics graphics(&scaled);
    graphics.Clear(Color(0, 0, 0, 0));
    graphics.SetInterpolationMode(InterpolationModeHighQualityBicubic);
    graphics.DrawImage(source.image, 0, 0, width, height);
  }

  HBITMAP bitmap = nullptr;
  const Status bitmapStatus = scaled.GetHBITMAP(Color(0, 0, 0, 0), &bitmap);
  PatchDestroyButtonSourceImageV19(source);
  if (bitmapStatus != Ok || !bitmap) return nullptr;

  HIMAGELIST list = ImageList_Create(width, height, ILC_COLOR32 | ILC_MASK, 1, 1);
  if (!list || ImageList_Add(list, bitmap, nullptr) < 0) {
    if (list) ImageList_Destroy(list);
    DeleteObject(bitmap);
    return nullptr;
  }
  DeleteObject(bitmap);
  return list;
}

static bool PatchInstallButtonImagesV19() {
  gPatchButtonImageListsV19.assign(gControls.size(), nullptr);
  for (const auto& item : gPatchButtonImagesV19) {
    auto& control = gControls[(size_t)item.nativeIndex];
    if (!control.hwnd || control.kind != CK_BUTTON) return false;
    HIMAGELIST list = PatchCreateButtonImageListV19(item);
    if (!list) return false;
    BUTTON_IMAGELIST binding{};
    binding.himl = list;
    binding.margin = RECT{4, 2, 4, 2};
    binding.uAlign = BUTTON_IMAGELIST_ALIGN_LEFT;
    if (!SendMessageW(control.hwnd, BCM_SETIMAGELIST, 0, reinterpret_cast<LPARAM>(&binding))) {
      ImageList_Destroy(list);
      return false;
    }
    gPatchButtonImageListsV19[(size_t)item.nativeIndex] = list;
  }
  return true;
}

static void PatchDestroyButtonImagesV19() {
  for (HIMAGELIST list : gPatchButtonImageListsV19) if (list) ImageList_Destroy(list);
  gPatchButtonImageListsV19.clear();
}

static int RunPatchButtonImageSmokeV19() {
  int code = 420;
  for (const auto& item : gPatchButtonImagesV19) {
    auto& control = gControls[(size_t)item.nativeIndex];
    if (!control.hwnd || control.kind != CK_BUTTON) return code++;
    BUTTON_IMAGELIST binding{};
    if (!SendMessageW(control.hwnd, BCM_GETIMAGELIST, 0, reinterpret_cast<LPARAM>(&binding)) || !binding.himl) return code++;
    int width = 0, height = 0;
    if (!ImageList_GetIconSize(binding.himl, &width, &height) || width != (int)item.logicalWidth || height != (int)item.logicalHeight) return code++;
    if (WindowText(control.hwnd) != RenderText(control.text)) return code++;
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
  if (!ReadSelfPayloadV19(payloadV18) || !PatchConvertPayloadV18ToV17(payloadV18, payloadV17, gPatchButtonImageAssetsV19, gPatchButtonImagesV19) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 20; }
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18() || !PatchResolveButtonImagesV19()) { GdiplusShutdown(gPatchGdiplusTokenV16); return 22; }
  PatchSyncListShadowsV11();
  INITCOMMONCONTROLSEX common{}; common.dwSize = sizeof(common); common.dwICC = ICC_WIN95_CLASSES | ICC_LISTVIEW_CLASSES | ICC_TAB_CLASSES | ICC_TREEVIEW_CLASSES | ICC_BAR_CLASSES;
  if (!InitCommonControlsEx(&common)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  WNDCLASSW wc{}; wc.lpfnWndProc = PatchWndProcV18; wc.hInstance = instance; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  PATCH_WINDOW_CLASS = L"PatchSealedNativeWindowV19"; wc.lpszClassName = PATCH_WINDOW_CLASS; if (!RegisterClassW(&wc)) { GdiplusShutdown(gPatchGdiplusTokenV16); return 21; }
  NONCLIENTMETRICSW metrics{}; metrics.cbSize = sizeof(metrics);
  if (SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, sizeof(metrics), &metrics, 0)) gGuiFont = CreateFontIndirectW(&metrics.lfMessageFont);
  if (!CreateFormsV09() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchInstallTreesV13() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16(instance) || !PatchInstallPaintBoxesV17(instance) || !PatchInstallPaintImageBoxesV18(instance) || !PatchInstallButtonImagesV19() || !PatchInstallMenusV12()) {
    PatchDestroyButtonImagesV19(); PatchDestroyChromeImagesV15(); PatchDestroyPaintImagesV18();
    if (gGuiFont) DeleteObject(gGuiFont);
    GdiplusShutdown(gPatchGdiplusTokenV16);
    return 21;
  }
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
    if (!result) result = RunPatchButtonImageSmokeV19();
    if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
    PatchDestroyButtonImagesV19(); PatchDestroyChromeImagesV15(); PatchDestroyPaintImagesV18();
    if (gGuiFont) DeleteObject(gGuiFont);
    GdiplusShutdown(gPatchGdiplusTokenV16);
    return result;
  }
  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) { if (PatchTranslateMenuAcceleratorV12(&msg)) continue; TranslateMessage(&msg); DispatchMessageW(&msg); }
  if (gPatchChromeHostV15) { for (const auto& item : gPatchChromeV15) if (gPatchWinChromeV15[(size_t)item.nativeIndex].timerId) KillTimer(gPatchChromeHostV15, gPatchWinChromeV15[(size_t)item.nativeIndex].timerId); }
  PatchDestroyButtonImagesV19(); PatchDestroyChromeImagesV15(); PatchDestroyPaintImagesV18();
  if (gGuiFont) DeleteObject(gGuiFont);
  GdiplusShutdown(gPatchGdiplusTokenV16);
  return 0;
}
