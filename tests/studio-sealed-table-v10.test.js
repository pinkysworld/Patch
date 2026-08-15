import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const packageSource = fs.readFileSync('src/sealed-native-package.js', 'utf8');

test('Studio Ready Window builds lower Native GUI IR 0.8 and seal payload v9', () => {
  assert.match(studio, /buildNativeGuiIRV08 as buildNativeGuiIR/);
  assert.match(studio, /PATCH_SEALED_NATIVE_GUI_TABLE_VERSION/);
  assert.match(studio, /sealNativeGuiRuntime\(runtimeBytes, nativeGui, \{ version: PATCH_SEALED_NATIVE_GUI_TABLE_VERSION \}\)/);
  assert.match(studio, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_SEALED_NATIVE_GUI_TABLE_VERSION \}\)/);
  assert.match(studio, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_SEALED_NATIVE_GUI_TABLE_VERSION \}\)/);
});

test('Studio site bundle contains the Native GUI IR 0.8 browser dependency', () => {
  assert.match(siteBuilder, /'native-gui-ir\.js','native-gui-ir-v08\.js','sealed-native-gui\.js'/);
});

test('sealed native package helpers forward an explicit payload version', () => {
  assert.match(packageSource, /version: options\.payloadVersion/);
});

test('Pages waits for and pins all three Table-capable runtime v1.0 releases', () => {
  assert.match(pages, /Patch Native Sealed Table Runtime/);
  assert.match(pages, /native-win32-runtime-v1\.0/);
  assert.match(pages, /native-linux-runtime-v1\.0/);
  assert.match(pages, /native-macos-runtime-v1\.0/);
  assert.match(pages, /ready=false/);
  assert.match(pages, /if: steps\.native_runtime\.outputs\.ready == 'true'/);
});
