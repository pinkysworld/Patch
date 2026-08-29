// Patch sealed AppKit GUI runtime v1.9.
// Payload v18 adds ImageList / Button image over payload-v17/runtime-v1.8.
#define PATCH_RUNTIME_V19_RESTORE_MAIN PatchRuntimeV18CompatibilityMain
#include "appkit-sealed-gui-v18.mm"
#undef main
#undef PATCH_RUNTIME_V19_RESTORE_MAIN
#include "sealed-imagelist-v19.hpp"

static std::vector<PatchImageListV19> gPatchImageListsV19;
static std::vector<PatchButtonImageV19> gPatchButtonImagesV19;
static std::map<std::string, NSImage*> gPatchButtonImagesCacheV19;

static bool ReadSelfPayloadV19(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 18 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static NSImage* PatchButtonImageV19(const std::string& source, int width, int height) {
  auto it = gPatchButtonImagesCacheV19.find(source);
  if (it != gPatchButtonImagesCacheV19.end()) return it->second;
  if (width < 1 || height < 1) return nil;
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(source, picture) || picture.bytes.empty()) {
    gPatchButtonImagesCacheV19[source] = nil;
    return nil;
  }
  NSData* data = [NSData dataWithBytes:picture.bytes.data() length:picture.bytes.size()];
  NSImage* image = data ? [[NSImage alloc] initWithData:data] : nil;
  if (image && (image.size.width <= 0 || image.size.height <= 0)) { [image release]; image = nil; }
  if (image) [image setSize:NSMakeSize(width, height)];
  gPatchButtonImagesCacheV19[source] = image;
  return image;
}

static void PatchDestroyButtonImagesV19() {
  for (auto& item : gPatchButtonImagesCacheV19) if (item.second) [item.second release];
  gPatchButtonImagesCacheV19.clear();
}

static bool PatchResolveButtonImagesV19() {
  for (const auto& item : gPatchButtonImagesV19) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(item.id);
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    if (gControls[(size_t)item.nativeIndex].kind != CK_BUTTON) return false;
  }
  return true;
}

static bool PatchInstallButtonImagesV19() {
  for (const auto& item : gPatchButtonImagesV19) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.widget || ![c.widget isKindOfClass:[NSButton class]]) return false;
    NSButton* button = (NSButton*)c.widget;
    NSImage* image = PatchButtonImageV19(item.source, (int)item.width, (int)item.height);
    if (!image) return false;
    [button setImage:image];
    [button setImagePosition:NSImageLeft];
    [button setImageScaling:NSImageScaleProportionallyDown];
  }
  return true;
}

static int RunPatchImageListSmokeV19() {
  int code = 420;
  for (const auto& item : gPatchButtonImagesV19) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.widget || ![c.widget isKindOfClass:[NSButton class]]) return code++;
    NSButton* button = (NSButton*)c.widget;
    NSImage* image = [button image];
    if (!image || image.size.width <= 0 || image.size.height <= 0) return code++;
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode = HasArg(argc, argv, "--patch-smoke");
    std::vector<uint8_t> payloadV18, payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
    if (!ReadSelfPayloadV19(payloadV18) || !PatchConvertPayloadV18ToV17(payloadV18, payloadV17, gPatchImageListsV19, gPatchButtonImagesV19) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
    if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18() || !PatchResolveButtonImagesV19()) return 22;
    PatchSyncListShadowsV11();

    // Preserve the complete v1.8 event target chain. V18 subclasses V17, so normal
    // controls repaint both PaintBox layers after source-backed state changes.
    gEventTarget = [PatchEventTargetV18 new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchUpgradeTableTargetV12() || !PatchUpgradeTableTargetV13() || !PatchInstallTreesV13() || !PatchUpgradeTargetsV14() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17() || !PatchInstallPaintImageBoxesV18() || !PatchInstallButtonImagesV19() || !PatchInstallMenusV12() || !PatchUpgradePaintTargetsV17() || !PatchUpgradePaintImageTargetsV18()) {
      PatchDestroyPaintImagesV18();
      PatchDestroyButtonImagesV19();
      return 21;
    }

    gPatchResponsiveObserverV11 = [PatchResponsiveObserverV11 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchResponsiveObserverV11 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchSliderResizeObserverV14 = [PatchSliderResizeObserverV14 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchSliderResizeObserverV14 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchChromeResizeObserverV15 = [PatchChromeResizeObserverV15 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchChromeResizeObserverV15 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchShapeResizeObserverV16 = [PatchShapeResizeObserverV16 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchShapeResizeObserverV16 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchPaintBoxResizeObserverV17 = [PatchPaintBoxResizeObserverV17 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchPaintBoxResizeObserverV17 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchPaintBoxImageResizeObserverV18 = [PatchPaintBoxImageResizeObserverV18 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchPaintBoxImageResizeObserverV18 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16(); PatchRefreshPaintBoxesV17(); PatchRefreshPaintImageBoxesV18();
    [NSApp finishLaunching];
    for (auto& f : gForms) if (f.visible) [f.window makeKeyAndOrderFront:nil];
    if (gSmokeMode) {
      int result = RunSmoke();
      if (!result) result = RunPatchAccessibilitySmokeV09();
      if (!result) result = RunPatchTableAccessibilitySmokeV10();
      if (!result) result = RunPatchResponsiveSmokeV10();
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
      for (const auto& item : gPatchChromeV15) if (gPatchChromeTimersV15[item.nativeIndex]) [gPatchChromeTimersV15[item.nativeIndex] invalidate];
      PatchDestroyPaintImagesV18();
      PatchDestroyButtonImagesV19();
      return result;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
    PatchDestroyPaintImagesV18();
    PatchDestroyButtonImagesV19();
  }
  return 0;
}
