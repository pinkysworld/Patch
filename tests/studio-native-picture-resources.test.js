import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const nativeBuild = fs.readFileSync('web/native-build.js', 'utf8');
const nativePackage = fs.readFileSync('src/sealed-native-package.js', 'utf8');

 test('Studio native build resource bridge is browser-valid and reads canonical v4 resources', () => {
  execFileSync(process.execPath, ['--check', 'web/native-build.js'], { stdio: 'pipe' });
  assert.match(nativeBuild, /getStudioProjectDiagnosticContext, getStudioProjectResources/);
  assert.match(nativeBuild, /const resources = kind === 'window' \? getStudioProjectResources\(\) : \[\]/);
});

test('token-free Windows Linux and macOS builds pass project resources into current native sealing', () => {
  assert.match(nativeBuild, /sealCurrentNativeGuiRuntime\(runtimeBytes, nativeGui, \{ platform: 'windows', resources \}\)/);
  assert.match(nativeBuild, /buildLinuxNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources \}\)/);
  assert.match(nativeBuild, /buildMacosNativeGuiPackage\(runtimeBytes, nativeGui, \{ name, payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, resources \}\)/);
  assert.match(nativePackage, /sealCurrentNativeGuiRuntime\(runtime, nativeGui, \{ platform, resources \}\)/);
});

test('frozen native payload and cloud AOT paths fail closed for project Picture resources', () => {
  assert.match(nativePackage, /Project Picture resources require the current native payload\/runtime contract/);
  assert.match(nativeBuild, /Native AOT\/cloud build does not transport Studio project resources yet/);
  assert.match(nativeBuild, /code\.value\.includes\('patch-resource:'\)/);
});
