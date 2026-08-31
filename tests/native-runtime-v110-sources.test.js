import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV19 } from '../src/native-gui-ir-v19.js';
import {
  encodeNativeGuiPayloadV19,
  inspectNativeGuiButtonImagesV19,
  inspectNativeGuiWindowIconsV19
} from '../src/sealed-native-gui-v19.js';

// Structural assertions complement the workflow's real Windows/macOS/Linux
// build-and-smoke jobs. They intentionally verify stable contract markers only.
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg==';
const PNG_SHA256 = 'd126901e8b7f82749aee7b7c0ec59838286c9f8d75ffc74147f34ac2b4bad460';
const resource = id => Object.freeze({
  id,
  path: `resources/${id.replaceAll('.', '-')}.png`,
  mediaType: 'image/png',
  size: 70,
  sha256: PNG_SHA256,
  data: PNG_BASE64
});
const RESOURCES = Object.freeze([
  resource('app.icon'),
  resource('about.icon'),
  resource('icons.open')
]);

test('runtime v1.10 sources wrap v1.9 and consume payload 19 / WICO natively', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v110.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v110.mm', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v110.cpp', 'utf8');
  const header = readFileSync('native-runtime/sealed-window-icon-v110.hpp', 'utf8');
  const buttonHeader = readFileSync('native-runtime/sealed-button-image-v19.hpp', 'utf8');

  for (const source of [win32, appkit, gtk]) {
    assert.match(source, /version != 19/);
    assert.match(source, /PatchConvertPayloadV19ToV18/);
    assert.match(source, /PatchConvertPayloadV18ToV17/);
    assert.match(source, /PatchInstallButtonImagesV19/);
    assert.match(source, /PatchInstallWindowIconsV110/);
    assert.match(source, /RunPatchButtonImageSmokeV19/);
    assert.match(source, /RunPatchWindowIconSmokeV110/);
    assert.match(source, /sealed-window-icon-v110\.hpp/);
    assert.match(source, /(?:return|int code =) 460/);
  }

  assert.match(win32, /WM_SETICON/);
  assert.match(win32, /WM_GETICON/);
  assert.match(win32, /GetHICON/);
  assert.match(win32, /PatchWindowIconForFormV110/);
  assert.match(win32, /explicitIcon \? explicitIcon : application/);

  assert.match(appkit, /setApplicationIconImage/);
  assert.match(appkit, /NSTitlebarAccessoryViewController/);
  assert.match(appkit, /addTitlebarAccessoryViewController/);
  assert.match(appkit, /NSImageScaleProportionallyUpOrDown/);
  assert.match(appkit, /PatchValidInstalledImageV110/);
  assert.match(appkit, /return 464/);

  assert.match(gtk, /gtk_window_set_default_icon/);
  assert.match(gtk, /gtk_window_set_icon/);
  assert.match(gtk, /gtk_window_get_icon/);
  assert.match(gtk, /gdk_pixbuf_loader_new/);

  assert.match(header, /"WICO"/);
  assert.match(header, /assetCount > 256/);
  assert.match(header, /consumerCount > 1024/);
  assert.match(header, /extensionLength > 8u \* 1024u \* 1024u/);
  assert.match(header, /PatchDecodePictureDataUriV15/);
  assert.match(header, /decoded\.bytes\.size\(\) != asset\.size/);
  assert.match(header, /\(index == 0\) != consumer\.application/);
  assert.match(buttonHeader, /PATCH_WIN32_RUNTIME_V110_RESTORE_ENTRY/);
  assert.match(buttonHeader, /PATCH_RUNTIME_V110_RESTORE_MAIN/);
});

test('native Window icon smoke example carries WICO and preserves BIMG underneath', () => {
  const source = readFileSync('examples/window-icons-native.patch', 'utf8');
  const ir = buildNativeGuiIRV19(compile(source, { name: 'WindowIconRuntime', kind: 'window' }));
  const payload = encodeNativeGuiPayloadV19(ir, { resources: RESOURCES });

  const icons = inspectNativeGuiWindowIconsV19(payload);
  assert.equal(icons.assets.length, 2);
  assert.deepEqual(icons.assets.map(item => item.resourceId), ['app.icon', 'about.icon']);
  assert.equal(icons.consumers.length, 2);
  assert.deepEqual(icons.consumers.map(item => item.formId), ['main', 'about']);
  assert.equal(icons.applicationIcon.formId, 'main');
  assert.equal(icons.applicationIcon.resourceId, 'app.icon');

  const buttons = inspectNativeGuiButtonImagesV19(payload);
  assert.equal(buttons.assets.length, 1);
  assert.equal(buttons.assets[0].resourceId, 'icons.open');
  assert.equal(buttons.consumers.length, 1);
  assert.equal(buttons.consumers[0].controlId, 'open_button');
  assert.ok(buttons.payloadV17.length > 0);

  assert.match(source, /window "Plain child" as plain/);
  assert.doesNotMatch(source, /window "Plain child"[^\n]* icon /);
});
