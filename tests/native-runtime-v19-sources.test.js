import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV18 } from '../src/native-gui-ir-v18.js';
import { encodeNativeGuiPayloadV18, inspectNativeGuiButtonImagesV18 } from '../src/sealed-native-gui-v18.js';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg==';
const OPEN_RESOURCE = Object.freeze({
  id: 'icons.open',
  path: 'resources/open.png',
  mediaType: 'image/png',
  size: 70,
  sha256: 'd126901e8b7f82749aee7b7c0ec59838286c9f8d75ffc74147f34ac2b4bad460',
  data: PNG_BASE64
});

test('runtime v1.9 sources wrap v1.8 and consume payload 18 / BIMG natively', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v19.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v19.mm', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v19.cpp', 'utf8');
  const header = readFileSync('native-runtime/sealed-button-image-v19.hpp', 'utf8');

  for (const source of [win32, appkit, gtk]) {
    assert.match(source, /version != 18/);
    assert.match(source, /PatchConvertPayloadV18ToV17/);
    assert.match(source, /PatchInstallButtonImagesV19/);
    assert.match(source, /RunPatchButtonImageSmokeV19/);
    assert.match(source, /sealed-button-image-v19\.hpp/);
    assert.match(source, /int code = 420/);
  }

  assert.match(win32, /BCM_SETIMAGELIST/);
  assert.match(win32, /BUTTON_IMAGELIST_ALIGN_LEFT/);
  assert.match(win32, /ImageList_Create/);
  assert.match(win32, /WindowText\(control\.hwnd\) != RenderText\(control\.text\)/);

  assert.match(appkit, /button\.imagePosition = NSImageLeft/);
  assert.match(appkit, /button\.imageScaling = NSImageScaleProportionallyDown/);
  assert.match(appkit, /button\.title isEqualToString:RenderText/);

  assert.match(gtk, /gtk_button_set_image/);
  assert.match(gtk, /gtk_button_set_always_show_image/);
  assert.match(gtk, /gdk_pixbuf_scale_simple/);
  assert.match(gtk, /gtk_button_get_label/);

  assert.match(header, /"BIMG"/);
  assert.match(header, /assetCount > 1024/);
  assert.match(header, /consumerCount > 4096/);
  assert.match(header, /extensionLength > 8u \* 1024u \* 1024u/);
  assert.match(header, /consumer\.logicalWidth > 512/);
  assert.match(header, /PatchDecodePictureDataUriV15/);
  assert.match(header, /decoded\.bytes\.size\(\) != asset\.size/);
});

test('Button ImageList runtime smoke example compiles to one deduplicated PNG asset and two consumers', () => {
  const source = readFileSync('examples/button-imagelist-window.patch', 'utf8');
  const ir = buildNativeGuiIRV18(compile(source, { name: 'ButtonImageRuntime', kind: 'window' }));
  const payload = encodeNativeGuiPayloadV18(ir, { resources: [OPEN_RESOURCE] });
  const inspected = inspectNativeGuiButtonImagesV18(payload);
  assert.equal(inspected.assets.length, 1);
  assert.equal(inspected.assets[0].resourceId, 'icons.open');
  assert.equal(inspected.consumers.length, 2);
  assert.deepEqual(inspected.consumers.map(item => item.controlId), ['open_settings', 'open_again']);
  assert.deepEqual(inspected.consumers.map(item => item.assetIndex), [0, 0]);
  assert.ok(inspected.payloadV17.length > 0);
  assert.match(source, /when open_settings clicked:\n  open settings/);
  assert.match(source, /window "Settings" as settings/);
});
