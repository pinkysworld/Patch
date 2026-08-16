import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nativeBuild = fs.readFileSync('web/native-build.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const integrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');

test('Studio token-free Window builds lower Native GUI IR 1.1 and seal payload v10', () => {
  assert.match(nativeBuild, /buildNativeGuiIRV11 as buildNativeGuiIR/);
  assert.match(nativeBuild, /PATCH_SEALED_NATIVE_GUI_LIST_VERSION/);
  assert.match(nativeBuild, /sealNativeGuiRuntime\(runtimeBytes, nativeGui, \{ version: PATCH_SEALED_NATIVE_GUI_LIST_VERSION \}\)/);
  assert.match(nativeBuild, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_SEALED_NATIVE_GUI_LIST_VERSION \}\)/);
  assert.match(nativeBuild, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_SEALED_NATIVE_GUI_LIST_VERSION \}\)/);
  assert.doesNotMatch(nativeBuild, /PATCH_SEALED_NATIVE_GUI_TABLE_VERSION/);
});

test('Pages gates deployment on published runtime v1.1 assets for all desktop hosts', () => {
  for (const tag of [
    'native-win32-runtime-v1.1',
    'native-macos-runtime-v1.1',
    'native-linux-runtime-v1.1'
  ]) assert.ok(pages.includes(tag), tag);
  assert.match(pages, /Patch Native Sealed List Runtime/);
  assert.match(pages, /runtime-integrity-manifest\.js/);
  assert.match(pages, /\^sha256:\[0-9a-f\]\{64\}\$/);
  assert.match(pages, /steps\.native_runtime\.outputs\.ready == 'true'/);
});

test('Studio tells users multi-select Ready support and keeps explicit mutation visible', () => {
  assert.match(index, /token-free Ready\/offline Windows, macOS and Linux apps/);
  assert.match(index, /Persistent selection still changes only through explicit <b>change<\/b>/);
  assert.match(index, /Native GUI IR 1\.1/);
  assert.match(index, /payload v10/);
  assert.match(index, /runtime v1\.1/i);
  assert.doesNotMatch(index, /currently browser-only and native builds fail closed/);
});

test('runtime integrity remains a separate browser-side verification gate', () => {
  assert.match(integrity, /runtime-manifest\.json/);
  assert.match(integrity, /SHA-256|sha256/i);
  assert.match(integrity, /crypto\.subtle|subtle\.digest/);
});
