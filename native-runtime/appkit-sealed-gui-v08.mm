// Patch sealed AppKit GUI runtime v0.8.
// Accessibility overlay over the payload-v7 runtime implementation.
#import <Cocoa/Cocoa.h>
#include <mach-o/dyld.h>
#include <algorithm>
#include <cstdint>
#include <cmath>
#include <cstring>
#include <cctype>
#include <fstream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

#define main PatchSealedRuntimeV07Main
#include "appkit-sealed-gui-v07.mm"
#undef main

static std::string PatchHumanizeV08(const std::string& value) {
  std::string out;
  for (size_t i = 0; i < value.size(); ++i) {
    const unsigned char ch = (unsigned char)value[i];
    if (ch == '_' || ch == '-') {
      if (!out.empty() && out.back() != ' ') out.push_back(' ');
      continue;
    }
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

static bool PatchNeedsExplicitNameV08(const Control& c) {
  return c.kind == CK_INPUT || c.kind == CK_COMBO || c.kind == CK_LISTBOX || c.kind == CK_TABS || c.kind == CK_RADIO;
}

static std::string PatchControlNameV08(const Control& c) {
  if (!c.text.empty() && c.text.find('{') == std::string::npos) return c.text;
  if (!c.id.empty()) return PatchHumanizeV08(c.id);
  return PatchHumanizeV08(c.binding);
}

static std::string PatchRadioNameV08(const Control& c, const std::string& option) {
  const std::string group = PatchControlNameV08(c);
  return group.empty() ? option : group + ": " + option;
}

static void ApplyPatchAccessibilityV08() {
  for (size_t index = 0; index < gControls.size(); ++index) {
    auto& c = gControls[index];
    if (!PatchNeedsExplicitNameV08(c)) continue;
    if (c.kind == CK_RADIO) {
      NSMutableArray* items = index < gRadioItems.size() ? gRadioItems[index] : nil;
      for (size_t i = 0; items && i < c.options.size() && i < (size_t)[items count]; ++i) {
        NSButton* item = (NSButton*)[items objectAtIndex:(NSUInteger)i];
        [item setAccessibilityLabel:NS(PatchRadioNameV08(c, c.options[i]))];
      }
      continue;
    }
    if (c.widget) [c.widget setAccessibilityLabel:NS(PatchControlNameV08(c))];
  }
}

static int RunPatchAccessibilitySmokeV08() {
  int code = 130;
  for (size_t index = 0; index < gControls.size(); ++index) {
    const auto& c = gControls[index];
    if (!PatchNeedsExplicitNameV08(c)) continue;
    if (c.kind == CK_RADIO) {
      NSMutableArray* items = index < gRadioItems.size() ? gRadioItems[index] : nil;
      if (!items || [items count] != (NSInteger)c.options.size()) return code++;
      for (size_t i = 0; i < c.options.size(); ++i) {
        NSButton* item = (NSButton*)[items objectAtIndex:(NSUInteger)i];
        if (![[item accessibilityLabel] isEqualToString:NS(PatchRadioNameV08(c, c.options[i]))]) return code++;
      }
      continue;
    }
    if (!c.widget || ![[c.widget accessibilityLabel] isEqualToString:NS(PatchControlNameV08(c))]) return code++;
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode = HasArg(argc, argv, "--patch-smoke");
    std::vector<uint8_t> payload;
    if (!ReadSelfPayload(payload) || !ParsePayload(payload)) return 20;
    gEventTarget = [PatchEventTarget new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms()) return 21;
    ApplyPatchAccessibilityV08();
    RefreshUI();
    [NSApp finishLaunching];
    for (auto& f : gForms) if (f.visible) [f.window makeKeyAndOrderFront:nil];
    if (gSmokeMode) {
      const int base = RunSmoke();
      return base == 0 ? RunPatchAccessibilitySmokeV08() : base;
    }
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
  }
  return 0;
}
