import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const packageSource = fs.readFileSync('src/sealed-native-package.js', 'utf8');

test('Studio Ready Window builds lower Native GUI IR 1.1 and seal current payload v11', () => {
  assert.match(studio, /buildNativeGuiIRV11 as buildNativeGuiIR/);
  assert.match(studio, /PATCH_SEALED_NATIVE_GUI_MENU_VERSION/);
  assert.match(studio, /sealNativeGuiRuntimeV11\(runtimeBytes, nativeGui, \{ platform: 'windows' \}\)/);
  assert.match(studio, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_SEALED_NATIVE_GUI_MENU_VERSION \}\)/);
  assert.match(studio, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_SEALED_NATIVE_GUI_MENU_VERSION \}\)/);
  assert.match(studio, /allowMenuDecorations: true/);
});

test('Studio site and offline PWA cache contain the complete Native GUI IR 1.1 browser dependency chain', () => {
  for (const module of ['native-gui-ir-v08.js','native-gui-ir-v09.js','native-gui-ir-v10.js','native-gui-ir-v11.js']) {
    assert.ok(siteBuilder.includes(`'${module}'`), `site builder missing ${module}`);
    assert.ok(serviceWorker.includes(`../src/${module}`), `service worker missing ${module}`);
  }
  assert.ok(siteBuilder.includes("'sealed-native-gui-v11.js'"), 'site builder missing current v11 sealer');
});

test('sealed native package helpers route payload v11 to the v11 sealer and preserve explicit older versions', () => {
  assert.match(packageSource, /Number\(payloadVersion\) === PATCH_SEALED_NATIVE_GUI_MENU_VERSION/);
  assert.match(packageSource, /sealNativeGuiRuntimeV11\(runtime, nativeGui, \{ platform \}\)/);
  assert.match(packageSource, /sealNativeGuiRuntime\(runtime, nativeGui, \{ platform, version: payloadVersion \}\)/);
});

test('Pages waits for and pins all three current Menu-capable runtime v1.2 releases while retaining compatibility triggers', () => {
  assert.match(pages, /Patch Native Sealed List Runtime/);
  assert.match(pages, /Patch Native Sealed Menu Runtime/);
  assert.match(pages, /Patch Native Sealed Menu Runtime v1\.2 Release/);
  assert.match(pages, /native-win32-runtime-v1\.2/);
  assert.match(pages, /native-linux-runtime-v1\.2/);
  assert.match(pages, /native-macos-runtime-v1\.2/);
  assert.match(pages, /ready=false/);
  assert.match(pages, /if: steps\.native_runtime\.outputs\.ready == 'true'/);
});