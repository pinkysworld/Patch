// Patch sealed GTK3 GUI runtime v1.6.
// Payload v15 adds Shape Stage 1 rectangle/rounded/ellipse/line over payload-v14/runtime-v1.5.
#define main PatchRuntimeV15CompatibilityMain
#include "gtk-sealed-gui-v15.cpp"
#undef main
#include "sealed-shape-v16.hpp"

static std::vector<PatchShapeV16> gPatchShapesV16;
static std::vector<GtkWidget*> gPatchShapeViewsV16;

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
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(item.id);
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    const auto& c = gControls[(size_t)item.nativeIndex];
    if (c.kind != CK_TEXT) return false;
    PatchColorV16 fill, stroke; double strokeWidth = 0, cornerRadius = 0, opacity = 1;
    if (!PatchShapeStyleV16(item, fill, stroke, strokeWidth, cornerRadius, opacity)) return false;
  }
  return true;
}

static void PatchCairoSetColorV16(cairo_t* cr, const PatchColorV16& color) {
  cairo_set_source_rgba(cr, color.r / 255.0, color.g / 255.0, color.b / 255.0, color.transparent ? 0.0 : color.a / 255.0);
}

static void PatchCairoRoundedRectV16(cairo_t* cr, double x, double y, double w, double h, double rx, double ry) {
  rx = std::min(rx, w / 2.0);
  ry = std::min(ry, h / 2.0);
  if (rx <= 0 && ry <= 0) { cairo_rectangle(cr, x, y, w, h); return; }
  cairo_new_path(cr);
  cairo_move_to(cr, x + rx, y);
  cairo_line_to(cr, x + w - rx, y);
  cairo_arc(cr, x + w - rx, y + ry, rx, -G_PI_2, 0);
  cairo_line_to(cr, x + w, y + h - ry);
  cairo_arc(cr, x + w - rx, y + h - ry, rx, 0, G_PI_2);
  cairo_line_to(cr, x + rx, y + h);
  cairo_arc(cr, x + rx, y + h - ry, rx, G_PI_2, G_PI);
  cairo_line_to(cr, x, y + ry);
  cairo_arc(cr, x + rx, y + ry, rx, G_PI, 3 * G_PI_2);
  cairo_close_path(cr);
}

static gboolean PatchShapeDrawV16(GtkWidget* widget, cairo_t* cr, gpointer data) {
  const auto* item = PatchShapeForNativeIndexV16(gPatchShapesV16, GPOINTER_TO_INT(data));
  if (!item) return FALSE;
  PatchColorV16 fill, stroke; double strokeWidth = 0, cornerRadius = 0, opacity = 1;
  if (!PatchShapeStyleV16(*item, fill, stroke, strokeWidth, cornerRadius, opacity)) return FALSE;
  GtkAllocation allocation{}; gtk_widget_get_allocation(widget, &allocation);
  const double width = std::max(1, allocation.width), height = std::max(1, allocation.height);
  const double x = width * 0.01, y = height * 0.01, w = width * 0.98, h = height * 0.98;
  cairo_set_line_width(cr, strokeWidth);
  cairo_set_line_cap(cr, CAIRO_LINE_CAP_BUTT);
  if (item->kind == PATCH_SHAPE_ELLIPSE_V16) {
    cairo_save(cr);
    cairo_translate(cr, x + w / 2.0, y + h / 2.0);
    cairo_scale(cr, w / 2.0, h / 2.0);
    cairo_new_path(cr);
    cairo_arc(cr, 0, 0, 1, 0, 2 * G_PI);
    cairo_restore(cr);
    if (!fill.transparent) { PatchCairoSetColorV16(cr, fill); cairo_fill_preserve(cr); }
    if (strokeWidth > 0) { PatchCairoSetColorV16(cr, stroke); cairo_stroke(cr); }
    else cairo_new_path(cr);
    return FALSE;
  }
  if (item->kind == PATCH_SHAPE_LINE_V16) {
    if (strokeWidth > 0) {
      cairo_move_to(cr, 0, height / 2.0);
      cairo_line_to(cr, width, height / 2.0);
      PatchCairoSetColorV16(cr, stroke);
      cairo_stroke(cr);
    }
    return FALSE;
  }
  if (item->kind == PATCH_SHAPE_ROUNDED_V16) {
    PatchCairoRoundedRectV16(cr, x, y, w, h, cornerRadius * width / 100.0, cornerRadius * height / 100.0);
  } else {
    cairo_rectangle(cr, x, y, w, h);
  }
  if (!fill.transparent) { PatchCairoSetColorV16(cr, fill); cairo_fill_preserve(cr); }
  if (strokeWidth > 0) { PatchCairoSetColorV16(cr, stroke); cairo_stroke(cr); }
  else cairo_new_path(cr);
  return FALSE;
}

static bool PatchInstallShapesV16() {
  gPatchShapeViewsV16.assign(gControls.size(), nullptr);
  for (const auto& item : gPatchShapesV16) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.widget) return false;
    GtkWidget* parent = gtk_widget_get_parent(c.widget);
    if (!parent || !GTK_IS_FIXED(parent)) return false;
    GtkAllocation allocation{}; gtk_widget_get_allocation(c.widget, &allocation);
    GtkWidget* view = gtk_drawing_area_new();
    if (!view) return false;
    gtk_widget_set_size_request(view, std::max(1, allocation.width), std::max(1, allocation.height));
    g_signal_connect(view, "draw", G_CALLBACK(PatchShapeDrawV16), GINT_TO_POINTER(item.nativeIndex));
    gtk_fixed_put(GTK_FIXED(parent), view, allocation.x, allocation.y);
    AtkObject* accessible = gtk_widget_get_accessible(view);
    if (accessible) atk_object_set_name(accessible, (PatchControlNameV09(c) + " shape").c_str());
    gPatchShapeViewsV16[(size_t)item.nativeIndex] = view;
    gtk_widget_hide(c.widget);
    gtk_widget_show_all(view);
  }
  return true;
}

static void PatchRefreshShapesV16() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchShapesV16) {
    auto& c = gControls[(size_t)item.nativeIndex];
    GtkWidget* view = item.nativeIndex >= 0 && item.nativeIndex < (int)gPatchShapeViewsV16.size() ? gPatchShapeViewsV16[(size_t)item.nativeIndex] : nullptr;
    if (!view || !c.widget) continue;
    GtkWidget* parent = gtk_widget_get_parent(c.widget);
    GtkAllocation allocation{};
    if (parent && GTK_IS_FIXED(parent)) {
      gtk_widget_get_allocation(c.widget, &allocation);
      gtk_fixed_move(GTK_FIXED(parent), view, allocation.x, allocation.y);
      gtk_widget_set_size_request(view, std::max(1, allocation.width), std::max(1, allocation.height));
    }
    gtk_widget_hide(c.widget);
    gtk_widget_show_all(view);
    gtk_widget_queue_draw(view);
  }
  gRefreshing = previous;
}

static void PatchOnClickedV16(GtkWidget* widget, gpointer data) { PatchOnClickedV15(widget, data); PatchRefreshShapesV16(); }
static void PatchOnFormAllocateV16(GtkWidget*, GtkAllocation*, gpointer) { PatchRefreshShapesV16(); }

static int RunPatchShapeSmokeV16() {
  int code = 380;
  for (const auto& item : gPatchShapesV16) {
    GtkWidget* view = gPatchShapeViewsV16[(size_t)item.nativeIndex];
    if (!view) return code++;
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV16(payloadV15) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16()) return 22;
  PatchSyncListShadowsV11(); gtk_init(&argc, &argv);
  if (!CreateForms() || !PatchInstallTablesV10() || !PatchRewireEventsV11() || !PatchInstallMenusV12() || !PatchRewireEventsV12() || !PatchRewireTableEventsV12() || !PatchInstallTreesV13() || !PatchRewireEventsV13() || !PatchInstallSlidersV14() || !PatchRewireEventsV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16()) return 21;
  for (int index = 0; index < (int)gForms.size(); ++index) if (gForms[(size_t)index].fixed) {
    g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(OnPatchFormAllocateV09), GINT_TO_POINTER(index));
    g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV13), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV14), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV15), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV16), GINT_TO_POINTER(index));
  }
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16();
  for (auto& f : gForms) if (f.visible) gtk_widget_show_all(f.window);
  PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16();
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
    if (!result) result = RunPatchShapeSmokeV16();
    for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
    PatchDestroyPicturesV15();
    PatchDestroyMenusV12();
    return result;
  }
  gtk_main();
  for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
  PatchDestroyPicturesV15();
  PatchDestroyMenusV12();
  return 0;
}
