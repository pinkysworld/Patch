import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nativeBuild = fs.readFileSync('web/native-build.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const integrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');
const packageSource = fs.readFileSync('src/sealed-native-package.js', 'utf8');
const v12 = fs.readFileSync('src/sealed-native-gui-v12.js', 'utf8');
const v13 = fs.readFileSync('src/sealed-native-gui-v13.js', 'utf8');

test('Studio token-free Window builds lower Native GUI IR 1.3 and seal payload v13', () => {
  assert.match(nativeBuild, /buildNativeGuiIRV13 as buildNativeGuiIR/);
  assert.match(nativeBuild, /sealed-native-gui-v13\.js/);
  assert.match(nativeBuild, /PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION/);
  assert.match(nativeBuild, /sealNativeGuiRuntimeV13\(runtimeBytes, nativeGui, \{ platform: 'windows' \}\)/);
  assert.match(nativeBuild, /payloadVersion: PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION/);
  assert.match(nativeBuild, /allowTree: true/);
  assert.match(nativeBuild, /allowSlider: true/);
});

test('Pages gates deployment on published runtime v1.4 assets for all desktop hosts', () => {
  for (const tag of ['native-win32-runtime-v1.4','native-macos-runtime-v1.4','native-linux-runtime-v1.4']) assert.ok(pages.includes(tag), tag);
  assert.match(pages, /Patch Native Sealed Slider Runtime v1\.4/);
  assert.match(pages, /Patch Native Sealed TreeView Runtime v1\.3/);
  assert.match(pages, /runtime-integrity-manifest\.js/);
  assert.match(pages, /\^sha256:\[0-9a-f\]\{64\}\$/);
  assert.match(pages, /steps\.native_runtime\.outputs\.ready == 'true'/);
});

test('Studio advertises current payload v13 runtime v1.4 native Slider support', () => {
  assert.match(nativeBuild, /Native GUI IR 1\.3/);
  assert.match(nativeBuild, /payload v13/);
  assert.match(nativeBuild, /runtime v1\.4/i);
  assert.match(nativeBuild, /including TreeView and Slider/);
  assert.match(index, /Ready\/offline Windows, macOS and Linux/);
  assert.match(index, /hierarchical TreeView/);
  assert.match(index, /Slider Stage 1/);
});

test('payload v12 runtime v1.3 remains an explicit frozen compatibility line', () => {
  assert.match(v12, /PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12/);
  assert.match(v13, /PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION = 13/);
  assert.match(packageSource, /sealNativeGuiRuntimeV12/);
  assert.match(packageSource, /sealNativeGuiRuntimeV13/);
});

test('runtime integrity remains a separate browser-side SHA-256 verification gate', () => {
  assert.match(integrity, /runtime-manifest\.json/);
  assert.match(integrity, /SHA-256|sha256/i);
  assert.match(integrity, /crypto\.subtle|subtle\.digest/);
});