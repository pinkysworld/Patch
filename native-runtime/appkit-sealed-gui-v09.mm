// Patch sealed AppKit GUI runtime v0.9.
// Payload v8 adds runtime-responsive Anchor/Dock layout while preserving the
// v0.8 AppKit accessibility contract.
#import <Cocoa/Cocoa.h>
#include <mach-o/dyld.h>
#include <cctype>
#include <fstream>

#define main PatchSealedRuntimeV07Main
#include "appkit-sealed-gui-v07.mm"
#undef main
#include "sealed-responsive-v09.hpp"

static std::vector<PatchLayoutPolicyV09> gPatchLayoutPoliciesV09;

static std::string PatchHumanizeV09(const std::string& value) {
  std::string out;
  for (size_t i = 0; i < value.size(); ++i) {
    const unsigned char ch = (unsigned char)value[i];
    if (ch == '_' || ch == '-') { if (!out.empty() && out.back() != ' ') out.push_back(' '); continue; }
    const bool upper = std::isupper(ch) != 0;
    const bool prevLower = i > 0 && std::islower((unsigned char)value[i - 1]) != 0;
    const bool prevUpper = i > 0 && std::isupper((unsigned char)value[i - 1]) != 0;
    const bool nextLower = i + 1 < value.size() && std::islower((unsigned char)value[i + 1]) != 0;
    if (!out.empty() && out.back() != ' ' && upper && (prevLower || (prevUpper && nextLower))) out.push_back(' ');
    out.push_back((char)ch);
  }
  if (!out.empty()) out[0] = (char)std::toupper((unsigned char)out[0]);
  return out;
}

static bool PatchNeedsExplicitNameV09(const Control& c) {
  return c.kind == CK_INPUT || c.kind == CK_COMBO || c.kind == CK_LISTBOX || c.kind == CK_TABS || c.kind == CK_RADIO;
}

static std::string PatchControlNameV09(const Control& c) {
  if (!c.text.empty() && c.text.find('{') == std::string::npos) return c.text;
  if (!c.id.empty()) return PatchHumanizeV09(c.id);
  return PatchHumanizeV09(c.binding);
}

static std::string PatchRadioNameV09(const Control& c, const std::string& option) {
  const std::string group = PatchControlNameV09(c);
  return group.empty() ? option : group + ": " + option;
}

static void ApplyPatchAccessibilityV09() {
  for (size_t index = 0; index < gControls.size(); ++index) {
    auto& c = gControls[index];
    if (!PatchNeedsExplicitNameV09(c)) continue;
    if (c.kind == CK_RADIO) {
      NSMutableArray* items = index < gRadioItems.size() ? gRadioItems[index] : nil;
      for (size_t i = 0; items && i < c.options.size() && i < (size_t)[items count]; ++i) {
        NSButton* item = (NSButton*)[items objectAtIndex:(NSUInteger)i];
        [item setAccessibilityLabel:NS(PatchRadioNameV09(c, c.options[i]))];
      }
      continue;
    }
    if (c.widget) [c.widget setAccessibilityLabel:NS(PatchControlNameV09(c))];
  }
}

static int RunPatchAccessibilitySmokeV09() {
  int code = 130;
  for (size_t index = 0; index < gControls.size(); ++index) {
    const auto& c = gControls[index];
    if (!PatchNeedsExplicitNameV09(c)) continue;
    if (c.kind == CK_RADIO) {
      NSMutableArray* items = index < gRadioItems.size() ? gRadioItems[index] : nil;
      if (!items || [items count] != (NSInteger)c.options.size()) return code++;
      for (size_t i = 0; i < c.options.size(); ++i) {
        NSButton* item = (NSButton*)[items objectAtIndex:(NSUInteger)i];
        if (![[item accessibilityLabel] isEqualToString:NS(PatchRadioNameV09(c, c.options[i]))]) return code++;
      }
      continue;
    }
    if (!c.widget || ![[c.widget accessibilityLabel] isEqualToString:NS(PatchControlNameV09(c))]) return code++;
  }
  return 0;
}

static bool ReadSelfPayloadV09(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  uint32_t version=le32(footer+8), length=le32(footer+12), crc=le32(footer+16);
  if (version != 8 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static void MovePatchControlV09(int index, int x, int y, int width, int height, int formHeight) {
  if (index < 0 || index >= (int)gControls.size()) return;
  auto& c = gControls[index];
  const int nativeY = std::max(0, formHeight - y - height);
  if (c.kind == CK_RADIO) {
    NSMutableArray* items = index < (int)gRadioItems.size() ? gRadioItems[(size_t)index] : nil;
    const int count = items ? (int)[items count] : 0;
    int itemHeight = count ? height / count : 26; if (itemHeight < 22) itemHeight = 22; if (itemHeight > 30) itemHeight = 30;
    for (int option = 0; option < count; ++option) {
      NSButton* item = (NSButton*)[items objectAtIndex:(NSUInteger)option];
      item.frame = NSMakeRect(x, nativeY + (count - 1 - option) * itemHeight, width, itemHeight);
    }
    return;
  }
  if (!c.widget) return;
  if (c.kind == CK_LISTBOX) {
    NSTableView* table = (NSTableView*)c.widget;
    NSScrollView* scroll = [table enclosingScrollView];
    if (scroll) scroll.frame = NSMakeRect(x, nativeY, width, height);
    table.frame = NSMakeRect(0, 0, width, height);
    if ([[table tableColumns] count] > 0) ((NSTableColumn*)[[table tableColumns] objectAtIndex:0]).width = width;
  } else {
    c.widget.frame = NSMakeRect(x, nativeY, width, height);
  }
}

static void ApplyPatchResponsiveLayoutV09(int formIndex, int formWidth, int formHeight) {
  if (formIndex < 0 || formIndex >= (int)gForms.size() || formWidth <= 0 || formHeight <= 0 || gPatchLayoutPoliciesV09.size() != gControls.size()) return;
  const auto& form = gForms[(size_t)formIndex];
  for (int index = 0; index < (int)gControls.size(); ++index) {
    auto& c = gControls[(size_t)index];
    if (c.formIndex != formIndex || c.parentTabIndex >= 0 || !PatchPolicyResponsiveV09(gPatchLayoutPoliciesV09[(size_t)index])) continue;
    int x=c.x, y=c.y, width=c.width, height=c.height;
    PatchApplyLayoutPolicyV09(gPatchLayoutPoliciesV09[(size_t)index], form.width, form.height, formWidth, formHeight, x, y, width, height);
    MovePatchControlV09(index, x, y, width, height, formHeight);
  }
}

@interface PatchResponsiveObserverV09 : NSObject
- (void)windowDidResize:(NSNotification*)notification;
@end
@implementation PatchResponsiveObserverV09
- (void)windowDidResize:(NSNotification*)notification {
  NSWindow* window = (NSWindow*)notification.object;
  for (size_t index = 0; index < gForms.size(); ++index) {
    if (gForms[index].window != window) continue;
    const NSSize size = window.contentView.bounds.size;
    ApplyPatchResponsiveLayoutV09((int)index, (int)llround(size.width), (int)llround(size.height));
    break;
  }
}
@end
static PatchResponsiveObserverV09* gPatchResponsiveObserverV09=nil;

static int RunPatchResponsiveSmokeV09() {
  if (gPatchLayoutPoliciesV09.size() != gControls.size()) return 180;
  for (int index = 0; index < (int)gControls.size(); ++index) {
    auto& c = gControls[(size_t)index]; const auto policy = gPatchLayoutPoliciesV09[(size_t)index];
    if (c.parentTabIndex >= 0 || !PatchPolicyResponsiveV09(policy)) continue;
    const auto& form = gForms[(size_t)c.formIndex];
    int x=c.x,y=c.y,width=c.width,height=c.height;
    PatchApplyLayoutPolicyV09(policy, form.width, form.height, form.width+80, form.height+60, x,y,width,height);
    ApplyPatchResponsiveLayoutV09(c.formIndex, form.width+80, form.height+60);
    if (c.kind == CK_RADIO) return 0;
    NSView* measured = c.kind == CK_LISTBOX ? [(NSTableView*)c.widget enclosingScrollView] : c.widget;
    if (!measured) return 181;
    NSRect frame = measured.frame;
    if ((int)llround(frame.origin.x) != x || (int)llround(frame.size.width) != width || (int)llround(frame.size.height) != height) return 182;
    return 0;
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode = HasArg(argc, argv, "--patch-smoke");
    std::vector<uint8_t> payloadV8, payloadV7;
    if (!ReadSelfPayloadV09(payloadV8) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
    if (gPatchLayoutPoliciesV09.size() != gControls.size()) return 22;
    gEventTarget = [PatchEventTarget new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms()) return 21;
    gPatchResponsiveObserverV09 = [PatchResponsiveObserverV09 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchResponsiveObserverV09 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    ApplyPatchAccessibilityV09();
    RefreshUI();
    [NSApp finishLaunching];
    for (auto& f : gForms) if (f.visible) [f.window makeKeyAndOrderFront:nil];
    if (gSmokeMode) {
      const int base = RunSmoke();
      const int accessibility = base == 0 ? RunPatchAccessibilitySmokeV09() : base;
      return accessibility == 0 ? RunPatchResponsiveSmokeV09() : accessibility;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
  }
  return 0;
}
