// Patch sealed GTK3 GUI runtime v1.9.
// Payload v18 adds Button ImageList assets over payload-v17/runtime-v1.8.
#define main PatchRuntimeV18CompatibilityMain
#include "gtk-sealed-gui-v18.cpp"
#undef main
#include "sealed-button-image-v19.hpp"

static std::vector<PatchButtonImageAssetV19> gPatchButtonImageAssetsV19;
static std::vector<PatchButtonImageConsumerV19> gPatchButtonImagesV19;
static std::vector<GdkPixbuf*> gPatchButtonNativeImagesV19;

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

static bool PatchResolveButtonImagesV19() {
  for (const auto& item : gPatchButtonImagesV19) {
    if (item.nativeIndex < 0 || item.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(item.controlId);
    if (it == gControlById.end() || it->second != item.nativeIndex) return false;
    if (gControls[(size_t)item.nativeIndex].kind != CK_BUTTON || item.assetIndex >= gPatchButtonImageAssetsV19.size()) return false;
  }
  return true;
}

static GdkPixbuf* PatchCreateButtonImageV19(const PatchButtonImageConsumerV19& consumer) {
  if (consumer.assetIndex >= gPatchButtonImageAssetsV19.size()) return nullptr;
  const auto& asset = gPatchButtonImageAssetsV19[consumer.assetIndex];
  GdkPixbuf* source = PatchPaintCachedImageV18(asset.dataUri);
  if (!source) return nullptr;
  return gdk_pixbuf_scale_simple(source, (int)consumer.logicalWidth, (int)consumer.logicalHeight, GDK_INTERP_BILINEAR);
}

static bool PatchInstallButtonImagesV19() {
  gPatchButtonNativeImagesV19.assign(gControls.size(), nullptr);
  for (const auto& item : gPatchButtonImagesV19) {
    auto& control = gControls[(size_t)item.nativeIndex];
    if (control.kind != CK_BUTTON || !control.widget || !GTK_IS_BUTTON(control.widget)) return false;
    GdkPixbuf* scaled = PatchCreateButtonImageV19(item);
    if (!scaled) return false;
    GtkWidget* image = gtk_image_new_from_pixbuf(scaled);
    if (!image) { g_object_unref(scaled); return false; }
    gtk_button_set_image(GTK_BUTTON(control.widget), image);
    gtk_button_set_image_position(GTK_BUTTON(control.widget), GTK_POS_LEFT);
    gtk_button_set_always_show_image(GTK_BUTTON(control.widget), TRUE);
    gPatchButtonNativeImagesV19[(size_t)item.nativeIndex] = scaled;
  }
  return true;
}

static void PatchDestroyButtonImagesV19() {
  for (GdkPixbuf* image : gPatchButtonNativeImagesV19) if (image) g_object_unref(image);
  gPatchButtonNativeImagesV19.clear();
}

static int RunPatchButtonImageSmokeV19() {
  int code = 420;
  for (const auto& item : gPatchButtonImagesV19) {
    auto& control = gControls[(size_t)item.nativeIndex];
    if (control.kind != CK_BUTTON || !control.widget || !GTK_IS_BUTTON(control.widget)) return code++;
    GtkWidget* image = gtk_button_get_image(GTK_BUTTON(control.widget));
    if (!image || !GTK_IS_IMAGE(image)) return code++;
    GdkPixbuf* pixbuf = gtk_image_get_pixbuf(GTK_IMAGE(image));
    if (!pixbuf || gdk_pixbuf_get_width(pixbuf) != (int)item.logicalWidth || gdk_pixbuf_get_height(pixbuf) != (int)item.logicalHeight) return code++;
    const char* label = gtk_button_get_label(GTK_BUTTON(control.widget));
    if (!label || std::string(label) != RenderText(control.text)) return code++;
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payloadV18, payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV19(payloadV18) || !PatchConvertPayloadV18ToV17(payloadV18, payloadV17, gPatchButtonImageAssetsV19, gPatchButtonImagesV19) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18() || !PatchResolveButtonImagesV19()) return 22;
  PatchSyncListShadowsV11(); gtk_init(&argc, &argv);
  if (!CreateForms() || !PatchInstallTablesV10() || !PatchRewireEventsV11() || !PatchInstallMenusV12() || !PatchRewireEventsV12() || !PatchRewireTableEventsV12() || !PatchInstallTreesV13() || !PatchRewireEventsV13() || !PatchInstallSlidersV14() || !PatchRewireEventsV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17() || !PatchInstallPaintImageBoxesV18() || !PatchInstallButtonImagesV19() || !PatchRewireEventsV17() || !PatchWirePaintImageRefreshV18()) { PatchDestroyButtonImagesV19(); return 21; }
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
    if (!result) result = RunPatchButtonImageSmokeV19();
    for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
    PatchDestroyButtonImagesV19(); PatchDestroyPicturesV15(); PatchDestroyPaintImagesV18(); PatchDestroyMenusV12();
    return result;
  }
  gtk_main();
  for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
  PatchDestroyButtonImagesV19(); PatchDestroyPicturesV15(); PatchDestroyPaintImagesV18(); PatchDestroyMenusV12();
  return 0;
}
