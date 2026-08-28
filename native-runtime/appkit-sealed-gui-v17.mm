// Patch sealed AppKit GUI runtime v1.7.
// Payload v16 adds PaintBox Stage 1 clear/line/rectangle/ellipse/text over payload-v15/runtime-v1.6.
#define PATCH_RUNTIME_V17_RESTORE_MAIN PatchRuntimeV16CompatibilityMain
#include "appkit-sealed-gui-v16.mm"
#undef main
#undef PATCH_RUNTIME_V17_RESTORE_MAIN
#include "sealed-paintbox-v17.hpp"

static std::vector<PatchPaintBoxV17> gPatchPaintBoxesV17;
static NSView* gPatchPaintBoxViewsV17[10000] = {};

static bool ReadSelfPayloadV17(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 16 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchResolvePaintBoxesV17() {
  for (const auto& item : gPatchPaintBoxesV17) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size() || item.nativeIndex >= 10000) return false;
    auto it = gControlById.find(item.id);
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    const auto& c = gControls[(size_t)item.nativeIndex];
    if (c.kind != CK_TEXT) return false;
    PatchPaintMetricsV17 metrics;
    if (!PatchPaintMetricsFromBoxV17(item, 320, 200, metrics)) return false;
  }
  return true;
}

static bool PatchPaintNumberV17(const std::string& expr, int loopCount, double min, double max, double& out) {
  if (!PatchPaintEvalNumberV17(expr, loopCount, out)) return false;
  return std::isfinite(out) && out >= min && out <= max;
}

static void PatchPaintDrawNodeV17(const PatchPaintNodeV17& node, int loopCount, const PatchPaintMetricsV17& metrics) {
  if (node.operation == PATCH_PAINT_CLEAR_V17) {
    PatchColorV16 color;
    if (!PatchParseColorV16(node.color, true, color) || color.transparent) return;
    [PatchShapeColorV16(color) setFill];
    NSRectFillUsingOperation(NSMakeRect(0, 0, metrics.width, metrics.height), NSCompositingOperationSourceOver);
    return;
  }
  if (node.operation == PATCH_PAINT_LINE_V17) {
    double x1 = 0, y1 = 0, x2 = 0, y2 = 0, strokeWidth = 0;
    PatchColorV16 stroke;
    if (!PatchPaintNumberV17(node.x1, loopCount, -1e6, 1e6, x1) || !PatchPaintNumberV17(node.y1, loopCount, -1e6, 1e6, y1) || !PatchPaintNumberV17(node.x2, loopCount, -1e6, 1e6, x2) || !PatchPaintNumberV17(node.y2, loopCount, -1e6, 1e6, y2)) return;
    if (!PatchParseColorV16(node.stroke, false, stroke) || !PatchPaintNumberV17(node.strokeWidth, loopCount, 0, 64, strokeWidth) || strokeWidth <= 0) return;
    NSBezierPath* path = [NSBezierPath bezierPath];
    [path moveToPoint:NSMakePoint(PatchPaintMapX(metrics, x1), PatchPaintMapY(metrics, y1))];
    [path lineToPoint:NSMakePoint(PatchPaintMapX(metrics, x2), PatchPaintMapY(metrics, y2))];
    [path setLineWidth:(CGFloat)strokeWidth];
    [PatchShapeColorV16(stroke) setStroke];
    [path stroke];
    return;
  }
  if (node.operation == PATCH_PAINT_RECTANGLE_V17 || node.operation == PATCH_PAINT_ELLIPSE_V17) {
    double x = 0, y = 0, w = 0, h = 0, strokeWidth = 0;
    PatchColorV16 fill, stroke;
    if (!PatchPaintNumberV17(node.x, loopCount, -1e6, 1e6, x) || !PatchPaintNumberV17(node.y, loopCount, -1e6, 1e6, y) || !PatchPaintNumberV17(node.width, loopCount, 0, 1e6, w) || !PatchPaintNumberV17(node.height, loopCount, 0, 1e6, h)) return;
    if (!PatchParseColorV16(node.fill, true, fill) || !PatchParseColorV16(node.stroke, false, stroke) || !PatchPaintNumberV17(node.strokeWidth, loopCount, 0, 64, strokeWidth)) return;
    const NSRect rect = NSMakeRect(PatchPaintMapX(metrics, x), PatchPaintMapY(metrics, y), PatchPaintMapW(metrics, w), PatchPaintMapH(metrics, h));
    NSBezierPath* path = node.operation == PATCH_PAINT_ELLIPSE_V17
      ? [NSBezierPath bezierPathWithOvalInRect:rect]
      : [NSBezierPath bezierPathWithRect:rect];
    if (!fill.transparent) {
      [PatchShapeColorV16(fill) setFill];
      [path fill];
    }
    if (strokeWidth > 0) {
      [path setLineWidth:(CGFloat)strokeWidth];
      [PatchShapeColorV16(stroke) setStroke];
      [path stroke];
    }
    return;
  }
  if (node.operation == PATCH_PAINT_TEXT_V17) {
    std::string text;
    double x = 0, y = 0, fontSize = 0;
    PatchColorV16 color;
    if (!PatchPaintEvalTextV17(node.textExpr, loopCount, text)) return;
    if (!PatchPaintNumberV17(node.x, loopCount, -1e6, 1e6, x) || !PatchPaintNumberV17(node.y, loopCount, -1e6, 1e6, y) || !PatchPaintNumberV17(node.fontSize, loopCount, 1, 512, fontSize)) return;
    if (!PatchParseColorV16(node.color, false, color)) return;
    NSFont* font = [NSFont systemFontOfSize:(CGFloat)PatchPaintMapFont(metrics, fontSize)];
    NSDictionary* attrs = @{
      NSFontAttributeName: font,
      NSForegroundColorAttributeName: PatchShapeColorV16(color)
    };
    NSString* string = [NSString stringWithUTF8String:text.c_str()];
    [string drawAtPoint:NSMakePoint(PatchPaintMapX(metrics, x), PatchPaintMapY(metrics, y)) withAttributes:attrs];
  }
}

@interface PatchPaintBoxViewV17 : NSView
@property(nonatomic) int nativeIndex;
@end
@implementation PatchPaintBoxViewV17
- (BOOL)isFlipped { return YES; }
- (void)drawRect:(NSRect)dirtyRect {
  (void)dirtyRect;
  const PatchPaintBoxV17* item = PatchPaintBoxForNativeIndexV17(gPatchPaintBoxesV17, self.nativeIndex);
  if (!item) return;
  PatchPaintMetricsV17 metrics;
  if (!PatchPaintMetricsFromBoxV17(*item, (double)std::max(1.0, (double)self.bounds.size.width), (double)std::max(1.0, (double)self.bounds.size.height), metrics)) return;
  PatchPaintRunProgramV17(item->program, 0, [&](const PatchPaintNodeV17& node, int loopCount) {
    PatchPaintDrawNodeV17(node, loopCount, metrics);
  });
}
@end

static bool PatchInstallPaintBoxesV17() {
  for (const auto& item : gPatchPaintBoxesV17) {
    const int index = item.nativeIndex;
    auto& c = gControls[(size_t)index];
    NSView* shadow = (NSView*)c.widget;
    if (!shadow || !shadow.superview) return false;
    PatchPaintBoxViewV17* view = [[PatchPaintBoxViewV17 alloc] initWithFrame:shadow.frame];
    view.nativeIndex = index;
    view.wantsLayer = YES;
    [view setAccessibilityElement:YES];
    [view setAccessibilityLabel:NS(PatchControlNameV09(c) + " drawing surface")];
    [shadow.superview addSubview:view positioned:NSWindowAbove relativeTo:shadow];
    shadow.hidden = YES;
    gPatchPaintBoxViewsV17[index] = view;
  }
  return true;
}

static void PatchRefreshPaintBoxesV17() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchPaintBoxesV17) {
    const int index = item.nativeIndex;
    NSView* shadow = (NSView*)gControls[(size_t)index].widget;
    NSView* view = gPatchPaintBoxViewsV17[index];
    if (!view) continue;
    if (shadow) view.frame = shadow.frame;
    view.hidden = NO;
    if (shadow) shadow.hidden = YES;
    [view setNeedsDisplay:YES];
  }
  gRefreshing = previous;
}

@interface PatchPaintBoxResizeObserverV17 : NSObject
- (void)windowDidResize:(NSNotification*)notification;
@end
@implementation PatchPaintBoxResizeObserverV17
- (void)windowDidResize:(NSNotification*)notification { (void)notification; PatchRefreshPaintBoxesV17(); }
@end
static PatchPaintBoxResizeObserverV17* gPatchPaintBoxResizeObserverV17 = nil;

static int RunPatchPaintBoxSmokeV17() {
  int code = 400;
  for (const auto& item : gPatchPaintBoxesV17) {
    if (!gPatchPaintBoxViewsV17[item.nativeIndex]) return code++;
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode = HasArg(argc, argv, "--patch-smoke");
    std::vector<uint8_t> payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
    if (!ReadSelfPayloadV17(payloadV16) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
    if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17()) return 22;
    PatchSyncListShadowsV11();
    gEventTarget = [PatchEventTargetV14 new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchUpgradeTableTargetV12() || !PatchUpgradeTableTargetV13() || !PatchInstallTreesV13() || !PatchUpgradeTargetsV14() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17() || !PatchInstallMenusV12()) return 21;
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
    ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16(); PatchRefreshPaintBoxesV17();
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
      for (const auto& item : gPatchChromeV15) if (gPatchChromeTimersV15[item.nativeIndex]) [gPatchChromeTimersV15[item.nativeIndex] invalidate];
      return result;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
  }
  return 0;
}
