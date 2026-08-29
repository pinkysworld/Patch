import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('runtime v1.9 wraps v1.8 and retains ImageList/PILT decoding on all hosts', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v19.cpp', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v19.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v19.mm', 'utf8');
  const header = readFileSync('native-runtime/sealed-imagelist-v19.hpp', 'utf8');
  const example = readFileSync('examples/imagelist-window.patch', 'utf8');
  for (const source of [win32, gtk, appkit]) {
    assert.match(source, /version != 18/);
    assert.match(source, /PatchConvertPayloadV18ToV17/);
    assert.match(source, /RunPatchImageListSmokeV19/);
    assert.match(source, /sealed-imagelist-v19\.hpp/);
    assert.match(source, /int code = 420/);
    assert.match(source, /RunPatchPaintBoxSmokeV17/);
    assert.match(source, /RunPatchPaintBoxImageSmokeV18/);
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
  assert.match(example, /imagelist as icons/);
  assert.match(example, /button "Open" as open_button image icons.open/);
});

test('PILT native reader uses overflow-safe remaining-byte checks and validates Button binding integrity', () => {
  const header = readFileSync('native-runtime/sealed-imagelist-v19.hpp', 'utf8');
  assert.match(header, /off_ > size_ \|\| n > size_ - off_/);
  assert.doesNotMatch(header, /off_ \+ n > size_/);
  assert.match(header, /PatchFindImageListV19/);
  assert.match(header, /PatchFindImageListItemV19/);
  assert.match(header, /item->source != button\.source/);
  assert.match(header, /button\.width != list->width \|\| button\.height != list->height/);
  assert.match(header, /nativeIndex > 0x7fffffffu/);
});

test('Win32 keeps the GDI+ source stream alive until the decoded Bitmap is finished', () => {
  const source = readFileSync('native-runtime/win32-sealed-gui-v19.cpp', 'utf8');
  const fromStream = source.indexOf('Bitmap::FromStream(stream)');
  const deleteOriginal = source.indexOf('delete original;', fromStream);
  const releaseStream = source.indexOf('stream->Release();', deleteOriginal);
  assert.ok(fromStream >= 0 && deleteOriginal > fromStream && releaseStream > deleteOriginal);
  assert.match(source, /const Status drawStatus = g\.DrawImage/);
  assert.match(source, /original->GetWidth\(\) < 1 \|\| original->GetHeight\(\) < 1/);
});

test('AppKit v1.9 preserves both PaintBox target upgrade layers', () => {
  const source = readFileSync('native-runtime/appkit-sealed-gui-v19.mm', 'utf8');
  assert.match(source, /gEventTarget = \[PatchEventTargetV18 new\]/);
  assert.match(source, /PatchUpgradePaintTargetsV17\(\)/);
  assert.match(source, /PatchUpgradePaintImageTargetsV18\(\)/);
  assert.match(source, /PatchPaintBoxResizeObserverV17/);
  assert.match(source, /PatchPaintBoxImageResizeObserverV18/);
  assert.match(source, /PatchDestroyButtonImagesV19/);
});

test('GTK v1.9 preserves both PaintBox event/repaint chains including Timer behavior', () => {
  const source = readFileSync('native-runtime/gtk-sealed-gui-v19.cpp', 'utf8');
  assert.match(source, /PatchRewireEventsV17\(\)/);
  assert.match(source, /PatchWirePaintImageRefreshV18\(\)/);
  assert.match(source, /PatchOnFormAllocateV17/);
  assert.match(source, /PatchOnFormAllocateV18/);
  assert.match(source, /PatchRefreshPaintBoxesV17/);
  assert.match(source, /PatchRefreshPaintImageBoxesV18/);
});
