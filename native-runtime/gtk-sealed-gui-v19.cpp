// Patch sealed GTK3 GUI runtime v1.9.
// Payload v18 adds ImageList / Button image over payload-v17/runtime-v1.8.
#define PATCH_RUNTIME_V19_RESTORE_MAIN PatchRuntimeV18CompatibilityMain
#include "gtk-sealed-gui-v18.cpp"
#undef main
#undef PATCH_RUNTIME_V19_RESTORE_MAIN
#include "sealed-imagelist-v19.hpp"

static std::vector<PatchImageListV19> gPatchImageListsV19;
static std::vector<PatchButtonImageV19> gPatchButtonImagesV19;
static std::map<std::string, GdkPixbuf*> gPatchButtonPixbufsV19;

static bool ReadSelfPayloadV19(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 18 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static GdkPixbuf* PatchButtonPixbufV19(const std::string& source, int width, int height) {
  auto it = gPatchButtonPixbufsV19.find(source);
  if (it != gPatchButtonPixbufsV19.end()) return it->second;
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(source, picture) || picture.bytes.empty()) {
    gPatchButtonPixbufsV19[source] = nullptr;
    return nullptr;
  }
  GdkPixbufLoader* loader = gdk_pixbuf_loader_new();
  if (!loader) return nullptr;
  GError* error = nullptr;
  gboolean wrote = gdk_pixbuf_loader_write(loader, picture.bytes.data(), picture.bytes.size(), &error);
  gboolean closed = wrote ? gdk_pixbuf_loader_close(loader, &error) : FALSE;
  GdkPixbuf* decoded = wrote && closed ? gdk_pixbuf_loader_get_pixbuf(loader) : nullptr;
  GdkPixbuf* scaled = nullptr;
  if (decoded) scaled = gdk_pixbuf_scale_simple(decoded, std::max(1, width), std::max(1, height), GDK_INTERP_BILINEAR);
  if (error) g_error_free(error);
  g_object_unref(loader);
  gPatchButtonPixbufsV19[source] = scaled;
  return scaled;
}

static void PatchDestroyButtonImagesV19() {
  for (auto& item : gPatchButtonPixbufsV19) if (item.second) g_object_unref(item.second);
  gPatchButtonPixbufsV19.clear();
}

static bool PatchResolveButtonImagesV19() {
  for (const auto& item : gPatchButtonImagesV19) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(item.id);
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    if (gControls[(size_t)item.nativeIndex].kind != CK_BUTTON) return false;
  }
  return true;
}

static bool PatchInstallButtonImagesV19() {
  for (const auto& item : gPatchButtonImagesV19) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.widget || !GTK_IS_BUTTON(c.widget)) return false;
    GdkPixbuf* pixbuf = PatchButtonPixbufV19(item.source, (int)item.width, (int)item.height);
    if (!pixbuf) return false;
    GtkWidget* image = gtk_image_new_from_pixbuf(pixbuf);
    if (!image) return false;
    gtk_button_set_image(GTK_BUTTON(c.widget), image);
    gtk_button_set_always_show_image(GTK_BUTTON(c.widget), TRUE);
  }
  return true;
}

static int RunPatchImageListSmokeV19() {
  int code = 420;
  for (const auto& item : gPatchButtonImagesV19) {
    auto& c = gControls[(size_t)item.nativeIndex];
    if (!c.widget || !GTK_IS_BUTTON(c.widget)) return code++;
    if (!gtk_button_get_image(GTK_BUTTON(c.widget))) return code++;
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payloadV18, payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV19(payloadV18) || !PatchConvertPayloadV18ToV17(payloadV18, payloadV17, gPatchImageListsV19, gPatchButtonImagesV19) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18() || !PatchResolveButtonImagesV19()) return 22;
  PatchSyncListShadowsV11(); gtk_init(&argc, &argv);
  if (!CreateForms() || !PatchInstallTablesV10() || !PatchRewireEventsV11() || !PatchInstallMenusV12() || !PatchRewireEventsV12() || !PatchRewireTableEventsV12() || !PatchInstallTreesV13() || !PatchRewireEventsV13() || !PatchInstallSlidersV14() || !PatchRewireEventsV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17() || !PatchInstallPaintImageBoxesV18() || !PatchInstallButtonImagesV19()) return 21;
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
    if (!result) result = RunPatchImageListSmokeV19();
    for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
    PatchDestroyPicturesV15();
    PatchDestroyPaintImagesV18();
    PatchDestroyButtonImagesV19();
    PatchDestroyMenusV12();
    return result;
  }
  gtk_main();
  for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
  PatchDestroyPicturesV15();
  PatchDestroyPaintImagesV18();
  PatchDestroyButtonImagesV19();
  PatchDestroyMenusV12();
  return 0;
}
