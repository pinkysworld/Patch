// Patch sealed GTK3 GUI runtime v0.9.
// Payload v8 adds runtime-responsive Anchor/Dock layout while preserving the
// v0.8 GTK accessibility contract.
#include <gtk/gtk.h>
#include <atk/atk.h>
#include <unistd.h>
#include <limits.h>
#include <cctype>
#include <fstream>

#define main PatchSealedRuntimeV07Main
#include "gtk-sealed-gui-v07.cpp"
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

static void PatchSetAccessibleNameV09(GtkWidget* widget, const std::string& name) {
  if (!widget || name.empty()) return;
  AtkObject* accessible = gtk_widget_get_accessible(widget);
  if (accessible) atk_object_set_name(accessible, name.c_str());
}

static std::string PatchReadAccessibleNameV09(GtkWidget* widget) {
  if (!widget) return {};
  AtkObject* accessible = gtk_widget_get_accessible(widget);
  if (!accessible) return {};
  const char* name = atk_object_get_name(accessible);
  return name ? std::string(name) : std::string();
}

static void ApplyPatchAccessibilityV09() {
  for (auto& c : gControls) {
    if (!PatchNeedsExplicitNameV09(c)) continue;
    if (c.kind == CK_RADIO) {
      for (size_t i = 0; i < c.radioItems.size() && i < c.options.size(); ++i) PatchSetAccessibleNameV09(c.radioItems[i], PatchRadioNameV09(c, c.options[i]));
      continue;
    }
    PatchSetAccessibleNameV09(c.widget, PatchControlNameV09(c));
  }
}

static int RunPatchAccessibilitySmokeV09() {
  int code = 130;
  for (const auto& c : gControls) {
    if (!PatchNeedsExplicitNameV09(c)) continue;
    if (c.kind == CK_RADIO) {
      if (c.radioItems.size() != c.options.size()) return code++;
      for (size_t i = 0; i < c.options.size(); ++i) if (PatchReadAccessibleNameV09(c.radioItems[i]) != PatchRadioNameV09(c, c.options[i])) return code++;
      continue;
    }
    if (PatchReadAccessibleNameV09(c.widget) != PatchControlNameV09(c)) return code++;
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

static void MovePatchControlV09(int index, int x, int y, int width, int height) {
  if (index < 0 || index >= (int)gControls.size()) return;
  auto& c = gControls[(size_t)index];
  if (!c.widget || c.parentTabIndex >= 0) return;
  auto& form = gForms[(size_t)c.formIndex];
  if (!form.fixed) return;
  gtk_fixed_move(GTK_FIXED(form.fixed), c.widget, x, y);
  gtk_widget_set_size_request(c.widget, width, height);
}

static void ApplyPatchResponsiveLayoutV09(int formIndex, int formWidth, int formHeight) {
  if (formIndex < 0 || formIndex >= (int)gForms.size() || formWidth <= 0 || formHeight <= 0 || gPatchLayoutPoliciesV09.size() != gControls.size()) return;
  const auto& form = gForms[(size_t)formIndex];
  for (int index = 0; index < (int)gControls.size(); ++index) {
    auto& c = gControls[(size_t)index];
    if (c.formIndex != formIndex || c.parentTabIndex >= 0 || !PatchPolicyResponsiveV09(gPatchLayoutPoliciesV09[(size_t)index])) continue;
    int x=c.x, y=c.y, width=c.width, height=c.height;
    PatchApplyLayoutPolicyV09(gPatchLayoutPoliciesV09[(size_t)index], form.width, form.height, formWidth, formHeight, x, y, width, height);
    MovePatchControlV09(index, x, y, width, height);
  }
}

static void OnPatchFormAllocateV09(GtkWidget*, GtkAllocation* allocation, gpointer data) {
  if (!allocation) return;
  ApplyPatchResponsiveLayoutV09(GPOINTER_TO_INT(data), allocation->width, allocation->height);
}

static int RunPatchResponsiveSmokeV09() {
  if (gPatchLayoutPoliciesV09.size() != gControls.size()) return 180;
  for (int index = 0; index < (int)gControls.size(); ++index) {
    auto& c = gControls[(size_t)index]; const auto policy = gPatchLayoutPoliciesV09[(size_t)index];
    if (c.parentTabIndex >= 0 || !PatchPolicyResponsiveV09(policy)) continue;
    const auto& form = gForms[(size_t)c.formIndex];
    int x=c.x,y=c.y,width=c.width,height=c.height;
    PatchApplyLayoutPolicyV09(policy, form.width, form.height, form.width+80, form.height+60, x,y,width,height);
    ApplyPatchResponsiveLayoutV09(c.formIndex, form.width+80, form.height+60);
    if (!c.widget) return 181;
    gint actualX=0, actualY=0; gtk_container_child_get(GTK_CONTAINER(form.fixed), c.widget, "x", &actualX, "y", &actualY, nullptr);
    int requestedWidth=0, requestedHeight=0; gtk_widget_get_size_request(c.widget, &requestedWidth, &requestedHeight);
    if (actualX != x || actualY != y || requestedWidth != width || requestedHeight != height) return 182;
    return 0;
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payloadV8, payloadV7;
  if (!ReadSelfPayloadV09(payloadV8) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size()) return 22;
  gtk_init(&argc, &argv);
  if (!CreateForms()) return 21;
  for (int index = 0; index < (int)gForms.size(); ++index) {
    if (gForms[(size_t)index].fixed) g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(OnPatchFormAllocateV09), GINT_TO_POINTER(index));
  }
  ApplyPatchAccessibilityV09();
  RefreshUI();
  for (auto& f : gForms) if (f.visible) gtk_widget_show_all(f.window);
  while (gtk_events_pending()) gtk_main_iteration();
  if (gSmokeMode) {
    const int base = RunSmoke();
    const int accessibility = base == 0 ? RunPatchAccessibilitySmokeV09() : base;
    return accessibility == 0 ? RunPatchResponsiveSmokeV09() : accessibility;
  }
  gtk_main();
  return 0;
}
