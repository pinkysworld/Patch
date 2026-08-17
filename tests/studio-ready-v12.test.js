import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nativeBuild = fs.readFileSync('web/native-build.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const integrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');

test('Studio token-free Window builds lower Native GUI IR 1.1 and seal payload v11', () => {
  assert.match(nativeBuild, /buildNativeGuiIRV11 as buildNativeGuiIR/);
  assert.match(nativeBuild, /sealed-native-gui-v11\.js/);
  assert.match(nativeBuild, /PATCH_SEALED_NATIVE_GUI_MENU_VERSION/);
  assert.match(nativeBuild, /sealNativeGuiRuntimeV11\(runtimeBytes, nativeGui, \{ platform: 'windows' \}\)/);
  assert.match(nativeBuild, /payloadVersion: PATCH_SEALED_NATIVE_GUI_MENU_VERSION/);
  assert.doesNotMatch(nativeBuild, /PATCH_SEALED_NATIVE_GUI_LIST_VERSION/);
});

test('Pages gates deployment on published runtime v1.2 assets for all desktop hosts', () => {
  for (const tag of ['native-win32-runtime-v1.2','native-macos-runtime-v1.2','native-linux-runtime-v1.2']) assert.ok(pages.includes(tag), tag);
  assert.match(pages, /Patch Native Sealed Menu Runtime v1\.2 Release/);
  assert.match(pages, /runtime-integrity-manifest\.js/);
  assert.match(pages, /\^sha256:\[0-9a-f\]\{64\}\$/);
  assert.match(pages, /steps\.native_runtime\.outputs\.ready == 'true'/);
});

test('Studio advertises current payload v11 runtime v1.2 Menu and list support', () => {
  assert.match(index, /token-free Ready\/offline Windows, macOS and Linux apps/);
  assert.match(index, /Persistent selection still changes only through explicit <b>change<\/b>/);
  assert.match(index, /Native GUI IR 1\.1/);
  assert.match(index, /payload v11/);
  assert.match(index, /runtime v1\.2/i);
});

test('runtime integrity remains a separate browser-side SHA-256 verification gate', () => {
  assert.match(integrity, /runtime-manifest\.json/);
  assert.match(integrity, /SHA-256|sha256/i);
  assert.match(integrity, /crypto\.subtle|subtle\.digest/);
});
