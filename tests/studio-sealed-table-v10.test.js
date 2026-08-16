import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const packageSource = fs.readFileSync('src/sealed-native-package.js', 'utf8');

test('Studio Ready Window builds lower Native GUI IR 1.1 and seal payload v10', () => {
  assert.match(studio, /buildNativeGuiIRV11 as buildNativeGuiIR/);
  assert.match(studio, /PATCH_SEALED_NATIVE_GUI_LIST_VERSION/);
  assert.match(studio, /sealNativeGuiRuntime\(runtimeBytes, nativeGui, \{ version: PATCH_SEALED_NATIVE_GUI_LIST_VERSION \}\)/);
  assert.match(studio, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_SEALED_NATIVE_GUI_LIST_VERSION \}\)/);
  assert.match(studio, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_SEALED_NATIVE_GUI_LIST_VERSION \}\)/);
});

test('Studio site and offline PWA cache contain the complete Native GUI IR 1.1 browser dependency chain', () => {
  for (const module of ['native-gui-ir-v08.js','native-gui-ir-v09.js','native-gui-ir-v10.js','native-gui-ir-v11.js']) {
    assert.ok(siteBuilder.includes(`'${module}'`), `site builder missing ${module}`);
    assert.ok(serviceWorker.includes(`../src/${module}`), `service worker missing ${module}`);
  }
});

test('sealed native package helpers forward an explicit payload version', () => {
  assert.match(packageSource, /version: options\.payloadVersion/);
});

test('Pages waits for and pins all three list-capable runtime v1.1 releases', () => {
  assert.match(pages, /Patch Native Sealed List Runtime/);
  assert.match(pages, /native-win32-runtime-v1\.1/);
  assert.match(pages, /native-linux-runtime-v1\.1/);
  assert.match(pages, /native-macos-runtime-v1\.1/);
  assert.match(pages, /ready=false/);
  assert.match(pages, /if: steps\.native_runtime\.outputs\.ready == 'true'/);
});
