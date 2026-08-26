// Patch sealed AppKit GUI runtime v1.5.
// Payload v14 adds Chrome Stage 1 Panel/Timer/PictureBox/StatusBar over payload-v13/runtime-v1.4.
#define PATCH_RUNTIME_V15_RESTORE_MAIN PatchRuntimeV14CompatibilityMain
#include "appkit-sealed-gui-v14.mm"
#undef main
#undef PATCH_RUNTIME_V15_RESTORE_MAIN
#include "sealed-chrome-v15.hpp"
#include "picture-data-v15.hpp"

static std::vector<PatchChromeV15> gPatchChromeV15;
static NSView* gPatchChromeViewsV15[10000] = {};
static NSTimer* gPatchChromeTimersV15[10000] = {};
static NSInteger gPatchChromeDispatchCountV15 = 0;

static bool ReadSelfPayloadV15(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 14 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchChromeShadowKindV15(const PatchChromeV15& item, uint8_t kind) {
  if (item.kind == PATCH_CHROME_PANEL_V15 || item.kind == PATCH_CHROME_STATUS_V15) return kind == CK_TEXT;
  if (item.kind == PATCH_CHROME_TIMER_V15 || item.kind == PATCH_CHROME_PICTURE_V15) return kind == CK_BUTTON;
  return false;
}

static bool PatchResolveChromeV15() {
  for (const auto& item : gPatchChromeV15) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size() || item.nativeIndex >= 10000) return false;
    auto it = gControlById.find(item.id);
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    const auto& c = gControls[(size_t)item.nativeIndex];
    if (!PatchChromeShadowKindV15(item, c.kind)) return false;
    for (const auto& patch : item.events) {
      if (patch.eventIndex >= gEvents.size()) return false;
      const auto& event = gEvents[(size_t)patch.eventIndex];
      if (event.control != item.id) return false;
      if (item.kind == PATCH_CHROME_TIMER_V15 && (patch.event != "ticked" || event.kind != EV_CLICKED)) return false;
      if (item.kind == PATCH_CHROME_PICTURE_V15 && (patch.event != "clicked" || event.kind != EV_CLICKED)) return false;
    }
  }
  return true;
}

static NSString* PatchChromeCaptionV15(const PatchChromeV15& item) {
  if (!item.binding.empty()) {
    auto it = gStateByName.find(item.binding);
    if (it != gStateByName.end() && gStates[(size_t)it->second].type == ST_TEXT) return NS(gStates[(size_t)it->second].text);
  }
  return NS(item.text);
}

static NSImage* PatchPictureImageV15(const PatchChromeV15& item) {
  if (!PatchPictureEmbeddedSourceV15(item.source)) return nil;
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(item.source, picture)) return nil;
  NSData* data = [NSData dataWithBytes:picture.bytes.data() length:picture.bytes.size()];
  if (!data) return nil;
  return [[NSImage alloc] initWithData:data];
}

static bool PatchExecuteChromeEventV15(const PatchChromeV15& item, const PatchChromeEventPatchV15& patch) {
  if (patch.eventIndex >= gEvents.size()) return false;
  PatchExecuteEventV11(gEvents[(size_t)patch.eventIndex], false, {}, nullptr);
  ++gPatchChromeDispatchCountV15;
  return true;
}

static bool PatchDispatchChromeV15(const PatchChromeV15& item) {
  if (gRefreshing) return false;
  for (const auto& patch : item.events) if (!PatchExecuteChromeEventV15(item, patch)) return false;
  PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14();
  return true;
}

@interface PatchChromeTargetV15 : NSObject
- (void)handlePicture:(id)sender;
- (void)handleTimer:(NSTimer*)timer;
@end
static PatchChromeTargetV15* gPatchChromeTargetV15 = nil;
@implementation PatchChromeTargetV15
- (void)handlePicture:(id)sender {
  if (gRefreshing) return;
  NSInteger index = [sender tag] - 3000;
  const auto* item = PatchChromeForNativeIndexV15(gPatchChromeV15, (int)index);
  if (item) PatchDispatchChromeV15(*item);
}
- (void)handleTimer:(NSTimer*)timer {
  if (gRefreshing) return;
  NSInteger index = [timer.userInfo integerValue];
  const auto* item = PatchChromeForNativeIndexV15(gPatchChromeV15, (int)index);
  if (item) PatchDispatchChromeV15(*item);
}
@end

static bool PatchInstallChromeV15() {
  gPatchChromeTargetV15 = [PatchChromeTargetV15 new];
  for (const auto& item : gPatchChromeV15) {
    const int index = item.nativeIndex;
    auto& c = gControls[(size_t)index];
    NSView* shadow = (NSView*)c.widget;
    if (!shadow || !shadow.superview) return false;
    if (item.kind == PATCH_CHROME_TIMER_V15) {
      NSTimer* timer = [NSTimer timerWithTimeInterval:(item.interval / 1000.0) target:gPatchChromeTargetV15 selector:@selector(handleTimer:) userInfo:@(index) repeats:YES];
      [[NSRunLoop mainRunLoop] addTimer:timer forMode:NSRunLoopCommonModes];
      gPatchChromeTimersV15[index] = timer;
      shadow.hidden = YES;
      continue;
    }
    NSView* view = nil;
    if (item.kind == PATCH_CHROME_PANEL_V15) {
      NSBox* box = [[NSBox alloc] initWithFrame:shadow.frame];
      box.title = PatchChromeCaptionV15(item);
      box.boxType = NSBoxPrimary;
      view = box;
    } else if (item.kind == PATCH_CHROME_PICTURE_V15) {
      NSButton* button = [[NSButton alloc] initWithFrame:shadow.frame];
      if (PatchPictureEmbeddedSourceV15(item.source)) {
        NSImage* image = PatchPictureImageV15(item);
        if (!image) return false;
        button.image = image;
        button.imagePosition = NSImageOnly;
        button.imageScaling = NSImageScaleProportionallyUpOrDown;
        button.bordered = NO;
      } else {
        button.title = PatchChromeCaptionV15(item);
        button.bezelStyle = NSBezelStyleRegularSquare;
      }
      button.tag = 3000 + index;
      button.target = gPatchChromeTargetV15;
      button.action = @selector(handlePicture:);
      [button setAccessibilityLabel:NS(PatchControlNameV09(c))];
      view = button;
    } else {
      NSTextField* field = [[NSTextField alloc] initWithFrame:shadow.frame];
      field.stringValue = PatchChromeCaptionV15(item);
      field.editable = NO; field.bezeled = YES; field.drawsBackground = YES;
      [field setAccessibilityLabel:NS(PatchControlNameV09(c))];
      view = field;
    }
    [shadow.superview addSubview:view positioned:NSWindowAbove relativeTo:shadow];
    shadow.hidden = YES;
    gPatchChromeViewsV15[index] = view;
  }
  return true;
}

static void PatchRefreshChromeV15() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchChromeV15) {
    const int index = item.nativeIndex;
    NSView* shadow = (NSView*)gControls[(size_t)index].widget;
    if (item.kind == PATCH_CHROME_TIMER_V15) { if (shadow) shadow.hidden = YES; continue; }
    NSView* view = gPatchChromeViewsV15[index];
    if (!view) continue;
    if (shadow) view.frame = shadow.frame;
    if (item.kind == PATCH_CHROME_PANEL_V15 && [view isKindOfClass:[NSBox class]]) ((NSBox*)view).title = PatchChromeCaptionV15(item);
    else if (item.kind == PATCH_CHROME_PICTURE_V15 && [view isKindOfClass:[NSButton class]] && !PatchPictureEmbeddedSourceV15(item.source)) ((NSButton*)view).title = PatchChromeCaptionV15(item);
    else if ([view isKindOfClass:[NSTextField class]]) ((NSTextField*)view).stringValue = PatchChromeCaptionV15(item);
    view.hidden = NO; if (shadow) shadow.hidden = YES;
  }
  gRefreshing = previous;
}

@interface PatchChromeResizeObserverV15 : NSObject
- (void)windowDidResize:(NSNotification*)notification;
@end
@implementation PatchChromeResizeObserverV15
- (void)windowDidResize:(NSNotification*)notification { (void)notification; PatchRefreshChromeV15(); }
@end
static PatchChromeResizeObserverV15* gPatchChromeResizeObserverV15 = nil;

static int RunPatchChromeSmokeV15() {
  int code = 360;
  for (const auto& item : gPatchChromeV15) {
    if (item.kind == PATCH_CHROME_TIMER_V15) {
      if (!gPatchChromeTimersV15[item.nativeIndex]) return code++;
      if (!item.events.empty()) { NSInteger before = gPatchChromeDispatchCountV15; if (!PatchDispatchChromeV15(item) || gPatchChromeDispatchCountV15 <= before) return code++; }
      continue;
    }
    NSView* view = gPatchChromeViewsV15[item.nativeIndex];
    if (!view) return code++;
    if (item.kind == PATCH_CHROME_PICTURE_V15) {
      if (PatchPictureEmbeddedSourceV15(item.source) && (![view isKindOfClass:[NSButton class]] || !((NSButton*)view).image)) return code++;
      if (!item.events.empty()) {
        NSInteger before = gPatchChromeDispatchCountV15;
        if (!PatchDispatchChromeV15(item) || gPatchChromeDispatchCountV15 <= before) return code++;
      }
    }
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode = HasArg(argc, argv, "--patch-smoke");
    std::vector<uint8_t> payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
    if (!ReadSelfPayloadV15(payloadV14) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
    if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15()) return 22;
    PatchSyncListShadowsV11();
    gEventTarget = [PatchEventTargetV14 new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchUpgradeTableTargetV12() || !PatchUpgradeTableTargetV13() || !PatchInstallTreesV13() || !PatchUpgradeTargetsV14() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallMenusV12()) return 21;
    gPatchResponsiveObserverV11 = [PatchResponsiveObserverV11 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchResponsiveObserverV11 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchSliderResizeObserverV14 = [PatchSliderResizeObserverV14 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchSliderResizeObserverV14 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchChromeResizeObserverV15 = [PatchChromeResizeObserverV15 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchChromeResizeObserverV15 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15();
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
      for (const auto& item : gPatchChromeV15) if (gPatchChromeTimersV15[item.nativeIndex]) [gPatchChromeTimersV15[item.nativeIndex] invalidate];
      return result;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
  }
  return 0;
}
