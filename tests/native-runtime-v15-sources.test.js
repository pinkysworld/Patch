import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('runtime v1.5 sources wrap v1.4 and decode payload 14 / PCHC', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v15.cpp', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v15.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v15.mm', 'utf8');
  const header = readFileSync('native-runtime/sealed-chrome-v15.hpp', 'utf8');
  const pictureData = readFileSync('native-runtime/picture-data-v15.hpp', 'utf8');
  const example = readFileSync('examples/chrome-window.patch', 'utf8');
  for (const source of [win32, gtk, appkit]) {
    assert.match(source, /version != 14/);
    assert.match(source, /PatchConvertPayloadV14ToV13/);
    assert.match(source, /PATCH_CHROME_TIMER_V15/);
    assert.match(source, /RunPatchChromeSmokeV15/);
    assert.match(source, /picture-data-v15\.hpp/);
    assert.match(source, /PatchPictureEmbeddedSourceV15/);
    assert.match(source, /PatchDecodePictureDataUriV15/);
  }
  assert.match(win32, /BS_GROUPBOX/);
  assert.match(win32, /SetTimer/);
  assert.match(win32, /IWICImagingFactory/);
  assert.match(win32, /CreateDIBSection/);
  assert.match(win32, /SS_BITMAP/);
  assert.match(win32, /windowscodecs\.lib/);
  assert.match(gtk, /gtk_frame_new/);
  assert.match(gtk, /GdkPixbufLoader/);
  assert.match(gtk, /gtk_button_set_image/);
  assert.match(appkit, /NSTimer/);
  assert.match(appkit, /NSImage/);
  assert.match(appkit, /NSImageScaleProportionallyUpOrDown/);
  assert.match(header, /"PCHC"/);
  assert.match(pictureData, /PATCH_PICTURE_MAX_BYTES_V15\s*=\s*2u\s*\*\s*1024u\s*\*\s*1024u/);
  assert.match(pictureData, /decodedSize\s*>\s*PATCH_PICTURE_MAX_BYTES_V15/);
  assert.match(pictureData, /data:image\/png;base64,/);
  assert.match(pictureData, /data:image\/jpeg;base64,/);
  assert.doesNotMatch(pictureData, /image\/webp/);
  assert.match(example, /picture as poster from "data:image\/png;base64,/);
});
