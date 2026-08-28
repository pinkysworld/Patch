import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const current = fs.readFileSync('src/native-current-contract.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const packageSource = fs.readFileSync('src/sealed-native-package.js', 'utf8');

test('Studio Ready Window builds use the stable current facade for Native GUI IR 1.8 and payload v18', () => {
  assert.match(studio, /native-current-contract\.js/);
  assert.match(studio, /buildCurrentNativeGuiIR as buildNativeGuiIR/);
  assert.match(studio, /PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.match(studio, /sealCurrentNativeGuiRuntime\(runtimeBytes, nativeGui, \{ platform: 'windows', resources \}\)/);
  assert.match(studio, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources \}\)/);
  assert.match(studio, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources \}\)/);
  assert.doesNotMatch(studio, /from ['"]\.\.\/src\/native-gui-ir-v13\.js['"]/);
  assert.doesNotMatch(studio, /from ['"]\.\.\/src\/sealed-native-gui-v13\.js['"]/);
  assert.match(current, /PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1\.8\/payload-18\/runtime-1\.9'/);
  assert.match(current, /buildNativeGuiIRV18/);
  assert.match(current, /sealNativeGuiRuntimeV18/);
  assert.match(current, /resolveNativePictureResources/);
  assert.match(studio, /allowMenuDecorations: true/);
  assert.match(studio, /allowTree: true/);
  assert.match(studio, /allowSlider: true/);
});

test('Studio site and offline PWA cache contain current v17 plus frozen compatibility modules without retired v07-v11 copies', () => {
  for (const module of ['native-gui-ir-v12.js','native-gui-ir-v13.js','native-gui-ir-v14.js','native-gui-ir-v15.js','native-gui-ir-v16.js','native-gui-ir-v17.js','native-gui-ir-v18.js','native-current-contract.js','native-picture-format-policy.js','native-picture-resources.js','native-frozen-contract.js','native-gui-frozen-lower.js','native-gui-frozen-seal.js','native-tree-backend-adapter.js','native-slider-backend-adapter.js','native-chrome-backend-adapter.js','native-shape-backend-adapter.js','native-paintbox-backend-adapter.js','native-paintbox-image-backend-adapter.js','native-imagelist-backend-adapter.js']) {
    assert.ok(siteBuilder.includes(`'${module}'`), `site builder missing ${module}`);
    assert.ok(serviceWorker.includes(`../src/${module}`), `service worker missing ${module}`);
  }
  assert.equal(siteBuilder.includes("'native-gui-ir-v08.js'"), false);
  assert.equal(siteBuilder.includes("'native-gui-ir-v11.js'"), false);
  assert.equal(siteBuilder.includes("'sealed-native-gui-v11.js'"), false);
  assert.ok(siteBuilder.includes("'sealed-native-gui-v12.js'"), 'site builder missing frozen v12 compatibility sealer');
  assert.ok(siteBuilder.includes("'sealed-native-gui-v13.js'"), 'site builder missing v13 compatibility implementation sealer');
  assert.ok(siteBuilder.includes("'sealed-native-gui-v14.js'"), 'site builder missing v14 compatibility sealer');
  assert.ok(siteBuilder.includes("'sealed-native-gui-v15.js'"), 'site builder missing v15 compatibility sealer');
  assert.ok(siteBuilder.includes("'sealed-native-gui-v16.js'"), 'site builder missing v16 implementation sealer');
  assert.ok(siteBuilder.includes("'sealed-native-gui-v17.js'"), 'site builder missing v17 compatibility sealer');
  assert.ok(siteBuilder.includes("'sealed-native-gui-v18.js'"), 'site builder missing current v18 implementation sealer');
});

test('sealed native package helpers route payload v18 and frozen v12 through live facades', () => {
  assert.match(packageSource, /native-current-contract\.js/);
  assert.match(packageSource, /native-frozen-contract\.js/);
  assert.match(packageSource, /PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.match(packageSource, /sealCurrentNativeGuiRuntime\(runtime, nativeGui, \{ platform, resources \}\)/);
  assert.match(packageSource, /PATCH_FROZEN_NATIVE_PAYLOAD_VERSION/);
  assert.match(packageSource, /sealFrozenNativeGuiRuntime\(runtime, nativeGui, \{ platform \}\)/);
  assert.match(packageSource, /Project Picture resources require the current native payload\/runtime contract/);
  assert.match(packageSource, /payload v\$\{PATCH_FROZEN_NATIVE_PAYLOAD_VERSION\} or v\$\{PATCH_CURRENT_NATIVE_PAYLOAD_VERSION\}/);
  assert.doesNotMatch(packageSource, /payload v12 or v13/);
  assert.doesNotMatch(packageSource, /sealed-native-gui-v11\.js/);
  assert.doesNotMatch(packageSource, /from ['"]\.\/sealed-native-gui\.js['"]/);
});

test('Pages waits for current ImageList v1.9 and frozen runtime lines without retired v07-v11 sealed workflows', () => {
  assert.doesNotMatch(pages, /Patch Native Sealed List Runtime,/);
  assert.doesNotMatch(pages, /Patch Native Sealed Table Runtime/);
  assert.doesNotMatch(pages, /Patch Native Sealed Menu Runtime,/);
  assert.match(pages, /Patch Native Sealed Menu Runtime v1\.2 Release/);
  assert.match(pages, /Patch Native Sealed TreeView Runtime v1\.3/);
  assert.match(pages, /Patch Native Sealed Slider Runtime v1\.4/);
  assert.match(pages, /Patch Native Sealed Shape Runtime v1\.6/);
  assert.match(pages, /Patch Native Sealed PaintBox Runtime v1\.7/);
  assert.match(pages, /Patch Native Sealed PaintBox Image Runtime v1\.8/);
  assert.match(pages, /Patch Native Sealed ImageList Runtime v1\.9/);
  assert.match(pages, /src\/native-current-contract\.js/);
  assert.match(pages, /src\/native-frozen-contract\.js/);
  assert.match(pages, /native-win32-runtime-v1\.9/);
  assert.match(pages, /native-linux-runtime-v1\.9/);
  assert.match(pages, /native-macos-runtime-v1\.9/);
  assert.doesNotMatch(pages, /WIN32_RUNTIME_TAG: native-win32-runtime-v1\.8/);
  assert.doesNotMatch(pages, /LINUX_NATIVE_RUNTIME_TAG: native-linux-runtime-v1\.8/);
  assert.doesNotMatch(pages, /MACOS_NATIVE_RUNTIME_TAG: native-macos-runtime-v1\.8/);
  assert.match(pages, /Refusing to report a successful Pages run without a deployment/);
  assert.match(pages, /exit 1/);
  assert.match(pages, /if: steps\.native_runtime\.outputs\.ready == 'true'/);
});
