import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const nativeBuild = fs.readFileSync('web/native-build.js', 'utf8');
const nativePackage = fs.readFileSync('src/sealed-native-package.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Studio native build resource bridge is browser-valid and reads canonical v4 resources', () => {
  execFileSync(process.execPath, ['--check', 'web/native-build.js'], { stdio: 'pipe' });
  assert.match(nativeBuild, /getStudioProjectDiagnosticContext, getStudioProjectResources/);
  assert.match(nativeBuild, /const resources = kind === 'window' \? getStudioProjectResources\(\) : \[\]/);
});

test('token-free Windows Linux and macOS builds pass project resources into current native packaging', () => {
  assert.match(nativeBuild, /sealCurrentNativeGuiRuntime\(runtimeBytes, nativeGui, \{ platform: 'windows', name, resources \}\)/);
  assert.match(nativeBuild, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources \}\)/);
  assert.match(nativeBuild, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources \}\)/);
  assert.match(nativePackage, /createNativeWindowIconPackagePlanV110/);
  assert.match(nativePackage, /resources: options\.resources \?\? \[\]/);
});

test('frozen native payload and cloud AOT paths fail closed for project Picture resources', () => {
  assert.match(nativePackage, /Project Picture resources require the current native payload\/runtime contract/);
  assert.match(nativeBuild, /Native AOT\/cloud build does not transport Studio project resources yet/);
  assert.match(nativeBuild, /code\.value\.includes\('patch-resource:'\)/);
});

test('public Studio module graph packages and caches the native Picture format policy and resource resolver', () => {
  assert.match(buildSite, /'native-current-contract\.js','native-picture-format-policy\.js','native-picture-resources\.js','native-frozen-contract\.js'/);
  assert.ok(sw.includes("'../src/native-picture-format-policy.js'"));
  assert.ok(sw.includes("'../src/native-picture-resources.js'"));
});
