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
    assert.match(source, /sealed-paintbox-image-v18\.hpp/);
    assert.match(source, /int code = 410/);
  }
  assert.match(win32, /Image::FromStream/);
  assert.match(win32, /PatchPaintBoxV18/);
  assert.match(gtk, /gdk_pixbuf_loader_new/);
  assert.match(gtk, /gdk_cairo_set_source_pixbuf/);
  assert.match(appkit, /NSImage/);
  assert.match(appkit, /PatchPaintBoxViewV18/);
  assert.match(header, /"PIMG"/);
  assert.match(header, /PATCH_PAINT_IMAGE_V18/);
  assert.match(header, /PatchPaintRunProgramV18/);
  assert.match(header, /picture-data-v15\.hpp/);
  assert.match(paintboxHeader, /PATCH_WIN32_RUNTIME_V18_RESTORE_ENTRY/);
  assert.match(paintboxHeader, /PATCH_RUNTIME_V18_RESTORE_MAIN/);
  assert.match(example, /paintbox as canvas/);
  assert.match(example, /draw image "/);
  assert.match(example, /data:image\/png;base64,/);
});
