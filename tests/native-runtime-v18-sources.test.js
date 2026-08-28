import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('runtime v1.8 sources wrap v1.7 and decode payload 17 / PIMG', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v18.cpp', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v18.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v18.mm', 'utf8');
  const header = readFileSync('native-runtime/sealed-paintbox-image-v18.hpp', 'utf8');
  const paintboxHeader = readFileSync('native-runtime/sealed-paintbox-v17.hpp', 'utf8');
  const example = readFileSync('examples/paintbox-image-window.patch', 'utf8');
  for (const source of [win32, gtk, appkit]) {
    assert.match(source, /version != 17/);
    assert.match(source, /PatchConvertPayloadV17ToV16/);
    assert.match(source, /PATCH_PAINT_IMAGE_V18/);
    assert.match(source, /RunPatchPaintBoxImageSmokeV18/);
    assert.match(source, /PatchPaintFirstImageSourceV18/);
    assert.match(source, /sealed-paintbox-image-v18\.hpp/);
    assert.match(source, /int code = 410/);
  }
  assert.match(win32, /Image::FromStream/);
  assert.match(win32, /PatchPaintImageCacheEntryV18/);
  assert.match(win32, /gPatchPaintImagesV18\[source\] = \{image, stream\}/);
  assert.match(win32, /item\.second\.stream->Release\(\)/);
  assert.match(win32, /image->GetWidth\(\) == 0/);
  assert.match(win32, /PatchRenderPaintBoxV18/);
  assert.doesNotMatch(win32, /static void PatchPaintBoxV18\(/);
  assert.match(win32, /std::max\(1, static_cast<int>\(points\[1\]\.x - points\[0\]\.x\)\)/);
  assert.match(win32, /std::max\(1, static_cast<int>\(points\[1\]\.y - points\[0\]\.y\)\)/);

  assert.match(gtk, /gdk_pixbuf_loader_new/);
  assert.match(gtk, /gdk_cairo_set_source_pixbuf/);
  assert.match(gtk, /PatchRewireEventsV17\(\)/);
  assert.match(gtk, /PatchWirePaintImageRefreshV18\(\)/);
  assert.match(gtk, /PatchOnTimerV18/);
  assert.match(gtk, /g_signal_connect_after/);

  assert.match(appkit, /NSImage/);
  assert.match(appkit, /PatchPaintBoxViewV18/);
  assert.match(appkit, /PatchEventTargetV18 : PatchEventTargetV17/);
  assert.match(appkit, /PatchUpgradePaintTargetsV17\(\)/);
  assert.match(appkit, /PatchUpgradePaintImageTargetsV18\(\)/);
  assert.match(appkit, /PatchDestroyPaintImagesV18/);

  assert.match(header, /"PIMG"/);
  assert.match(header, /PATCH_PAINT_IMAGE_V18/);
  assert.match(header, /PatchPaintRunProgramV18/);
  assert.match(header, /PatchPaintFirstImageSourceV18/);
  assert.match(header, /depth > 32/);
  assert.match(header, /count > \(uint32_t\)std::max\(remaining, 0\)/);
  assert.match(header, /picture-data-v15\.hpp/);
  assert.match(paintboxHeader, /PATCH_WIN32_RUNTIME_V18_RESTORE_ENTRY/);
  assert.match(paintboxHeader, /PATCH_RUNTIME_V18_RESTORE_MAIN/);
  assert.match(example, /paintbox as canvas/);
  assert.match(example, /draw image "/);
  assert.match(example, /data:image\/png;base64,/);
});
