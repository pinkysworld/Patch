// Patch sealed AppKit GUI runtime v1.10.
// Payload v19 adds application/Form Window icons over payload-v18/runtime-v1.9.
#define PATCH_RUNTIME_V110_RESTORE_MAIN PatchRuntimeV19CompatibilityMain
#include "appkit-sealed-gui-v19.mm"
#undef main
#undef PATCH_RUNTIME_V110_RESTORE_MAIN
#include "sealed-window-icon-v110.hpp"

static std::vector<PatchWindowIconAssetV110> gPatchWindowIconAssetsV110;
static std::vector<PatchWindowIconConsumerV110> gPatchWindowIconsV110;
static std::vector<NSImage*> gPatchNativeWindowIconsV110;
static std::vector<NSTitlebarAccessoryViewController*> gPatchWindowIconAccessoriesV110;

static bool ReadSelfPayloadV110(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 19 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchResolveWindowIconsV110() {
  for (const auto& item : gPatchWindowIconsV110) {
    if (item.formIndex >= gForms.size() || item.assetIndex >= gPatchWindowIconAssetsV110.size()) return false;
    if (!item.formId.empty() && gForms[item.formIndex].id != item.formId) return false;
  }
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  return gPatchWindowIconsV110.empty() || (application && application->assetIndex < gPatchWindowIconAssetsV110.size());
}

static NSImage* PatchCreateWindowIconV110(const PatchWindowIconAssetV110& asset) {
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(asset.dataUri, picture) || picture.bytes.empty()) return nil;
  NSData* data = [NSData dataWithBytes:picture.bytes.data() length:picture.bytes.size()];
  if (!data) return nil;
  NSImage* image = [[NSImage alloc] initWithData:data];
  if (!image || image.size.width <= 0 || image.size.height <= 0) {
    if (image) [image release];
    return nil;
  }
  return image;
}

static bool PatchPrepareWindowIconsV110() {
  gPatchNativeWindowIconsV110.assign(gPatchWindowIconAssetsV110.size(), nil);
  for (size_t index = 0; index < gPatchWindowIconAssetsV110.size(); ++index) {
    NSImage* image = PatchCreateWindowIconV110(gPatchWindowIconAssetsV110[index]);
    if (!image) return false;
    gPatchNativeWindowIconsV110[index] = image;
  }
  return true;
}

static NSImage* PatchNativeWindowIconV110(const PatchWindowIconConsumerV110* consumer) {
  if (!consumer || consumer->assetIndex >= gPatchNativeWindowIconsV110.size()) return nil;
  return gPatchNativeWindowIconsV110[consumer->assetIndex];
}

static bool PatchInstallWindowIconsV110() {
  gPatchWindowIconAccessoriesV110.assign(gForms.size(), nil);
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  NSImage* applicationImage = PatchNativeWindowIconV110(application);
  if (applicationImage) [NSApp setApplicationIconImage:applicationImage];

  for (const auto& item : gPatchWindowIconsV110) {
    if (item.formIndex >= gForms.size()) return false;
    NSWindow* window = gForms[item.formIndex].window;
    NSImage* image = PatchNativeWindowIconV110(&item);
    if (!window || !image) return false;

    NSTitlebarAccessoryViewController* accessory = [[NSTitlebarAccessoryViewController alloc] init];
    NSImageView* view = [[NSImageView alloc] initWithFrame:NSMakeRect(0, 0, 18, 18)];
    view.image = image;
    view.imageScaling = NSImageScaleProportionallyUpOrDown;
    accessory.view = view;
    accessory.layoutAttribute = NSLayoutAttributeLeft;
    [window addTitlebarAccessoryViewController:accessory];
    [view release];
    gPatchWindowIconAccessoriesV110[item.formIndex] = accessory;
  }
  return true;
}

static void PatchDestroyWindowIconsV110() {
  for (NSTitlebarAccessoryViewController* accessory : gPatchWindowIconAccessoriesV110) if (accessory) [accessory release];
  gPatchWindowIconAccessoriesV110.clear();
  for (NSImage* image : gPatchNativeWindowIconsV110) if (image) [image release];
  gPatchNativeWindowIconsV110.clear();
}

static bool PatchValidInstalledImageV110(NSImage* image) {
  return image && image.size.width > 0 && image.size.height > 0 && [image TIFFRepresentation] != nil;
}

static int RunPatchWindowIconSmokeV110() {
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  if (!gPatchWindowIconsV110.empty() && !application) return 460;
  NSImage* applicationImage = PatchNativeWindowIconV110(application);
  if (applicationImage && !PatchValidInstalledImageV110([NSApp applicationIconImage])) return 461;
  for (const auto& item : gPatchWindowIconsV110) {
    if (item.formIndex >= gForms.size() || item.formIndex >= gPatchWindowIconAccessoriesV110.size()) return 462;
    NSTitlebarAccessoryViewController* accessory = gPatchWindowIconAccessoriesV110[item.formIndex];
    if (!accessory || ![accessory.view isKindOfClass:[NSImageView class]]) return 463;
    NSImageView* view = (NSImageView*)accessory.view;
    if (!PatchValidInstalledImageV110(view.image) || view.imageScaling != NSImageScaleProportionallyUpOrDown) return 464;
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode = HasArg(argc, argv, "--patch-smoke");
    std::vector<uint8_t> payloadV19, payloadV18, payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
    if (!ReadSelfPayloadV110(payloadV19) || !PatchConvertPayloadV19ToV18(payloadV19, payloadV18, gPatchWindowIconAssetsV110, gPatchWindowIconsV110) || !PatchConvertPayloadV18ToV17(payloadV18, payloadV17, gPatchButtonImageAssetsV19, gPatchButtonImagesV19) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
    if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18() || !PatchResolveButtonImagesV19() || !PatchResolveWindowIconsV110() || !PatchPrepareWindowIconsV110()) return 22;
    PatchSyncListShadowsV11();
    gEventTarget = [PatchEventTargetV18 new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchUpgradeTableTargetV12() || !PatchUpgradeTableTargetV13() || !PatchInstallTreesV13() || !PatchUpgradeTargetsV14() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17() || !PatchInstallPaintImageBoxesV18() || !PatchInstallButtonImagesV19() || !PatchInstallMenusV12() || !PatchUpgradePaintTargetsV17() || !PatchUpgradePaintImageTargetsV18() || !PatchInstallWindowIconsV110()) { PatchDestroyWindowIconsV110(); PatchDestroyButtonImagesV19(); return 21; }
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
      if (!result) result = RunPatchButtonImageSmokeV19();
      if (!result) result = RunPatchWindowIconSmokeV110();
      for (const auto& item : gPatchChromeV15) if (gPatchChromeTimersV15[item.nativeIndex]) [gPatchChromeTimersV15[item.nativeIndex] invalidate];
      PatchDestroyWindowIconsV110(); PatchDestroyButtonImagesV19(); PatchDestroyPaintImagesV18();
      return result;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
    PatchDestroyWindowIconsV110(); PatchDestroyButtonImagesV19(); PatchDestroyPaintImagesV18();
  }
  return 0;
}
