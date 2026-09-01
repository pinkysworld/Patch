import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const current = fs.readFileSync('src/native-current-contract.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const packageSource = fs.readFileSync('src/sealed-native-package.js', 'utf8');

test('Studio Ready Window builds use the stable Current Ready IR 1.9 / payload v19 facade', () => {
  assert.match(studio, /native-current-contract\.js/);
  assert.match(studio, /buildCurrentNativeGuiIR as buildNativeGuiIR/);
  assert.match(studio, /PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.match(studio, /sealCurrentNativeGuiRuntime\(runtimeBytes, nativeGui, \{ platform: 'windows', name, resources \}\)/);
  assert.match(studio, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources \}\)/);
  assert.match(studio, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources \}\)/);
  assert.doesNotMatch(studio, /from ['"]\.\.\/src\/native-gui-ir-v13\.js['"]/);
  assert.doesNotMatch(studio, /from ['"]\.\.\/src\/sealed-native-gui-v13\.js['"]/);
  assert.match(current, /PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1\.9\/payload-19\/runtime-1\.10'/);
  assert.match(current, /buildNativeGuiIRV19/);
  assert.match(current, /sealNativeGuiRuntimeV19/);
  assert.match(current, /createNativeWindowIconPackagePlanV110/);
  assert.match(current, /toLegacyV17NativeGuiIR/);
  assert.match(studio, /allowMenuDecorations: true/);
  assert.match(studio, /allowTree: true/);
  assert.match(studio, /allowSlider: true/);
  assert.match(studio, /allowImageList: true/);
});

test('Studio site and offline PWA cache contain Current Ready v19 plus preserved compatibility modules', () => {
  for (const module of [
    'native-gui-ir-v12.js','native-gui-ir-v13.js','native-gui-ir-v14.js','native-gui-ir-v15.js','native-gui-ir-v16.js','native-gui-ir-v17.js','native-gui-ir-v18.js','native-gui-ir-v19.js',
    'native-current-contract.js','native-picture-format-policy.js','native-picture-resources.js','native-frozen-contract.js','native-gui-frozen-lower.js','native-gui-frozen-seal.js',
    'native-tree-backend-adapter.js','native-slider-backend-adapter.js','native-chrome-backend-adapter.js','native-shape-backend-adapter.js','native-paintbox-backend-adapter.js','native-paintbox-image-backend-adapter.js','native-button-image-backend-adapter.js','native-window-icon-backend-adapter.js',
    'sealed-native-gui-v17.js','sealed-native-gui-v18.js','sealed-native-gui-v19.js','native-window-icon-packaging.js','native-window-icon-package-v110.js','windows-pe-icon-v110.js'
  ]) {
    assert.ok(siteBuilder.includes(`'${module}'`), `site builder missing ${module}`);
    assert.ok(serviceWorker.includes(`../src/${module}`), `service worker missing ${module}`);
  }
  assert.equal(siteBuilder.includes("'native-gui-ir-v08.js'"), false);
  assert.equal(siteBuilder.includes("'native-gui-ir-v11.js'"), false);
  assert.equal(siteBuilder.includes("'sealed-native-gui-v11.js'"), false);
  assert.ok(siteBuilder.includes("'sealed-native-gui-v12.js'"), 'site builder missing frozen v12 compatibility sealer');
  assert.ok(siteBuilder.includes("'sealed-native-gui-v13.js'"), 'site builder missing v13 compatibility implementation sealer');
});

test('sealed native package helpers route Current Ready v19 through the v1.10 package plan and frozen v12 through its facade', () => {
  assert.match(packageSource, /native-current-contract\.js/);
  assert.match(packageSource, /native-frozen-contract\.js/);
  assert.match(packageSource, /PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.match(packageSource, /createNativeWindowIconPackagePlanV110/);
  assert.match(packageSource, /PATCH_FROZEN_NATIVE_PAYLOAD_VERSION/);
  assert.match(packageSource, /sealFrozenNativeGuiRuntime\(runtime, nativeGui, \{ platform \}\)/);
  assert.match(packageSource, /Project Picture resources require the current native payload\/runtime contract/);
  assert.doesNotMatch(packageSource, /payload v12 or v13/);
  assert.doesNotMatch(packageSource, /sealed-native-gui-v11\.js/);
  assert.doesNotMatch(packageSource, /from ['"]\.\/sealed-native-gui\.js['"]/);
});

test('Pages waits for Current Ready runtime v1.10 while preserving historical workflow triggers', () => {
  assert.doesNotMatch(pages, /Patch Native Sealed List Runtime,/);
  assert.doesNotMatch(pages, /Patch Native Sealed Table Runtime/);
  assert.doesNotMatch(pages, /Patch Native Sealed Menu Runtime,/);
  assert.match(pages, /Patch Native Sealed Menu Runtime v1\.2 Release/);
  assert.match(pages, /Patch Native Sealed TreeView Runtime v1\.3/);
  assert.match(pages, /Patch Native Sealed Slider Runtime v1\.4/);
  assert.match(pages, /Patch Native Sealed Shape Runtime v1\.6/);
  assert.match(pages, /Patch Native Sealed PaintBox Runtime v1\.7/);
  assert.match(pages, /Patch Native Sealed PaintBox Image Runtime v1\.8/);
  assert.match(pages, /Patch Native Sealed Button Image Runtime v1\.9/);
  assert.match(pages, /Patch Native Sealed Window Icon Runtime v1\.10/);
  assert.match(pages, /src\/native-current-contract\.js/);
  assert.match(pages, /src\/native-frozen-contract\.js/);
  assert.match(pages, /WIN32_RUNTIME_TAG: native-win32-runtime-v1\.10/);
  assert.match(pages, /LINUX_NATIVE_RUNTIME_TAG: native-linux-runtime-v1\.10/);
  assert.match(pages, /MACOS_NATIVE_RUNTIME_TAG: native-macos-runtime-v1\.10/);
  assert.match(pages, /Pinned runtime releases are still publishing\. Deferring Pages without reporting an expected failure/);
  assert.match(pages, /A manual Pages deployment requires every pinned runtime release to exist\. Refusing to deploy\./);
  assert.match(pages, /if: steps\.native_runtime\.outputs\.ready == 'true'/);
});
