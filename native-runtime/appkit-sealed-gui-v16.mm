// Patch sealed AppKit GUI runtime v1.6.
// Payload v15 adds Shape Stage 1 rectangle/rounded/ellipse/line over payload-v14/runtime-v1.5.
#define main PatchRuntimeV15CompatibilityMain
#include "appkit-sealed-gui-v15.mm"
#undef main
#include "sealed-shape-v16.hpp"

static std::vector<PatchShapeV16> gPatchShapesV16;
static NSView* gPatchShapeViewsV16[10000] = {};

static bool ReadSelfPayloadV16(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 15 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchResolveShapesV16() {
  for (const auto& item : gPatchShapesV16) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size() || item.nativeIndex >= 10000) return false;
    auto it = gControlById.find(item.id);
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    const auto& c = gControls[(size_t)item.nativeIndex];
    if (c.kind != CK_TEXT) return false;
    PatchColorV16 fill, stroke; double strokeWidth = 0, cornerRadius = 0, opacity = 1;
    if (!PatchShapeStyleV16(item, fill, stroke, strokeWidth, cornerRadius, opacity)) return false;
  }
  return true;
}

static NSColor* PatchShapeColorV16(const PatchColorV16& color) {
  return [NSColor colorWithCalibratedRed:color.r / 255.0 green:color.g / 255.0 blue:color.b / 255.0 alpha:color.transparent ? 0.0 : color.a / 255.0];
}

@interface PatchShapeViewV16 : NSView
@property(nonatomic) int nativeIndex;
@end
@implementation PatchShapeViewV16
- (BOOL)isFlipped { return YES; }
- (void)drawRect:(NSRect)dirtyRect {
  (void)dirtyRect;
  const PatchShapeV16* item = PatchShapeForNativeIndexV16(gPatchShapesV16, self.nativeIndex);
  if (!item) return;
  PatchColorV16 fill, stroke; double strokeWidth = 0, cornerRadius = 0, opacity = 1;
  if (!PatchShapeStyleV16(*item, fill, stroke, strokeWidth, cornerRadius, opacity)) return;
  const NSSize size = self.bounds.size;
  const CGFloat width = size.width, height = size.height;
  const CGFloat x = width * 0.01, y = height * 0.01, w = width * 0.98, h = height * 0.98;
  NSBezierPath* path = [NSBezierPath bezierPath];
  if (item->kind == PATCH_SHAPE_ELLIPSE_V16) {
    path = [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(x, y, w, h)];
  } else if (item->kind == PATCH_SHAPE_LINE_V16) {
    [path moveToPoint:NSMakePoint(0, height / 2.0)];
    [path lineToPoint:NSMakePoint(width, height / 2.0)];
  } else if (item->kind == PATCH_SHAPE_ROUNDED_V16) {
    const CGFloat rx = (CGFloat)std::min(cornerRadius * width / 100.0, (double)w / 2.0);
    const CGFloat ry = (CGFloat)std::min(cornerRadius * height / 100.0, (double)h / 2.0);
    path = [NSBezierPath bezierPathWithRoundedRect:NSMakeRect(x, y, w, h) xRadius:rx yRadius:ry];
  } else {
    path = [NSBezierPath bezierPathWithRect:NSMakeRect(x, y, w, h)];
  }
  if (!fill.transparent && item->kind != PATCH_SHAPE_LINE_V16) {
    [PatchShapeColorV16(fill) setFill];
    [path fill];
  }
  if (strokeWidth > 0) {
    [path setLineWidth:(CGFloat)strokeWidth];
    [PatchShapeColorV16(stroke) setStroke];
    [path stroke];
  }
}
@end

static bool PatchInstallShapesV16() {
  for (const auto& item : gPatchShapesV16) {
    const int index = item.nativeIndex;
    auto& c = gControls[(size_t)index];
    NSView* shadow = (NSView*)c.widget;
    if (!shadow || !shadow.superview) return false;
    PatchShapeViewV16* view = [[PatchShapeViewV16 alloc] initWithFrame:shadow.frame];
    view.nativeIndex = index;
    view.wantsLayer = YES;
    [view setAccessibilityElement:YES];
    [view setAccessibilityLabel:NS(PatchControlNameV09(c) + " shape")];
    [shadow.superview addSubview:view positioned:NSWindowAbove relativeTo:shadow];
    shadow.hidden = YES;
    gPatchShapeViewsV16[index] = view;
  }
  return true;
}

static void PatchRefreshShapesV16() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchShapesV16) {
    const int index = item.nativeIndex;
    NSView* shadow = (NSView*)gControls[(size_t)index].widget;
    NSView* view = gPatchShapeViewsV16[index];
    if (!view) continue;
    if (shadow) view.frame = shadow.frame;
    view.hidden = NO;
    if (shadow) shadow.hidden = YES;
    [view setNeedsDisplay:YES];
  }
  gRefreshing = previous;
}

@interface PatchShapeResizeObserverV16 : NSObject
- (void)windowDidResize:(NSNotification*)notification;
@end
@implementation PatchShapeResizeObserverV16
- (void)windowDidResize:(NSNotification*)notification { (void)notification; PatchRefreshShapesV16(); }
@end
static PatchShapeResizeObserverV16* gPatchShapeResizeObserverV16 = nil;

static int RunPatchShapeSmokeV16() {
  int code = 380;
  for (const auto& item : gPatchShapesV16) {
    if (!gPatchShapeViewsV16[item.nativeIndex]) return code++;
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode = HasArg(argc, argv, "--patch-smoke");
    std::vector<uint8_t> payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
    if (!ReadSelfPayloadV16(payloadV15) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
    if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16()) return 22;
    PatchSyncListShadowsV11();
    gEventTarget = [PatchEventTargetV14 new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchUpgradeTableTargetV12() || !PatchUpgradeTableTargetV13() || !PatchInstallTreesV13() || !PatchUpgradeTargetsV14() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallMenusV12()) return 21;
    gPatchResponsiveObserverV11 = [PatchResponsiveObserverV11 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchResponsiveObserverV11 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchSliderResizeObserverV14 = [PatchSliderResizeObserverV14 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchSliderResizeObserverV14 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchChromeResizeObserverV15 = [PatchChromeResizeObserverV15 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchChromeResizeObserverV15 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    gPatchShapeResizeObserverV16 = [PatchShapeResizeObserverV16 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchShapeResizeObserverV16 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16();
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
      for (const auto& item : gPatchChromeV15) if (gPatchChromeTimersV15[item.nativeIndex]) [gPatchChromeTimersV15[item.nativeIndex] invalidate];
      return result;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
  }
  return 0;
}
