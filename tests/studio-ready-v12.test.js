import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nativeBuild = fs.readFileSync('web/native-build.js', 'utf8');
const current = fs.readFileSync('src/native-current-contract.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const integrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');
const packageSource = fs.readFileSync('src/sealed-native-package.js', 'utf8');
const v12 = fs.readFileSync('src/sealed-native-gui-v12.js', 'utf8');
const v13 = fs.readFileSync('src/sealed-native-gui-v13.js', 'utf8');

test('Studio token-free Window builds lower Native GUI IR 1.4 and seal payload v14 through the current facade', () => {
  assert.match(nativeBuild, /native-current-contract\.js/);
  assert.match(nativeBuild, /buildCurrentNativeGuiIR as buildNativeGuiIR/);
  assert.match(nativeBuild, /PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.match(nativeBuild, /sealCurrentNativeGuiRuntime\(runtimeBytes, nativeGui, \{ platform: 'windows' \}\)/);
  assert.match(nativeBuild, /payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.doesNotMatch(nativeBuild, /sealed-native-gui-v13\.js/);
  assert.doesNotMatch(nativeBuild, /native-gui-ir-v13\.js/);
  assert.match(current, /PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1\.4\/payload-14\/runtime-1\.5'/);
  assert.match(current, /buildNativeGuiIRV14/);
  assert.match(current, /sealNativeGuiRuntimeV14/);
  assert.match(nativeBuild, /allowTree: true/);
  assert.match(nativeBuild, /allowSlider: true/);
});

test('Pages gates deployment on published runtime v1.5 assets for all desktop hosts', () => {
  for (const tag of ['native-win32-runtime-v1.5','native-macos-runtime-v1.5','native-linux-runtime-v1.5']) assert.ok(pages.includes(tag), tag);
  assert.match(pages, /src\/native-current-contract\.js/);
  assert.match(pages, /src\/native-frozen-contract\.js/);
  assert.match(pages, /Patch Native Sealed Chrome Runtime v1\.5/);
  assert.match(pages, /Patch Native Sealed TreeView Runtime v1\.3/);
  assert.match(pages, /runtime-integrity-manifest\.js/);
  assert.match(pages, /\^sha256:\[0-9a-f\]\{64\}\$/);
  assert.match(pages, /steps\.native_runtime\.outputs\.ready == 'true'/);
});

test('Studio advertises current payload v14 runtime v1.5 native GUI support', () => {
  assert.match(nativeBuild, /Native GUI IR 1\.4/);
  assert.match(nativeBuild, /payload v14/);
  assert.match(nativeBuild, /runtime v1\.5/i);
  assert.match(nativeBuild, /including TreeView and Slider/);
  assert.match(index, /Windows, macOS and Linux support Ready app download with no token or local toolchain/i);
  assert.match(index, /Native GUI IR 1\.4 \/ payload v14 \/ runtime v1\.5/i);
  assert.match(index, /IR 1\.4 \/ v1\.5/);
  assert.match(index, /TreeView/i);
  assert.match(index, /Slider/i);
  assert.match(index, /Older versioned contracts remain compatibility lines/i);
});

test('payload v12 runtime v1.3 remains an explicit frozen compatibility line', () => {
  assert.match(v12, /PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12/);
  assert.match(v13, /PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION = 13/);
  assert.match(packageSource, /native-frozen-contract\.js/);
  assert.match(packageSource, /sealFrozenNativeGuiRuntime/);
  assert.match(packageSource, /native-current-contract\.js/);
  assert.match(packageSource, /sealCurrentNativeGuiRuntime/);
  assert.doesNotMatch(packageSource, /sealNativeGuiRuntimeV11/);
});

test('runtime integrity remains a separate browser-side SHA-256 verification gate', () => {
  assert.match(integrity, /runtime-manifest\.json/);
  assert.match(integrity, /SHA-256|sha256/i);
  assert.match(integrity, /crypto\.subtle|subtle\.digest/);
});
