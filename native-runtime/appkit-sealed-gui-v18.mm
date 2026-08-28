// Patch sealed AppKit GUI runtime v1.8.
// Payload v17 adds PaintBox draw image over payload-v16/runtime-v1.7.
#define PATCH_RUNTIME_V18_RESTORE_MAIN PatchRuntimeV17CompatibilityMain
#include "appkit-sealed-gui-v17.mm"
#undef main
#undef PATCH_RUNTIME_V18_RESTORE_MAIN
#include "sealed-paintbox-image-v18.hpp"

static std::vector<PatchPaintBoxV18> gPatchPaintImageBoxesV18;
static NSView* gPatchPaintImageViewsV18[10000] = {};
static std::map<std::string, NSImage*> gPatchPaintImagesV18;

static bool ReadSelfPayloadV18(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 17 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static NSImage* PatchPaintCachedImageV18(const std::string& source) {
  auto it = gPatchPaintImagesV18.find(source);
  if (it != gPatchPaintImagesV18.end()) return it->second;
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(source, picture) || picture.bytes.empty()) {
    gPatchPaintImagesV18[source] = nil;
    return nil;
  }
  NSData* data = [NSData dataWithBytes:picture.bytes.data() length:picture.bytes.size()];
  NSImage* image = data ? [[NSImage alloc] initWithData:data] : nil;
  gPatchPaintImagesV18[source] = image;
  return image;
}

static bool PatchResolvePaintImageBoxesV18() {
  for (const auto& item : gPatchPaintImageBoxesV18) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size() || item.nativeIndex >= 10000) return false;
    auto it = gControlById.find(item.id);
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    PatchPaintBoxV17 box;
    box.width = item.width;
    box.height = item.height;
    PatchPaintMetricsV17 metrics;
    if (!PatchPaintMetricsFromBoxV17(box, 320, 200, metrics)) return false;
  }
  return true;
}

static void PatchPaintDrawNodeV18(const PatchPaintNodeV18& node, int loopCount, const PatchPaintMetricsV17& metrics) {
  if (node.operation == PATCH_PAINT_CLEAR_V18) {
    PatchColorV16 color;
    if (!PatchParseColorV16(node.color, true, color) || color.transparent) return;
    [PatchShapeColorV16(color) setFill];
    NSRectFillUsingOperation(NSMakeRect(0, 0, metrics.width, metrics.height), NSCompositingOperationSourceOver);
    return;
  }
  if (node.operation == PATCH_PAINT_LINE_V18) {
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
  if (node.operation == PATCH_PAINT_RECTANGLE_V18 || node.operation == PATCH_PAINT_ELLIPSE_V18) {
    double x = 0, y = 0, w = 0, h = 0, strokeWidth = 0;
    PatchColorV16 fill, stroke;
    if (!PatchPaintNumberV17(node.x, loopCount, -1e6, 1e6, x) || !PatchPaintNumberV17(node.y, loopCount, -1e6, 1e6, y) || !PatchPaintNumberV17(node.width, loopCount, 0, 1e6, w) || !PatchPaintNumberV17(node.height, loopCount, 0, 1e6, h)) return;
    if (!PatchParseColorV16(node.fill, true, fill) || !PatchParseColorV16(node.stroke, false, stroke) || !PatchPaintNumberV17(node.strokeWidth, loopCount, 0, 64, strokeWidth)) return;
    const NSRect rect = NSMakeRect(PatchPaintMapX(metrics, x), PatchPaintMapY(metrics, y), PatchPaintMapW(metrics, w), PatchPaintMapH(metrics, h));
    NSBezierPath* path = node.operation == PATCH_PAINT_ELLIPSE_V18
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
  if (node.operation == PATCH_PAINT_TEXT_V18) {
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
    return;
  }
  if (node.operation == PATCH_PAINT_IMAGE_V18) {
    double x = 0, y = 0, w = 0, h = 0;
    if (!PatchPaintNumberV17(node.x, loopCount, -1e6, 1e6, x) || !PatchPaintNumberV17(node.y, loopCount, -1e6, 1e6, y) || !PatchPaintNumberV17(node.width, loopCount, 0, 1e6, w) || !PatchPaintNumberV17(node.height, loopCount, 0, 1e6, h) || w <= 0 || h <= 0) return;
    NSImage* image = PatchPaintCachedImageV18(node.source);
    if (!image) return;
    const NSRect dest = NSMakeRect(PatchPaintMapX(metrics, x), PatchPaintMapY(metrics, y), PatchPaintMapW(metrics, w), PatchPaintMapH(metrics, h));
    [image drawInRect:dest fromRect:NSZeroRect operation:NSCompositingOperationSourceOver fraction:1.0 respectFlipped:YES hints:nil];
  }
}

@interface PatchPaintBoxViewV18 : NSView
@property(nonatomic) int nativeIndex;
@end
@implementation PatchPaintBoxViewV18
- (BOOL)isFlipped { return YES; }
- (void)drawRect:(NSRect)dirtyRect {
  (void)dirtyRect;
  const PatchPaintBoxV18* item = PatchPaintBoxForNativeIndexV18(gPatchPaintImageBoxesV18, self.nativeIndex);
  if (!item) return;
  PatchPaintBoxV17 box;
  box.width = item->width;
  box.height = item->height;
  PatchPaintMetricsV17 metrics;
  if (!PatchPaintMetricsFromBoxV17(box, (double)std::max(1.0, (double)self.bounds.size.width), (double)std::max(1.0, (double)self.bounds.size.height), metrics)) return;
  PatchPaintRunProgramV18(item->program, 0, [&](const PatchPaintNodeV18& node, int loopCount) {
    PatchPaintDrawNodeV18(node, loopCount, metrics);
  });
}
@end

static bool PatchInstallPaintImageBoxesV18() {
  for (const auto& item : gPatchPaintImageBoxesV18) {
    const int index = item.nativeIndex;
    auto& c = gControls[(size_t)index];
    NSView* underlay = gPatchPaintBoxViewsV17[index];
    NSView* shadow = underlay ? underlay : (NSView*)c.widget;
    if (!shadow || !shadow.superview) return false;
    PatchPaintBoxViewV18* view = [[PatchPaintBoxViewV18 alloc] initWithFrame:shadow.frame];
    view.nativeIndex = index;
    view.wantsLayer = YES;
    [view setAccessibilityElement:YES];
    [view setAccessibilityLabel:NS(PatchControlNameV09(c) + " drawing surface")];
    [shadow.superview addSubview:view positioned:NSWindowAbove relativeTo:shadow];
    shadow.hidden = YES;
    if (c.widget) ((NSView*)c.widget).hidden = YES;
    gPatchPaintImageViewsV18[index] = view;
  }
  return true;
}

static void PatchRefreshPaintImageBoxesV18() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchPaintImageBoxesV18) {
    const int index = item.nativeIndex;
    NSView* underlay = gPatchPaintBoxViewsV17[index];
    NSView* shadow = underlay ? underlay : (NSView*)gControls[(size_t)index].widget;
    NSView* view = gPatchPaintImageViewsV18[index];
    if (!view) continue;
    if (shadow) view.frame = shadow.frame;
    view.hidden = NO;
    if (shadow) shadow.hidden = YES;
    if (gControls[(size_t)index].widget) ((NSView*)gControls[(size_t)index].widget).hidden = YES;
    [view setNeedsDisplay:YES];
  }
  gRefreshing = previous;
}

@interface PatchPaintBoxImageResizeObserverV18 : NSObject
- (void)windowDidResize:(NSNotification*)notification;
@end
@implementation PatchPaintBoxImageResizeObserverV18
- (void)windowDidResize:(NSNotification*)notification { (void)notification; PatchRefreshPaintImageBoxesV18(); }
@end
static PatchPaintBoxImageResizeObserverV18* gPatchPaintBoxImageResizeObserverV18 = nil;

static int RunPatchPaintBoxImageSmokeV18() {
  int code = 410;
  for (const auto& item : gPatchPaintImageBoxesV18) {
    if (!gPatchPaintImageViewsV18[item.nativeIndex]) return code++;
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode = HasArg(argc, argv, "--patch-smoke");
    std::vector<uint8_t> payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
    if (!ReadSelfPayloadV18(payloadV17) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
    if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18()) return 22;
    PatchSyncListShadowsV11();
    gEventTarget = [PatchEventTargetV14 new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms() || !PatchInstallTablesV10() || !PatchInstallListsV11() || !PatchUpgradeTableTargetV12() || !PatchUpgradeTableTargetV13() || !PatchInstallTreesV13() || !PatchUpgradeTargetsV14() || !PatchInstallSlidersV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17() || !PatchInstallPaintImageBoxesV18() || !PatchInstallMenusV12()) return 21;
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
      for (const auto& item : gPatchChromeV15) if (gPatchChromeTimersV15[item.nativeIndex]) [gPatchChromeTimersV15[item.nativeIndex] invalidate];
      return result;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
  }
  return 0;
}
