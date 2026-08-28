// Patch sealed GTK3 GUI runtime v1.7.
// Payload v16 adds PaintBox Stage 1 clear/line/rectangle/ellipse/text over payload-v15/runtime-v1.6.
#define PATCH_RUNTIME_V17_RESTORE_MAIN PatchRuntimeV16CompatibilityMain
#include "gtk-sealed-gui-v16.cpp"
#undef main
#undef PATCH_RUNTIME_V17_RESTORE_MAIN
#include "sealed-paintbox-v17.hpp"

static std::vector<PatchPaintBoxV17> gPatchPaintBoxesV17;
static std::vector<GtkWidget*> gPatchPaintBoxViewsV17;

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
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
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

static void PatchPaintDrawNodeV17(cairo_t* cr, const PatchPaintNodeV17& node, int loopCount, const PatchPaintMetricsV17& metrics) {
  if (node.operation == PATCH_PAINT_CLEAR_V17) {
    PatchColorV16 color;
    if (!PatchParseColorV16(node.color, true, color) || color.transparent) return;
    PatchCairoSetColorV16(cr, color);
    cairo_rectangle(cr, 0, 0, metrics.width, metrics.height);
    cairo_fill(cr);
    return;
  }
  if (node.operation == PATCH_PAINT_LINE_V17) {
    double x1 = 0, y1 = 0, x2 = 0, y2 = 0, strokeWidth = 0;
    PatchColorV16 stroke;
    if (!PatchPaintNumberV17(node.x1, loopCount, -1e6, 1e6, x1) || !PatchPaintNumberV17(node.y1, loopCount, -1e6, 1e6, y1) || !PatchPaintNumberV17(node.x2, loopCount, -1e6, 1e6, x2) || !PatchPaintNumberV17(node.y2, loopCount, -1e6, 1e6, y2)) return;
    if (!PatchParseColorV16(node.stroke, false, stroke) || !PatchPaintNumberV17(node.strokeWidth, loopCount, 0, 64, strokeWidth) || strokeWidth <= 0) return;
    cairo_set_line_width(cr, strokeWidth);
    cairo_set_line_cap(cr, CAIRO_LINE_CAP_BUTT);
    cairo_move_to(cr, PatchPaintMapX(metrics, x1), PatchPaintMapY(metrics, y1));
    cairo_line_to(cr, PatchPaintMapX(metrics, x2), PatchPaintMapY(metrics, y2));
    PatchCairoSetColorV16(cr, stroke);
    cairo_stroke(cr);
    return;
  }
  if (node.operation == PATCH_PAINT_RECTANGLE_V17 || node.operation == PATCH_PAINT_ELLIPSE_V17) {
    double x = 0, y = 0, w = 0, h = 0, strokeWidth = 0;
    PatchColorV16 fill, stroke;
    if (!PatchPaintNumberV17(node.x, loopCount, -1e6, 1e6, x) || !PatchPaintNumberV17(node.y, loopCount, -1e6, 1e6, y) || !PatchPaintNumberV17(node.width, loopCount, 0, 1e6, w) || !PatchPaintNumberV17(node.height, loopCount, 0, 1e6, h)) return;
    if (!PatchParseColorV16(node.fill, true, fill) || !PatchParseColorV16(node.stroke, false, stroke) || !PatchPaintNumberV17(node.strokeWidth, loopCount, 0, 64, strokeWidth)) return;
    const double dx = PatchPaintMapX(metrics, x), dy = PatchPaintMapY(metrics, y), dw = PatchPaintMapW(metrics, w), dh = PatchPaintMapH(metrics, h);
    cairo_set_line_width(cr, strokeWidth);
    cairo_set_line_cap(cr, CAIRO_LINE_CAP_BUTT);
    if (node.operation == PATCH_PAINT_ELLIPSE_V17) {
      cairo_save(cr);
      cairo_translate(cr, dx + dw / 2.0, dy + dh / 2.0);
      cairo_scale(cr, std::max(dw / 2.0, 0.0001), std::max(dh / 2.0, 0.0001));
      cairo_new_path(cr);
      cairo_arc(cr, 0, 0, 1, 0, 2 * G_PI);
      cairo_restore(cr);
    } else {
      cairo_rectangle(cr, dx, dy, dw, dh);
    }
    if (!fill.transparent) { PatchCairoSetColorV16(cr, fill); cairo_fill_preserve(cr); }
    if (strokeWidth > 0) { PatchCairoSetColorV16(cr, stroke); cairo_stroke(cr); }
    else cairo_new_path(cr);
    return;
  }
  if (node.operation == PATCH_PAINT_TEXT_V17) {
    std::string text;
    double x = 0, y = 0, fontSize = 0;
    PatchColorV16 color;
    if (!PatchPaintEvalTextV17(node.textExpr, loopCount, text)) return;
    if (!PatchPaintNumberV17(node.x, loopCount, -1e6, 1e6, x) || !PatchPaintNumberV17(node.y, loopCount, -1e6, 1e6, y) || !PatchPaintNumberV17(node.fontSize, loopCount, 1, 512, fontSize)) return;
    if (!PatchParseColorV16(node.color, false, color)) return;
    cairo_select_font_face(cr, "sans-serif", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);
    cairo_set_font_size(cr, PatchPaintMapFont(metrics, fontSize));
    cairo_text_extents_t extents{};
    cairo_text_extents(cr, text.c_str(), &extents);
    PatchCairoSetColorV16(cr, color);
    cairo_move_to(cr, PatchPaintMapX(metrics, x), PatchPaintMapY(metrics, y) - extents.y_bearing);
    cairo_show_text(cr, text.c_str());
  }
}

static gboolean PatchPaintBoxDrawV17(GtkWidget* widget, cairo_t* cr, gpointer data) {
  const auto* item = PatchPaintBoxForNativeIndexV17(gPatchPaintBoxesV17, GPOINTER_TO_INT(data));
  if (!item) return FALSE;
  GtkAllocation allocation{}; gtk_widget_get_allocation(widget, &allocation);
  PatchPaintMetricsV17 metrics;
  if (!PatchPaintMetricsFromBoxV17(*item, (double)std::max(1, allocation.width), (double)std::max(1, allocation.height), metrics)) return FALSE;
  PatchPaintRunProgramV17(item->program, 0, [&](const PatchPaintNodeV17& node, int loopCount) {
    PatchPaintDrawNodeV17(cr, node, loopCount, metrics);
  });
  return FALSE;
}

static bool PatchInstallPaintBoxesV17() {
  gPatchPaintBoxViewsV17.assign(gControls.size(), nullptr);
  for (const auto& item : gPatchPaintBoxesV17) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.widget) return false;
    GtkWidget* parent = gtk_widget_get_parent(c.widget);
    if (!parent || !GTK_IS_FIXED(parent)) return false;
    GtkAllocation allocation{}; gtk_widget_get_allocation(c.widget, &allocation);
    GtkWidget* view = gtk_drawing_area_new();
    if (!view) return false;
    gtk_widget_set_size_request(view, std::max(1, allocation.width), std::max(1, allocation.height));
    g_signal_connect(view, "draw", G_CALLBACK(PatchPaintBoxDrawV17), GINT_TO_POINTER(item.nativeIndex));
    gtk_fixed_put(GTK_FIXED(parent), view, allocation.x, allocation.y);
    AtkObject* accessible = gtk_widget_get_accessible(view);
    if (accessible) atk_object_set_name(accessible, (PatchControlNameV09(c) + " drawing surface").c_str());
    gPatchPaintBoxViewsV17[(size_t)item.nativeIndex] = view;
    gtk_widget_hide(c.widget);
    gtk_widget_show_all(view);
  }
  return true;
}

static void PatchRefreshPaintBoxesV17() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchPaintBoxesV17) {
    auto& c = gControls[(size_t)item.nativeIndex];
    GtkWidget* view = item.nativeIndex >= 0 && item.nativeIndex < (int)gPatchPaintBoxViewsV17.size() ? gPatchPaintBoxViewsV17[(size_t)item.nativeIndex] : nullptr;
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

static void PatchOnClickedV17(GtkWidget* widget, gpointer data) { PatchOnClickedV16(widget, data); PatchRefreshPaintBoxesV17(); }
static void PatchOnFormAllocateV17(GtkWidget*, GtkAllocation*, gpointer) { PatchRefreshPaintBoxesV17(); }

static int RunPatchPaintBoxSmokeV17() {
  int code = 400;
  for (const auto& item : gPatchPaintBoxesV17) {
    GtkWidget* view = gPatchPaintBoxViewsV17[(size_t)item.nativeIndex];
    if (!view) return code++;
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV17(payloadV16) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17()) return 22;
  PatchSyncListShadowsV11(); gtk_init(&argc, &argv);
  if (!CreateForms() || !PatchInstallTablesV10() || !PatchRewireEventsV11() || !PatchInstallMenusV12() || !PatchRewireEventsV12() || !PatchRewireTableEventsV12() || !PatchInstallTreesV13() || !PatchRewireEventsV13() || !PatchInstallSlidersV14() || !PatchRewireEventsV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17()) return 21;
  for (int index = 0; index < (int)gForms.size(); ++index) if (gForms[(size_t)index].fixed) {
    g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(OnPatchFormAllocateV09), GINT_TO_POINTER(index));
    g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV13), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV14), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV15), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV16), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV17), GINT_TO_POINTER(index));
  }
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16(); PatchRefreshPaintBoxesV17();
  for (auto& f : gForms) if (f.visible) gtk_widget_show_all(f.window);
  PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16(); PatchRefreshPaintBoxesV17();
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
    if (!result) result = RunPatchPaintBoxSmokeV17();
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
