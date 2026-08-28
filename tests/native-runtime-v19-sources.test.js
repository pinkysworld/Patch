import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('runtime v1.9 sources wrap v1.8 and decode payload 18 / PILT', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v19.cpp', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v19.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v19.mm', 'utf8');
  const header = readFileSync('native-runtime/sealed-imagelist-v19.hpp', 'utf8');
  const paintHeader = readFileSync('native-runtime/sealed-paintbox-image-v18.hpp', 'utf8');
  const example = readFileSync('examples/imagelist-window.patch', 'utf8');
  for (const source of [win32, gtk, appkit]) {
    assert.match(source, /version != 18/);
    assert.match(source, /PatchConvertPayloadV18ToV17/);
    assert.match(source, /RunPatchImageListSmokeV19/);
    assert.match(source, /sealed-imagelist-v19\.hpp/);
    assert.match(source, /int code = 420/);
  }
  assert.match(win32, /BCM_SETIMAGELIST/);
  assert.match(win32, /ImageList_Create/);
  assert.match(gtk, /gtk_button_set_image/);
  assert.match(gtk, /gdk_pixbuf_loader_new/);
  assert.match(appkit, /setImagePosition:NSImageLeft/);
  assert.match(appkit, /NSImage/);
  assert.match(header, /"PILT"/);
  assert.match(header, /PatchButtonImageV19/);
  assert.match(header, /picture-data-v15\.hpp/);
  assert.match(paintHeader, /PATCH_WIN32_RUNTIME_V19_RESTORE_ENTRY/);
  assert.match(paintHeader, /PATCH_RUNTIME_V19_RESTORE_MAIN/);
  assert.match(example, /imagelist as icons/);
  assert.match(example, /button "Open" as open_button image icons.open/);
});
