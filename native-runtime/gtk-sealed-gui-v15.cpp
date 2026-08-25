// Patch sealed GTK3 GUI runtime v1.5.
// Payload v14 adds Chrome Stage 1 Panel/Timer/PictureBox/StatusBar over payload-v13/runtime-v1.4.
#define PATCH_RUNTIME_V15_RESTORE_MAIN PatchRuntimeV14CompatibilityMain
#include "gtk-sealed-gui-v14.cpp"
#undef main
#undef PATCH_RUNTIME_V15_RESTORE_MAIN
#include "sealed-chrome-v15.hpp"

static std::vector<PatchChromeV15> gPatchChromeV15;
static std::vector<GtkWidget*> gPatchChromeViewsV15;
static std::vector<guint> gPatchChromeTimersV15;
static int gPatchChromeDispatchCountV15 = 0;

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
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
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

static std::string PatchChromeCaptionV15(const PatchChromeV15& item) {
  if (!item.binding.empty()) {
    auto it = gStateByName.find(item.binding);
    if (it != gStateByName.end() && gStates[(size_t)it->second].type == ST_TEXT) return gStates[(size_t)it->second].text;
  }
  return item.text;
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

static gboolean PatchOnTimerV15(gpointer data) {
  const auto* item = PatchChromeForNativeIndexV15(gPatchChromeV15, GPOINTER_TO_INT(data));
  if (item) PatchDispatchChromeV15(*item);
  return TRUE;
}

static void PatchOnPictureV15(GtkWidget*, gpointer data) {
  const auto* item = PatchChromeForNativeIndexV15(gPatchChromeV15, GPOINTER_TO_INT(data));
  if (item) PatchDispatchChromeV15(*item);
}

static bool PatchInstallChromeV15() {
  gPatchChromeViewsV15.assign(gControls.size(), nullptr);
  gPatchChromeTimersV15.assign(gControls.size(), 0);
  for (const auto& item : gPatchChromeV15) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.widget) return false;
    GtkWidget* parent = gtk_widget_get_parent(c.widget);
    if (!parent || !GTK_IS_FIXED(parent)) return false;
    GtkAllocation allocation{}; gtk_widget_get_allocation(c.widget, &allocation);
    GtkWidget* view = nullptr;
    if (item.kind == PATCH_CHROME_PANEL_V15) {
      view = gtk_frame_new(PatchChromeCaptionV15(item).c_str());
    } else if (item.kind == PATCH_CHROME_TIMER_V15) {
      gPatchChromeTimersV15[(size_t)item.nativeIndex] = g_timeout_add(item.interval, PatchOnTimerV15, GINT_TO_POINTER(item.nativeIndex));
      gtk_widget_hide(c.widget);
      continue;
    } else if (item.kind == PATCH_CHROME_PICTURE_V15) {
      view = gtk_button_new_with_label(PatchChromeCaptionV15(item).c_str());
      g_signal_connect(view, "clicked", G_CALLBACK(PatchOnPictureV15), GINT_TO_POINTER(item.nativeIndex));
    } else {
      view = gtk_statusbar_new();
      gtk_statusbar_push(GTK_STATUSBAR(view), 0, PatchChromeCaptionV15(item).c_str());
    }
    if (!view) return false;
    gtk_widget_set_size_request(view, std::max(1, allocation.width), std::max(1, allocation.height));
    gtk_fixed_put(GTK_FIXED(parent), view, allocation.x, allocation.y);
    AtkObject* accessible = gtk_widget_get_accessible(view);
    if (accessible) atk_object_set_name(accessible, PatchControlNameV09(c).c_str());
    gPatchChromeViewsV15[(size_t)item.nativeIndex] = view;
    gtk_widget_hide(c.widget);
    gtk_widget_show(view);
  }
  return true;
}

static void PatchRefreshChromeV15() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchChromeV15) {
    auto& c = gControls[(size_t)item.nativeIndex];
    GtkWidget* view = item.nativeIndex >= 0 && item.nativeIndex < (int)gPatchChromeViewsV15.size() ? gPatchChromeViewsV15[(size_t)item.nativeIndex] : nullptr;
    if (item.kind == PATCH_CHROME_TIMER_V15) { if (c.widget) gtk_widget_hide(c.widget); continue; }
    if (!view || !c.widget) continue;
    GtkWidget* parent = gtk_widget_get_parent(c.widget);
    if (parent && GTK_IS_FIXED(parent)) {
      GtkAllocation allocation{}; gtk_widget_get_allocation(c.widget, &allocation);
      gtk_fixed_move(GTK_FIXED(parent), view, allocation.x, allocation.y);
      gtk_widget_set_size_request(view, std::max(1, allocation.width), std::max(1, allocation.height));
    }
    if (item.kind == PATCH_CHROME_PANEL_V15) gtk_frame_set_label(GTK_FRAME(view), PatchChromeCaptionV15(item).c_str());
    else if (item.kind == PATCH_CHROME_PICTURE_V15) gtk_button_set_label(GTK_BUTTON(view), PatchChromeCaptionV15(item).c_str());
    else if (GTK_IS_STATUSBAR(view)) { gtk_statusbar_pop(GTK_STATUSBAR(view), 0); gtk_statusbar_push(GTK_STATUSBAR(view), 0, PatchChromeCaptionV15(item).c_str()); }
    gtk_widget_hide(c.widget); gtk_widget_show(view);
  }
  gRefreshing = previous;
}

static void PatchOnClickedV15(GtkWidget* widget, gpointer data) { PatchOnClickedV14(widget, data); PatchRefreshChromeV15(); }
static void PatchOnFormAllocateV15(GtkWidget*, GtkAllocation*, gpointer) { PatchRefreshChromeV15(); }

static int RunPatchChromeSmokeV15() {
  int code = 360;
  for (const auto& item : gPatchChromeV15) {
    if (item.kind == PATCH_CHROME_TIMER_V15) {
      if (!gPatchChromeTimersV15[(size_t)item.nativeIndex]) return code++;
      if (!item.events.empty()) { int before = gPatchChromeDispatchCountV15; if (!PatchDispatchChromeV15(item) || gPatchChromeDispatchCountV15 <= before) return code++; }
      continue;
    }
    GtkWidget* view = gPatchChromeViewsV15[(size_t)item.nativeIndex];
    if (!view) return code++;
    if (item.kind == PATCH_CHROME_PICTURE_V15 && !item.events.empty()) {
      int before = gPatchChromeDispatchCountV15;
      if (!PatchDispatchChromeV15(item) || gPatchChromeDispatchCountV15 <= before) return code++;
    }
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV15(payloadV14) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15()) return 22;
  PatchSyncListShadowsV11(); gtk_init(&argc, &argv);
  if (!CreateForms() || !PatchInstallTablesV10() || !PatchRewireEventsV11() || !PatchInstallMenusV12() || !PatchRewireEventsV12() || !PatchRewireTableEventsV12() || !PatchInstallTreesV13() || !PatchRewireEventsV13() || !PatchInstallSlidersV14() || !PatchRewireEventsV14() || !PatchInstallChromeV15()) return 21;
  for (int index = 0; index < (int)gForms.size(); ++index) if (gForms[(size_t)index].fixed) {
    g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(OnPatchFormAllocateV09), GINT_TO_POINTER(index));
    g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV13), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV14), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV15), GINT_TO_POINTER(index));
  }
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15();
  for (auto& f : gForms) if (f.visible) gtk_widget_show_all(f.window);
  PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15();
  while (gtk_events_pending()) gtk_main_iteration();
  if (gSmokeMode) {
    int result = RunSmoke();
    if (!result) result = RunPatchAccessibilitySmokeV09();
    if (!result) result = RunPatchTableAccessibilitySmokeV10();
    if (!result) result = RunPatchResponsiveSmokeV09();
    if (!result) result = RunPatchTableSmokeV10();
    if (!result) result = RunPatchListSmokeV11();
    if (!result) result = RunPatchMenuSmokeV12();
    if (!result) result = RunPatchTreeSmokeV13();
    if (!result) result = RunPatchSliderSmokeV14();
    if (!result) result = RunPatchChromeSmokeV15();
    for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
    PatchDestroyMenusV12();
    return result;
  }
  gtk_main();
  for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
  PatchDestroyMenusV12();
  return 0;
}
