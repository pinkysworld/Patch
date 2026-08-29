// Patch sealed GTK3 GUI runtime v1.8.
// Payload v17 adds PaintBox draw image over payload-v16/runtime-v1.7.
#define PATCH_RUNTIME_V18_RESTORE_MAIN PatchRuntimeV17CompatibilityMain
#include "gtk-sealed-gui-v17.cpp"
#undef main
#undef PATCH_RUNTIME_V18_RESTORE_MAIN
#include "sealed-paintbox-image-v18.hpp"

static std::vector<PatchPaintBoxV18> gPatchPaintImageBoxesV18;
static std::vector<GtkWidget*> gPatchPaintImageViewsV18;
static std::map<std::string, GdkPixbuf*> gPatchPaintImagesV18;

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

static GdkPixbuf* PatchPaintCachedImageV18(const std::string& source) {
  auto it = gPatchPaintImagesV18.find(source);
  if (it != gPatchPaintImagesV18.end()) return it->second;
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(source, picture) || picture.bytes.empty()) {
    gPatchPaintImagesV18[source] = nullptr;
    return nullptr;
  }
  GdkPixbufLoader* loader = gdk_pixbuf_loader_new();
  if (!loader) return nullptr;
  GError* error = nullptr;
  gboolean wrote = gdk_pixbuf_loader_write(loader, picture.bytes.data(), picture.bytes.size(), &error);
  gboolean closed = wrote ? gdk_pixbuf_loader_close(loader, &error) : FALSE;
  GdkPixbuf* decoded = wrote && closed ? gdk_pixbuf_loader_get_pixbuf(loader) : nullptr;
  if (decoded) g_object_ref(decoded);
  if (error) g_error_free(error);
  g_object_unref(loader);
  if (decoded && (gdk_pixbuf_get_width(decoded) < 1 || gdk_pixbuf_get_height(decoded) < 1)) {
    g_object_unref(decoded);
    decoded = nullptr;
  }
  gPatchPaintImagesV18[source] = decoded;
  return decoded;
}

static void PatchDestroyPaintImagesV18() {
  for (auto& item : gPatchPaintImagesV18) if (item.second) g_object_unref(item.second);
  gPatchPaintImagesV18.clear();
}

static bool PatchResolvePaintImageBoxesV18() {
  for (const auto& item : gPatchPaintImageBoxesV18) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
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

static void PatchPaintDrawNodeV18(cairo_t* cr, const PatchPaintNodeV18& node, int loopCount, const PatchPaintMetricsV17& metrics) {
  if (node.operation == PATCH_PAINT_CLEAR_V18) {
    PatchColorV16 color;
    if (!PatchParseColorV16(node.color, true, color) || color.transparent) return;
    PatchCairoSetColorV16(cr, color);
    cairo_rectangle(cr, 0, 0, metrics.width, metrics.height);
    cairo_fill(cr);
    return;
  }
  if (node.operation == PATCH_PAINT_LINE_V18) {
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
  if (node.operation == PATCH_PAINT_RECTANGLE_V18 || node.operation == PATCH_PAINT_ELLIPSE_V18) {
    double x = 0, y = 0, w = 0, h = 0, strokeWidth = 0;
    PatchColorV16 fill, stroke;
    if (!PatchPaintNumberV17(node.x, loopCount, -1e6, 1e6, x) || !PatchPaintNumberV17(node.y, loopCount, -1e6, 1e6, y) || !PatchPaintNumberV17(node.width, loopCount, 0, 1e6, w) || !PatchPaintNumberV17(node.height, loopCount, 0, 1e6, h)) return;
    if (!PatchParseColorV16(node.fill, true, fill) || !PatchParseColorV16(node.stroke, false, stroke) || !PatchPaintNumberV17(node.strokeWidth, loopCount, 0, 64, strokeWidth)) return;
    const double dx = PatchPaintMapX(metrics, x), dy = PatchPaintMapY(metrics, y), dw = PatchPaintMapW(metrics, w), dh = PatchPaintMapH(metrics, h);
    cairo_set_line_width(cr, strokeWidth);
    cairo_set_line_cap(cr, CAIRO_LINE_CAP_BUTT);
    if (node.operation == PATCH_PAINT_ELLIPSE_V18) {
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
  if (node.operation == PATCH_PAINT_TEXT_V18) {
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
    return;
  }
  if (node.operation == PATCH_PAINT_IMAGE_V18) {
    double x = 0, y = 0, w = 0, h = 0;
    if (!PatchPaintNumberV17(node.x, loopCount, -1e6, 1e6, x) || !PatchPaintNumberV17(node.y, loopCount, -1e6, 1e6, y) || !PatchPaintNumberV17(node.width, loopCount, 0, 1e6, w) || !PatchPaintNumberV17(node.height, loopCount, 0, 1e6, h) || w <= 0 || h <= 0) return;
    GdkPixbuf* pixbuf = PatchPaintCachedImageV18(node.source);
    if (!pixbuf) return;
    const double dx = PatchPaintMapX(metrics, x), dy = PatchPaintMapY(metrics, y);
    const double dw = PatchPaintMapW(metrics, w), dh = PatchPaintMapH(metrics, h);
    const int srcW = gdk_pixbuf_get_width(pixbuf), srcH = gdk_pixbuf_get_height(pixbuf);
    if (srcW < 1 || srcH < 1) return;
    cairo_save(cr);
    cairo_translate(cr, dx, dy);
    cairo_scale(cr, dw / (double)srcW, dh / (double)srcH);
    gdk_cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
    cairo_paint(cr);
    cairo_restore(cr);
  }
}

static gboolean PatchPaintBoxDrawV18(GtkWidget* widget, cairo_t* cr, gpointer data) {
  const auto* item = PatchPaintBoxForNativeIndexV18(gPatchPaintImageBoxesV18, GPOINTER_TO_INT(data));
  if (!item) return FALSE;
  GtkAllocation allocation{}; gtk_widget_get_allocation(widget, &allocation);
  PatchPaintBoxV17 box;
  box.width = item->width;
  box.height = item->height;
  PatchPaintMetricsV17 metrics;
  if (!PatchPaintMetricsFromBoxV17(box, (double)std::max(1, allocation.width), (double)std::max(1, allocation.height), metrics)) return FALSE;
  PatchPaintRunProgramV18(item->program, 0, [&](const PatchPaintNodeV18& node, int loopCount) {
    PatchPaintDrawNodeV18(cr, node, loopCount, metrics);
  });
  return FALSE;
}

static bool PatchInstallPaintImageBoxesV18() {
  gPatchPaintImageViewsV18.assign(gControls.size(), nullptr);
  for (const auto& item : gPatchPaintImageBoxesV18) {
    auto& c = gControls[(size_t)item.nativeIndex];
    GtkWidget* underlay = item.nativeIndex >= 0 && item.nativeIndex < (int)gPatchPaintBoxViewsV17.size() ? gPatchPaintBoxViewsV17[(size_t)item.nativeIndex] : nullptr;
    GtkWidget* host = underlay ? underlay : c.widget;
    if (!host) return false;
    GtkWidget* parent = gtk_widget_get_parent(host);
    if (!parent || !GTK_IS_FIXED(parent)) return false;
    GtkAllocation allocation{}; gtk_widget_get_allocation(host, &allocation);
    GtkWidget* view = gtk_drawing_area_new();
    if (!view) return false;
    gtk_widget_set_size_request(view, std::max(1, allocation.width), std::max(1, allocation.height));
    g_signal_connect(view, "draw", G_CALLBACK(PatchPaintBoxDrawV18), GINT_TO_POINTER(item.nativeIndex));
    gtk_fixed_put(GTK_FIXED(parent), view, allocation.x, allocation.y);
    AtkObject* accessible = gtk_widget_get_accessible(view);
    if (accessible) atk_object_set_name(accessible, (PatchControlNameV09(c) + " drawing surface").c_str());
    gPatchPaintImageViewsV18[(size_t)item.nativeIndex] = view;
    gtk_widget_hide(host);
    if (c.widget) gtk_widget_hide(c.widget);
    gtk_widget_show_all(view);
  }
  return true;
}

static void PatchRefreshPaintImageBoxesV18() {
  bool previous = gRefreshing; gRefreshing = true;
  for (const auto& item : gPatchPaintImageBoxesV18) {
    auto& c = gControls[(size_t)item.nativeIndex];
    GtkWidget* view = item.nativeIndex >= 0 && item.nativeIndex < (int)gPatchPaintImageViewsV18.size() ? gPatchPaintImageViewsV18[(size_t)item.nativeIndex] : nullptr;
    GtkWidget* underlay = item.nativeIndex >= 0 && item.nativeIndex < (int)gPatchPaintBoxViewsV17.size() ? gPatchPaintBoxViewsV17[(size_t)item.nativeIndex] : nullptr;
    GtkWidget* host = underlay ? underlay : c.widget;
    if (!view || !host) continue;
    GtkWidget* parent = gtk_widget_get_parent(host);
    GtkAllocation allocation{};
    if (parent && GTK_IS_FIXED(parent)) {
      gtk_widget_get_allocation(host, &allocation);
      gtk_fixed_move(GTK_FIXED(parent), view, allocation.x, allocation.y);
      gtk_widget_set_size_request(view, std::max(1, allocation.width), std::max(1, allocation.height));
    }
    gtk_widget_hide(host);
    if (c.widget) gtk_widget_hide(c.widget);
    gtk_widget_show_all(view);
    gtk_widget_queue_draw(view);
  }
  gRefreshing = previous;
}

static void PatchAfterClickedV18(GtkWidget*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterToggledV18(GtkToggleButton*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterInputV18(GtkEditable*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterComboV18(GtkComboBox*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterListSingleV18(GtkListBox*, GtkListBoxRow*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterListMultiV18(GtkListBox*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterTableV18(GtkTreeSelection*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterMenuV18(GtkWidget*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterTreeV18(GtkTreeSelection*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterSliderV18(GtkRange*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchAfterPictureV18(GtkWidget*, gpointer) { PatchRefreshPaintImageBoxesV18(); }
static void PatchOnFormAllocateV18(GtkWidget*, GtkAllocation*, gpointer) { PatchRefreshPaintImageBoxesV18(); }

static gboolean PatchOnTimerV18(gpointer data) {
  gboolean keep = PatchOnTimerV17(data);
  PatchRefreshPaintImageBoxesV18();
  return keep;
}

static bool PatchWirePaintImageRefreshV18() {
  for (int index = 0; index < (int)gControls.size(); ++index) {
    auto& c = gControls[(size_t)index];
    if (!c.widget || c.kind == 9 || PatchSliderForNativeIndexV14(gPatchSlidersV14, index)) continue;
    gpointer data = GINT_TO_POINTER(index);
    if (c.kind == CK_BUTTON) g_signal_connect_after(c.widget, "clicked", G_CALLBACK(PatchAfterClickedV18), data);
    else if (c.kind == CK_CHECKBOX) g_signal_connect_after(c.widget, "toggled", G_CALLBACK(PatchAfterToggledV18), data);
    else if (c.kind == CK_INPUT) g_signal_connect_after(c.widget, "changed", G_CALLBACK(PatchAfterInputV18), data);
    else if (c.kind == CK_COMBO) g_signal_connect_after(c.widget, "changed", G_CALLBACK(PatchAfterComboV18), data);
    else if (c.kind == CK_LISTBOX) {
      const bool multi = PatchFindListBoxV11(gPatchListBoxesV11, c.id) != nullptr;
      if (multi) g_signal_connect_after(c.widget, "selected-rows-changed", G_CALLBACK(PatchAfterListMultiV18), data);
      else g_signal_connect_after(c.widget, "row-selected", G_CALLBACK(PatchAfterListSingleV18), data);
    } else if (c.kind == CK_RADIO) {
      for (GtkWidget* radio : c.radioItems) g_signal_connect_after(radio, "toggled", G_CALLBACK(PatchAfterToggledV18), data);
    }
  }

  for (const auto& table : gPatchTablesV10) {
    GtkWidget* view = gPatchTableViewsV10[(size_t)table.nativeIndex];
    if (!view) return false;
    GtkTreeSelection* selection = gtk_tree_view_get_selection(GTK_TREE_VIEW(view));
    g_signal_connect_after(selection, "changed", G_CALLBACK(PatchAfterTableV18), GINT_TO_POINTER(table.nativeIndex));
  }
  for (int index = 0; index < (int)gMenuItems.size(); ++index) {
    auto& item = gMenuItems[(size_t)index];
    if (item.widget) g_signal_connect_after(item.widget, "activate", G_CALLBACK(PatchAfterMenuV18), GINT_TO_POINTER(index));
  }
  for (const auto& tree : gPatchTreesV13) {
    auto& native = gPatchGtkTreesV13[(size_t)tree.nativeIndex];
    if (!native.view) return false;
    GtkTreeSelection* selection = gtk_tree_view_get_selection(GTK_TREE_VIEW(native.view));
    g_signal_connect_after(selection, "changed", G_CALLBACK(PatchAfterTreeV18), GINT_TO_POINTER(tree.nativeIndex));
  }
  for (const auto& slider : gPatchSlidersV14) {
    GtkWidget* view = gPatchSliderViewsV14[(size_t)slider.nativeIndex];
    if (!view) return false;
    g_signal_connect_after(view, "value-changed", G_CALLBACK(PatchAfterSliderV18), GINT_TO_POINTER(slider.nativeIndex));
  }
  for (const auto& item : gPatchChromeV15) {
    const int index = item.nativeIndex;
    if (item.kind == PATCH_CHROME_TIMER_V15) {
      guint previous = gPatchChromeTimersV15[(size_t)index];
      if (previous) g_source_remove(previous);
      guint timer = g_timeout_add(item.interval, PatchOnTimerV18, GINT_TO_POINTER(index));
      if (!timer) return false;
      gPatchChromeTimersV15[(size_t)index] = timer;
      continue;
    }
    if (item.kind == PATCH_CHROME_PICTURE_V15) {
      GtkWidget* view = gPatchChromeViewsV15[(size_t)index];
      if (!view) return false;
      g_signal_connect_after(view, "clicked", G_CALLBACK(PatchAfterPictureV18), GINT_TO_POINTER(index));
    }
  }
  return true;
}

static int RunPatchPaintBoxImageSmokeV18() {
  int code = 410;
  for (const auto& item : gPatchPaintImageBoxesV18) {
    GtkWidget* view = gPatchPaintImageViewsV18[(size_t)item.nativeIndex];
    if (!view) return code++;
    const std::string* source = PatchPaintFirstImageSourceV18(item.program);
    if (!source) return code++;
    GdkPixbuf* image = PatchPaintCachedImageV18(*source);
    if (!image || gdk_pixbuf_get_width(image) < 1 || gdk_pixbuf_get_height(image) < 1) return code++;
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV18(payloadV17) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18()) return 22;
  PatchSyncListShadowsV11(); gtk_init(&argc, &argv);
  if (!CreateForms() || !PatchInstallTablesV10() || !PatchRewireEventsV11() || !PatchInstallMenusV12() || !PatchRewireEventsV12() || !PatchRewireTableEventsV12() || !PatchInstallTreesV13() || !PatchRewireEventsV13() || !PatchInstallSlidersV14() || !PatchRewireEventsV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17() || !PatchInstallPaintImageBoxesV18() || !PatchRewireEventsV17() || !PatchWirePaintImageRefreshV18()) return 21;
  for (int index = 0; index < (int)gForms.size(); ++index) if (gForms[(size_t)index].fixed) {
    g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(OnPatchFormAllocateV09), GINT_TO_POINTER(index));
    g_signal_connect(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV13), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV14), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV15), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV16), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV17), GINT_TO_POINTER(index));
    g_signal_connect_after(gForms[(size_t)index].fixed, "size-allocate", G_CALLBACK(PatchOnFormAllocateV18), GINT_TO_POINTER(index));
  }
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10(); RefreshUI(); PatchRefreshListsV11(); PatchRefreshMenusV12(); PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16(); PatchRefreshPaintBoxesV17(); PatchRefreshPaintImageBoxesV18();
  for (auto& f : gForms) if (f.visible) gtk_widget_show_all(f.window);
  PatchRefreshTreesV13(); PatchRefreshSlidersV14(); PatchRefreshChromeV15(); PatchRefreshShapesV16(); PatchRefreshPaintBoxesV17(); PatchRefreshPaintImageBoxesV18();
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
    if (!result) result = RunPatchPaintBoxImageSmokeV18();
    for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
    PatchDestroyPicturesV15();
    PatchDestroyPaintImagesV18();
    PatchDestroyMenusV12();
    return result;
  }
  gtk_main();
  for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
  PatchDestroyPicturesV15();
  PatchDestroyPaintImagesV18();
  PatchDestroyMenusV12();
  return 0;
}
