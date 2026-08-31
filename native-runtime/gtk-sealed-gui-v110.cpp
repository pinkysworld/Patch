// Patch sealed GTK3 GUI runtime v1.10.
// Payload v19 adds application/Form Window icons over payload-v18/runtime-v1.9.
#define PATCH_RUNTIME_V110_RESTORE_MAIN PatchRuntimeV19CompatibilityMain
#include "gtk-sealed-gui-v19.cpp"
#undef main
#undef PATCH_RUNTIME_V110_RESTORE_MAIN
#include "sealed-window-icon-v110.hpp"

static std::vector<PatchWindowIconAssetV110> gPatchWindowIconAssetsV110;
static std::vector<PatchWindowIconConsumerV110> gPatchWindowIconsV110;
static std::vector<GdkPixbuf*> gPatchNativeWindowIconsV110;

static bool ReadSelfPayloadV110(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate); if (!file) return false;
  std::streamoff size = file.tellg(); if (size < 20) return false;
  file.seekg(size - 20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer), 20);
  if (!file || memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8), length = le32(footer + 12), crc = le32(footer + 16);
  if (version != 19 || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchResolveWindowIconsV110() {
  for (const auto& item : gPatchWindowIconsV110) {
    if (item.formIndex >= gForms.size() || item.assetIndex >= gPatchWindowIconAssetsV110.size()) return false;
    if (!item.formId.empty() && gForms[item.formIndex].id != item.formId) return false;
  }
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  return gPatchWindowIconsV110.empty() || (application && application->assetIndex < gPatchWindowIconAssetsV110.size());
}

static GdkPixbuf* PatchCreateWindowIconV110(const PatchWindowIconAssetV110& asset) {
  PatchPictureDataV15 picture;
  if (!PatchDecodePictureDataUriV15(asset.dataUri, picture) || picture.bytes.empty()) return nullptr;
  GdkPixbufLoader* loader = gdk_pixbuf_loader_new();
  if (!loader) return nullptr;
  GError* error = nullptr;
  gboolean wrote = gdk_pixbuf_loader_write(loader, picture.bytes.data(), picture.bytes.size(), &error);
  if (wrote) wrote = gdk_pixbuf_loader_close(loader, &error);
  GdkPixbuf* pixbuf = wrote ? gdk_pixbuf_loader_get_pixbuf(loader) : nullptr;
  if (pixbuf) g_object_ref(pixbuf);
  if (error) g_error_free(error);
  g_object_unref(loader);
  return pixbuf;
}

static bool PatchPrepareWindowIconsV110() {
  gPatchNativeWindowIconsV110.assign(gPatchWindowIconAssetsV110.size(), nullptr);
  for (size_t index = 0; index < gPatchWindowIconAssetsV110.size(); ++index) {
    GdkPixbuf* pixbuf = PatchCreateWindowIconV110(gPatchWindowIconAssetsV110[index]);
    if (!pixbuf) return false;
    gPatchNativeWindowIconsV110[index] = pixbuf;
  }
  return true;
}

static GdkPixbuf* PatchNativeWindowIconV110(const PatchWindowIconConsumerV110* consumer) {
  if (!consumer || consumer->assetIndex >= gPatchNativeWindowIconsV110.size()) return nullptr;
  return gPatchNativeWindowIconsV110[consumer->assetIndex];
}

static bool PatchInstallWindowIconsV110() {
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  GdkPixbuf* applicationIcon = PatchNativeWindowIconV110(application);
  if (applicationIcon) gtk_window_set_default_icon(applicationIcon);
  for (uint32_t formIndex = 0; formIndex < gForms.size(); ++formIndex) {
    auto& form = gForms[formIndex];
    if (!form.window || !GTK_IS_WINDOW(form.window)) return false;
    const auto* explicitIcon = PatchWindowIconForFormV110(gPatchWindowIconsV110, formIndex);
    const auto* chosen = explicitIcon ? explicitIcon : application;
    GdkPixbuf* icon = PatchNativeWindowIconV110(chosen);
    if (icon) gtk_window_set_icon(GTK_WINDOW(form.window), icon);
  }
  return true;
}

static void PatchDestroyWindowIconsV110() {
  for (GdkPixbuf* icon : gPatchNativeWindowIconsV110) if (icon) g_object_unref(icon);
  gPatchNativeWindowIconsV110.clear();
}

static int RunPatchWindowIconSmokeV110() {
  int code = 460;
  const auto* application = PatchApplicationIconV110(gPatchWindowIconsV110);
  if (!gPatchWindowIconsV110.empty() && !application) return code++;
  for (uint32_t formIndex = 0; formIndex < gForms.size(); ++formIndex) {
    const auto* explicitIcon = PatchWindowIconForFormV110(gPatchWindowIconsV110, formIndex);
    const auto* chosen = explicitIcon ? explicitIcon : application;
    if (!chosen) continue;
    GdkPixbuf* expected = PatchNativeWindowIconV110(chosen);
    if (!expected || !gForms[formIndex].window || !GTK_IS_WINDOW(gForms[formIndex].window)) return code++;
    if (gtk_window_get_icon(GTK_WINDOW(gForms[formIndex].window)) != expected) return code++;
  }
  return 0;
}

int main(int argc, char* argv[]) {
  gSmokeMode = HasArg(argc, argv, "--patch-smoke");
  std::vector<uint8_t> payloadV19, payloadV18, payloadV17, payloadV16, payloadV15, payloadV14, payloadV13, payloadV12, payloadV11, payloadV10, payloadV9, payloadV8, payloadV7;
  if (!ReadSelfPayloadV110(payloadV19) || !PatchConvertPayloadV19ToV18(payloadV19, payloadV18, gPatchWindowIconAssetsV110, gPatchWindowIconsV110) || !PatchConvertPayloadV18ToV17(payloadV18, payloadV17, gPatchButtonImageAssetsV19, gPatchButtonImagesV19) || !PatchConvertPayloadV17ToV16(payloadV17, payloadV16, gPatchPaintImageBoxesV18) || !PatchConvertPayloadV16ToV15(payloadV16, payloadV15, gPatchPaintBoxesV17) || !PatchConvertPayloadV15ToV14(payloadV15, payloadV14, gPatchShapesV16) || !PatchConvertPayloadV14ToV13(payloadV14, payloadV13, gPatchChromeV15) || !PatchConvertPayloadV13ToV12(payloadV13, payloadV12, gPatchSlidersV14) || !PatchConvertPayloadV12ToV11(payloadV12, payloadV11, gPatchTreesV13) || !PatchConvertPayloadV11ToV10(payloadV11, payloadV10, gPatchMenuEntriesV12) || !PatchConvertPayloadV10ToV9(payloadV10, payloadV9, gPatchListStatesV11, gPatchListBoxesV11, gPatchListEventsV11) || !PatchConvertPayloadV9ToV8(payloadV9, payloadV8, gPatchTablesV10) || !PatchConvertPayloadV8ToV7(payloadV8, payloadV7, gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size() != gControls.size() || !PatchResolveTablesV10() || !PatchResolveListsV11() || !PatchResolveTreesV13() || !PatchResolveSlidersV14() || !PatchResolveChromeV15() || !PatchResolveShapesV16() || !PatchResolvePaintBoxesV17() || !PatchResolvePaintImageBoxesV18() || !PatchResolveButtonImagesV19() || !PatchResolveWindowIconsV110()) return 22;
  PatchSyncListShadowsV11();
  gtk_init(&argc, &argv);
  if (!PatchPrepareWindowIconsV110()) return 22;
  if (!CreateForms() || !PatchInstallTablesV10() || !PatchRewireEventsV11() || !PatchInstallMenusV12() || !PatchRewireEventsV12() || !PatchRewireTableEventsV12() || !PatchInstallTreesV13() || !PatchRewireEventsV13() || !PatchInstallSlidersV14() || !PatchRewireEventsV14() || !PatchInstallChromeV15() || !PatchInstallShapesV16() || !PatchInstallPaintBoxesV17() || !PatchInstallPaintImageBoxesV18() || !PatchInstallButtonImagesV19() || !PatchRewireEventsV17() || !PatchWirePaintImageRefreshV18() || !PatchInstallWindowIconsV110()) { PatchDestroyWindowIconsV110(); PatchDestroyButtonImagesV19(); return 21; }
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
    if (!result) result = RunPatchWindowIconSmokeV110();
    for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
    PatchDestroyWindowIconsV110(); PatchDestroyButtonImagesV19(); PatchDestroyPicturesV15(); PatchDestroyPaintImagesV18(); PatchDestroyMenusV12();
    return result;
  }
  gtk_main();
  for (guint id : gPatchChromeTimersV15) if (id) g_source_remove(id);
  PatchDestroyWindowIconsV110(); PatchDestroyButtonImagesV19(); PatchDestroyPicturesV15(); PatchDestroyPaintImagesV18(); PatchDestroyMenusV12();
  return 0;
}
