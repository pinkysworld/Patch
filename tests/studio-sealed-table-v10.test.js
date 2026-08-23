import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const current = fs.readFileSync('src/native-current-contract.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const packageSource = fs.readFileSync('src/sealed-native-package.js', 'utf8');

test('Studio Ready Window builds use the stable current facade for Native GUI IR 1.3 and payload v13', () => {
  assert.match(studio, /native-current-contract\.js/);
  assert.match(studio, /buildCurrentNativeGuiIR as buildNativeGuiIR/);
  assert.match(studio, /PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.match(studio, /sealCurrentNativeGuiRuntime\(runtimeBytes, nativeGui, \{ platform: 'windows' \}\)/);
  assert.match(studio, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION \}\)/);
  assert.match(studio, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION \}\)/);
  assert.doesNotMatch(studio, /from ['"]\.\.\/src\/native-gui-ir-v13\.js['"]/);
  assert.doesNotMatch(studio, /from ['"]\.\.\/src\/sealed-native-gui-v13\.js['"]/);
  assert.match(current, /PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1\.3\/payload-13\/runtime-1\.4'/);
  assert.match(current, /buildNativeGuiIRV13/);
  assert.match(current, /sealNativeGuiRuntimeV13/);
  assert.match(studio, /allowMenuDecorations: true/);
  assert.match(studio, /allowTree: true/);
  assert.match(studio, /allowSlider: true/);
});

test('Studio site and offline PWA cache contain the live native contracts without retired v07–v11 copies', () => {
  for (const module of ['native-gui-ir-v12.js','native-gui-ir-v13.js','native-current-contract.js','native-frozen-contract.js','native-gui-frozen-lower.js','native-gui-frozen-seal.js','native-tree-backend-adapter.js','native-slider-backend-adapter.js']) {
    assert.ok(siteBuilder.includes(`'${module}'`), `site builder missing ${module}`);
    assert.ok(serviceWorker.includes(`../src/${module}`), `service worker missing ${module}`);
  }
  assert.equal(siteBuilder.includes("'native-gui-ir-v08.js'"), false);
  assert.equal(siteBuilder.includes("'native-gui-ir-v11.js'"), false);
  assert.equal(siteBuilder.includes("'sealed-native-gui-v11.js'"), false);
  assert.ok(siteBuilder.includes("'sealed-native-gui-v12.js'"), 'site builder missing frozen v12 compatibility sealer');
  assert.ok(siteBuilder.includes("'sealed-native-gui-v13.js'"), 'site builder missing current v13 implementation sealer');
});

test('sealed native package helpers route payload v13 and v12 through the live facades', () => {
  assert.match(packageSource, /native-current-contract\.js/);
  assert.match(packageSource, /native-frozen-contract\.js/);
  assert.match(packageSource, /PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.match(packageSource, /sealCurrentNativeGuiRuntime\(runtime, nativeGui, \{ platform \}\)/);
  assert.match(packageSource, /PATCH_FROZEN_NATIVE_PAYLOAD_VERSION/);
  assert.match(packageSource, /sealFrozenNativeGuiRuntime\(runtime, nativeGui, \{ platform \}\)/);
  assert.match(packageSource, /Ready\/offline native packages support payload v12 or v13/);
  assert.doesNotMatch(packageSource, /sealed-native-gui-v11\.js/);
  assert.doesNotMatch(packageSource, /from ['"]\.\/sealed-native-gui\.js['"]/);
});

test('Pages waits for current and frozen runtime lines without retired v07–v11 sealed workflows', () => {
  assert.doesNotMatch(pages, /Patch Native Sealed List Runtime,/);
  assert.doesNotMatch(pages, /Patch Native Sealed Table Runtime/);
  assert.doesNotMatch(pages, /Patch Native Sealed Menu Runtime,/);
  assert.match(pages, /Patch Native Sealed Menu Runtime v1\.2 Release/);
  assert.match(pages, /Patch Native Sealed TreeView Runtime v1\.3/);
  assert.match(pages, /Patch Native Sealed Slider Runtime v1\.4/);
  assert.match(pages, /src\/native-current-contract\.js/);
  assert.match(pages, /src\/native-frozen-contract\.js/);
  assert.match(pages, /native-win32-runtime-v1\.4/);
  assert.match(pages, /native-linux-runtime-v1\.4/);
  assert.match(pages, /native-macos-runtime-v1\.4/);
  assert.match(pages, /Refusing to report a successful Pages run without a deployment/);
  assert.match(pages, /exit 1/);
  assert.match(pages, /if: steps\.native_runtime\.outputs\.ready == 'true'/);
});
