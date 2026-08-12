import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/windows-single-exe.yml', 'utf8');

test('Studio defaults Windows Window builds to token-free native single EXE sealing', () => {
  assert.match(studio, /WINDOWS_NATIVE_GUI_RUNTIME = '\.\/runtimes\/patch-windows-native-gui-runtime\.exe'/);
  assert.match(studio, /buildNativeGuiIR/);
  assert.match(studio, /sealNativeGuiRuntime/);
  assert.match(studio, /Native single EXE \(no token, recommended\)/);
  assert.match(studio, /nativeBuildMode\.value = 'prebuilt'/);
  assert.match(studio, /downloadBytes\(sealed, `\$\{name\}\.exe`/);
  assert.match(studio, /No GitHub token was used/);
  assert.match(studio, /no Electron/);
});

test('Studio keeps project-specific MSVC codegen as optional Native AOT route', () => {
  assert.match(studio, /const WINDOWS_SINGLE_EXE_WORKFLOW = 'windows-single-exe\.yml'/);
  assert.match(studio, /Native AOT EXE \(GitHub Actions\)/);
  assert.match(studio, /const directWin32 = platform === 'windows' && kind === 'window'/);
  assert.match(studio, /const directNativeWindow = kind === 'window' && \['windows', 'macos', 'linux'\]\.includes\(platform\)/);
  assert.match(studio, /const requestId = makeRequestId\(\)/);
  assert.match(studio, /const inputs = snapshot\.directNativeWindow\s*\? \{ source_b64: snapshot\.sourceBase64, source_path: '', app_name: snapshot\.name, request_id: requestId \}/);
  assert.match(studio, /const expectedName = snapshot\.directWin32 \? 'patch-windows-single-exe'/);
});

test('Studio keeps Electron Window packaging explicitly compatibility-only', () => {
  assert.match(studio, /Compatibility package \(Electron, no token\)/);
  assert.match(studio, /option value=\"compat\"/);
  assert.match(studio, /Electron compatibility runtime/);
});

test('Windows AOT single-EXE workflow still accepts Studio source and preserves one-file contract', () => {
  assert.match(workflow, /source_b64:/);
  assert.match(workflow, /request_id:/);
  assert.match(workflow, /FromBase64String/);
  assert.match(workflow, /build-native-win32\.js/);
  assert.match(workflow, /patch-app\.json must never be shipped/);
  assert.match(workflow, /Deliverable must contain exactly one \.exe file/);
  assert.match(workflow, /name: patch-windows-single-exe/);
});
