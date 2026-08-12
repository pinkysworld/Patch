// Patch sealed GTK3 GUI runtime v0.8.
// Accessibility overlay over the payload-v7 runtime implementation.
#include <gtk/gtk.h>
#include <atk/atk.h>
#include <unistd.h>
#include <limits.h>
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
#include "gtk-sealed-gui-v07.cpp"
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

static void PatchSetAccessibleNameV08(GtkWidget* widget, const std::string& name) {
  if (!widget || name.empty()) return;
  AtkObject* accessible = gtk_widget_get_accessible(widget);
  if (accessible) atk_object_set_name(accessible, name.c_str());
}

static std::string PatchReadAccessibleNameV08(GtkWidget* widget) {
  if (!widget) return {};
  AtkObject* accessible = gtk_widget_get_accessible(widget);
  if (!accessible) return {};
  const char* name = atk_object_get_name(accessible);
  return name ? std::string(name) : std::string();
}

static void ApplyPatchAccessibilityV08() {
  for (auto& c : gControls) {
    if (!PatchNeedsExplicitNameV08(c)) continue;
    if (c.kind == CK_RADIO) {
      for (size_t i = 0; i < c.radioItems.size() && i < c.options.size(); ++i) PatchSetAccessibleNameV08(c.radioItems[i], PatchRadioNameV08(c, c.options[i]));
      continue;
    }
    PatchSetAccessibleNameV08(c.widget, PatchControlNameV08(c));
  }
}

static int RunPatchAccessibilitySmokeV08() {
  int code = 130;
  for (const auto& c : gControls) {
    if (!PatchNeedsExplicitNameV08(c)) continue;
    if (c.kind == CK_RADIO) {
      if (c.radioItems.size() != c.options.size()) return code++;
      for (size_t i = 0; i < c.options.size(); ++i) if (PatchReadAccessibleNameV08(c.radioItems[i]) != PatchRadioNameV08(c, c.options[i])) return code++;
      continue;
    }
    if (PatchReadAccessibleNameV08(c.widget) != PatchControlNameV08(c)) return code++;
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payload;
  if (!ReadSelfPayload(payload) || !ParsePayload(payload)) return 20;
  gtk_init(&argc, &argv);
  if (!CreateForms()) return 21;
  ApplyPatchAccessibilityV08();
  RefreshUI();
  for (auto& f : gForms) if (f.visible) gtk_widget_show_all(f.window);
  if (gSmokeMode) {
    const int base = RunSmoke();
    return base == 0 ? RunPatchAccessibilitySmokeV08() : base;
  }
  gtk_main();
  return 0;
}
